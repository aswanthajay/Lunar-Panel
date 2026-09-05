<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Account;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\PushSubscription;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Services\Notifications\WebPushNotificationService;

class PushNotificationController extends ClientApiController
{
    private const DEFAULT_PREFERENCES = [
        'server_crash' => true,
        'server_install' => true,
        'server_backup' => true,
        'ticket_reply' => true,
        'admin_node_status' => true,
        'admin_new_ticket' => true,
        'admin_server_deploy' => true,
    ];

    public function __construct(protected WebPushNotificationService $pushService)
    {
        parent::__construct();
    }

    /**
     * Get user notification status, VAPID key, and preferences.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $subscriptions = $user->pushSubscriptions;
        $savedPrefs = $user->notification_preferences ?? [];

        $mergedPrefs = array_merge(self::DEFAULT_PREFERENCES, $savedPrefs);

        return new JsonResponse([
            'vapid_public_key' => $this->pushService->getVapidPublicKey(),
            'subscribed' => $subscriptions->isNotEmpty(),
            'device_count' => $subscriptions->count(),
            'preferences' => $mergedPrefs,
            'is_admin' => (bool) $user->root_admin,
        ]);
    }

    /**
     * Subscribe a browser/device to Web Push notifications.
     */
    public function subscribe(Request $request): JsonResponse
    {
        $this->validate($request, [
            'endpoint' => 'required|string',
            'keys.p256dh' => 'nullable|string',
            'keys.auth' => 'nullable|string',
            'device_name' => 'sometimes|nullable|string',
        ]);

        $user = $request->user();
        $endpoint = $request->input('endpoint');

        $subscription = PushSubscription::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'endpoint' => $endpoint,
            ],
            [
                'public_key' => $request->input('keys.p256dh'),
                'auth_token' => $request->input('keys.auth'),
                'content_encoding' => 'aes128gcm',
                'device_name' => $request->input('device_name') ?? $request->header('User-Agent'),
            ]
        );

        return new JsonResponse([
            'success' => true,
            'message' => 'Desktop push notifications enabled on this device.',
            'id' => $subscription->id,
        ]);
    }

    /**
     * Unsubscribe a browser/device.
     */
    public function unsubscribe(Request $request): JsonResponse
    {
        $this->validate($request, [
            'endpoint' => 'required|string',
        ]);

        $user = $request->user();
        $endpoint = $request->input('endpoint');

        PushSubscription::query()
            ->where('user_id', $user->id)
            ->where('endpoint', $endpoint)
            ->delete();

        return new JsonResponse([
            'success' => true,
            'message' => 'Desktop notifications disabled for this device.',
        ]);
    }

    /**
     * Update user notification preferences.
     */
    public function preferences(Request $request): JsonResponse
    {
        $this->validate($request, [
            'preferences' => 'required|array',
        ]);

        $user = $request->user();
        $user->notification_preferences = $request->input('preferences');
        $user->save();

        return new JsonResponse([
            'success' => true,
            'message' => 'Notification preferences updated.',
            'preferences' => array_merge(self::DEFAULT_PREFERENCES, $user->notification_preferences),
        ]);
    }

    /**
     * Send a test push notification to all devices belonging to the user.
     */
    public function test(Request $request): JsonResponse
    {
        $user = $request->user();
        $subscriptions = $user->pushSubscriptions;

        if ($subscriptions->isEmpty()) {
            return new JsonResponse([
                'success' => false,
                'message' => 'No active browser push subscriptions found. Please enable notifications in this browser first.',
            ], 400);
        }

        $sentCount = $this->pushService->sendToUser(
            $user,
            'Lunar Panel Test Alert',
            'Desktop notifications are working properly on your device.',
            '/account/notifications',
            null,
            'general'
        );

        return new JsonResponse([
            'success' => true,
            'sent_count' => $sentCount,
            'message' => "Test push notification dispatched to {$sentCount} active device(s).",
        ]);
    }
}
