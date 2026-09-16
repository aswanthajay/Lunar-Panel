<?php

namespace Pterodactyl\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property int|null $user_id
 * @property string $client_id
 * @property string|null $name
 * @property string|null $scopes
 * @property bool $revoked
 * @property CarbonImmutable|null $expires_at
 * @property CarbonImmutable|null $last_used_at
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 * @property \Pterodactyl\Models\User|null $user
 * @property \Pterodactyl\Models\OAuthClient $client
 */
class OAuthAccessToken extends Model
{
    public const RESOURCE_NAME = 'oauth_access_token';

    protected $table = 'oauth_access_tokens';

    protected $keyType = 'string';

    public $incrementing = false;

    protected bool $immutableDates = true;

    protected $casts = [
        'user_id' => 'int',
        'revoked' => 'bool',
        'expires_at' => 'datetime',
        'last_used_at' => 'datetime',
    ];

    protected $fillable = [
        'id',
        'user_id',
        'client_id',
        'name',
        'scopes',
        'revoked',
        'expires_at',
        'last_used_at',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(OAuthClient::class, 'client_id');
    }

    public function refreshTokens(): HasMany
    {
        return $this->hasMany(OAuthRefreshToken::class, 'access_token_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function hasScope(string $scope): bool
    {
        $scopes = array_filter(array_map('trim', explode(' ', (string) $this->scopes)));
        return in_array('*', $scopes, true) || in_array($scope, $scopes, true);
    }
}
