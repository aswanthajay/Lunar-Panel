<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class PlayerStatusController extends ClientApiController
{
    public function __construct(
        private DaemonFileRepository $fileRepository
    ) {
        parent::__construct();
    }

    /**
     * Return live online players count, player slots, and server ping.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $cacheKey = "server:{$server->uuid}:player_status";
        $cached = Cache::get($cacheKey);
        if ($cached && is_array($cached)) {
            return response()->json($cached);
        }

        $result = [
            'online' => 0,
            'max' => null,
            'platform' => 'generic',
            'status' => 'offline',
            'ping' => null,
            'version' => null,
        ];

        // Multi-source configured max slots (egg variables -> config files)
        $configuredMax = $this->resolveConfiguredMaxSlots($server);
        if ($configuredMax !== null && $configuredMax > 0) {
            $result['max'] = $configuredMax;
        }

        if ($server->isMinecraft()) {
            $isBedrock = $server->isBedrock();
            $result['platform'] = $isBedrock ? 'bedrock' : 'java';

            // 1. Perform non-intrusive Server List Ping (SLP) over socket (zero console output)
            $allocation = $server->allocation;
            if ($allocation) {
                $candidates = $this->resolvePingCandidates($server, $allocation);

                foreach ($candidates as $host) {
                    $pingData = $isBedrock
                        ? $this->pingBedrock($host, (int) $allocation->port, 1.2)
                        : $this->pingJava($host, (int) $allocation->port, 1.2);

                    if ($pingData !== null) {
                        $result['online'] = $pingData['online'];
                        if ($pingData['max'] > 0) {
                            $result['max'] = $pingData['max'];
                            Cache::put("server:{$server->id}:max_players", $pingData['max'], 1800);
                        } elseif ($result['max'] === null) {
                            $result['max'] = $configuredMax ?: 20;
                        }
                        $result['status'] = 'running';
                        $result['ping'] = $pingData['ping'] ?? null;
                        if (!empty($pingData['version'])) {
                            $result['version'] = $pingData['version'];
                        }
                        Cache::put($cacheKey, $result, 8);
                        return response()->json($result);
                    }
                }
            }

            // 2. Fallback: check Wings logs buffer without sending commands
            $log = $this->readLog($server);
            if (!empty($log)) {
                $counts = $this->extractCounts($log);
                if ($counts['online'] !== null) {
                    $result['online'] = $counts['online'];
                    $result['status'] = 'running';
                }
                if ($counts['max'] !== null && $counts['max'] > 0) {
                    $result['max'] = $counts['max'];
                    Cache::put("server:{$server->id}:max_players", $counts['max'], 1800);
                }
            }

            // If max is still not determined, default to configured slots or un-cached 20
            if ($result['max'] === null) {
                $result['max'] = $configuredMax ?: 20;
            }
        } elseif ($server->isFiveM()) {
            $result['platform'] = 'fivem';

            $allocation = $server->allocation;
            if ($allocation) {
                $port = $allocation->port ?: 30120;
                $candidates = $this->resolvePingCandidates($server, $allocation);

                // 1. Try local FiveM dynamic.json HTTP query
                foreach ($candidates as $host) {
                    try {
                        $start = microtime(true);
                        $response = Http::timeout(1.2)->get("http://{$host}:{$port}/dynamic.json");
                        if ($response->successful()) {
                            $data = $response->json();
                            if (is_array($data)) {
                                $result['online'] = (int) ($data['clients'] ?? 0);
                                if (isset($data['sv_maxclients']) && (int) $data['sv_maxclients'] > 0) {
                                    $result['max'] = (int) $data['sv_maxclients'];
                                    Cache::put("server:{$server->id}:max_players", $result['max'], 1800);
                                }
                                $result['status'] = 'running';
                                $result['ping'] = (int) round((microtime(true) - $start) * 1000);
                                if (!empty($data['gametype'])) {
                                    $result['version'] = (string) $data['gametype'];
                                }
                                Cache::put($cacheKey, $result, 8);
                                return response()->json($result);
                            }
                        }
                    } catch (\Throwable) {}
                }

                // 2. Fallback: Query Official Cfx.re Frontend API if CFX Join ID is discovered
                $cfxId = $this->resolveCfxId($server);
                if ($cfxId) {
                    try {
                        $start = microtime(true);
                        $response = Http::withHeaders([
                            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
                        ])->timeout(2.0)->get("https://servers-frontend.fivem.net/api/servers/single/{$cfxId}");

                        if ($response->successful()) {
                            $cfxData = $response->json('Data');
                            if (is_array($cfxData)) {
                                $result['online'] = (int) ($cfxData['clients'] ?? 0);
                                if (isset($cfxData['sv_maxclients']) && (int) $cfxData['sv_maxclients'] > 0) {
                                    $result['max'] = (int) $cfxData['sv_maxclients'];
                                    Cache::put("server:{$server->id}:max_players", $result['max'], 1800);
                                }
                                $result['status'] = 'running';
                                $result['ping'] = (int) round((microtime(true) - $start) * 1000);
                                if (!empty($cfxData['vars']['gamename'])) {
                                    $result['version'] = $cfxData['vars']['gamename'];
                                }
                                Cache::put($cacheKey, $result, 12);
                                return response()->json($result);
                            }
                        }
                    } catch (\Throwable) {}
                }
            }

            if ($result['max'] === null) {
                $result['max'] = $configuredMax ?: 32;
            }
        } else {
            // Non-Minecraft generic servers (SAMP, Rust, Source, etc.)
            if ($result['max'] === null) {
                $result['max'] = $configuredMax;
            }
        }

        Cache::put($cacheKey, $result, 8);
        return response()->json($result);
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

        return [
            'online' => (int) ($data['players']['online'] ?? 0),
            'max' => (int) ($data['players']['max'] ?? 0),
            'version' => $data['version']['name'] ?? null,
            'ping' => $ping,
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
     * Read recent log lines from Wings daemon.
     */
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
                ->timeout(2)
                ->get($url);

            if ($res->successful()) {
                $data = $res->json()['data'] ?? [];
                return is_array($data) ? implode("\n", $data) : (string) $data;
            }
        } catch (\Throwable) {}

        return '';
    }

    /**
     * Extract online and max players from log lines.
     */
    private function extractCounts(string $log): array
    {
        $lines = array_reverse(preg_split('/\r?\n/', $log));

        foreach ($lines as $line) {
            $clean = preg_replace('/\x1b\[[0-9;]*m/', '', $line);
            $clean = preg_replace('/^(?:\[[^\]]*\]\s*)+:?\s*/', '', $clean);

            if (preg_match('/there are (\d+)(?:\s*\/\s*|\D+of\D+max\D*of\D*|\D+of\D+max\D*|\D+out\D+of\D+maximum\D*)(\d+)/i', $clean, $m)) {
                return ['online' => (int) $m[1], 'max' => (int) $m[2]];
            }

            if (preg_match('/(?:online\s+players|players\s+online)\s*\(?(\d+)\s*\/\s*(\d+)\)?/i', $clean, $m)) {
                return ['online' => (int) $m[1], 'max' => (int) $m[2]];
            }

            if (preg_match('/total players online:\s*(\d+)/i', $clean, $m)) {
                return ['online' => (int) $m[1], 'max' => null];
            }
        }

        return ['online' => null, 'max' => null];
    }

    /**
     * Resolves CFX Join ID from server variables, server.cfg, or server logs.
     */
    private function resolveCfxId(Server $server): ?string
    {
        return Cache::remember("server:{$server->id}:cfx_id", 300, function () use ($server) {
            try {
                // Check server variables
                $var = $server->variables()->whereIn('env_variable', ['CFX_ID', 'JOIN_ID', 'CFX_JOIN_ID', 'FIVEM_JOIN_ID'])->first();
                if ($var && !empty($var->server_value)) {
                    return trim($var->server_value);
                }

                // Check recent log buffer
                $log = $this->readLog($server);
                if (!empty($log) && preg_match('/(?:cfx\.re\/join\/|join code:?\s*|join ID:?\s*)([a-z0-9]{4,10})/i', $log, $m)) {
                    return trim($m[1]);
                }
            } catch (\Throwable) {}
            return null;
        });
    }

    /**
     * Resolves configured max slots for FiveM from server.cfg or variables.
     */
    /**
     * Resolves configured max slots from cache, server egg variables, or configuration files.
     */
    public function resolveConfiguredMaxSlots(Server $server): ?int
    {
        // 1. Check if recently cached from a successful query or parse
        $cached = Cache::get("server:{$server->id}:max_players");
        if (is_numeric($cached) && (int) $cached > 0) {
            return (int) $cached;
        }

        // 2. Check egg environment variables (both server_value and default_value)
        try {
            $variables = $server->variables()
                ->whereIn('env_variable', [
                    'MAX_PLAYERS',
                    'SERVER_MAX_PLAYERS',
                    'SLOTS',
                    'PLAYER_SLOTS',
                    'MAXPLAYERS',
                    'SERVER_SLOTS',
                    'SV_MAXCLIENTS',
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

        // 3. Check configuration files via Wings file API
        try {
            $repo = $this->fileRepository->setServer($server);

            // A. server.properties (Minecraft Java & Bedrock)
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

            // B. velocity.toml (Velocity Proxy)
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

            // C. config.yml (BungeeCord / Waterfall Proxy)
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

            // D. server.cfg (FiveM)
            try {
                $content = $repo->getContent('/server.cfg');
                if (preg_match('/(?:sv_maxclients|sv_maxClients)\s+["\']?(\d+)["\']?/i', $content, $m)) {
                    $slots = (int) $m[1];
                    if ($slots > 0) {
                        Cache::put("server:{$server->id}:max_players", $slots, 300);
                        return $slots;
                    }
                }
            } catch (\Throwable) {}
        } catch (\Throwable) {}

        return null;
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
                // Private IP: prioritize node FQDN
                if ($server->node && !empty($server->node->fqdn)) {
                    $candidates[] = $server->node->fqdn;
                }
                $candidates[] = $allocation->ip;
            } else {
                // Public IP: prioritize allocation IP
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
}
