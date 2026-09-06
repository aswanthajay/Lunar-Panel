<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Api\Client;
use Pterodactyl\Http\Middleware\Activity\ServerSubject;
use Pterodactyl\Http\Middleware\Activity\AccountSubject;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;
use Pterodactyl\Http\Middleware\Api\Client\Server\ResourceBelongsToServer;
use Pterodactyl\Http\Middleware\Api\Client\Server\AuthenticateServerAccess;

/*
|--------------------------------------------------------------------------
| Client Control API
|--------------------------------------------------------------------------
|
| Endpoint: /api/client
|
*/
Route::get('/', [Client\ClientController::class, 'index'])->name('api:client.index');
Route::get('/permissions', [Client\ClientController::class, 'permissions']);

Route::prefix('/account')->middleware(AccountSubject::class)->group(function () {
    Route::prefix('/')->withoutMiddleware(RequireTwoFactorAuthentication::class)->group(function () {
        Route::get('/', [Client\AccountController::class, 'index'])->name('api:client.account');
        Route::get('/two-factor', [Client\TwoFactorController::class, 'index']);
        Route::post('/two-factor', [Client\TwoFactorController::class, 'store']);
        Route::post('/two-factor/disable', [Client\TwoFactorController::class, 'delete']);
    });

    Route::put('/email', [Client\AccountController::class, 'updateEmail'])->name('api:client.account.update-email');
    Route::put('/password', [Client\AccountController::class, 'updatePassword'])->name('api:client.account.update-password');
    Route::put('/profile', [Client\AccountController::class, 'updateProfile'])->name('api:client.account.update-profile');

    Route::get('/activity', Client\ActivityLogController::class)->name('api:client.account.activity');

    Route::get('/api-keys', [Client\ApiKeyController::class, 'index']);
    Route::post('/api-keys', [Client\ApiKeyController::class, 'store']);
    Route::delete('/api-keys/{identifier}', [Client\ApiKeyController::class, 'delete']);

    Route::prefix('/ssh-keys')->group(function () {
        Route::get('/', [Client\SSHKeyController::class, 'index']);
        Route::post('/', [Client\SSHKeyController::class, 'store']);
        Route::post('/remove', [Client\SSHKeyController::class, 'delete']);
    });

    Route::prefix('/notifications')->group(function () {
        Route::get('/', [Client\Account\PushNotificationController::class, 'index']);
        Route::post('/subscribe', [Client\Account\PushNotificationController::class, 'subscribe']);
        Route::post('/unsubscribe', [Client\Account\PushNotificationController::class, 'unsubscribe']);
        Route::post('/preferences', [Client\Account\PushNotificationController::class, 'preferences']);
        Route::post('/test', [Client\Account\PushNotificationController::class, 'test']);
    });
});

