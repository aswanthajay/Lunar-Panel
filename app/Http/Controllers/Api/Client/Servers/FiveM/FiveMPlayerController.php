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
            $allocation?->alias ?: null,
            $allocation && $allocation->ip !== '0.0.0.0' ? $allocation->ip : null,
            $server->node ? $server->node->fqdn : null,
            '127.0.0.1',
        ]));

        $rawPlayers = null;
        $dynamicData = null;
        $infoData = null;

        // 1. Attempt local FXServer queries
        foreach ($candidates as $host) {
            try {
                $pRes = Http::timeout(0.8)->get("http://{$host}:{$port}/players.json");
                if ($pRes->successful() && is_array($pRes->json())) {
                    $rawPlayers = $pRes->json();

                    try {
                        $dRes = Http::timeout(0.6)->get("http://{$host}:{$port}/dynamic.json");
                        if ($dRes->successful()) {
                            $dynamicData = $dRes->json();
                        }
                    } catch (\Throwable) {}

                    try {
                        $iRes = Http::timeout(0.6)->get("http://{$host}:{$port}/info.json");
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
                ])->timeout(2)->get("https://servers-frontend.fivem.net/api/servers/single/{$cfxId}");

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

        // Format connected players
        $parsedPlayers = [];
        if (is_array($rawPlayers)) {
            foreach ($rawPlayers as $p) {
                if (!is_array($p)) continue;

                $identifiers = [];
                $rawIds = $p['identifiers'] ?? [];
                foreach ($rawIds as $idStr) {
                    $parts = explode(':', (string) $idStr, 2);
                    if (count($parts) === 2) {
                        $identifiers[strtolower($parts[0])] = $parts[1];
                    }
                }

                $parsedPlayers[] = [
                    'id' => (int) ($p['id'] ?? 0),
                    'name' => (string) ($p['name'] ?? 'Player'),
                    'ping' => isset($p['ping']) ? (int) $p['ping'] : null,
                    'identifiers' => $identifiers,
                    'raw_identifiers' => $rawIds,
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
     * Perform an action on the FiveM server (kick player, global broadcast).
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
                if ($id <= 0) {
                    return response()->json(['error' => 'A valid player ID is required.'], 400);
                }

                // Send kick commands to console
                try {
                    $repo = $this->commandRepository->setServer($server);
                    $repo->send("client.kick {$id} \"{$reason}\"");
                    $repo->send("kick {$id} \"{$reason}\"");

                    Activity::event('server:fivem.kick-player')
                        ->property('player_id', $id)
                        ->property('reason', $reason)
                        ->log();

                    return response()->json(['success' => true, 'message' => "Player #{$id} kicked."]);
                } catch (\Throwable $e) {
                    return response()->json(['error' => 'Failed to dispatch kick command: ' . $e->getMessage()], 500);
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
                if ($variable && is_numeric($variable->server_value)) {
                    return (int) $variable->server_value;
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
