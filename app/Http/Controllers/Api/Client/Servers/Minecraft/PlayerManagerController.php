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

        try {
            $this->commandRepository->setServer($server)->send('list');
        } catch (\Throwable $e) {
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

        usleep(800_000);
        $log = $this->readLog($server);

        $players = $this->extractPlayers($log);
        $counts = $this->extractCounts($log);

        return response()->json([
            'players' => array_map(fn($n) => ['name' => $n], $players),
            'online' => $counts['online'] ?? count($players),
            'max' => $counts['max'],
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
        $token = $node->daemon_token ?? $node->daemonSecret ?? null;
        if ($token && str_starts_with($token, 'eyJpdiI6')) {
            try {
                $token = decrypt($token);
            } catch (\Throwable) {}
        }

        $url = sprintf(
            '%s://%s:%d/api/servers/%s/logs',
            $node->scheme,
            $node->fqdn,
            $node->daemonListen,
            $server->uuid
        );

        try {
            $res = Http::withToken($token)->timeout(6)->get($url);
            if ($res->successful()) {
                $data = $res->json()['data'] ?? [];
                return is_array($data) ? implode("\n", $data) : (string) $data;
            }
        } catch (\Throwable) {}

        return '';
    }

    private function extractPlayers(string $log): array
    {
        $lines = array_reverse(preg_split('/\r?\n/', $log));

        foreach ($lines as $i => $line) {
            $clean = preg_replace('/\x1b\[[0-9;]*m/', '', $line);
            $clean = preg_replace('/^\[[^\]]*\]\s*/', '', $clean);
            $clean = preg_replace('/^\[[^\]]*\]:\s*/', '', $clean);

            if (!preg_match('/players? online/i', $clean)) continue;

            $pos = strrpos($clean, ':');
            if ($pos !== false) {
                $tail = trim(substr($clean, $pos + 1));
                if ($tail !== '') {
                    return $this->cleanNames($tail);
                }
            }

            if ($i > 0) {
                $next = preg_replace('/\x1b\[[0-9;]*m/', '', $lines[$i - 1]);
                $next = preg_replace('/^\[[^\]]*\]\s*/', '', $next);
                $next = trim(preg_replace('/^\[[^\]]*\]:\s*/', '', $next));

                if ($next !== '' && !preg_match('/players? online|^\W*$/i', $next)) {
                    return $this->cleanNames($next);
                }
            }

            return [];
        }

        return [];
    }

    private function cleanNames(string $text): array
    {
        $parts = preg_split('/[,\s]+/', $text);
        $out = [];

        foreach ($parts as $p) {
            $p = trim($p, " \t\n\r\0\x0B,.:");
            if ($p !== '' && preg_match('/^[\w.\-]{2,32}$/', $p)) {
                $out[] = $p;
            }
        }

        return array_values(array_unique($out));
    }

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
