<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\SftpTransfer;
use Pterodactyl\Jobs\ProcessSftpTransferJob;
use Pterodactyl\Services\Sftp\SftpTransferService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Transfer\TestSftpConnectionRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Transfer\StartSftpTransferRequest;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SftpTransferController extends ClientApiController
{
    public function __construct(
        private SftpTransferService $transferService
    ) {
        parent::__construct();
    }

    /**
     * List active transfer and recent transfer history for this server.
     */
    public function index(ClientApiRequest $request, Server $server): JsonResponse
    {
        $active = SftpTransfer::where('server_id', $server->id)
            ->whereNotIn('status', [
                SftpTransfer::STATUS_COMPLETED,
                SftpTransfer::STATUS_FAILED,
                SftpTransfer::STATUS_CANCELLED,
            ])
            ->latest('id')
            ->first();

        $history = SftpTransfer::where('server_id', $server->id)
            ->latest('id')
            ->take(10)
            ->get();

        return new JsonResponse([
            'active' => $active ? $active->makeHidden(['password']) : null,
            'history' => $history->makeHidden(['password']),
        ]);
    }

    /**
     * Test connection to a remote SFTP server before initiating migration.
     */
    public function test(TestSftpConnectionRequest $request, Server $server): JsonResponse
    {
        $result = $this->transferService->testConnection(
            $request->input('host'),
            (int) $request->input('port', 2022),
            $request->input('username'),
            $request->input('password'),
            $request->input('remote_path', '/')
        );

        return new JsonResponse($result);
    }

    /**
     * Start an SFTP transfer job (import or export).
     */
    public function start(StartSftpTransferRequest $request, Server $server): JsonResponse
    {
        $existing = SftpTransfer::where('server_id', $server->id)
            ->whereNotIn('status', [
                SftpTransfer::STATUS_COMPLETED,
                SftpTransfer::STATUS_FAILED,
                SftpTransfer::STATUS_CANCELLED,
            ])
            ->first();

        if ($existing) {
            throw new ConflictHttpException('An SFTP transfer is already running for this server.');
        }

        $transfer = SftpTransfer::create([
            'server_id' => $server->id,
            'user_id' => $request->user()->id,
            'direction' => $request->input('direction'),
            'status' => SftpTransfer::STATUS_PENDING,
            'host' => $request->input('host'),
            'port' => (int) $request->input('port', 2022),
            'username' => $request->input('username'),
            'password' => $request->input('password'),
            'remote_path' => $request->input('remote_path', '/'),
            'wipe_existing' => (bool) $request->input('wipe_existing', false),
        ]);

        $transfer->appendLog("Transfer registered and queued by {$request->user()->username}.");

        dispatch(new ProcessSftpTransferJob($transfer));

        return new JsonResponse([
            'transfer' => $transfer->makeHidden(['password']),
        ], 201);
    }

    /**
     * Get real-time status and logs for a specific transfer.
     */
    public function status(ClientApiRequest $request, Server $server, SftpTransfer $transfer): JsonResponse
    {
        if ($transfer->server_id !== $server->id) {
            throw new NotFoundHttpException();
        }

        return new JsonResponse([
            'transfer' => $transfer->makeHidden(['password']),
        ]);
    }

    /**
     * Cancel an active transfer.
     */
    public function cancel(ClientApiRequest $request, Server $server, SftpTransfer $transfer): JsonResponse
    {
        if ($transfer->server_id !== $server->id) {
            throw new NotFoundHttpException();
        }

        if ($transfer->canBeCancelled()) {
            $transfer->status = SftpTransfer::STATUS_CANCELLED;
            $transfer->appendLog("Transfer cancelled by {$request->user()->username}.");
            $transfer->saveQuietly();
        }

        return new JsonResponse([
            'transfer' => $transfer->makeHidden(['password']),
        ]);
    }

    /**
     * Delete a transfer history record.
     */
    public function delete(ClientApiRequest $request, Server $server, SftpTransfer $transfer): JsonResponse
    {
        if ($transfer->server_id !== $server->id) {
            throw new NotFoundHttpException();
        }

        if ($transfer->canBeCancelled()) {
            throw new ConflictHttpException('Cannot delete an active transfer. Please cancel it first.');
        }

        $transfer->delete();

        return new JsonResponse([], 204);
    }
}
