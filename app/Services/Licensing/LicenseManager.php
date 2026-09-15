<?php

namespace Pterodactyl\Services\Licensing;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class LicenseManager
{
    /**
     * Master RSA Public Key (2048-bit)
     * Used to mathematically verify cryptographic signatures produced by the private key.
     */
    protected const PUBLIC_KEY = <<<PEM
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxa1nMYvqK+e9UJxYb4Bz
ZaTmHL+SZi4/LfyPifHznUOosNA1hz3jiQ2fZbejcinFkkIlHJwfCdNQwcKA1VNY
wmgC4zgRus8S836AGmQI8S8EI73BIYR0UhvFtHPTviwHxF6IjH967McxEOsN47De
0xr9EyomDYEN062OUdHEF8xZK4DfEwIse5wybvl7wRjRmagqqm35OVHQzRUA/5kF
v5gXjKqtnZZncAvuaR0SQ9NM+LNTFPB3przK5BYmYfBM3c3zqTJbOER+aWpqQ4Zq
1F3husqeWar890s1/dBOxjjG/finSgcEi+0NV+I9AF1u7rGOpQGnV2NAZbHTe5oR
AwIDAQAB
-----END PUBLIC KEY-----
PEM;

    /**
     * Retrieve the currently configured license key.
     */
    public function getLicenseKey(): ?string
    {
        $key = config('lunar.license.key', env('LUNAR_LICENSE_KEY'));
        if (!empty($key)) {
            return trim($key);
        }

        try {
            $dbKey = DB::table('settings')->where('key', 'lunar:license_key')->value('value');
            if (!empty($dbKey)) {
                return trim($dbKey);
            }
        } catch (\Throwable) {}

        return null;
    }

    /**
     * Update the license key in the database and clear cache.
     */
    public function setLicenseKey(string $key): void
    {
        $cleanKey = trim($key);
        try {
            DB::table('settings')->updateOrInsert(
                ['key' => 'lunar:license_key'],
                ['value' => $cleanKey]
            );
        } catch (\Throwable) {}

        $this->clearCache();
    }

    /**
     * Clear cached validation state.
     */
    public function clearCache(): void
    {
        try {
            Cache::forget('lunar:license:status');
            $tags = Cache::get('lunar:license:cache_keys', []);
            foreach ($tags as $tag) {
                Cache::forget($tag);
            }
            Cache::forget('lunar:license:cache_keys');
        } catch (\Throwable) {}
    }

    /**
     * Verify the license key against current host and expiration.
     */
    public function verify(?string $overrideKey = null): array
    {
        $key = $overrideKey !== null ? trim($overrideKey) : $this->getLicenseKey();
        $host = $this->getCurrentHost();

        if (empty($key)) {
            return [
                'valid' => false,
                'status' => 'missing',
                'message' => 'No license key configured. Enter a valid Lunar Panel license key to activate.',
                'tier' => 'none',
                'customer' => null,
                'domain' => null,
                'expires_at' => null,
                'days_remaining' => 0,
                'key_masked' => null,
                'host' => $host,
            ];
        }

        $cacheKey = 'lunar:license:status:' . md5($key . '|' . $host);

        // When not validating an ad-hoc override key, use cache
        if ($overrideKey === null) {
            $cached = Cache::get($cacheKey);
            if (is_array($cached) && isset($cached['valid'])) {
                return $cached;
            }
        }

        $result = $this->performCryptographicVerification($key, $host);

        if ($overrideKey === null && $result['valid']) {
            $ttl = (int) config('lunar.license.cache_ttl', 3600);
            Cache::put($cacheKey, $result, Carbon::now()->addSeconds(max(60, $ttl)));

            // Track cache keys for bulk clearing
            $tracked = Cache::get('lunar:license:cache_keys', []);
            $tracked[] = $cacheKey;
            Cache::put('lunar:license:cache_keys', array_unique($tracked), Carbon::now()->addDays(7));
        }

        return $result;
    }

