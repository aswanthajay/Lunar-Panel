<?php

namespace Pterodactyl\Services\Allocations;

use Exception;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Allocation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Repositories\Wings\DaemonServerRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;

class IpMigrationService
{
    public function __construct(
        private DaemonServerRepository $daemonServerRepository
    ) {
    }

    /**
     * Retrieve complete fleet inventory of nodes and their IP allocations.
     */
    public function getFleetInventory(): array
    {
        $nodes = Node::query()
            ->withCount('servers')
            ->orderBy('name', 'asc')
            ->get();

        $totalIps = 0;
        $totalAllocations = 0;
        $totalAssigned = 0;
        $totalUnassigned = 0;

        $nodeData = [];

        foreach ($nodes as $node) {
            $allocations = Allocation::query()
                ->where('node_id', $node->id)
                ->with(['server:id,name,uuid,uuidShort'])
                ->orderBy('ip', 'asc')
                ->orderBy('port', 'asc')
                ->get();

            $grouped = $allocations->groupBy('ip');
            $ipsData = [];

            foreach ($grouped as $ip => $items) {
                $total = $items->count();
                $assigned = $items->whereNotNull('server_id')->count();
                $unassigned = $total - $assigned;

                $servers = [];
                foreach ($items->whereNotNull('server_id') as $item) {
                    if ($item->server && !isset($servers[$item->server->id])) {
                        $servers[$item->server->id] = [
                            'id' => $item->server->id,
                            'name' => $item->server->name,
                            'uuid' => $item->server->uuid,
                            'uuidShort' => $item->server->uuidShort,
                            'ports' => [],
                        ];
                    }
                    if ($item->server) {
                        $servers[$item->server->id]['ports'][] = $item->port;
                    }
                }

                $firstWithAlias = $items->first(fn ($a) => !empty($a->ip_alias));
                $alias = $firstWithAlias ? $firstWithAlias->ip_alias : null;

                $ipsData[] = [
                    'ip' => $ip,
                    'alias' => $alias,
                    'total' => $total,
                    'assigned' => $assigned,
                    'unassigned' => $unassigned,
                    'servers' => array_values($servers),
                    'is_abandoned' => ($assigned === 0 && $total > 0),
                ];

                $totalIps++;
                $totalAllocations += $total;
                $totalAssigned += $assigned;
                $totalUnassigned += $unassigned;
            }

            $nodeData[] = [
                'node' => $node,
                'ips' => $ipsData,
                'total_ips' => count($ipsData),
                'total_allocations' => $allocations->count(),
                'assigned_allocations' => $allocations->whereNotNull('server_id')->count(),
                'unassigned_allocations' => $allocations->whereNull('server_id')->count(),
            ];
        }

        return [
            'summary' => [
                'total_nodes' => $nodes->count(),
                'total_ips' => $totalIps,
                'total_allocations' => $totalAllocations,
                'total_assigned' => $totalAssigned,
                'total_unassigned' => $totalUnassigned,
            ],
            'nodes' => $nodeData,
        ];
    }

