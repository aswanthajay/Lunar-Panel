<?php

namespace Pterodactyl\Models;

use Illuminate\Support\Facades\Hash;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property int|null $user_id
 * @property string $name
 * @property string|null $secret
 * @property string $redirect_uris
 * @property bool $personal_access_client
 * @property bool $password_client
 * @property bool $revoked
 * @property \Carbon\CarbonImmutable $created_at
 * @property \Carbon\CarbonImmutable $updated_at
 * @property \Pterodactyl\Models\User|null $user
 */
class OAuthClient extends Model
{
    public const RESOURCE_NAME = 'oauth_client';

    protected $table = 'oauth_clients';

    protected $keyType = 'string';

    protected bool $immutableDates = true;

    public $incrementing = false;

    protected bool $skipValidation = true;

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    protected $casts = [
        'user_id' => 'int',
        'personal_access_client' => 'bool',
        'password_client' => 'bool',
        'revoked' => 'bool',
    ];

    protected $fillable = [
        'id',
        'user_id',
        'name',
        'secret',
        'redirect_uris',
        'personal_access_client',
        'password_client',
        'revoked',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function accessTokens(): HasMany
    {
        return $this->hasMany(OAuthAccessToken::class, 'client_id');
    }

    public function authCodes(): HasMany
    {
        return $this->hasMany(OAuthAuthCode::class, 'client_id');
    }

    /**
     * Parse redirect URIs into an array of trimmed URIs.
     */
    public function getRedirectUrisArray(): array
    {
        $raw = trim((string) $this->redirect_uris);
        if ($raw === '') {
            return [];
        }

        // Support JSON array format if stored as JSON
        if (str_starts_with($raw, '[')) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return array_values(array_filter(array_map('trim', $decoded)));
            }
        }

        $uris = preg_split('/[\r\n,\s]+/', $raw);
        return array_values(array_filter(array_map('trim', $uris)));
    }

    /**
     * Normalize a URI string for comparison (ensuring scheme is present).
     */
    protected function normalizeUri(string $uri): ?array
    {
        $uri = trim($uri);
        if ($uri === '') {
            return null;
        }

        if (!preg_match('#^[a-zA-Z][a-zA-Z0-9+\-.]*://#', $uri)) {
            $uri = 'https://' . ltrim($uri, '/');
        }

        $parsed = parse_url($uri);
        if (!$parsed || empty($parsed['host'])) {
            return null;
        }

        return [
            'scheme' => strtolower($parsed['scheme'] ?? 'https'),
            'host' => strtolower($parsed['host']),
            'port' => $parsed['port'] ?? null,
            'path' => '/' . trim($parsed['path'] ?? '', '/'),
        ];
    }

    /**
     * Check if a redirect URI is registered and allowed for this client.
     */
    public function isRedirectUriAllowed(string $uri): bool
    {
        $target = $this->normalizeUri($uri);
        if (!$target) {
            return false;
        }

        $allowed = $this->getRedirectUrisArray();
        if (empty($allowed) || in_array('*', $allowed, true)) {
            return true;
        }

        foreach ($allowed as $allowedUri) {
            if (trim($allowedUri) === trim($uri)) {
                return true;
            }

            $normAllowed = $this->normalizeUri($allowedUri);
            if (!$normAllowed) {
                continue;
            }

            // Match same host (or subdomain of registered host)
            if ($normAllowed['host'] === $target['host']) {
                return true;
            }

            // Allow localhost / 127.0.0.1 interchangeability for local testing
            if (in_array($normAllowed['host'], ['localhost', '127.0.0.1'], true) &&
                in_array($target['host'], ['localhost', '127.0.0.1'], true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate client secret.
     */
    public function validateSecret(string $plainSecret): bool
    {
        if (empty($this->secret)) {
            return false;
        }

        $candidates = array_unique([
            $plainSecret,
            trim($plainSecret),
            urldecode($plainSecret),
            trim(urldecode($plainSecret)),
        ]);

        foreach ($candidates as $candidate) {
            if ($candidate === '') {
                continue;
            }
            if (Hash::check($candidate, $this->secret) || hash_equals($this->secret, $candidate)) {
                return true;
            }
        }

        return false;
    }
}
