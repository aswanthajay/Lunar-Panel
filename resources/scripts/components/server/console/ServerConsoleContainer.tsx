import React, { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import Features from '@feature/Features';
import Console from '@/components/server/console/Console';
import StatGraphs from '@/components/server/console/StatGraphs';
import { ServiceInspector, LiveStatsSidebar, MobileStatCards } from '@/components/server/console/ServerDetailsBlock';
import { Alert } from '@/components/elements/alert';
import useServerPlayers from '@/plugins/useServerPlayers';
import useMinecraftTickStats from '@/plugins/useMinecraftTickStats';

export type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

const ServerConsoleContainer = () => {
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = server.isTransferring;
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = server.isNodeUnderMaintenance;

    const playerStats = useServerPlayers();
    const tickStats = useMinecraftTickStats();
    const [dismissedReportUrl, setDismissedReportUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'stream' | 'telemetry' | 'inspector'>('stream');

    return (
        <ServerContentBlock title={'Console'}>
            {(isNodeUnderMaintenance || isInstalling || isTransferring) && (
                <Alert type={'warning'} className={'mb-4'}>
                    {isNodeUnderMaintenance
                        ? 'The node of this server is currently under maintenance and all actions are unavailable.'
                        : isInstalling
                        ? 'This server is currently running its installation process and most actions are unavailable.'
                        : 'This server is currently being transferred to another node and all actions are unavailable.'}
                </Alert>
            )}

            {/* Workstation Layout: Left Stats Sidebar + Right Main Content */}
            <div className="flex gap-5 items-start">

                {/* ── Left: Live Stats Sidebar ── */}
                <div className="hidden xl:flex flex-col gap-0 w-[220px] shrink-0">
                    <LiveStatsSidebar activeTab={activeTab} onTabChange={setActiveTab} playerStats={playerStats} tickStats={tickStats} />
                </div>

                {/* ── Right: Main Workstation Canvas ── */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">

                    {/* Tab strip at top of canvas */}
                    <div className="flex items-center border-b border-[#111111]" style={{ fontFamily: 'var(--font-sans)' }}>
                        {([
                            { id: 'stream'    as const, label: 'Console' },
                            { id: 'telemetry' as const, label: 'Analytics' },
                            { id: 'inspector' as const, label: 'Inspector & SFTP' },
                        ]).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2.5 text-[12px] transition-colors cursor-pointer border-b-[1.5px] -mb-px ${
                                    activeTab === tab.id
                                        ? 'text-[#FFFFFF] border-[#FFFFFF]'
                                        : 'text-[#606060] border-transparent hover:text-[#A0A0A0]'
                                }`}
                                style={{ fontWeight: activeTab === tab.id ? 500 : 400 }}
                            >
                                {tab.label}
                            </button>
                        ))}
                        <div className="flex-1" />
                        <div className="flex items-center gap-2.5">
                            {/* Live Player Slots Badge (Game Servers Only) */}
                            {(server.isMinecraft || server.isFiveM || playerStats.max !== null) && (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded border border-[#1F1F1F] bg-[#050505] text-xs font-mono">
                                    <svg className="w-3.5 h-3.5 text-[#10B981] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-sans font-semibold">Players</span>
                                    <span className="text-white font-medium tabular-nums text-[11px]">
                                        {playerStats.max !== null ? `${playerStats.online} / ${playerStats.max}` : `${playerStats.online} (Unlimited)`}
                                    </span>
                                    {(server.isMinecraft || server.isFiveM) && (
                                        <Link
                                            to={`/server/${server.id}/players`}
                                            className="hidden md:inline text-[10px] text-[#737373] hover:text-white transition-colors border-l border-[#1F1F1F] pl-2 font-sans font-medium"
                                            title="Open Player Manager"
                                        >
                                            Manage →
                                        </Link>
                                    )}
                                </div>
                            )}

                            {/* Minecraft TPS / MSPT Live Pill */}
                            {server.isMinecraft && (
                                <button
                                    type="button"
                                    onClick={() => tickStats.sample()}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#1F1F1F] bg-[#050505] hover:border-[#333333] transition-colors text-xs font-mono cursor-pointer"
                                    title="Click to refresh TPS / MSPT tick sample"
                                >
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                            tickStats.tps === null
                                                ? 'bg-[#525252]'
                                                : tickStats.tps >= 19.0
                                                ? 'bg-[#10B981]'
                                                : tickStats.tps >= 16.0
                                                ? 'bg-[#F59E0B]'
                                                : 'bg-[#EF4444]'
                                        }`}
                                    />
                                    <span className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-sans font-semibold">TPS</span>
                                    <span
                                        className={`font-medium tabular-nums text-[11px] ${
                                            tickStats.tps === null
                                                ? 'text-[#737373]'
                                                : tickStats.tps >= 19.0
                                                ? 'text-[#10B981]'
                                                : tickStats.tps >= 16.0
                                                ? 'text-[#F59E0B]'
                                                : 'text-[#EF4444]'
                                        }`}
                                    >
                                        {tickStats.tps !== null ? tickStats.tps.toFixed(1) : 'Ready'}
                                    </span>

                                    {tickStats.mspt !== null && (
                                        <>
                                            <span className="text-[#333333]">|</span>
                                            <span className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-sans font-semibold">MSPT</span>
                                            <span
                                                className={`font-medium tabular-nums text-[11px] ${
                                                    tickStats.mspt <= 35
                                                        ? 'text-[#10B981]'
                                                        : tickStats.mspt <= 50
                                                        ? 'text-[#F59E0B]'
                                                        : 'text-[#EF4444]'
                                                }`}
                                            >
                                                {tickStats.mspt.toFixed(1)}ms
                                            </span>
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Minecraft Spark Profiler Shortcut Button */}
                            {server.isMinecraft && (
                                <Link
                                    to={`/server/${server.id}/spark`}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#262626] bg-[#0A0A0A] hover:bg-[#161616] hover:border-[#383838] text-white text-[11px] font-mono transition-all group shadow-xs cursor-pointer"
                                    title="Open Spark Profiler & Performance Engine"
                                >
                                    <svg className="w-3.5 h-3.5 text-[#F59E0B] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                    </svg>
                                    <span className="font-semibold text-white">Spark</span>
                                </Link>
                            )}

                            {/* Open txAdmin Button for FiveM */}
                            {server.isFiveM && (server as any).txadminUrl && (
                                <a
                                    href={(server as any).txadminUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#262626] bg-[#0A0A0A] hover:bg-[#161616] hover:border-[#383838] text-white text-[11px] font-mono transition-all group shadow-xs cursor-pointer"
                                    title={`Open txAdmin web interface on port ${(server as any).txadminPort || 40120}`}
                                >
                                    <svg className="w-3.5 h-3.5 text-[#10B981] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    <span className="font-semibold text-white">txAdmin</span>
                                    {(server as any).txadminPort && (
                                        <span className="text-[10px] text-[#737373]">
                                            :{(server as any).txadminPort}
                                        </span>
                                    )}
                                </a>
                            )}

                            {/* WebSocket Status Indicator */}
                            <div className="hidden sm:flex items-center gap-1.5 pr-1 text-[10px] text-[#505050]" style={{ fontFamily: 'var(--font-mono)' }}>
                                <span className="w-1 h-1 rounded-full bg-[#10B981] animate-pulse" />
                                <span>ws binary</span>
                            </div>
                        </div>
                    </div>

                    {/* Auto-detected Spark Profiler Report Banner */}
                    {server.isMinecraft && tickStats.lastReportUrl && dismissedReportUrl !== tickStats.lastReportUrl && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#0A1F14] border border-[#065F46] text-xs font-mono shadow-md">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                                <span className="text-[#6EE7B7] font-sans font-semibold">Spark Report Ready:</span>
                                <span className="text-white truncate font-mono text-[11px]">{tickStats.lastReportUrl}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Link
                                    to={`/server/${server.id}/spark?url=${encodeURIComponent(tickStats.lastReportUrl)}`}
                                    className="px-2.5 py-1 rounded bg-[#10B981] hover:bg-[#059669] text-black font-semibold font-sans text-[11px] transition-colors cursor-pointer"
                                >
                                    Open in Panel →
                                </Link>
                                <a
                                    href={tickStats.lastReportUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 rounded bg-[#064E3B] hover:bg-[#065F46] text-[#A7F3D0] font-sans text-[11px] transition-colors"
                                >
                                    External ↗
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setDismissedReportUrl(tickStats.lastReportUrl)}
                                    className="text-[#6EE7B7] hover:text-white text-xs px-1.5 py-0.5 cursor-pointer"
                                    title="Dismiss notification"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Canvas */}
                    <div className="w-full">
                        {activeTab === 'stream' && <Console />}
                        {activeTab === 'telemetry' && <StatGraphs />}
                        {activeTab === 'inspector' && <ServiceInspector />}
                    </div>

                    {/* Mobile-only compact stats row */}
                    <div className="xl:hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <MobileStatCards playerStats={playerStats} tickStats={tickStats} />
                    </div>
                </div>
            </div>

            <Features enabled={eggFeatures} />
        </ServerContentBlock>
    );
};

export default memo(ServerConsoleContainer, isEqual);
