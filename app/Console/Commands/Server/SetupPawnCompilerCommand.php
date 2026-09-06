<?php

namespace Pterodactyl\Console\Commands\Server;

use Illuminate\Console\Command;
use Pterodactyl\Services\Pawn\PawnCompilerService;

class SetupPawnCompilerCommand extends Command
{
    protected $signature = 'samp:setup-compiler';
    protected $description = 'Set up and verify Pawn compiler binaries (Zeex 3.10.10) and standard SA-MP includes';

    public function handle(PawnCompilerService $service): int
    {
        $this->info('Checking Pawn compiler installation...');

        $baseDir = storage_path('app/pawn');
        $includeDir = storage_path('app/pawn/include');

        // Pre-create storage directories with liberal permissions
        if (!is_dir($baseDir)) {
            @mkdir($baseDir, 0775, true);
        }
        if (!is_dir($includeDir)) {
            @mkdir($includeDir, 0775, true);
        }

        // On Linux/Unix, fix directory permissions so web server user can read/write
        if (PHP_OS_FAMILY !== 'Windows' && function_exists('exec')) {
            @exec("chmod -R 775 " . escapeshellarg($baseDir) . " 2>/dev/null");
            foreach (['www-data:www-data', 'nginx:nginx', 'apache:apache'] as $owner) {
                @exec("chown -R {$owner} " . escapeshellarg($baseDir) . " 2>/dev/null");
            }
        }

        try {
            $service->ensureCompilerInstalled();
            $path = $service->getCompilerPath();

            if (PHP_OS_FAMILY !== 'Windows') {
                @chmod($path, 0755);
                @chmod(dirname($path) . '/libpawnc.so', 0755);
                if (function_exists('exec')) {
                    @exec("chmod -R 775 " . escapeshellarg($baseDir) . " 2>/dev/null");
                    @exec("chmod +x " . escapeshellarg($path) . " 2>/dev/null");
                }
            }

            $this->info("Pawn compiler located at: {$path}");
            $this->info("Standard SA-MP includes located in: {$includeDir}");

            // Verify compiler execution directly
            $this->info('Testing Pawn compiler execution...');
            $binDir = dirname($path);
            $testCmd = escapeshellarg($path);
            $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
            $baseEnv = getenv() ?: [];
            if (empty($baseEnv['PATH'])) {
                $baseEnv['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
            }
            $currentLd = $baseEnv['LD_LIBRARY_PATH'] ?? '';
            $env = array_merge($baseEnv, [
                'LD_LIBRARY_PATH' => $currentLd ? "{$binDir}:{$currentLd}" : $binDir,
            ]);

            $process = proc_open($testCmd, $descriptors, $pipes, $binDir, $env);
            $testOutput = '';
            $exitCode = -1;
            if (is_resource($process)) {
                fclose($pipes[0]);
                $testOutput = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                $exitCode = proc_close($process);
            }

            if (stripos($testOutput, 'Pawn compiler') !== false || $exitCode === 0) {
                $this->info('✓ Pawn compiler executed successfully and verified!');
            } else {
                $this->warn("Compiler test output: " . trim($testOutput) . " (Exit code: {$exitCode})");

                if (PHP_OS_FAMILY !== 'Windows') {
                    // Detect ELF architecture and suggest appropriate fix
                    if (file_exists($path)) {
                        $header = @file_get_contents($path, false, null, 0, 16);
                        $isElf32 = (substr($header, 0, 4) === "\x7fELF" && ord($header[4]) === 1);
                        if ($isElf32 && !file_exists('/lib/ld-linux.so.2')) {
                            $this->error('The installed compiler is 32-bit ELF and this 64-bit Linux host lacks 32-bit libraries (/lib/ld-linux.so.2).');
                            $this->line('To resolve, run:');
                            $this->line('  sudo dpkg --add-architecture i386 && sudo apt-get update && sudo apt-get install -y libc6:i386 lib32stdc++6');
                        }
                    }
                }
            }

            if (PHP_OS_FAMILY !== 'Windows') {
                $this->newLine();
                $this->info('Permissions note: Ensure your web server user (e.g. www-data) owns storage:');
                $this->line('  chown -R www-data:www-data ' . storage_path('app/pawn'));
                $this->line('  chmod -R 775 ' . storage_path('app/pawn'));
            }

            return 0;
        } catch (\Throwable $e) {
            $this->error('Failed to set up Pawn compiler: ' . $e->getMessage());
            return 1;
        }
    }
}
