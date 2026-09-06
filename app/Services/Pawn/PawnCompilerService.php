<?php

namespace Pterodactyl\Services\Pawn;

use Illuminate\Support\Facades\Http;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;

class PawnCompilerService
{
    private ?string $resolvedBaseDir = null;

    public function __construct(
        private DaemonFileRepository $fileRepository
    ) {
    }

    /**
     * Get the base directory for Pawn compiler assets and temp workspaces.
     * Automatically falls back to system temp directory if storage/app/pawn is not writable.
     */
    public function getBaseDir(): string
    {
        if ($this->resolvedBaseDir !== null) {
            return $this->resolvedBaseDir;
        }

        $primary = storage_path('app/pawn');

        // Test if primary exists or can be created with write permission
        if (!@is_dir($primary)) {
            @mkdir($primary, 0775, true);
        }

        if (@is_dir($primary) && @is_writable($primary)) {
            $this->resolvedBaseDir = $primary;
            return $this->resolvedBaseDir;
        }

        // Primary is not writable or cannot be created; fall back to system temp directory
        $fallback = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'stellar_pawn';
        if (!@is_dir($fallback)) {
            @mkdir($fallback, 0777, true);
        }

        if (@is_dir($fallback) && @is_writable($fallback)) {
            $this->resolvedBaseDir = $fallback;
        } else {
            $this->resolvedBaseDir = $primary;
        }

        return $this->resolvedBaseDir;
    }

    /**
     * Get the directory for standard Pawn include files.
     */
    public function getIncludeDir(): string
    {
        // If storage_path already has standard includes, prefer it
        $storageInc = storage_path('app/pawn/include');
        if (file_exists($storageInc . '/a_samp.inc')) {
            return $storageInc;
        }

        $baseInc = $this->getBaseDir() . '/include';
        if (!@is_dir($baseInc)) {
            @mkdir($baseInc, 0775, true);
        }

        return $baseInc;
    }

    /**
     * Get the directory where compiler binaries reside for current OS platform.
     */
    public function getBinDir(): string
    {
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $platform = $isWindows ? 'windows' : 'linux';

        $binDir = $this->getBaseDir() . '/bin/' . $platform;
        if (!@is_dir($binDir)) {
            @mkdir($binDir, 0775, true);
        }

        return $binDir;
    }

