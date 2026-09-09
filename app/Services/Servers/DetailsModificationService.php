<?php

namespace Pterodactyl\Services\Servers;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Schema;
use Pterodactyl\Models\Server;
use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Traits\Services\ReturnsUpdatedModels;
use Pterodactyl\Repositories\Wings\DaemonServerRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;

class DetailsModificationService
{
    use ReturnsUpdatedModels;

    /**
     * DetailsModificationService constructor.
     */
    public function __construct(private ConnectionInterface $connection, private DaemonServerRepository $serverRepository)
    {
    }

    /**
     * Update the details for a single server instance.
     *
     * @throws \Throwable
     */
    public function handle(Server $server, array $data): Server
    {
        return $this->connection->transaction(function () use ($data, $server) {
            $owner = (int) $server->owner_id;

            $fillData = [
                'external_id' => Arr::get($data, 'external_id'),
                'owner_id' => (int) Arr::get($data, 'owner_id', $server->owner_id),
                'name' => Arr::get($data, 'name'),
                'description' => Arr::get($data, 'description') ?? '',
            ];

            if (Arr::has($data, 'expires_at') && Schema::hasColumn('servers', 'expires_at')) {
                $fillData['expires_at'] = Arr::get($data, 'expires_at') ? \Carbon\Carbon::parse(Arr::get($data, 'expires_at')) : null;
            }

            if (Arr::has($data, 'billing_amount') && Schema::hasColumn('servers', 'billing_amount')) {
                $fillData['billing_amount'] = Arr::get($data, 'billing_amount') !== null && Arr::get($data, 'billing_amount') !== '' ? (int) Arr::get($data, 'billing_amount') : null;
            }

            if (Arr::has($data, 'game_type') && Schema::hasColumn('servers', 'game_type')) {
                $fillData['game_type'] = Arr::get($data, 'game_type') ?: 'auto';
            }

            if (Arr::has($data, 'votion_code_mode') && Schema::hasColumn('servers', 'votion_code_mode')) {
                $fillData['votion_code_mode'] = Arr::get($data, 'votion_code_mode') ?: 'both';
            }

            $server->forceFill($fillData)->saveOrFail();

            // If the owner_id value is changed we need to revoke any tokens that exist for the server
            // on the Wings instance so that the old owner no longer has any permission to access the
            // websockets.
            if ((int) $server->owner_id !== $owner) {
                try {
                    $this->serverRepository->setServer($server)->revokeUserJTI($owner);
                } catch (\Throwable $exception) {
                    // Do nothing. A failure here is not ideal, but it is likely to be caused by Wings
                    // being offline, or in an entirely broken state. Remember, these tokens reset every
                    // few minutes by default, we're just trying to help it along a little quicker.
                }
            }

            return $server;
        });
    }
}
