import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import useServerPlayers, { ServerPlayerStats } from '@/plugins/useServerPlayers';
import { MinecraftTickStats } from '@/plugins/useMinecraftTickStats';

type Stats = Record<'memory' | 'cpu' | 'disk' | 'uptime' | 'rx' | 'tx', number>;

export const useServerLiveStats = () => {
    const [stats, setStats] = useState<Stats>({ memory: 0, cpu: 0, disk: 0, uptime: 0, tx: 0, rx: 0 });
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance  = ServerContext.useStoreState((state) => state.socket.instance);

    useEffect(() => {
        if (!connected || !instance) return;
        instance.send(SocketRequest.SEND_STATS);
    }, [instance, connected]);

    useWebsocketEvent(SocketEvent.STATS, (data) => {
        try {
            const p = JSON.parse(data);
            setStats({
                memory: p.memory_bytes  || 0,
                cpu:    p.cpu_absolute  || 0,
                disk:   p.disk_bytes    || 0,
                tx:     p.network?.tx_bytes || 0,
                rx:     p.network?.rx_bytes || 0,
                uptime: p.uptime        || 0,
            });
        } catch { /* ignore */ }
    });

    return stats;
};

// ── Micro bar ─────────────────────────────────────────────────────────────────
const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="w-full bg-[#0F1115] h-[2px] mt-2 rounded-full overflow-hidden">
        <div
            className={`h-full transition-all duration-700 rounded-full ${color}`}
            style={{ width: `${Math.max(pct, 1.5)}%` }}
        />
    </div>
);

// ── Stat row (label / value) ──────────────────────────────────────────────────
const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between py-2 border-b border-[#262A33] last:border-b-0 font-sans">
        <span
            className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] font-sans font-semibold"
        >
            {label}
        </span>
        <span
            className="text-xs text-[#F3F4F6] tabular-nums font-mono"
        >
            {value}
        </span>
    </div>
);

// ── Section header ────────────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
    <div className="px-4 py-2.5 bg-[#1C1F26] border-b border-[#262A33]">
        <p
            className="m-0 text-[10px] uppercase tracking-[0.12em] text-[#9CA3AF] font-sans font-semibold"
        >
            {title}
        </p>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// LiveStatsSidebar
// ─────────────────────────────────────────────────────────────────────────────
interface SidebarProps {
    activeTab: 'stream' | 'telemetry' | 'inspector';
    onTabChange: (tab: 'stream' | 'telemetry' | 'inspector') => void;
    playerStats?: ServerPlayerStats;
    tickStats?: MinecraftTickStats;
}

