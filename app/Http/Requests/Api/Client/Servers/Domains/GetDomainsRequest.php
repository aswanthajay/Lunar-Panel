<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Domains;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class GetDomainsRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_ALLOCATION_READ;
    }
}