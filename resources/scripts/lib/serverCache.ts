import { Server } from '@/api/server/getServer';

const STORAGE_KEY = 'votion_servers_cache';

interface CacheEntry {
    server: Server;
    permissions: string[];
    timestamp: number;
}

const serverMemoryCache = new Map<string, CacheEntry>();

export const setCachedServer = (server: Server, permissions: string[] = ['*']) => {
    if (!server || (!server.id && !server.uuid)) return;

    const entry: CacheEntry = {
        server,
        permissions: permissions.length > 0 ? permissions : ['*'],
        timestamp: Date.now(),
    };

    if (server.id) serverMemoryCache.set(String(server.id), entry);
    if (server.uuid) serverMemoryCache.set(server.uuid, entry);

    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}');
            if (server.id) stored[String(server.id)] = entry;
            if (server.uuid) stored[server.uuid] = entry;
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        }
    } catch {}
};

export const getCachedServer = (idOrUuid: string): { server: Server; permissions: string[] } | null => {
    if (!idOrUuid) return null;
    const key = String(idOrUuid);

    let entry = serverMemoryCache.get(key);

    if (!entry) {
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}');
                if (stored[key]) {
                    entry = stored[key];
                    if (entry) {
                        serverMemoryCache.set(key, entry);
                    }
                }
            }
        } catch {}
    }

    if (!entry) return null;

    // Cache valid for 15 minutes
    if (Date.now() - entry.timestamp > 15 * 60 * 1000) {
        return null;
    }

    return entry;
};

export const prefetchServerChunk = () => {
    try {
        import(/* webpackChunkName: "server" */ '@/routers/ServerRouter');
    } catch {}
};
