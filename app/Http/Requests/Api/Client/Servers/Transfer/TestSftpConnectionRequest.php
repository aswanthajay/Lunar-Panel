<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Transfer;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class TestSftpConnectionRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_SFTP;
    }

    public function rules(): array
    {
        return [
            'host' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'username' => 'required|string|max:255',
            'password' => 'required|string',
            'remote_path' => 'nullable|string|max:1024',
        ];
    }
}
