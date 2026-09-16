<?php

namespace Pterodactyl\Services\Sftp;

use Throwable;
use ZipArchive;
use phpseclib3\Net\SFTP;
use GuzzleHttp\Client;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\SftpTransfer;
use Pterodactyl\Services\Nodes\NodeJWTService;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;

class SftpTransferService
{
    public function __construct(
        private DaemonFileRepository $fileRepository,
        private NodeJWTService $jwtService
    ) {
    }

    /**
     * Clean and parse host and port from user inputs (e.g. sftp://host:port, ssh://host, host:port).
     *
     * @return array{0: string, 1: int}
     */
    public static function parseHostAndPort(string $host, ?int $port = null): array
    {
        $host = trim($host);

        // Strip any URI scheme (sftp://, ssh://, ftp://, etc.)
        if (preg_match('#^[a-zA-Z0-9\+\.\-]+://#', $host)) {
            $parts = parse_url($host);
            $extractedHost = $parts['host'] ?? null;
            $extractedPort = $parts['port'] ?? null;
            if ($extractedHost) {
                $host = $extractedHost;
            } else {
                $host = preg_replace('#^[a-zA-Z0-9\+\.\-]+://#', '', $host);
            }
            if (!empty($extractedPort)) {
                $port = (int) $extractedPort;
            }
        }

        // Strip any trailing path or slashes (e.g. example.com/ or example.com:2022/)
        $host = explode('/', $host)[0];

        // Parse host:port or [ipv6]:port format
        if (preg_match('/^\[([a-fA-F0-9:]+)\]:(\d+)$/', $host, $matches)) {
            $host = $matches[1];
            $port = (int) $matches[2];
        } elseif (preg_match('/^([^:]+):(\d+)$/', $host, $matches)) {
            $host = $matches[1];
            $port = (int) $matches[2];
        }

        $port = ($port && $port > 0 && $port <= 65535) ? (int) $port : 2022;

        return [trim($host), $port];
    }

    /**
     * Build an informative authentication failure message.
     */
    public static function buildAuthErrorMessage(string $username): string
    {
        $username = trim($username);
        if (!str_contains($username, '.')) {
            return "Failed to authenticate with remote SFTP server as user '{$username}'. Hint: Pterodactyl / Wings SFTP servers require the username format '<username>.<server_identifier>' (e.g. '{$username}.abc1234'). Please copy your full SFTP username from the remote server's Settings -> SFTP Details page.";
        }

        return "Failed to authenticate with remote SFTP server as user '{$username}'. Please double check your SFTP username and password. For Pterodactyl, your SFTP password is the account password you use to log into that panel.";
    }