    /**
     * Compile a .pwn source file for a server and save the resulting .amx binary back to the server.
     */
    public function compile(Server $server, string $targetPath, ?string $sourceCode = null): array
    {
        $this->ensureCompilerInstalled();

        $cleanTarget = ltrim(str_replace('\\', '/', $targetPath), '/');
        if (!str_ends_with(strtolower($cleanTarget), '.pwn')) {
            throw new \InvalidArgumentException('Target file must be a .pwn source file.');
        }

        $repo = $this->fileRepository->setServer($server);

        // If sourceCode was provided in the request, save it to server first
        if ($sourceCode !== null) {
            try {
                $repo->putContent($cleanTarget, $sourceCode);
            } catch (\Throwable $e) {
                // If direct putContent fails, proceed with provided code in temp workspace
            }
        } else {
            // Retrieve source code from server
            $sourceCode = $repo->getContent($cleanTarget);
        }

        if (empty($sourceCode)) {
            throw new \RuntimeException("Could not read source code from {$cleanTarget} or file is empty.");
        }

        // Create temporary workspace with resilient fallback
        $tempId = $server->uuid . '_' . uniqid();
        $tempDir = $this->getBaseDir() . "/temp/{$tempId}";

        if (!@is_dir($tempDir) && !@mkdir($tempDir, 0775, true)) {
            // Fallback to system temp directory
            $tempDir = rtrim(sys_get_temp_dir(), '/\\') . "/pawn_tmp_{$tempId}";
            if (!@is_dir($tempDir) && !@mkdir($tempDir, 0777, true)) {
                throw new \RuntimeException("Failed to create temporary workspace directory: {$tempDir}");
            }
        }

        $tempPwnFile = $tempDir . '/script.pwn';
        $tempAmxFile = $tempDir . '/script.amx';
        file_put_contents($tempPwnFile, $sourceCode);

        // Fetch custom server includes if available
        $customIncludeDir = $this->prepareCustomIncludes($server, $tempDir);

        // Determine compiler executable
        $binPath = $this->getCompilerPath();

        // Build include directories list (supports both storage and fallback locations)
        $includeDirs = array_unique(array_filter([
            $this->getIncludeDir(),
            storage_path('app/pawn/include'),
            rtrim(sys_get_temp_dir(), '/\\') . '/stellar_pawn/include',
        ]));

        // Build command arguments (matches Zeex Pawno flags)
        $args = [
            $binPath,
            $tempPwnFile,
            "-o{$tempAmxFile}",
            '-d3',
        ];

        foreach ($includeDirs as $inc) {
            if (@is_dir($inc)) {
                $args[] = "-i{$inc}";
            }
        }

        $args[] = '-(+';
        $args[] = '-\\';
        $args[] = '-;+';

        if ($customIncludeDir && @is_dir($customIncludeDir)) {
            $args[] = "-i{$customIncludeDir}";
        }

        // Execute compiler process
        $outputLog = '';
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $env = null;
        if (!$isWindows) {
            @chmod($binPath, 0755);
            $binFolder = dirname($binPath);
            $currentLd = $_ENV['LD_LIBRARY_PATH'] ?? getenv('LD_LIBRARY_PATH') ?: '';
            $env = array_merge($_ENV, [
                'LD_LIBRARY_PATH' => $currentLd ? "{$binFolder}:{$currentLd}" : $binFolder,
            ]);
        }

        // Format command string for proc_open
        if ($isWindows) {
            $escapedArgs = array_map(fn($a) => '"' . str_replace('"', '\"', $a) . '"', $args);
            $cmdLine = implode(' ', $escapedArgs);
        } else {
            $escapedArgs = array_map(fn($a) => escapeshellarg($a), $args);
            $cmdLine = implode(' ', $escapedArgs);
        }

        $process = proc_open($cmdLine, $descriptors, $pipes, $tempDir, $env);

        if (is_resource($process)) {
            fclose($pipes[0]);
            $stdout = stream_get_contents($pipes[1]);
            fclose($pipes[1]);
            $stderr = stream_get_contents($pipes[2]);
            fclose($pipes[2]);

            $returnCode = proc_close($process);
            $outputLog = trim($stdout . "\n" . $stderr);
        } else {
            $returnCode = -1;
            $outputLog = 'Failed to spawn Pawn compiler process.';
        }

        // Check if AMX was created
        $amxSuccess = file_exists($tempAmxFile) && filesize($tempAmxFile) > 0;
        $amxSize = 0;
        $amxServerPath = preg_replace('/\.pwn$/i', '.amx', $cleanTarget);

        if ($amxSuccess) {
            $amxContent = file_get_contents($tempAmxFile);
            $amxSize = strlen($amxContent);

            // Upload AMX binary to server
            try {
                $repo->putContent($amxServerPath, $amxContent);
            } catch (\Throwable $e) {
                $outputLog .= "\nWarning: Compiled successfully, but failed writing .amx to server: " . $e->getMessage();
                $amxSuccess = false;
            }
        } elseif (empty(trim($outputLog))) {
            if ($returnCode === 126 || $returnCode === 127) {
                $outputLog = "Compiler process exited with code {$returnCode}.\nNote: On Linux 64-bit systems, 32-bit runtime libraries may be required:\napt-get install -y libc6:i386 libstdc++6:i386";
            } elseif ($returnCode !== 0) {
                $outputLog = "Compiler exited with error code {$returnCode} without producing output.";
            }
        }

        // Clean up temporary workspace
        $this->deleteDirectory($tempDir);

        // Clean log output and normalize paths
        $outputLog = str_replace([$tempPwnFile, 'script.pwn'], basename($cleanTarget), $outputLog);
        $outputLog = self::ensureUtf8($outputLog);

        // Count errors and warnings
        $errorsCount = 0;
        $warningsCount = 0;
        if (preg_match('/(\d+)\s+Error/i', $outputLog, $m)) {
            $errorsCount = (int) $m[1];
        }
        if (preg_match('/(\d+)\s+Warning/i', $outputLog, $m)) {
            $warningsCount = (int) $m[1];
        }

        return [
            'success' => $amxSuccess,
            'logs' => $outputLog ?: ($amxSuccess ? 'Compiled successfully with zero errors.' : 'Compilation failed.'),
            'amx_path' => $amxServerPath,
            'amx_size' => $amxSize,
            'errors_count' => $errorsCount,
            'warnings_count' => $warningsCount,
            'timestamp' => now()->toIso8601String(),
        ];
    }

