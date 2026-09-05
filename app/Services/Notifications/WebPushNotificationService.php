<?php

namespace Pterodactyl\Services\Notifications;

use Exception;
use GuzzleHttp\Client;
use Pterodactyl\Models\User;
use phpseclib3\Crypt\EC;
use Pterodactyl\Models\Server;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\PushSubscription;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class WebPushNotificationService
{
    private const SETTING_PUBLIC_KEY = 'lunar:vapid_public_key';
    private const SETTING_PRIVATE_KEY = 'lunar:vapid_private_key';

    protected Client $httpClient;

    public function __construct(protected SettingsRepositoryInterface $settings)
    {
        $this->httpClient = new Client([
            'timeout' => 8,
            'connect_timeout' => 4,
            'http_errors' => false,
        ]);
    }

    /**
     * Get or generate the VAPID public key (Base64URL uncompressed point format).
     */
    public function getVapidPublicKey(): string
    {
        $pub = $this->settings->get(self::SETTING_PUBLIC_KEY);
        if (!empty($pub)) {
            return $pub;
        }

        $this->generateAndStoreVapidKeys();
        return $this->settings->get(self::SETTING_PUBLIC_KEY);
    }

    /**
     * Get the VAPID private key in PKCS8 PEM format.
     */
    public function getVapidPrivateKey(): string
    {
        $priv = $this->settings->get(self::SETTING_PRIVATE_KEY);
        if (!empty($priv)) {
            return $priv;
        }

        $this->generateAndStoreVapidKeys();
        return $this->settings->get(self::SETTING_PRIVATE_KEY);
    }

    /**
     * Generate and store new VAPID EC P-256 keys.
     */
    public function generateAndStoreVapidKeys(): array
    {
        $key = EC::createKey('secp256r1');
        $rawPub = $key->getPublicKey()->getEncodedCoordinates();
        $pubB64 = self::base64UrlEncode($rawPub);
        $privPem = $key->toString('PKCS8');

        $this->settings->set(self::SETTING_PUBLIC_KEY, $pubB64);
        $this->settings->set(self::SETTING_PRIVATE_KEY, $privPem);

        return [
            'public_key' => $pubB64,
            'private_key' => $privPem,
        ];
    }

    /**
     * Send desktop push notification to a specific user across all their registered devices.
     */
    public function sendToUser(
        User $user,
        string $title,
        string $body,
        ?string $url = null,
        ?string $icon = null,
        string $category = 'general',
        array $actions = []
    ): int {
        // Check user preferences
        $prefs = $user->notification_preferences ?? [];
        if (isset($prefs[$category]) && $prefs[$category] === false) {
            return 0;
        }

        $subscriptions = $user->pushSubscriptions()->get();
        if ($subscriptions->isEmpty()) {
            return 0;
        }

        $payload = [
            'title' => $title,
            'body' => $body,
            'icon' => $icon ?: '/favicons/android-chrome-192x192.png',
            'badge' => '/favicons/favicon-32x32.png',
            'data' => [
                'url' => $url ?: '/',
                'category' => $category,
                'timestamp' => time(),
            ],
            'actions' => $actions,
        ];

        $sentCount = 0;
        foreach ($subscriptions as $subscription) {
            if ($this->sendToSubscription($subscription, $payload)) {
                $sentCount++;
            }
        }

        return $sentCount;
    }

    /**
     * Send notification to all root administrators.
     */
    public function sendToAllAdmins(
        string $title,
        string $body,
        ?string $url = null,
        ?string $icon = null,
        string $category = 'admin'
    ): int {
        $admins = User::query()->where('root_admin', 1)->get();
        $totalSent = 0;

        foreach ($admins as $admin) {
            $totalSent += $this->sendToUser($admin, $title, $body, $url, $icon, $category);
        }

        return $totalSent;
    }

    /**
     * Send notification to all stakeholders of a server (owner + subusers).
     */
    public function sendToServerStakeholders(
        Server $server,
        string $title,
        string $body,
        ?string $url = null,
        ?string $icon = null,
        string $category = 'server'
    ): int {
        $targetUrl = $url ?: "/server/{$server->uuidShort}";
        $server->loadMissing(['owner', 'subusers.user']);

        $sent = 0;
        if ($server->owner) {
            $sent += $this->sendToUser($server->owner, $title, $body, $targetUrl, $icon, $category);
        }

        if ($server->subusers) {
            foreach ($server->subusers as $subuser) {
                if ($subuser->user) {
                    $sent += $this->sendToUser($subuser->user, $title, $body, $targetUrl, $icon, $category);
                }
            }
        }

        return $sent;
    }

    /**
     * Send encrypted push payload to a specific browser push subscription endpoint.
     */
    public function sendToSubscription(PushSubscription $subscription, array $payload): bool
    {
        try {
            $endpoint = $subscription->endpoint;
            $parsedUrl = parse_url($endpoint);
            if (!isset($parsedUrl['scheme']) || !isset($parsedUrl['host'])) {
                return false;
            }

            $origin = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
            $vapidJwt = $this->createVapidJwt($origin);
            $vapidPublic = $this->getVapidPublicKey();

            $headers = [
                'TTL' => '86400',
                'Urgency' => 'high',
                'Authorization' => "vapid t={$vapidJwt}, k={$vapidPublic}",
            ];

            // If subscription has encryption keys, encrypt using RFC 8291
            if (!empty($subscription->public_key) && !empty($subscription->auth_token)) {
                $encrypted = $this->encryptPayload(
                    json_encode($payload),
                    self::base64UrlDecode($subscription->public_key),
                    self::base64UrlDecode($subscription->auth_token)
                );

                $headers['Content-Type'] = 'application/octet-stream';
                $headers['Content-Encoding'] = 'aes128gcm';
                $body = $encrypted;
            } else {
                $headers['Content-Type'] = 'text/plain';
                $body = '';
            }

            $response = $this->httpClient->post($endpoint, [
                'headers' => $headers,
                'body' => $body,
            ]);

            $statusCode = $response->getStatusCode();

            // 404 or 410 indicates expired or unsubscribed endpoint
            if ($statusCode === 404 || $statusCode === 410) {
                $subscription->delete();
                return false;
            }

            return $statusCode >= 200 && $statusCode < 300;
        } catch (Exception $e) {
            Log::warning('WebPush delivery failed: ' . $e->getMessage(), [
                'endpoint' => $subscription->endpoint,
            ]);
            return false;
        }
    }

    /**
     * Create VAPID JWT token signed with ES256 (RFC 8292).
     */
    protected function createVapidJwt(string $audience): string
    {
        $header = ['typ' => 'JWT', 'alg' => 'ES256'];
        $subject = config('app.url', 'https://panel.example.com');

        $claims = [
            'aud' => $audience,
            'exp' => time() + 43200, // 12 hours
            'sub' => $subject,
        ];

        $encodedHeader = self::base64UrlEncode(json_encode($header));
        $encodedClaims = self::base64UrlEncode(json_encode($claims));
        $dataToSign = "{$encodedHeader}.{$encodedClaims}";

        $privKeyPem = $this->getVapidPrivateKey();
        $key = EC::loadPrivateKey($privKeyPem);
        $derSignature = $key->sign($dataToSign);

        $rawSignature = self::derToRawSignature($derSignature);
        $encodedSignature = self::base64UrlEncode($rawSignature);

        return "{$dataToSign}.{$encodedSignature}";
    }

    /**
     * Encrypt message payload using RFC 8291 (AES-128-GCM + ECDH).
     */
    protected function encryptPayload(string $plaintext, string $clientPublicKey, string $clientAuth): string
    {
        // 1. Generate local ephemeral EC key
        $localKey = EC::createKey('secp256r1');
        $localPublicKey = $localKey->getPublicKey()->getEncodedCoordinates();

        // 2. Wrap client public key in X.509 SPKI ASN.1 header
        $spkiHeader = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200');
        $clientDer = $spkiHeader . $clientPublicKey;
        $clientPem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($clientDer), 64, "\n") . "-----END PUBLIC KEY-----\n";

        $clientKeyRes = openssl_pkey_get_public($clientPem);
        $localPrivPem = $localKey->toString('PKCS8');
        $localKeyRes = openssl_pkey_get_private($localPrivPem);

        if (!$clientKeyRes || !$localKeyRes) {
            throw new Exception('Failed to load EC keys for WebPush encryption.');
        }

        // 3. Compute ECDH shared secret
        $sharedSecret = openssl_pkey_derive($clientKeyRes, $localKeyRes);

        // 4. HKDF derivation
        $salt = random_bytes(16);
        $authInfo = "WebPush: info\x00" . $clientPublicKey . $localPublicKey;
        $prk = hash_hkdf('sha256', $sharedSecret, 32, $authInfo, $clientAuth);

        $cek = hash_hkdf('sha256', $prk, 16, "Content-Encoding: aes128gcm\x00", $salt);
        $nonce = hash_hkdf('sha256', $prk, 12, "Content-Encoding: nonce\x00", $salt);

        // 5. Encrypt with AES-128-GCM
        $paddedPlaintext = $plaintext . "\x02";
        $tag = '';
        $ciphertext = openssl_encrypt($paddedPlaintext, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);

        // 6. Build RFC 8291 binary body
        $recordSize = 4096;
        return $salt . pack('N', $recordSize) . chr(65) . $localPublicKey . $ciphertext . $tag;
    }

    /**
     * Convert ASN.1 DER signature to raw 64-byte R || S signature for ES256.
     */
    protected static function derToRawSignature(string $der): string
    {
        $pos = 3;
        $rLen = ord($der[$pos]);
        $pos++;
        $r = substr($der, $pos, $rLen);
        $pos += $rLen + 1;
        $sLen = ord($der[$pos]);
        $pos++;
        $s = substr($der, $pos, $sLen);

        $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
        $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);

        return $r . $s;
    }

    public static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public static function base64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
