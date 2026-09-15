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

// In-memory cache for recent responses (15 seconds)
const statsCache = new Map<string, { stats: ServerStats; expiresAt: number }>();
// In-flight request deduplication map
const inFlightRequests = new Map<string, Promise<ServerStats>>();

// Concurrency limiter to prevent flooding daemon/PHP-FPM and triggering 429 Too Many Requests
const MAX_CONCURRENT = 5;
let activeCount = 0;
const queue: (() => void)[] = [];

function pumpQueue() {
    while (activeCount < MAX_CONCURRENT && queue.length > 0) {
        const next = queue.shift();
        if (next) {
            activeCount++;
            next();
        }
    }
}

function executeWithConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const task = () => {
            fn()
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    activeCount--;
                    pumpQueue();
                });
        };
        queue.push(task);
        pumpQueue();
    });
}

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

    // 3. Queue and execute throttled request
    const requestPromise = executeWithConcurrencyLimit(() => {
        return http.get(`/api/client/servers/${server}/resources`)
            .then(({ data: { attributes } }) => {
                const stats: ServerStats = {
                    status: attributes.current_state,
                    isSuspended: attributes.is_suspended,
                    memoryUsageInBytes: attributes.resources?.memory_bytes ?? 0,
                    cpuUsagePercent: attributes.resources?.cpu_absolute ?? 0,
                    diskUsageInBytes: attributes.resources?.disk_bytes ?? 0,
                    networkRxInBytes: attributes.resources?.network_rx_bytes ?? 0,
                    networkTxInBytes: attributes.resources?.network_tx_bytes ?? 0,
                    uptime: attributes.resources?.uptime ?? 0,
                };
                statsCache.set(server, { stats, expiresAt: Date.now() + 15000 });
                return stats;
            });
    }).finally(() => {
        inFlightRequests.delete(server);
    });

    inFlightRequests.set(server, requestPromise);
    return requestPromise;
};
