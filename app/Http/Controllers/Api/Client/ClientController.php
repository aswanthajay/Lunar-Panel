<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedFilter;
use Pterodactyl\Models\Filters\MultiFieldServerFilter;
use Pterodactyl\Transformers\Api\Client\ServerTransformer;
use Pterodactyl\Http\Requests\Api\Client\GetServersRequest;

class ClientController extends ClientApiController
{
    /**
     * ClientController constructor.
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Return all the servers available to the client making the API
     * request, including servers the user has access to as a subuser.
     */
    public function index(GetServersRequest $request): array
    {
        $user = $request->user();
        $transformer = $this->getTransformer(ServerTransformer::class);

        // Start the query builder and ensure we eager load any requested relationships from the request.
        $builder = QueryBuilder::for(
            Server::query()->with($this->getIncludesForTransformer($transformer, ['node']))
        )->allowedFilters([
            'uuid',
            'name',
            'description',
            'external_id',
            AllowedFilter::custom('*', new MultiFieldServerFilter()),
        ]);

        $type = $request->input('type');
        // Either return all the servers the user has access to because they are an admin `?type=admin` or
        // just return all the servers the user has access to because they are the owner or a subuser of the
        // server. If ?type=admin-all is passed all servers on the system will be returned to the user, rather
        // than only servers they can see because they are an admin.
        if (in_array($type, ['admin', 'admin-all'])) {
            // If they aren't an admin but want all the admin servers don't fail the request, just
            // make it a query that will never return any results back.
            if (!$user->root_admin) {
                $builder->whereRaw('1 = 2');
            } else {
                // In admin view, all servers on the system are returned
                $builder = $builder;
            }
        } elseif ($type === 'owner') {
            $builder = $builder->where('servers.owner_id', $user->id);
        } else {
            $builder = $builder->whereIn('servers.id', $user->accessibleServers()->pluck('id')->all());
        }

        $perPage = (int) $request->query('per_page', config('pterodactyl.paginate.admin.servers', 25));
        $isAll = $request->boolean('all') || $perPage <= 0 || $perPage > 100;
        $maxLimit = $isAll ? 1000 : 100;
        $limit = $perPage > 0 ? min($perPage, $maxLimit) : ($isAll ? 1000 : 25);
        $servers = $builder->paginate($limit)->appends($request->query());

        return $this->fractal->transformWith($transformer)->collection($servers)->toArray();
    }

    /**
     * Return fleet telemetry & resource statistics across all accessible servers.
     */
    public function stats(GetServersRequest $request): array
    {
        $user = $request->user();
        $query = Server::query();
        $type = $request->input('type');

        if (in_array($type, ['admin', 'admin-all'])) {
            if (!$user->root_admin) {
                $query->whereRaw('1 = 2');
            }
        } elseif ($type === 'owner') {
            $query->where('servers.owner_id', $user->id);
        } else {
            $query->whereIn('servers.id', $user->accessibleServers()->pluck('id')->all());
        }

        $total = (clone $query)->count();
        $cpu = (clone $query)->sum('cpu');
        $memory = (clone $query)->sum('memory');
        $disk = (clone $query)->sum('disk');
        $suspended = (clone $query)->where('status', 'suspended')->count();
        $installing = (clone $query)->whereIn('status', ['installing', 'restoring_backup'])->count();

        return [
            'total' => (int) $total,
            'cpu' => (int) $cpu,
            'memory' => (int) $memory,
            'disk' => (int) $disk,
            'suspended' => (int) $suspended,
            'installing' => (int) $installing,
        ];
    }

    /**
     * Returns all the subuser permissions available on the system.
     */
    public function permissions(): array
    {
        return [
            'object' => 'system_permissions',
            'attributes' => [
                'permissions' => Permission::permissions(),
            ],
        ];
    }
}
