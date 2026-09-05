import http from '@/api/http';

export interface UpdateProfilePayload {
    username: string;
    name_first: string;
    name_last: string;
    password: string;
}

export default (payload: UpdateProfilePayload): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.put('/api/client/account/profile', payload)
            .then(() => resolve())
            .catch(reject);
    });
};
