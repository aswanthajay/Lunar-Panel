<?php

namespace Pterodactyl\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Pterodactyl\Models\SftpTransfer;
use Pterodactyl\Services\Sftp\SftpTransferService;

class ProcessSftpTransferJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * Number of attempts for this job.
     */
    public int $tries = 1;

    /**
     * Maximum execution time in seconds (2 hours).
     */
    public int $timeout = 7200;

    public function __construct(public SftpTransfer $transfer)
    {
    }

    /**
     * Execute the job.
     */
    public function handle(SftpTransferService $transferService): void
    {
        $transferService->processTransfer($this->transfer);
    }
}
