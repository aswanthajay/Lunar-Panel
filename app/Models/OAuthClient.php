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
        $uris = preg_split('/[\r\n,]+/', (string) $this->redirect_uris);
        return array_values(array_filter(array_map('trim', $uris)));
    }

    /**
     * Check if a redirect URI is registered and allowed for this client.
     */
    public function isRedirectUriAllowed(string $uri): bool
    {
        $parsedTarget = parse_url($uri);
        if (!$parsedTarget || empty($parsedTarget['host'])) {
            return false;
        }

        $allowed = $this->getRedirectUrisArray();
        foreach ($allowed as $allowedUri) {
            if ($allowedUri === $uri) {
                return true;
            }

            // Allow matching scheme, host, and port for localhost/dev
            $parsedAllowed = parse_url($allowedUri);
            if ($parsedAllowed && ($parsedAllowed['host'] ?? '') === 'localhost') {
                if (($parsedAllowed['scheme'] ?? '') === ($parsedTarget['scheme'] ?? '') &&
                    ($parsedAllowed['host'] ?? '') === ($parsedTarget['host'] ?? '') &&
                    ($parsedAllowed['path'] ?? '/') === ($parsedTarget['path'] ?? '/')) {
                    return true;
                }
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

        if (Hash::check($plainSecret, $this->secret)) {
            return true;
        }

        return hash_equals($this->secret, $plainSecret);
    }
}
