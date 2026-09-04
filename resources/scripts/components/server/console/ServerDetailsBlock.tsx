import React, { useEffect, useState } from 'react';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';

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
    <div className="w-full bg-[#141414] h-[2px] mt-2 rounded-full overflow-hidden">
        <div
            className={`h-full transition-all duration-700 rounded-full ${color}`}
            style={{ width: `${Math.max(pct, 1.5)}%` }}
        />
    </div>
);

// ── Stat row (label / value) ──────────────────────────────────────────────────
const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between py-2 border-b border-[#141414] last:border-b-0">
        <span
            className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280]"
            style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}
        >
            {label}
        </span>
        <span
            className="text-xs text-[#D4D4D4] tabular-nums"
            style={{ fontFamily: 'var(--font-mono)' }}
        >
            {value}
        </span>
    </div>
);

// ── Section header ────────────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
    <div className="px-4 py-2.5 bg-[#050505] border-b border-[#141414]">
        <p
            className="m-0 text-[10px] uppercase tracking-[0.12em] text-[#6B7280]"
            style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}
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
}

export const LiveStatsSidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
    const stats  = useServerLiveStats();
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const limits = server.limits;

    const memMax = mbToBytes(limits.memory);
    const dskMax = mbToBytes(limits.disk);

    const cpuPct = limits.cpu > 0 ? Math.min((stats.cpu / limits.cpu) * 100, 100) : Math.min(stats.cpu, 100);
    const memPct = memMax ? Math.min((stats.memory / memMax) * 100, 100) : 0;
    const dskPct = dskMax ? Math.min((stats.disk   / dskMax) * 100, 100) : 0;

    const uptime = stats.uptime > 0 ? (() => {
        const s = Math.floor(stats.uptime / 1000);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${sec}s`;
        return `${sec}s`;
    })() : '—';

    return (
        <div className="flex flex-col gap-4" style={{ fontFamily: 'var(--font-sans)' }}>

            {/* ── Metrics Panel ── */}
            <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] overflow-hidden">
                <SectionHeader title="Instance Metrics" />

                <div className="px-4 pt-3.5 pb-2">
                    {/* CPU */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-semibold">CPU</span>
                            <span className="text-[10px] font-mono text-[#737373]">{Math.round(cpuPct)}%</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <span
                                className="text-base text-[#FFFFFF] leading-none tabular-nums font-mono font-medium whitespace-nowrap"
                            >
                                {stats.cpu.toFixed(1)}%
                            </span>
                            <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                                of {limits.cpu > 0 ? `${limits.cpu}%` : '∞'}
                            </span>
                        </div>
                        <Bar pct={cpuPct} color={cpuPct > 90 ? 'bg-[#EF4444]' : cpuPct > 70 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'} />
                    </div>

                    {/* Memory */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-semibold">Memory</span>
                            <span className="text-[10px] font-mono text-[#737373]">{Math.round(memPct)}%</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <span
                                className="text-base text-[#FFFFFF] leading-none tabular-nums font-mono font-medium whitespace-nowrap"
                            >
                                {bytesToString(stats.memory)}
                            </span>
                            <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                                of {limits.memory ? bytesToString(memMax) : '∞'}
                            </span>
                        </div>
                        <Bar pct={memPct} color={memPct > 90 ? 'bg-[#EF4444]' : memPct > 70 ? 'bg-[#F59E0B]' : 'bg-[#06B6D4]'} />
                    </div>

                    {/* Storage */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-semibold">Storage</span>
                            <span className="text-[10px] font-mono text-[#737373]">{Math.round(dskPct)}%</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <span
                                className="text-base text-[#FFFFFF] leading-none tabular-nums font-mono font-medium whitespace-nowrap"
                            >
                                {bytesToString(stats.disk)}
                            </span>
                            <span className="text-[11px] text-[#6B7280] font-mono whitespace-nowrap">
                                of {limits.disk ? bytesToString(dskMax) : '∞'}
                            </span>
                        </div>
                        <Bar pct={dskPct} color="bg-[#A855F7]" />
                    </div>
                </div>

                {/* Divider rows */}
                <div className="px-4 border-t border-[#141414]">
                    <Row label="Inbound"  value={bytesToString(stats.rx)} />
                    <Row label="Outbound" value={bytesToString(stats.tx)} />
                    <Row label="Uptime"   value={uptime} />
                </div>
            </div>

            {/* ── View Switcher ── */}
            <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] overflow-hidden">
                <SectionHeader title="Workstation" />
                <div>
                    {([
                        { id: 'stream'    as const, label: 'Console Terminal'    },
                        { id: 'telemetry' as const, label: 'Performance Analytics' },
                        { id: 'inspector' as const, label: 'Inspector & SFTP'    },
                    ]).map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onTabChange(id)}
                            className={`w-full text-left px-4 py-2.5 text-[12px] flex items-center gap-2.5 transition-colors border-b border-[#141414] last:border-0 cursor-pointer ${
                                activeTab === id
                                    ? 'text-[#FFFFFF] bg-[#0A0A0A]'
                                    : 'text-[#737373] hover:text-[#D4D4D4] hover:bg-[#0A0A0A]'
                            }`}
                            style={{ fontFamily: 'var(--font-sans)', fontWeight: activeTab === id ? 500 : 400 }}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTab === id ? 'bg-[#10B981]' : 'bg-[#1F1F1F]'}`} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ── Mobile stat cards ─────────────────────────────────────────────────────────
export const MobileStatCards: React.FC = () => {
    const stats  = useServerLiveStats();
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const memMax = mbToBytes(server.limits.memory);
    const cpuPct = server.limits.cpu > 0 ? Math.min((stats.cpu / server.limits.cpu) * 100, 100) : Math.min(stats.cpu, 100);
    const memPct = memMax ? Math.min((stats.memory / memMax) * 100, 100) : 0;

    const card = (label: string, value: string, pct?: number, color?: string) => (
        <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] p-3">
            <div className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280] mb-1.5" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{label}</div>
            <div className="text-base text-[#FFFFFF] tabular-nums font-mono">{value}</div>
            {pct !== undefined && color && <Bar pct={pct} color={color} />}
        </div>
    );

    return (
        <>
            {card('CPU',    `${stats.cpu.toFixed(1)}%`, cpuPct, 'bg-[#10B981]')}
            {card('Memory', bytesToString(stats.memory), memPct, 'bg-[#06B6D4]')}
            {card('RX',     bytesToString(stats.rx))}
            {card('TX',     bytesToString(stats.tx))}
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
        <div className="bg-[#000000] px-5 py-3.5">
            <div className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280] mb-1" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{label}</div>
            <div
                className="text-[12px] text-[#C0C0C0] truncate select-all"
                style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)' }}
            >
                {value}
            </div>
        </div>
    );

    return (
        <div className="space-y-4" style={{ fontFamily: 'var(--font-sans)' }}>
            {/* SFTP panel */}
            <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-[#050505] border-b border-[#141414]">
                    <div>
                        <h3 className="text-sm font-serif font-normal text-[#FFFFFF] m-0 tracking-tight">SFTP Access</h3>
                        <p className="text-[11px] text-[#737373] mt-0.5 m-0 font-sans">Secure file transfer protocol credentials.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => copy(sftpUri, 'uri')}
                        className="px-3 py-1.5 rounded-md text-[11px] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838] bg-[#0A0A0A] hover:bg-[#141414] transition-colors cursor-pointer"
                        style={{ fontFamily: 'var(--font-mono)' }}
                    >
                        {copied === 'uri' ? '✓ Copied' : 'Copy URI'}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-y md:divide-y-0 divide-[#141414]">
                    <InfoBlock label="Host"     value={sftp.ip} />
                    <InfoBlock label="Port"     value={String(sftp.port)} />
                    <InfoBlock label="Username" value={`client.${serverShortId}`} />
                </div>
            </div>

            {/* Runtime */}
            <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] overflow-hidden">
                <div className="px-5 py-3 bg-[#050505] border-b border-[#141414]">
                    <h3 className="text-sm font-serif font-normal text-[#FFFFFF] m-0 tracking-tight">Runtime Topography</h3>
                    <p className="text-[11px] text-[#737373] mt-0.5 m-0 font-sans">Container image, host daemon and hardware limits.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-y divide-[#141414]">
                    <InfoBlock label="Node Host"          value={server.node} />
                    <InfoBlock label="Internal ID"        value={`#${server.internalId}`} />
                    <InfoBlock label="Docker Image"       value={server.dockerImage || 'Container Default'} />
                    <InfoBlock label="Instance UUID"      value={server.uuid} />
                    <InfoBlock label="CPU Allocation"     value={server.limits.cpu > 0 ? `${server.limits.cpu}%` : 'Unlimited'} />
                    <InfoBlock label="Memory Allocation"  value={server.limits.memory > 0 ? `${server.limits.memory} MiB` : 'Unlimited'} />
                </div>
            </div>

            {/* Allocations */}
            <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] overflow-hidden">
                <div className="px-5 py-3 bg-[#050505] border-b border-[#141414]">
                    <h3 className="text-sm font-serif font-normal text-[#FFFFFF] m-0 tracking-tight">Network Allocations</h3>
                    <p className="text-[11px] text-[#737373] mt-0.5 m-0 font-sans">Assigned TCP/UDP port mappings.</p>
                </div>
                <div className="divide-y divide-[#141414]">
                    {(server.allocations || []).map((alloc) => (
                        <div key={alloc.id} className="flex items-center justify-between px-5 py-3 text-[12px] hover:bg-[#050505] transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-[#FFFFFF] font-mono">
                                    {alloc.alias || ip(alloc.ip)}:{alloc.port}
                                </span>
                                {alloc.isDefault && (
                                    <span
                                        className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider bg-[#051F14] text-[#10B981] border border-[#10B981]/40 font-mono"
                                    >
                                        Primary
                                    </span>
                                )}
                            </div>
                            <span className="text-[#525252] font-mono">:{alloc.port}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiveStatsSidebar;
