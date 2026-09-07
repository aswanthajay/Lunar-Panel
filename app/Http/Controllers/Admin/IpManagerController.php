<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Exception;
use Illuminate\View\View;
use Illuminate\Http\Request;
use Pterodactyl\Models\Node;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\Allocations\IpMigrationService;
use Pterodactyl\Services\Nodes\AbandonedNodeDeletionService;

class IpManagerController extends Controller
{
    public function __construct(
        private ViewFactory $view,
        private IpMigrationService $migrationService,
        private AbandonedNodeDeletionService $nodeDeletionService,
        private AlertsMessageBag $alert
    ) {
    }

    /**
     * Render the Node IP Migration & Allocation Management Dashboard.
     */
    public function index(): View
    {
        $inventory = $this->migrationService->getFleetInventory();
        $nodes = Node::query()->orderBy('name', 'asc')->get();
        $backups = $this->nodeDeletionService->listBackups();

        return $this->view->make('admin.ip-manager.index', [
            'inventory' => $inventory,
            'nodes' => $nodes,
            'backups' => $backups,
        ]);
    }

    /**
     * Execute 1-click IP migration across all allocations on a node.
     */
    public function migrate(Request $request): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'node_id' => 'required|integer|exists:nodes,id',
            'old_ip' => 'required|ip',
            'new_ip' => 'required|ip',
            'new_alias' => 'nullable|string|max:191',
            'new_fqdn' => 'nullable|string|max:191',
            'sync_daemon' => 'nullable|boolean',
        ]);

        /** @var Node $node */
        $node = Node::query()->findOrFail($validated['node_id']);
        $syncDaemon = $request->boolean('sync_daemon', true);

        try {
            $result = $this->migrationService->migrateNodeIp(
                node: $node,
                oldIp: $validated['old_ip'],
                newIp: $validated['new_ip'],
                newAlias: $validated['new_alias'] ?? null,
                syncDaemon: $syncDaemon,
                newNodeFqdn: $validated['new_fqdn'] ?? null
            );

            $msg = "Successfully migrated {$result['allocations_migrated']} allocations ({$result['servers_affected']} servers) on '{$node->name}' from {$result['old_ip']} to {$result['new_ip']}.";
            if ($result['synced_servers'] > 0) {
                $msg .= " Synced with node daemon for {$result['synced_servers']} servers.";
            }
            if ($result['failed_syncs'] > 0) {
                $msg .= " Note: {$result['failed_syncs']} servers could not be synced immediately (node may be temporarily unreachable).";
            }

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => $msg,
                    'result' => $result,
                ]);
            }

            $this->alert->success($msg)->flash();
        } catch (Exception $e) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                ], 400);
            }

            $this->alert->danger($e->getMessage())->flash();
        }

        return redirect()->route('admin.ip-manager');
    }

    /**
     * Delete all unassigned/abandoned allocations for a specific IP.
     */
    public function deleteAbandoned(Request $request): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'node_id' => 'required|integer|exists:nodes,id',
            'ip' => 'required|ip',
        ]);

        /** @var Node $node */
        $node = Node::query()->findOrFail($validated['node_id']);

        try {
            $count = $this->migrationService->deleteAbandonedPorts($node, $validated['ip']);
            $msg = "Successfully removed {$count} unassigned allocation(s) for IP {$validated['ip']} on node '{$node->name}'.";

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => $msg,
                    'count' => $count,
                ]);
            }

            $this->alert->success($msg)->flash();
        } catch (Exception $e) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                ], 400);
            }

            $this->alert->danger($e->getMessage())->flash();
        }

        return redirect()->route('admin.ip-manager');
    }

    /**
     * Completely purge an entire IP from a node (if 0 active servers remain).
     */
    public function purgeIp(Request $request): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'node_id' => 'required|integer|exists:nodes,id',
            'ip' => 'required|ip',
        ]);

        /** @var Node $node */
        $node = Node::query()->findOrFail($validated['node_id']);

        try {
            $count = $this->migrationService->purgeEntireIp($node, $validated['ip']);
            $msg = "Successfully purged IP {$validated['ip']} from node '{$node->name}' ({$count} allocations deleted).";

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => $msg,
                    'count' => $count,
                ]);
            }

            $this->alert->success($msg)->flash();
        } catch (Exception $e) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                ], 400);
            }

            $this->alert->danger($e->getMessage())->flash();
        }

        return redirect()->route('admin.ip-manager');
    }

    /**
     * Sync all servers assigned to an IP with the Wings daemon.
     */
    public function sync(Request $request): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'node_id' => 'required|integer|exists:nodes,id',
            'ip' => 'required|ip',
        ]);

        /** @var Node $node */
        $node = Node::query()->findOrFail($validated['node_id']);

        $res = $this->migrationService->syncServersOnIp($node, $validated['ip']);
        $msg = "Synced {$res['synced']} of {$res['total']} server(s) on IP {$validated['ip']}.";
        if ($res['failed'] > 0) {
            $msg .= " ({$res['failed']} failed - daemon may be offline).";
        }

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $msg,
                'result' => $res,
            ]);
        }

        $this->alert->info($msg)->flash();
        return redirect()->route('admin.ip-manager');
    }

    /**
     * Run global orphan allocation cleanup.
     */
    public function cleanOrphans(Request $request): RedirectResponse|JsonResponse
    {
        $count = $this->migrationService->cleanOrphans();
        $msg = "Global allocation cleanup complete. Cleaned {$count} orphan allocation record(s).";

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $msg,
                'count' => $count,
            ]);
        }

        $this->alert->success($msg)->flash();
        return redirect()->route('admin.ip-manager');
    }
}