export const LiveStatsSidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, playerStats: propPlayerStats, tickStats }) => {
    const stats  = useServerLiveStats();
    const defaultPlayerStats = useServerPlayers();
    const playerStats = propPlayerStats || defaultPlayerStats;
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const limits = server.limits;

    const memMax = mbToBytes(limits.memory);
    const dskMax = mbToBytes(limits.disk);

    const cpuPct = limits.cpu > 0 ? Math.min((stats.cpu / limits.cpu) * 100, 100) : Math.min(stats.cpu, 100);
    const memPct = memMax ? Math.min((stats.memory / memMax) * 100, 100) : 0;
    const dskPct = dskMax ? Math.min((stats.disk   / dskMax) * 100, 100) : 0;
    const playerPct = playerStats.max ? Math.min((playerStats.online / playerStats.max) * 100, 100) : 0;

    const uptime = stats.uptime > 0 ? (() => {
        const s = Math.floor(stats.uptime / 1000);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${sec}s`;
        return `${sec}s`;
    })() : '—';

    return (
        <div className="flex flex-col gap-4 font-sans">

            {/* ── Metrics Panel ── */}
            <div className="border border-[#262A33] rounded-lg bg-[#16181D] overflow-hidden">
                <SectionHeader title="Instance Metrics" />

                <div className="px-4 pt-3.5 pb-2">
                    {/* CPU */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] font-semibold">CPU</span>
                            <span className="text-[10px] font-mono text-[#6B7280]">{Math.round(cpuPct)}%</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <span
                                className="text-base text-[#F3F4F6] leading-none tabular-nums font-mono font-medium whitespace-nowrap"
                            >
                                {stats.cpu.toFixed(1)}%
                            </span>
                            <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                                of {limits.cpu > 0 ? `${limits.cpu}%` : '∞'}
                            </span>
                        </div>
                        <Bar pct={cpuPct} color={cpuPct > 90 ? 'bg-[#EF4444]' : cpuPct > 70 ? 'bg-[#F59E0B]' : 'bg-[#14B8A6]'} />
                    </div>

                    {/* Memory */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] font-semibold">Memory</span>
                            <span className="text-[10px] font-mono text-[#6B7280]">{Math.round(memPct)}%</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <span
                                className="text-base text-[#F3F4F6] leading-none tabular-nums font-mono font-medium whitespace-nowrap"
                            >
                                {bytesToString(stats.memory)}
                            </span>
                            <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                                of {limits.memory ? bytesToString(memMax) : '∞'}
                            </span>
                        </div>
                        <Bar pct={memPct} color={memPct > 90 ? 'bg-[#EF4444]' : memPct > 70 ? 'bg-[#F59E0B]' : 'bg-[#38BDF8]'} />
                    </div>

                    {/* Storage */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] font-semibold">Storage</span>
                            <span className="text-[10px] font-mono text-[#6B7280]">{Math.round(dskPct)}%</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <span
                                className="text-base text-[#F3F4F6] leading-none tabular-nums font-mono font-medium whitespace-nowrap"
                            >
                                {bytesToString(stats.disk)}
                            </span>
                            <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                                of {limits.disk ? bytesToString(dskMax) : '∞'}
                            </span>
                        </div>
                        <Bar pct={dskPct} color="bg-[#A78BFA]" />
                    </div>

                    {/* Players & Slots */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] font-semibold">Players</span>
                                {playerStats.status === 'running' && playerStats.online > 0 && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
                                )}
                            </div>
                            <span className="text-[10px] font-mono text-[#6B7280]">
                                {playerStats.max ? `${Math.round(playerPct)}%` : '—'}
                            </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <span
                                className="text-base text-[#F3F4F6] leading-none tabular-nums font-mono font-medium whitespace-nowrap"
                            >
                                {playerStats.online}
                            </span>
                            <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                                of {playerStats.max !== null ? `${playerStats.max} slots` : '∞ slots'}
                            </span>
                        </div>
                        <Bar
                            pct={playerPct}
                            color={playerStats.online > 0 ? 'bg-[#14B8A6]' : 'bg-[#262A33]'}
                        />
                    </div>

                    {/* Minecraft Server Tick Health (TPS & MSPT) */}
                    {server.isMinecraft && (
                        <div className="mb-3 pt-3 border-t border-[#262A33]">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] font-semibold">Tick Rate (TPS)</span>
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                            (tickStats?.tps ?? 20) >= 19.0
                                                ? 'bg-[#14B8A6] animate-pulse'
                                                : (tickStats?.tps ?? 20) >= 16.0
                                                ? 'bg-[#F59E0B]'
                                                : 'bg-[#EF4444] animate-ping'
                                        }`}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={tickStats?.sample}
                                    className="text-[9px] font-sans text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors cursor-pointer"
                                    title="Click to sample tick rate"
                                >
                                    ↻ Sample
                                </button>
                            </div>
                            <div className="flex items-baseline justify-between gap-2">
                                <span
                                    className={`text-base leading-none tabular-nums font-mono font-medium whitespace-nowrap ${
                                        (tickStats?.tps ?? 20) >= 19.0
                                            ? 'text-[#F3F4F6]'
                                            : (tickStats?.tps ?? 20) >= 16.0
                                            ? 'text-[#F59E0B]'
                                            : 'text-[#EF4444]'
                                    }`}
                                >
                                    {tickStats?.tps !== null && tickStats?.tps !== undefined ? tickStats.tps.toFixed(1) : '20.0'}
                                </span>
                                <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                                    Target 20.0
                                </span>
                            </div>
                            <Bar
                                pct={Math.min(((tickStats?.tps ?? 20) / 20) * 100, 100)}
                                color={(tickStats?.tps ?? 20) >= 19.0 ? 'bg-[#14B8A6]' : (tickStats?.tps ?? 20) >= 16.0 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}
                            />

                            {/* MSPT Duration */}
                            <div className="mt-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] font-semibold">Tick Duration (MSPT)</span>
                                    <span className="text-[10px] font-mono text-[#6B7280]">
                                        {tickStats?.mspt !== null && tickStats?.mspt !== undefined ? `${Math.round(Math.min((tickStats.mspt / 50) * 100, 100))}%` : '—'}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-base text-[#F3F4F6] leading-none tabular-nums font-mono font-medium whitespace-nowrap">
                                        {tickStats?.mspt !== null && tickStats?.mspt !== undefined ? `${tickStats.mspt.toFixed(1)}ms` : '—'}
                                    </span>
                                    <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                                        of 50.0ms limit
                                    </span>
                                </div>
                                <Bar
                                    pct={tickStats?.mspt ? Math.min((tickStats.mspt / 50) * 100, 100) : 25}
                                    color={!tickStats?.mspt || tickStats.mspt <= 35 ? 'bg-[#14B8A6]' : tickStats.mspt <= 50 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider rows */}
                <div className="px-4 border-t border-[#262A33]">
                    <Row label="Inbound"  value={bytesToString(stats.rx)} />
                    <Row label="Outbound" value={bytesToString(stats.tx)} />
                    <Row label="Uptime"   value={uptime} />
                    <Row label="Slots"    value={playerStats.max !== null ? `${playerStats.max} Max` : '—'} />
                </div>

                {/* Spark Profiler Shortcut */}
                {server.isMinecraft && (
                    <Link
                        to={`/server/${server.id}/spark`}
                        className="w-full px-4 py-2.5 bg-[#1C1F26] hover:bg-[#252A34] border-t border-[#262A33] text-amber-300 hover:text-amber-200 text-xs flex items-center justify-between transition-colors cursor-pointer group"
                    >
                        <span className="flex items-center gap-2 font-sans font-medium">
                            <svg className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Spark Profiler</span>
                        </span>
                        <span className="text-[10px] text-amber-400/80 font-sans font-semibold">Open →</span>
                    </Link>
                )}
            </div>

            {/* ── View Switcher ── */}
            <div className="border border-[#262A33] rounded-lg bg-[#16181D] overflow-hidden">
                <SectionHeader title="Workstation" />
                <div>
                    {([
                        { id: 'stream'    as const, label: 'Console' },
                        { id: 'telemetry' as const, label: 'Analytics' },
                        { id: 'inspector' as const, label: 'Inspector & SFTP' },
                    ]).map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onTabChange(id)}
                            className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 transition-colors border-b border-[#262A33] last:border-0 cursor-pointer font-sans ${
                                activeTab === id
                                    ? 'text-[#F3F4F6] bg-[#1C1F26] font-medium'
                                    : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C1F26]/40'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${activeTab === id ? 'bg-[#14B8A6]' : 'bg-[#383E4D]'}`} />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ── Mobile stat cards ─────────────────────────────────────────────────────────
export const MobileStatCards: React.FC<{ playerStats?: ServerPlayerStats; tickStats?: MinecraftTickStats }> = ({ playerStats: propPlayerStats, tickStats }) => {
    const stats  = useServerLiveStats();
    const defaultPlayerStats = useServerPlayers();
    const playerStats = propPlayerStats || defaultPlayerStats;
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const memMax = mbToBytes(server.limits.memory);
    const cpuPct = server.limits.cpu > 0 ? Math.min((stats.cpu / server.limits.cpu) * 100, 100) : Math.min(stats.cpu, 100);
    const memPct = memMax ? Math.min((stats.memory / memMax) * 100, 100) : 0;
    const playerPct = playerStats.max ? Math.min((playerStats.online / playerStats.max) * 100, 100) : 0;

    const card = (label: string, value: string, pct?: number, color?: string) => (
        <div className="border border-[#262A33] rounded-lg bg-[#16181D] p-3 font-sans">
            <div className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] mb-1.5 font-sans font-semibold">{label}</div>
            <div className="text-base text-[#F3F4F6] tabular-nums font-mono font-medium">{value}</div>
            {pct !== undefined && color && <Bar pct={pct} color={color} />}
        </div>
    );

    return (
        <>
            {card('CPU',     `${stats.cpu.toFixed(1)}%`, cpuPct, 'bg-[#14B8A6]')}
            {card('Memory',  bytesToString(stats.memory), memPct, 'bg-[#38BDF8]')}
            {card('Players', `${playerStats.online} / ${playerStats.max !== null ? playerStats.max : '—'}`, playerPct, 'bg-[#14B8A6]')}
            {server.isMinecraft && (
                <>
                    {card('TPS', tickStats?.tps !== null && tickStats?.tps !== undefined ? tickStats.tps.toFixed(1) : '20.0', Math.min(((tickStats?.tps ?? 20) / 20) * 100, 100), (tickStats?.tps ?? 20) >= 19 ? 'bg-[#14B8A6]' : 'bg-[#EF4444]')}
                    {card('MSPT', tickStats?.mspt !== null && tickStats?.mspt !== undefined ? `${tickStats.mspt.toFixed(1)}ms` : '—', tickStats?.mspt ? Math.min((tickStats.mspt / 50) * 100, 100) : 25, (tickStats?.mspt ?? 20) <= 35 ? 'bg-[#14B8A6]' : 'bg-[#EF4444]')}
                </>
            )}
            {card('RX',      bytesToString(stats.rx))}
            {card('TX',      bytesToString(stats.tx))}
        </>
    );
};

// ── Service Inspector & SFTP ──────────────────────────────────────────────────
export const ServiceInspector: React.FC = () => {
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const serverShortId = server.id;
    const sftp = server.sftpDetails || { ip: '127.0.0.1', port: 2022 };
    const [copied, setCopied] = useState<string | null>(null);

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const sftpUri = `sftp://client.${serverShortId}@${sftp.ip}:${sftp.port}`;

    const InfoBlock = ({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) => (
        <div className="bg-[#16181D] px-5 py-3.5 font-sans">
            <div className="text-[10px] uppercase tracking-[0.1em] text-[#9CA3AF] mb-1 font-sans font-semibold">{label}</div>
            <div
                className="text-xs text-[#E2E8F0] truncate select-all"
                style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)' }}
            >
                {value}
            </div>
        </div>
    );

    return (
        <div className="space-y-4 font-sans">
            {/* SFTP panel */}
            <div className="border border-[#262A33] rounded-lg bg-[#16181D] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-[#1C1F26] border-b border-[#262A33]">
                    <div>
                        <h3 className="text-sm font-sans font-medium text-[#F3F4F6] m-0 tracking-tight">SFTP Access</h3>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5 m-0 font-sans">Secure file transfer protocol credentials.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => copy(sftpUri, 'uri')}
                        className="h-8 px-3 py-1.5 rounded-md text-xs font-sans font-medium text-[#D1D5DB] hover:text-[#FFFFFF] border border-[#2B303C] hover:border-[#3A4150] bg-[#1C1F26] hover:bg-[#252A34] transition-colors cursor-pointer"
                    >
                        {copied === 'uri' ? '✓ Copied' : 'Copy URI'}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-y md:divide-y-0 divide-[#262A33]">
                    <InfoBlock label="Host"     value={sftp.ip} />
                    <InfoBlock label="Port"     value={String(sftp.port)} />
                    <InfoBlock label="Username" value={`client.${serverShortId}`} />
                </div>
            </div>

            {/* Runtime */}
            <div className="border border-[#262A33] rounded-lg bg-[#16181D] overflow-hidden">
                <div className="px-5 py-3 bg-[#1C1F26] border-b border-[#262A33]">
                    <h3 className="text-sm font-sans font-medium text-[#F3F4F6] m-0 tracking-tight">Runtime Topography</h3>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5 m-0 font-sans">Container image, host daemon and hardware limits.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-y divide-[#262A33]">
                    <InfoBlock label="Node Host"          value={server.node} />
                    <InfoBlock label="Internal ID"        value={`#${server.internalId}`} />
                    <InfoBlock label="Docker Image"       value={server.dockerImage || 'Container Default'} />
                    <InfoBlock label="Instance UUID"      value={server.uuid} />
                    <InfoBlock label="CPU Allocation"     value={server.limits.cpu > 0 ? `${server.limits.cpu}%` : 'Unlimited'} />
                    <InfoBlock label="Memory Allocation"  value={server.limits.memory > 0 ? `${server.limits.memory} MiB` : 'Unlimited'} />
                </div>
            </div>

            {/* Allocations */}
            <div className="border border-[#262A33] rounded-lg bg-[#16181D] overflow-hidden">
                <div className="px-5 py-3 bg-[#1C1F26] border-b border-[#262A33]">
                    <h3 className="text-sm font-sans font-medium text-[#F3F4F6] m-0 tracking-tight">Network Allocations</h3>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5 m-0 font-sans">Assigned TCP/UDP port mappings.</p>
                </div>
                <div className="divide-y divide-[#262A33]">
                    {(server.allocations || []).map((alloc) => (
                        <div key={alloc.id} className="flex items-center justify-between px-5 py-3 text-xs hover:bg-[#1C1F26] transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-[#F3F4F6] font-mono">
                                    {alloc.alias || ip(alloc.ip)}:{alloc.port}
                                </span>
                                {alloc.isDefault && (
                                    <span
                                        className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-[#1C2628] text-[#14B8A6] border border-[#14B8A6]/30 font-sans font-medium"
                                    >
                                        Primary
                                    </span>
                                )}
                            </div>
                            <span className="text-[#6B7280] font-mono">:{alloc.port}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiveStatsSidebar;
