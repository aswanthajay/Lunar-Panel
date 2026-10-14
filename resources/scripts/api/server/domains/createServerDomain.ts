import http from '@/api/http';
import { ServerCustomDomain, DnsDiagnostics } from './types';

export interface CreateDomainPayload {
    allocation_id: number;
    domain: string;
    protocol: 'http' | 'game_srv' | 'tcp_stream';
    target_type: 'web' | 'game';
    ssl_enabled?: boolean;
    notes?: string;
}

export interface CreateDomainResponse {
    success: boolean;
    data: ServerCustomDomain;
    nginx?: { success: boolean; message?: string; error?: string };
    dns?: DnsDiagnostics;
    ssl?: { success: boolean; message?: string; error?: string };
}

export default async (uuid: string, payload: CreateDomainPayload): Promise<CreateDomainResponse> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/domains`, payload);
    return data;
};