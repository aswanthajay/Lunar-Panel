<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Domains;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class StoreDomainRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_ALLOCATION_CREATE;
    }

    public function rules(): array
    {
        return [
            'allocation_id' => 'required|integer',
            'domain' => [
                'required',
                'string',
                'min:3',
                'max:191',
                'regex:/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/',
                'unique:server_custom_domains,domain',
            ],
            'protocol' => 'required|string|in:http,game_srv,tcp_stream',
            'target_type' => 'required|string|in:web,game',
            'ssl_enabled' => 'nullable|boolean',
            'notes' => 'nullable|string|max:500',
        ];
    }

    public function messages(): array
    {
        return [
            'domain.regex' => 'The domain format is invalid. Please enter a valid fully qualified domain name (e.g. mc.example.com).',
            'domain.unique' => 'This domain is already registered on the panel.',
        ];
    }
}