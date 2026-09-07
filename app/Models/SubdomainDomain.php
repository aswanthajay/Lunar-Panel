<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

/**
 * Pterodactyl\Models\SubdomainDomain.
 *
 * @property int $id
 * @property string $domain
 * @property string $zone_id
 * @property int $cloudflare_account_id
 * @property bool $is_enabled
 * @property string $protocol
 * @property array|null $egg_ids
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 * @property \Pterodactyl\Models\SubdomainCloudflareAccount $account
 * @property \Illuminate\Database\Eloquent\Collection|\Pterodactyl\Models\ServerSubdomain[] $subdomains
 */
class SubdomainDomain extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'subdomain_domains';

    /**
     * Fields that are mass assignable.
     */
    protected $fillable = [
        'domain',
        'zone_id',
        'cloudflare_account_id',
        'is_enabled',
        'protocol',
        'egg_ids',
    ];

    /**
     * Cast values to correct type.
     */
    protected $casts = [
        'is_enabled' => 'boolean',
        'egg_ids' => 'array',
        'cloudflare_account_id' => 'integer',
    ];

    /**
     * Validation rules for model creation.
     */
    public static array $validationRules = [
        'domain' => 'required|string|max:191|unique:subdomain_domains,domain',
        'zone_id' => 'required|string|max:191',
        'cloudflare_account_id' => 'required|integer|exists:subdomain_cloudflare_accounts,id',
        'is_enabled' => 'boolean',
        'protocol' => 'required|string|in:both,srv_only,a_only',
        'egg_ids' => 'nullable|array',
        'egg_ids.*' => 'integer',
    ];

    /**
     * Scope for active/enabled domains.
     */
    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('is_enabled', true);
    }

    /**
     * Get the Cloudflare account associated with this domain.
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(SubdomainCloudflareAccount::class, 'cloudflare_account_id');
    }

    /**
     * Get all active server subdomains on this root domain.
     */
    public function subdomains(): HasMany
    {
        return $this->hasMany(ServerSubdomain::class, 'subdomain_domain_id');
    }
}
