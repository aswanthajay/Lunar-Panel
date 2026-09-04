import http from '@/api/http';
import { ServerCustomDomain } from './types';

export default async (uuid: string): Promise<ServerCustomDomain[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/domains`);
    return data.data || [];
};