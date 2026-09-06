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

        if ($server->isMinecraft()) {
            $isBedrock = $server->isBedrock();
            $result['platform'] = $isBedrock ? 'bedrock' : 'java';

            // 1. Get max slots from server.properties (cached 5 minutes)
            $maxSlots = Cache::remember("server:{$server->id}:max_players", 300, function () use ($server) {
                try {
                    $repo = $this->fileRepository->setServer($server);
                    $content = $repo->getContent('/server.properties');
                    if (preg_match('/^max-players\s*=\s*(\d+)/mi', $content, $m)) {
                        return (int) $m[1];
                    }
                } catch (\Throwable) {}
                return 20;
            });
            $result['max'] = $maxSlots;

            // 2. Perform non-intrusive Server List Ping (SLP) over socket (zero console output)
            $allocation = $server->allocation;
            if ($allocation) {
                $candidates = array_unique(array_filter([
                    $allocation->alias ?: null,
                    $allocation->ip !== '0.0.0.0' ? $allocation->ip : null,
                    $server->node ? $server->node->fqdn : null,
                    '127.0.0.1',
                ]));

                foreach ($candidates as $host) {
                    $pingData = $isBedrock
                        ? $this->pingBedrock($host, $allocation->port, 0.6)
                        : $this->pingJava($host, $allocation->port, 0.6);

                    if ($pingData !== null) {
                        $result['online'] = $pingData['online'];
                        $result['max'] = $pingData['max'] > 0 ? $pingData['max'] : $maxSlots;
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

            // 3. Fallback: check Wings logs buffer without sending commands
            $log = $this->readLog($server);
            if (!empty($log)) {
                $counts = $this->extractCounts($log);
                if ($counts['online'] !== null) {
                    $result['online'] = $counts['online'];
                    $result['status'] = 'running';
                }
                if ($counts['max'] !== null && $result['max'] === null) {
                    $result['max'] = $counts['max'];
                }
            }
        } else {
            // Non-Minecraft servers (generic, FiveM, SAMP, etc.)
            try {
                $variable = $server->variables()->whereIn('env_variable', ['MAX_PLAYERS', 'SLOTS', 'MAXPLAYERS', 'SERVER_SLOTS'])->first();
                if ($variable && is_numeric($variable->server_value)) {
                    $result['max'] = (int) $variable->server_value;
                }
            } catch (\Throwable) {}
        }

        Cache::put($cacheKey, $result, 8);
        return response()->json($result);
    }

    /**
     * Minecraft Java Server List Ping (SLP) via TCP socket.
     */
    private function pingJava(string $host, int $port, float $timeout = 0.6): ?array
    {
        $start = microtime(true);
        $socket = @stream_socket_client("tcp://{$host}:{$port}", $errno, $errstr, $timeout);
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
            $chunk = @fread($socket, min($remaining, 4096));
            if ($chunk === false || strlen($chunk) === 0) break;
            $jsonStr .= $chunk;
            $remaining -= strlen($chunk);
        }

        @fclose($socket);
        $ping = round((microtime(true) - $start) * 1000);

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
    private function pingBedrock(string $host, int $port, float $timeout = 0.6): ?array
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
                '%s://%s:%d/api/servers/%s/logs',
                $node->scheme,
                $node->fqdn,
                $node->daemonListen,
                $server->uuid
            );

            $res = Http::withToken($token)->timeout(2)->get($url);
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

            if (preg_match('/there are (\d+)(?:\s*\/\s*|\D+of\D+max\D*of\D*|\D+of\D+max\D*)(\d+)/i', $clean, $m)) {
                return ['online' => (int) $m[1], 'max' => (int) $m[2]];
            }
        }

        return ['online' => null, 'max' => null];
    }
}
