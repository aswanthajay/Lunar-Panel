import http from '@/api/http';

export interface HibernationStatus {
    enabled: boolean;
    is_frozen?: boolean;
    active_connections?: number;
    container_id?: string;
}

export const getServerHibernation = (uuid: string): Promise<HibernationStatus> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}/settings/hibernation`)
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

export const setServerHibernation = (uuid: string, enabled: boolean): Promise<{ success: boolean; enabled: boolean }> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/settings/hibernation`, { enabled })
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};
