<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Minecraft;

use Carbon\Carbon;
use GuzzleHttp\Client;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Illuminate\Support\Facades\Cache;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Repositories\Wings\DaemonCommandRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Illuminate\Auth\Access\AuthorizationException;

class SparkProfilerController extends ClientApiController
{
    public function __construct(
        private DaemonFileRepository $fileRepository,
        private DaemonCommandRepository $commandRepository,
    ) {
        parent::__construct();
    }

    /**
     * Return the Spark status for this Minecraft server.
     */
    public function status(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }

        $installed = false;
        $pluginFile = null;
        $directory = '/plugins';

        // 1. Check /plugins for spark*.jar
        try {
            $pluginFiles = $this->fileRepository->setServer($server)->getDirectory('/plugins');
            if (is_array($pluginFiles)) {
                foreach ($pluginFiles as $f) {
                    $name = (string) ($f['name'] ?? '');
                    if (str_starts_with(strtolower($name), 'spark') && (str_ends_with(strtolower($name), '.jar') || str_ends_with(strtolower($name), '.jar.disabled'))) {
                        $installed = true;
                        $pluginFile = $name;
                        $directory = '/plugins';
                        break;
                    }
                }
            }
        } catch (\Throwable) {}

        // 2. Check /mods for spark*.jar (Fabric/Forge)
        if (!$installed) {
            try {
                $modFiles = $this->fileRepository->setServer($server)->getDirectory('/mods');
                if (is_array($modFiles)) {
                    foreach ($modFiles as $f) {
                        $name = (string) ($f['name'] ?? '');
                        if (str_starts_with(strtolower($name), 'spark') && (str_ends_with(strtolower($name), '.jar') || str_ends_with(strtolower($name), '.jar.disabled'))) {
                            $installed = true;
                            $pluginFile = $name;
                            $directory = '/mods';
                            break;
                        }
                    }
                }
            } catch (\Throwable) {}
        }

        $reports = Cache::get("server:{$server->id}:spark_reports", []);
        $tickStats = Cache::get("server:{$server->id}:tick_stats", null);

