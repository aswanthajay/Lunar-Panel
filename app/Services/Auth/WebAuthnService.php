<?php

namespace Pterodactyl\Services\Auth;

use Illuminate\Support\Str;
use Pterodactyl\Models\User;
use Pterodactyl\Models\UserPasskey;
use Pterodactyl\Exceptions\DisplayException;

class WebAuthnService
{
    /**
     * Generate a 32-byte cryptographically secure base64url challenge.
     */
    public function generateChallenge(): string
    {
        return $this->base64UrlEncode(random_bytes(32));
    }

    /**
     * Decode base64url string to binary string.
     */
    public function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        return base64_decode(strtr($data, '-_', '+/'));
    }

    /**
     * Encode binary string to base64url.
     */
    public function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Parse attestationObject and extract credentialId, public key PEM, aaguid, and transports.
     */
    public function extractAttestationData(string $attestationObjectRaw, ?string $spkiDerRaw = null): array
    {
        $publicKeyPem = null;

        if (!empty($spkiDerRaw)) {
            $publicKeyPem = $this->spkiToPem($spkiDerRaw);
        }

        $cbor = $this->decodeCbor($attestationObjectRaw);
        if (!is_array($cbor) || !isset($cbor['authData'])) {
            throw new DisplayException('Invalid WebAuthn attestation object structure.');
        }

        $authData = $cbor['authData'];
        $fmt = $cbor['fmt'] ?? 'none';

        if (strlen($authData) < 37) {
            throw new DisplayException('Attestation authData is too short.');
        }

        $flags = ord($authData[32]);
        $hasAttestedCredentialData = ($flags & 0x40) !== 0;

        if (!$hasAttestedCredentialData) {
            throw new DisplayException('No attested credential data found in authenticator response.');
        }

        $aaguid = substr($authData, 37, 16);
        $credIdLen = unpack('n', substr($authData, 53, 2))[1];
        $credentialId = substr($authData, 55, $credIdLen);

        if (empty($publicKeyPem)) {
            $coseOffset = 55 + $credIdLen;
            $coseKey = $this->decodeCbor($authData, $coseOffset);
            if (!is_array($coseKey)) {
                throw new DisplayException('Could not parse public key from authenticator attestation data.');
            }
            $publicKeyPem = $this->coseToPem($coseKey);
        }

        if (empty($publicKeyPem)) {
            throw new DisplayException('Failed to derive a valid PEM public key for this passkey.');
        }

        return [
            'credential_id' => $this->base64UrlEncode($credentialId),
            'public_key' => $publicKeyPem,
            'attestation_type' => $fmt,
            'aaguid' => bin2hex($aaguid),
        ];
    }

    /**
     * Verify a WebAuthn login assertion.
     */
    public function verifyAssertion(
        UserPasskey $passkey,
        string $authenticatorDataRaw,
        string $clientDataJSONRaw,
        string $signatureRaw,
        string $expectedChallenge,
        string $expectedRpId
    ): bool {
        // 1. Verify ClientDataJSON
        $clientData = json_decode($clientDataJSONRaw, true);
        if (!is_array($clientData) || ($clientData['type'] ?? '') !== 'webauthn.get') {
            throw new DisplayException('Invalid WebAuthn assertion type.');
        }

        if (($clientData['challenge'] ?? '') !== $expectedChallenge) {
            throw new DisplayException('WebAuthn authentication challenge mismatch or expired.');
        }

        // 2. Verify AuthenticatorData
        if (strlen($authenticatorDataRaw) < 37) {
            throw new DisplayException('Authenticator data is malformed.');
        }

        $rpIdHash = substr($authenticatorDataRaw, 0, 32);
        $expectedRpIdHash = hash('sha256', $expectedRpId, true);
        if (!hash_equals($rpIdHash, $expectedRpIdHash)) {
            // Also test apex host if subdomain
            $hostParts = explode(':', $expectedRpId)[0];
            $altRpIdHash = hash('sha256', $hostParts, true);
            if (!hash_equals($rpIdHash, $altRpIdHash)) {
                throw new DisplayException('Passkey RP ID verification failed.');
            }
        }

        $flags = ord($authenticatorDataRaw[32]);
        $userPresent = ($flags & 0x01) !== 0;
        if (!$userPresent) {
            throw new DisplayException('User presence verification is required.');
        }

        // 3. Cryptographic Signature Verification
        $dataToVerify = $authenticatorDataRaw . hash('sha256', $clientDataJSONRaw, true);
        $verifyResult = openssl_verify($dataToVerify, $signatureRaw, $passkey->public_key, OPENSSL_ALGO_SHA256);

        if ($verifyResult !== 1) {
            throw new DisplayException('Passkey cryptographic signature verification failed.');
        }

        // Update counter and last used time
        $counter = unpack('N', substr($authenticatorDataRaw, 33, 4))[1] ?? 0;
        $passkey->update([
            'counter' => $counter,
            'last_used_at' => now(),
        ]);

        return true;
    }

    /**
     * Convert SPKI DER bytes to PEM string.
     */
    public function spkiToPem(string $spkiDer): string
    {
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spkiDer), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    /**
     * Convert a COSE map structure into standard OpenSSL PEM public key.
     */
    public function coseToPem(array $cose): ?string
    {
        // EC2 P-256 (kty = 2, alg = -7, crv = 1)
        if (($cose[1] ?? null) === 2) {
            $x = $cose[-2] ?? null;
            $y = $cose[-3] ?? null;
            if (!$x || !$y || strlen($x) !== 32 || strlen($y) !== 32) {
                return null;
            }
            $point = "\x04" . $x . $y;
            $derHeader = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00";
            return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($derHeader . $point), 64, "\n") . "-----END PUBLIC KEY-----\n";
        }

        // RSA RS256 (kty = 3, alg = -257)
        if (($cose[1] ?? null) === 3) {
            $n = $cose[-1] ?? null;
            $e = $cose[-2] ?? null;
            if (!$n || !$e) {
                return null;
            }
            $encodeInt = function (string $bytes) {
                if (ord($bytes[0]) > 0x7F) {
                    $bytes = "\x00" . $bytes;
                }
                $len = strlen($bytes);
                if ($len < 128) {
                    return "\x02" . chr($len) . $bytes;
                } elseif ($len < 256) {
                    return "\x02\x81" . chr($len) . $bytes;
                } else {
                    return "\x02\x82" . chr($len >> 8) . chr($len & 0xFF) . $bytes;
                }
            };
            $rsaPub = "\x30" . $this->asn1Length(strlen($encodeInt($n) . $encodeInt($e))) . $encodeInt($n) . $encodeInt($e);
            $bitString = "\x03" . $this->asn1Length(strlen($rsaPub) + 1) . "\x00" . $rsaPub;
            $algorithm = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";
            $spki = "\x30" . $this->asn1Length(strlen($algorithm . $bitString)) . $algorithm . $bitString;
            return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
        }

        return null;
    }

    /**
     * Minimal CBOR binary decoder.
     */
    public function decodeCbor(string $data, int &$offset = 0): mixed
    {
        if ($offset >= strlen($data)) {
            return null;
        }

        $byte = ord($data[$offset++]);
        $major = $byte >> 5;
        $info = $byte & 0x1F;

        $val = match ($info) {
            24 => ord($data[$offset++]),
            25 => unpack('n', substr($data, ($offset += 2) - 2, 2))[1],
            26 => unpack('N', substr($data, ($offset += 4) - 4, 4))[1],
            27 => unpack('J', substr($data, ($offset += 8) - 8, 8))[1],
            default => $info,
        };

        switch ($major) {
            case 0:
                return $val;
            case 1:
                return -1 - $val;
            case 2:
            case 3:
                $str = substr($data, $offset, $val);
                $offset += $val;
                return $str;
            case 4:
                $arr = [];
                for ($i = 0; $i < $val; $i++) {
                    $arr[] = $this->decodeCbor($data, $offset);
                }
                return $arr;
            case 5:
                $map = [];
                for ($i = 0; $i < $val; $i++) {
                    $k = $this->decodeCbor($data, $offset);
                    $v = $this->decodeCbor($data, $offset);
                    $map[$k] = $v;
                }
                return $map;
            default:
                return null;
        }
    }

    private function asn1Length(int $len): string
    {
        if ($len < 128) {
            return chr($len);
        } elseif ($len < 256) {
            return "\x81" . chr($len);
        } else {
            return "\x82" . chr($len >> 8) . chr($len & 0xFF);
        }
    }
}