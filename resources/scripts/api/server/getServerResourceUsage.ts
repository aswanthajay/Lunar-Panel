import http from '@/api/http';

export type ServerPowerState = 'offline' | 'starting' | 'running' | 'stopping';

export interface ServerStats {
    status: ServerPowerState;
    isSuspended: boolean;
    memoryUsageInBytes: number;
    cpuUsagePercent: number;
    diskUsageInBytes: number;
    networkRxInBytes: number;
    networkTxInBytes: number;
    uptime: number;
}

// In-memory cache for recent responses (20 seconds)
const statsCache = new Map<string, { stats: ServerStats; expiresAt: number }>();
// In-flight request deduplication map
const inFlightRequests = new Map<string, Promise<ServerStats>>();

export const setServerStatsCache = (server: string, stats: ServerStats, ttlMs = 25000) => {
    statsCache.set(server, { stats, expiresAt: Date.now() + ttlMs });
};

export default (server: string): Promise<ServerStats> => {
    // 1. Check cache first
    const cached = statsCache.get(server);
    if (cached && Date.now() < cached.expiresAt) {
        return Promise.resolve(cached.stats);
    }

    // 2. Check if a request for this server is already in-flight
    const inFlight = inFlightRequests.get(server);
    if (inFlight) {
        return inFlight;
    }

    // 3. Direct request with in-flight deduplication
    const requestPromise = http.get(`/api/client/servers/${server}/resources`)
        .then(({ data: { attributes } }) => {
            let state: ServerPowerState = attributes.current_state;
            const mem = attributes.resources?.memory_bytes ?? 0;

            // If a server or bot is marked starting but is actively consuming memory, it is running!
            if (state === 'starting' && mem > 0) {
                state = 'running';
            }

            const stats: ServerStats = {
                status: state,
                isSuspended: attributes.is_suspended,
                memoryUsageInBytes: mem,
                cpuUsagePercent: attributes.resources?.cpu_absolute ?? 0,
                diskUsageInBytes: attributes.resources?.disk_bytes ?? 0,
                networkRxInBytes: attributes.resources?.network_rx_bytes ?? 0,
                networkTxInBytes: attributes.resources?.network_tx_bytes ?? 0,
                uptime: attributes.resources?.uptime ?? 0,
            };
            statsCache.set(server, { stats, expiresAt: Date.now() + 20000 });
            return stats;
        })
        .finally(() => {
            inFlightRequests.delete(server);
        });

    inFlightRequests.set(server, requestPromise);
    return requestPromise;
};
