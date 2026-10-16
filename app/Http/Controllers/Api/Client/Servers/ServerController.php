<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Pterodactyl\Models\Server;
use Illuminate\Support\Facades\Cache;
use Pterodactyl\Transformers\Api\Client\ServerTransformer;
use Pterodactyl\Services\Servers\GetUserPermissionsService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\GetServerRequest;

class ServerController extends ClientApiController
{
    /**
     * ServerController constructor.
     */
    public function __construct(private GetUserPermissionsService $permissionsService)
    {
        parent::__construct();
    }

    /**
     * Transform an individual server into a response that can be consumed by a
     * client using the API.
     */
    public function index(GetServerRequest $request, Server $server): array
    {
        $user = $request->user();
        $cacheKey = "server:client_view:{$server->uuid}:u:{$user->id}";

        return Cache::remember($cacheKey, 10, function () use ($request, $server, $user) {
            $server->loadMissing([
                'node',
                'egg',
                'nest',
                'allocation',
                'allocations',
                'variables',
                'subusers',
                'transfer',
            ]);

            return $this->fractal->item($server)
                ->transformWith($this->getTransformer(ServerTransformer::class))
                ->addMeta([
                    'is_server_owner' => $user->id === $server->owner_id,
                    'user_permissions' => $this->permissionsService->handle($server, $user),
                ])
                ->toArray();
        });
    }
}
