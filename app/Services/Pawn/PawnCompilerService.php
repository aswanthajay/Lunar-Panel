<?php

namespace Pterodactyl\Services\Pawn;

use Illuminate\Support\Facades\Http;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;

class PawnCompilerService
{
    private string $basePawnDir;
    private string $includeDir;

    public function __construct(
        private DaemonFileRepository $fileRepository
    ) {
        $this->basePawnDir = storage_path('app/pawn');
        $this->includeDir = storage_path('app/pawn/include');
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

        // Create temporary workspace
        $tempId = $server->uuid . '_' . uniqid();
        $tempDir = storage_path("app/pawn/temp/{$tempId}");
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $tempPwnFile = $tempDir . '/script.pwn';
        $tempAmxFile = $tempDir . '/script.amx';
        file_put_contents($tempPwnFile, $sourceCode);

        // Fetch custom server includes if available
        $customIncludeDir = $this->prepareCustomIncludes($server, $tempDir);

        // Determine compiler executable
        $binPath = $this->getCompilerPath();

        // Build command arguments (matches Zeex Pawno flags)
        $args = [
            $binPath,
            $tempPwnFile,
            "-o{$tempAmxFile}",
            '-d3',
            "-i{$this->includeDir}",
            '-(+',
            '-\\',
            '-;+',
        ];

        if ($customIncludeDir && is_dir($customIncludeDir)) {
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
            $env = array_merge($_ENV, [
                'LD_LIBRARY_PATH' => dirname($binPath),
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

            proc_close($process);
            $outputLog = trim($stdout . "\n" . $stderr);
        } else {
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
                    if (!is_dir($customDir)) {
                        mkdir($customDir, 0755, true);
                    }

                    foreach ($list as $item) {
                        $name = $item['name'] ?? null;
                        if ($name && str_ends_with(strtolower($name), '.inc')) {
                            // Don't overwrite if standard library already has it unless custom
                            $dest = $customDir . '/' . $name;
                            try {
                                $content = $repo->getContent("{$dir}/{$name}");
                                if (!empty($content)) {
                                    file_put_contents($dest, $content);
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

        if ($isWindows) {
            $path = storage_path('app/pawn/bin/windows/pawncc.exe');
        } else {
            $path = storage_path('app/pawn/bin/linux/pawncc');
            if (file_exists($path)) {
                @chmod($path, 0755);
            }
        }

        if (!file_exists($path)) {
            $this->ensureCompilerInstalled();
        }

        return $path;
    }

    /**
     * Automatically download and set up compiler binaries and includes if missing.
     */
    public function ensureCompilerInstalled(): void
    {
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $binDir = storage_path('app/pawn/bin/' . ($isWindows ? 'windows' : 'linux'));
        $targetBin = $binDir . '/' . ($isWindows ? 'pawncc.exe' : 'pawncc');

        if (!is_dir($this->includeDir)) {
            mkdir($this->includeDir, 0755, true);
        }

        // If compiler binary is missing, download it
        if (!file_exists($targetBin)) {
            if (!is_dir($binDir)) {
                mkdir($binDir, 0755, true);
            }

            if ($isWindows) {
                $this->downloadWindowsCompiler($binDir);
            } else {
                $this->downloadLinuxCompiler($binDir);
            }
        }

        // If core includes are missing, download them
        if (!file_exists($this->includeDir . '/a_samp.inc') || !file_exists($this->includeDir . '/core.inc')) {
            $this->downloadIncludes();
        }
    }

    private function downloadWindowsCompiler(string $binDir): void
    {
        $zipPath = storage_path('app/pawn/temp_win.zip');
        $res = Http::timeout(30)->get('https://github.com/pawn-lang/compiler/releases/download/v3.10.10/pawnc-3.10.10-windows.zip');
        if ($res->successful()) {
            file_put_contents($zipPath, $res->body());
            $zip = new \ZipArchive();
            if ($zip->open($zipPath) === true) {
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $entry = $zip->getNameIndex($i);
                    if (preg_match('#bin/(pawncc\.exe|pawnc\.dll)#i', $entry, $m)) {
                        $content = $zip->getFromIndex($i);
                        file_put_contents($binDir . '/' . $m[1], $content);
                    }
                }
                $zip->close();
            }
            @unlink($zipPath);
        }
    }

    private function downloadLinuxCompiler(string $binDir): void
    {
        $tarPath = storage_path('app/pawn/temp_linux.tar.gz');
        $res = Http::timeout(30)->get('https://github.com/pawn-lang/compiler/releases/download/v3.10.10/pawnc-3.10.10-linux.tar.gz');
        if ($res->successful()) {
            file_put_contents($tarPath, $res->body());
            // Extract with PharData
            try {
                $p = new \PharData($tarPath);
                $extractDir = storage_path('app/pawn/temp_linux_extract');
                $p->extractTo($extractDir, null, true);

                $candidates = [
                    $extractDir . '/pawnc-3.10.10-linux/bin/pawncc' => $binDir . '/pawncc',
                    $extractDir . '/pawnc-3.10.10-linux/lib/libpawnc.so' => $binDir . '/libpawnc.so',
                ];

                foreach ($candidates as $src => $dst) {
                    if (file_exists($src)) {
                        copy($src, $dst);
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
        // 1. Download SA-MP stdlib (a_samp.inc, etc.)
        try {
            $zipPath = storage_path('app/pawn/temp_stdlib.zip');
            $res = Http::timeout(30)->get('https://github.com/pawn-lang/samp-stdlib/archive/refs/heads/master.zip');
            if ($res->successful()) {
                file_put_contents($zipPath, $res->body());
                $zip = new \ZipArchive();
                if ($zip->open($zipPath) === true) {
                    for ($i = 0; $i < $zip->numFiles; $i++) {
                        $entry = $zip->getNameIndex($i);
                        if (str_ends_with(strtolower($entry), '.inc')) {
                            $filename = basename($entry);
                            file_put_contents($this->includeDir . '/' . $filename, $zip->getFromIndex($i));
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
            if (!file_exists($this->includeDir . '/' . $f)) {
                try {
                    $r = Http::timeout(10)->get("https://raw.githubusercontent.com/pawn-lang/compiler/master/include/{$f}");
                    if ($r->successful()) {
                        file_put_contents($this->includeDir . '/' . $f, $r->body());
                    }
                } catch (\Throwable) {}
            }
        }
    }

    private function deleteDirectory(string $dir): void
    {
        if (!is_dir($dir)) return;
        $items = array_diff(scandir($dir), ['.', '..']);
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
