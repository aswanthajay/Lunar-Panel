<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Minecraft;

use ZipArchive;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class BedrockAddonsController extends ClientApiController
{
    public function __construct(private DaemonFileRepository $fileRepository)
    {
        parent::__construct();
    }

    /**
     * Get installed addons for the server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }

        $repo = $this->fileRepository->setServer($server);
        $world = $this->getActiveWorldName($repo);

        $activeBehaviors = collect($this->readJson($repo, "/worlds/{$world}/world_behavior_packs.json"))->keyBy('pack_id');
        $activeResources = collect($this->readJson($repo, "/worlds/{$world}/world_resource_packs.json"))->keyBy('pack_id');

        $packs = [];

        foreach (['behavior_packs' => 'behavior', 'resource_packs' => 'resource'] as $baseDir => $type) {
            try {
                $listing = $repo->getDirectory("/{$baseDir}");
            } catch (DaemonConnectionException) {
                continue;
            }

            $activeMap = $type === 'behavior' ? $activeBehaviors : $activeResources;

            foreach ($listing as $item) {
                if (!$this->isDirectory($item)) continue;
                $sub = $item['name'];

                if (!preg_match('/-[0-9a-f]{8}$/', $sub)) continue;

                try {
                    $manifestContent = $repo->getContent("/{$baseDir}/{$sub}/manifest.json");
                    $manifest = json_decode($manifestContent, true);
                } catch (DaemonConnectionException) {
                    continue;
                }

                if (!$manifest || !isset($manifest['header']['uuid'])) continue;

                $uuid = $manifest['header']['uuid'];

                $packs[] = [
                    'carpeta' => $sub,
                    'carpetaBase' => $baseDir,
                    'tipo' => $type,
                    'uuid' => $uuid,
                    'nombre' => $manifest['header']['name'] ?? $sub,
                    'descripcion' => $manifest['header']['description'] ?? '',
                    'version' => $manifest['header']['version'] ?? [1, 0, 0],
                    'activo' => $activeMap->has($uuid),
                ];
            }
        }

        return response()->json([
            'paquetes' => $packs,
            'mundo' => $world,
            'textos' => $this->getTexts(),
        ]);
    }

    /**
     * Upload and install an addon (.mcaddon, .mcpack, .zip).
     */
    public function upload(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }

        $file = $request->file('addon');
        if (!$file) {
            return response()->json(['error' => 'sin_archivo'], 400);
        }

        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, ['mcaddon', 'mcpack', 'zip'], true)) {
            return response()->json(['error' => 'formato'], 400);
        }

        if ($file->getSize() > 150 * 1024 * 1024) {
            return response()->json(['error' => 'demasiado_grande'], 413);
        }

        $zip = new ZipArchive();
        if ($zip->open($file->getRealPath()) !== true) {
            return response()->json(['error' => 'zip_invalido'], 400);
        }

        $realNames = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $original = $zip->getNameIndex($i);
            $normalized = str_replace('\\', '/', $original);
            $realNames[$normalized] = $original;
        }
        $normalizedNames = array_keys($realNames);

        $prefixes = [];
        foreach ($normalizedNames as $name) {
            if (basename($name) === 'manifest.json') {
                $prefix = dirname($name);
                $prefixes[] = $prefix === '.' ? '' : $prefix . '/';
            }
        }

        if (empty($prefixes)) {
            $zip->close();
            return response()->json(['error' => 'sin_manifest'], 422);
        }

        $sortedPrefixes = $prefixes;
        usort($sortedPrefixes, fn($a, $b) => strlen($b) <=> strlen($a));

        $byGroup = array_fill_keys($prefixes, []);
        foreach ($normalizedNames as $name) {
            if (str_ends_with($name, '/')) continue;

            foreach ($sortedPrefixes as $prefix) {
                if ($prefix === '' || str_starts_with($name, $prefix)) {
                    $byGroup[$prefix][] = $name;
                    break;
                }
            }
        }

        $repo = $this->fileRepository->setServer($server);
        $world = $this->getActiveWorldName($repo);
        $installed = [];
        $errors = [];

        foreach ($prefixes as $prefix) {
            $manifestRaw = preg_replace('/^\xEF\xBB\xBF/', '', $zip->getFromName($realNames[$prefix . 'manifest.json'] ?? '') ?: '');
            $manifest = json_decode($manifestRaw, true);

            if (!$manifest || !isset($manifest['header']['uuid'])) {
                $errors[] = $prefix ?: '(root)';
                continue;
            }

            $type = $this->getManifestType($manifest);
            if ($type === null) {
                $errors[] = $manifest['header']['name'] ?? ($prefix ?: '(root)');
                continue;
            }

            $baseDir = $type === 'behavior' ? 'behavior_packs' : 'resource_packs';
            $uuid = $manifest['header']['uuid'];
            $packName = $manifest['header']['name'] ?? 'addon';
            $destFolder = $this->getSafeFolderName($packName, $uuid);

            try {
                $this->installZipGroup($repo, $zip, $byGroup[$prefix] ?? [], $realNames, $prefix, $baseDir, $destFolder);
            } catch (\Throwable) {
                $errors[] = $packName;
                continue;
            }

            $jsonPath = "/worlds/{$world}/world_{$type}_packs.json";
            $list = $this->readJson($repo, $jsonPath);
            $list = array_values(array_filter($list, fn($p) => ($p['pack_id'] ?? null) !== $uuid));
            $list[] = ['pack_id' => $uuid, 'version' => $manifest['header']['version'] ?? [1, 0, 0]];
            $this->saveJson($repo, $jsonPath, $list);

            $installed[] = [
                'uuid' => $uuid,
                'nombre' => $packName,
                'tipo' => $type,
                'carpeta' => $destFolder,
            ];
        }

        $zip->close();

        if (empty($installed)) {
            return response()->json(['error' => 'sin_manifest', 'detalle' => $errors], 422);
        }

        return response()->json(['instalados' => $installed, 'errores' => $errors]);
    }

    /**
     * Toggle active status of an addon.
     */
    public function toggle(Request $request, Server $server, string $uuid): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_UPDATE, $server)) {
            throw new AuthorizationException();
        }

        $type = $request->input('tipo') === 'resource' ? 'resource' : 'behavior';
        $activate = (bool) $request->input('activo');
        $baseDir = $type === 'behavior' ? 'behavior_packs' : 'resource_packs';

        $repo = $this->fileRepository->setServer($server);
        $world = $this->getActiveWorldName($repo);
        $jsonPath = "/worlds/{$world}/world_{$type}_packs.json";
        $list = $this->readJson($repo, $jsonPath);
        $list = array_values(array_filter($list, fn($p) => ($p['pack_id'] ?? null) !== $uuid));

        if ($activate) {
            $version = [1, 0, 0];
            try {
                $listing = $repo->getDirectory("/{$baseDir}");
                foreach ($listing as $item) {
                    if (!$this->isDirectory($item)) continue;
                    $m = json_decode($repo->getContent("/{$baseDir}/{$item['name']}/manifest.json"), true);
                    if (($m['header']['uuid'] ?? null) === $uuid) {
                        $version = $m['header']['version'] ?? $version;
                        break;
                    }
                }
            } catch (\Throwable) {}

            $list[] = ['pack_id' => $uuid, 'version' => $version];
        }

        $this->saveJson($repo, $jsonPath, $list);

        return response()->json(['ok' => true]);
    }

    /**
     * Delete an addon and unregister from world.
     */
    public function delete(Request $request, Server $server, string $folder): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_DELETE, $server)) {
            throw new AuthorizationException();
        }

        $type = $request->query('tipo') === 'resource' ? 'resource' : 'behavior';
        $uuid = (string) $request->query('uuid');
        $baseDir = $type === 'behavior' ? 'behavior_packs' : 'resource_packs';

        $repo = $this->fileRepository->setServer($server);

        try {
            $repo->deleteFiles("/{$baseDir}", [$folder]);
        } catch (DaemonConnectionException) {
            return response()->json(['error' => 'sin_conexion'], 503);
        }

        if ($uuid) {
            $world = $this->getActiveWorldName($repo);
            $jsonPath = "/worlds/{$world}/world_{$type}_packs.json";
            $list = $this->readJson($repo, $jsonPath);
            $list = array_values(array_filter($list, fn($p) => ($p['pack_id'] ?? null) !== $uuid));
            $this->saveJson($repo, $jsonPath, $list);
        }

        return response()->json(['ok' => true]);
    }

    private function getActiveWorldName(DaemonFileRepository $repo): string
    {
        try {
            $content = $repo->getContent('/server.properties');
        } catch (\Throwable) {
            return 'Bedrock level';
        }

        foreach (preg_split('/\r\n|\r|\n/', $content) as $line) {
            $line = trim($line);
            if (str_starts_with($line, 'level-name=')) {
                $val = trim(substr($line, strlen('level-name=')));
                return $val !== '' ? $val : 'Bedrock level';
            }
        }

        return 'Bedrock level';
    }

    private function readJson(DaemonFileRepository $repo, string $path): array
    {
        try {
            $raw = $repo->getContent($path);
        } catch (\Throwable) {
            return [];
        }

        $raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
        $data = json_decode($raw, true);

        return is_array($data) ? $data : [];
    }

    private function saveJson(DaemonFileRepository $repo, string $path, array $data): void
    {
        $repo->putContent($path, json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    private function isDirectory(array $item): bool
    {
        if (array_key_exists('directory', $item)) return (bool) $item['directory'];
        if (array_key_exists('is_file', $item)) return !$item['is_file'];
        if (array_key_exists('file', $item)) return !$item['file'];
        return false;
    }

    private function getManifestType(array $manifest): ?string
    {
        $types = array_column($manifest['modules'] ?? [], 'type');
        if (in_array('resources', $types, true)) return 'resource';
        if (array_intersect($types, ['data', 'javascript', 'script'])) return 'behavior';
        return null;
    }

    private function getSafeFolderName(string $name, string $uuid): string
    {
        $clean = preg_replace('/[^a-zA-Z0-9_-]+/', '-', trim($name));
        $clean = trim($clean, '-');
        if ($clean === '') $clean = 'addon';

        return substr($clean, 0, 40) . '-' . substr($uuid, 0, 8);
    }

    private function installZipGroup(
        DaemonFileRepository $repo,
        ZipArchive $origin,
        array $files,
        array $realNames,
        string $prefix,
        string $baseDir,
        string $destFolder
    ): void {
        $tmp = tempnam(sys_get_temp_dir(), 'ba_');
        $zipTemp = new ZipArchive();
        $zipTemp->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        foreach ($files as $entryName) {
            $relative = $prefix === '' ? $entryName : substr($entryName, strlen($prefix));
            if ($relative === '') continue;

            $content = $origin->getFromName($realNames[$entryName] ?? $entryName);
            if ($content === false) continue;

            $zipTemp->addFromString("{$destFolder}/{$relative}", $content);
        }

        $zipTemp->close();
        $bytes = file_get_contents($tmp);
        @unlink($tmp);

        $remoteName = $destFolder . '.zip';
        $repo->putContent("/{$baseDir}/{$remoteName}", $bytes);

        try {
            $repo->decompressFile("/{$baseDir}", $remoteName);
        } finally {
            try {
                $repo->deleteFiles("/{$baseDir}", [$remoteName]);
            } catch (\Throwable) {}
        }
    }

    private function getTexts(): array
    {
        return [
            'title' => 'Bedrock Addons',
            'world' => 'Active world',
            'upload_title' => 'Install an addon',
            'upload_help' => 'Drop a .mcaddon or .mcpack file, or click to choose one.',
            'upload_btn' => 'Choose file',
            'uploading' => 'Installing…',
            'installed_title' => 'Installed Addons',
            'installed_empty' => 'No addons installed yet.',
            'type_behavior' => 'Behavior pack',
            'type_resource' => 'Resource pack',
            'active' => 'Active',
            'inactive' => 'Inactive',
            'btn_activate' => 'Activate',
            'btn_deactivate' => 'Deactivate',
            'btn_delete' => 'Delete',
            'deleting' => 'Deleting…',
            'confirm_delete_title' => 'Delete this addon?',
            'confirm_delete_body' => 'This removes {name} from the server. Players will lose it next time they join.',
            'confirm_yes' => 'Yes, delete',
            'confirm_no' => 'Cancel',
            'done_install' => 'Installed {count} addon(s).',
            'done_partial' => '{ok} installed, {fail} failed. Check the file names below.',
            'err_format' => 'Only .mcaddon, .mcpack or .zip files are supported.',
            'err_too_big' => 'That file is too large (max 150MB).',
            'err_invalid_zip' => "Couldn't read that file as a zip.",
            'err_no_manifest' => "No manifest.json found inside — that doesn't look like a valid addon.",
            'err_unsupported' => 'Unsupported pack type (skin packs and world templates are not supported yet).',
            'err_offline' => 'Cannot reach the server right now. Try again in a few moments.',
            'err_generic' => 'Something went wrong. Try again.',
        ];
    }
}
