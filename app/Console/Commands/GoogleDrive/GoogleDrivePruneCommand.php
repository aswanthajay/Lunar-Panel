<?php

namespace Pterodactyl\Console\Commands\GoogleDrive;

use Throwable;
use Illuminate\Console\Command;
use Pterodactyl\Services\GoogleDrive\GoogleDriveService;

class GoogleDrivePruneCommand extends Command
{
    protected $signature = 'lunar:gdrive:prune';

    protected $description = 'Prune old backups from Google Drive based on retention policy.';

    public function handle(GoogleDriveService $service): int
    {
        $this->info('Pruning expired backups from Google Drive...');

        try {
            $pruned = $service->pruneOldBackups();
            $this->info("✓ Successfully pruned {$pruned} expired backup(s) from Google Drive.");
            return 0;
        } catch (Throwable $e) {
            $this->error('✗ Prune failed: ' . $e->getMessage());
            return 1;
        }
    }
}
