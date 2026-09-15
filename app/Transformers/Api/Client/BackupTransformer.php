<?php

namespace Pterodactyl\Transformers\Api\Client;

use Pterodactyl\Models\Backup;

class BackupTransformer extends BaseClientTransformer
{
    public function getResourceName(): string
    {
        return Backup::RESOURCE_NAME;
    }

    public function transform(Backup $backup): array
    {
        return [
            'uuid' => $backup->uuid,
            'is_successful' => $backup->is_successful,
            'is_locked' => $backup->is_locked,
            'name' => $backup->name,
            'ignored_files' => $backup->ignored_files,
            'checksum' => $backup->checksum,
            'bytes' => $backup->bytes,
            'is_gdrive_synced' => (bool) ($backup->gdriveBackup !== null && $backup->gdriveBackup->status === 'completed'),
            'gdrive_web_link' => $backup->gdriveBackup?->web_view_link,
            'created_at' => $backup->created_at->toAtomString(),
            'completed_at' => $backup->completed_at ? $backup->completed_at->toAtomString() : null,
        ];
    }
}
