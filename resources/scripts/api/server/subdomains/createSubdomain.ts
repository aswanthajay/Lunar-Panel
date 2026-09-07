import http from '@/api/http';
import { CreateSubdomainPayload, ServerSubdomain } from './types';

export default async (uuid: string, payload: CreateSubdomainPayload): Promise<{ data: ServerSubdomain; message: string }> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/subdomains`, payload);
    return data;
};
