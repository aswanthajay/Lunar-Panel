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
                if (function_exists('exec')) {
                    @exec("chmod -R 775 " . escapeshellarg($baseDir) . " 2>/dev/null");
                }
            }

            $this->info("Pawn compiler is ready at: {$path}");
            $this->info("Standard SA-MP includes are ready in: {$includeDir}");

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
