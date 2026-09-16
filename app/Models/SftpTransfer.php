<?php

namespace Pterodactyl\Models;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $server_id
 * @property int $user_id
 * @property string $direction
 * @property string $status
 * @property string $host
 * @property int $port
 * @property string $username
 * @property string $password
 * @property string $remote_path
 * @property bool $wipe_existing
 * @property int $total_files
 * @property int $transferred_files
 * @property int $total_bytes
 * @property int $transferred_bytes
 * @property string|null $current_file
 * @property string|null $log
 * @property string|null $error_message
 * @property CarbonImmutable|null $started_at
 * @property CarbonImmutable|null $completed_at
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 * @property \Pterodactyl\Models\Server $server
 * @property \Pterodactyl\Models\User $user
 */
class SftpTransfer extends Model
{
    public const RESOURCE_NAME = 'sftp_transfer';

    public const STATUS_PENDING = 'pending';
    public const STATUS_CONNECTING = 'connecting';
    public const STATUS_TRANSFERRING = 'transferring';
    public const STATUS_EXTRACTING = 'extracting';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    public const DIRECTION_IMPORT = 'import';
    public const DIRECTION_EXPORT = 'export';

    protected $table = 'sftp_transfers';

    protected bool $skipValidation = true;

    protected bool $immutableDates = true;

    protected $casts = [
        'id' => 'int',
        'server_id' => 'int',
        'user_id' => 'int',
        'port' => 'int',
        'wipe_existing' => 'bool',
        'total_files' => 'int',
        'transferred_files' => 'int',
        'total_bytes' => 'int',
        'transferred_bytes' => 'int',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    protected $fillable = [
        'server_id',
        'user_id',
        'direction',
        'status',
        'host',
        'port',
        'username',
        'password',
        'remote_path',
        'wipe_existing',
        'total_files',
        'transferred_files',
        'total_bytes',
        'transferred_bytes',
        'current_file',
        'log',
        'error_message',
        'started_at',
        'completed_at',
    ];

    /**
     * Encrypt password on assignment.
     */
    public function setPasswordAttribute(string $value): void
    {
        $this->attributes['password'] = Crypt::encryptString($value);
    }

    /**
     * Decrypt and return password.
     */
    public function getDecryptedPassword(): string
    {
        return Crypt::decryptString($this->password);
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isFinished(): bool
    {
        return in_array($this->status, [
            self::STATUS_COMPLETED,
            self::STATUS_FAILED,
            self::STATUS_CANCELLED,
        ], true);
    }

    public function canBeCancelled(): bool
    {
        return !$this->isFinished();
    }

    /**
     * Append a log line with ISO timestamp and persist immediately.
     */
    public function appendLog(string $message): void
    {
        $time = now()->format('Y-m-d H:i:s');
        $line = "[{$time}] {$message}\n";
        $this->log = ($this->log ?? '') . $line;
        $this->saveQuietly();
    }

    /**
     * Update numerical progress counters and active file.
     */
    public function updateProgress(int $transferredFiles, int $totalFiles, int $transferredBytes, int $totalBytes, ?string $currentFile = null): void
    {
        $this->transferred_files = $transferredFiles;
        $this->total_files = $totalFiles;
        $this->transferred_bytes = $transferredBytes;
        $this->total_bytes = $totalBytes;
        if ($currentFile !== null) {
            $this->current_file = $currentFile;
        }
        $this->saveQuietly();
    }
}
