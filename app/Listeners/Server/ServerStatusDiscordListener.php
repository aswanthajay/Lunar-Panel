<?php

namespace Pterodactyl\Listeners\Server;

use Pterodactyl\Events\Server\Installed as ServerInstalledEvent;
use Pterodactyl\Services\Discord\DiscordWebhookService;

class ServerStatusDiscordListener
{
    public function __construct(private DiscordWebhookService $discordWebhookService)
    {
    }

    public function handle(ServerInstalledEvent $event): void
    {
        $this->discordWebhookService->sendNotification(
            $event->server,
            DiscordWebhookService::EVENT_INSTALL,
            ['reason' => 'Server finished initial installation and provisioning.']
        );
    }
}
