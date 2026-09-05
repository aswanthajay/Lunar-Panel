<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Exception;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Database;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\Permission;
use Illuminate\Support\Facades\Cache;
use Illuminate\Contracts\Encryption\Encrypter;
use Symfony\Component\HttpFoundation\Response;
use Pterodactyl\Services\Databases\DatabaseDumpService;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class DatabaseManagementExtendedController extends ClientApiController
{
    public function __construct(
        protected DatabaseDumpService $dumpService,
        protected Encrypter $encrypter
    ) {
        parent::__construct();
    }

    /**
     * Export database as a .sql dump file download.
     */
    public function export(Request $request, Server $server, Database $database): StreamedResponse
    {
        if (!$request->user()->can(Permission::ACTION_DATABASE_READ, $server)) {
            throw new AccessDeniedHttpException('You do not have permission to export databases on this server.');
        }

        Activity::event('server:database.export')
            ->subject($database)
            ->property('name', $database->database)
            ->log();

        return $this->dumpService->export($database);
    }

    /**
     * Import a .sql or .sql.gz file into the database.
     */
    public function import(Request $request, Server $server, Database $database): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_DATABASE_CREATE, $server) && !$request->user()->can(Permission::ACTION_DATABASE_UPDATE, $server)) {
            throw new AccessDeniedHttpException('You do not have permission to import databases on this server.');
        }

        $request->validate([
            'file' => 'required|file|max:102400', // 100MB max
        ]);

        $uploadedFile = $request->file('file');
        $extension = strtolower($uploadedFile->getClientOriginalExtension());
        $validExtensions = ['sql', 'gz', 'txt'];

        if (!in_array($extension, $validExtensions)) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Invalid file format. Please upload a .sql or .sql.gz file.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        try {
            $result = $this->dumpService->import($database, $uploadedFile);

            Activity::event('server:database.import')
                ->subject($database)
                ->property('name', $database->database)
                ->property('filename', $uploadedFile->getClientOriginalName())
                ->property('queries', $result['queries_executed'] ?? 0)
                ->log();

            return new JsonResponse($result);
        } catch (Exception $e) {
            return new JsonResponse([
                'success' => false,
                'message' => $e->getMessage(),
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    /**
     * Generate single-sign-on (SSO) URL for phpMyAdmin.
     */
    public function pma(Request $request, Server $server, Database $database): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_DATABASE_READ, $server)) {
            throw new AccessDeniedHttpException('You do not have permission to access databases on this server.');
        }

        $pmaInstalled = file_exists(public_path('pma/index.php'));

        if (!$pmaInstalled) {
            return new JsonResponse([
                'installed' => false,
                'message' => 'Built-in phpMyAdmin is not yet installed. Please run "php artisan lunar:pma-setup" on the server terminal to install and configure it.',
            ]);
        }

        $database->loadMissing('host');

        try {
            $decryptedPassword = $this->encrypter->decrypt($database->password);
        } catch (Exception $e) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Failed to decrypt database credentials.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        // Generate one-time 60-second signon token
        $token = Str::random(64);
        Cache::put('pma_sso_' . $token, [
            'user' => $database->username,
            'password' => $decryptedPassword,
            'host' => $database->host->host,
            'port' => (int) $database->host->port,
            'db' => $database->database,
        ], now()->addSeconds(60));

        Activity::event('server:database.pma-login')
            ->subject($database)
            ->property('name', $database->database)
            ->log();

        return new JsonResponse([
            'installed' => true,
            'url' => '/pma/signon.php?token=' . $token,
        ]);
    }
}
