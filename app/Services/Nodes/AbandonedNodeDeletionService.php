<?php

namespace Pterodactyl\Services\Nodes;

use Exception;
use Carbon\Carbon;
use GuzzleHttp\Client;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Server;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;
use Pterodactyl\Facades\Activity;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\RequestException;

class AbandonedNodeDeletionService
{
    public const BACKUP_DIR = 'backups/node_deletions';

    /**
     * Check if a node's daemon (Wings/Agent) is confirmed OFFLINE.
     *
     * A node is considered SAFE to delete ONLY if the daemon is completely unreachable.
     * If the daemon responds with HTTP 200 or any live response, it is ONLINE and deletion must be blocked.
     */
    public function checkNodeOffline(Node $node): array
    {
        $client = new Client([
            'timeout' => 2.5,
            'connect_timeout' => 2.0,
            'verify' => false,
        ]);

        $url = rtrim($node->getConnectionAddress(), '/') . '/api/system';

        try {
            $startTime = microtime(true);
            $response = $client->get($url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $node->getDecryptedKey(),
                    'Accept' => 'application/json',
                ],
            ]);

            $latency = round((microtime(true) - $startTime) * 1000);
            $statusCode = $response->getStatusCode();

            // The daemon answered! It is ONLINE!
            return [
                'is_offline' => false,
                'status_code' => $statusCode,
                'latency_ms' => $latency,
                'message' => "Node daemon is ONLINE and responding (HTTP {$statusCode}, {$latency}ms). Destruction is blocked to protect active machines.",
            ];
        } catch (ConnectException $e) {
            // Connection timed out or refused -> The daemon is offline!
            return [
                'is_offline' => true,
                'status_code' => null,
                'latency_ms' => null,
                'message' => 'Connection timed out or refused. Daemon is confirmed OFFLINE.',
            ];
        } catch (RequestException $e) {
            if ($e->hasResponse()) {
                // Daemon returned an HTTP status (e.g. 401/403/500), meaning the host machine is ONLINE!
                $code = $e->getResponse()->getStatusCode();
                return [
                    'is_offline' => false,
                    'status_code' => $code,
                    'latency_ms' => null,
                    'message' => "Host server responded with HTTP {$code}. Machine is ONLINE, destruction blocked.",
                ];
            }

            return [
                'is_offline' => true,
                'status_code' => null,
                'latency_ms' => null,
                'message' => 'Network error: ' . $e->getMessage(),
            ];
        } catch (\Throwable $e) {
            return [
                'is_offline' => true,
                'status_code' => null,
                'latency_ms' => null,
                'message' => 'Unreachable: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Create an atomic, portable, revertible SQL backup of a node and all its dependent records.
     *
     * @throws Exception
     */
    public function createRevertibleSqlBackup(Node $node): array
    {
        $backupDir = storage_path(self::BACKUP_DIR);
        if (!File::isDirectory($backupDir)) {
            File::makeDirectory($backupDir, 0755, true, true);
        }

        $timestamp = Carbon::now()->format('Y_m_d_His');
        $slug = preg_replace('/[^a-zA-Z0-9_-]/', '_', strtolower($node->name));
        $filename = "node_{$node->id}_{$slug}_{$timestamp}.sql";
        $metaFilename = "node_{$node->id}_{$slug}_{$timestamp}.json";
        $filePath = $backupDir . DIRECTORY_SEPARATOR . $filename;
        $metaFilePath = $backupDir . DIRECTORY_SEPARATOR . $metaFilename;

        $pdo = DB::connection()->getPdo();

        $sql = "-- =========================================================================\n";
        $sql .= "-- Lunar Panel - Revertible Abandoned Node SQL Backup\n";
        $sql .= "-- Node ID:    {$node->id}\n";
        $sql .= "-- Node Name:  {$node->name}\n";
        $sql .= "-- Node FQDN:  {$node->fqdn}\n";
        $sql .= "-- Created at: " . Carbon::now()->toIso8601String() . "\n";
        $sql .= "-- =========================================================================\n\n";
        $sql .= "SET FOREIGN_KEY_CHECKS=0;\n";
        $sql .= "SET AUTOCOMMIT=0;\n";
        $sql .= "START TRANSACTION;\n\n";

        $summary = [
            'node_id' => $node->id,
            'node_name' => $node->name,
            'node_fqdn' => $node->fqdn,
            'created_at' => Carbon::now()->toIso8601String(),
            'filename' => $filename,
            'records' => [],
        ];

        // 1. Node Record
        $nodeRows = DB::table('nodes')->where('id', $node->id)->get();
        $sql .= $this->dumpTableRows('nodes', $nodeRows, $pdo);
        $summary['records']['nodes'] = count($nodeRows);

        // 2. Mount Node Pivot
        if ($this->tableExists('mount_node')) {
            $mountNodeRows = DB::table('mount_node')->where('node_id', $node->id)->get();
            $sql .= $this->dumpTableRows('mount_node', $mountNodeRows, $pdo);
            $summary['records']['mount_node'] = count($mountNodeRows);
        }

        // 3. Allocations
        $allocationRows = DB::table('allocations')->where('node_id', $node->id)->get();
        $sql .= $this->dumpTableRows('allocations', $allocationRows, $pdo);
        $summary['records']['allocations'] = count($allocationRows);

        // 4. Servers on this Node
        $serverRows = DB::table('servers')->where('node_id', $node->id)->get();
        $sql .= $this->dumpTableRows('servers', $serverRows, $pdo);
        $summary['records']['servers'] = count($serverRows);

        $serverIds = $serverRows->pluck('id')->toArray();

        if (!empty($serverIds)) {
            // 5. Server Variables
            if ($this->tableExists('server_variables')) {
                $svRows = DB::table('server_variables')->whereIn('server_id', $serverIds)->get();
                $sql .= $this->dumpTableRows('server_variables', $svRows, $pdo);
                $summary['records']['server_variables'] = count($svRows);
            }

            // 6. Subusers
            if ($this->tableExists('subusers')) {
                $subuserRows = DB::table('subusers')->whereIn('server_id', $serverIds)->get();
                $sql .= $this->dumpTableRows('subusers', $subuserRows, $pdo);
                $summary['records']['subusers'] = count($subuserRows);
            }

            // 7. Databases
            if ($this->tableExists('databases')) {
                $dbRows = DB::table('databases')->whereIn('server_id', $serverIds)->get();
                $sql .= $this->dumpTableRows('databases', $dbRows, $pdo);
                $summary['records']['databases'] = count($dbRows);
            }

            // 8. Schedules & Tasks
            if ($this->tableExists('schedules')) {
                $scheduleRows = DB::table('schedules')->whereIn('server_id', $serverIds)->get();
                $sql .= $this->dumpTableRows('schedules', $scheduleRows, $pdo);
                $summary['records']['schedules'] = count($scheduleRows);

                $scheduleIds = $scheduleRows->pluck('id')->toArray();
                if (!empty($scheduleIds) && $this->tableExists('tasks')) {
                    $taskRows = DB::table('tasks')->whereIn('schedule_id', $scheduleIds)->get();
                    $sql .= $this->dumpTableRows('tasks', $taskRows, $pdo);
                    $summary['records']['tasks'] = count($taskRows);
                }
            }

            // 9. Backups
            if ($this->tableExists('backups')) {
                $backupRows = DB::table('backups')->whereIn('server_id', $serverIds)->get();
                $sql .= $this->dumpTableRows('backups', $backupRows, $pdo);
                $summary['records']['backups'] = count($backupRows);
            }

            // 10. Mount Server
            if ($this->tableExists('mount_server')) {
                $mountServerRows = DB::table('mount_server')->whereIn('server_id', $serverIds)->get();
                $sql .= $this->dumpTableRows('mount_server', $mountServerRows, $pdo);
                $summary['records']['mount_server'] = count($mountServerRows);
            }

            // 11. Subdomain Allocations (if feature installed)
            if ($this->tableExists('subdomain_allocations')) {
                $subdomainRows = DB::table('subdomain_allocations')->whereIn('server_id', $serverIds)->get();
                $sql .= $this->dumpTableRows('subdomain_allocations', $subdomainRows, $pdo);
                $summary['records']['subdomain_allocations'] = count($subdomainRows);
            }

            // 12. Server Transfers
            if ($this->tableExists('server_transfers')) {
                $transferRows = DB::table('server_transfers')
                    ->whereIn('server_id', $serverIds)
                    ->orWhere('old_node', $node->id)
                    ->orWhere('new_node', $node->id)
                    ->get();
                $sql .= $this->dumpTableRows('server_transfers', $transferRows, $pdo);
                $summary['records']['server_transfers'] = count($transferRows);
            }
        }

        $sql .= "\nCOMMIT;\n";
        $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";

        // Save SQL and Metadata
        File::put($filePath, $sql);
        File::put($metaFilePath, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return [
            'filename' => $filename,
            'file_path' => $filePath,
            'meta_path' => $metaFilePath,
            'summary' => $summary,
            'size_bytes' => strlen($sql),
        ];
    }

    /**
     * Delete an abandoned node completely after safety checks and SQL backup.
     *
     * @throws Exception
     */
    public function deleteAbandonedNode(Node $node, string $confirmedName): array
    {
        // 1. Strict Name Confirmation Guard
        if (trim($confirmedName) !== trim($node->name)) {
            throw new Exception("Confirmation failed: entered name '{$confirmedName}' does not match target node name '{$node->name}'.");
        }

        // 2. Strict Daemon Connectivity Guard
        $offlineCheck = $this->checkNodeOffline($node);
        if (!$offlineCheck['is_offline']) {
            throw new Exception("Safety Violation: Cannot delete node '{$node->name}'. {$offlineCheck['message']}");
        }

        // 3. Create Atomic Revertible SQL Backup First
        $backupResult = $this->createRevertibleSqlBackup($node);

        $nodeId = $node->id;
        $nodeName = $node->name;

        // 4. Atomic Cascading Deletion
        $stats = DB::transaction(function () use ($nodeId) {
            $serverIds = DB::table('servers')->where('node_id', $nodeId)->pluck('id')->toArray();
            $serverCount = count($serverIds);

            if (!empty($serverIds)) {
                // Break circular allocation foreign keys
                DB::table('servers')->whereIn('id', $serverIds)->update(['allocation_id' => 0]);
                DB::table('allocations')->whereIn('server_id', $serverIds)->update(['server_id' => null]);

                // Delete server dependent records
                if ($this->tableExists('subdomain_allocations')) {
                    DB::table('subdomain_allocations')->whereIn('server_id', $serverIds)->delete();
                }
                if ($this->tableExists('mount_server')) {
                    DB::table('mount_server')->whereIn('server_id', $serverIds)->delete();
                }
                if ($this->tableExists('backups')) {
                    DB::table('backups')->whereIn('server_id', $serverIds)->delete();
                }
                if ($this->tableExists('tasks') && $this->tableExists('schedules')) {
                    $schedIds = DB::table('schedules')->whereIn('server_id', $serverIds)->pluck('id')->toArray();
                    if (!empty($schedIds)) {
                        DB::table('tasks')->whereIn('schedule_id', $schedIds)->delete();
                    }
                    DB::table('schedules')->whereIn('server_id', $serverIds)->delete();
                }
                if ($this->tableExists('databases')) {
                    DB::table('databases')->whereIn('server_id', $serverIds)->delete();
                }
                if ($this->tableExists('subusers')) {
                    DB::table('subusers')->whereIn('server_id', $serverIds)->delete();
                }
                if ($this->tableExists('server_variables')) {
                    DB::table('server_variables')->whereIn('server_id', $serverIds)->delete();
                }
                if ($this->tableExists('server_transfers')) {
                    DB::table('server_transfers')->whereIn('server_id', $serverIds)->delete();
                }

                // Delete Servers
                DB::table('servers')->whereIn('id', $serverIds)->delete();
            }

            // Delete Allocations
            $allocationsDeleted = DB::table('allocations')->where('node_id', $nodeId)->delete();

            // Delete Mount Node links
            if ($this->tableExists('mount_node')) {
                DB::table('mount_node')->where('node_id', $nodeId)->delete();
            }

            // Nullify database_hosts pointing to this node
            if ($this->tableExists('database_hosts')) {
                DB::table('database_hosts')->where('node_id', $nodeId)->update(['node_id' => null]);
            }

            // Delete Node
            DB::table('nodes')->where('id', $nodeId)->delete();

            return [
                'servers_deleted' => $serverCount,
                'allocations_deleted' => $allocationsDeleted,
            ];
        });

        // 5. Activity Log
        Activity::event('node:abandoned.purged')
            ->property('node_id', $nodeId)
            ->property('node_name', $nodeName)
            ->property('servers_deleted', $stats['servers_deleted'])
            ->property('allocations_deleted', $stats['allocations_deleted'])
            ->property('backup_file', $backupResult['filename'])
            ->log();

        return [
            'success' => true,
            'node_id' => $nodeId,
            'node_name' => $nodeName,
            'servers_deleted' => $stats['servers_deleted'],
            'allocations_deleted' => $stats['allocations_deleted'],
            'backup' => $backupResult,
        ];
    }

    /**
     * Restore a deleted node and its dependencies from a SQL backup file.
     *
     * @throws Exception
     */
    public function revertFromSqlBackup(string $backupFilename): array
    {
        $backupDir = storage_path(self::BACKUP_DIR);
        // Prevent path traversal
        $safeName = basename($backupFilename);
        $filePath = $backupDir . DIRECTORY_SEPARATOR . $safeName;

        if (!File::exists($filePath)) {
            throw new Exception("Backup file '{$safeName}' does not exist in storage.");
        }

        $sql = File::get($filePath);
        if (empty($sql)) {
            throw new Exception("Backup file '{$safeName}' is empty.");
        }

        // Execute SQL script
        DB::unprepared($sql);

        Activity::event('node:backup.reverted')
            ->property('backup_file', $safeName)
            ->log();

        return [
            'success' => true,
            'filename' => $safeName,
            'message' => "Successfully restored node data from backup '{$safeName}'.",
        ];
    }

    /**
     * List all available node deletion backups.
     */
    public function listBackups(): array
    {
        $backupDir = storage_path(self::BACKUP_DIR);
        if (!File::isDirectory($backupDir)) {
            return [];
        }

        $files = File::files($backupDir);
        $backups = [];

        foreach ($files as $file) {
            if ($file->getExtension() === 'json') {
                $metaContent = @json_decode(File::get($file->getRealPath()), true);
                if ($metaContent) {
                    $sqlFilename = str_replace('.json', '.sql', $file->getFilename());
                    $sqlPath = $backupDir . DIRECTORY_SEPARATOR . $sqlFilename;
                    $metaContent['sql_exists'] = File::exists($sqlPath);
                    $metaContent['sql_size_human'] = File::exists($sqlPath) ? round(File::size($sqlPath) / 1024, 1) . ' KB' : '0 KB';
                    $backups[] = $metaContent;
                }
            }
        }

        usort($backups, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));

        return $backups;
    }

    /**
     * Helper to serialize rows from a table into valid SQL INSERT statements.
     */
    private function dumpTableRows(string $table, iterable $rows, \PDO $pdo): string
    {
        if (count($rows) === 0) {
            return '';
        }

        $output = "-- Table: `{$table}`\n";

        foreach ($rows as $row) {
            $rowArr = (array) $row;
            $columns = array_keys($rowArr);
            $colsStr = implode('`, `', $columns);

            $values = [];
            foreach ($rowArr as $val) {
                if (is_null($val)) {
                    $values[] = 'NULL';
                } elseif (is_numeric($val) && !str_starts_with((string)$val, '0')) {
                    $values[] = $val;
                } else {
                    $values[] = $pdo->quote((string) $val);
                }
            }
            $valsStr = implode(', ', $values);

            $output .= "INSERT INTO `{$table}` (`{$colsStr}`) VALUES ({$valsStr});\n";
        }

        $output .= "\n";
        return $output;
    }

    /**
     * Check if a table exists in the current database.
     */
    private function tableExists(string $table): bool
    {
        static $tablesCache = null;
        if ($tablesCache === null) {
            $tablesCache = array_map('current', DB::select('SHOW TABLES'));
        }
        return in_array($table, $tablesCache, true);
    }
}