        return response()->json([
            'installed' => $installed,
            'plugin_file' => $pluginFile,
            'directory' => $directory,
            'reports' => array_values($reports),
            'tick_stats' => $tickStats,
        ]);
    }

    /**
     * Install official Spark profiler to the server.
     */
    public function install(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }

        $targetDir = (string) $request->input('directory', '/plugins');
        if (!in_array($targetDir, ['/plugins', '/mods'], true)) {
            $targetDir = '/plugins';
        }

        $client = new Client(['timeout' => 8, 'headers' => ['User-Agent' => 'StellarPanel-SparkInstaller/1.0']]);

        // Query Modrinth API for official spark releases
        $downloadUrl = null;
        $fileName = 'spark.jar';

        try {
            $response = $client->get('https://api.modrinth.com/v2/project/spark/version');
            $versions = json_decode($response->getBody()->getContents(), true);

            if (is_array($versions) && !empty($versions)) {
                $loaderFilter = $targetDir === '/mods' ? ['fabric', 'forge', 'neoforge'] : ['paper', 'spigot', 'bukkit', 'purpur'];
                foreach ($versions as $v) {
                    $loaders = $v['loaders'] ?? [];
                    if (array_intersect($loaderFilter, $loaders)) {
                        $files = $v['files'] ?? [];
                        if (!empty($files[0]['url'])) {
                            $downloadUrl = $files[0]['url'];
                            $fileName = $files[0]['filename'] ?? 'spark.jar';
                            break;
                        }
                    }
                }
            }
        } catch (\Throwable) {}

        // Fallback to Lucko direct build URL
        if (!$downloadUrl) {
            $downloadUrl = $targetDir === '/mods'
                ? 'https://ci.lucko.me/job/spark/lastSuccessfulBuild/artifact/spark-fabric/build/libs/spark-fabric.jar'
                : 'https://ci.lucko.me/job/spark/lastSuccessfulBuild/artifact/spark-bukkit/build/libs/spark-bukkit.jar';
            $fileName = $targetDir === '/mods' ? 'spark-fabric.jar' : 'spark-bukkit.jar';
        }

        try {
            $this->fileRepository->setServer($server)->pull(
                $downloadUrl,
                $targetDir,
                ['use_header' => true, 'foreground' => true]
            );

            return response()->json([
                'status' => 'success',
                'message' => "Spark ({$fileName}) has been installed into {$targetDir}. Please restart your server or type /spark in console to initialize.",
                'file_name' => $fileName,
                'directory' => $targetDir,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'error' => 'Failed to download Spark: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Start, stop, or manage active Spark profiler sampling.
     */
    public function profiler(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $action = (string) $request->input('action', 'start');

        if ($action === 'start') {
            $mode = $request->input('mode') === 'alloc' ? 'alloc' : 'cpu';
            $timeout = (int) $request->input('timeout', 60);
            $thread = $request->input('thread') === 'all' ? 'all' : 'server';
            $onlyTicksOver = (int) $request->input('only_ticks_over', 0);

            $cmd = 'spark profiler start';
            if ($mode === 'alloc') {
                $cmd .= ' --alloc';
            }
            if ($timeout > 0) {
                $cmd .= " --timeout {$timeout}";
            }
            if ($thread === 'all') {
                $cmd .= ' --thread *';
            }
            if ($onlyTicksOver > 0) {
                $cmd .= " --only-ticks-over {$onlyTicksOver}";
            }

            try {
                $this->commandRepository->setServer($server)->send($cmd);
                return response()->json([
                    'status' => 'started',
                    'mode' => $mode,
                    'timeout' => $timeout,
                    'command' => $cmd,
                    'message' => "Spark profiler sampler started ({$mode}).",
                ]);
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Failed to send profiler command: ' . $e->getMessage()], 500);
            }
        } elseif ($action === 'stop') {
            try {
                $this->commandRepository->setServer($server)->send('spark profiler stop');
                return response()->json([
                    'status' => 'stopping',
                    'message' => 'Stopping profiler and generating report link...',
                ]);
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Failed to stop profiler: ' . $e->getMessage()], 500);
            }
        } elseif ($action === 'cancel') {
            try {
                $this->commandRepository->setServer($server)->send('spark profiler cancel');
                return response()->json([
                    'status' => 'cancelled',
                    'message' => 'Profiler cancelled.',
                ]);
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Failed to cancel profiler: ' . $e->getMessage()], 500);
            }
        }

        return response()->json(['error' => 'Invalid profiler action.'], 400);
    }

    /**
     * Trigger quick diagnostic command.
     */
    public function command(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $type = (string) $request->input('type', 'health');

        $command = match ($type) {
            'health' => 'spark health --memory',
            'tps' => 'spark tps',
            'heapsummary' => 'spark heapsummary',
            'ping' => 'spark ping',
            'tickmonitoring' => 'spark tickmonitoring',
            'sample' => 'spark tps',
            default => 'spark health',
        };

        try {
            $this->commandRepository->setServer($server)->send($command);
            return response()->json([
                'status' => 'sent',
                'command' => $command,
                'message' => "Executed command: /{$command}",
            ]);
        } catch (\Throwable $e) {
            // Fallback for tps on non-spark servers
            if ($type === 'tps' || $type === 'sample') {
                try {
                    $this->commandRepository->setServer($server)->send('tps');
                    return response()->json([
                        'status' => 'sent',
                        'command' => 'tps',
                        'message' => 'Executed command: /tps',
                    ]);
                } catch (\Throwable) {}
            }
            return response()->json(['error' => 'Server must be online to execute command.'], 500);
        }
    }

    /**
     * Get saved reports history.
     */
    public function getReports(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        $reports = Cache::get("server:{$server->id}:spark_reports", []);
        return response()->json(['reports' => array_values($reports)]);
    }

    /**
     * Save a generated Spark profile report URL.
     */
    public function saveReport(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        $url = trim((string) $request->input('url'));
        if (!preg_match('/^https?:\/\/spark\.lucko\.me\/([a-zA-Z0-9_-]+)/i', $url, $m)) {
            return response()->json(['error' => 'Invalid Spark viewer URL.'], 400);
        }

        $reportId = $m[1];
        $canonicalUrl = "https://spark.lucko.me/{$reportId}";
        $label = trim((string) $request->input('label', 'Spark Profile'));
        $mode = (string) $request->input('mode', 'cpu');

        $reports = Cache::get("server:{$server->id}:spark_reports", []);

        $newReport = [
            'id' => $reportId,
            'url' => $canonicalUrl,
            'label' => $label,
            'mode' => $mode,
            'created_at' => Carbon::now()->toIso8601String(),
        ];

        // Deduplicate and prepend
        $filtered = array_filter($reports, fn($r) => ($r['id'] ?? '') !== $reportId);
        array_unshift($filtered, $newReport);
        // Keep max 25 reports
        $filtered = array_slice($filtered, 0, 25);

        Cache::put("server:{$server->id}:spark_reports", $filtered, 86400 * 30);

        return response()->json([
            'status' => 'success',
            'report' => $newReport,
            'reports' => array_values($filtered),
        ]);
    }

    /**
     * Delete a saved report from history.
     */
    public function deleteReport(Request $request, Server $server, string $id): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        $reports = Cache::get("server:{$server->id}:spark_reports", []);
        $filtered = array_filter($reports, fn($r) => ($r['id'] ?? '') !== $id);

        Cache::put("server:{$server->id}:spark_reports", array_values($filtered), 86400 * 30);

        return response()->json([
            'status' => 'success',
            'reports' => array_values($filtered),
        ]);
    }
}
