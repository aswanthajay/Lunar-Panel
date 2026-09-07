<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Services\Subdomains\CloudflareDnsService;

/**
 * Pterodactyl\Models\ServerSubdomain.
 *
 * @property int $id
 * @property int $server_id
 * @property int $subdomain_domain_id
 * @property string $subdomain
 * @property string $record_type
 * @property string $target_ip
 * @property int $target_port
 * @property string|null $cloudflare_dns_id
 * @property string|null $cloudflare_srv_id
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 * @property \Pterodactyl\Models\Server $server
 * @property \Pterodactyl\Models\SubdomainDomain $domain
 * @property-read string $full_subdomain
 */
class ServerSubdomain extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'server_subdomains';

    /**
     * Fields that are mass assignable.
     */
    protected $fillable = [
        'server_id',
        'subdomain_domain_id',
        'subdomain',
        'record_type',
        'target_ip',
        'target_port',
        'cloudflare_dns_id',
        'cloudflare_srv_id',
    ];

    /**
     * Cast values to correct type.
     */
    protected $casts = [
        'server_id' => 'integer',
        'subdomain_domain_id' => 'integer',
        'target_port' => 'integer',
    ];

    /**
     * Additional attributes to append to array/json representations.
     */
    protected $appends = ['full_subdomain'];

    /**
     * Validation rules for model creation.
     */
    public static array $validationRules = [
        'server_id' => 'required|exists:servers,id',
        'subdomain_domain_id' => 'required|exists:subdomain_domains,id',
        'subdomain' => 'required|string|alpha_dash|min:2|max:32',
        'record_type' => 'required|string|in:srv,a,both',
        'target_ip' => 'required|string',
        'target_port' => 'required|numeric|between:1,65535',
    ];

    /**
     * Model boot observer for automated Cloudflare DNS cleanup.
     */
    protected static function booted(): void
    {
        static::deleting(function (ServerSubdomain $subdomain) {
            try {
                if (class_exists(CloudflareDnsService::class)) {
                    app(CloudflareDnsService::class)->deleteSubdomain($subdomain);
                }
            } catch (\Throwable $e) {
                Log::warning("Automated Cloudflare DNS cleanup failed for subdomain [{$subdomain->subdomain}]: " . $e->getMessage());
            }
        });
    }

    /**
     * Returns the full FQDN subdomain string.
     */
    public function getFullSubdomainAttribute(): string
    {
        $rootDomain = $this->domain?->domain ?? '';
        return strtolower("{$this->subdomain}.{$rootDomain}");
    }

    /**
     * The server owning this subdomain.
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'server_id');
    }

    /**
     * The root domain config this subdomain is assigned to.
     */
    public function domain(): BelongsTo
    {
        return $this->belongsTo(SubdomainDomain::class, 'subdomain_domain_id');
    }
}
