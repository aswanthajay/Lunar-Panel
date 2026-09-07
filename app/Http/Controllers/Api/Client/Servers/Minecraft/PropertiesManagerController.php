<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Minecraft;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Repositories\Wings\DaemonPowerRepository;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class PropertiesManagerController extends ClientApiController
{
    public function __construct(
        private DaemonFileRepository $fileRepository,
        private DaemonPowerRepository $powerRepository
    ) {
        parent::__construct();
    }

    /**
     * Get all parsed server.properties, definitions metadata, and raw content.
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
        $fileExists = true;

        try {
            $raw = $repo->getContent('/server.properties');
        } catch (\Throwable) {
            $raw = $this->getDefaultPropertiesTemplate();
            $fileExists = false;
        }

        $properties = $this->parseProperties($raw);
        $definitions = $this->getPropertyDefinitions();

        return response()->json([
            'success' => true,
            'file_exists' => $fileExists,
            'is_bedrock' => $server->isBedrock(),
            'properties' => $properties,
            'definitions' => $definitions,
            'raw' => $raw,
        ]);
    }

    /**
     * Update individual key-value properties while preserving file comments.
     */
    public function save(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_UPDATE, $server)) {
            throw new AuthorizationException();
        }

        $updates = $request->input('properties', []);
        $restart = $request->boolean('restart_server', false);

        if (!is_array($updates)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid properties payload.',
            ], 422);
        }

        $repo = $this->fileRepository->setServer($server);

        try {
            $raw = $repo->getContent('/server.properties');
        } catch (\Throwable) {
            $raw = $this->getDefaultPropertiesTemplate();
        }

        $mergedRaw = $this->mergeProperties($raw, $updates);
        $repo->putContent('/server.properties', $mergedRaw);

        $restarted = false;
        if ($restart) {
            try {
                if ($request->user()->can(Permission::ACTION_CONTROL_RESTART, $server)) {
                    $this->powerRepository->setServer($server)->send('restart');
                    $restarted = true;
                }
            } catch (\Throwable) {}
        }

        return response()->json([
            'success' => true,
            'message' => $restarted
                ? 'Server properties saved. Server is restarting to apply changes!'
                : 'Server properties saved successfully. Restart the server to apply changes.',
            'restarted' => $restarted,
            'properties' => $this->parseProperties($mergedRaw),
            'raw' => $mergedRaw,
        ]);
    }

    /**
     * Save the entire raw file content directly.
     */
    public function saveRaw(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_UPDATE, $server)) {
            throw new AuthorizationException();
        }

        $content = $request->input('content', '');
        $restart = $request->boolean('restart_server', false);

        $repo = $this->fileRepository->setServer($server);
        $repo->putContent('/server.properties', $content);

        $restarted = false;
        if ($restart) {
            try {
                if ($request->user()->can(Permission::ACTION_CONTROL_RESTART, $server)) {
                    $this->powerRepository->setServer($server)->send('restart');
                    $restarted = true;
                }
            } catch (\Throwable) {}
        }

        return response()->json([
            'success' => true,
            'message' => $restarted
                ? 'Raw properties updated. Server is restarting to apply changes!'
                : 'Raw properties updated successfully. Restart the server to apply changes.',
            'restarted' => $restarted,
            'properties' => $this->parseProperties($content),
            'raw' => $content,
        ]);
    }

    /**
     * Parse raw server.properties text into key => value array.
     */
    private function parseProperties(string $content): array
    {
        $properties = [];
        $lines = preg_split('/\r\n|\r|\n/', $content);

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $pos = strpos($line, '=');
            if ($pos !== false) {
                $key = trim(substr($line, 0, $pos));
                $val = trim(substr($line, $pos + 1));
                $properties[$key] = $val;
            }
        }

        return $properties;
    }

    /**
     * Merge updated key-values into existing content while keeping comments and order.
     */
    private function mergeProperties(string $originalContent, array $updates): string
    {
        $lines = preg_split('/\r\n|\r|\n/', $originalContent);
        $pending = $updates;

        foreach ($lines as $i => $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            $pos = strpos($trimmed, '=');
            if ($pos !== false) {
                $key = trim(substr($trimmed, 0, $pos));
                if (array_key_exists($key, $pending)) {
                    $val = is_bool($pending[$key]) ? ($pending[$key] ? 'true' : 'false') : (string) $pending[$key];
                    $lines[$i] = "{$key}={$val}";
                    unset($pending[$key]);
                }
            }
        }

        // Append any brand new properties that were not present in original file
        foreach ($pending as $key => $val) {
            $strVal = is_bool($val) ? ($val ? 'true' : 'false') : (string) $val;
            $lines[] = "{$key}={$strVal}";
        }

        return implode("\n", $lines) . "\n";
    }

    /**
     * Return default template if server.properties doesn't exist yet.
     */
    private function getDefaultPropertiesTemplate(): string
    {
        return <<<'PROPS'
#Minecraft server properties
#Generated by Lunar Panel
enable-jmx-monitoring=false
rcon.port=25575
level-seed=
gamemode=survival
enable-command-block=false
enable-query=false
generator-settings={}
enforce-secure-profile=true
level-name=world
motd=A Minecraft Server - Powered by Lunar Panel
query.port=25565
pvp=true
generate-structures=true
max-chained-neighbor-updates=1000000
difficulty=easy
network-compression-threshold=256
max-tick-time=60000
require-resource-pack=false
use-native-transport=true
max-players=20
online-mode=true
enable-status=true
allow-flight=false
broadcast-rcon-to-ops=true
view-distance=10
server-ip=
resource-pack-prompt=
allow-nether=true
server-port=25565
enable-rcon=false
sync-chunk-writes=true
op-permission-level=4
prevent-proxy-connections=false
hide-online-players=false
resource-pack=
entity-broadcast-range-percentage=100
simulation-distance=10
rcon.password=
player-idle-timeout=0
force-gamemode=false
rate-limit=0
hardcore=false
white-list=false
broadcast-console-to-ops=true
spawn-npcs=true
spawn-animals=true
log-ips=true
function-permission-level=2
level-type=minecraft\:normal
spawn-monsters=true
enforce-whitelist=false
spawn-protection=16
resource-pack-sha1=
max-world-size=29999984
PROPS;
    }

    /**
     * Detailed metadata definitions for all standard properties.
     */
    private function getPropertyDefinitions(): array
    {
        return [
            // Category: Core / Quick Setup
            'online-mode' => [
                'category' => 'quick',
                'label' => 'Online Mode (Cracked vs Official)',
                'description' => 'When disabled, players with offline/cracked accounts (e.g. TLauncher, cracked launchers) can join. When enabled, only official Mojang/Microsoft accounts can connect.',
                'type' => 'bool',
                'default' => 'true',
            ],
            'max-players' => [
                'category' => 'quick',
                'label' => 'Maximum Players',
                'description' => 'The maximum number of simultaneous players that can join your server.',
                'type' => 'int',
                'min' => 1,
                'max' => 10000,
                'default' => '20',
            ],
            'white-list' => [
                'category' => 'quick',
                'label' => 'Server Whitelist',
                'description' => 'When enabled, only players added to the whitelist can join.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'enforce-whitelist' => [
                'category' => 'quick',
                'label' => 'Enforce Whitelist',
                'description' => 'Kick currently connected players immediately if they are removed from the whitelist.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'motd' => [
                'category' => 'quick',
                'label' => 'Server MOTD (Message of the Day)',
                'description' => 'Displayed in the in-game multiplayer server browser list. Supports Minecraft color formatting (§ and &).',
                'type' => 'string',
                'default' => 'A Minecraft Server',
            ],

            // Category: Gameplay
            'gamemode' => [
                'category' => 'gameplay',
                'label' => 'Default Game Mode',
                'description' => 'The default game mode assigned to newly joining players.',
                'type' => 'select',
                'options' => ['survival', 'creative', 'adventure', 'spectator'],
                'default' => 'survival',
            ],
            'force-gamemode' => [
                'category' => 'gameplay',
                'label' => 'Force Game Mode',
                'description' => 'Force players into the default game mode upon every join, even if changed previously.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'difficulty' => [
                'category' => 'gameplay',
                'label' => 'Game Difficulty',
                'description' => 'Controls hostile mob strength, hunger depletion, and survival mechanics.',
                'type' => 'select',
                'options' => ['peaceful', 'easy', 'normal', 'hard'],
                'default' => 'easy',
            ],
            'hardcore' => [
                'category' => 'gameplay',
                'label' => 'Hardcore Mode',
                'description' => 'Permanent death. Players are placed into spectator mode upon death and cannot respawn.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'pvp' => [
                'category' => 'gameplay',
                'label' => 'Player vs Player (PvP)',
                'description' => 'Enable or disable combat damage between players.',
                'type' => 'bool',
                'default' => 'true',
            ],
            'allow-flight' => [
                'category' => 'gameplay',
                'label' => 'Allow Flight',
                'description' => 'Allows players to fly in Survival mode (required by certain mods, jetpacks, and custom elytra plugins without kick).',
                'type' => 'bool',
                'default' => 'false',
            ],

            // Category: World & Spawning
            'level-name' => [
                'category' => 'world',
                'label' => 'World Folder Name',
                'description' => 'The directory name containing the active world save.',
                'type' => 'string',
                'default' => 'world',
            ],
            'level-seed' => [
                'category' => 'world',
                'label' => 'World Generation Seed',
                'description' => 'Seed for new world generation. Leave blank for a random seed.',
                'type' => 'string',
                'default' => '',
            ],
            'level-type' => [
                'category' => 'world',
                'label' => 'World Generator Type',
                'description' => 'Type of world generated by the engine.',
                'type' => 'select',
                'options' => ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified', 'minecraft:single_biome_surface'],
                'default' => 'minecraft:normal',
            ],
            'spawn-protection' => [
                'category' => 'world',
                'label' => 'Spawn Protection Radius',
                'description' => 'Radius in blocks around world spawn where non-OP players cannot place or break blocks.',
                'type' => 'int',
                'min' => 0,
                'max' => 1000,
                'default' => '16',
            ],
            'view-distance' => [
                'category' => 'world',
                'label' => 'View Distance (Chunks)',
                'description' => 'The render distance sent to players in chunks (radius). Lower values significantly boost performance.',
                'type' => 'int',
                'min' => 3,
                'max' => 32,
                'default' => '10',
            ],
            'simulation-distance' => [
                'category' => 'world',
                'label' => 'Simulation Distance (Chunks)',
                'description' => 'Radius of chunks around players that are actively ticked for entities, crop growth, and redstone.',
                'type' => 'int',
                'min' => 3,
                'max' => 32,
                'default' => '10',
            ],
            'allow-nether' => [
                'category' => 'world',
                'label' => 'Allow Nether Dimension',
                'description' => 'Enable or disable the Nether dimension and Nether portals.',
                'type' => 'bool',
                'default' => 'true',
            ],
            'generate-structures' => [
                'category' => 'world',
                'label' => 'Generate Structures',
                'description' => 'Generate villages, strongholds, mineshafts, temples, and dungeons.',
                'type' => 'bool',
                'default' => 'true',
            ],
            'spawn-animals' => [
                'category' => 'world',
                'label' => 'Spawn Animals',
                'description' => 'Spawn passive creatures (cows, sheep, pigs, chickens, etc.).',
                'type' => 'bool',
                'default' => 'true',
            ],
            'spawn-monsters' => [
                'category' => 'world',
                'label' => 'Spawn Monsters',
                'description' => 'Spawn hostile creatures (zombies, skeletons, creepers, etc.).',
                'type' => 'bool',
                'default' => 'true',
            ],
            'spawn-npcs' => [
                'category' => 'world',
                'label' => 'Spawn Villagers (NPCs)',
                'description' => 'Spawn villagers in generated villages.',
                'type' => 'bool',
                'default' => 'true',
            ],
            'max-world-size' => [
                'category' => 'world',
                'label' => 'Max World Size (Radius)',
                'description' => 'Maximum world border radius in blocks.',
                'type' => 'int',
                'min' => 1000,
                'max' => 29999984,
                'default' => '29999984',
            ],

            // Category: Security & Network
            'enable-command-block' => [
                'category' => 'security',
                'label' => 'Enable Command Blocks',
                'description' => 'Allow command blocks to execute server console commands.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'enforce-secure-profile' => [
                'category' => 'security',
                'label' => 'Enforce Secure Chat Profile',
                'description' => 'Requires players to possess a Mojang-signed cryptographic key pair for in-game chat messages.',
                'type' => 'bool',
                'default' => 'true',
            ],
            'hide-online-players' => [
                'category' => 'security',
                'label' => 'Hide Online Players',
                'description' => 'Hides the list of player names in the multiplayer server browser tooltip.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'prevent-proxy-connections' => [
                'category' => 'security',
                'label' => 'Prevent Proxy Connections',
                'description' => 'Blocks players connecting through known VPNs and commercial proxies.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'network-compression-threshold' => [
                'category' => 'security',
                'label' => 'Network Compression Threshold',
                'description' => 'Packets exceeding this size in bytes are compressed (-1 disables compression, 256 is default).',
                'type' => 'int',
                'min' => -1,
                'max' => 1024,
                'default' => '256',
            ],
            'max-tick-time' => [
                'category' => 'security',
                'label' => 'Max Tick Time (Watchdog ms)',
                'description' => 'Maximum milliseconds a single tick may take before the watchdog terminates the server (-1 disables watchdog).',
                'type' => 'int',
                'min' => -1,
                'max' => 300000,
                'default' => '60000',
            ],
            'sync-chunk-writes' => [
                'category' => 'security',
                'label' => 'Sync Chunk Writes',
                'description' => 'Write chunks synchronously to disk. Disabling this can improve performance on high-IOPS NVMe drives.',
                'type' => 'bool',
                'default' => 'true',
            ],
            'player-idle-timeout' => [
                'category' => 'security',
                'label' => 'Player Idle Timeout (Minutes)',
                'description' => 'Minutes of inactivity before an AFK player is kicked (0 disables idle kick).',
                'type' => 'int',
                'min' => 0,
                'max' => 1440,
                'default' => '0',
            ],

            // Category: Resource Pack
            'resource-pack' => [
                'category' => 'resource_pack',
                'label' => 'Resource Pack Direct URL',
                'description' => 'Direct HTTPS download URL to a custom server resource pack .zip file.',
                'type' => 'string',
                'default' => '',
            ],
            'resource-pack-sha1' => [
                'category' => 'resource_pack',
                'label' => 'Resource Pack SHA-1 Hash',
                'description' => '40-character SHA-1 checksum used for client caching and verification.',
                'type' => 'string',
                'default' => '',
            ],
            'require-resource-pack' => [
                'category' => 'resource_pack',
                'label' => 'Require Resource Pack',
                'description' => 'Disconnect players who decline downloading the server resource pack.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'resource-pack-prompt' => [
                'category' => 'resource_pack',
                'label' => 'Resource Pack Prompt Message',
                'description' => 'Custom text message shown to players on the resource pack prompt screen.',
                'type' => 'string',
                'default' => '',
            ],

            // Category: RCON & Query
            'enable-rcon' => [
                'category' => 'rcon',
                'label' => 'Enable RCON',
                'description' => 'Enables the remote console (RCON) protocol for external tools and bots.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'rcon.port' => [
                'category' => 'rcon',
                'label' => 'RCON Port',
                'description' => 'Port for RCON connections (must match an allocated port on your server).',
                'type' => 'int',
                'min' => 1,
                'max' => 65535,
                'default' => '25575',
            ],
            'rcon.password' => [
                'category' => 'rcon',
                'label' => 'RCON Password',
                'description' => 'Secret password used to authenticate RCON remote commands.',
                'type' => 'string',
                'default' => '',
            ],
            'broadcast-rcon-to-ops' => [
                'category' => 'rcon',
                'label' => 'Broadcast RCON to Ops',
                'description' => 'Broadcast RCON command output to connected server operators.',
                'type' => 'bool',
                'default' => 'true',
            ],
            'enable-query' => [
                'category' => 'rcon',
                'label' => 'Enable GameSpy4 Query',
                'description' => 'Enables the GameSpy4 server query protocol for server list status tracking.',
                'type' => 'bool',
                'default' => 'false',
            ],
            'query.port' => [
                'category' => 'rcon',
                'label' => 'Query Port',
                'description' => 'Port for query protocol responses.',
                'type' => 'int',
                'min' => 1,
                'max' => 65535,
                'default' => '25565',
            ],
        ];
    }
}
