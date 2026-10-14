import http from '@/api/http';

export interface NotificationPreferences {
    server_crash: boolean;
    server_install: boolean;
    server_backup: boolean;
    ticket_reply: boolean;
    admin_node_status?: boolean;
    admin_new_ticket?: boolean;
    admin_server_deploy?: boolean;
    [key: string]: boolean | undefined;
}

export interface NotificationConfigResponse {
    vapid_public_key: string;
    subscribed: boolean;
    device_count: number;
    preferences: NotificationPreferences;
    is_admin: boolean;
}

export const getNotificationConfig = async (): Promise<NotificationConfigResponse> => {
    const { data } = await http.get('/api/client/account/notifications');
    return data;
};

export const subscribeToPush = async (subscription: globalThis.PushSubscription, deviceName?: string): Promise<any> => {
    const json = subscription.toJSON();
    const { data } = await http.post('/api/client/account/notifications/subscribe', {
        endpoint: subscription.endpoint,
        keys: {
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
        },
        device_name: deviceName || navigator.userAgent.substring(0, 150),
    });
    return data;
};

export const unsubscribeFromPush = async (endpoint: string): Promise<any> => {
    const { data } = await http.post('/api/client/account/notifications/unsubscribe', { endpoint });
    return data;
};

export const saveNotificationPreferences = async (preferences: NotificationPreferences): Promise<NotificationPreferences> => {
    const { data } = await http.post('/api/client/account/notifications/preferences', { preferences });
    return data.preferences;
};

export const sendTestNotification = async (): Promise<{ success: boolean; message: string; sent_count: number }> => {
    const { data } = await http.post('/api/client/account/notifications/test');
    return data;
};

export const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};
