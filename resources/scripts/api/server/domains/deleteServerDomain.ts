import http from '@/api/http';

export default async (uuid: string, domainId: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/domains/${domainId}`);
};