    /**
     * Perform the actual RSA-2048 cryptographic signature check and constraints validation.
     */
    protected function performCryptographicVerification(string $key, string $host): array
    {
        $parts = explode('.', $key);
        if (count($parts) !== 3 || $parts[0] !== 'LNR-V1') {
            return [
                'valid' => false,
                'status' => 'invalid_format',
                'message' => 'License key format is invalid. Key must start with LNR-V1.',
                'tier' => 'none',
                'customer' => null,
                'domain' => null,
                'expires_at' => null,
                'days_remaining' => 0,
                'key_masked' => $this->maskKey($key),
                'host' => $host,
            ];
        }

        $payloadRaw = $this->base64UrlDecode($parts[1]);
        $signature = $this->base64UrlDecode($parts[2]);

        if (!$payloadRaw || !$signature) {
            return [
                'valid' => false,
                'status' => 'corrupted',
                'message' => 'License payload or cryptographic signature could not be decoded.',
                'tier' => 'none',
                'customer' => null,
                'domain' => null,
                'expires_at' => null,
                'days_remaining' => 0,
                'key_masked' => $this->maskKey($key),
                'host' => $host,
            ];
        }

        // Cryptographic RSA-2048 verification using Master Public Key
        $pubKeyResource = openssl_pkey_get_public(self::PUBLIC_KEY);
        if (!$pubKeyResource) {
            return [
                'valid' => false,
                'status' => 'system_error',
                'message' => 'OpenSSL public key parsing failed on this system.',
                'tier' => 'none',
                'customer' => null,
                'domain' => null,
                'expires_at' => null,
                'days_remaining' => 0,
                'key_masked' => $this->maskKey($key),
                'host' => $host,
            ];
        }

        $verifyResult = openssl_verify($payloadRaw, $signature, $pubKeyResource, OPENSSL_ALGO_SHA256);
        if ($verifyResult !== 1) {
            return [
                'valid' => false,
                'status' => 'invalid_signature',
                'message' => 'Cryptographic signature verification failed. This license key was tampered with or not issued by the master authority.',
                'tier' => 'none',
                'customer' => null,
                'domain' => null,
                'expires_at' => null,
                'days_remaining' => 0,
                'key_masked' => $this->maskKey($key),
                'host' => $host,
            ];
        }

        $payload = json_decode($payloadRaw, true);
        if (!is_array($payload) || !isset($payload['domain'])) {
            return [
                'valid' => false,
                'status' => 'malformed_payload',
                'message' => 'License payload data structure is malformed.',
                'tier' => 'none',
                'customer' => null,
                'domain' => null,
                'expires_at' => null,
                'days_remaining' => 0,
                'key_masked' => $this->maskKey($key),
                'host' => $host,
            ];
        }

        $licensedDomain = strtolower(trim($payload['domain']));
        $customer = $payload['customer'] ?? 'Licensed Operator';
        $tier = strtolower($payload['tier'] ?? 'enterprise');
        $expiresAt = isset($payload['expires_at']) && $payload['expires_at'] ? (int) $payload['expires_at'] : null;

        // Check expiration
        if ($expiresAt !== null && $expiresAt < time()) {
            return [
                'valid' => false,
                'status' => 'expired',
                'message' => 'License expired on ' . date('Y-m-d H:i:s T', $expiresAt) . '. Please renew your license.',
                'tier' => $tier,
                'customer' => $customer,
                'domain' => $licensedDomain,
                'expires_at' => $expiresAt,
                'days_remaining' => 0,
                'key_masked' => $this->maskKey($key),
                'host' => $host,
            ];
        }

        // Domain binding verification
        $isDomainValid = $this->matchDomain($licensedDomain, $host);
        if (!$isDomainValid) {
            return [
                'valid' => false,
                'status' => 'domain_mismatch',
                'message' => "License is bound to domain '{$licensedDomain}', but current panel host is '{$host}'.",
                'tier' => $tier,
                'customer' => $customer,
                'domain' => $licensedDomain,
                'expires_at' => $expiresAt,
                'days_remaining' => $expiresAt ? max(0, (int) ceil(($expiresAt - time()) / 86400)) : null,
                'key_masked' => $this->maskKey($key),
                'host' => $host,
            ];
        }

        $daysRemaining = $expiresAt ? max(0, (int) ceil(($expiresAt - time()) / 86400)) : null;

        return [
            'valid' => true,
            'status' => 'active',
            'message' => 'License is verified and active.',
            'tier' => $tier,
            'customer' => $customer,
            'domain' => $licensedDomain,
            'expires_at' => $expiresAt,
            'days_remaining' => $daysRemaining,
            'key_masked' => $this->maskKey($key),
            'host' => $host,
        ];
    }

