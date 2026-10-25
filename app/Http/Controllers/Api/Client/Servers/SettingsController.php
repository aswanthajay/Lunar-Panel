<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Repositories\Eloquent\ServerRepository;
use Pterodactyl\Repositories\Wings\DaemonServerRepository;
use Pterodactyl\Services\Servers\ReinstallServerService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Pterodactyl\Http\Requests\Api\Client\Servers\Settings\RenameServerRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Settings\SetDockerImageRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Settings\ReinstallServerRequest;

class SettingsController extends ClientApiController
{
    /**
     * SettingsController constructor.
     */
    public function __construct(
        private ServerRepository $repository,
        private ReinstallServerService $reinstallServerService,
        private DaemonServerRepository $daemonServerRepository
    ) {
        parent::__construct();
    }

    /**
     * Renames a server.
     *
     * @throws \Pterodactyl\Exceptions\Model\DataValidationException
     * @throws \Pterodactyl\Exceptions\Repository\RecordNotFoundException
     */
    public function rename(RenameServerRequest $request, Server $server): JsonResponse
    {
        $name = $request->input('name');
        $description = $request->has('description') ? (string) $request->input('description') : $server->description;
        $this->repository->update($server->id, [
            'name' => $name,
            'description' => $description,
        ]);

        if ($server->name !== $name) {
            Activity::event('server:settings.rename')
                ->property(['old' => $server->name, 'new' => $name])
                ->log();
        }

        if ($server->description !== $description) {
            Activity::event('server:settings.description')
                ->property(['old' => $server->description, 'new' => $description])
                ->log();
        }

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    /**
     * Reinstalls the server on the daemon.
     *
     * @throws \Throwable
     */
    public function reinstall(ReinstallServerRequest $request, Server $server): JsonResponse
    {
        $this->reinstallServerService->handle($server);

        Activity::event('server:reinstall')->log();

        return new JsonResponse([], Response::HTTP_ACCEPTED);
    }

    /**
     * Changes the Docker image in use by the server.
     *
     * @throws \Throwable
     */
    public function dockerImage(SetDockerImageRequest $request, Server $server): JsonResponse
    {
        if (!in_array($server->image, array_values($server->egg->docker_images))) {
            throw new BadRequestHttpException('This server\'s Docker image has been manually set by an administrator and cannot be updated.');
        }

        $original = $server->image;
        $server->forceFill(['image' => $request->input('docker_image')])->saveOrFail();

        if ($original !== $server->image) {
            Activity::event('server:startup.image')
                ->property(['old' => $original, 'new' => $request->input('docker_image')])
                ->log();
        }

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    /**
     * Returns Autonomous Zero-Player Hibernation status for this server.
     */
    public function getHibernation(Request $request, Server $server): JsonResponse
    {
        $user = $request->user();
        if (! $user->root_admin) {
            throw new AccessDeniedHttpException('Only administrators can configure Autonomous Zero-Player Hibernation.');
        }

        if (! $server->isMinecraft()) {
            return new JsonResponse([
                'enabled' => false,
                'is_frozen' => false,
                'active_connections' => 0,
                'is_minecraft' => false,
            ]);
        }

        $daemonData = $this->daemonServerRepository->setServer($server)->getHibernation();

        return new JsonResponse([
            'enabled' => (bool) $server->hibernation_enabled,
            'is_frozen' => $daemonData['is_frozen'] ?? false,
            'active_connections' => $daemonData['active_connections'] ?? 0,
            'is_minecraft' => true,
        ]);
    }

    /**
     * Updates Autonomous Zero-Player Hibernation status for this server.
     */
    public function toggleHibernation(Request $request, Server $server): JsonResponse
    {
        $user = $request->user();
        if (! $user->root_admin) {
            throw new AccessDeniedHttpException('Only administrators can configure Autonomous Zero-Player Hibernation.');
        }

        if (! $server->isMinecraft()) {
            throw new BadRequestHttpException('Autonomous Zero-Player Hibernation is only available for Minecraft servers.');
        }

        $enabled = $request->has('enabled')
            ? (bool) $request->input('enabled')
            : ! (bool) $server->hibernation_enabled;

        $server->forceFill(['hibernation_enabled' => $enabled])->save();

        try {
            $this->daemonServerRepository->setServer($server)->setHibernation($enabled);
        } catch (\Throwable $e) {
            // Ignore daemon unreachable
        }

        Activity::event('server:settings.hibernation')
            ->property(['enabled' => $enabled])
            ->log();

        return new JsonResponse([
            'success' => true,
            'enabled' => $enabled,
            'is_minecraft' => true,
        ]);
    }
}
