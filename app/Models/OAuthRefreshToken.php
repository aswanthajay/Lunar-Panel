<?php

namespace Pterodactyl\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $access_token_id
 * @property bool $revoked
 * @property CarbonImmutable|null $expires_at
 * @property \Pterodactyl\Models\OAuthAccessToken $accessToken
 */
class OAuthRefreshToken extends Model
{
    public const RESOURCE_NAME = 'oauth_refresh_token';

    protected $table = 'oauth_refresh_tokens';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected bool $immutableDates = true;

    protected bool $skipValidation = true;

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    protected $casts = [
        'revoked' => 'bool',
        'expires_at' => 'datetime',
    ];

    protected $fillable = [
        'id',
        'access_token_id',
        'revoked',
        'expires_at',
    ];

    public function accessToken(): BelongsTo
    {
        return $this->belongsTo(OAuthAccessToken::class, 'access_token_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
