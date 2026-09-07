<?php

namespace Pterodactyl\Console\Commands\KSM;

use Illuminate\Console\Command;
use Pterodactyl\Services\KSM\KsmService;

class KsmStatusCommand extends Command
{
    protected $signature = 'ksm:status {--tune= : Apply a tuning profile (aggressive, balanced, eco)}';
    protected $description = 'View live Kernel Samepage Merging (KSM) telemetry, memory savings, and tuning status';

    public function handle(KsmService $service): int
    {
        $tune = $this->option('tune');
        if ($tune) {
            $res = $service->applyProfile(strtolower((string) $tune));
            $this->info("Successfully applied {$res['label']} profile!");
            $this->line("Parameters: " . json_encode($res['parameters']));
            $this->newLine();
        }

        $metrics = $service->getMetrics();

        $this->line('<fg=cyan>====================================================</>');
        $this->line('<fg=white;options=bold>  Kernel Samepage Merging (KSM) - Live Status</>');
        $this->line('<fg=cyan>====================================================</>');
        $this->newLine();

        $statusColor = match ($metrics['status']) {
            'running' => 'green',
            'unmerging' => 'yellow',
            default => 'red',
        };

        $this->line("Engine Status:        <fg={$statusColor};options=bold>" . strtoupper($metrics['status']) . "</>");
        $this->line("Active Profile:       <fg=yellow>" . strtoupper($metrics['active_profile']) . "</>");
        $this->line("Memory Saved:         <fg=green;options=bold>{$metrics['memory_saved_human']}</> (" . $metrics['savings_percentage'] . "% of System RAM)");
        $this->line("Deduplication Ratio:  <fg=cyan;options=bold>{$metrics['sharing_ratio']}x</>");
        $this->line("Shared Base Pages:    <fg=white>" . number_format($metrics['pages_shared']) . " pages</> ({$metrics['memory_shared_human']})");
        $this->line("Shared References:    <fg=white>" . number_format($metrics['pages_sharing']) . " pages</>");
        $this->line("Unshared Pages:       <fg=white>" . number_format($metrics['pages_unshared']) . " pages</>");
        $this->line("Volatile Pages:       <fg=white>" . number_format($metrics['pages_volatile']) . " pages</>");
        $this->line("Full Scan Cycles:     <fg=white>" . number_format($metrics['full_scans']) . " scans completed</>");
        $this->line("ksmd CPU Usage:       <fg=white>" . $metrics['ksmd_cpu'] . "%</>");

        $this->newLine();
        $this->line('<fg=white;options=bold>Active Kernel Parameters (/sys/kernel/mm/ksm/):</>');
        $tableData = [];
        foreach ($metrics['parameters'] as $key => $val) {
            $tableData[] = [$key, $val];
        }
        $this->table(['Parameter', 'Value'], $tableData);

        $this->newLine();
        $this->line('<fg=white;options=bold>Host Readiness Checklist:</>');
        $readiness = $metrics['readiness'];
        $this->line("  Kernel Supported:     " . ($readiness['kernel_supported'] ? '<fg=green>✓ YES</>' : '<fg=red>✗ NO</>'));
        $this->line("  KSM Active:           " . ($readiness['ksm_running'] ? '<fg=green>✓ YES</>' : '<fg=red>✗ NO</>'));
        $this->line("  Auto-Tuner Daemon:    " . ($readiness['daemon_installed'] ? '<fg=green>✓ INSTALLED</>' : '<fg=yellow>✗ NOT INSTALLED</>'));
        $this->line("  Systemd Service:      " . ($readiness['systemd_active'] ? '<fg=green>✓ ACTIVE</>' : '<fg=yellow>✗ INACTIVE</>'));
        $this->line("  Container libksm:     " . ($readiness['libksm_installed'] ? '<fg=green>✓ READY</>' : '<fg=yellow>✗ NOT COMPILED</>'));

        $this->newLine();
        $this->line('To setup or re-tune KSM on your host server, run:');
        $this->line('  <fg=yellow>php artisan ksm:setup</>');
        $this->newLine();

        return 0;
    }
}