    /**
     * Download custom server includes (e.g. from /pawno/include or /include) into temp workspace.
     */
    private function prepareCustomIncludes(Server $server, string $tempDir): ?string
    {
        $repo = $this->fileRepository->setServer($server);
        $customDir = $tempDir . '/custom_include';

        $includeDirs = ['/pawno/include', '/include'];

        foreach ($includeDirs as $dir) {
            try {
                $list = $repo->getDirectory($dir);
                if (!empty($list)) {
                    if (!@is_dir($customDir)) {
                        @mkdir($customDir, 0775, true);
                    }

                    foreach ($list as $item) {
                        $name = $item['name'] ?? null;
                        if ($name && str_ends_with(strtolower($name), '.inc')) {
                            // Don't overwrite if standard library already has it unless custom
                            $dest = $customDir . '/' . $name;
                            try {
                                $content = $repo->getContent("{$dir}/{$name}");
                                if (!empty($content)) {
                                    @file_put_contents($dest, $content);
                                }
                            } catch (\Throwable) {}
                        }
                    }

                    return $customDir;
                }
            } catch (\Throwable) {}
        }

        return null;
    }

    /**
     * Get path to appropriate compiler executable.
     */
    public function getCompilerPath(): string
    {
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $binName = $isWindows ? 'pawncc.exe' : 'pawncc';

        $searchLocations = [
            $this->getBinDir() . '/' . $binName,
            storage_path('app/pawn/bin/' . ($isWindows ? 'windows' : 'linux') . '/' . $binName),
            rtrim(sys_get_temp_dir(), '/\\') . '/stellar_pawn/bin/' . ($isWindows ? 'windows' : 'linux') . '/' . $binName,
        ];

        if (!$isWindows) {
            $searchLocations[] = '/usr/local/bin/pawncc';
            $searchLocations[] = '/usr/bin/pawncc';
        }

        foreach ($searchLocations as $loc) {
            if (file_exists($loc)) {
                if (!$isWindows) {
                    @chmod($loc, 0755);
                }
                return $loc;
            }
        }

        $this->ensureCompilerInstalled();

        foreach ($searchLocations as $loc) {
            if (file_exists($loc)) {
                if (!$isWindows) {
                    @chmod($loc, 0755);
                }
                return $loc;
            }
        }

        $fallbackPath = $this->getBinDir() . '/' . $binName;
        if (!$isWindows && file_exists($fallbackPath)) {
            @chmod($fallbackPath, 0755);
        }

        return $fallbackPath;
    }

