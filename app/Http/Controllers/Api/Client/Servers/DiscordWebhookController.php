<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Services\Discord\DiscordWebhookService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class DiscordWebhookController extends ClientApiController
{
    public function __construct(private DiscordWebhookService $webhookService)
    {
        parent::__construct();
    }

    /**
     * Get Discord webhook configuration for a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        return new JsonResponse([
            'configured' => !empty($server->discord_webhook_url),
            'webhook_url' => $server->discord_webhook_url,
            'events' => $server->discord_webhook_events ?? DiscordWebhookService::ALL_EVENTS,
        ]);
    }

    /**
     * Update Discord webhook configuration for a server.
     */
    public function update(Request $request, Server $server): JsonResponse
    {
        $this->validate($request, [
            'webhook_url' => 'nullable|string',
            'events' => 'sometimes|nullable|array',
        ]);

        $url = trim($request->input('webhook_url') ?? '');

        if (!empty($url) && !$this->webhookService->isValidWebhookUrl($url)) {
            return new JsonResponse([
                'success' => false,
                'message' => 'The provided URL is not a valid Discord webhook endpoint. Discord webhook URLs look like: https://discord.com/api/webhooks/123456789/abcdef...',
            ], 422);
        }

        $server->discord_webhook_url = !empty($url) ? $url : null;

        if ($request->has('events')) {
            $server->discord_webhook_events = $request->input('events');
        }

        $server->save();

        Activity::event('server:settings.discord-webhook')
            ->property(['configured' => !empty($server->discord_webhook_url)])
            ->log();

        return new JsonResponse([
            'success' => true,
            'configured' => !empty($server->discord_webhook_url),
            'webhook_url' => $server->discord_webhook_url,
            'events' => $server->discord_webhook_events ?? DiscordWebhookService::ALL_EVENTS,
            'message' => !empty($server->discord_webhook_url)
                ? 'Discord webhook alerts enabled successfully.'
                : 'Discord webhook alerts disabled.',
        ]);
    }

    /**
     * Send a test alert to the Discord webhook.
     */
    public function test(Request $request, Server $server): JsonResponse
    {
        $this->validate($request, [
            'webhook_url' => 'nullable|string',
        ]);

        $url = trim($request->input('webhook_url') ?? ($server->discord_webhook_url ?? ''));

        if (empty($url)) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Please provide a Discord webhook URL to test.',
            ], 422);
        }

        $result = $this->webhookService->sendTestNotification($server, $url);

        if (!$result['success']) {
            return new JsonResponse([
                'success' => false,
                'message' => $result['error'] ?? 'Discord webhook test delivery failed.',
            ], 400);
        }

        return new JsonResponse([
            'success' => true,
            'message' => $result['message'] ?? 'Discord test notification delivered successfully!',
        ]);
    }
}
