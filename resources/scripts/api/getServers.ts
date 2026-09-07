import { rawDataToServerObject, Server } from '@/api/server/getServer';
import http, { getPaginationSet, PaginatedResult } from '@/api/http';

interface QueryParams {
    query?: string;
    page?: number;
    perPage?: number;
    type?: string;
}

export default ({ query, perPage = 25, ...params }: QueryParams): Promise<PaginatedResult<Server>> => {
    return new Promise((resolve, reject) => {
        http.get('/api/client', {
            params: {
                'filter[*]': query,
                per_page: perPage,
                ...params,
            },
        })
            .then(({ data }) =>
                resolve({
                    items: (data.data || []).map((datum: any) => rawDataToServerObject(datum)),
                    pagination: getPaginationSet(data.meta.pagination),
                })
            )
            .catch(reject);
    });
};

export interface FleetStats {
    total: number;
    cpu: number;
    memory: number;
    disk: number;
    suspended: number;
    installing: number;
}

export const getFleetStats = (type?: string): Promise<FleetStats> => {
    return http.get('/api/client/stats', { params: { type } }).then((res) => res.data);
};
