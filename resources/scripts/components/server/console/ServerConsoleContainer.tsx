import React, { memo, useState } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import Spinner from '@/components/elements/Spinner';
import Features from '@feature/Features';
import Console from '@/components/server/console/Console';
import StatGraphs from '@/components/server/console/StatGraphs';
import { ServiceInspector, LiveStatsSidebar } from '@/components/server/console/ServerDetailsBlock';
import { Alert } from '@/components/elements/alert';

export type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

const ServerConsoleContainer = () => {
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

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
                    <LiveStatsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
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
                        <div className="hidden sm:flex items-center gap-1.5 pr-1 text-[10px] text-[#505050]" style={{ fontFamily: 'var(--font-mono)' }}>
                            <span className="w-1 h-1 rounded-full bg-[#10B981] animate-pulse" />
                            <span>ws binary</span>
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
                    <div className="xl:hidden grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <MobileStatCards />
                    </div>
                </div>
            </div>

            <Features enabled={eggFeatures} />
        </ServerContentBlock>
    );
};

// ── Mobile fallback stat cards (imported inline) ──
import { MobileStatCards } from '@/components/server/console/ServerDetailsBlock';

export default memo(ServerConsoleContainer, isEqual);
