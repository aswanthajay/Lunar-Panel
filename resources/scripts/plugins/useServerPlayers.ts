import { useEffect, useState, useCallback, useRef } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import http from '@/api/http';

export interface ServerPlayerStats {
    online: number;
    max: number | null;
    platform: string;
    status: 'running' | 'offline' | 'starting' | 'stopping';
    ping: number | null;
    version: string | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

export const useServerPlayers = (): ServerPlayerStats => {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const serverId = server?.id;
    const isMinecraft = Boolean(server?.isMinecraft);
    const isBedrock = Boolean(server?.isBedrock);
    const isFiveM = Boolean(server?.isFiveM);

    // Inspect server startup variables if available to initialize real configured slots
    const initialMax = (() => {
        if (!server?.variables || !Array.isArray(server.variables)) return null;
        const slotVar = server.variables.find((v) =>
            ['MAX_PLAYERS', 'SERVER_MAX_PLAYERS', 'SLOTS', 'PLAYER_SLOTS', 'MAXPLAYERS', 'SERVER_SLOTS', 'SV_MAXCLIENTS'].includes(
                (v.envVariable || '').toUpperCase()
            )
        );
        if (slotVar) {
            const raw = slotVar.serverValue || slotVar.defaultValue || '';
            const parsed = parseInt(raw, 10);
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        return null;
    })();

    const [stats, setStats] = useState<{
        online: number;
        max: number | null;
        platform: string;
        status: 'running' | 'offline' | 'starting' | 'stopping';
        ping: number | null;
        version: string | null;
        loading: boolean;
    }>({
        online: 0,
        max: initialMax,
        platform: isMinecraft ? (isBedrock ? 'bedrock' : 'java') : isFiveM ? 'fivem' : 'generic',
        status: 'offline',
        ping: null,
        version: null,
        loading: true,
    });

    const isFetchingRef = useRef(false);

    const refresh = useCallback(async () => {
        if (!serverId || isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            const { data } = await http.get(`/api/client/servers/${serverId}/player-status`);
            setStats((prev) => ({
                ...prev,
                online: typeof data.online === 'number' ? data.online : prev.online,
                max: typeof data.max === 'number' && data.max > 0 ? data.max : (prev.max ?? (typeof data.max === 'number' ? data.max : null)),
                platform: data.platform || prev.platform,
                status: data.status || prev.status,
                ping: typeof data.ping === 'number' ? data.ping : null,
                version: data.version || null,
                loading: false,
            }));
        } catch {
            setStats((prev) => ({ ...prev, loading: false }));
        } finally {
            isFetchingRef.current = false;
        }
    }, [serverId]);

    // Initial fetch on mount or serverId change
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Periodic polling every 25s while server is running
    useEffect(() => {
        const interval = setInterval(() => {
            if (stats.status !== 'offline') {
                refresh();
            }
        }, 25000);
        return () => clearInterval(interval);
    }, [refresh, stats.status]);

    // Listen to power events
    useWebsocketEvent(SocketEvent.STATUS, (status) => {
        const normalized = (status || '').toLowerCase();
        if (normalized === 'offline' || normalized === 'stopping') {
            setStats((prev) => ({ ...prev, online: 0, status: 'offline' }));
        } else if (normalized === 'running') {
            setStats((prev) => ({ ...prev, status: 'running' }));
            refresh();
        } else if (normalized === 'starting') {
            setStats((prev) => ({ ...prev, status: 'starting' }));
        }
    });

    // Real-time console output parsing for instant join/leave/list detection
    useWebsocketEvent(SocketEvent.CONSOLE_OUTPUT, (line) => {
        if (!line || typeof line !== 'string') return;

        try {
            const clean = line.replace(/\x1b\[[0-9;]*m/g, '');

            // List command output: "There are X of a max of Y players online" or "There are X/Y players online" or "Players online: X/Y"
            let online: number | null = null;
            let max: number | null = null;

            const listMatch1 = clean.match(/there are\s+(\d+)(?:\s*(?:\/|(?:out\s+of|of)(?:\s+a)?\s+max(?:imum)?(?:\s+of)?)\s*(\d+))?\s+players?\s+online/i);
            if (listMatch1) {
                online = parseInt(listMatch1[1], 10);
                if (listMatch1[2]) max = parseInt(listMatch1[2], 10);
            } else {
                const listMatch2 = clean.match(/(?:online\s+players|players\s+online)\s*[:(]?\s*(\d+)\s*(?:\/|\s+of\s+)\s*(\d+)\s*\)?/i);
                if (listMatch2) {
                    online = parseInt(listMatch2[1], 10);
                    max = parseInt(listMatch2[2], 10);
                } else {
                    const listMatch3 = clean.match(/total\s+players\s+online:\s*(\d+)/i);
                    if (listMatch3) {
                        online = parseInt(listMatch3[1], 10);
                    }
                }
            }

            if (online !== null && !isNaN(online)) {
                const count = online;
                const maxSlots = max !== null && !isNaN(max) && max > 0 ? max : null;
                setStats((prev) => ({
                    ...prev,
                    online: count,
                    max: maxSlots !== null ? maxSlots : prev.max,
                    status: 'running',
                }));
                return;
            }

            // Java join
            if (/(?:joined the game|logged in with entity id)/i.test(clean)) {
                setStats((prev) => ({
                    ...prev,
                    online: prev.max ? Math.min(prev.online + 1, prev.max) : prev.online + 1,
                    status: 'running',
                }));
                return;
            }

            // Java leave
            if (/(?:left the game|lost connection:)/i.test(clean)) {
                setStats((prev) => ({
                    ...prev,
                    online: Math.max(prev.online - 1, 0),
                    status: 'running',
                }));
                return;
            }

            // Bedrock connect
            if (/Player connected:/i.test(clean)) {
                setStats((prev) => ({
                    ...prev,
                    online: prev.max ? Math.min(prev.online + 1, prev.max) : prev.online + 1,
                    status: 'running',
                }));
                return;
            }

            // Bedrock disconnect
            if (/Player disconnected:/i.test(clean)) {
                setStats((prev) => ({
                    ...prev,
                    online: Math.max(prev.online - 1, 0),
                    status: 'running',
                }));
                return;
            }

            // FiveM / txAdmin connect
            if (/(?:Connecting:\s+|entered the server|\[txAdmin\].*player joined)/i.test(clean)) {
                setStats((prev) => ({
                    ...prev,
                    online: prev.max ? Math.min(prev.online + 1, prev.max) : prev.online + 1,
                    status: 'running',
                }));
                return;
            }

            // FiveM / txAdmin disconnect
            if (/(?:Dropping:\s+|\[txAdmin\].*player dropped|disconnected:\s*Exiting)/i.test(clean)) {
                setStats((prev) => ({
                    ...prev,
                    online: Math.max(prev.online - 1, 0),
                    status: 'running',
                }));
                return;
            }
        } catch {
            // Ignore parse errors
        }
    });

    return {
        ...stats,
        refresh,
    };
};

export default useServerPlayers;
