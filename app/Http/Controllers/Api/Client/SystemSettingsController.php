<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Backup;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class SystemSettingsController extends ClientApiController
{
    public function __construct(private SettingsRepositoryInterface $settings)
    {
        parent::__construct();
    }

    /**
     * Authorize that the authenticated user has administrative or staff access.
     */
    protected function authorizeAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user || (!$user->root_admin && !$user->staff)) {
            throw new AccessDeniedHttpException('Access restricted to system administrators.');
        }
    }

    /**
     * Return comprehensive cluster telemetry, health vitals, and system configuration.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        // 1. Database Ping & Diagnostics
        $dbStart = microtime(true);
        $dbStatus = 'online';
        $dbEngine = 'Unknown';
        $dbTableCount = 0;
        try {
            DB::select('SELECT 1');
            $dbLatency = round((microtime(true) - $dbStart) * 1000, 2);
            $pdo = DB::connection()->getPdo();
            $dbEngine = $pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) . ' ' . $pdo->getAttribute(\PDO::ATTR_SERVER_VERSION);
            $dbTableCount = count(DB::select('SHOW TABLES'));
        } catch (\Throwable $e) {
            $dbStatus = 'error';
            $dbLatency = -1;
        }

        // 2. Queue Status
        $pendingJobs = 0;
        $failedJobs = 0;
        try {
            $pendingJobs = DB::table('jobs')->count();
            $failedJobs = DB::table('failed_jobs')->count();
        } catch (\Throwable) {}

        // 3. Fleet & Node Aggregates
        $totalNodes = 0;
        $totalServers = 0;
        $activeServers = 0;
        $totalMemory = 0;
        $totalDisk = 0;
        $backupsCount = 0;
        try {
            $totalNodes = Node::query()->count();
            $totalServers = Server::query()->count();
            $activeServers = Server::query()->where('suspended', 0)->count();
            $totalMemory = (int) Server::query()->sum('memory');
            $totalDisk = (int) Server::query()->sum('disk');
            $backupsCount = Backup::query()->count();
        } catch (\Throwable) {}

        // 4. Storage Usage
        $basePath = base_path();
        $diskFree = @disk_free_space($basePath) ?: 0;
        $diskTotal = @disk_total_space($basePath) ?: 0;

        // 5. System Uptime & OS
        $uptime = 'N/A';
        if (PHP_OS_FAMILY === 'Linux' && is_readable('/proc/uptime')) {
            $uptimeSec = (float) explode(' ', file_get_contents('/proc/uptime'))[0];
            $days = floor($uptimeSec / 86400);
            $hours = floor(($uptimeSec % 86400) / 3600);
            $mins = floor(($uptimeSec % 3600) / 60);
            $uptime = "{$days}d {$hours}h {$mins}m";
        }

        // 6. Installed Extensions Verification
        $extensions = [
            'pdo_mysql' => extension_loaded('pdo_mysql'),
            'curl' => extension_loaded('curl'),
            'openssl' => extension_loaded('openssl'),
            'mbstring' => extension_loaded('mbstring'),
            'bcmath' => extension_loaded('bcmath'),
            'sodium' => extension_loaded('sodium'),
            'zip' => extension_loaded('zip'),
            'gd' => extension_loaded('gd'),
        ];

        // 7. Configurable Policies & Settings
        $clusterName = $this->settings->get('settings::app:name', config('app.name', 'Votion Primary Cluster'));
        $telemetryInterval = (int) $this->settings->get('settings::cluster:telemetry_interval', 15);
        $sessionTimeout = (int) $this->settings->get('settings::session:lifetime', config('session.lifetime', 120));
        $sslWarningDays = (int) $this->settings->get('settings::cluster:ssl_warning_days', 14);
        $twoFactorReq = (int) $this->settings->get('settings::pterodactyl:auth:2fa_required', config('pterodactyl.auth.2fa_required', 0));
        $registrationOtp = (bool) $this->settings->get('settings::pterodactyl:auth:registration_otp_enabled', config('pterodactyl.auth.registration_otp_enabled', false));
        $nodeTimeout = (int) $this->settings->get('settings::cluster:node_timeout', 30);
        $autoDeployTokens = (bool) $this->settings->get('settings::cluster:auto_deploy_tokens', true);
        $maintenanceMode = app()->isDownForMaintenance();

        return new JsonResponse([
            'telemetry' => [
                'cluster_name' => $clusterName,
                'environment' => config('app.env', 'production'),
                'debug' => (bool) config('app.debug', false),
                'php_version' => PHP_VERSION,
                'server_os' => PHP_OS_FAMILY,
                'server_time' => Carbon::now()->toIso8601String(),
                'server_timezone' => config('app.timezone', 'UTC'),
                'uptime' => $uptime,
                'memory_limit' => ini_get('memory_limit'),
                'max_execution_time' => ini_get('max_execution_time') . 's',
                'storage' => [
                    'free_bytes' => $diskFree,
                    'total_bytes' => $diskTotal,
                    'used_percent' => $diskTotal > 0 ? round((($diskTotal - $diskFree) / $diskTotal) * 100, 1) : 0,
                ],
                'database' => [
                    'status' => $dbStatus,
                    'latency_ms' => $dbLatency,
                    'engine' => $dbEngine,
                    'tables' => $dbTableCount,
                ],
                'queue' => [
                    'driver' => config('queue.default', 'sync'),
                    'pending_jobs' => $pendingJobs,
                    'failed_jobs' => $failedJobs,
                ],
                'fleet' => [
                    'nodes' => $totalNodes,
                    'servers' => $totalServers,
                    'active_servers' => $activeServers,
                    'total_memory_mb' => $totalMemory,
                    'total_disk_mb' => $totalDisk,
                    'backups' => $backupsCount,
                ],
                'extensions' => $extensions,
            ],
            'settings' => [
                'cluster_name' => $clusterName,
                'telemetry_interval' => $telemetryInterval,
                'session_timeout' => $sessionTimeout,
                'ssl_warning_days' => $sslWarningDays,
                'two_factor_requirement' => $twoFactorReq,
                'registration_otp' => $registrationOtp,
                'node_timeout' => $nodeTimeout,
                'auto_deploy_tokens' => $autoDeployTokens,
                'maintenance_mode' => $maintenanceMode,
            ],
        ]);
    }

    /**
     * Persist updated system, cluster orchestration, and security policies.
     */
    public function update(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'cluster_name' => 'nullable|string|max:191',
            'telemetry_interval' => 'nullable|integer|between:5,300',
            'session_timeout' => 'nullable|integer|between:5,1440',
            'ssl_warning_days' => 'nullable|integer|between:1,90',
            'two_factor_requirement' => 'nullable|integer|in:0,1,2',
            'registration_otp' => 'nullable|boolean',
            'node_timeout' => 'nullable|integer|between:10,300',
            'auto_deploy_tokens' => 'nullable|boolean',
        ]);

        if (isset($validated['cluster_name'])) {
            $this->settings->set('settings::app:name', $validated['cluster_name']);
        }
        if (isset($validated['telemetry_interval'])) {
            $this->settings->set('settings::cluster:telemetry_interval', $validated['telemetry_interval']);
        }
        if (isset($validated['session_timeout'])) {
            $this->settings->set('settings::session:lifetime', $validated['session_timeout']);
        }
        if (isset($validated['ssl_warning_days'])) {
            $this->settings->set('settings::cluster:ssl_warning_days', $validated['ssl_warning_days']);
        }
        if (isset($validated['two_factor_requirement'])) {
            $this->settings->set('settings::pterodactyl:auth:2fa_required', $validated['two_factor_requirement']);
        }
        if (isset($validated['registration_otp'])) {
            $this->settings->set('settings::pterodactyl:auth:registration_otp_enabled', $validated['registration_otp'] ? 'true' : 'false');
        }
        if (isset($validated['node_timeout'])) {
            $this->settings->set('settings::cluster:node_timeout', $validated['node_timeout']);
        }
        if (isset($validated['auto_deploy_tokens'])) {
            $this->settings->set('settings::cluster:auto_deploy_tokens', $validated['auto_deploy_tokens'] ? 'true' : 'false');
        }

        try {
            Artisan::call('queue:restart');
        } catch (\Throwable) {}

        return new JsonResponse([
            'success' => true,
            'message' => 'System settings updated and queue workers notified.',
        ]);
    }

    /**
     * Execute live system maintenance & diagnostic actions.
     */
    public function runAction(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $action = $request->input('action');
        $output = '';
        $success = true;
        $message = '';

        switch ($action) {
            case 'clear_cache':
                try {
                    Artisan::call('view:clear');
                    $output .= Artisan::output();
                    Artisan::call('config:clear');
                    $output .= Artisan::output();
                    Artisan::call('route:clear');
                    $output .= Artisan::output();
                    Artisan::call('cache:clear');
                    $output .= Artisan::output();
                    $message = 'Application view, route, config, and cache tiers cleared.';
                } catch (\Throwable $e) {
                    $success = false;
                    $message = 'Failed to clear cache: ' . $e->getMessage();
                    $output = $e->getTraceAsString();
                }
                break;

            case 'optimize':
                try {
                    Artisan::call('optimize');
                    $output = Artisan::output();
                    $message = 'Framework bootstrap and routing optimized successfully.';
                } catch (\Throwable $e) {
                    $success = false;
                    $message = 'Optimization failed: ' . $e->getMessage();
                }
                break;

            case 'restart_queues':
                try {
                    Artisan::call('queue:restart');
                    $output = Artisan::output() ?: "Broadcasting queue restart signal to workers...\n";
                    $message = 'Background queue workers have been signaled to restart.';
                } catch (\Throwable $e) {
                    $success = false;
                    $message = 'Queue restart failed: ' . $e->getMessage();
                }
                break;

            case 'prune_failed_jobs':
                try {
                    $deleted = DB::table('failed_jobs')->delete();
                    $output = "Pruned {$deleted} failed job(s) from failed_jobs table.\n";
                    $message = "Successfully pruned {$deleted} failed job(s).";
                } catch (\Throwable $e) {
                    $success = false;
                    $message = 'Pruning failed jobs failed: ' . $e->getMessage();
                }
                break;

            case 'test_db':
                $start = microtime(true);
                try {
                    DB::select('SELECT 1');
                    $latency = round((microtime(true) - $start) * 1000, 2);
                    $output = "DATABASE PING SUCCESS\nLatency: {$latency} ms\nConnection: " . config('database.default') . "\n";
                    $message = "Database is responsive ({$latency}ms).";
                } catch (\Throwable $e) {
                    $success = false;
                    $message = 'Database ping failed: ' . $e->getMessage();
                }
                break;

            case 'toggle_maintenance':
                $currentlyDown = app()->isDownForMaintenance();
                try {
                    if ($currentlyDown) {
                        Artisan::call('up');
                        $output = Artisan::output() ?: "Application is now live.\n";
                        $message = 'Application is now live and accepting requests.';
                    } else {
                        Artisan::call('down', [
                            '--secret' => 'admin-bypass-' . substr(md5((string) time()), 0, 8),
                        ]);
                        $output = Artisan::output() ?: "Application is now in maintenance mode.\n";
                        $message = 'Application put into maintenance mode.';
                    }
                } catch (\Throwable $e) {
                    $success = false;
                    $message = 'Failed to toggle maintenance mode: ' . $e->getMessage();
                }
                break;

            default:
                return new JsonResponse(['success' => false, 'message' => 'Unknown action: ' . $action], 400);
        }

        return new JsonResponse([
            'success' => $success,
            'message' => $message,
            'output' => trim($output),
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);
    }
}
