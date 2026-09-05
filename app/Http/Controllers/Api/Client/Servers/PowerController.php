<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Response;
use Pterodactyl\Models\Server;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Repositories\Wings\DaemonPowerRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\SendPowerRequest;

class PowerController extends ClientApiController
{
    /**
     * PowerController constructor.
     */
    public function __construct(private DaemonPowerRepository $repository)
    {
        parent::__construct();
    }

    /**
     * Send a power action to a server.
     */
    public function index(SendPowerRequest $request, Server $server): Response
    {
        $signal = strtolower($request->input('signal'));
        $this->repository->setServer($server)->send($signal);

        Activity::event("server:power.{$signal}")->log();

        try {
            app(\Pterodactyl\Services\Discord\DiscordWebhookService::class)->sendNotification(
                $server,
                $signal,
                ['actor' => $request->user()?->name ?? $request->user()?->username]
            );
        } catch (\Throwable) {}

        return $this->returnNoContent();
    }
}
