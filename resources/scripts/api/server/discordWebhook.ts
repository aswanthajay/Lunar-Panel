import http from '@/api/http';

export interface DiscordWebhookResponse {
    configured: boolean;
    webhook_url: string | null;
    events: string[];
    message?: string;
    success?: boolean;
}

export const getDiscordWebhook = async (uuid: string): Promise<DiscordWebhookResponse> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/settings/webhook`);
    return data;
};

export const saveDiscordWebhook = async (
    uuid: string,
    webhook_url: string | null,
    events?: string[]
): Promise<DiscordWebhookResponse> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/settings/webhook`, {
        webhook_url,
        events,
    });
    return data;
};

export const testDiscordWebhook = async (
    uuid: string,
    webhook_url?: string
): Promise<{ success: boolean; message: string }> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/settings/webhook/test`, {
        webhook_url,
    });
    return data;
};
