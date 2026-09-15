<?php

namespace Pterodactyl\Console\Commands\GoogleDrive;

use Throwable;
use Illuminate\Console\Command;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\GoogleDriveBackup;
use Pterodactyl\Services\GoogleDrive\GoogleDriveService;

class GoogleDriveSyncCommand extends Command
{
    protected $signature = 'lunar:gdrive:sync {backup? : The UUID of a specific backup to sync} {--all : Sync all successful backups not yet uploaded to Google Drive}';

    protected $description = 'Upload server backup(s) to Google Drive via streaming resumable chunks.';

    public function handle(GoogleDriveService $service): int
    {
        if (!$service->isEnabled()) {
            $this->error('Google Drive integration is disabled in settings. Enable it in Admin CP first.');
            return 1;
        }

        $backupUuid = $this->argument('backup');

        if ($backupUuid) {
            $backup = Backup::where('uuid', $backupUuid)->first();
            if (!$backup) {
                $this->error("Backup with UUID [{$backupUuid}] not found.");
                return 1;
            }

            return $this->syncSingle($service, $backup);
        }

        if ($this->option('all')) {
            $existingBackupIds = GoogleDriveBackup::where('status', 'completed')->pluck('backup_id')->toArray();
            $pendingBackups = Backup::where('is_successful', true)
                ->whereNotIn('id', $existingBackupIds)
                ->orderByDesc('created_at')
                ->get();

            if ($pendingBackups->isEmpty()) {
                $this->info('No pending backups found to sync.');
                return 0;
            }

            $this->info("Found {$pendingBackups->count()} backup(s) to sync to Google Drive.");
            $success = 0;
            foreach ($pendingBackups as $b) {
                if ($this->syncSingle($service, $b) === 0) {
                    $success++;
                }
            }

            $this->info("Synced {$success} / {$pendingBackups->count()} backups.");
            return 0;
        }

        $this->warn('Please specify a backup UUID or use --all to sync all un-uploaded backups.');
        return 1;
    }

    protected function syncSingle(GoogleDriveService $service, Backup $backup): int
    {
        $this->line("Starting Google Drive upload for [{$backup->name}] ({$backup->uuid})...");
        try {
            $record = $service->uploadBackup($backup);
            $this->info("✓ Successfully synced: {$record->file_name} [{$record->gdrive_file_id}]");
            $this->line("  Link: {$record->web_view_link}");
            return 0;
        } catch (Throwable $e) {
            $this->error("✗ Sync failed: " . $e->getMessage());
            return 1;
        }
    }
}
