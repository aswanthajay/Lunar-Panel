<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\FiveM;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Repositories\Wings\DaemonCommandRepository;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class FiveMPlayerController extends ClientApiController
{
    public function __construct(
        private DaemonCommandRepository $commandRepository,
        private DaemonFileRepository $fileRepository
    ) {
        parent::__construct();
    }

    /**
     * Return live connected player list and server metadata for a FiveM instance.
     * Enriches players with IP, GeoIP, HWID tokens, SteamID64, playtime, and all identifiers.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        if (!$server->isFiveM()) {
            throw new AccessDeniedHttpException('This feature is only available for FiveM / Cfx.re servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $allocation = $server->allocation;
        $port = $allocation ? ($allocation->port ?: 30120) : 30120;

        $candidates = array_unique(array_filter([
            '127.0.0.1',
            $allocation?->alias ?: null,
            $allocation && $allocation->ip !== '0.0.0.0' ? $allocation->ip : null,
            $server->node ? $server->node->fqdn : null,
        ]));

        $rawPlayers = null;
        $dynamicData = null;
        $infoData = null;

        // 1. Attempt local FXServer queries
        foreach ($candidates as $host) {
            try {
                $pRes = Http::timeout(1.5)->get("http://{$host}:{$port}/players.json");
                if ($pRes->successful() && is_array($pRes->json())) {
                    $rawPlayers = $pRes->json();

                    try {
                        $dRes = Http::timeout(1.0)->get("http://{$host}:{$port}/dynamic.json");
                        if ($dRes->successful()) {
                            $dynamicData = $dRes->json();
                        }
                    } catch (\Throwable) {}

                    try {
                        $iRes = Http::timeout(1.0)->get("http://{$host}:{$port}/info.json");
                        if ($iRes->successful()) {
                            $infoData = $iRes->json();
                        }
                    } catch (\Throwable) {}

                    break;
                }
            } catch (\Throwable) {}
        }

        $cfxId = $this->resolveCfxId($server);

        // 2. Fallback to Official Cfx.re Frontend API if local query failed or to enrich data
        if ($rawPlayers === null && $cfxId) {
            try {
                $cfxRes = Http::withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
                ])->timeout(3)->get("https://servers-frontend.fivem.net/api/servers/single/{$cfxId}");

                if ($cfxRes->successful()) {
                    $data = $cfxRes->json('Data');
                    if (is_array($data)) {
                        $rawPlayers = $data['players'] ?? [];
                        $dynamicData = [
                            'clients' => $data['clients'] ?? count($rawPlayers),
                            'sv_maxclients' => $data['sv_maxclients'] ?? null,
                            'hostname' => $data['hostname'] ?? null,
                            'gametype' => $data['gametype'] ?? ($data['vars']['gamename'] ?? 'FiveM'),
                            'mapname' => $data['mapname'] ?? null,
                        ];
                        $infoData = [
                            'vars' => $data['vars'] ?? [],
                        ];
                    }
                }
            } catch (\Throwable) {}
        }

        // Fetch txAdmin player DB records (for HWID tokens and playtime)
        $txDb = $this->getTxAdminPlayersDb($server);

        // Fetch recent connection logs for IP resolution if endpointprivacy hid endpoints
        $logIps = $this->resolvePlayerIpsFromLogs($server);

        // Format connected players with comprehensive details
        $parsedPlayers = [];
        if (is_array($rawPlayers)) {
            foreach ($rawPlayers as $p) {
                if (!is_array($p)) continue;

                $id = (int) ($p['id'] ?? 0);
                $name = (string) ($p['name'] ?? 'Player');
                $ping = isset($p['ping']) ? (int) $p['ping'] : null;

                $identifiers = [];
                $rawIds = $p['identifiers'] ?? [];
                foreach ($rawIds as $idStr) {
                    $parts = explode(':', (string) $idStr, 2);
                    if (count($parts) === 2) {
                        $identifiers[strtolower($parts[0])] = $parts[1];
                    }
                }

                // Resolve Steam ID64 if Steam Hex is present
                if (!empty($identifiers['steam'])) {
                    $steamHex = ltrim(strtolower($identifiers['steam']), 'steam:');
                    if (ctype_xdigit($steamHex)) {
                        $identifiers['steam_id64'] = $this->hexToDec($steamHex);
                    }
                }

                // Resolve IP and port from endpoint or identifiers or recent logs
                $endpoint = $p['endpoint'] ?? null;
                $ip = null;
                $connectionPort = null;

                if (!empty($endpoint) && is_string($endpoint)) {
                    if (str_contains($endpoint, ':')) {
                        $epParts = explode(':', $endpoint);
                        $ip = $epParts[0];
                        $connectionPort = (int) ($epParts[1] ?? 0);
                    } else {
                        $ip = $endpoint;
                    }
                } elseif (!empty($identifiers['ip'])) {
                    $ip = $identifiers['ip'];
                } elseif (isset($logIps["id:{$id}"])) {
                    $ip = $logIps["id:{$id}"]['ip'];
                    $connectionPort = $logIps["id:{$id}"]['port'];
                } elseif (isset($logIps["name:" . strtolower($name)])) {
                    $ip = $logIps["name:" . strtolower($name)]['ip'];
                    $connectionPort = $logIps["name:" . strtolower($name)]['port'];
                }

                // GeoIP Lookup (cached for 24h)
                $geo = $this->resolveGeoIp($ip);

                // Hardware ID (HWID tokens) resolution from txAdmin or raw identifiers
                $hwids = [];
                if (!empty($p['hwids']) && is_array($p['hwids'])) {
                    $hwids = $p['hwids'];
                } elseif (!empty($p['tokens']) && is_array($p['tokens'])) {
                    $hwids = $p['tokens'];
                }

                // Match against txAdmin database for HWIDs and playtime
                $txRecord = null;
                if (!empty($identifiers['license'])) {
                    $licKey = 'lic:' . strtolower(str_replace('license:', '', $identifiers['license']));
                    $cleanLic = strtolower(str_replace('license:', '', $identifiers['license']));
                    $txRecord = $txDb[$licKey] ?? $txDb[$cleanLic] ?? $txDb["license:{$cleanLic}"] ?? null;
                }
                if (!$txRecord && !empty($identifiers['license2'])) {
                    $licKey2 = 'lic:' . strtolower(str_replace('license2:', '', $identifiers['license2']));
                    $cleanLic2 = strtolower(str_replace('license2:', '', $identifiers['license2']));
                    $txRecord = $txDb[$licKey2] ?? $txDb[$cleanLic2] ?? $txDb["license:{$cleanLic2}"] ?? null;
                }
                if (!$txRecord && !empty($identifiers['discord'])) {
                    $cleanDiscord = strtolower(str_replace('discord:', '', $identifiers['discord']));
                    $txRecord = $txDb['discord:' . $identifiers['discord']] ?? $txDb[$identifiers['discord']] ?? $txDb[$cleanDiscord] ?? null;
                }
                if (!$txRecord && !empty($identifiers['steam'])) {
                    $cleanSteam = strtolower(str_replace('steam:', '', $identifiers['steam']));
                    $txRecord = $txDb['steam:' . $identifiers['steam']] ?? $txDb[$identifiers['steam']] ?? $txDb[$cleanSteam] ?? null;
                }
                if (!$txRecord && !empty($identifiers['fivem'])) {
                    $cleanFivem = strtolower(str_replace('fivem:', '', $identifiers['fivem']));
                    $txRecord = $txDb['fivem:' . $identifiers['fivem']] ?? $txDb[$identifiers['fivem']] ?? $txDb[$cleanFivem] ?? null;
                }
                if (!$txRecord && !empty($name) && strtolower($name) !== 'player') {
                    $txRecord = $txDb['name:' . strtolower($name)] ?? null;
                }
                // Fallback: If player has no identifiers or generic name "Player", check if txAdmin has a recent connection (__latest__)
                if (!$txRecord && isset($txDb['__latest__'])) {
                    $latestTs = $txDb['__latest__']['last_seen_ts'] ?? 0;
                    if ($latestTs === 0 || (time() - $latestTs) < 86400) {
                        $txRecord = $txDb['__latest__'];
                    }
                }

                $playTimeMinutes = null;
                $playTimeFormatted = null;
                $firstJoined = null;
                $lastSeen = null;

                if ($txRecord) {
                    if (empty($hwids) && !empty($txRecord['hwids'])) {
                        $hwids = $txRecord['hwids'];
                    }
                    // Merge any missing platform identifiers from txAdmin
                    if (!empty($txRecord['ids'])) {
                        foreach ($txRecord['ids'] as $idStr) {
                            $parts = explode(':', (string) $idStr, 2);
                            if (count($parts) === 2) {
                                $idType = strtolower($parts[0]);
                                if (empty($identifiers[$idType])) {
                                    $identifiers[$idType] = $parts[1];
                                }
                                if (!in_array((string) $idStr, $rawIds)) {
                                    $rawIds[] = (string) $idStr;
                                }
                            }
                        }
                    }
                    // Use real display name if current name is generic "Player"
                    if (($name === 'Player' || empty($name)) && !empty($txRecord['displayName'])) {
                        $name = $txRecord['displayName'];
                    }
                    // Fallback to txAdmin recent recorded external IP if current IP is empty or loopback
                    if ((empty($ip) || $ip === '127.0.0.1' || $ip === 'localhost') && !empty($txRecord['recentIp'])) {
                        $ip = $txRecord['recentIp'];
                        $geo = $this->resolveGeoIp($ip);
                    }
                    if (isset($txRecord['play_time_minutes'])) {
                        $playTimeMinutes = $txRecord['play_time_minutes'];
                        $playTimeFormatted = $this->formatPlaytime($playTimeMinutes);
                    }
                    $firstJoined = $txRecord['first_joined'] ?? null;
                    $lastSeen = $txRecord['last_seen'] ?? null;
                }

                // Resolve Steam ID64 if Steam Hex was populated from txAdmin
                if (!empty($identifiers['steam']) && empty($identifiers['steam_id64'])) {
                    $steamHex = ltrim(strtolower($identifiers['steam']), 'steam:');
                    if (ctype_xdigit($steamHex)) {
                        $identifiers['steam_id64'] = $this->hexToDec($steamHex);
                    }
                }

                // Extract any token identifiers from raw_identifiers if still missing
                if (empty($hwids)) {
                    foreach ($rawIds as $idStr) {
                        if (str_starts_with($idStr, 'token:') || str_starts_with($idStr, 'hwid:')) {
                            $hwids[] = $idStr;
                        }
                    }
                }

                $parsedPlayers[] = [
                    'id' => $id,
                    'name' => $name,
                    'ping' => $ping,
                    'endpoint' => $endpoint,
                    'ip' => $ip,
                    'port' => $connectionPort,
                    'geo' => $geo,
                    'hwids' => array_values(array_unique($hwids)),
                    'identifiers' => $identifiers,
                    'raw_identifiers' => $rawIds,
                    'play_time' => $playTimeFormatted,
                    'play_time_minutes' => $playTimeMinutes,
                    'first_joined' => $firstJoined,
                    'last_seen' => $lastSeen,
                ];
            }
        }

        $maxSlots = isset($dynamicData['sv_maxclients'])
            ? (int) $dynamicData['sv_maxclients']
            : $this->resolveFiveMMMaxSlots($server);

        $serverName = $infoData['vars']['sv_projectName']
            ?? ($dynamicData['hostname']
            ?? $server->name);

        $gametype = $dynamicData['gametype'] ?? ($infoData['vars']['gametype'] ?? 'FiveM RP');
        $mapname = $dynamicData['mapname'] ?? ($infoData['vars']['mapname'] ?? 'Los Santos');

        return response()->json([
            'offline' => $rawPlayers === null,
            'online' => count($parsedPlayers),
            'max' => $maxSlots,
            'server_name' => $serverName,
            'project_desc' => $infoData['vars']['sv_projectDesc'] ?? null,
            'gametype' => $gametype,
            'mapname' => $mapname,
            'cfx_id' => $cfxId,
            'join_url' => $cfxId ? "fivem://connect/cfx.re/join/{$cfxId}" : null,
            'players' => $parsedPlayers,
        ]);
    }

    /**
     * Perform an action on the FiveM server (kick player, ban player, whisper/pm, global broadcast).
     */
    public function action(Request $request, Server $server): JsonResponse
    {
        if (!$server->isFiveM()) {
            throw new AccessDeniedHttpException('This feature is only available for FiveM / Cfx.re servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $action = (string) $request->input('action');

        switch ($action) {
            case 'kick':
                $id = (int) $request->input('player_id');
                $reason = trim((string) $request->input('reason', 'Kicked from server'));
                if ($id < 0) {
                    return response()->json(['error' => 'A valid player ID is required.'], 400);
                }

                try {
                    $repo = $this->commandRepository->setServer($server);
                    $repo->send("client.kick {$id} \"{$reason}\"");
                    $repo->send("kick {$id} \"{$reason}\"");

                    Activity::event('server:fivem.kick-player')
                        ->property('player_id', $id)
                        ->property('reason', $reason)
                        ->log();

                    return response()->json(['success' => true, 'message' => "Player #{$id} has been kicked."]);
                } catch (\Throwable $e) {
                    return response()->json(['error' => 'Failed to dispatch kick command: ' . $e->getMessage()], 500);
                }

            case 'ban':
                $id = (int) $request->input('player_id');
                $duration = trim((string) $request->input('duration', '24h'));
                $reason = trim((string) $request->input('reason', 'Banned by administrator'));
                if ($id < 0) {
                    return response()->json(['error' => 'A valid player ID is required.'], 400);
                }

                try {
                    $repo = $this->commandRepository->setServer($server);
                    $repo->send("tempban {$id} {$duration} \"{$reason}\"");
                    $repo->send("ban {$id} \"{$reason}\"");
                    $repo->send("client.kick {$id} \"Banned ({$duration}): {$reason}\"");

                    Activity::event('server:fivem.ban-player')
                        ->property('player_id', $id)
                        ->property('duration', $duration)
                        ->property('reason', $reason)
                        ->log();

                    return response()->json(['success' => true, 'message' => "Player #{$id} banned ({$duration})."]);
                } catch (\Throwable $e) {
                    return response()->json(['error' => 'Failed to dispatch ban command: ' . $e->getMessage()], 500);
                }

            case 'whisper':
            case 'message':
                $id = (int) $request->input('player_id');
                $message = trim((string) $request->input('message'));
                if ($id < 0 || empty($message)) {
                    return response()->json(['error' => 'A valid player ID and message are required.'], 400);
                }

                try {
                    $repo = $this->commandRepository->setServer($server);
                    $repo->send("tell {$id} \"[ADMIN]: {$message}\"");
                    $repo->send("pm {$id} \"[ADMIN]: {$message}\"");

                    Activity::event('server:fivem.whisper-player')
                        ->property('player_id', $id)
                        ->property('message', $message)
                        ->log();

                    return response()->json(['success' => true, 'message' => "Whisper sent to Player #{$id}."]);
                } catch (\Throwable $e) {
                    return response()->json(['error' => 'Failed to send whisper: ' . $e->getMessage()], 500);
                }

            case 'broadcast':
                $message = trim((string) $request->input('message'));
                if (empty($message)) {
                    return response()->json(['error' => 'Announcement message cannot be empty.'], 400);
                }

                try {
                    $this->commandRepository->setServer($server)->send("say {$message}");

                    Activity::event('server:fivem.broadcast')
                        ->property('message', $message)
                        ->log();

                    return response()->json(['success' => true, 'message' => 'Announcement sent to chat.']);
                } catch (\Throwable $e) {
                    return response()->json(['error' => 'Failed to send announcement: ' . $e->getMessage()], 500);
                }

            default:
                return response()->json(['error' => 'Unsupported action.'], 400);
        }
    }

    /**
     * Resolves txAdmin player database records for HWID tokens and playtime.
     */
    private function getTxAdminPlayersDb(Server $server): array
    {
        return Cache::remember("server:{$server->id}:txadmin_db", 30, function () use ($server) {
            $candidates = [
                '/txData/default/data/playersDB.json',
                '/txData/default/playersDB.json',
                '/txData/CFXDefault_default/data/playersDB.json',
                '/txData/CFXDefault_default.base/data/playersDB.json',
                '/txData/QBCore_default.base/data/playersDB.json',
                '/txData/ESX_default.base/data/playersDB.json',
                '/txData/v8_default/data/playersDB.json',
                '/txData/v8_default/playersDB.json',
                '/txData/data/playersDB.json',
                '/txData/playersDB.json',
                '/txdata/default/data/playersDB.json',
                '/txdata/default/playersDB.json',
                '/txAdmin/default/data/playersDB.json',
                '/txAdmin/default/playersDB.json',
                '/data/playersDB.json',
                '/playersDB.json',
            ];

            $repo = $this->fileRepository->setServer($server);

            // Dynamically scan root directory '/' for any folders containing 'tx' (case-insensitive)
            $rootFolders = ['/txData', '/txdata', '/txAdmin', '/txadmin'];
            try {
                $rootItems = $repo->getDirectory('/');
                foreach ($rootItems as $ri) {
                    $rname = $ri['name'] ?? '';
                    if (!empty($rname) && ($ri['mode'] ?? '')[0] === 'd') {
                        if (stripos($rname, 'tx') !== false && !in_array("/{$rname}", $rootFolders)) {
                            $rootFolders[] = "/{$rname}";
                        }
                    }
                }
            } catch (\Throwable) {}

            // Dynamically scan profile folders within each tx folder
            foreach ($rootFolders as $folder) {
                try {
                    $items = $repo->getDirectory($folder);
                    foreach ($items as $item) {
                        $name = $item['name'] ?? '';
                        if (!empty($name) && ($item['mode'] ?? '')[0] === 'd') {
                            $candidates[] = "{$folder}/{$name}/data/playersDB.json";
                            $candidates[] = "{$folder}/{$name}/playersDB.json";
                        }
                    }
                } catch (\Throwable) {}
            }

            $candidates = array_unique($candidates);

            foreach ($candidates as $path) {
                try {
                    $content = $repo->getContent($path, 15 * 1024 * 1024);
                    $json = json_decode($content, true);
                    if (is_array($json)) {
                        $players = isset($json['players']) && is_array($json['players']) ? $json['players'] : $json;
                        $indexed = [];
                        $latestRecord = null;
                        $latestTs = 0;

                        foreach ($players as $entry) {
                            if (!is_array($entry)) continue;
                            $hwids = $entry['hwids'] ?? [];
                            $playTime = $entry['playTime'] ?? 0;
                            $joined = $entry['tsJoined'] ?? null;
                            $lastSeen = $entry['tsLastConnection'] ?? null;
                            $ids = $entry['ids'] ?? [];
                            $ips = $entry['ips'] ?? [];
                            $recentIp = $entry['recentIp'] ?? ($entry['ip'] ?? null);
                            if (empty($recentIp) && is_array($ips) && count($ips) > 0) {
                                foreach (array_reverse($ips) as $candidateIp) {
                                    $c = trim((string) $candidateIp);
                                    if (!empty($c) && !str_starts_with($c, '127.') && $c !== 'localhost') {
                                        $recentIp = $c;
                                        break;
                                    }
                                }
                                if (empty($recentIp)) {
                                    $recentIp = end($ips);
                                }
                            }
                            $displayName = $entry['displayName'] ?? null;
                            $pureName = $entry['pureName'] ?? null;

                            $rec = [
                                'hwids' => is_array($hwids) ? array_values($hwids) : [],
                                'ids' => is_array($ids) ? $ids : [],
                                'ips' => is_array($ips) ? array_values($ips) : [],
                                'recentIp' => $recentIp,
                                'displayName' => $displayName,
                                'pureName' => $pureName,
                                'play_time_minutes' => (int) $playTime,
                                'first_joined' => $joined ? date('Y-m-d H:i:s', $joined) : null,
                                'last_seen' => $lastSeen ? date('Y-m-d H:i:s', $lastSeen) : null,
                                'last_seen_ts' => $lastSeen ? (int) $lastSeen : 0,
                            ];

                            if (!empty($entry['license'])) {
                                $lic = strtolower(str_replace('license:', '', (string) $entry['license']));
                                $indexed["lic:{$lic}"] = $rec;
                                $indexed[$lic] = $rec;
                                $indexed["license:{$lic}"] = $rec;
                            }

                            if (is_array($ids)) {
                                foreach ($ids as $idStr) {
                                    $idStrLower = strtolower((string) $idStr);
                                    $indexed[$idStrLower] = $rec;
                                    $cleanId = preg_replace('/^[a-z0-9]+:/i', '', $idStrLower);
                                    if (!empty($cleanId)) {
                                        $indexed[$cleanId] = $rec;
                                    }
                                }
                            }

                            if (!empty($pureName)) {
                                $indexed["name:" . strtolower((string) $pureName)] = $rec;
                            }
                            if (!empty($displayName)) {
                                $indexed["name:" . strtolower((string) $displayName)] = $rec;
                            }

                            if ($lastSeen && (int) $lastSeen > $latestTs) {
                                $latestTs = (int) $lastSeen;
                                $latestRecord = $rec;
                            }
                        }

                        if ($latestRecord) {
                            $indexed['__latest__'] = $latestRecord;
                        }

                        return $indexed;
                    }
                } catch (\Throwable) {}
            }
            return [];
        });
    }

    /**
     * Scans recent server logs for connection records to resolve player IPs if endpointprivacy is on.
     */
    private function resolvePlayerIpsFromLogs(Server $server): array
    {
        return Cache::remember("server:{$server->id}:log_player_ips", 30, function () use ($server) {
            $ips = [];
            try {
                $node = $server->node;
                if (!$node) return [];

                $token = $node->getDecryptedKey();
                $url = sprintf('%s://%s:%d/api/servers/%s/logs', $node->scheme, $node->fqdn, $node->daemonListen, $server->uuid);
                $res = Http::withToken($token)->timeout(1.5)->get($url);
                if ($res->successful()) {
                    $data = $res->json()['data'] ?? [];
                    $logText = is_array($data) ? implode("\n", $data) : (string) $data;

                    if (preg_match_all('/(?:Connecting|connected):\s*([^\r\n\[(]+?)\s*\(.*?(?:endpoint:\s*)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d+))?\)/i', $logText, $m, PREG_SET_ORDER)) {
                        foreach ($m as $match) {
                            $name = strtolower(trim($match[1]));
                            $ips["name:{$name}"] = [
                                'ip' => $match[2],
                                'port' => !empty($match[3]) ? (int) $match[3] : null,
                            ];
                        }
                    }
                    if (preg_match_all('/\[txAdmin.*?\]\s+Player\s+(.+?)\s+\(id\s+(\d+)\)\s+connected\s+from\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i', $logText, $m, PREG_SET_ORDER)) {
                        foreach ($m as $match) {
                            $ips["id:{$match[2]}"] = [
                                'ip' => $match[3],
                                'port' => null,
                            ];
                            $ips["name:" . strtolower(trim($match[1]))] = [
                                'ip' => $match[3],
                                'port' => null,
                            ];
                        }
                    }
                }
            } catch (\Throwable) {}
            return $ips;
        });
    }

    /**
     * Resolves GeoIP data for a given IP address, cached for 24 hours.
     */
    private function resolveGeoIp(?string $ip): ?array
    {
        if (empty($ip)) return null;

        // Check for loopback / private IP ranges
        if (
            $ip === '127.0.0.1' ||
            $ip === '::1' ||
            $ip === '0.0.0.0' ||
            str_starts_with($ip, '10.') ||
            str_starts_with($ip, '192.168.') ||
            preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $ip)
        ) {
            return [
                'country' => 'Local Network',
                'country_code' => 'LOC',
                'city' => 'Internal LAN / Host',
                'isp' => 'Local Loopback',
                'is_local' => true,
            ];
        }

        return Cache::remember("geoip:{$ip}", 86400, function () use ($ip) {
            try {
                $res = Http::timeout(1.2)->get("http://ip-api.com/json/{$ip}?fields=status,country,countryCode,city,isp");
                if ($res->successful() && $res->json('status') === 'success') {
                    return [
                        'country' => $res->json('country'),
                        'country_code' => $res->json('countryCode'),
                        'city' => $res->json('city'),
                        'isp' => $res->json('isp'),
                        'is_local' => false,
                    ];
                }
            } catch (\Throwable) {}
            return null;
        });
    }

    /**
     * Converts a hex string to decimal string using bcmath.
     */
    private function hexToDec(string $hex): string
    {
        $hex = strtolower(trim($hex));
        $dec = '0';
        $len = strlen($hex);
        for ($i = 0; $i < $len; $i++) {
            $current = hexdec($hex[$i]);
            $dec = bcadd(bcmul($dec, '16'), (string) $current);
        }
        return $dec;
    }

    /**
     * Formats total minutes into human readable hours and minutes.
     */
    private function formatPlaytime(int $minutes): string
    {
        if ($minutes < 60) {
            return "{$minutes}m";
        }
        $hours = floor($minutes / 60);
        $rem = $minutes % 60;
        return $rem > 0 ? "{$hours}h {$rem}m" : "{$hours}h";
    }

    /**
     * Resolves CFX Join ID from server variables, server.cfg, or server logs.
     */
    private function resolveCfxId(Server $server): ?string
    {
        return Cache::remember("server:{$server->id}:cfx_id", 300, function () use ($server) {
            try {
                $var = $server->variables()->whereIn('env_variable', ['CFX_ID', 'JOIN_ID', 'CFX_JOIN_ID', 'FIVEM_JOIN_ID'])->first();
                if ($var && !empty($var->server_value)) {
                    return trim($var->server_value);
                }

                $node = $server->node;
                if ($node) {
                    $token = $node->getDecryptedKey();
                    $url = sprintf('%s://%s:%d/api/servers/%s/logs', $node->scheme, $node->fqdn, $node->daemonListen, $server->uuid);
                    $res = Http::withToken($token)->timeout(2)->get($url);
                    if ($res->successful()) {
                        $data = $res->json()['data'] ?? [];
                        $log = is_array($data) ? implode("\n", $data) : (string) $data;
                        if (preg_match('/(?:cfx\.re\/join\/|join code:?\s*|join ID:?\s*)([a-z0-9]{4,10})/i', $log, $m)) {
                            return trim($m[1]);
                        }
                    }
                }
            } catch (\Throwable) {}
            return null;
        });
    }

    /**
     * Resolves configured max slots for FiveM from server.cfg or variables.
     */
    private function resolveFiveMMMaxSlots(Server $server): int
    {
        return Cache::remember("server:{$server->id}:fivem_max_players", 300, function () use ($server) {
            try {
                $variable = $server->variables()->whereIn('env_variable', ['MAX_PLAYERS', 'SLOTS', 'SV_MAXCLIENTS', 'MAXPLAYERS'])->first();
                if ($variable) {
                    $val = !empty($variable->server_value) ? $variable->server_value : $variable->default_value;
                    if (is_numeric($val) && (int) $val > 0) {
                        return (int) $val;
                    }
                }

                $repo = $this->fileRepository->setServer($server);
                $content = $repo->getContent('/server.cfg');
                if (preg_match('/(?:sv_maxclients|sv_maxClients)\s+["\']?(\d+)["\']?/i', $content, $m)) {
                    return (int) $m[1];
                }
            } catch (\Throwable) {}
            return 32;
        });
    }
}
