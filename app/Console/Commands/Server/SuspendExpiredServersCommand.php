<?php

namespace Pterodactyl\Console\Commands\Server;

use Carbon\Carbon;
use Pterodactyl\Models\Server;
use Illuminate\Console\Command;
use Pterodactyl\Services\Servers\SuspensionService;

class SuspendExpiredServersCommand extends Command
{
    protected $signature = 'p:server:suspend-expired';

    protected $description = 'Checks all servers with an expiry date and suspends any instances past their expiration.';

    public function __construct(private SuspensionService $suspensionService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $now = Carbon::now();
        $expiredServers = Server::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', $now)
            ->where(function ($query) use ($now) {
                $query->whereNull('grace_period_expires_at')
                    ->orWhere('grace_period_expires_at', '<=', $now);
            })
            ->where(function ($query) {
                $query->where('status', '!=', Server::STATUS_SUSPENDED)
                    ->orWhereNull('status');
            })
            ->get();

        if ($expiredServers->isEmpty()) {
            $this->line('No servers are currently expired or pending suspension.');
            return 0;
        }

        $this->info(sprintf('Found %d expired server(s). Beginning automated suspension...', $expiredServers->count()));

        $suspendedCount = 0;
        foreach ($expiredServers as $server) {
            try {
                $this->suspensionService->toggle($server, SuspensionService::ACTION_SUSPEND);
                $this->line(sprintf('[-] Suspended server [%d] %s (expired on %s)', $server->id, $server->name, $server->expires_at->toDateTimeString()));
                $suspendedCount++;
            } catch (\Throwable $exception) {
                // If Wings is unreachable, still ensure the server status is updated in the database
                $server->update(['status' => Server::STATUS_SUSPENDED]);
                $this->warn(sprintf('[!] Marked server [%d] %s as suspended (Wings sync warning: %s)', $server->id, $server->name, $exception->getMessage()));
                $suspendedCount++;
            }
        }

        $this->info(sprintf('Automated suspension completed. Successfully suspended %d server(s).', $suspendedCount));
        return 0;
    }
}