    /**
     * Automatically download and set up compiler binaries and includes if missing.
     */
    public function ensureCompilerInstalled(): void
    {
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $binName = $isWindows ? 'pawncc.exe' : 'pawncc';

        $foundBinary = null;
        $searchLocations = [
            $this->getBinDir() . '/' . $binName,
            storage_path('app/pawn/bin/' . ($isWindows ? 'windows' : 'linux') . '/' . $binName),
            rtrim(sys_get_temp_dir(), '/\\') . '/stellar_pawn/bin/' . ($isWindows ? 'windows' : 'linux') . '/' . $binName,
        ];

        if (!$isWindows) {
            $searchLocations[] = '/usr/local/bin/pawncc';
            $searchLocations[] = '/usr/bin/pawncc';
        }

        foreach ($searchLocations as $loc) {
            if (file_exists($loc)) {
                $foundBinary = $loc;
                if (!$isWindows) {
                    @chmod($loc, 0755);
                }
                break;
            }
        }

        // If compiler binary is missing from all locations, download it to binDir
        if (!$foundBinary) {
            $binDir = $this->getBinDir();
            if ($isWindows) {
                $this->downloadWindowsCompiler($binDir);
            } else {
                $this->downloadLinuxCompiler($binDir);
            }
        }

        // Check if core includes are missing across all locations
        $includesFound = (file_exists($this->getIncludeDir() . '/a_samp.inc') && file_exists($this->getIncludeDir() . '/core.inc'))
            || (file_exists(storage_path('app/pawn/include/a_samp.inc')) && file_exists(storage_path('app/pawn/include/core.inc')))
            || (file_exists(rtrim(sys_get_temp_dir(), '/\\') . '/stellar_pawn/include/a_samp.inc'));

        if (!$includesFound) {
            $this->downloadIncludes();
        }
    }

