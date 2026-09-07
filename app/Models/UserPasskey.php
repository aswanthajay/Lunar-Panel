<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * \Pterodactyl\Models\UserPasskey.
 *
 * @property int 
 * @property int 
 * @property string 
 * @property string 
 * @property string 
 * @property string 
 * @property array|null 
 * @property string|null 
 * @property int 
 * @property \Illuminate\Support\Carbon|null 
 * @property \Illuminate\Support\Carbon|null 
 * @property \Illuminate\Support\Carbon|null 
 * @property \Pterodactyl\Models\User 
 */
class UserPasskey extends Model
{
    public const RESOURCE_NAME = 'user_passkey';

    protected $table = 'user_passkeys';

    protected $fillable = [
        'user_id',
        'name',
        'credential_id',
        'public_key',
        'attestation_type',
        'transports',
        'aaguid',
        'counter',
        'last_used_at',
    ];

    protected $casts = [
        'transports' => 'array',
        'counter' => 'integer',
        'last_used_at' => 'datetime',
    ];

    public static array $validationRules = [
        'name' => ['required', 'string', 'max:191'],
        'credential_id' => ['required', 'string'],
        'public_key' => ['required', 'string'],
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}