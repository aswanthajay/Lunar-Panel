<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Minecraft;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Repositories\Wings\DaemonCommandRepository;
use Pterodactyl\Repositories\Wings\DaemonPowerRepository;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class WorldManagerController extends ClientApiController
{
    public function __construct(
        private DaemonFileRepository $fileRepository,
        private DaemonCommandRepository $commandRepository,
        private DaemonPowerRepository $powerRepository
    ) {
        parent::__construct();
    }

    /**
     * List all worlds, active world, and world properties.
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
        $isBedrock = $server->isBedrock();
        $baseDir = $isBedrock ? '/worlds' : '/';

        $active = $this->getActiveWorld($repo);
        $worlds = $this->listWorlds($repo, $baseDir, $active);

        $props = [];
        try {
            $parsed = $this->parseProperties($repo->getContent('/server.properties'));
            foreach ($this->propertyDefinitions() as $k => $def) {
                $props[$k] = $parsed[$k] ?? $def['default'];
            }
        } catch (\Throwable) {
            foreach ($this->propertyDefinitions() as $k => $def) {
                $props[$k] = $def['default'];
            }
        }

        return response()->json([
            'active' => $active,
            'worlds' => $worlds,
            'bedrock' => $isBedrock,
            'properties' => $props,
            'i18n' => $this->getTexts(),
        ]);
    }

    /**
     * Read seed by querying server console.
     */
    public function seed(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        try {
            $this->commandRepository->setServer($server)->send('seed');
        } catch (\Throwable) {
            return response()->json(['error' => 'Server is offline.'], 409);
        }

        usleep(700_000);
        $log = $this->readLog($server);
        $seed = $this->extractSeed($log);

        if ($seed === null) {
            return response()->json(['error' => 'Could not read the seed. The server must be online.'], 502);
        }

        return response()->json(['seed' => $seed]);
    }

    /**
     * Activate or create a world.
     */
    public function activate(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_UPDATE, $server)) {
            throw new AuthorizationException();
        }

        $name = trim((string) $request->input('name'));
        if (!$this->isValidWorldName($name)) {
            return response()->json(['error' => 'Invalid world name.'], 400);
        }

        $repo = $this->fileRepository->setServer($server);
        $changes = ['level-name' => $name];

        $seed = trim((string) $request->input('seed', ''));
        if ($seed !== '') {
            if (!preg_match('/^-?[\w]{1,64}$/u', $seed)) {
                return response()->json(['error' => 'Invalid seed value.'], 400);
            }
            $changes['level-seed'] = $seed;
        }

        $levelType = trim((string) $request->input('level_type', ''));
        if ($levelType !== '') {
            $allowedTypes = ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified', 'minecraft:single_biome_surface'];
            if (in_array($levelType, $allowedTypes, true)) {
                $changes['level-type'] = $levelType;
            }
        }

        try {
            $this->updateProperties($repo, $changes);
        } catch (DaemonConnectionException) {
            return response()->json(['error' => 'Could not update server.properties.'], 502);
        }

        $restarted = false;
        if ($request->boolean('restart')) {
            try {
                $this->powerRepository->setServer($server)->send('restart');
                $restarted = true;
            } catch (\Throwable) {}
        }

        return response()->json(['ok' => true, 'restarted' => $restarted]);
    }

    /**
     * Update world configuration keys in server.properties.
     */
    public function properties(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_UPDATE, $server)) {
            throw new AuthorizationException();
        }

        $defs = $this->propertyDefinitions();
        $input = $request->input('properties', []);
        if (!is_array($input)) {
            return response()->json(['error' => 'Invalid properties payload.'], 400);
        }

        $changes = [];
        foreach ($input as $k => $v) {
            if (!isset($defs[$k])) continue;
            $val = $this->validatePropertyValue($defs[$k], $v);
            if ($val !== null) {
                $changes[$k] = $val;
            }
        }

        if (empty($changes)) {
            return response()->json(['error' => 'No valid properties to save.'], 400);
        }

        $repo = $this->fileRepository->setServer($server);

        try {
            $this->updateProperties($repo, $changes);
        } catch (DaemonConnectionException) {
            return response()->json(['error' => 'Could not write to server.properties.'], 502);
        }

        return response()->json(['ok' => true, 'saved' => $changes]);
    }

    /**
     * Restart the server to apply world changes.
     */
    public function restart(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_RESTART, $server)) {
            throw new AuthorizationException();
        }

        try {
            $this->powerRepository->setServer($server)->send('restart');
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Could not restart server: ' . $e->getMessage()], 502);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Change difficulty of the world.
     */
    public function difficulty(Request $request, Server $server, string $name): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $val = (string) $request->input('value');
        if (!in_array($val, ['peaceful', 'easy', 'normal', 'hard'], true)) {
            return response()->json(['error' => 'Invalid difficulty.'], 400);
        }

        try {
            $this->commandRepository->setServer($server)->send("difficulty {$val}");
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Could not send difficulty command to server.'], 409);
        }

        return response()->json(['ok' => true, 'value' => $val]);
    }

    /**
     * Delete / reset a world.
     */
    public function delete(Request $request, Server $server, string $name): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_DELETE, $server)) {
            throw new AuthorizationException();
        }

        if (!$this->isValidWorldName($name)) {
            return response()->json(['error' => 'Invalid world name.'], 400);
        }

        $repo = $this->fileRepository->setServer($server);
        $baseDir = $server->isBedrock() ? '/worlds' : '/';
        $active = $this->getActiveWorld($repo);

        if ($name === $active) {
            return response()->json(['error' => "Cannot delete the active world. Switch to another world first."], 409);
        }

        $targets = [$name];
        if (!$server->isBedrock()) {
            $targets[] = "{$name}_nether";
            $targets[] = "{$name}_the_end";
        }

        try {
            $repo->deleteFiles($baseDir, $targets);
        } catch (DaemonConnectionException) {
            return response()->json(['error' => 'Could not delete world files.'], 502);
        }

        return response()->json(['ok' => true]);
    }

    private function isValidWorldName(string $name): bool
    {
        $name = trim($name);
        if ($name === '' || mb_strlen($name) > 32) return false;
        if (str_contains($name, '..') || str_contains($name, '/') || str_contains($name, '\\')) return false;
        return (bool) preg_match('/^[\w .\-]+$/u', $name);
    }

    private function getActiveWorld(DaemonFileRepository $repo): string
    {
        try {
            $content = $repo->getContent('/server.properties');
        } catch (\Throwable) {
            return 'world';
        }

        foreach (preg_split('/\r\n|\r|\n/', $content) as $line) {
            $line = trim($line);
            if (str_starts_with($line, 'level-name=')) {
                $val = trim(substr($line, strlen('level-name=')));
                return $val !== '' ? $val : 'world';
            }
        }

        return 'world';
    }

    private function listWorlds(DaemonFileRepository $repo, string $base, string $active): array
    {
        try {
            $listing = $repo->getDirectory($base);
        } catch (\Throwable) {
            return [];
        }

        $worlds = [];

        foreach ($listing as $item) {
            if (!$this->isDirectory($item)) continue;
            $name = $item['name'] ?? null;
            if (!$name) continue;

            $path = rtrim($base, '/') . '/' . $name;

            try {
                $inside = $repo->getDirectory($path);
            } catch (\Throwable) {
                continue;
            }

            $levelDat = null;
            foreach ($inside as $sub) {
                if (($sub['name'] ?? '') === 'level.dat') {
                    $levelDat = $sub;
                    break;
                }
            }

            if (!$levelDat) continue;

            $worlds[] = [
                'name' => $name,
                'active' => $name === $active,
                'modified' => $levelDat['modified_at'] ?? ($item['modified_at'] ?? null),
            ];
        }

        return $this->groupDimensions($worlds);
    }

    private function groupDimensions(array $worlds): array
    {
        $byName = [];
        foreach ($worlds as $w) $byName[$w['name']] = true;

        $suffixes = ['_nether' => 'nether', '_the_end' => 'end'];
        $children = [];
        $isChild = [];

        foreach ($worlds as $w) {
            foreach ($suffixes as $suf => $type) {
                if (!str_ends_with($w['name'], $suf)) continue;
                $parent = substr($w['name'], 0, -strlen($suf));
                if ($parent === $w['name']) continue;
                if (!isset($byName[$parent])) continue;

                $children[$parent][] = ['type' => $type, 'name' => $w['name']];
                $isChild[$w['name']] = true;
                break;
            }
        }

        $result = [];
        foreach ($worlds as $w) {
            if (isset($isChild[$w['name']])) continue;
            $w['dimensions'] = $children[$w['name']] ?? [];
            $result[] = $w;
        }

        usort($result, function ($a, $b) {
            if ($a['active'] !== $b['active']) return $a['active'] ? -1 : 1;
            return strcasecmp($a['name'], $b['name']);
        });

        return $result;
    }

    private function parseProperties(string $content): array
    {
        $data = [];
        foreach (preg_split('/\r\n|\r|\n/', $content) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) continue;
            $pos = strpos($line, '=');
            if ($pos === false) continue;
            $data[substr($line, 0, $pos)] = substr($line, $pos + 1);
        }
        return $data;
    }

    private function updateProperties(DaemonFileRepository $repo, array $changes): void
    {
        try {
            $content = $repo->getContent('/server.properties');
        } catch (\Throwable) {
            $content = '';
        }

        $lines = $content === '' ? [] : preg_split('/\r\n|\r|\n/', $content);
        $pending = $changes;

        foreach ($lines as $i => $line) {
            $clean = trim($line);
            foreach ($pending as $k => $v) {
                if (str_starts_with($clean, $k . '=')) {
                    $lines[$i] = $k . '=' . $v;
                    unset($pending[$k]);
                    break;
                }
            }
        }

        foreach ($pending as $k => $v) {
            $lines[] = $k . '=' . $v;
        }

        $repo->putContent('/server.properties', implode("\n", $lines) . "\n");
    }

    private function propertyDefinitions(): array
    {
        return [
            'gamemode' => ['type' => 'select', 'default' => 'survival', 'options' => ['survival', 'creative', 'adventure', 'spectator']],
            'force-gamemode' => ['type' => 'bool', 'default' => 'false'],
            'hardcore' => ['type' => 'bool', 'default' => 'false'],
            'pvp' => ['type' => 'bool', 'default' => 'true'],
            'spawn-protection' => ['type' => 'int', 'default' => '16', 'min' => 0, 'max' => 1000],
            'generate-structures' => ['type' => 'bool', 'default' => 'true'],
            'allow-nether' => ['type' => 'bool', 'default' => 'true'],
            'spawn-animals' => ['type' => 'bool', 'default' => 'true'],
            'spawn-monsters' => ['type' => 'bool', 'default' => 'true'],
            'spawn-npcs' => ['type' => 'bool', 'default' => 'true'],
            'view-distance' => ['type' => 'int', 'default' => '10', 'min' => 3, 'max' => 32],
            'simulation-distance' => ['type' => 'int', 'default' => '10', 'min' => 3, 'max' => 32],
            'max-world-size' => ['type' => 'int', 'default' => '29999984', 'min' => 1, 'max' => 29999984],
        ];
    }

    private function validatePropertyValue(array $def, $val): ?string
    {
        if ($def['type'] === 'bool') {
            if ($val === true || $val === 'true') return 'true';
            if ($val === false || $val === 'false') return 'false';
            return null;
        }
        if ($def['type'] === 'int') {
            if (!is_numeric($val)) return null;
            $n = (int) $val;
            if ($n < $def['min'] || $n > $def['max']) return null;
            return (string) $n;
        }
        if ($def['type'] === 'select') {
            return in_array($val, $def['options'], true) ? $val : null;
        }
        return null;
    }

    private function isDirectory(array $item): bool
    {
        if (array_key_exists('directory', $item)) return (bool) $item['directory'];
        if (array_key_exists('is_file', $item)) return !$item['is_file'];
        if (array_key_exists('file', $item)) return !$item['file'];
        return false;
    }

    private function extractSeed(string $log): ?string
    {
        foreach (array_reverse(preg_split('/\r?\n/', $log)) as $line) {
            $clean = preg_replace('/\x1b\[[0-9;]*m/', '', $line);
            if (preg_match('/seed:?\s*(?:is)?\s*\[?(-?\d+)\]?/i', $clean, $m)) {
                return $m[1];
            }
        }
        return null;
    }

    private function readLog(Server $server): string
    {
        $node = $server->node;
        $token = $node->daemon_token ?? $node->daemonSecret ?? null;
        if ($token && str_starts_with($token, 'eyJpdiI6')) {
            try {
                $token = decrypt($token);
            } catch (\Throwable) {}
        }

        $url = sprintf('%s://%s:%d/api/servers/%s/logs', $node->scheme, $node->fqdn, $node->daemonListen, $server->uuid);

        try {
            $res = Http::withToken($token)->timeout(6)->get($url);
            if ($res->successful()) {
                $data = $res->json()['data'] ?? [];
                return is_array($data) ? implode("\n", $data) : (string) $data;
            }
        } catch (\Throwable) {}

        return '';
    }

    private function getTexts(): array
    {
        return [
            'title' => 'Worlds',
            'loading' => 'Loading worlds…',
            'refresh' => 'Refresh',
            'active_world' => 'Active world',
            'seed_label' => 'Seed',
            'seed_btn' => 'Reveal Seed',
            'seed_loading' => 'Asking server…',
            'seed_error' => 'Could not read seed. The server must be online.',
            'worlds_title' => 'Worlds on this server',
            'worlds_empty' => 'No worlds detected yet.',
            'badge_active' => 'Active',
            'btn_use' => 'Switch to this world',
            'btn_delete' => 'Delete',
            'using' => 'Switching…',
            'deleting' => 'Deleting…',
            'use_done' => '{world} is now the active world.',
            'restart_needed' => 'Restart the server to load it.',
            'restart_now' => 'Restart now',
            'restarting' => 'Restarting…',
            'restart_done' => 'Server is restarting.',
            'delete_confirm_title' => 'Delete {world}',
            'delete_confirm_sub' => 'This permanently deletes the world directory.',
            'delete_confirm_type' => 'Type',
            'delete_confirm_post' => 'to confirm:',
            'delete_done' => '{world} has been deleted.',
            'cancel' => 'Cancel',
            'create_title' => 'Create a new world',
            'create_sub' => 'Choose a name. The world will generate on server boot.',
            'create_placeholder' => 'World name',
            'create_btn' => 'Create & Activate',
            'create_btn_loading' => 'Creating…',
            'name_taken' => 'A world with that name already exists.',
            'err_invalid_name' => 'Invalid world name.',
            'err_generic' => 'Something went wrong.',
            'no_server' => 'Could not identify server.',
            'properties_btn' => 'World Properties',
            'properties_hide' => 'Hide Properties',
            'difficulty_label' => 'Difficulty',
            'difficulty_note' => 'Applies in-game to active world.',
            'difficulty_peaceful' => 'Peaceful',
            'difficulty_easy' => 'Easy',
            'difficulty_normal' => 'Normal',
            'difficulty_hard' => 'Hard',
            'difficulty_applying' => 'Updating…',
            'difficulty_done' => 'Difficulty set to {value}.',
            'difficulty_error' => 'Could not change difficulty.',
            'server_props_title' => 'World Settings (server.properties)',
            'server_props_note' => 'These settings apply globally to the server. A restart is required to take effect.',
            'prop_gamemode' => 'Default game mode',
            'prop_force_gamemode' => 'Force game mode on join',
            'prop_hardcore' => 'Hardcore mode',
            'prop_pvp' => 'Player versus Player (PVP)',
            'prop_spawn_protection' => 'Spawn protection radius',
            'prop_generate_structures' => 'Generate structures (villages, dungeons)',
            'prop_allow_nether' => 'Allow Nether dimension',
            'prop_spawn_animals' => 'Spawn passive animals',
            'prop_spawn_monsters' => 'Spawn hostile monsters',
            'prop_spawn_npcs' => 'Spawn villagers',
            'prop_view_distance' => 'View distance (chunks)',
            'prop_simulation_distance' => 'Simulation distance (chunks)',
            'prop_max_world_size' => 'Max world size (radius)',
            'gamemode_survival' => 'Survival',
            'gamemode_creative' => 'Creative',
            'gamemode_adventure' => 'Adventure',
            'gamemode_spectator' => 'Spectator',
            'save_changes' => 'Save Settings',
            'saving' => 'Saving…',
            'props_saved' => 'Settings saved. Restart server to apply.',
            'create_seed_label' => 'Seed (optional)',
            'create_seed_placeholder' => 'Leave blank for random generation',
            'create_type_label' => 'World Type',
            'create_type_note' => 'Determines generator terrain.',
            'type_normal' => 'Default',
            'type_flat' => 'Superflat',
            'type_large_biomes' => 'Large Biomes',
            'type_amplified' => 'Amplified',
            'type_single_biome' => 'Single Biome',
        ];
    }
}
