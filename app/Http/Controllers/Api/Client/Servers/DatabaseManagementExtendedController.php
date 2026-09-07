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
use PDO;
use Illuminate\Support\Facades\DB;
use Pterodactyl\Extensions\DynamicDatabaseConnection;
use Symfony\Component\HttpFoundation\Response;
use Pterodactyl\Services\Databases\DatabaseDumpService;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class DatabaseManagementExtendedController extends ClientApiController
{
    public function __construct(
        protected DatabaseDumpService $dumpService,
        protected Encrypter $encrypter,
        protected DynamicDatabaseConnection $dynamic
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

    /**
     * Get database health, version, tables, and storage size.
     */
    public function stats(Request $request, Server $server, Database $database): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_DATABASE_READ, $server)) {
            throw new AccessDeniedHttpException('You do not have permission to access databases on this server.');
        }

        $database->loadMissing(['host']);

        $connectionName = 'dynamic_stats_' . $database->id;
        try {
            $startTime = microtime(true);
            $this->dynamic->set($connectionName, $database->database_host_id, $database->database);
            $pdo = DB::connection($connectionName)->getPdo();
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pingMs = round((microtime(true) - $startTime) * 1000, 2);

            // Fetch MySQL/MariaDB version
            $versionStmt = $pdo->query('SELECT VERSION()');
            $version = $versionStmt ? (string) $versionStmt->fetchColumn() : 'MySQL';

            // Tables & Sizes
            $sql = 'SELECT table_name AS `name`, 
                           table_rows AS `rows`, 
                           (data_length + index_length) AS `size`
                    FROM information_schema.tables 
                    WHERE table_schema = :db
                    ORDER BY (data_length + index_length) DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute(['db' => $database->database]);
            $rawTables = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $totalSize = 0;
            $tables = [];
            foreach ($rawTables as $t) {
                $sz = (int) ($t['size'] ?? 0);
                $totalSize += $sz;
                $tables[] = [
                    'name' => $t['name'],
                    'rows' => (int) ($t['rows'] ?? 0),
                    'size_bytes' => $sz,
                    'size_human' => $this->formatBytes($sz),
                ];
            }

            return new JsonResponse([
                'online' => true,
                'ping_ms' => $pingMs,
                'version' => $version,
                'table_count' => count($tables),
                'size_bytes' => $totalSize,
                'size_human' => $this->formatBytes($totalSize),
                'tables' => array_slice($tables, 0, 30),
            ]);
        } catch (Exception $e) {
            return new JsonResponse([
                'online' => false,
                'error' => $e->getMessage(),
                'version' => 'Unknown',
                'table_count' => 0,
                'size_bytes' => 0,
                'size_human' => '0 B',
                'tables' => [],
            ]);
        }
    }

    /**
     * Run a SQL query in the interactive console.
     */
    public function query(Request $request, Server $server, Database $database): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_DATABASE_UPDATE, $server)) {
            throw new AccessDeniedHttpException('You do not have permission to execute database queries on this server.');
        }

        $request->validate([
            'query' => 'required|string|max:10000',
        ]);

        $rawQuery = trim($request->input('query'));
        if (empty($rawQuery)) {
            return new JsonResponse(['success' => false, 'message' => 'Empty query provided.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $connectionName = 'dynamic_query_' . $database->id;
        try {
            $this->dynamic->set($connectionName, $database->database_host_id, $database->database);
            $pdo = DB::connection($connectionName)->getPdo();
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $startTime = microtime(true);
            $stmt = $pdo->prepare($rawQuery);
            $stmt->execute();
            $executionMs = round((microtime(true) - $startTime) * 1000, 2);

            $firstWord = strtoupper(explode(' ', ltrim($rawQuery))[0]);
            $isSelect = in_array($firstWord, ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'CHECK']);

            if ($isSelect) {
                $rows = [];
                $columns = [];
                $count = 0;
                while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) && $count < 100) {
                    if (empty($columns)) {
                        $columns = array_keys($row);
                    }
                    $rows[] = $row;
                    $count++;
                }

                return new JsonResponse([
                    'success' => true,
                    'type' => 'select',
                    'columns' => $columns,
                    'rows' => $rows,
                    'row_count' => count($rows),
                    'execution_ms' => $executionMs,
                ]);
            }

            return new JsonResponse([
                'success' => true,
                'type' => 'execute',
                'affected_rows' => $stmt->rowCount(),
                'execution_ms' => $executionMs,
            ]);
        } catch (Exception $e) {
            return new JsonResponse([
                'success' => false,
                'message' => $e->getMessage(),
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    /**
     * Format byte values into human readable representations.
     */
    protected function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min((int) $pow, count($units) - 1);
        $bytes /= pow(1024, $pow);

        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}
