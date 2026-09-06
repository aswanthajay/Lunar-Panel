import React, { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import Spinner from '@/components/elements/Spinner';
import Features from '@feature/Features';
import Console from '@/components/server/console/Console';
import StatGraphs from '@/components/server/console/StatGraphs';
import { ServiceInspector, LiveStatsSidebar, MobileStatCards } from '@/components/server/console/ServerDetailsBlock';
import { Alert } from '@/components/elements/alert';
import useServerPlayers from '@/plugins/useServerPlayers';

export type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

const ServerConsoleContainer = () => {
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = server.isTransferring;
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = server.isNodeUnderMaintenance;

    const playerStats = useServerPlayers();
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
                    <LiveStatsSidebar activeTab={activeTab} onTabChange={setActiveTab} playerStats={playerStats} />
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
                            {/* Live Player Slots Badge */}
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded border border-[#1F1F1F] bg-[#050505] text-xs font-mono">
                                <svg className="w-3.5 h-3.5 text-[#10B981] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-sans font-semibold">Players</span>
                                <span className="text-white font-medium tabular-nums text-[11px]">
                                    {playerStats.online} <span className="text-[#525252]">/</span> {playerStats.max !== null ? playerStats.max : '—'}
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

                    {/* Canvas */}
                    <div className="w-full">
                        {activeTab === 'stream' && (
                            <Spinner.Suspense>
                                <Console />
                            </Spinner.Suspense>
                        )}
                        {activeTab === 'telemetry' && (
                            <Spinner.Suspense>
                                <StatGraphs />
                            </Spinner.Suspense>
                        )}
                        {activeTab === 'inspector' && (
                            <Spinner.Suspense>
                                <ServiceInspector />
                            </Spinner.Suspense>
                        )}
                    </div>

                    {/* Mobile-only compact stats row */}
                    <div className="xl:hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <MobileStatCards playerStats={playerStats} />
                    </div>
                </div>
            </div>

            <Features enabled={eggFeatures} />
        </ServerContentBlock>
    );
};

export default memo(ServerConsoleContainer, isEqual);
