import http from '@/api/http';
import { SubdomainsData } from './types';

export default async (uuid: string): Promise<SubdomainsData> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/subdomains`);
    return data.data || { subdomains: [], available_domains: [], allocations: [] };
};
