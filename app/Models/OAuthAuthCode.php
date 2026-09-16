<?php

namespace Pterodactyl\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property int $user_id
 * @property string $client_id
 * @property string|null $scopes
 * @property bool $revoked
 * @property CarbonImmutable|null $expires_at
 * @property string|null $code_challenge
 * @property string|null $code_challenge_method
 * @property \Pterodactyl\Models\User $user
 * @property \Pterodactyl\Models\OAuthClient $client
 */
class OAuthAuthCode extends Model
{
    public const RESOURCE_NAME = 'oauth_auth_code';

    protected $table = 'oauth_auth_codes';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected bool $immutableDates = true;

    protected $casts = [
        'user_id' => 'int',
        'revoked' => 'bool',
        'expires_at' => 'datetime',
    ];

    protected $fillable = [
        'id',
        'user_id',
        'client_id',
        'scopes',
        'revoked',
        'expires_at',
        'code_challenge',
        'code_challenge_method',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(OAuthClient::class, 'client_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
