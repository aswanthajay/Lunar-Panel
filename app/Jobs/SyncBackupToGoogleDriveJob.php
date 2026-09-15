<?php

namespace Pterodactyl\Jobs;

use Throwable;
use Illuminate\Bus\Queueable;
use Pterodactyl\Models\Backup;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\GoogleDriveBackup;
use Pterodactyl\Services\GoogleDrive\GoogleDriveService;

class SyncBackupToGoogleDriveJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * Number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 1800; // 30 minutes for large game backups

    public function __construct(public Backup $backup)
    {
    }

    /**
     * Execute the job.
     */
    public function handle(GoogleDriveService $googleDriveService): void
    {
        if (!$googleDriveService->isEnabled()) {
            return;
        }

        try {
            GoogleDriveBackup::updateOrCreate(
                ['backup_id' => $this->backup->id],
                [
                    'server_id' => $this->backup->server_id,
                    'file_name' => $this->backup->name,
                    'status' => 'syncing',
                    'gdrive_file_id' => 'syncing',
                ]
            );

            $googleDriveService->uploadBackup($this->backup);
            Log::info("Successfully synced backup [{$this->backup->uuid}] to Google Drive.");
        } catch (Throwable $e) {
            Log::error("Failed to sync backup [{$this->backup->uuid}] to Google Drive: " . $e->getMessage(), [
                'exception' => $e,
            ]);

            GoogleDriveBackup::updateOrCreate(
                ['backup_id' => $this->backup->id],
                [
                    'server_id' => $this->backup->server_id,
                    'file_name' => $this->backup->name,
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                ]
            );

            throw $e;
        }
    }
}