/*
|--------------------------------------------------------------------------
| Client Control API
|--------------------------------------------------------------------------
|
| Endpoint: /api/client/servers/{server}
|
*/
Route::group([
    'prefix' => '/servers/{server}',
    'middleware' => [
        ServerSubject::class,
        AuthenticateServerAccess::class,
        ResourceBelongsToServer::class,
    ],
], function () {
    Route::get('/', [Client\Servers\ServerController::class, 'index'])->name('api:client:server.view');
    Route::get('/websocket', Client\Servers\WebsocketController::class)->name('api:client:server.ws');
    Route::get('/resources', Client\Servers\ResourceUtilizationController::class)->name('api:client:server.resources');
    Route::get('/activity', Client\Servers\ActivityLogController::class)->name('api:client:server.activity');
    Route::get('/player-status', [Client\Servers\PlayerStatusController::class, 'index'])->name('api:client:server.player-status');

    Route::post('/command', [Client\Servers\CommandController::class, 'index']);
    Route::post('/power', [Client\Servers\PowerController::class, 'index']);

    Route::group(['prefix' => '/databases'], function () {
        Route::get('/', [Client\Servers\DatabaseController::class, 'index']);
        Route::post('/', [Client\Servers\DatabaseController::class, 'store']);
        Route::post('/{database}/rotate-password', [Client\Servers\DatabaseController::class, 'rotatePassword']);
        Route::delete('/{database}', [Client\Servers\DatabaseController::class, 'delete']);
        Route::get('/{database}/export', [Client\Servers\DatabaseManagementExtendedController::class, 'export']);
        Route::post('/{database}/import', [Client\Servers\DatabaseManagementExtendedController::class, 'import']);
        Route::get('/{database}/pma', [Client\Servers\DatabaseManagementExtendedController::class, 'pma']);
    });

    Route::group(['prefix' => '/files'], function () {
        Route::get('/list', [Client\Servers\FileController::class, 'directory']);
        Route::get('/contents', [Client\Servers\FileController::class, 'contents']);
        Route::get('/download', [Client\Servers\FileController::class, 'download']);
        Route::put('/rename', [Client\Servers\FileController::class, 'rename']);
        Route::post('/copy', [Client\Servers\FileController::class, 'copy']);
        Route::post('/write', [Client\Servers\FileController::class, 'write']);
        Route::post('/compress', [Client\Servers\FileController::class, 'compress']);
        Route::post('/decompress', [Client\Servers\FileController::class, 'decompress']);
        Route::post('/delete', [Client\Servers\FileController::class, 'delete']);
        Route::post('/create-folder', [Client\Servers\FileController::class, 'create']);
        Route::post('/chmod', [Client\Servers\FileController::class, 'chmod']);
        Route::post('/pull', [Client\Servers\FileController::class, 'pull'])->middleware(['throttle:10,5']);
        Route::get('/upload', Client\Servers\FileUploadController::class);
    });

    Route::group(['prefix' => '/schedules'], function () {
        Route::get('/', [Client\Servers\ScheduleController::class, 'index']);
        Route::post('/', [Client\Servers\ScheduleController::class, 'store']);
        Route::get('/{schedule}', [Client\Servers\ScheduleController::class, 'view']);
        Route::post('/{schedule}', [Client\Servers\ScheduleController::class, 'update']);
        Route::post('/{schedule}/execute', [Client\Servers\ScheduleController::class, 'execute']);
        Route::delete('/{schedule}', [Client\Servers\ScheduleController::class, 'delete']);

        Route::post('/{schedule}/tasks', [Client\Servers\ScheduleTaskController::class, 'store']);
        Route::post('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'update']);
        Route::delete('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'delete']);
    });

    Route::group(['prefix' => '/network'], function () {
        Route::get('/allocations', [Client\Servers\NetworkAllocationController::class, 'index']);
        Route::post('/allocations', [Client\Servers\NetworkAllocationController::class, 'store']);
        Route::post('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'update']);
        Route::post('/allocations/{allocation}/primary', [Client\Servers\NetworkAllocationController::class, 'setPrimary']);
        Route::delete('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'delete']);
    });

    Route::group(['prefix' => '/domains'], function () {
        Route::get('/', [Client\Servers\DomainController::class, 'index']);
        Route::post('/', [Client\Servers\DomainController::class, 'store']);
        Route::get('/{domain}/verify', [Client\Servers\DomainController::class, 'verify']);
        Route::post('/{domain}/ssl', [Client\Servers\DomainController::class, 'provisionSsl']);
        Route::delete('/{domain}', [Client\Servers\DomainController::class, 'delete']);
    });

    Route::group(['prefix' => '/users'], function () {
        Route::get('/', [Client\Servers\SubuserController::class, 'index']);
        Route::post('/', [Client\Servers\SubuserController::class, 'store']);
        Route::get('/{user}', [Client\Servers\SubuserController::class, 'view']);
        Route::post('/{user}', [Client\Servers\SubuserController::class, 'update']);
        Route::delete('/{user}', [Client\Servers\SubuserController::class, 'delete']);
    });

    Route::group(['prefix' => '/backups'], function () {
        Route::get('/', [Client\Servers\BackupController::class, 'index']);
        Route::post('/', [Client\Servers\BackupController::class, 'store']);
        Route::get('/{backup}', [Client\Servers\BackupController::class, 'view']);
        Route::get('/{backup}/download', [Client\Servers\BackupController::class, 'download']);
        Route::post('/{backup}/lock', [Client\Servers\BackupController::class, 'toggleLock']);
        Route::post('/{backup}/restore', [Client\Servers\BackupController::class, 'restore']);
        Route::delete('/{backup}', [Client\Servers\BackupController::class, 'delete']);
    });

    Route::group(['prefix' => '/startup'], function () {
        Route::get('/', [Client\Servers\StartupController::class, 'index']);
        Route::put('/variable', [Client\Servers\StartupController::class, 'update']);
    });

    Route::group(['prefix' => '/settings'], function () {
        Route::post('/rename', [Client\Servers\SettingsController::class, 'rename']);
        Route::post('/reinstall', [Client\Servers\SettingsController::class, 'reinstall']);
        Route::put('/docker-image', [Client\Servers\SettingsController::class, 'dockerImage']);
        Route::get('/webhook', [Client\Servers\DiscordWebhookController::class, 'index']);
        Route::post('/webhook', [Client\Servers\DiscordWebhookController::class, 'update']);
        Route::post('/webhook/test', [Client\Servers\DiscordWebhookController::class, 'test']);
    });

    Route::group(['prefix' => '/notes'], function () {
        Route::get('/', [Client\Servers\ServerNotesController::class, 'index']);
        Route::post('/', [Client\Servers\ServerNotesController::class, 'updateNotes']);
        Route::post('/admin', [Client\Servers\ServerNotesController::class, 'updateAdminNotes']);
    });

    Route::group(['prefix' => '/minecraft'], function () {
        Route::get('/plugins', [Client\Servers\Minecraft\MCPluginsController::class, 'index']);
        Route::get('/plugins/versions', [Client\Servers\Minecraft\MCPluginsController::class, 'versions']);
        Route::post('/plugins/install', [Client\Servers\Minecraft\MCPluginsController::class, 'install']);

        Route::get('/addons', [Client\Servers\Minecraft\BedrockAddonsController::class, 'index']);
        Route::post('/addons', [Client\Servers\Minecraft\BedrockAddonsController::class, 'upload']);
        Route::post('/addons/{uuid}/toggle', [Client\Servers\Minecraft\BedrockAddonsController::class, 'toggle']);
        Route::delete('/addons/{folder}', [Client\Servers\Minecraft\BedrockAddonsController::class, 'delete']);

        Route::get('/players', [Client\Servers\Minecraft\PlayerManagerController::class, 'index']);
        Route::get('/players/status', [Client\Servers\PlayerStatusController::class, 'index']);
        Route::get('/players/banned', [Client\Servers\Minecraft\PlayerManagerController::class, 'banned']);
        Route::get('/players/whitelist', [Client\Servers\Minecraft\PlayerManagerController::class, 'whitelist']);
        Route::get('/players/ops', [Client\Servers\Minecraft\PlayerManagerController::class, 'ops']);
        Route::post('/players/action', [Client\Servers\Minecraft\PlayerManagerController::class, 'action']);
        Route::get('/players/{name}/profile', [Client\Servers\Minecraft\PlayerManagerController::class, 'profile']);

        Route::get('/worlds', [Client\Servers\Minecraft\WorldManagerController::class, 'index']);
        Route::get('/worlds/seed', [Client\Servers\Minecraft\WorldManagerController::class, 'seed']);
        Route::post('/worlds/activate', [Client\Servers\Minecraft\WorldManagerController::class, 'activate']);
        Route::post('/worlds/properties', [Client\Servers\Minecraft\WorldManagerController::class, 'properties']);
        Route::post('/worlds/restart', [Client\Servers\Minecraft\WorldManagerController::class, 'restart']);
        Route::post('/worlds/{name}/difficulty', [Client\Servers\Minecraft\WorldManagerController::class, 'difficulty']);
        Route::delete('/worlds/{name}', [Client\Servers\Minecraft\WorldManagerController::class, 'delete']);
    });
});

/*
|--------------------------------------------------------------------------
| Extensions API Compatibility Routes (Minecraft Plugins & Tools)
|--------------------------------------------------------------------------
*/
Route::prefix('/extensions')->group(function () {
    Route::get('/mcplugins/settings', [Client\Servers\Minecraft\MCPluginsController::class, 'settings']);
    Route::prefix('/mcplugins/{server}')->middleware([AuthenticateServerAccess::class, ResourceBelongsToServer::class])->group(function () {
        Route::get('/', [Client\Servers\Minecraft\MCPluginsController::class, 'index']);
        Route::get('/versions', [Client\Servers\Minecraft\MCPluginsController::class, 'versions']);
        Route::post('/install', [Client\Servers\Minecraft\MCPluginsController::class, 'install']);
    });

    Route::prefix('/bedrock-addons/servers/{server}')->middleware([AuthenticateServerAccess::class, ResourceBelongsToServer::class])->group(function () {
        Route::get('/addons', [Client\Servers\Minecraft\BedrockAddonsController::class, 'index']);
        Route::post('/addons', [Client\Servers\Minecraft\BedrockAddonsController::class, 'upload']);
        Route::post('/addons/{uuid}/toggle', [Client\Servers\Minecraft\BedrockAddonsController::class, 'toggle']);
        Route::delete('/addons/{folder}', [Client\Servers\Minecraft\BedrockAddonsController::class, 'delete']);
    });

    Route::prefix('/player-manager/servers/{server}')->middleware([AuthenticateServerAccess::class, ResourceBelongsToServer::class])->group(function () {
        Route::get('/players', [Client\Servers\Minecraft\PlayerManagerController::class, 'index']);
        Route::get('/players/banned', [Client\Servers\Minecraft\PlayerManagerController::class, 'banned']);
        Route::get('/players/whitelist', [Client\Servers\Minecraft\PlayerManagerController::class, 'whitelist']);
        Route::get('/players/ops', [Client\Servers\Minecraft\PlayerManagerController::class, 'ops']);
        Route::post('/players/action', [Client\Servers\Minecraft\PlayerManagerController::class, 'action']);
        Route::get('/players/{name}/profile', [Client\Servers\Minecraft\PlayerManagerController::class, 'profile']);
    });

    Route::prefix('/world-manager/servers/{server}')->middleware([AuthenticateServerAccess::class, ResourceBelongsToServer::class])->group(function () {
        Route::get('/worlds', [Client\Servers\Minecraft\WorldManagerController::class, 'index']);
        Route::get('/worlds/seed', [Client\Servers\Minecraft\WorldManagerController::class, 'seed']);
        Route::post('/worlds/activate', [Client\Servers\Minecraft\WorldManagerController::class, 'activate']);
        Route::post('/worlds/properties', [Client\Servers\Minecraft\WorldManagerController::class, 'properties']);
        Route::post('/worlds/restart', [Client\Servers\Minecraft\WorldManagerController::class, 'restart']);
        Route::post('/worlds/{name}/difficulty', [Client\Servers\Minecraft\WorldManagerController::class, 'difficulty']);
        Route::delete('/worlds/{name}', [Client\Servers\Minecraft\WorldManagerController::class, 'delete']);
    });
});

/*
|--------------------------------------------------------------------------
| Support Tickets API
|--------------------------------------------------------------------------
*/
Route::prefix('/tickets')->group(function () {
    Route::get('/', [Client\TicketController::class, 'index']);
    Route::post('/', [Client\TicketController::class, 'store']);
    Route::get('/{id}', [Client\TicketController::class, 'show']);
    Route::post('/{id}/messages', [Client\TicketController::class, 'reply']);
    Route::patch('/{id}', [Client\TicketController::class, 'updateStatus']);
    Route::delete('/{id}', [Client\TicketController::class, 'destroy']);
});

/*
|--------------------------------------------------------------------------
| Billing & Renewal Payments API
|--------------------------------------------------------------------------
*/
Route::prefix('/billing')->group(function () {
    Route::get('/config', [Client\BillingController::class, 'config']);
    Route::get('/payments', [Client\BillingController::class, 'payments']);
    Route::post('/renew/{server}', [Client\BillingController::class, 'renew']);

    Route::prefix('/admin')->group(function () {
        Route::get('/config', [Client\AdminBillingController::class, 'getConfig']);
        Route::post('/config', [Client\AdminBillingController::class, 'updateConfig']);
        Route::get('/payments', [Client\AdminBillingController::class, 'payments']);
        Route::post('/payments/{payment}/approve', [Client\AdminBillingController::class, 'approve']);
        Route::post('/payments/{payment}/reject', [Client\AdminBillingController::class, 'reject']);
        Route::get('/nodes', [Client\AdminBillingController::class, 'getNodes']);
        Route::post('/nodes/{id}/cost', [Client\AdminBillingController::class, 'updateNodeCost']);
    });
});
