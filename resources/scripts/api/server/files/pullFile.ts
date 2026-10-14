import http from '@/api/http';

export interface PullFilePayload {
    url: string;
    directory: string;
    filename?: string;
    useHeader?: boolean;
    foreground?: boolean;
}

export default (uuid: string, directory: string, url: string, filename?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/files/pull`, {
            directory,
            url,
            filename: filename?.trim() || undefined,
            use_header: true,
        })
            .then(() => resolve())
            .catch(reject);
    });
};
