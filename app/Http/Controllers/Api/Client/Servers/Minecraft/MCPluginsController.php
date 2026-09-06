<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Minecraft;

use GuzzleHttp\Client;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\MCPluginsConfig;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class MCPluginsController extends ClientApiController
{
    protected array $httpClients;

    public function __construct(private DaemonFileRepository $fileRepository)
    {
        parent::__construct();

        $apiKey = null;
        try {
            $apiKey = MCPluginsConfig::first()?->curseforge_api_key;
        } catch (\Throwable) {}

        $this->httpClients = [
            'modrinth' => new Client(['base_uri' => 'https://api.modrinth.com/v2/']),
            'curseforge' => new Client([
                'base_uri' => 'https://api.curseforge.com/v1/',
                'headers' => ['X-API-Key' => $apiKey ?? ''],
            ]),
            'spigotmc' => new Client(['base_uri' => 'https://api.spiget.org/v2/']),
            'hangar' => new Client(['base_uri' => 'https://hangar.papermc.io/api/v1/']),
        ];
    }

    /**
     * Return plugin settings and restrictions.
     */
    public function settings(Request $request): JsonResponse
    {
        $settings = Cache::remember('mcplugins_settings', 300, function () {
            try {
                return MCPluginsConfig::first();
            } catch (\Throwable) {
                return null;
            }
        });

        $serverRef = $request->query('server');
        if ($serverRef) {
            $server = Server::where('uuidShort', $serverRef)->orWhere('uuid', $serverRef)->first();
            if ($server && !$server->isMinecraft()) {
                return response()->json(['restricted' => true]);
            }
        }

        return response()->json([
            'default_page_size' => $settings?->default_page_size ?? 6,
            'default_provider' => $settings?->default_provider ?? 'modrinth',
            'text_install_button' => $settings?->text_install_button,
            'text_versions_button' => $settings?->text_versions_button,
            'text_download_button' => $settings?->text_download_button,
            'text_search' => $settings?->text_search,
            'text_search_box' => $settings?->text_search_box,
            'text_version' => $settings?->text_version,
            'text_loader' => $settings?->text_loader,
            'text_sort_by' => $settings?->text_sort_by,
            'text_provider' => $settings?->text_provider,
            'text_page_size' => $settings?->text_page_size,
            'text_not_found' => $settings?->text_not_found,
            'text_showing' => $settings?->text_showing,
            'text_version_list' => $settings?->text_version_list,
            'text_versions_not_found' => $settings?->text_versions_not_found,
            'text_version_downloads' => $settings?->text_version_downloads,
            'text_redirect_url' => $settings?->text_redirect_url,
            'text_download_url' => $settings?->text_download_url,
            'text_install_success' => $settings?->text_install_success,
            'text_install_failed' => $settings?->text_install_failed,
        ]);
    }

    /**
     * Search and list plugins across providers.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }

        $provider = $request->query('provider', 'modrinth');
        $page = max(1, (int) $request->query('page', 1));
        $pageSize = max(1, (int) $request->query('page_size', 6));
        $searchQuery = (string) $request->query('search_query', '');
        $loader = (string) $request->query('loader', '');
        $sortBy = (string) $request->query('sort_by', '');
        $minecraftVersion = (string) $request->query('minecraft_version', '');

        if (!isset($this->httpClients[$provider])) {
            $provider = 'modrinth';
        }

        $url = $this->getUrl($provider, $page, $pageSize, $searchQuery, $loader, $sortBy, $minecraftVersion);
        $client = $this->httpClients[$provider];

        try {
            $response = $client->get($url);
            if ($response->getStatusCode() !== 200) {
                return response()->json(['status' => 'error', 'message' => 'Error fetching plugins from provider.'], 503);
            }

            $data = json_decode($response->getBody()->getContents(), true) ?: [];
            $pagination = $this->getPagination($provider, $data, $page, $pageSize);
            $formattedData = $this->formatResponse($provider, $data);

            return response()->json([
                'data' => $formattedData,
                'pagination' => $pagination,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error querying plugin provider: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get versions for a specific plugin.
     */
    public function versions(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }

        $provider = (string) $request->query('provider', 'modrinth');
        $pluginId = $request->query('pluginId');

        if (!$pluginId || !isset($this->httpClients[$provider])) {
            return response()->json(['data' => []]);
        }

        $url = match ($provider) {
            'modrinth' => "project/{$pluginId}/version",
            'curseforge' => "mods/{$pluginId}/files",
            'spigotmc' => "resources/{$pluginId}/versions?sort=-releaseDate",
            'hangar' => "projects/{$pluginId}/versions",
        };

        try {
            $response = $this->httpClients[$provider]->get($url);
            if ($response->getStatusCode() !== 200) {
                return response()->json(['status' => 'error', 'message' => 'Error fetching versions.'], 503);
            }

            $data = json_decode($response->getBody()->getContents(), true) ?: [];
            $formattedData = $this->formatVersionsResponse($provider, $data);

            return response()->json(['data' => $formattedData]);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Install a plugin version to the server's /plugins or /mods directory.
     */
    public function install(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }

        $provider = (string) $request->input('provider');
        $pluginId = (string) $request->input('pluginId');
        $versionId = $request->input('versionId');
        $directory = (string) $request->input('directory', '/plugins');

        if (!in_array($directory, ['/plugins', '/mods'], true)) {
            $directory = '/plugins';
        }

        try {
            $data = $this->fetchPluginData($provider, $pluginId, $versionId);

            if ($provider === 'spigotmc' && isset($data['pluginFileContent'])) {
                $filePath = rtrim($directory, '/') . '/' . $data['pluginName'];
                $this->fileRepository->setServer($server)->putContent($filePath, $data['pluginFileContent']);
            } else {
                $this->fileRepository->setServer($server)->pull(
                    $data['pluginFileUrl'],
                    $directory,
                    ['use_header' => true, 'foreground' => true]
                );
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Plugin installed successfully.',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Installation failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function getUrl(string $provider, int $page, int $pageSize, string $searchQuery, string $loader, string $sortBy, string $minecraftVersion): string
    {
        $offset = ($page - 1) * $pageSize;

        return match ($provider) {
            'modrinth' => $this->getModrinthUrl($pageSize, $searchQuery, $sortBy, $offset, $loader, $minecraftVersion),
            'curseforge' => $this->getCurseForgeUrl($pageSize, $searchQuery, $sortBy, $offset, $loader, $minecraftVersion),
            'hangar' => $this->getHangarUrl($pageSize, $offset, $searchQuery, $sortBy, $minecraftVersion),
            'spigotmc' => $this->getSpigotmcUrl($pageSize, $page, $searchQuery, $sortBy),
        };
    }

    private function getModrinthUrl(int $pageSize, string $searchQuery, string $sortBy, int $offset, string $loader, string $minecraftVersion): string
    {
        $serverLoaders = ['paper', 'spigot', 'bukkit', 'purpur', 'bungeecord', 'velocity', 'waterfall', 'folia'];
        $modLoaders = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader'];

        $facets = [];
        if ($loader) {
            $facets[] = ["categories:{$loader}"];
        }
        if (in_array($loader, $serverLoaders)) {
            $facets[] = ['project_type:plugin'];
        } elseif (in_array($loader, $modLoaders)) {
            $facets[] = ['project_type:mod'];
        }
        if ($minecraftVersion) {
            $facets[] = ["versions:{$minecraftVersion}"];
        }

        $facetParam = !empty($facets) ? '&facets=' . urlencode(json_encode($facets)) : '';
        return "search?limit={$pageSize}&query=" . urlencode($searchQuery) . "&index={$sortBy}&offset={$offset}" . $facetParam;
    }

    private function getCurseForgeUrl(int $pageSize, string $searchQuery, string $sortBy, int $offset, string $loader, string $minecraftVersion): string
    {
        $cfLoaderMap = ['fabric' => 4, 'forge' => 1, 'neoforge' => 6, 'quilt' => 5];
        $isPluginLoader = !array_key_exists($loader, $cfLoaderMap);

        $classId = $isPluginLoader ? 5 : 6;
        $loaderType = $isPluginLoader ? 0 : $cfLoaderMap[$loader];

        return "mods/search?gameId=432&classId={$classId}&pageSize={$pageSize}&index={$offset}&searchFilter=" . urlencode($searchQuery) . "&modLoaderType={$loaderType}&gameVersion=" . urlencode($minecraftVersion) . "&sortField={$sortBy}&sortOrder=desc";
    }

    private function getSpigotmcUrl(int $pageSize, int $page, string $searchQuery, string $sortBy): string
    {
        $url = $searchQuery ? 'search/resources/' . urlencode($searchQuery) : 'resources';
        return "{$url}?size={$pageSize}&page={$page}&sort={$sortBy}";
    }

    private function getHangarUrl(int $pageSize, int $offset, string $searchQuery, string $sortBy, string $minecraftVersion): string
    {
        $params = ['limit' => $pageSize, 'offset' => $offset, 'sort' => $sortBy];
        if ($minecraftVersion) $params['version'] = $minecraftVersion;
        if ($searchQuery) $params['query'] = $searchQuery;
        return 'projects?' . http_build_query($params);
    }

    private function getPagination(string $provider, array $data, int $page, int $pageSize): array
    {
        return match ($provider) {
            'modrinth' => [
                'total' => (int) ($data['total_hits'] ?? 0),
                'count' => count($data['hits'] ?? []),
                'per_page' => $pageSize,
                'current_page' => $page,
                'total_pages' => (int) ceil(($data['total_hits'] ?? 0) / $pageSize),
            ],
            'curseforge' => [
                'total' => (int) ($data['pagination']['totalCount'] ?? 0),
                'count' => (int) ($data['pagination']['resultCount'] ?? 0),
                'per_page' => $pageSize,
                'current_page' => $page,
                'total_pages' => (int) ceil(min((int) ($data['pagination']['totalCount'] ?? 0), 5000) / $pageSize),
            ],
            'hangar' => [
                'total' => (int) ($data['pagination']['count'] ?? 0),
                'count' => count($data['result'] ?? []),
                'per_page' => $pageSize,
                'current_page' => $page,
                'total_pages' => (int) ceil(($data['pagination']['count'] ?? 0) / $pageSize),
            ],
            'spigotmc' => [
                'total' => count($data) < $pageSize ? count($data) : 300,
                'count' => count($data),
                'per_page' => $pageSize,
                'current_page' => $page,
                'total_pages' => count($data) < $pageSize ? 1 : 50,
            ],
        };
    }

    private function formatResponse(string $provider, array $data): array
    {
        return match ($provider) {
            'modrinth' => array_map(fn($p) => [
                'provider' => 'modrinth',
                'id' => $p['project_id'],
                'name' => $p['title'],
                'description' => $p['description'],
                'icon' => $p['icon_url'],
                'downloads' => $p['downloads'] ?? 0,
                'url' => "https://modrinth.com/plugin/{$p['project_id']}",
                'installable' => true,
            ], $data['hits'] ?? []),
            'curseforge' => array_map(fn($p) => [
                'provider' => 'curseforge',
                'id' => $p['id'],
                'name' => $p['name'],
                'description' => $p['summary'] ?? '',
                'icon' => $p['logo']['url'] ?? null,
                'downloads' => $p['downloadCount'] ?? 0,
                'url' => "https://www.curseforge.com/minecraft/bukkit-plugins/{$p['slug']}",
                'installable' => true,
            ], $data['data'] ?? []),
            'spigotmc' => array_map(function ($p) {
                $installable = true;
                if (isset($p['file']['externalUrl']) && !str_ends_with($p['file']['externalUrl'], '.jar')) {
                    $installable = false;
                }
                if (!empty($p['premium'])) {
                    $installable = false;
                }
                return [
                    'provider' => 'spigotmc',
                    'id' => $p['id'],
                    'name' => $p['name'],
                    'description' => $p['tag'] ?? '',
                    'icon' => !empty($p['icon']['url']) ? "https://www.spigotmc.org/{$p['icon']['url']}" : null,
                    'downloads' => $p['downloads'] ?? 0,
                    'url' => "https://www.spigotmc.org/resources/{$p['id']}",
                    'installable' => $installable,
                ];
            }, is_array($data) ? $data : []),
            'hangar' => array_map(fn($p) => [
                'provider' => 'hangar',
                'id' => $p['name'],
                'name' => $p['name'],
                'description' => $p['description'] ?? '',
                'icon' => $p['avatarUrl'] ?? null,
                'downloads' => $p['stats']['downloads'] ?? 0,
                'url' => "https://hangar.papermc.io/{$p['namespace']['owner']}/{$p['name']}",
                'installable' => true,
            ], $data['result'] ?? []),
        };
    }

    private function formatVersionsResponse(string $provider, array $data): array
    {
        return match ($provider) {
            'modrinth' => array_map(fn($v) => [
                'provider' => $provider,
                'versionId' => $v['id'],
                'versionName' => $v['name'],
                'game_versions' => $v['game_versions'] ?? [],
                'loaders' => $v['loaders'] ?? [],
                'downloads' => ($v['downloads'] ?? 0) > 0 ? $v['downloads'] : null,
                'downloadUrl' => null,
            ], $data),
            'curseforge' => array_map(fn($v) => [
                'provider' => $provider,
                'versionId' => $v['id'],
                'versionName' => $v['displayName'] ?? '',
                'game_versions' => $v['gameVersions'] ?? [],
                'loaders' => null,
                'downloads' => ($v['downloadCount'] ?? 0) > 0 ? $v['downloadCount'] : null,
                'downloadUrl' => null,
            ], $data['data'] ?? []),
            'hangar' => $this->formatHangarVersions($data['result'] ?? [], $provider),
            'spigotmc' => array_map(fn($v) => [
                'provider' => $provider,
                'versionId' => $v['id'],
                'versionName' => $v['name'],
                'downloads' => $v['downloads'] ?? null,
                'game_versions' => null,
                'loaders' => null,
                'downloadUrl' => "https://www.spigotmc.org/resources/{$v['resource']}/download?version={$v['id']}",
            ], is_array($data) ? $data : []),
        };
    }

    private function formatHangarVersions(array $versions, string $provider): array
    {
        $uniqueVersions = [];
        foreach ($versions as $version) {
            $platforms = ['PAPER', 'WATERFALL', 'VELOCITY'];
            foreach ($platforms as $platform) {
                $downloads = $version['stats']['platformDownloads'][$platform] ?? 0;
                if ($downloads > 0) {
                    $key = ($version['name'] ?? '') . ' - ' . $platform;
                    if (!isset($uniqueVersions[$key])) {
                        $uniqueVersions[$key] = [
                            'provider' => $provider,
                            'versionId' => $key,
                            'versionName' => $key,
                            'downloads' => $downloads,
                            'game_versions' => null,
                            'loaders' => null,
                            'downloadUrl' => null,
                        ];
                    }
                }
            }
        }
        return array_values($uniqueVersions);
    }

    private function fetchPluginData(string $provider, string $pluginId, ?string $versionId): array
    {
        return match ($provider) {
            'modrinth' => $this->fetchModrinthData($pluginId, $versionId),
            'curseforge' => $this->fetchCurseForgeData($pluginId, $versionId),
            'hangar' => $this->fetchHangarData($pluginId, $versionId),
            'spigotmc' => $this->fetchSpigotmcData($pluginId),
            default => throw new \InvalidArgumentException('Unsupported plugin provider: ' . $provider),
        };
    }

    private function fetchModrinthData(string $pluginId, ?string $versionId): array
    {
        $client = $this->httpClients['modrinth'];
        $response = $client->get($versionId ? "version/{$versionId}" : "project/{$pluginId}/version");
        $data = json_decode($response->getBody()->getContents(), true);
        $file = $versionId ? ($data['files'][0] ?? null) : ($data[0]['files'][0] ?? null);

        if (!$file || empty($file['url'])) {
            throw new \RuntimeException('No downloadable file found on Modrinth.');
        }

        return ['pluginFileUrl' => $file['url'], 'pluginName' => $file['filename']];
    }

    private function fetchCurseForgeData(string $pluginId, ?string $versionId): array
    {
        $client = $this->httpClients['curseforge'];
        $response = $client->get($versionId ? "mods/{$pluginId}/files/{$versionId}" : "mods/{$pluginId}/files");
        $data = json_decode($response->getBody()->getContents(), true);
        $file = $versionId ? ($data['data'] ?? null) : ($data['data'][0] ?? null);

        if (!$file || empty($file['downloadUrl'])) {
            throw new \RuntimeException('No downloadable file found on CurseForge.');
        }

        return [
            'pluginFileUrl' => str_replace('edge', 'mediafiles', $file['downloadUrl']),
            'pluginName' => $file['fileName'],
        ];
    }

    private function fetchSpigotmcData(string $pluginId): array
    {
        $client = $this->httpClients['spigotmc'];
        $response = $client->get("resources/{$pluginId}");
        $plugin = json_decode($response->getBody()->getContents(), true);
        $externalUrl = $plugin['file']['externalUrl'] ?? null;
        $url = str_ends_with((string) $externalUrl, '.jar') ? $externalUrl : "https://cdn.spiget.org/file/spiget-resources/{$pluginId}.jar";

        $content = @file_get_contents($url);
        if ($content === false) {
            throw new \RuntimeException('Could not download file from SpigotMC.');
        }

        return [
            'pluginName' => ($plugin['name'] ?? 'plugin') . '.jar',
            'pluginFileContent' => $content,
        ];
    }

    private function fetchHangarData(string $pluginId, ?string $versionId): array
    {
        $client = $this->httpClients['hangar'];
        if ($versionId && str_contains($versionId, ' - ')) {
            [$versionNumber, $serverType] = explode(' - ', $versionId);
            $response = $client->get("projects/{$pluginId}/versions/{$versionNumber}");
            $data = json_decode($response->getBody()->getContents(), true);
            $pluginFileUrl = $data['downloads'][$serverType]['downloadUrl'] ?? ($data['downloads'][$serverType]['externalUrl'] ?? null);
            $pluginName = $data['downloads'][$serverType]['fileInfo']['name'] ?? 'plugin.jar';
        } else {
            $response = $client->get("projects/{$pluginId}/versions");
            $data = json_decode($response->getBody()->getContents(), true);
            $first = $data['result'][0] ?? null;
            $pluginFileUrl = $first['downloads']['PAPER']['downloadUrl'] ?? ($first['downloads']['PAPER']['externalUrl'] ?? null);
            $pluginName = $first['downloads']['PAPER']['fileInfo']['name'] ?? 'plugin.jar';
        }

        if (!$pluginFileUrl) {
            throw new \RuntimeException('No downloadable file found on Hangar.');
        }

        return ['pluginFileUrl' => $pluginFileUrl, 'pluginName' => $pluginName];
    }
}
