<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * \Pterodactyl\Models\ServerRenewalPayment
 *
 * @property int $id
 * @property int $server_id
 * @property int $user_id
 * @property int $amount
 * @property string $upi_id
 * @property string|null $payer_name
 * @property string|null $payment_note
 * @property string $utr_number
 * @property string $screenshot_path
 * @property string $status
 * @property bool $grace_period_granted
 * @property \Illuminate\Support\Carbon|null $grace_period_expires_at
 * @property bool $is_suspicious
 * @property string|null $suspicious_reason
 * @property string|null $admin_notes
 * @property string|null $rejection_reason
 * @property int|null $reviewed_by
 * @property \Illuminate\Support\Carbon|null $reviewed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Pterodactyl\Models\Server $server
 * @property \Pterodactyl\Models\User $user
 * @property \Pterodactyl\Models\User|null $reviewer
 */
class ServerRenewalPayment extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $table = 'server_renewal_payments';

    protected bool $skipValidation = true;

    protected $guarded = ['id', self::CREATED_AT, self::UPDATED_AT];

    protected $casts = [
        'server_id' => 'integer',
        'user_id' => 'integer',
        'amount' => 'integer',
        'grace_period_granted' => 'boolean',
        'grace_period_expires_at' => 'datetime',
        'is_suspicious' => 'boolean',
        'reviewed_by' => 'integer',
        'reviewed_at' => 'datetime',
        self::CREATED_AT => 'datetime',
        self::UPDATED_AT => 'datetime',
    ];

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
