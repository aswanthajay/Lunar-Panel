<?php

namespace Pterodactyl\Console\Commands\GoogleDrive;

use Throwable;
use Illuminate\Console\Command;
use Pterodactyl\Services\GoogleDrive\GoogleDriveService;

class GoogleDriveTestCommand extends Command
{
    protected $signature = 'lunar:gdrive:test';

    protected $description = 'Test Google Drive API connection, permissions, and drive quota.';

    public function handle(GoogleDriveService $service): int
    {
        $this->info('Testing Google Drive API connectivity...');

        if (!$service->isEnabled()) {
            $this->warn('Google Drive integration is currently marked as DISABLED in settings.');
        }

        try {
            $info = $service->testConnection();

            $this->info('✓ Successfully connected to Google Drive API!');
            $this->line("  Account: {$info['email']} ({$info['name']})");

            if ($info['storage_limit'] > 0) {
                $usedGB = round($info['storage_usage'] / (1024 * 1024 * 1024), 2);
                $totalGB = round($info['storage_limit'] / (1024 * 1024 * 1024), 2);
                $percent = round(($info['storage_usage'] / $info['storage_limit']) * 100, 1);
                $this->line("  Storage Quota: {$usedGB} GB / {$totalGB} GB ({$percent}%)");
            } else {
                $usedGB = round($info['storage_usage'] / (1024 * 1024 * 1024), 2);
                $this->line("  Storage Quota: {$usedGB} GB used (Unlimited/Enterprise)");
            }

            if (!empty($info['folder'])) {
                $this->line("  Target Folder: {$info['folder']['name']} [{$info['folder']['id']}]");
            } else {
                $this->line("  Target Folder: Default root ('Lunar Panel Backups')");
            }

            return 0;
        } catch (Throwable $e) {
            $this->error('✗ Connection failed: ' . $e->getMessage());
            return 1;
        }
    }
}