    /**
     * Check if current host matches the licensed domain pattern.
     */
    protected function matchDomain(string $licensedDomain, string $host): bool
    {
        $licensedDomain = strtolower($licensedDomain);
        $host = strtolower($host);

        // Universal wildcard (author/global license)
        if ($licensedDomain === '*' || $licensedDomain === 'all') {
            return true;
        }

        // Exact match
        if ($licensedDomain === $host) {
            return true;
        }

        // Wildcard match (e.g. *.example.com matches panel.example.com)
        if (str_starts_with($licensedDomain, '*.')) {
            $rootDomain = substr($licensedDomain, 2);
            if ($host === $rootDomain || str_ends_with($host, '.' . $rootDomain)) {
                return true;
            }
        }

        // Local development exception if configured
        $allowLocal = config('lunar.license.allow_local', false);
        if ($allowLocal && in_array($host, ['localhost', '127.0.0.1', '::1', 'test.local'], true)) {
            return true;
        }

        return false;
    }

    /**
     * Determine the current panel host.
     */
    public function getCurrentHost(): string
    {
        if (request() && request()->getHost()) {
            return strtolower(request()->getHost());
        }

        $appUrl = config('app.url', 'http://localhost');
        $parsed = parse_url($appUrl, PHP_URL_HOST);
        return strtolower($parsed ?: 'localhost');
    }

    /**
     * Generate a cryptographically signed license key using the private key.
     * (Called by the generator command for the repository owner).
     */
    public static function createLicenseKey(
        string $privateKeyPem,
        string $domain,
        string $customer,
        string $tier = 'enterprise',
        ?int $expiresAt = null
    ): string {
        $privKeyResource = openssl_pkey_get_private($privateKeyPem);
        if (!$privKeyResource) {
            throw new \RuntimeException('Invalid OpenSSL private key provided.');
        }

        $payload = [
            'id' => 'LNR-' . strtoupper(substr(md5(uniqid('', true)), 0, 8)),
            'domain' => strtolower(trim($domain)),
            'customer' => trim($customer),
            'tier' => strtolower($tier),
            'expires_at' => $expiresAt,
            'issued_at' => time(),
        ];

        $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $signature = '';
        $signed = openssl_sign($payloadJson, $signature, $privKeyResource, OPENSSL_ALGO_SHA256);
        if (!$signed) {
            throw new \RuntimeException('Failed to sign license payload with private key.');
        }

        return 'LNR-V1.' . self::base64UrlEncodeStatic($payloadJson) . '.' . self::base64UrlEncodeStatic($signature);
    }

    /**
     * Helper to mask license key for display.
     */
    protected function maskKey(string $key): string
    {
        if (strlen($key) < 20) {
            return 'LNR-V1-****';
        }
        return substr($key, 0, 12) . '••••••••' . substr($key, -8);
    }

    /**
     * Base64 URL Safe Encode.
     */
    protected static function base64UrlEncodeStatic(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Base64 URL Safe Decode.
     */
    protected function base64UrlDecode(string $data): ?string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $padlen = 4 - $remainder;
            $data .= str_repeat('=', $padlen);
        }
        $decoded = base64_decode(strtr($data, '-_', '+/'), true);
        return $decoded === false ? null : $decoded;
    }
}
