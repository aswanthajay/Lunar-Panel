<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Minecraft;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Repositories\Wings\DaemonCommandRepository;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class PlayerManagerController extends ClientApiController
{
    public function __construct(
        private DaemonCommandRepository $commandRepository,
        private DaemonFileRepository $fileRepository
    ) {
        parent::__construct();
    }

    /**
     * Get online players for the Minecraft server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $isBedrock = $server->isBedrock();

        // 1. Direct Socket Ping (SLP) for authoritative online count, max slots, and player sample
        $allocation = $server->allocation;
        $pingData = null;
        if ($allocation) {
            $candidates = $this->resolvePingCandidates($server, $allocation);

            foreach ($candidates as $host) {
                $pingData = $isBedrock
                    ? $this->pingBedrock($host, (int) $allocation->port, 1.2)
                    : $this->pingJava($host, (int) $allocation->port, 1.2);

                if ($pingData !== null) {
                    if (!empty($pingData['max']) && (int) $pingData['max'] > 0) {
                        Cache::put("server:{$server->id}:max_players", (int) $pingData['max'], 1800);
                    }
                    break;
                }
            }
        }

        // 2. Dispatch console 'list' command
        $commandSent = false;
        try {
            $this->commandRepository->setServer($server)->send('list');
            $commandSent = true;
        } catch (\Throwable $e) {
            // If command failed AND direct ping failed, server is offline
            if ($pingData === null) {
                return response()->json([
                    'error' => 'The server is offline.',
                    'offline' => true,
                    'players' => [],
                    'online' => 0,
                    'max' => null,
                    'platform' => $isBedrock ? 'bedrock' : 'java',
                    'i18n' => $this->getTexts(),
                ], 409);
            }
        }

        // Wait briefly for console buffer to capture command response
        if ($commandSent) {
            usleep(600_000);
        }

        // 3. Read log buffer using decrypted Wings token
        $log = $this->readLog($server);
        $logPlayers = $this->extractPlayers($log);
        $logCounts = $this->extractCounts($log);

        // 4. Combine players from all sources
        $playersMap = [];

        // Add from SLP sample (contains exact username and UUID)
        if (!empty($pingData['sample']) && is_array($pingData['sample'])) {
            foreach ($pingData['sample'] as $p) {
                if (!empty($p['name']) && is_string($p['name'])) {
                    $clean = trim($p['name']);
                    $key = strtolower($clean);
                    $playersMap[$key] = [
                        'name' => $clean,
                        'uuid' => $p['uuid'] ?? null,
                    ];
                }
            }
        }

        // Add from log extraction (from /list command or active session tracking)
        foreach ($logPlayers as $name) {
            $key = strtolower($name);
            if (!isset($playersMap[$key])) {
                $playersMap[$key] = [
                    'name' => $name,
                    'uuid' => null,
                ];
            }
        }

        // 5. Authoritative online count
        if ($pingData !== null && isset($pingData['online'])) {
            $online = (int) $pingData['online'];
        } elseif ($logCounts['online'] !== null) {
            $online = (int) $logCounts['online'];
        } else {
            $online = count($playersMap);
        }

        // 6. Authoritative max player count
        $configuredMax = $this->resolveMaxPlayers($server);
        if ($pingData !== null && !empty($pingData['max'])) {
            $max = (int) $pingData['max'];
        } elseif ($configuredMax > 0) {
            $max = $configuredMax;
        } elseif ($logCounts['max'] !== null && $logCounts['max'] > 0) {
            $max = (int) $logCounts['max'];
        } else {
            $max = 20;
        }

        $playersList = array_values($playersMap);

        // 7. If players are online but names were hidden/masked by server config:
        if (empty($playersList) && $online > 0) {
            for ($i = 1; $i <= $online; $i++) {
                $playersList[] = [
                    'name' => $online === 1 ? 'Online Player' : "Player #{$i}",
                    'uuid' => null,
                    'masked' => true,
                ];
            }
        }

        return response()->json([
            'players' => $playersList,
            'online' => $online,
            'max' => $max,
            'platform' => $isBedrock ? 'bedrock' : 'java',
            'i18n' => $this->getTexts(),
        ]);
    }

    /**
     * Get banned players list.
     */
    public function banned(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $repo = $this->fileRepository->setServer($server);

        try {
            $raw = $repo->getContent('/banned-players.json');
            $list = json_decode($raw, true);
            if (is_array($list)) {
                return response()->json([
                    'banned' => array_map(fn($b) => [
                        'name' => $b['name'] ?? '?',
                        'uuid' => $b['uuid'] ?? null,
                        'reason' => $b['reason'] ?? null,
                        'source' => $b['source'] ?? null,
                        'created' => $b['created'] ?? null,
                        'expires' => $b['expires'] ?? 'forever',
                    ], $list),
                    'source' => 'file',
                ]);
            }
        } catch (\Throwable) {}

        try {
            $this->commandRepository->setServer($server)->send('banlist');
            usleep(800_000);
            $log = $this->readLog($server);
            $names = $this->extractBanlistFromLog($log);

            return response()->json([
                'banned' => array_map(fn($n) => ['name' => $n, 'reason' => null], $names),
                'source' => 'console',
            ]);
        } catch (\Throwable) {
            return response()->json(['banned' => [], 'source' => 'none']);
        }
    }

    /**
     * Get whitelist state and players.
     */
    public function whitelist(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $repo = $this->fileRepository->setServer($server);
        $isBedrock = $server->isBedrock();
        $key = $isBedrock ? 'allow-list' : 'white-list';

        $enabled = null;
        try {
            $props = $repo->getContent('/server.properties');
            if (preg_match('/^' . preg_quote($key, '/') . '\s*=\s*(true|false)/mi', $props, $m)) {
                $enabled = strtolower($m[1]) === 'true';
            }
        } catch (\Throwable) {}

        try {
            $raw = $repo->getContent('/whitelist.json');
            $list = json_decode($raw, true);
            if (is_array($list)) {
                return response()->json([
                    'enabled' => $enabled,
                    'whitelist' => array_map(fn($w) => [
                        'name' => $w['name'] ?? '?',
                        'uuid' => $w['uuid'] ?? null,
                    ], $list),
                    'source' => 'file',
                ]);
            }
        } catch (\Throwable) {}

        try {
            $this->commandRepository->setServer($server)->send('whitelist list');
            usleep(800_000);
            $log = $this->readLog($server);
            $names = $this->extractWhitelistFromLog($log);

            return response()->json([
                'enabled' => $enabled,
                'whitelist' => array_map(fn($n) => ['name' => $n, 'uuid' => null], $names),
                'source' => 'console',
            ]);
        } catch (\Throwable) {
            return response()->json(['enabled' => $enabled, 'whitelist' => [], 'source' => 'none']);
        }
    }

    /**
     * Get server operators (ops).
     */
    public function ops(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $repo = $this->fileRepository->setServer($server);
        try {
            $raw = $repo->getContent('/ops.json');
            $list = json_decode($raw, true);
            if (is_array($list)) {
                return response()->json([
                    'ops' => array_map(fn($o) => [
                        'name' => $o['name'] ?? '?',
                        'uuid' => $o['uuid'] ?? null,
                        'level' => $o['level'] ?? 4,
                    ], $list),
                ]);
            }
        } catch (\Throwable) {}

        return response()->json(['ops' => []]);
    }

    /**
     * Execute player actions (kick, ban, unban, op, deop, say, whitelist, gamemode).
     */
    public function action(Request $request, Server $server): JsonResponse
    {
        if (!$server->isMinecraft()) {
            throw new AccessDeniedHttpException('This feature is only available for Minecraft servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $action = (string) $request->input('action');
        $player = trim((string) $request->input('player'));
        $reason = trim((string) $request->input('reason', ''));

        $noPlayerActions = ['say', 'whitelist_on', 'whitelist_off'];

        if (!in_array($action, $noPlayerActions, true) && !preg_match('/^[\w.\- ]{1,32}$/', $player)) {
            return response()->json(['error' => 'Invalid player username.'], 400);
        }

        $reason = preg_replace('/[\r\n"]+/', ' ', $reason);
        $reason = mb_substr($reason, 0, 120);

        $commands = [
            'kick' => $reason ? "kick {$player} {$reason}" : "kick {$player}",
            'ban' => $reason ? "ban {$player} {$reason}" : "ban {$player}",
            'unban' => "pardon {$player}",
            'op' => "op {$player}",
            'deop' => "deop {$player}",
            'say' => 'say ' . preg_replace('/[\r\n]+/', ' ', mb_substr($reason ?: $player, 0, 200)),
            'whitelist_add' => "whitelist add {$player}",
            'whitelist_remove' => "whitelist remove {$player}",
            'whitelist_on' => 'whitelist on',
            'whitelist_off' => 'whitelist off',
            'gamemode_survival' => "gamemode survival {$player}",
            'gamemode_creative' => "gamemode creative {$player}",
            'gamemode_adventure' => "gamemode adventure {$player}",
            'gamemode_spectator' => "gamemode spectator {$player}",
        ];

        if (!isset($commands[$action])) {
            return response()->json(['error' => 'Invalid action specified.'], 400);
        }

        if ($server->isBedrock()) {
            if ($action === 'op') $commands['op'] = "op \"{$player}\"";
            if ($action === 'deop') $commands['deop'] = "deop \"{$player}\"";
            if ($action === 'unban') $commands['unban'] = "pardon \"{$player}\"";
            if ($action === 'whitelist_add') $commands['whitelist_add'] = "whitelist add \"{$player}\"";
            if ($action === 'whitelist_remove') $commands['whitelist_remove'] = "whitelist remove \"{$player}\"";
        }

        $sent = false;
        try {
            $this->commandRepository->setServer($server)->send($commands[$action]);
            $sent = true;
        } catch (\Throwable) {}

        if ($sent) {
            return response()->json(['ok' => true, 'command' => $commands[$action]]);
        }

        // If offline and action is op/deop on Java, write directly to ops.json
        if (in_array($action, ['op', 'deop'], true) && !$server->isBedrock()) {
            $repo = $this->fileRepository->setServer($server);
            try {
                $raw = $repo->getContent('/ops.json');
                $list = json_decode($raw, true) ?: [];
            } catch (\Throwable) {
                $list = [];
            }

            $alreadyOp = false;
            foreach ($list as $i => $o) {
                if (strcasecmp((string) ($o['name'] ?? ''), $player) === 0) {
                    $alreadyOp = true;
                    if ($action === 'deop') unset($list[$i]);
                    break;
                }
            }

            if ($action === 'op' && !$alreadyOp) {
                $uuid = $this->resolveUuid($player);
                $list[] = [
                    'uuid' => $uuid,
                    'name' => $player,
                    'level' => 4,
                    'bypassesPlayerLimit' => false,
                ];
            }

            try {
                $repo->putContent('/ops.json', json_encode(array_values($list), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
                return response()->json(['ok' => true, 'command' => $commands[$action], 'offline' => true]);
            } catch (\Throwable) {
                return response()->json(['error' => 'Server is offline and ops.json could not be written.'], 409);
            }
        }

        return response()->json(['error' => 'Server must be online to execute this action.'], 409);
    }

    /**
     * Resolve Minecraft user profile & Mojang UUID.
     */
    public function profile(Request $request, Server $server, string $name): JsonResponse
    {
        if (!preg_match('/^[\w.\-]{2,32}$/', $name)) {
            return response()->json(['error' => 'Invalid username.'], 400);
        }

        $cacheKey = 'mc_profile_uuid_' . strtolower($name);
        $uuid = Cache::get($cacheKey);

        if ($uuid === null) {
            try {
                $res = Http::timeout(4)->get('https://api.mojang.com/users/profiles/minecraft/' . urlencode($name));
                $uuid = $res->successful() ? ($res->json()['id'] ?? false) : false;
            } catch (\Throwable) {
                $uuid = false;
            }
            Cache::put($cacheKey, $uuid, now()->addDay());
        }

        return response()->json([
            'name' => $name,
            'uuid' => $uuid ?: null,
            'premium' => (bool) $uuid,
        ]);
    }

    private function readLog(Server $server): string
    {
        $node = $server->node;
        if (!$node) return '';

        try {
            $token = $node->getDecryptedKey();
            $url = sprintf(
                '%s/api/servers/%s/logs',
                rtrim($node->getConnectionAddress(), '/'),
                $server->uuid
            );

            $res = Http::withToken($token)
                ->withoutVerifying()
                ->timeout(3)
                ->get($url);

            if ($res->successful()) {
                $data = $res->json()['data'] ?? [];
                return is_array($data) ? implode("\n", $data) : (string) $data;
            }
        } catch (\Throwable) {}

        return '';
    }

    private function extractPlayers(string $log): array
    {
        $lines = preg_split('/\r?\n/', $log);
        $reversed = array_reverse($lines);

        // Pass 1: Look for response to /list command
        $hasDisconnectSinceList = false;
        foreach ($reversed as $i => $line) {
            $clean = preg_replace('/\x1b\[[0-9;]*m/', '', $line);
            $clean = preg_replace('/^(?:\[[^\]]*\]\s*)+:?\s*/', '', $clean);

            if (preg_match('/(?:left the game|lost connection:|Player disconnected:)/i', $clean)) {
                $hasDisconnectSinceList = true;
            }

            if (preg_match('/players?\s+online/i', $clean)) {
                if ($hasDisconnectSinceList) {
                    break;
                }
                $pos = strrpos($clean, ':');
                if ($pos !== false) {
                    $tail = trim(substr($clean, $pos + 1));
                    if ($tail !== '') {
                        $parsed = $this->cleanNames($tail);
                        if (!empty($parsed)) {
                            return $parsed;
                        }
                    }
                }

                // If players are on the next chronological line (Bedrock or EssentialsX)
                if ($i > 0) {
                    $next = preg_replace('/\x1b\[[0-9;]*m/', '', $reversed[$i - 1]);
                    $next = preg_replace('/^(?:\[[^\]]*\]\s*)+:?\s*/', '', $next);
                    $next = trim($next);

                    if ($next !== '' && !preg_match('/players?\s+online/i', $next)) {
                        if (str_contains($next, ':')) {
                            $afterColon = trim(substr($next, strpos($next, ':') + 1));
                            $parsed = $this->cleanNames($afterColon);
                            if (!empty($parsed)) return $parsed;
                        }
                        $parsed = $this->cleanNames($next);
                        if (!empty($parsed)) return $parsed;
                    }
                }
            }
        }

        // Pass 2: Track active player sessions from recent join/leave events
        $joined = [];
        foreach ($lines as $line) {
            $clean = preg_replace('/\x1b\[[0-9;]*m/', '', $line);
            $clean = preg_replace('/^(?:\[[^\]]*\]\s*)+:?\s*/', '', $clean);

            // Java join: "PlayerName joined the game"
            if (preg_match('/^([a-zA-Z0-9_.+~-]{2,32})\s+joined the game/i', $clean, $m)) {
                $joined[strtolower($m[1])] = $m[1];
            }
            // Bedrock connect: "Player connected: PlayerName, xuid: ..."
            elseif (preg_match('/Player connected:\s*([a-zA-Z0-9_.+~ -]{2,32}),?\s*xuid:/i', $clean, $m)) {
                $name = trim($m[1]);
                $joined[strtolower($name)] = $name;
            }
            // Java leave: "PlayerName left the game" or "lost connection:"
            elseif (preg_match('/^([a-zA-Z0-9_.+~-]{2,32})\s+(?:left the game|lost connection:)/i', $clean, $m)) {
                unset($joined[strtolower($m[1])]);
            }
            // Bedrock disconnect: "Player disconnected: PlayerName, xuid: ..."
            elseif (preg_match('/Player disconnected:\s*([a-zA-Z0-9_.+~ -]{2,32}),?\s*xuid:/i', $clean, $m)) {
                $name = trim($m[1]);
                unset($joined[strtolower($name)]);
            }
        }

        if (!empty($joined)) {
            return array_values($joined);
        }

        return [];
    }

    private function cleanNames(string $text): array
    {
        // Remove rank prefixes like [Owner], [Admin], [VIP], <Owner>, etc.
        $text = preg_replace('/\[[^\]]*\]|<[^>]*>/', ' ', $text);

        $parts = preg_split('/[,\s]+/', $text);
        $out = [];

        foreach ($parts as $p) {
            $p = trim($p, " \t\n\r\0\x0B,.:*#");
            if ($p !== '' && preg_match('/^[a-zA-Z0-9_.+~-]{2,32}$/', $p)) {
                if (in_array(strtolower($p), ['there', 'are', 'out', 'of', 'maximum', 'players', 'online', 'default', 'none', 'and'])) {
                    continue;
                }
                $out[] = $p;
            }
        }

        return array_values(array_unique($out));
    }

    private function extractCounts(string $log): array
    {
        $lines = preg_split('/\r?\n/', $log);
        $reversed = array_reverse($lines);

        $hasDisconnectSinceList = false;

        foreach ($reversed as $line) {
            $clean = preg_replace('/\x1b\[[0-9;]*m/', '', $line);
            $clean = preg_replace('/^(?:\[[^\]]*\]\s*)+:?\s*/', '', $clean);

            // Track if players disconnected more recently than the list command
            if (preg_match('/(?:left the game|lost connection:|Player disconnected:)/i', $clean)) {
                $hasDisconnectSinceList = true;
            }

            // Vanilla / Paper: "There are X of a max of Y players online" or "There are X/Y players online"
            if (preg_match('/there are\s+(\d+)(?:\s*(?:\/|(?:out\s+of|of)(?:\s+a)?\s+max(?:imum)?(?:\s+of)?)\s*(\d+))?\s+players?\s+online/i', $clean, $m)) {
                $online = (int) $m[1];
                $max = !empty($m[2]) ? (int) $m[2] : null;
                if ($hasDisconnectSinceList && $online > 0) {
                    return ['online' => null, 'max' => $max];
                }
                return ['online' => $online, 'max' => $max];
            }

            // Essentials / Paper: "Players online: X/Y" or "Online players (X/Y):"
            if (preg_match('/(?:online\s+players|players\s+online)\s*[:(]?\s*(\d+)\s*(?:\/|\s+of\s+)\s*(\d+)\s*\)?/i', $clean, $m)) {
                $online = (int) $m[1];
                $max = (int) $m[2];
                if ($hasDisconnectSinceList && $online > 0) {
                    return ['online' => null, 'max' => $max];
                }
                return ['online' => $online, 'max' => $max];
            }

            // Proxy total: "Total players online: X"
            if (preg_match('/total\s+players\s+online:\s*(\d+)/i', $clean, $m)) {
                $online = (int) $m[1];
                if ($hasDisconnectSinceList && $online > 0) {
                    return ['online' => null, 'max' => null];
                }
                return ['online' => $online, 'max' => null];
            }
        }

        return ['online' => null, 'max' => null];
    }

    private function extractBanlistFromLog(string $log): array
    {
        $names = [];
        foreach (array_reverse(preg_split('/\r?\n/', $log)) as $line) {
            $clean = preg_replace('/\x1b\[[0-9;]*m/', '', $line);
            if (preg_match('/ban list|banned players/i', $clean)) {
                $pos = strrpos($clean, ':');
                if ($pos !== false) {
                    $names = $this->cleanNames(trim(substr($clean, $pos + 1)));
                }
                break;
            }
        }
        return $names;
    }

    private function extractWhitelistFromLog(string $log): array
    {
        $names = [];
        foreach (array_reverse(preg_split('/\r?\n/', $log)) as $line) {
            $clean = preg_replace('/\x1b\[[0-9;]*m/', '', $line);
            if (preg_match('/whitelisted players|there are \d+ whitelisted/i', $clean)) {
                $pos = strrpos($clean, ':');
                if ($pos !== false) {
                    $names = $this->cleanNames(trim(substr($clean, $pos + 1)));
                }
                break;
            }
        }
        return $names;
    }

    /**
     * Minecraft Java Server List Ping (SLP) via TCP socket.
     */
    private function pingJava(string $host, int $port, float $timeout = 1.2): ?array
    {
        $start = microtime(true);
        $socket = @stream_socket_client("tcp://{$host}:{$port}", $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
        if (!$socket) {
            return null;
        }

        stream_set_timeout($socket, (int) $timeout, (int) (($timeout - (int) $timeout) * 1_000_000));

        // Handshake packet (id=0x00, protocol=47, host, port, next_state=1)
        $hostLen = strlen($host);
        $handshakeData = chr(0x00) . $this->packVarInt(47) . $this->packVarInt($hostLen) . $host . pack('n', $port) . $this->packVarInt(1);
        $handshakePacket = $this->packVarInt(strlen($handshakeData)) . $handshakeData;

        // Status Request packet (id=0x00, empty)
        $statusRequest = $this->packVarInt(1) . chr(0x00);

        @fwrite($socket, $handshakePacket . $statusRequest);

        $len = $this->unpackVarInt($socket);
        if ($len <= 0) {
            @fclose($socket);
            return null;
        }

        $packetId = $this->unpackVarInt($socket);
        if ($packetId !== 0) {
            @fclose($socket);
            return null;
        }

        $strLen = $this->unpackVarInt($socket);
        if ($strLen <= 0) {
            @fclose($socket);
            return null;
        }

        $jsonStr = '';
        $remaining = $strLen;
        while ($remaining > 0 && !feof($socket)) {
            $chunk = @fread($socket, min($remaining, 8192));
            if ($chunk === false || strlen($chunk) === 0) {
                $meta = stream_get_meta_data($socket);
                if (!empty($meta['timed_out'])) break;
                usleep(5000);
                continue;
            }
            $jsonStr .= $chunk;
            $remaining -= strlen($chunk);
        }

        @fclose($socket);
        $ping = (int) round((microtime(true) - $start) * 1000);

        $data = json_decode($jsonStr, true);
        if (!is_array($data) || !isset($data['players'])) {
            return null;
        }

        $sample = [];
        if (!empty($data['players']['sample']) && is_array($data['players']['sample'])) {
            foreach ($data['players']['sample'] as $s) {
                if (!empty($s['name']) && is_string($s['name'])) {
                    $sample[] = [
                        'name' => trim($s['name']),
                        'uuid' => $s['id'] ?? null,
                    ];
                }
            }
        }

        return [
            'online' => (int) ($data['players']['online'] ?? 0),
            'max' => (int) ($data['players']['max'] ?? 0),
            'version' => $data['version']['name'] ?? null,
            'ping' => $ping,
            'sample' => $sample,
        ];
    }

    /**
     * Minecraft Bedrock Unconnected Ping via UDP socket.
     */
    private function pingBedrock(string $host, int $port, float $timeout = 1.2): ?array
    {
        $socket = @fsockopen("udp://{$host}", $port, $errno, $errstr, $timeout);
        if (!$socket) {
            return null;
        }
        stream_set_timeout($socket, (int) $timeout, (int) (($timeout - (int) $timeout) * 1_000_000));

        $magic = "\x00\xff\xff\x00\xfe\xfe\xfe\xfe\xfd\xfd\xfd\xfd\x12\x34\x56\x78";
        $time = pack('J', (int) (microtime(true) * 1000));
        $guid = pack('J', rand());
        $packet = "\x01" . $time . $magic . $guid;

        @fwrite($socket, $packet);
        $res = @fread($socket, 2048);
        @fclose($socket);

        if (!$res || strlen($res) < 35 || ord($res[0]) !== 0x1c) {
            return null;
        }

        $strLen = unpack('n', substr($res, 33, 2))[1] ?? 0;
        $str = substr($res, 35, $strLen);
        $parts = explode(';', $str);

        return [
            'online' => isset($parts[4]) ? (int) $parts[4] : 0,
            'max' => isset($parts[5]) ? (int) $parts[5] : 0,
            'version' => $parts[3] ?? null,
            'sample' => [],
        ];
    }

    /**
     * Pack integer to Minecraft VarInt.
     */
    private function packVarInt(int $val): string
    {
        $buf = '';
        while (true) {
            if (($val & ~0x7F) === 0) {
                $buf .= chr($val);
                return $buf;
            }
            $buf .= chr(($val & 0x7F) | 0x80);
            $val >>= 7;
        }
    }

    /**
     * Unpack Minecraft VarInt from socket stream.
     */
    private function unpackVarInt($socket): int
    {
        $val = 0;
        $pos = 0;
        while (true) {
            $b = @fgetc($socket);
            if ($b === false) return -1;
            $byte = ord($b);
            $val |= ($byte & 0x7F) << $pos;
            if (($byte & 0x80) === 0) break;
            $pos += 7;
            if ($pos >= 32) return -1;
        }
        return $val;
    }

    /**
     * Resolves configured max slots from egg variables, cache, or configuration files.
     */
    private function resolveMaxPlayers(Server $server): int
    {
        // 1. Check egg startup variables
        try {
            $variables = $server->variables()
                ->whereIn('env_variable', [
                    'MAX_PLAYERS',
                    'SERVER_MAX_PLAYERS',
                    'SLOTS',
                    'PLAYER_SLOTS',
                    'MAXPLAYERS',
                    'SERVER_SLOTS',
                ])
                ->get();

            foreach ($variables as $variable) {
                $val = !empty($variable->server_value) ? $variable->server_value : $variable->default_value;
                if (is_numeric($val) && (int) $val > 0) {
                    $slots = (int) $val;
                    Cache::put("server:{$server->id}:max_players", $slots, 300);
                    return $slots;
                }
            }
        } catch (\Throwable) {}

        // 2. Check cache
        $cached = Cache::get("server:{$server->id}:max_players");
        if (is_numeric($cached) && (int) $cached > 0) {
            return (int) $cached;
        }

        // 3. Check configuration files
        try {
            $repo = $this->fileRepository->setServer($server);

            try {
                $content = $repo->getContent('/server.properties');
                if (preg_match('/^\s*max-players\s*=\s*(\d+)/mi', $content, $m)) {
                    $slots = (int) $m[1];
                    if ($slots > 0) {
                        Cache::put("server:{$server->id}:max_players", $slots, 300);
                        return $slots;
                    }
                }
            } catch (\Throwable) {}

            try {
                $content = $repo->getContent('/velocity.toml');
                if (preg_match('/^\s*show-max-players\s*=\s*(\d+)/mi', $content, $m)) {
                    $slots = (int) $m[1];
                    if ($slots > 0) {
                        Cache::put("server:{$server->id}:max_players", $slots, 300);
                        return $slots;
                    }
                }
            } catch (\Throwable) {}

            try {
                $content = $repo->getContent('/config.yml');
                if (preg_match('/^\s*(?:player_limit|max_players)\s*:\s*(\d+)/mi', $content, $m)) {
                    $slots = (int) $m[1];
                    if ($slots > 0) {
                        Cache::put("server:{$server->id}:max_players", $slots, 300);
                        return $slots;
                    }
                }
            } catch (\Throwable) {}
        } catch (\Throwable) {}

        return 20;
    }

    /**
     * Resolves intelligent candidates for socket pinging.
     */
    private function resolvePingCandidates(Server $server, $allocation): array
    {
        $candidates = [];

        // 1. Allocation IP if public/routable
        if ($allocation && !empty($allocation->ip) && $allocation->ip !== '0.0.0.0' && $allocation->ip !== '127.0.0.1') {
            if (!filter_var($allocation->ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                if ($server->node && !empty($server->node->fqdn)) {
                    $candidates[] = $server->node->fqdn;
                }
                $candidates[] = $allocation->ip;
            } else {
                $candidates[] = $allocation->ip;
                if ($server->node && !empty($server->node->fqdn)) {
                    $candidates[] = $server->node->fqdn;
                }
            }
        } elseif ($server->node && !empty($server->node->fqdn)) {
            $candidates[] = $server->node->fqdn;
        }

        // 2. Allocation alias (if configured)
        if ($allocation && !empty($allocation->alias)) {
            $candidates[] = $allocation->alias;
        }

        // 3. Localhost only if the node daemon itself is on localhost
        $nodeFqdn = strtolower($server->node?->fqdn ?? '');
        if (in_array($nodeFqdn, ['127.0.0.1', 'localhost'])) {
            $candidates[] = '127.0.0.1';
        }

        return array_unique(array_filter($candidates));
    }

    private function resolveUuid(string $name): string
    {
        $cacheKey = 'mc_profile_uuid_' . strtolower($name);
        $raw = Cache::get($cacheKey);
        if ($raw && strlen($raw) === 32) {
            return implode('-', [
                substr($raw, 0, 8), substr($raw, 8, 4), substr($raw, 12, 4),
                substr($raw, 16, 4), substr($raw, 20, 12),
            ]);
        }

        // Offline UUID calculation
        $hash = md5('OfflinePlayer:' . $name);
        $hash[12] = '3';
        $hash[16] = dechex((hexdec($hash[16]) & 0x3) | 0x8);
        return implode('-', [
            substr($hash, 0, 8), substr($hash, 8, 4), substr($hash, 12, 4),
            substr($hash, 16, 4), substr($hash, 20, 12),
        ]);
    }

    private function getTexts(): array
    {
        return [
            'title' => 'Players',
            'platform_java' => 'Java Edition',
            'platform_bedrock' => 'Bedrock Edition',
            'refresh' => 'Refresh',
            'loading' => 'Connecting to server…',
            'offline_title' => 'Server is offline',
            'offline_sub' => 'Start the server to view online players and send live commands.',
            'tab_online' => 'Online',
            'tab_admins' => 'Admins (OPs)',
            'tab_banned' => 'Banned',
            'tab_whitelist' => 'Whitelist',
            'tab_broadcast' => 'Broadcast',
            'none_online_off' => 'Server is currently offline.',
            'none_online' => 'No players connected right now.',
            'gamemode_placeholder' => 'Game mode…',
            'gamemode_survival' => 'Survival',
            'gamemode_creative' => 'Creative',
            'gamemode_adventure' => 'Adventure',
            'gamemode_spectator' => 'Spectator',
            'btn_deop' => 'Remove OP',
            'btn_op' => 'Make OP',
            'btn_kick' => 'Kick',
            'btn_ban' => 'Ban',
            'slots' => '{online} / {max} players online',
            'admins_intro' => 'Manage OP permissions for any player, even when the server is powered off.',
            'name_placeholder' => 'Player username',
            'btn_giving_admin' => 'Assigning…',
            'btn_give_admin' => 'Grant OP',
            'already_admin' => 'That player is already an operator.',
            'no_admins' => 'No operators found.',
            'banned_intro' => 'Manage banned players.',
            'ban_name_placeholder' => 'Username to ban',
            'already_banned' => 'That player is already banned.',
            'no_banned' => 'No players currently banned.',
            'ban_reason_by' => ' · by {source}',
            'btn_unban' => 'Pardon / Unban',
            'wl_state_unknown' => 'Whitelist status unknown',
            'wl_active' => 'Whitelist enabled',
            'wl_inactive' => 'Whitelist disabled',
            'wl_sub_active' => 'Only whitelisted players can connect.',
            'wl_sub_inactive' => 'Anyone can connect.',
            'btn_deactivate' => 'Disable',
            'btn_activate' => 'Enable',
            'wl_add_placeholder' => 'Player username',
            'btn_adding' => 'Adding…',
            'btn_add' => 'Add to whitelist',
            'no_whitelist' => 'No players on the whitelist.',
            'btn_remove' => 'Remove',
            'broadcast_intro' => 'Broadcast an in-game message visible to all online players.',
            'broadcast_placeholder' => 'e.g. Server restart in 5 minutes',
            'btn_sending' => 'Sending…',
            'btn_send' => 'Broadcast Message',
            'confirm_ban_title' => 'Ban {player}',
            'confirm_kick_title' => 'Kick {player}',
            'confirm_ban_sub' => 'They will be disconnected and unable to rejoin.',
            'confirm_kick_sub' => 'They will be disconnected but can reconnect immediately.',
            'reason_placeholder' => 'Reason (optional)',
            'btn_cancel' => 'Cancel',
            'kick_done' => '{player} has been kicked.',
            'ban_done' => '{player} has been banned.',
            'unban_done' => '{player} has been unbanned.',
            'op_done' => '{player} is now an operator.',
            'deop_done' => '{player} is no longer an operator.',
            'whitelist_add_done' => '{player} was added to the whitelist.',
            'whitelist_remove_done' => '{player} was removed from the whitelist.',
            'whitelist_on_done' => 'Whitelist enabled.',
            'whitelist_off_done' => 'Whitelist disabled.',
            'op_offline_done' => '{player} is now an operator (saved to ops.json).',
            'deop_offline_done' => '{player} is no longer an operator.',
            'gamemode_done' => '{player} gamemode changed to {mode}.',
            'action_done_default' => 'Command executed.',
            'list_error' => 'Could not fetch player list.',
            'action_error' => 'Action execution failed.',
            'no_server' => 'Could not locate server instance.',
        ];
    }
}
