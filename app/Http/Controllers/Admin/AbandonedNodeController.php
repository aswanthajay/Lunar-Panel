<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Exception;
use Illuminate\Http\Request;
use Pterodactyl\Models\Node;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Pterodactyl\Services\Nodes\AbandonedNodeDeletionService;

class AbandonedNodeController extends Controller
{
    public function __construct(
        private AbandonedNodeDeletionService $deletionService,
        private AlertsMessageBag $alert
    ) {
    }

    /**
     * Test if a node daemon is live or confirmed offline.
     */
    public function checkStatus(Node $node): JsonResponse
    {
        $res = $this->deletionService->checkNodeOffline($node);
        return response()->json([
            'node_id' => $node->id,
            'node_name' => $node->name,
            'node_fqdn' => $node->fqdn,
            'is_offline' => $res['is_offline'],
            'status_code' => $res['status_code'],
            'latency_ms' => $res['latency_ms'] ?? null,
            'message' => $res['message'],
        ]);
    }

    /**
     * Permanently destroy an abandoned offline node, after safety checks and SQL backup.
     */
    public function destroy(Request $request, Node $node): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'confirm_node_name' => 'required|string',
        ]);

        try {
            $result = $this->deletionService->deleteAbandonedNode($node, $validated['confirm_node_name']);

            $msg = "Successfully purged abandoned node '{$result['node_name']}' ({$result['servers_deleted']} servers, {$result['allocations_deleted']} allocations). Revertible SQL backup created: {$result['backup']['filename']}";

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
     * Restore a purged node and its data from an existing SQL backup file.
     */
    public function revert(Request $request): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'backup_file' => 'required|string',
        ]);

        try {
            $result = $this->deletionService->revertFromSqlBackup($validated['backup_file']);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => $result['message'],
                ]);
            }

            $this->alert->success($result['message'])->flash();
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
     * Download a specific SQL backup file.
     */
    public function downloadBackup(string $filename): BinaryFileResponse|RedirectResponse
    {
        $safeName = basename($filename);
        $path = storage_path(AbandonedNodeDeletionService::BACKUP_DIR . DIRECTORY_SEPARATOR . $safeName);

        if (!file_exists($path)) {
            $this->alert->danger("Backup file '{$safeName}' does not exist.")->flash();
            return redirect()->route('admin.ip-manager');
        }

        return response()->download($path, $safeName, [
            'Content-Type' => 'application/sql',
        ]);
    }
}