    /**
     * Test connection to a remote SFTP server and return directory preview.
     */
    public function testConnection(string $host, int $port, string $username, string $password, string $remotePath = '/'): array
    {
        [$host, $port] = self::parseHostAndPort($host, $port);
        $username = trim($username);

        try {
            $sftp = new SFTP($host, $port, 15);

            if (!$sftp->login($username, $password)) {
                return [
                    'success' => false,
                    'message' => self::buildAuthErrorMessage($username),
                ];
            }

            $path = empty(trim($remotePath)) ? '/' : trim($remotePath);
            $rawList = $sftp->rawlist($path);

            if ($rawList === false) {
                return [
                    'success' => false,
                    'message' => "Connected successfully, but remote path '{$path}' could not be accessed.",
                ];
            }

            $items = [];
            foreach ($rawList as $name => $stat) {
                if ($name === '.' || $name === '..') {
                    continue;
                }

                $isDir = isset($stat['type']) && $stat['type'] === 2;
                $items[] = [
                    'name' => $name,
                    'type' => $isDir ? 'dir' : 'file',
                    'size' => $stat['size'] ?? 0,
                    'size_formatted' => $this->formatBytes($stat['size'] ?? 0),
                    'mtime' => isset($stat['mtime']) ? date('Y-m-d H:i:s', $stat['mtime']) : null,
                ];
            }

            $sftp->disconnect();

            return [
                'success' => true,
                'message' => 'Successfully connected to remote SFTP server.',
                'file_count' => count($items),
                'preview' => array_slice($items, 0, 20),
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'SFTP Connection error: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Entry point for executing an SFTP transfer job.
     */
    public function processTransfer(SftpTransfer $transfer): void
    {
        try {
            [$host, $port] = self::parseHostAndPort($transfer->host, $transfer->port);
            if ($transfer->host !== $host || $transfer->port !== $port) {
                $transfer->host = $host;
                $transfer->port = $port;
            }

            $transfer->status = SftpTransfer::STATUS_CONNECTING;
            $transfer->started_at = CarbonImmutable::now();
            $transfer->saveQuietly();
            $transfer->appendLog("Connecting to {$host}:{$port} via SFTP...");

            if ($transfer->direction === SftpTransfer::DIRECTION_IMPORT) {
                $this->executeImport($transfer);
            } else {
                $this->executeExport($transfer);
            }
        } catch (Throwable $e) {
            Log::error("SFTP Transfer #{$transfer->id} failed: " . $e->getMessage(), [
                'transfer_id' => $transfer->id,
                'exception' => $e,
            ]);

            $transfer->status = SftpTransfer::STATUS_FAILED;
            $transfer->error_message = $e->getMessage();
            $transfer->completed_at = CarbonImmutable::now();
            $transfer->appendLog("Transfer failed with error: " . $e->getMessage());
            $transfer->saveQuietly();
        }
    }

    /**
     * Execute Import: Remote SFTP -> This Panel Server.
     */
    protected function executeImport(SftpTransfer $transfer): void
    {
        [$host, $port] = self::parseHostAndPort($transfer->host, $transfer->port);
        $username = trim($transfer->username);
        $password = $transfer->getDecryptedPassword();
        $sftp = new SFTP($host, $port, 30);

        if (!$sftp->login($username, $password)) {
            throw new \RuntimeException(self::buildAuthErrorMessage($username));
        }

        $transfer->appendLog("Authentication successful. Remote system banner: " . ($sftp->getServerIdentification() ?: 'Standard SFTP'));

        if ($this->checkCancelled($transfer)) {
            $sftp->disconnect();
            return;
        }

        // Wipe existing server files if requested
        if ($transfer->wipe_existing) {
            $transfer->appendLog("Option 'wipe_existing' is enabled. Cleaning existing files on local server...");
            try {
                $existing = $this->fileRepository->setServer($transfer->server)->getDirectory('/');
                $toDelete = [];
                foreach ($existing as $item) {
                    if (!empty($item['name'])) {
                        $toDelete[] = $item['name'];
                    }
                }
                if (!empty($toDelete)) {
                    $this->fileRepository->setServer($transfer->server)->deleteFiles('/', $toDelete);
                    $transfer->appendLog("Cleaned " . count($toDelete) . " existing items on local server.");
                } else {
                    $transfer->appendLog("Destination server is already empty.");
                }
            } catch (Throwable $e) {
                $transfer->appendLog("Notice while cleaning existing files: " . $e->getMessage());
            }
        }

        // Scan remote directory
        $remotePath = empty(trim($transfer->remote_path)) ? '/' : trim($transfer->remote_path);
        $transfer->status = SftpTransfer::STATUS_TRANSFERRING;
        $transfer->saveQuietly();
        $transfer->appendLog("Scanning remote files in directory '{$remotePath}'...");

        $files = $this->scanRemoteDirectory($sftp, $remotePath);
        $totalFiles = count($files);
        $totalBytes = 0;
        foreach ($files as $f) {
            if (!$f['is_dir']) {
                $totalBytes += $f['size'];
            }
        }

        $transfer->total_files = $totalFiles;
        $transfer->total_bytes = $totalBytes;
        $transfer->saveQuietly();

        $formattedTotal = $this->formatBytes($totalBytes);
        $transfer->appendLog("Found {$totalFiles} items to transfer ({$formattedTotal}). Preparing streaming migration archive...");

        $tempDir = storage_path("app/transfers/{$transfer->id}");
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }
        $zipPath = "{$tempDir}/migration.zip";

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            $sftp->disconnect();
            throw new \RuntimeException("Unable to create local temporary archive at {$zipPath}");
        }

        $transferredFiles = 0;
        $transferredBytes = 0;
        $lastLogTime = time();

        foreach ($files as $file) {
            if ($this->checkCancelled($transfer, $zip, $zipPath, $tempDir)) {
                $sftp->disconnect();
                return;
            }

            $relPath = $file['relative'];
            if ($file['is_dir']) {
                $zip->addEmptyDir($relPath);
            } else {
                $content = $sftp->get($file['path']);
                if ($content !== false) {
                    $zip->addFromString($relPath, $content);
                    $transferredBytes += strlen($content);
                } else {
                    $transfer->appendLog("Warning: Could not read remote file '{$file['path']}', skipping.");
                }
            }

            $transferredFiles++;

            if (time() - $lastLogTime >= 3 || $transferredFiles === $totalFiles) {
                $lastLogTime = time();
                $transfer->updateProgress($transferredFiles, $totalFiles, $transferredBytes, $totalBytes, $relPath);
                $pct = $totalFiles > 0 ? round(($transferredFiles / $totalFiles) * 100, 1) : 0;
                $transfer->appendLog("Downloaded {$transferredFiles}/{$totalFiles} items ({$pct}%) - " . $this->formatBytes($transferredBytes) . " / {$formattedTotal}");
            }
        }

        $zip->close();
        $sftp->disconnect();

        $transfer->updateProgress($transferredFiles, $totalFiles, $transferredBytes, $totalBytes, null);
        $archiveSize = file_exists($zipPath) ? filesize($zipPath) : 0;
        $transfer->appendLog("Archive generated successfully (" . $this->formatBytes($archiveSize) . "). Uploading to Wings daemon...");

        $transfer->status = SftpTransfer::STATUS_EXTRACTING;
        $transfer->saveQuietly();

        // Upload zip archive to Wings
        $uploadToken = $this->jwtService
            ->setExpiresAt(CarbonImmutable::now()->addMinutes(60))
            ->setUser($transfer->user)
            ->setClaims([
                'server_uuid' => $transfer->server->uuid,
                'scope' => 'file-upload',
            ])
            ->handle($transfer->server->node, $transfer->user->id . $transfer->server->uuid);

        $uploadUrl = sprintf(
            '%s/upload/file?token=%s&directory=/',
            $transfer->server->node->getConnectionAddress(),
            $uploadToken->toString()
        );

        $httpClient = new Client(['timeout' => 1800]);
        $httpClient->post($uploadUrl, [
            'multipart' => [
                [
                    'name' => 'files',
                    'contents' => fopen($zipPath, 'r'),
                    'filename' => 'migration_transfer.zip',
                ],
            ],
        ]);

        $transfer->appendLog("Uploaded migration archive to server. Instructing Wings daemon to unpack files...");

        // Unpack archive on Wings
        $this->fileRepository->setServer($transfer->server)->decompressFile('/', 'migration_transfer.zip');

        // Delete uploaded zip file from Wings server root
        $this->fileRepository->setServer($transfer->server)->deleteFiles('/', ['migration_transfer.zip']);

        // Clean up local temp files
        if (file_exists($zipPath)) {
            @unlink($zipPath);
        }
        if (is_dir($tempDir)) {
            @rmdir($tempDir);
        }

        $transfer->status = SftpTransfer::STATUS_COMPLETED;
        $transfer->completed_at = CarbonImmutable::now();
        $transfer->appendLog("Migration completed successfully! All {$transferredFiles} items unpacked on the server.");
        $transfer->saveQuietly();
    }

    /**
     * Execute Export: This Panel Server -> Remote SFTP.
     */
    protected function executeExport(SftpTransfer $transfer): void
    {
        [$host, $port] = self::parseHostAndPort($transfer->host, $transfer->port);
        $username = trim($transfer->username);
        $password = $transfer->getDecryptedPassword();
        $sftp = new SFTP($host, $port, 30);

        if (!$sftp->login($username, $password)) {
            throw new \RuntimeException(self::buildAuthErrorMessage($username));
        }

        $transfer->appendLog("Connected to remote SFTP host {$host}:{$port}.");

        if ($this->checkCancelled($transfer)) {
            $sftp->disconnect();
            return;
        }

        $transfer->status = SftpTransfer::STATUS_TRANSFERRING;
        $transfer->saveQuietly();

        // Get local server files to compress
        $existing = $this->fileRepository->setServer($transfer->server)->getDirectory('/');
        $filesToCompress = [];
        foreach ($existing as $item) {
            if (!empty($item['name'])) {
                $filesToCompress[] = $item['name'];
            }
        }

        if (empty($filesToCompress)) {
            $sftp->disconnect();
            $transfer->status = SftpTransfer::STATUS_COMPLETED;
            $transfer->completed_at = CarbonImmutable::now();
            $transfer->appendLog("Server directory is empty. Nothing to export.");
            $transfer->saveQuietly();
            return;
        }

        $transfer->appendLog("Requesting Wings daemon to compress " . count($filesToCompress) . " server root items...");
        $compressed = $this->fileRepository->setServer($transfer->server)->compressFiles('/', $filesToCompress);

        $archiveName = $compressed['name'] ?? null;
        if (!$archiveName) {
            $sftp->disconnect();
            throw new \RuntimeException("Wings daemon did not return an archive filename.");
        }

        $transfer->appendLog("Archive created on server: '{$archiveName}'. Preparing direct transfer...");

        if ($this->checkCancelled($transfer)) {
            $this->fileRepository->setServer($transfer->server)->deleteFiles('/', [$archiveName]);
            $sftp->disconnect();
            return;
        }

        // Generate Wings download URL
        $downloadToken = $this->jwtService
            ->setExpiresAt(CarbonImmutable::now()->addHours(2))
            ->setUser($transfer->user)
            ->setClaims([
                'file_path' => $archiveName,
                'server_uuid' => $transfer->server->uuid,
                'scope' => 'file-download',
            ])
            ->handle($transfer->server->node, $transfer->user->id . $transfer->server->uuid);

        $downloadUrl = sprintf(
            '%s/download/file?token=%s',
            $transfer->server->node->getConnectionAddress(),
            $downloadToken->toString()
        );

        $destDir = rtrim($transfer->remote_path, '/');
        if (!empty($destDir) && !$sftp->is_dir($destDir)) {
            $sftp->mkdir($destDir, -1, true);
        }
        $remoteDestFile = ($destDir === '' ? '' : $destDir . '/') . $archiveName;

        $transfer->appendLog("Streaming archive directly to remote SFTP destination: '{$remoteDestFile}'...");

        $httpClient = new Client(['timeout' => 3600]);
        $response = $httpClient->get($downloadUrl, ['stream' => true]);
        $stream = $response->getBody()->detach();

        if (!$stream) {
            $this->fileRepository->setServer($transfer->server)->deleteFiles('/', [$archiveName]);
            $sftp->disconnect();
            throw new \RuntimeException("Failed to open stream for Wings download URL.");
        }

        $putSuccess = $sftp->put($remoteDestFile, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }

        if (!$putSuccess) {
            $this->fileRepository->setServer($transfer->server)->deleteFiles('/', [$archiveName]);
            $sftp->disconnect();
            throw new \RuntimeException("Failed to upload archive to remote SFTP path '{$remoteDestFile}'.");
        }

        $transfer->appendLog("Remote upload completed. Cleaning up temporary archive on local server...");
        $this->fileRepository->setServer($transfer->server)->deleteFiles('/', [$archiveName]);

        $sftp->disconnect();

        $transfer->status = SftpTransfer::STATUS_COMPLETED;
        $transfer->completed_at = CarbonImmutable::now();
        $transfer->appendLog("Server exported successfully to remote SFTP: '{$remoteDestFile}'");
        $transfer->saveQuietly();
    }

    /**
     * Recursively scan remote SFTP directory.
     */
    protected function scanRemoteDirectory(SFTP $sftp, string $basePath): array
    {
        $results = [];
        $basePath = rtrim($basePath, '/');
        $queue = [$basePath === '' ? '/' : $basePath];
        $seen = [];

        while (!empty($queue)) {
            $currentDir = array_shift($queue);
            if (isset($seen[$currentDir])) {
                continue;
            }
            $seen[$currentDir] = true;

            $items = $sftp->rawlist($currentDir);
            if ($items === false) {
                continue;
            }

            foreach ($items as $name => $stat) {
                if ($name === '.' || $name === '..') {
                    continue;
                }

                $fullPath = ($currentDir === '/' ? '' : $currentDir) . '/' . $name;
                $relPath = ltrim(substr($fullPath, strlen($basePath)), '/');

                $isDir = isset($stat['type']) && $stat['type'] === 2;

                $results[] = [
                    'path' => $fullPath,
                    'relative' => $relPath,
                    'is_dir' => $isDir,
                    'size' => $stat['size'] ?? 0,
                ];

                if ($isDir) {
                    $queue[] = $fullPath;
                }
            }
        }

        return $results;
    }

    /**
     * Check if transfer was marked as cancelled.
     */
    protected function checkCancelled(SftpTransfer $transfer, ?ZipArchive $zip = null, ?string $zipPath = null, ?string $tempDir = null): bool
    {
        $transfer->refresh();
        if ($transfer->status === SftpTransfer::STATUS_CANCELLED) {
            if ($zip !== null) {
                try {
                    $zip->close();
                } catch (Throwable) {
                }
            }
            if ($zipPath !== null && file_exists($zipPath)) {
                @unlink($zipPath);
            }
            if ($tempDir !== null && is_dir($tempDir)) {
                @rmdir($tempDir);
            }

            $transfer->appendLog("Transfer was cancelled by user.");
            return true;
        }

        return false;
    }

    /**
     * Helper to format bytes into human readable string.
     */
    protected function formatBytes(int $bytes): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $power = floor(log($bytes, 1024));
        $power = min($power, count($units) - 1);

        return round($bytes / pow(1024, $power), 2) . ' ' . $units[$power];
    }
}