    /**
     * Migrate all allocations on a node from an old IP to a new IP in one atomic operation.
     *
     * @throws Exception
     */
    public function migrateNodeIp(
        Node $node,
        string $oldIp,
        string $newIp,
        ?string $newAlias = null,
        bool $syncDaemon = true,
        ?string $newNodeFqdn = null
    ): array {
        $oldIp = trim($oldIp);
        $newIp = trim($newIp);

        if (!filter_var($oldIp, FILTER_VALIDATE_IP)) {
            throw new Exception("Source IP '{$oldIp}' is not a valid IP address.");
        }

        if (!filter_var($newIp, FILTER_VALIDATE_IP)) {
            throw new Exception("Destination IP '{$newIp}' is not a valid IP address.");
        }

        if ($oldIp === $newIp) {
            throw new Exception('Source IP and Destination IP cannot be the same.');
        }

        $sourceAllocations = Allocation::query()
            ->where('node_id', $node->id)
            ->where('ip', $oldIp)
            ->get();

        if ($sourceAllocations->isEmpty()) {
            throw new Exception("No allocations found on node '{$node->name}' for IP '{$oldIp}'.");
        }

        // Check for conflicts on destination IP
        $targetAllocations = Allocation::query()
            ->where('node_id', $node->id)
            ->where('ip', $newIp)
            ->get();

        $targetAllocationsByPort = $targetAllocations->keyBy('port');
        $unassignedCollisionsToDelete = [];
        $activeCollisions = [];

        foreach ($sourceAllocations as $srcAlloc) {
            if ($targetAllocationsByPort->has($srcAlloc->port)) {
                $target = $targetAllocationsByPort->get($srcAlloc->port);
                if (is_null($target->server_id)) {
                    // Target has this port, but it is unassigned - we can safely clean it up
                    $unassignedCollisionsToDelete[] = $target->id;
                } else {
                    // Both old and new IP have this port assigned to a server!
                    $activeCollisions[] = $srcAlloc->port;
                }
            }
        }

        if (!empty($activeCollisions)) {
            $portsStr = implode(', ', array_slice($activeCollisions, 0, 5));
            if (count($activeCollisions) > 5) {
                $portsStr .= ' and ' . (count($activeCollisions) - 5) . ' more';
            }
            throw new Exception("Cannot migrate IP: Port collision detected on destination IP '{$newIp}' for ports: {$portsStr}. These ports are already assigned to active servers on the target IP.");
        }

        // Collect affected servers before updating
        $affectedServerIds = $sourceAllocations->whereNotNull('server_id')->pluck('server_id')->unique()->toArray();
        $affectedServers = Server::query()->whereIn('id', $affectedServerIds)->get();

        // Perform the migration atomically
        DB::transaction(function () use (
            $node,
            $oldIp,
            $newIp,
            $newAlias,
            $unassignedCollisionsToDelete,
            $newNodeFqdn
        ) {
            // 1. Clean up unassigned colliding ports on target IP
            if (!empty($unassignedCollisionsToDelete)) {
                Allocation::query()->whereIn('id', $unassignedCollisionsToDelete)->delete();
            }

            // 2. Update all matching allocations on this node
            $updateData = ['ip' => $newIp];
            if (!is_null($newAlias)) {
                $updateData['ip_alias'] = empty($newAlias) ? null : $newAlias;
            }

            Allocation::query()
                ->where('node_id', $node->id)
                ->where('ip', $oldIp)
                ->update($updateData);

            // 3. Optionally update node FQDN if provided and changed
            if (!empty($newNodeFqdn) && $newNodeFqdn !== $node->fqdn) {
                $node->update(['fqdn' => $newNodeFqdn]);
            }
        });

        // Sync affected servers with daemon
        $syncedCount = 0;
        $failedSyncCount = 0;
        $syncErrors = [];

        if ($syncDaemon) {
            foreach ($affectedServers as $server) {
                try {
                    $this->daemonServerRepository->setServer($server)->sync();
                    $syncedCount++;
                } catch (DaemonConnectionException $e) {
                    $failedSyncCount++;
                    $syncErrors[] = "Server '{$server->name}': " . $e->getMessage();
                    Log::warning("KSM/IP Migration: Failed daemon sync for server {$server->uuid}: " . $e->getMessage());
                } catch (\Throwable $e) {
                    $failedSyncCount++;
                    $syncErrors[] = "Server '{$server->name}': " . $e->getMessage();
                    Log::warning("KSM/IP Migration: General error during daemon sync for server {$server->uuid}: " . $e->getMessage());
                }
            }
        }

        Activity::event('node:ip.migrated')
            ->property('node_id', $node->id)
            ->property('node_name', $node->name)
            ->property('old_ip', $oldIp)
            ->property('new_ip', $newIp)
            ->property('affected_servers', count($affectedServers))
            ->property('allocations_migrated', $sourceAllocations->count())
            ->log();

        return [
            'success' => true,
            'node_id' => $node->id,
            'node_name' => $node->name,
            'old_ip' => $oldIp,
            'new_ip' => $newIp,
            'new_alias' => $newAlias,
            'allocations_migrated' => $sourceAllocations->count(),
            'servers_affected' => count($affectedServers),
            'synced_servers' => $syncedCount,
            'failed_syncs' => $failedSyncCount,
            'sync_errors' => $syncErrors,
        ];
    }

    /**
     * Delete unassigned/abandoned ports for a specific IP on a node.
     */
    public function deleteAbandonedPorts(Node $node, string $ip): int
    {
        $deleted = Allocation::query()
            ->where('node_id', $node->id)
            ->where('ip', $ip)
            ->whereNull('server_id')
            ->delete();

        Activity::event('node:ip.abandoned-cleaned')
            ->property('node_id', $node->id)
            ->property('ip', $ip)
            ->property('deleted_count', $deleted)
            ->log();

        return $deleted;
    }

    /**
     * Completely purge an entire IP from a node (only if no active servers are using it).
     *
     * @throws Exception
     */
    public function purgeEntireIp(Node $node, string $ip): int
    {
        $assignedCount = Allocation::query()
            ->where('node_id', $node->id)
            ->where('ip', $ip)
            ->whereNotNull('server_id')
            ->count();

        if ($assignedCount > 0) {
            throw new Exception("Cannot purge IP '{$ip}': {$assignedCount} active server(s) are still bound to it. Please migrate those servers to a new IP first.");
        }

        $deleted = Allocation::query()
            ->where('node_id', $node->id)
            ->where('ip', $ip)
            ->delete();

        Activity::event('node:ip.purged')
            ->property('node_id', $node->id)
            ->property('ip', $ip)
            ->property('deleted_count', $deleted)
            ->log();

        return $deleted;
    }

    /**
     * Sync all servers on a given IP with Wings daemon.
     */
    public function syncServersOnIp(Node $node, string $ip): array
    {
        $serverIds = Allocation::query()
            ->where('node_id', $node->id)
            ->where('ip', $ip)
            ->whereNotNull('server_id')
            ->pluck('server_id')
            ->unique()
            ->toArray();

        $servers = Server::query()->whereIn('id', $serverIds)->get();

        $synced = 0;
        $failed = 0;
        $errors = [];

        foreach ($servers as $server) {
            try {
                $this->daemonServerRepository->setServer($server)->sync();
                $synced++;
            } catch (\Throwable $e) {
                $failed++;
                $errors[] = "Server '{$server->name}': " . $e->getMessage();
            }
        }

        return [
            'total' => count($servers),
            'synced' => $synced,
            'failed' => $failed,
            'errors' => $errors,
        ];
    }

    /**
     * Clean global orphan allocations where server or node no longer exists.
     */
    public function cleanOrphans(): int
    {
        $cleaned = 0;

        // 1. Allocations referencing non-existent servers
        $orphanedServerAllocations = Allocation::query()
            ->whereNotNull('server_id')
            ->whereNotIn('server_id', Server::query()->select('id'))
            ->update(['server_id' => null]);

        $cleaned += $orphanedServerAllocations;

        // 2. Allocations referencing non-existent nodes
        $orphanedNodeAllocations = Allocation::query()
            ->whereNotIn('node_id', Node::query()->select('id'))
            ->delete();

        $cleaned += $orphanedNodeAllocations;

        return $cleaned;
    }
}
