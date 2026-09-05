<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PushSubscription extends Model
{
    /**
     * The resource name for this model.
     */
    public const RESOURCE_NAME = 'push_subscription';

    protected $table = 'push_subscriptions';

    protected $fillable = [
        'user_id',
        'endpoint',
        'public_key',
        'auth_token',
        'content_encoding',
        'device_name',
    ];

    public static array $validationRules = [
        'endpoint' => 'required|string',
        'public_key' => 'nullable|string',
        'auth_token' => 'nullable|string',
        'content_encoding' => 'sometimes|string',
        'device_name' => 'sometimes|nullable|string',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
