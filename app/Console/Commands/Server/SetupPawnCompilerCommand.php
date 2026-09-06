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
        try {
            $service->ensureCompilerInstalled();
            $path = $service->getCompilerPath();
            $this->info("Pawn compiler is ready at: {$path}");
            $this->info('Standard SA-MP includes are ready in storage/app/pawn/include.');
            return 0;
        } catch (\Throwable $e) {
            $this->error('Failed to set up Pawn compiler: ' . $e->getMessage());
            return 1;
        }
    }
}
