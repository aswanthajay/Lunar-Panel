<?php

namespace Pterodactyl\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $backup_id
 * @property int $server_id
 * @property string $gdrive_file_id
 * @property string|null $gdrive_folder_id
 * @property string $file_name
 * @property int $file_size
 * @property string|null $web_view_link
 * @property string $status
 * @property string|null $error_message
 * @property CarbonImmutable|null $synced_at
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 * @property \Pterodactyl\Models\Backup $backup
 * @property \Pterodactyl\Models\Server $server
 */
class GoogleDriveBackup extends Model
{
    public const RESOURCE_NAME = 'google_drive_backup';

    protected $table = 'google_drive_backups';

    protected bool $immutableDates = true;

    protected $casts = [
        'id' => 'int',
        'backup_id' => 'int',
        'server_id' => 'int',
        'file_size' => 'int',
        'synced_at' => 'datetime',
    ];

    protected $fillable = [
        'backup_id',
        'server_id',
        'gdrive_file_id',
        'gdrive_folder_id',
        'file_name',
        'file_size',
        'web_view_link',
        'status',
        'error_message',
        'synced_at',
    ];

    public function backup(): BelongsTo
    {
        return $this->belongsTo(Backup::class);
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
