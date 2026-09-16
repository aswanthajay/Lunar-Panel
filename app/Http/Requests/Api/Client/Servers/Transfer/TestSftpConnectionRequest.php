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

    protected function prepareForValidation(): void
    {
        $merge = [];

        if ($this->has('host')) {
            [$host, $port] = \Pterodactyl\Services\Sftp\SftpTransferService::parseHostAndPort(
                (string) $this->input('host'),
                $this->has('port') ? (int) $this->input('port') : null
            );

            $merge['host'] = $host;
            $merge['port'] = $port;
        }

        if ($this->has('username')) {
            $merge['username'] = trim((string) $this->input('username'));
        }

        if (!empty($merge)) {
            $this->merge($merge);
        }
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
