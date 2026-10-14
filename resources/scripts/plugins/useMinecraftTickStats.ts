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
    sample: (force?: boolean | unknown) => void;
}

// Global server throttle tracking across mounts to prevent repetitive command execution
const lastSampledByServer: Record<string, number> = {};

// Filter out server overload / lag drift warnings so they aren't parsed as tick metrics
const isIgnoredTickLine = (clean: string): boolean => {
    const lower = clean.toLowerCase();
    return (
        lower.includes("can't keep up") ||
        lower.includes('ticks behind') ||
        lower.includes('running behind') ||
        lower.includes('is the server overloaded') ||
        lower.includes('stopped responding') ||
        lower.includes('watchdog')
    );
};

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

    // Parse console lines for tick / TPS / MSPT / Spark info
    const parseLine = useCallback((raw: string) => {
        if (!isMinecraft || !raw) return;

        // Strip ANSI escape codes and Minecraft color codes (§a, §c, etc.)
        const clean = raw.replace(/\x1b\[[0-9;]*m|§[0-9a-fk-or]/gi, '').trim();

        // Discard any server overload/lag warnings (e.g. "Can't keep up! ... Running 2507ms or 50 ticks behind")
        if (isIgnoredTickLine(clean)) return;

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

        // Pattern C: Paper / Purpur sublines: "5s: 12.4/8.1/24.2ms" or "5s: 12.4 / 8.1 / 24.2 ms"
        // Paper format is avg / min / max (index 1 is average MSPT)
        const paperSubMatch = clean.match(/(?:5s|10s|1m)\s*:\s*[*~]?(\d+(?:\.\d+)?)\s*\/\s*[*~]?(\d+(?:\.\d+)?)\s*\/\s*[*~]?(\d+(?:\.\d+)?)\s*ms?/i);
        if (paperSubMatch) {
            nextMspt = parseFloat(paperSubMatch[1]);
            nextMsptMin = parseFloat(paperSubMatch[2]);
            nextMsptMax = parseFloat(paperSubMatch[3]);
        }

        // Pattern D: Paper / Spigot inline: "Server tick times (avg/min/max): 15.2 / 9.1 / 32.0 ms"
        if (nextMspt === null) {
            const paperInlineMatch = clean.match(/(?:tick\s+times?|tick\s+durations?)\s*\((?:avg\/min\/max)[^)]*\)\s*:\s*[*~]?(\d+(?:\.\d+)?)\s*\/\s*[*~]?(\d+(?:\.\d+)?)\s*\/\s*[*~]?(\d+(?:\.\d+)?)\s*ms?/i);
            if (paperInlineMatch) {
                nextMspt = parseFloat(paperInlineMatch[1]);
                nextMsptMin = parseFloat(paperInlineMatch[2]);
                nextMsptMax = parseFloat(paperInlineMatch[3]);
            }
        }

        // Pattern E: Spark 4-value breakdown: "10s: 2.1 / 3.4 / 8.2 / 12.5" (min / med / 95%ile / max)
        if (nextMspt === null) {
            const spark4Match = clean.match(/(?:10s|1m)\s*:\s*[*~]?(\d+(?:\.\d+)?)\s*\/\s*[*~]?(\d+(?:\.\d+)?)\s*\/\s*[*~]?(\d+(?:\.\d+)?)\s*\/\s*[*~]?(\d+(?:\.\d+)?)/i);
            if (spark4Match) {
                nextMsptMin = parseFloat(spark4Match[1]);
                nextMspt = parseFloat(spark4Match[2]);
                nextMsptMax = parseFloat(spark4Match[4]);
            }
        }

        // Pattern F: Spark / General 3-value: "Tick durations (min/med/max ms): 3.2/4.1/12.8ms"
        if (nextMspt === null) {
            const medMaxMatch = clean.match(/(?:tick\s+durations?|tick\s+times?)\s*\([^)]*min\/med\/max[^)]*\)\s*:\s*[*~]?(\d+(?:\.\d+)?)\s*\/\s*[*~]?(\d+(?:\.\d+)?)\s*\/\s*[*~]?(\d+(?:\.\d+)?)\s*ms?/i);
            if (medMaxMatch) {
                nextMsptMin = parseFloat(medMaxMatch[1]);
                nextMspt = parseFloat(medMaxMatch[2]);
                nextMsptMax = parseFloat(medMaxMatch[3]);
            }
        }

        // Pattern G: Explicit MSPT: "Current MSPT: 14.2ms" or "MSPT: 18.5ms" or "[spark] TPS: 20.0 | MSPT: 12.4ms"
        if (nextMspt === null) {
            const explicitMspt = clean.match(/(?:current\s+)?MSPT\s*[:=]\s*[*~]?(\d+(?:\.\d+)?)\s*ms?/i);
            if (explicitMspt) {
                nextMspt = parseFloat(explicitMspt[1]);
            }
        }

        // Pattern H: Vanilla 1.20.3+ "/tick query" / Forge: "Average tick time: 14.2ms" or "Mean tick time: 14.123 ms"
        if (nextMspt === null) {
            const meanMatch = clean.match(/(?:average|mean)\s+tick\s+time(?:\s+of)?\s*[:\s]\s*[*~]?(\d+(?:\.\d+)?)\s*ms/i);
            if (meanMatch) {
                nextMspt = parseFloat(meanMatch[1]);
            }
        }

        // Pattern I: Explicit single tick duration: "Tick duration: 14.2ms" or "Tick time: 14.2ms"
        if (nextMspt === null) {
            const durationMatch = clean.match(/(?:tick\s+duration|tick\s+time)\s*:\s*[*~]?(\d+(?:\.\d+)?)\s*ms/i);
            if (durationMatch) {
                nextMspt = parseFloat(durationMatch[1]);
            }
        }

        // Sanity guards: MSPT must be positive and not an unbounded lag drift spike (> 150ms)
        if (nextMspt !== null && (isNaN(nextMspt) || nextMspt <= 0 || nextMspt > 150)) {
            nextMspt = null;
        }
        if (nextMsptMin !== null && (isNaN(nextMsptMin) || nextMsptMin <= 0 || nextMsptMin > 150)) {
            nextMsptMin = null;
        }
        if (nextMsptMax !== null && (isNaN(nextMsptMax) || nextMsptMax <= 0 || nextMsptMax > 200)) {
            nextMsptMax = null;
        }
        if (nextTps !== null && (isNaN(nextTps) || nextTps < 0 || nextTps > 30)) {
            nextTps = null;
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

    // Reset stats when server stops or is offline
    useWebsocketEvent(SocketEvent.STATUS, (status: string) => {
        if (status === 'offline' || status === 'stopping') {
            setStats({
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
        }
    });

    // Trigger a live sample command to check TPS / MSPT
    const sample = useCallback((force?: boolean | unknown) => {
        if (!isMinecraft || !serverId) return;
        const isForced = force === true || (typeof force === 'object' && force !== null);
        const now = Date.now();
        const lastSample = lastSampledByServer[serverId] || 0;
        if (!isForced && (now - lastSample < 60000)) {
            return;
        }
        lastSampledByServer[serverId] = now;

        if (instance && connected) {
            instance.send('send command', 'tps');
            // Stagger 'mspt' slightly so both commands run cleanly on Paper / Purpur
            setTimeout(() => {
                if (instance && connected) {
                    instance.send('send command', 'mspt');
                }
            }, 300);
        } else {
            http.post(`/api/client/servers/${serverId}/minecraft/spark/command`, { type: 'sample' }).catch(() => {});
        }
    }, [isMinecraft, serverId, instance, connected]);

    // Initial sample when server connects (throttled across page/tab navigations)
    useEffect(() => {
        if (!connected || !isMinecraft || !serverId) {
            return undefined;
        }
        const lastSample = lastSampledByServer[serverId] || 0;
        if (Date.now() - lastSample < 60000) {
            return undefined;
        }
        const timer = setTimeout(() => {
            sample(false);
        }, 3000);
        return () => clearTimeout(timer);
    }, [connected, isMinecraft, serverId, sample]);

    return {
        ...stats,
        sample,
    };
};

export default useMinecraftTickStats;
