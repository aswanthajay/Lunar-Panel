<?php

namespace Pterodactyl\Services\Discord;

use Carbon\Carbon;
use Pterodactyl\Models\Server;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class DiscordWebhookService
{
    public const EVENT_START = 'start';
    public const EVENT_STOP = 'stop';
    public const EVENT_RESTART = 'restart';
    public const EVENT_KILL = 'kill';
    public const EVENT_CRASH = 'crash';
    public const EVENT_INSTALL = 'install';
    public const EVENT_TEST = 'test';

    public const ALL_EVENTS = [
        self::EVENT_START,
        self::EVENT_STOP,
        self::EVENT_RESTART,
        self::EVENT_KILL,
        self::EVENT_CRASH,
        self::EVENT_INSTALL,
    ];

    /**
     * Validate whether a string is a legitimate Discord webhook URL.
     */
    public function isValidWebhookUrl(?string $url): bool
    {
        if (empty($url)) {
            return false;
        }

        return (bool) preg_match(
            '/^https:\/\/(?:ptb\.|canary\.)?(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/i',
            trim($url)
        );
    }

    /**
     * Send an event notification to the server's configured Discord webhook.
     */
    public function sendNotification(Server $server, string $event, array $extra = []): bool
    {
        $webhookUrl = trim($server->discord_webhook_url ?? '');
        if (empty($webhookUrl) || !$this->isValidWebhookUrl($webhookUrl)) {
            return false;
        }

        // Check if server configured specific events filter
        $allowedEvents = $server->discord_webhook_events;
        if (is_array($allowedEvents) && !empty($allowedEvents) && !in_array($event, $allowedEvents)) {
            return false;
        }

        $payload = $this->buildPayload($server, $event, $extra);

        try {
            $response = Http::timeout(5)->post($webhookUrl, $payload);
            if (!$response->successful()) {
                Log::warning("Discord webhook notification failed for server [{$server->uuid}]: HTTP {$response->status()} - {$response->body()}");
                return false;
            }
            return true;
        } catch (\Throwable $e) {
            Log::warning("Discord webhook exception for server [{$server->uuid}]: {$e->getMessage()}");
            return false;
        }
    }

    /**
     * Send a test notification to verify a webhook URL.
     */
    public function sendTestNotification(Server $server, string $url): array
    {
        if (!$this->isValidWebhookUrl($url)) {
            return [
                'success' => false,
                'error' => 'Invalid Discord webhook URL format. Please paste a valid webhook from your Discord channel settings.',
            ];
        }

        $payload = $this->buildPayload($server, self::EVENT_TEST, [
            'actor' => auth()->user()?->name ?? auth()->user()?->username ?? 'Panel Administrator',
        ]);

        try {
            $response = Http::timeout(6)->post(trim($url), $payload);
            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Discord test notification delivered successfully!',
                ];
            }

            return [
                'success' => false,
                'error' => "Discord returned error: HTTP {$response->status()} - " . ($response->json('message') ?? $response->body()),
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => 'Failed to reach Discord: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Build Discord Rich Embed JSON payload.
     */
    protected function buildPayload(Server $server, string $event, array $extra = []): array
    {
        $server->loadMissing(['node', 'allocation']);

        $nodeName = $server->node?->name ?? 'Unknown Node';
        $ip = $server->allocation ? ($server->allocation->ip . ':' . $server->allocation->port) : 'N/A';
        $actor = $extra['actor'] ?? (auth()->user()?->name ?? auth()->user()?->username ?? 'System Event');

        $configs = [
            self::EVENT_START => [
                'title' => 'Server Started',
                'color' => 0x22C55E, // Green
                'desc' => "Server **{$server->name}** has transitioned to the active running state.",
            ],
            self::EVENT_STOP => [
                'title' => 'Server Stopped',
                'color' => 0xEF4444, // Red
                'desc' => "Server **{$server->name}** was gracefully shut down.",
            ],
            self::EVENT_RESTART => [
                'title' => 'Server Restarting',
                'color' => 0x3B82F6, // Blue
                'desc' => "Server **{$server->name}** is undergoing a reboot cycle.",
            ],
            self::EVENT_KILL => [
                'title' => 'Server Force Killed',
                'color' => 0xF97316, // Orange
                'desc' => "Server **{$server->name}** process was forcefully terminated.",
            ],
            self::EVENT_CRASH => [
                'title' => 'Server Process Crashed',
                'color' => 0x991B1B, // Dark Red
                'desc' => "Server **{$server->name}** exited unexpectedly or experienced an unhandled crash.",
            ],
            self::EVENT_INSTALL => [
                'title' => 'Server Installation Complete',
                'color' => 0xA855F7, // Purple
                'desc' => "Server **{$server->name}** completed installation and is ready for use.",
            ],
            self::EVENT_TEST => [
                'title' => 'Discord Webhook Connected',
                'color' => 0x5865F2, // Blurple
                'desc' => "Lunar Panel native alerts are successfully hooked into this Discord channel.",
            ],
        ];

        $cfg = $configs[$event] ?? [
            'title' => 'Server Event: ' . ucfirst($event),
            'color' => 0x64748B,
            'desc' => "Event **{$event}** occurred on server **{$server->name}**.",
        ];

        $fields = [
            [
                'name' => 'Server Name',
                'value' => $server->name,
                'inline' => true,
            ],
            [
                'name' => 'Identifier',
                'value' => '`' . ($server->uuidShort ?: substr($server->uuid, 0, 8)) . '`',
                'inline' => true,
            ],
            [
                'name' => 'Node & Allocation',
                'value' => "{$nodeName} (`{$ip}`)",
                'inline' => true,
            ],
        ];

        if (!empty($actor)) {
            $fields[] = [
                'name' => 'Triggered By',
                'value' => $actor,
                'inline' => true,
            ];
        }

        if (!empty($extra['reason'])) {
            $fields[] = [
                'name' => 'Details',
                'value' => (string) $extra['reason'],
                'inline' => false,
            ];
        }

        return [
            'username' => 'Lunar Panel Alerts',
            'avatar_url' => 'https://raw.githubusercontent.com/aswanthajay/Lunar-Panel/main/public/favicons/android-chrome-192x192.png',
            'embeds' => [
                [
                    'title' => $cfg['title'],
                    'description' => $cfg['desc'],
                    'color' => $cfg['color'],
                    'fields' => $fields,
                    'footer' => [
                        'text' => 'Lunar Panel • Server Real-time Monitor',
                    ],
                    'timestamp' => Carbon::now()->toIso8601String(),
                ],
            ],
        ];
    }
}
