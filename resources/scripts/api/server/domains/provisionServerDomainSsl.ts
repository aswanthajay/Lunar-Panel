import http from '@/api/http';
import { ServerCustomDomain } from './types';

export interface ProvisionSslResponse {
    success: boolean;
    data: ServerCustomDomain;
    result: { success: boolean; status: string; message?: string; error?: string };
}

export default async (uuid: string, domainId: number): Promise<ProvisionSslResponse> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/domains/${domainId}/ssl`);
    return data;
};