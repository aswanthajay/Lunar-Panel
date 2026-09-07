<?php

namespace Pterodactyl\Models;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Pterodactyl\Models\SubdomainCloudflareAccount.
 *
 * @property int $id
 * @property string $name
 * @property string $auth_type
 * @property string|null $api_token
 * @property string|null $api_key
 * @property string|null $api_email
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 * @property \Illuminate\Database\Eloquent\Collection|\Pterodactyl\Models\SubdomainDomain[] $domains
 */
class SubdomainCloudflareAccount extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'subdomain_cloudflare_accounts';

    /**
     * The attributes excluded from the model's JSON form.
     */
    protected $hidden = [
        'api_token',
        'api_key',
    ];

    /**
     * Fields that are mass assignable.
     */
    protected $fillable = [
        'name',
        'auth_type',
        'api_token',
        'api_key',
        'api_email',
    ];

    /**
     * Validation rules for model creation.
     */
    public static array $validationRules = [
        'name' => 'required|string|max:191',
        'auth_type' => 'required|string|in:token,key',
        'api_token' => 'nullable|string',
        'api_key' => 'nullable|string',
        'api_email' => 'nullable|email',
    ];

    /**
     * Encrypt API token on set.
     */
    public function setApiTokenAttribute(?string $value): void
    {
        $this->attributes['api_token'] = !empty($value) ? Crypt::encryptString($value) : null;
    }

    /**
     * Decrypt API token on get.
     */
    public function getApiTokenAttribute(?string $value): ?string
    {
        if (empty($value)) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Throwable $e) {
            return $value;
        }
    }

    /**
     * Encrypt API key on set.
     */
    public function setApiKeyAttribute(?string $value): void
    {
        $this->attributes['api_key'] = !empty($value) ? Crypt::encryptString($value) : null;
    }

    /**
     * Decrypt API key on get.
     */
    public function getApiKeyAttribute(?string $value): ?string
    {
        if (empty($value)) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Throwable $e) {
            return $value;
        }
    }

    /**
     * Get headers required for Cloudflare API HTTP requests.
     */
    public function getAuthHeaders(): array
    {
        if ($this->auth_type === 'key') {
            return [
                'X-Auth-Email' => (string) $this->api_email,
                'X-Auth-Key' => (string) $this->api_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ];
        }

        return [
            'Authorization' => 'Bearer ' . $this->api_token,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }

    /**
     * Domains registered under this Cloudflare account.
     */
    public function domains(): HasMany
    {
        return $this->hasMany(SubdomainDomain::class, 'cloudflare_account_id');
    }
}
