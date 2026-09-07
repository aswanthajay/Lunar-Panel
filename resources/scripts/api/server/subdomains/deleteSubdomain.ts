import http from '@/api/http';

export default async (uuid: string, subdomainId: number): Promise<{ success: boolean; message: string }> => {
    const { data } = await http.delete(`/api/client/servers/${uuid}/subdomains/${subdomainId}`);
    return data;
};
