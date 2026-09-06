<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Minecraft;

use GuzzleHttp\Client;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Illuminate\Support\Facades\Cache;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class MCVersionController extends ClientApiController
{
    private Client $httpClient;

    public function __construct(private DaemonFileRepository $fileRepository)
    {
        parent::__construct();
        $this->httpClient = new Client([
            'timeout' => 15,
            'headers' => [
                'User-Agent' => 'StellarPanel/1.0 (Minecraft Version Manager)',
                'Accept' => 'application/json',
            ],
        ]);
    }

    /**
     * Inspect current server jar and root files.
     */
    public function current(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }

        // Determine configured startup jar
        $jarVariable = $server->variables()->where('env_variable', 'SERVER_JARFILE')->first();
        $configuredJar = $jarVariable?->server_value ?: ($jarVariable?->default_value ?: 'server.jar');

        $rootJars = [];
        $targetExists = false;
        $targetInfo = null;

        try {
            $directory = $this->fileRepository->setServer($server)->getDirectory('/');
            foreach ($directory as $entry) {
                if (($entry['file'] ?? false) && str_ends_with(strtolower($entry['name']), '.jar')) {
                    $item = [
                        'name' => $entry['name'],
                        'size' => $entry['size'] ?? 0,
                        'modified' => $entry['modified'] ?? null,
                        'is_target' => strtolower($entry['name']) === strtolower($configuredJar),
                    ];
                    $rootJars[] = $item;

                    if ($item['is_target']) {
                        $targetExists = true;
                        $targetInfo = $item;
                    }
                }
            }
        } catch (\Throwable $e) {
            // Root directory scan failed (server may be installing/unreachable)
        }

        return response()->json([
            'configured_jar' => $configuredJar,
            'target_exists' => $targetExists,
            'target_info' => $targetInfo,
            'root_jars' => $rootJars,
        ]);
    }

    /**
     * List supported server software engines.
     */
    public function software(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        $engines = [
            [
                'id' => 'paper',
                'name' => 'Paper',
                'category' => 'Plugin Server',
                'tagline' => 'High performance, active security patches and extensive Bukkit/Spigot plugin support.',
                'website' => 'https://papermc.io',
                'default' => true,
            ],
            [
                'id' => 'purpur',
                'name' => 'Purpur',
                'category' => 'Plugin Server',
                'tagline' => 'Drop-in Paper replacement designed for configurability and new fun gameplay mechanics.',
                'website' => 'https://purpurmc.org',
                'default' => false,
            ],
            [
                'id' => 'fabric',
                'name' => 'Fabric',
                'category' => 'Modded Server',
                'tagline' => 'Lightweight, modern and modular modding toolchain for Minecraft.',
                'website' => 'https://fabricmc.net',
                'default' => false,
            ],
            [
                'id' => 'folia',
                'name' => 'Folia',
                'category' => 'Multi-Threaded Server',
                'tagline' => 'Experimental PaperMC fork adding regional multi-threading to dedicated servers.',
                'website' => 'https://papermc.io/software/folia',
                'default' => false,
            ],
            [
                'id' => 'vanilla',
                'name' => 'Vanilla',
                'category' => 'Official Mojang',
                'tagline' => 'Official, unmodified Minecraft server software released directly by Mojang.',
                'website' => 'https://minecraft.net',
                'default' => false,
            ],
            [
                'id' => 'velocity',
                'name' => 'Velocity',
                'category' => 'Network Proxy',
                'tagline' => 'Next-generation, highly optimized Minecraft server proxy by PaperMC.',
                'website' => 'https://papermc.io/software/velocity',
                'default' => false,
            ],
            [
                'id' => 'waterfall',
                'name' => 'Waterfall',
                'category' => 'Network Proxy',
                'tagline' => 'BungeeCord proxy fork by PaperMC with performance and security improvements.',
                'website' => 'https://papermc.io/software/waterfall',
                'default' => false,
            ],
        ];

        return response()->json(['engines' => $engines]);
    }

    /**
     * List available versions for a given software engine.
     */
    public function versions(Request $request, Server $server, string $software): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }

        $versions = Cache::remember("mc_software_versions_{$software}", 300, function () use ($software) {
            return match ($software) {
                'paper', 'folia', 'velocity', 'waterfall' => $this->fetchPaperVersions($software),
                'purpur' => $this->fetchPurpurVersions(),
                'fabric' => $this->fetchFabricVersions(),
                'vanilla' => $this->fetchVanillaVersions(),
                default => throw new BadRequestHttpException("Unsupported server software: {$software}"),
            };
        });

        return response()->json([
            'software' => $software,
            'versions' => $versions,
        ]);
    }

    /**
     * Install / Deploy a server jar directly onto the server.
     */
    public function install(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }

        $software = strtolower((string) $request->input('software'));
        $version = (string) $request->input('version');
        $build = (string) $request->input('build', 'latest');
        $backupExisting = (bool) $request->input('backup_existing', true);
        $customFilename = trim((string) $request->input('target_filename', ''));

        // Determine destination jar name
        if ($customFilename && str_ends_with(strtolower($customFilename), '.jar')) {
            $targetFilename = basename($customFilename);
        } else {
            $jarVariable = $server->variables()->where('env_variable', 'SERVER_JARFILE')->first();
            $targetFilename = $jarVariable?->server_value ?: ($jarVariable?->default_value ?: 'server.jar');
        }

        if (!str_ends_with(strtolower($targetFilename), '.jar')) {
            $targetFilename .= '.jar';
        }

        // 1. Resolve download URL
        try {
            $downloadUrl = $this->resolveDownloadUrl($software, $version, $build);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to resolve download URL: ' . $e->getMessage(),
            ], 422);
        }

        // 2. Perform optional backup of existing jar
        $backupCreated = false;
        if ($backupExisting) {
            try {
                $directory = $this->fileRepository->setServer($server)->getDirectory('/');
                $exists = false;
                foreach ($directory as $entry) {
                    if (($entry['file'] ?? false) && strtolower($entry['name']) === strtolower($targetFilename)) {
                        $exists = true;
                        break;
                    }
                }

                if ($exists) {
                    $backupName = $targetFilename . '.bak';
                    $this->fileRepository->setServer($server)->renameFiles('/', [
                        ['from' => $targetFilename, 'to' => $backupName],
                    ]);
                    $backupCreated = true;
                }
            } catch (\Throwable) {
                // If backup rename fails, proceed with pulling new jar
            }
        }

        // 3. Pull binary from upstream
        try {
            $this->fileRepository->setServer($server)->pull($downloadUrl, '/', [
                'filename' => $targetFilename,
                'foreground' => true,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => "Successfully installed {$software} {$version} as {$targetFilename}.",
                'target_filename' => $targetFilename,
                'backup_created' => $backupCreated,
                'java_version' => self::getRecommendedJava($version),
            ]);
        } catch (\Throwable $e) {
            // If download failed and we backed up, try restoring previous jar
            if ($backupCreated) {
                try {
                    $this->fileRepository->setServer($server)->renameFiles('/', [
                        ['from' => $targetFilename . '.bak', 'to' => $targetFilename],
                    ]);
                } catch (\Throwable) {}
            }

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to download and write server jar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Resolve direct JAR download link based on software & version.
     */
    private function resolveDownloadUrl(string $software, string $version, string $build): string
    {
        return match ($software) {
            'paper', 'folia', 'velocity', 'waterfall' => $this->resolvePaperDownload($software, $version, $build),
            'purpur' => $this->resolvePurpurDownload($version, $build),
            'fabric' => $this->resolveFabricDownload($version, $build),
            'vanilla' => $this->resolveVanillaDownload($version),
            default => throw new \InvalidArgumentException("Unsupported software: {$software}"),
        };
    }

    /**
     * PaperMC v3 Fill API resolution.
     */
    private function fetchPaperVersions(string $project): array
    {
        $response = $this->httpClient->get("https://fill.papermc.io/v3/projects/{$project}");
        $data = json_decode($response->getBody()->getContents(), true) ?: [];
        $versionGroups = $data['versions'] ?? [];

        $result = [];
        foreach ($versionGroups as $group => $vers) {
            foreach ($vers as $v) {
                $result[] = [
                    'version' => $v,
                    'group' => $group,
                    'java_required' => self::getRecommendedJava($v),
                    'is_latest' => false,
                ];
            }
        }

        if (!empty($result)) {
            $result[0]['is_latest'] = true;
        }

        return $result;
    }

    private function resolvePaperDownload(string $project, string $version, string $build): string
    {
        // 1. If build is 'latest', inspect version to get latest build id
        if ($build === 'latest' || empty($build)) {
            $res = $this->httpClient->get("https://fill.papermc.io/v3/projects/{$project}/versions/{$version}");
            $data = json_decode($res->getBody()->getContents(), true) ?: [];
            $builds = $data['builds'] ?? [];
            if (empty($builds)) {
                throw new \RuntimeException("No builds available for {$project} {$version}");
            }
            $build = (string) $builds[0];
        }

        // 2. Fetch build details
        $res = $this->httpClient->get("https://fill.papermc.io/v3/projects/{$project}/versions/{$version}/builds/{$build}");
        $data = json_decode($res->getBody()->getContents(), true) ?: [];
        $downloads = $data['downloads'] ?? [];

        $downloadUrl = $downloads['server:default']['url']
            ?? ($downloads['application']['url']
            ?? ($downloads['server']['url'] ?? null));

        if (!$downloadUrl) {
            throw new \RuntimeException("No downloadable asset found for {$project} {$version} build {$build}");
        }

        return $downloadUrl;
    }

    /**
     * Purpur API resolution.
     */
    private function fetchPurpurVersions(): array
    {
        $response = $this->httpClient->get('https://api.purpurmc.org/v2/purpur');
        $data = json_decode($response->getBody()->getContents(), true) ?: [];
        $versions = array_reverse($data['versions'] ?? []);

        $result = [];
        foreach ($versions as $idx => $v) {
            $result[] = [
                'version' => $v,
                'group' => substr($v, 0, strrpos($v, '.') ?: strlen($v)),
                'java_required' => self::getRecommendedJava($v),
                'is_latest' => $idx === 0,
            ];
        }

        return $result;
    }

    private function resolvePurpurDownload(string $version, string $build): string
    {
        $buildTarget = ($build && $build !== 'latest') ? $build : 'latest';
        return "https://api.purpurmc.org/v2/purpur/{$version}/{$buildTarget}/download";
    }

    /**
     * Fabric Meta resolution.
     */
    private function fetchFabricVersions(): array
    {
        $response = $this->httpClient->get('https://meta.fabricmc.net/v2/versions/game');
        $data = json_decode($response->getBody()->getContents(), true) ?: [];

        $result = [];
        $first = true;
        foreach ($data as $entry) {
            if ($entry['stable'] ?? false) {
                $v = $entry['version'];
                $result[] = [
                    'version' => $v,
                    'group' => substr($v, 0, strrpos($v, '.') ?: strlen($v)),
                    'java_required' => self::getRecommendedJava($v),
                    'is_latest' => $first,
                ];
                $first = false;
            }
        }

        return $result;
    }

    private function resolveFabricDownload(string $gameVersion, string $loaderVersion): string
    {
        // Fetch latest stable loader if not supplied
        if (!$loaderVersion || $loaderVersion === 'latest') {
            $res = $this->httpClient->get('https://meta.fabricmc.net/v2/versions/loader');
            $loaders = json_decode($res->getBody()->getContents(), true) ?: [];
            $loaderVersion = $loaders[0]['version'] ?? '0.16.10';
        }

        // Fetch latest installer version
        $res = $this->httpClient->get('https://meta.fabricmc.net/v2/versions/installer');
        $installers = json_decode($res->getBody()->getContents(), true) ?: [];
        $installerVersion = '1.0.1';
        foreach ($installers as $inst) {
            if ($inst['stable'] ?? false) {
                $installerVersion = $inst['version'];
                break;
            }
        }

        return "https://meta.fabricmc.net/v2/versions/loader/{$gameVersion}/{$loaderVersion}/{$installerVersion}/server/jar";
    }

    /**
     * Mojang Vanilla version resolution.
     */
    private function fetchVanillaVersions(): array
    {
        $response = $this->httpClient->get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        $data = json_decode($response->getBody()->getContents(), true) ?: [];
        $versions = $data['versions'] ?? [];

        $result = [];
        $first = true;
        foreach ($versions as $entry) {
            if (($entry['type'] ?? '') === 'release') {
                $v = $entry['id'];
                $result[] = [
                    'version' => $v,
                    'group' => substr($v, 0, strrpos($v, '.') ?: strlen($v)),
                    'java_required' => self::getRecommendedJava($v),
                    'is_latest' => $first,
                    'manifest_url' => $entry['url'] ?? null,
                ];
                $first = false;
            }
        }

        return $result;
    }

    private function resolveVanillaDownload(string $version): string
    {
        $response = $this->httpClient->get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        $data = json_decode($response->getBody()->getContents(), true) ?: [];
        $versions = $data['versions'] ?? [];

        $versionManifestUrl = null;
        foreach ($versions as $v) {
            if ($v['id'] === $version) {
                $versionManifestUrl = $v['url'];
                break;
            }
        }

        if (!$versionManifestUrl) {
            throw new \RuntimeException("Could not find Mojang manifest for version {$version}");
        }

        $res = $this->httpClient->get($versionManifestUrl);
        $vData = json_decode($res->getBody()->getContents(), true) ?: [];
        $serverJarUrl = $vData['downloads']['server']['url'] ?? null;

        if (!$serverJarUrl) {
            throw new \RuntimeException("No dedicated server JAR available for Vanilla {$version}");
        }

        return $serverJarUrl;
    }

    /**
     * Determine recommended Java runtime based on Minecraft version.
     */
    public static function getRecommendedJava(string $version): int
    {
        if (preg_match('/^1\.(\d+)(?:\.(\d+))?/', $version, $matches)) {
            $minor = (int) $matches[1];
            $patch = isset($matches[2]) ? (int) $matches[2] : 0;

            if ($minor >= 21) return 21;
            if ($minor === 20 && $patch >= 5) return 21;
            if ($minor >= 17) return 17;
            if ($minor === 16) return 16;
            return 8; // 1.15 and older
        }

        return 21;
    }
}
