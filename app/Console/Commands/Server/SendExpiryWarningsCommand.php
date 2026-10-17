<?php

namespace Pterodactyl\Console\Commands\Server;

use Carbon\Carbon;
use Pterodactyl\Models\Server;
use Illuminate\Console\Command;
use Pterodactyl\Notifications\ServerExpiringSoon;

class SendExpiryWarningsCommand extends Command
{
    protected $signature = 'p:server:send-expiry-warnings';

    protected $description = 'Dispatches automated 7-day, 3-day, and 24-hour expiration alert notifications to server owners.';

    public function handle(): int
    {
        $now = Carbon::now();

        // Query active servers approaching expiration
        $servers = Server::query()
            ->with('user')
            ->whereNotNull('expires_at')
            ->where('expires_at', '>', $now)
            ->where(function ($query) {
                $query->where('status', '!=', Server::STATUS_SUSPENDED)
                    ->orWhereNull('status');
            })
            ->get();

        if ($servers->isEmpty()) {
            $this->line('No active servers currently have upcoming expiration dates.');
            return 0;
        }

        $sentCount = 0;

        foreach ($servers as $server) {
            if (!$server->user) {
                continue;
            }

            $hoursUntilExpiry = $now->diffInHours($server->expires_at, false);
            $warningLevel = (int) ($server->expiry_warning_level ?? 0);

            // Level 3: Final 24 hours (<= 24 hours)
            if ($hoursUntilExpiry <= 24 && $warningLevel < 3) {
                try {
                    $server->user->notify(new ServerExpiringSoon($server, 1));
                    $server->update(['expiry_warning_level' => 3]);
                    $this->info("[24H ALERT] Dispatched 24-hour expiration notice for server [{$server->id}] '{$server->name}' to {$server->user->email}.");
                    $sentCount++;
                } catch (\Throwable $e) {
                    $this->error("[!] Failed to send 24h alert for server #{$server->id}: " . $e->getMessage());
                }
                continue;
            }

            // Level 2: 3 Days (<= 72 hours)
            if ($hoursUntilExpiry <= 72 && $hoursUntilExpiry > 24 && $warningLevel < 2) {
                try {
                    $server->user->notify(new ServerExpiringSoon($server, 3));
                    $server->update(['expiry_warning_level' => 2]);
                    $this->info("[3-DAY ALERT] Dispatched 3-day expiration notice for server [{$server->id}] '{$server->name}' to {$server->user->email}.");
                    $sentCount++;
                } catch (\Throwable $e) {
                    $this->error("[!] Failed to send 3-day alert for server #{$server->id}: " . $e->getMessage());
                }
                continue;
            }

            // Level 1: 7 Days (<= 168 hours)
            if ($hoursUntilExpiry <= 168 && $hoursUntilExpiry > 72 && $warningLevel < 1) {
                try {
                    $server->user->notify(new ServerExpiringSoon($server, 7));
                    $server->update(['expiry_warning_level' => 1]);
                    $this->info("[7-DAY ALERT] Dispatched 7-day expiration notice for server [{$server->id}] '{$server->name}' to {$server->user->email}.");
                    $sentCount++;
                } catch (\Throwable $e) {
                    $this->error("[!] Failed to send 7-day alert for server #{$server->id}: " . $e->getMessage());
                }
            }
        }

        $this->info("Completed automated warning dispatch. Sent {$sentCount} notification(s).");
        return 0;
    }
}
