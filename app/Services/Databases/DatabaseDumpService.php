<?php

namespace Pterodactyl\Services\Databases;

use PDO;
use Exception;
use PDOException;
use Pterodactyl\Models\Database;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Encryption\Encrypter;
use Pterodactyl\Extensions\DynamicDatabaseConnection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DatabaseDumpService
{
    public function __construct(
        protected DynamicDatabaseConnection $dynamic,
        protected Encrypter $encrypter
    ) {
    }

    /**
     * Export a database into a downloadable .sql stream.
     */
    public function export(Database $database): StreamedResponse
    {
        $database->loadMissing(['server', 'host']);

        $connectionName = 'dynamic_export_' . $database->id;
        $this->dynamic->set($connectionName, $database->database_host_id, $database->database);

        $filename = sprintf('%s_%s.sql', $database->database, date('Y-m-d_His'));

        return response()->stream(function () use ($connectionName, $database) {
            $pdo = DB::connection($connectionName)->getPdo();
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            if (ob_get_level()) {
                ob_end_clean();
            }

            echo "-- ========================================================\n";
            echo "-- Lunar / Stellar Panel SQL Dump\n";
            echo "-- Database: `" . addslashes($database->database) . "`\n";
            echo "-- Server: " . addslashes($database->server->name ?? 'Server') . " (" . ($database->server->uuid ?? '') . ")\n";
            echo "-- Date: " . gmdate('Y-m-d H:i:s') . " UTC\n";
            echo "-- ========================================================\n\n";

            echo "SET FOREIGN_KEY_CHECKS=0;\n";
            echo "SET SQL_MODE=\"NO_AUTO_VALUE_ON_ZERO\";\n";
            echo "SET time_zone = \"+00:00\";\n";
            echo "SET NAMES utf8mb4;\n\n";

            // 1. Fetch tables
            $tablesStmt = $pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
            $tables = [];
            while ($row = $tablesStmt->fetch(PDO::FETCH_NUM)) {
                $tables[] = $row[0];
            }

            foreach ($tables as $table) {
                $escapedTable = "`" . str_replace("`", "``", $table) . "`";

                echo "-- --------------------------------------------------------\n";
                echo "-- Table structure for table {$escapedTable}\n";
                echo "-- --------------------------------------------------------\n";
                echo "DROP TABLE IF EXISTS {$escapedTable};\n";

                $createStmt = $pdo->query("SHOW CREATE TABLE {$escapedTable}");
                $createRow = $createStmt->fetch(PDO::FETCH_NUM);
                if ($createRow && isset($createRow[1])) {
                    echo $createRow[1] . ";\n\n";
                }

                echo "-- Dumping data for table {$escapedTable}\n";

                $selectStmt = $pdo->query("SELECT * FROM {$escapedTable}");
                $batch = [];
                $columns = null;

                while ($row = $selectStmt->fetch(PDO::FETCH_ASSOC)) {
                    if ($columns === null) {
                        $columns = array_map(function ($col) {
                            return "`" . str_replace("`", "``", $col) . "`";
                        }, array_keys($row));
                    }

                    $values = [];
                    foreach ($row as $val) {
                        if (is_null($val)) {
                            $values[] = 'NULL';
                        } elseif (is_numeric($val) && !is_string($val)) {
                            $values[] = $val;
                        } else {
                            $values[] = $pdo->quote($val);
                        }
                    }
                    $batch[] = "(" . implode(", ", $values) . ")";

                    if (count($batch) >= 200) {
                        echo "INSERT INTO {$escapedTable} (" . implode(", ", $columns) . ") VALUES\n" . implode(",\n", $batch) . ";\n";
                        $batch = [];
                        flush();
                    }
                }

                if (!empty($batch) && $columns !== null) {
                    echo "INSERT INTO {$escapedTable} (" . implode(", ", $columns) . ") VALUES\n" . implode(",\n", $batch) . ";\n\n";
                    flush();
                } else {
                    echo "\n";
                }
            }

            // 2. Fetch views
            $viewsStmt = $pdo->query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
            while ($viewRow = $viewsStmt->fetch(PDO::FETCH_NUM)) {
                $view = $viewRow[0];
                $escapedView = "`" . str_replace("`", "``", $view) . "`";

                echo "-- --------------------------------------------------------\n";
                echo "-- View structure for view {$escapedView}\n";
                echo "-- --------------------------------------------------------\n";
                echo "DROP VIEW IF EXISTS {$escapedView};\n";

                $createViewStmt = $pdo->query("SHOW CREATE VIEW {$escapedView}");
                $createViewRow = $createViewStmt->fetch(PDO::FETCH_NUM);
                if ($createViewRow && isset($createViewRow[1])) {
                    echo $createViewRow[1] . ";\n\n";
                }
            }

            echo "SET FOREIGN_KEY_CHECKS=1;\n";
            echo "-- Dump completed on " . gmdate('Y-m-d H:i:s') . " UTC\n";
            flush();
        }, 200, [
            'Content-Type' => 'application/sql',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Import a .sql or .sql.gz file into the database.
     */
    public function import(Database $database, UploadedFile $file): array
    {
        $connectionName = 'dynamic_import_' . $database->id;
        $this->dynamic->set($connectionName, $database->database_host_id, $database->database);

        $pdo = DB::connection($connectionName)->getPdo();
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $isGzip = str_ends_with(strtolower($file->getClientOriginalName()), '.gz');
        $filePath = $file->getRealPath();

        $handle = $isGzip ? gzopen($filePath, 'r') : fopen($filePath, 'r');
        if (!$handle) {
            throw new Exception('Unable to open uploaded database file for reading.');
        }

        $executedQueries = 0;
        $currentQuery = '';
        $inDelimiter = ';';

        $pdo->exec('SET FOREIGN_KEY_CHECKS=0;');
        $pdo->exec('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');

        try {
            while (($line = $isGzip ? gzgets($handle, 1048576) : fgets($handle, 1048576)) !== false) {
                $trimmed = trim($line);

                // Skip comments and empty lines
                if (empty($trimmed) || str_starts_with($trimmed, '--') || str_starts_with($trimmed, '#') || str_starts_with($trimmed, '/*') && str_ends_with($trimmed, '*/')) {
                    continue;
                }

                // Check for DELIMITER changes (e.g. DELIMITER $$)
                if (preg_match('/^DELIMITER\s+(.+)$/i', $trimmed, $delimiterMatches)) {
                    $inDelimiter = trim($delimiterMatches[1]);
                    continue;
                }

                $currentQuery .= $line;

                // Check if the current query ends with the delimiter
                $checkTrimmed = rtrim($currentQuery);
                if (str_ends_with($checkTrimmed, $inDelimiter)) {
                    // Remove trailing delimiter
                    $queryToRun = substr($checkTrimmed, 0, -strlen($inDelimiter));
                    $queryToRun = trim($queryToRun);

                    if (!empty($queryToRun)) {
                        $pdo->exec($queryToRun);
                        $executedQueries++;
                    }

                    $currentQuery = '';
                }
            }

            // Run any remaining query if file didn't end with a delimiter
            $finalQuery = trim($currentQuery);
            if (!empty($finalQuery)) {
                $pdo->exec($finalQuery);
                $executedQueries++;
            }
        } catch (PDOException $e) {
            $pdo->exec('SET FOREIGN_KEY_CHECKS=1;');
            if ($isGzip) {
                gzclose($handle);
            } else {
                fclose($handle);
            }
            throw new Exception('SQL execution error during import: ' . $e->getMessage());
        } finally {
            $pdo->exec('SET FOREIGN_KEY_CHECKS=1;');
            if ($isGzip && is_resource($handle)) {
                gzclose($handle);
            } elseif (is_resource($handle)) {
                fclose($handle);
            }
        }

        return [
            'success' => true,
            'queries_executed' => $executedQueries,
            'message' => "Successfully imported {$executedQueries} SQL statement(s).",
        ];
    }
}
