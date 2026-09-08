<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Carbon\Carbon;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
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
        $type = $request->input('type');

        // Short-lived cache (10s) per user & filter type so repeated telemetry polls return instantaneously
        $cacheKey = "fleet:stats:u:{$user->id}:" . md5((string) $type);

        return Cache::remember($cacheKey, Carbon::now()->addSeconds(10), function () use ($user, $type) {
            $query = Server::query();

            if (in_array($type, ['admin', 'admin-all'])) {
                if (!$user->root_admin) {
                    $query->whereRaw('1 = 2');
                }
            } elseif ($type === 'owner') {
                $query->where('servers.owner_id', $user->id);
            } else {
                $query->whereIn('servers.id', $user->accessibleServers()->pluck('id')->all());
            }

            // Load all accessible servers with their node relationships
            $servers = (clone $query)->with(['node'])->get(['id', 'uuid', 'status', 'node_id', 'cpu', 'memory', 'disk']);

            $total = $servers->count();
            $cpu = (int) $servers->sum('cpu');
            $memory = (int) $servers->sum('memory');
            $disk = (int) $servers->sum('disk');
            $suspended = (int) $servers->where('status', 'suspended')->count();
            $installing = (int) $servers->whereIn('status', ['installing', 'restoring_backup'])->count();

            $statuses = [];
            $runningCount = 0;
            $unresolvedServers = [];

            // 1. First pass: Handle database states & check existing resource cache
            foreach ($servers as $server) {
                if ($server->status === 'suspended' || ($server->node && $server->node->isUnderMaintenance())) {
                    $statuses[$server->uuid] = 'suspended';
                    continue;
                }
                if (in_array($server->status, ['installing', 'restoring_backup'])) {
                    $statuses[$server->uuid] = 'installing';
                    continue;
                }

                // Check cache populated by ResourceUtilizationController ("resources:{$uuid}")
                $cached = Cache::get("resources:{$server->uuid}");
                if (is_array($cached) && (isset($cached['state']) || isset($cached['status']))) {
                    $st = $cached['state'] ?? $cached['status'];
                    $statuses[$server->uuid] = $st;
                    if ($st === 'running') {
                        $runningCount++;
                    }
                    continue;
                }

                $unresolvedServers[] = $server;
            }

            $nodeOnlineMap = [];

            // 2. Second pass: Query Wings daemons by node concurrently
            if (!empty($unresolvedServers)) {
                $byNode = collect($unresolvedServers)->groupBy('node_id');

                foreach ($byNode as $nodeId => $nodeServers) {
                    $node = $nodeServers->first()->node;
                    if (!$node) {
                        foreach ($nodeServers as $s) {
                            $statuses[$s->uuid] = 'offline';
                        }
                        continue;
                    }

                    try {
                        $responses = Http::pool(function (Pool $pool) use ($nodeServers, $node) {
                            foreach ($nodeServers as $s) {
                                $token = '';
                                try {
                                    $token = $node->getDecryptedKey();
                                } catch (\Throwable) {}

                                $pool->as($s->uuid)
                                    ->withToken($token)
                                    ->timeout(4.5)
                                    ->connectTimeout(3.0)
                                    ->withoutVerifying()
                                    ->acceptJson()
                                    ->get($node->getConnectionAddress() . '/api/servers/' . $s->uuid);
                            }
                        });

                        foreach ($nodeServers as $s) {
                            $res = $responses[$s->uuid] ?? null;
                            if ($res instanceof Response) {
                                // If Wings responded for any server on this node, we know the node is alive!
                                if ($res->status() >= 100 && $res->status() < 600) {
                                    $nodeOnlineMap[$nodeId] = 'online';
                                }
                                if ($res->successful()) {
                                    $data = $res->json();
                                    $state = $data['state'] ?? $data['status'] ?? 'offline';
                                    $statuses[$s->uuid] = $state;
                                    if ($state === 'running') {
                                        $runningCount++;
                                    }
                                    Cache::put("resources:{$s->uuid}", ['state' => $state], Carbon::now()->addSeconds(30));
                                } else {
                                    $statuses[$s->uuid] = 'offline';
                                }
                            } else {
                                $statuses[$s->uuid] = 'offline';
                            }
                        }
                    } catch (\Throwable) {
                        foreach ($nodeServers as $s) {
                            if (!isset($statuses[$s->uuid])) {
                                $statuses[$s->uuid] = 'offline';
                            }
                        }
                    }
                }
            }

            $adminData = [];
            if ($user->root_admin) {
                $nodes = Node::query()->with('location')->withCount('servers')->get();
                $nodesList = [];
                $nodesOnlineCount = 0;

                foreach ($nodes as $n) {
                    if ($n->maintenance_mode) {
                        $nodeOnlineMap[$n->id] = 'maintenance';
                        continue;
                    }
                    $cachedStatus = Cache::get("node:status:{$n->id}");
                    if ($cachedStatus !== null) {
                        $nodeOnlineMap[$n->id] = $cachedStatus;
                    }
                }

                $unresolvedNodes = $nodes->filter(function ($n) use ($nodeOnlineMap) {
                    return !isset($nodeOnlineMap[$n->id]);
                });

                if ($unresolvedNodes->isNotEmpty()) {
                    try {
                        $nodeResponses = Http::pool(function (Pool $pool) use ($unresolvedNodes) {
                            foreach ($unresolvedNodes as $n) {
                                $token = '';
                                try {
                                    $token = $n->getDecryptedKey();
                                } catch (\Throwable) {}

                                $pool->as((string) $n->id)
                                    ->withToken($token)
                                    ->timeout(4.5)
                                    ->connectTimeout(3.0)
                                    ->withoutVerifying()
                                    ->acceptJson()
                                    ->get($n->getConnectionAddress() . '/api/system');
                            }
                        });

                        foreach ($unresolvedNodes as $n) {
                            $res = $nodeResponses[(string) $n->id] ?? null;
                            // A node daemon is confirmed online if it responds with any HTTP status code (200, 204, 401, 403, 404, 500)
                            // Completely offline / unreachable nodes fail at socket level (connection refused / timeout)
                            $isOnline = false;
                            if ($res instanceof Response) {
                                $code = $res->status();
                                if ($code >= 100 && $code < 600) {
                                    $isOnline = true;
                                }
                            }

                            $status = $isOnline ? 'online' : 'offline';
                            $nodeOnlineMap[$n->id] = $status;
                            Cache::put("node:status:{$n->id}", $status, Carbon::now()->addSeconds(30));
                        }
                    } catch (\Throwable) {
                        foreach ($unresolvedNodes as $n) {
                            if (!isset($nodeOnlineMap[$n->id])) {
                                $nodeOnlineMap[$n->id] = 'offline';
                            }
                        }
                    }
                }

                foreach ($nodes as $n) {
                    $st = $nodeOnlineMap[$n->id] ?? ($n->maintenance_mode ? 'maintenance' : 'offline');
                    if ($st === 'online') {
                        $nodesOnlineCount++;
                    }
                    $nodesList[] = [
                        'id' => (int) $n->id,
                        'name' => $n->name,
                        'fqdn' => $n->fqdn,
                        'scheme' => $n->scheme,
                        'location' => $n->location?->short ?? $n->location?->long ?? 'Default',
                        'status' => $st,
                        'maintenance_mode' => (bool) $n->maintenance_mode,
                        'servers_count' => (int) $n->servers_count,
                        'memory' => (int) $n->memory,
                        'disk' => (int) $n->disk,
                    ];
                }

                $ticketsOpenCount = class_exists('\Pterodactyl\Models\Ticket')
                    ? (int) \Pterodactyl\Models\Ticket::where('status', '!=', 'closed')->count()
                    : 0;

                $adminData = [
                    'nodes' => $nodesList,
                    'nodes_online' => (int) $nodesOnlineCount,
                    'nodes_total' => (int) $nodes->count(),
                    'tickets_open' => (int) $ticketsOpenCount,
                ];
            }

            return array_merge([
                'total' => (int) $total,
                'running' => (int) $runningCount,
                'cpu' => (int) $cpu,
                'memory' => (int) $memory,
                'disk' => (int) $disk,
                'suspended' => (int) $suspended,
                'installing' => (int) $installing,
                'statuses' => $statuses,
            ], $adminData);
        });
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