    private function downloadWindowsCompiler(string $binDir): void
    {
        $zipPath = $this->getBaseDir() . '/temp_win.zip';
        $res = Http::timeout(30)->get('https://github.com/pawn-lang/compiler/releases/download/v3.10.10/pawnc-3.10.10-windows.zip');
        if ($res->successful()) {
            @file_put_contents($zipPath, $res->body());
            $zip = new \ZipArchive();
            if ($zip->open($zipPath) === true) {
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $entry = $zip->getNameIndex($i);
                    if (preg_match('#bin/(pawncc\.exe|pawnc\.dll)#i', $entry, $m)) {
                        $content = $zip->getFromIndex($i);
                        @file_put_contents($binDir . '/' . $m[1], $content);
                    }
                }
                $zip->close();
            }
            @unlink($zipPath);
        }
    }

    private function downloadLinuxCompiler(string $binDir): void
    {
        $tarPath = $this->getBaseDir() . '/temp_linux.tar.gz';
        $res = Http::timeout(30)->get('https://github.com/pawn-lang/compiler/releases/download/v3.10.10/pawnc-3.10.10-linux.tar.gz');
        if ($res->successful()) {
            @file_put_contents($tarPath, $res->body());
            $extractDir = $this->getBaseDir() . '/temp_linux_extract';
            if (!@is_dir($extractDir)) {
                @mkdir($extractDir, 0775, true);
            }

            try {
                $extracted = false;
                if (class_exists('PharData')) {
                    try {
                        $p = new \PharData($tarPath);
                        $p->extractTo($extractDir, null, true);
                        $extracted = true;
                    } catch (\Throwable) {}
                }

                if (!$extracted && PHP_OS_FAMILY !== 'Windows' && function_exists('exec')) {
                    @exec("tar -xzf " . escapeshellarg($tarPath) . " -C " . escapeshellarg($extractDir) . " 2>&1");
                }

                $candidates = [
                    $extractDir . '/pawnc-3.10.10-linux/bin/pawncc' => $binDir . '/pawncc',
                    $extractDir . '/pawnc-3.10.10-linux/lib/libpawnc.so' => $binDir . '/libpawnc.so',
                    $extractDir . '/bin/pawncc' => $binDir . '/pawncc',
                    $extractDir . '/lib/libpawnc.so' => $binDir . '/libpawnc.so',
                ];

                foreach ($candidates as $src => $dst) {
                    if (file_exists($src)) {
                        @copy($src, $dst);
                        @chmod($dst, 0755);
                    }
                }

                $this->deleteDirectory($extractDir);
            } catch (\Throwable) {}
            @unlink($tarPath);
        }
    }

    private function downloadIncludes(): void
    {
        $incDir = $this->getIncludeDir();
        if (!@is_dir($incDir)) {
            @mkdir($incDir, 0775, true);
        }

        // 1. Download SA-MP stdlib (a_samp.inc, etc.)
        try {
            $zipPath = $this->getBaseDir() . '/temp_stdlib.zip';
            $res = Http::timeout(30)->get('https://github.com/pawn-lang/samp-stdlib/archive/refs/heads/master.zip');
            if ($res->successful()) {
                @file_put_contents($zipPath, $res->body());
                $zip = new \ZipArchive();
                if ($zip->open($zipPath) === true) {
                    for ($i = 0; $i < $zip->numFiles; $i++) {
                        $entry = $zip->getNameIndex($i);
                        if (str_ends_with(strtolower($entry), '.inc')) {
                            $filename = basename($entry);
                            @file_put_contents($incDir . '/' . $filename, $zip->getFromIndex($i));
                        }
                    }
                    $zip->close();
                }
                @unlink($zipPath);
            }
        } catch (\Throwable) {}

        // 2. Download core runtime includes (core.inc, float.inc, etc.)
        $coreFiles = ['core.inc', 'float.inc', 'string.inc', 'file.inc', 'time.inc', 'datagram.inc', 'console.inc', 'args.inc', 'default.inc', 'rational.inc'];
        foreach ($coreFiles as $f) {
            if (!file_exists($incDir . '/' . $f)) {
                try {
                    $r = Http::timeout(10)->get("https://raw.githubusercontent.com/pawn-lang/compiler/master/include/{$f}");
                    if ($r->successful()) {
                        @file_put_contents($incDir . '/' . $f, $r->body());
                    }
                } catch (\Throwable) {}
            }
        }
    }

    private function deleteDirectory(string $dir): void
    {
        if (!@is_dir($dir)) return;
        $scan = @scandir($dir);
        if ($scan === false) return;
        $items = array_diff($scan, ['.', '..']);
        foreach ($items as $item) {
            $path = $dir . '/' . $item;
            is_dir($path) ? $this->deleteDirectory($path) : @unlink($path);
        }
        @rmdir($dir);
    }

    /**
     * Ensure a string is strictly valid UTF-8, converting from legacy Pawn encodings (Windows-1252, ISO-8859-1, Windows-1251, etc.)
     */
    public static function ensureUtf8(string $string): string
    {
        if (mb_check_encoding($string, 'UTF-8')) {
            return $string;
        }

        // Try detecting encoding from common legacy Pawn source code encodings
        $detected = mb_detect_encoding($string, ['Windows-1252', 'ISO-8859-1', 'Windows-1251', 'UTF-8', 'ASCII'], true);

        if ($detected && $detected !== 'UTF-8') {
            $converted = @mb_convert_encoding($string, 'UTF-8', $detected);
            if ($converted !== false && mb_check_encoding($converted, 'UTF-8')) {
                return $converted;
            }
        }

        // Try standard Windows-1252 fallback
        $converted = @mb_convert_encoding($string, 'UTF-8', 'Windows-1252');
        if ($converted !== false && mb_check_encoding($converted, 'UTF-8')) {
            return $converted;
        }

        // Strip / ignore invalid UTF-8 bytes via iconv if available
        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $string);
            if ($converted !== false && mb_check_encoding($converted, 'UTF-8')) {
                return $converted;
            }
        }

        // Final fallback: replace invalid characters
        return mb_convert_encoding($string, 'UTF-8', 'UTF-8');
    }
}
