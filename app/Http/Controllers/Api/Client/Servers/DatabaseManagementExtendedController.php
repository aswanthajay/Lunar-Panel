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
     * Get an active PDO connection to the database.
     * Tries:
     * 1. Host admin credentials on host IP
     * 2. Host admin credentials on 127.0.0.1 / localhost
     * 3. Server Database user credentials on host IP
     * 4. Server Database user credentials on 127.0.0.1 / localhost
     */
    protected function getPdoForDatabase(Database $database): ?PDO
    {
        $database->loadMissing(['host']);
        $host = $database->host;
        if (!$host) {
            return null;
        }

        $port = (int) ($host->port ?: 3306);
        $candidates = [];

        // Candidate 1: Host Admin user
        try {
            $decryptedHostPass = $this->encrypter->decrypt($host->password);
            $candidates[] = ['host' => $host->host, 'user' => $host->username, 'pass' => $decryptedHostPass];
            if (!in_array($host->host, ['127.0.0.1', 'localhost'])) {
                $candidates[] = ['host' => '127.0.0.1', 'user' => $host->username, 'pass' => $decryptedHostPass];
            }
        } catch (\Exception $e) {
        }

        // Candidate 2: Server Database user
        try {
            $decryptedDbPass = $this->encrypter->decrypt($database->password);
            $candidates[] = ['host' => $host->host, 'user' => $database->username, 'pass' => $decryptedDbPass];
            if (!in_array($host->host, ['127.0.0.1', 'localhost'])) {
                $candidates[] = ['host' => '127.0.0.1', 'user' => $database->username, 'pass' => $decryptedDbPass];
            }
        } catch (\Exception $e) {
        }

        foreach ($candidates as $cand) {
            try {
                $dsn = "mysql:host={$cand['host']};port={$port};dbname={$database->database};charset=utf8mb4";
                return new PDO($dsn, $cand['user'], $cand['pass'], [
                    PDO::ATTR_TIMEOUT => 3,
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                ]);
            } catch (\Exception $e) {
                // Continue to next candidate
            }
        }

        return null;
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
        $host = $database->host;

        if (!$host) {
            return new JsonResponse([
                'online' => false,
                'error' => 'No database host configured.',
                'version' => 'Unknown',
                'table_count' => 0,
                'size_bytes' => 0,
                'size_human' => '0 B',
                'tables' => [],
            ]);
        }

        $hostIp = $host->host;
        $port = (int) ($host->port ?: 3306);
        $pingMs = 0;
        $detectedVersion = 'MySQL / MariaDB';
        $isTcpOnline = false;

        // 1. Fast TCP probe to verify port & extract server version from protocol banner
        $t1 = microtime(true);
        $fp = @fsockopen($hostIp, $port, $errno, $errstr, 2);
        if (!$fp && !in_array($hostIp, ['127.0.0.1', 'localhost'])) {
            // Try 127.0.0.1 fallback
            $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 2);
            if ($fp) {
                $hostIp = '127.0.0.1';
            }
        }

        if ($fp) {
            $isTcpOnline = true;
            $pingMs = round((microtime(true) - $t1) * 1000, 2);
            $banner = @fread($fp, 512);
            @fclose($fp);

            if ($banner && strlen($banner) > 5) {
                $rawVer = substr($banner, 5);
                $nullPos = strpos($rawVer, "\0");
                if ($nullPos !== false) {
                    $rawVer = substr($rawVer, 0, $nullPos);
                }
                $cleanVer = preg_replace('/[^\x20-\x7E]/', '', $rawVer);
                // Strip MariaDB 5.5.5- prefix if present
                $cleanVer = preg_replace('/^5\.5\.5-/', '', $cleanVer);
                if (!empty($cleanVer)) {
                    $detectedVersion = $cleanVer;
                }
            }
        }

        // 2. Try to connect via PDO to fetch tables and storage usage
        $pdo = $this->getPdoForDatabase($database);

        if ($pdo) {
            try {
                $versionStmt = $pdo->query('SELECT VERSION()');
                if ($versionStmt) {
                    $v = (string) $versionStmt->fetchColumn();
                    if (!empty($v)) {
                        $detectedVersion = preg_replace('/^5\.5\.5-/', '', $v);
                    }
                }

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
                    'version' => $detectedVersion,
                    'table_count' => count($tables),
                    'size_bytes' => $totalSize,
                    'size_human' => $this->formatBytes($totalSize),
                    'tables' => array_slice($tables, 0, 30),
                ]);
            } catch (\Exception $e) {
                // Table query failed, but TCP was online
            }
        }

        // If TCP succeeded, it IS online! Return online with detected version
        if ($isTcpOnline) {
            return new JsonResponse([
                'online' => true,
                'ping_ms' => $pingMs,
                'version' => $detectedVersion,
                'table_count' => 0,
                'size_bytes' => 0,
                'size_human' => '0 B',
                'tables' => [],
            ]);
        }

        // Only offline if TCP probe completely failed
        return new JsonResponse([
            'online' => false,
            'error' => "Could not connect to {$host->host}:{$port} ({$errstr})",
            'version' => 'Unknown',
            'table_count' => 0,
            'size_bytes' => 0,
            'size_human' => '0 B',
            'tables' => [],
        ]);
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

        try {
            $pdo = $this->getPdoForDatabase($database);
            if (!$pdo) {
                return new JsonResponse(['success' => false, 'message' => 'Unable to establish connection to database server.'], Response::HTTP_BAD_REQUEST);
            }

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
