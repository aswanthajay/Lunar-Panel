<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Pterodactyl\Services\Nginx\NginxDomainService;
use Illuminate\Support\Facades\Log;

/**
 * Pterodactyl\Models\ServerCustomDomain.
 *
 * @property int $id
 * @property int $server_id
 * @property int $allocation_id
 * @property string $domain
 * @property string $protocol
 * @property string $target_type
 * @property bool $ssl_enabled
 * @property string $ssl_status
 * @property string|null $ssl_cert_path
 * @property string|null $ssl_key_path
 * @property string $nginx_status
 * @property string|null $nginx_config_path
 * @property string $dns_status
 * @property \Carbon\Carbon|null $dns_last_checked_at
 * @property string|null $notes
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 * @property \Pterodactyl\Models\Server $server
 * @property \Pterodactyl\Models\Allocation $allocation
 */
class ServerCustomDomain extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'server_custom_domains';

    /**
     * Fields that are not mass assignable.
     */
    protected $guarded = ['id', 'created_at', 'updated_at'];

    /**
     * Cast values to correct type.
     */
    protected $casts = [
        'server_id' => 'integer',
        'allocation_id' => 'integer',
        'ssl_enabled' => 'boolean',
        'dns_last_checked_at' => 'datetime',
    ];

    /**
     * Validation rules for model creation.
     */
    public static array $validationRules = [
        'server_id' => 'required|exists:servers,id',
        'allocation_id' => 'required|exists:allocations,id',
        'domain' => 'required|string|max:191|unique:server_custom_domains,domain',
        'protocol' => 'required|string|in:http,game_srv,tcp_stream',
        'target_type' => 'required|string|in:web,game',
        'ssl_enabled' => 'boolean',
        'notes' => 'nullable|string|max:500',
    ];

    /**
     * Model boot observer for automated cleanup.
     */
    protected static function booted(): void
    {
        static::deleting(function (ServerCustomDomain $domain) {
            try {
                if (class_exists(NginxDomainService::class)) {
                    app(NginxDomainService::class)->removeAndReload($domain);
                }
            } catch (\Throwable $e) {
                Log::warning("Automated Nginx cleanup error for domain [{$domain->domain}]: " . $e->getMessage());
            }
        });
    }

    /**
     * Get the server that owns this domain.
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    /**
     * Get the allocation linked to this domain.
     */
    public function allocation(): BelongsTo
    {
        return $this->belongsTo(Allocation::class);
    }
}
