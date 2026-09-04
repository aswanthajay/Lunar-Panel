import http from '@/api/http';
import { ServerCustomDomain, DnsDiagnostics } from './types';

export interface VerifyDnsResponse {
    success: boolean;
    data: ServerCustomDomain;
    diagnostics: DnsDiagnostics;
}

export default async (uuid: string, domainId: number): Promise<VerifyDnsResponse> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/domains/${domainId}/verify`);
    return data;
};