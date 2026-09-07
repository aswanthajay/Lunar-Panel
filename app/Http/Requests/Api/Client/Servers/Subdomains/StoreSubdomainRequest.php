<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains;

use Illuminate\Validation\Rule;
use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class StoreSubdomainRequest extends ClientApiRequest
{
    public const RESERVED_SUBDOMAINS = [
        'www', 'api', 'admin', 'panel', 'cpanel', 'whm', 'mail', 'email',
        'smtp', 'pop', 'imap', 'ftp', 'ssh', 'ns1', 'ns2', 'ns3', 'ns4',
        'status', 'billing', 'support', 'node', 'wings', 'daemon', 'dns',
        'mx', 'router', 'gateway', 'staging', 'dev', 'test', 'local',
    ];

    public function permission(): string
    {
        return Permission::ACTION_ALLOCATION_CREATE;
    }

    public function rules(): array
    {
        return [
            'subdomain' => [
                'required',
                'string',
                'alpha_dash',
                'min:2',
                'max:32',
                Rule::notIn(self::RESERVED_SUBDOMAINS),
            ],
            'subdomain_domain_id' => [
                'required',
                'integer',
                'exists:subdomain_domains,id',
            ],
            'allocation_id' => [
                'required',
                'integer',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'subdomain.alpha_dash' => 'The subdomain may only contain letters, numbers, dashes, and underscores.',
            'subdomain.not_in' => 'This subdomain name is reserved by the system and cannot be used.',
            'subdomain.min' => 'The subdomain must be at least 2 characters long.',
            'subdomain.max' => 'The subdomain may not exceed 32 characters.',
            'subdomain_domain_id.exists' => 'The selected root domain is not recognized by the system.',
        ];
    }
}
