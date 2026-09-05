<?php

namespace Pterodactyl\Listeners\Server;

use Pterodactyl\Events\Server\Installed as ServerInstalledEvent;
use Pterodactyl\Services\Discord\DiscordWebhookService;
use Pterodactyl\Services\Notifications\WebPushNotificationService;

class ServerStatusDiscordListener
{
    public function __construct(
        private DiscordWebhookService $discordWebhookService,
        private WebPushNotificationService $pushService
    ) {
    }

    public function handle(ServerInstalledEvent $event): void
    {
        $this->discordWebhookService->sendNotification(
            $event->server,
            DiscordWebhookService::EVENT_INSTALL,
            ['reason' => 'Server finished initial installation and provisioning.']
        );

        try {
            $this->pushService->sendToServerStakeholders(
                $event->server,
                "Server Installed: {$event->server->name}",
                "Your server has completed installation and is ready for use!",
                "/server/{$event->server->uuidShort}",
                null,
                'server_install'
            );
        } catch (\Throwable) {}
    }
}
