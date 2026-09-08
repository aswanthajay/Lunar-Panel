import { useState, useCallback, useEffect, useRef } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import http from '@/api/http';

export interface MinecraftTickStats {
    tps: number | null;
    tps1m: number | null;
    tps5m: number | null;
    tps15m: number | null;
    mspt: number | null;
    msptMin: number | null;
    msptMax: number | null;
    lastReportUrl: string | null;
    lastUpdated: number | null;
    sample: () => void;
}

export const useMinecraftTickStats = (): MinecraftTickStats => {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const serverId = server?.id;
    const isMinecraft = Boolean(server?.isMinecraft);
    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);

    const [stats, setStats] = useState<Omit<MinecraftTickStats, 'sample'>>({
        tps: null,
        tps1m: null,
        tps5m: null,
        tps15m: null,
        mspt: null,
        msptMin: null,
        msptMax: null,
        lastReportUrl: null,
        lastUpdated: null,
    });

    const hasInitialSampled = useRef(false);

    // Parse console lines for tick / TPS / MSPT / Spark info
    const parseLine = useCallback((raw: string) => {
        if (!isMinecraft || !raw) return;

        // Strip ANSI escape codes and Minecraft color codes (§a, §c, etc.)
        const clean = raw.replace(/\x1b\[[0-9;]*m|§[0-9a-fk-or]/gi, '').trim();

        // 1. Detect generated Spark report URL
        const sparkMatch = clean.match(/https?:\/\/spark\.lucko\.me\/([a-zA-Z0-9_-]+)/i);
        if (sparkMatch && serverId) {
            const reportUrl = sparkMatch[0];
            setStats((prev) => ({ ...prev, lastReportUrl: reportUrl, lastUpdated: Date.now() }));
            // Save report in background
            http.post(`/api/client/servers/${serverId}/minecraft/spark/reports`, {
                url: reportUrl,
                label: 'Profiler Run',
            }).catch(() => {});
        }

        let nextTps: number | null = null;
        let nextTps1m: number | null = null;
        let nextTps5m: number | null = null;
        let nextTps15m: number | null = null;
        let nextMspt: number | null = null;
        let nextMsptMin: number | null = null;
        let nextMsptMax: number | null = null;

        // Pattern A: "TPS from last 1m, 5m, 15m: 20.0, 19.98, 20.0" (Spigot / Paper)
        const tpsMultiMatch = clean.match(/TPS\s+(?:from\s+last\s+[^:]+:\s*)[*~]?(\d+(?:\.\d+)?)[,\s]+[*~]?(\d+(?:\.\d+)?)[,\s]+[*~]?(\d+(?:\.\d+)?)/i);
        if (tpsMultiMatch) {
            nextTps1m = parseFloat(tpsMultiMatch[1]);
            nextTps5m = parseFloat(tpsMultiMatch[2]);
            nextTps15m = parseFloat(tpsMultiMatch[3]);
            nextTps = nextTps1m;
        }

        // Pattern B: "[spark] TPS: 20.0 | MSPT: 12.4ms" or single TPS
        if (nextTps === null) {
            const singleTps = clean.match(/TPS[:\s]+[*~]?(\d+(?:\.\d+)?)/i) || clean.match(/(\d+(?:\.\d+)?)\s*TPS/i);
            if (singleTps) {
                const val = parseFloat(singleTps[1]);
                if (val >= 0 && val <= 30) {
                    nextTps = val;
                }
            }
        }

        // Pattern C: "Tick durations (min/med/max): 4.1/8.2/14.5ms"
        const tickDurMatch = clean.match(/(?:Tick\s+durations|tick\s+times|average\s+tick\s+time|MSPT)[^:]*:\s*(?:min\/med\/(?:95%ile\/)?max\s*ms\s*)?[~*]?(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?(?:\s*\/\s*(\d+(?:\.\d+)?))?/i);
        if (tickDurMatch) {
            if (tickDurMatch[3]) {
                nextMsptMin = parseFloat(tickDurMatch[1]);
                nextMspt = parseFloat(tickDurMatch[2]);
                nextMsptMax = parseFloat(tickDurMatch[3]);
            } else if (tickDurMatch[2]) {
                nextMspt = parseFloat(tickDurMatch[2]);
            } else {
                nextMspt = parseFloat(tickDurMatch[1]);
            }
        }

        // Pattern D: "12.4 ms/tick" or "average tick time of 12.4ms" (Vanilla 1.20.3+)
        if (nextMspt === null) {
            const tickTime = clean.match(/(\d+(?:\.\d+)?)\s*ms(?:\/tick)?/i);
            if (tickTime && (clean.toLowerCase().includes('tick') || clean.toLowerCase().includes('mspt'))) {
                nextMspt = parseFloat(tickTime[1]);
            }
        }

        if (nextTps !== null || nextMspt !== null) {
            setStats((prev) => ({
                ...prev,
                tps: nextTps !== null ? Math.min(20, nextTps) : prev.tps,
                tps1m: nextTps1m !== null ? Math.min(20, nextTps1m) : prev.tps1m,
                tps5m: nextTps5m !== null ? Math.min(20, nextTps5m) : prev.tps5m,
                tps15m: nextTps15m !== null ? Math.min(20, nextTps15m) : prev.tps15m,
                mspt: nextMspt !== null ? nextMspt : prev.mspt,
                msptMin: nextMsptMin !== null ? nextMsptMin : prev.msptMin,
                msptMax: nextMsptMax !== null ? nextMsptMax : prev.msptMax,
                lastUpdated: Date.now(),
            }));
        }
    }, [isMinecraft, serverId]);

    // Listen to console output websocket stream
    useWebsocketEvent(SocketEvent.CONSOLE_OUTPUT, parseLine);

    // Trigger a live sample command to check TPS / MSPT
    const sample = useCallback(() => {
        if (!isMinecraft || !serverId) return;
        if (instance && connected) {
            instance.send('send command', 'tps');
        } else {
            http.post(`/api/client/servers/${serverId}/minecraft/spark/command`, { type: 'sample' }).catch(() => {});
        }
    }, [isMinecraft, serverId, instance, connected]);

    // Initial sample when server connects
    useEffect(() => {
        if (!connected || !isMinecraft || hasInitialSampled.current) {
            return undefined;
        }
        hasInitialSampled.current = true;
        const timer = setTimeout(() => {
            sample();
        }, 3000);
        return () => clearTimeout(timer);
    }, [connected, isMinecraft, sample]);

    return {
        ...stats,
        sample,
    };
};

export default useMinecraftTickStats;
