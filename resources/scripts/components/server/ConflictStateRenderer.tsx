import React from 'react';
import { ServerContext } from '@/state/server';
import { useHistory } from 'react-router-dom';

export default () => {
    const history = useHistory();
    const server = ServerContext.useStoreState((state) => state.server.data);
    const status = server?.status || null;
    const isTransferring = server?.isTransferring || false;
    const isNodeUnderMaintenance = server?.isNodeUnderMaintenance || false;

    const isInstalling = status === 'installing' || status === 'install_failed' || status === 'reinstall_failed';
    const isSuspended = status === 'suspended';

    return (
        <div className="w-full min-h-[85vh] flex items-center justify-center px-4 select-none font-sans bg-[#000000]">
            <div className="w-full max-w-xl bg-[#000000] border border-[#1F1F1F] rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
                {/* Ambient Top Glow Line */}
                <div
                    className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-[2px] bg-gradient-to-r from-transparent ${
                        isInstalling
                            ? 'via-[#10B981]'
                            : isSuspended
                            ? 'via-[#EF4444]'
                            : isNodeUnderMaintenance
                            ? 'via-[#F59E0B]'
                            : 'via-[#06B6D4]'
                    } to-transparent`}
                />

                {/* Status Beacon Capsule */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0A0A] border border-[#1F1F1F] text-[10px] font-mono uppercase tracking-wider mb-6">
                    <span
                        className={`w-2 h-2 rounded-full ${
                            isInstalling
                                ? 'bg-[#10B981] animate-pulse'
                                : isSuspended
                                ? 'bg-[#EF4444]'
                                : isNodeUnderMaintenance
                                ? 'bg-[#F59E0B]'
                                : 'bg-[#06B6D4] animate-pulse'
                        }`}
                    />
                    <span
                        className={
                            isInstalling
                                ? 'text-[#10B981]'
                                : isSuspended
                                ? 'text-[#EF4444]'
                                : isNodeUnderMaintenance
                                ? 'text-[#F59E0B]'
                                : 'text-[#06B6D4]'
                        }
                    >
                        {isInstalling
                            ? 'Deployment Engine Active'
                            : isSuspended
                            ? 'Instance Suspended'
                            : isNodeUnderMaintenance
                            ? 'Node Maintenance Active'
                            : isTransferring
                            ? 'Node Migration In Progress'
                            : 'Snapshot Restoration'}
                    </span>
                </div>

                {/* Editorial Title */}
                <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#FFFFFF] tracking-tight m-0">
                    {isInstalling
                        ? 'Running Installer'
                        : isSuspended
                        ? 'Server Suspended'
                        : isNodeUnderMaintenance
                        ? 'Node under Maintenance'
                        : isTransferring
                        ? 'Transferring Instance'
                        : 'Restoring from Backup'}
                </h1>

                {/* Subtitle */}
                <p className="text-xs text-[#8A8A8A] font-sans mt-2.5 max-w-md mx-auto leading-relaxed m-0">
                    {isInstalling
                        ? 'Your container environment is currently being provisioned, initialized, and verified. It will become operational in a few minutes.'
                        : isSuspended
                        ? 'This server instance is temporarily suspended and cannot be accessed. Please review your account or contact support.'
                        : isNodeUnderMaintenance
                        ? 'The physical host node running this container is undergoing scheduled maintenance. Services will resume automatically.'
                        : isTransferring
                        ? 'Your server data is being transferred to a new target node across the cluster network. Please check back later.'
                        : 'Your server filesystem is currently being restored from a snapshot archive. Please check back in a few minutes.'}
                </p>

                {/* Telemetry Log Terminal (for installing / transferring / restoring) */}
                {(isInstalling || isTransferring || (!isSuspended && !isNodeUnderMaintenance)) && (
                    <div className="mt-8 bg-[#050505] border border-[#141414] rounded-lg p-4 text-left font-mono text-[11px] text-[#737373] space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-[#525252] border-b border-[#141414] pb-2 mb-2">
                            <span>SYSTEM_DISPATCH // {server?.node || 'LOCAL_NODE'}</span>
                            <span className="text-[#10B981] font-semibold">SYNCED</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#A0A0A0]">
                            <span className="text-[#10B981]">✔</span> Container volume mounts linked
                        </div>
                        <div className="flex items-center gap-2 text-[#A0A0A0]">
                            <span className="text-[#10B981]">✔</span> Network port bindings registered
                        </div>
                        <div className="flex items-center gap-2 text-[#FFFFFF] animate-pulse">
                            <span className="text-[#F59E0B]">▶</span>
                            <span>
                                {isInstalling
                                    ? 'Executing installer bootstrap in isolated container...'
                                    : isTransferring
                                    ? 'Streaming volume blocks to destination node...'
                                    : 'Unpacking archive snapshot layers...'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Micro Progress Bar */}
                {isInstalling && (
                    <div className="mt-6 w-full bg-[#141414] h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#10B981] to-[#06B6D4] w-2/3 animate-pulse rounded-full" />
                    </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] font-semibold text-xs transition-colors cursor-pointer border-none shadow-sm flex items-center gap-1.5"
                    >
                        <span>↻</span>
                        <span>Check Status</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => history.push('/')}
                        className="px-4 py-2 rounded-md bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838] text-xs font-mono transition-colors cursor-pointer"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

