import React from 'react';
import { Skeleton } from '@/components/elements/Skeleton';

/**
 * 1:1 Structural Parity Server View Skeleton.
 * Instantly paints server header, tab strip, telemetry gauges, and console terminal canvas.
 * Zero layout shift (CLS = 0) upon hydration.
 */
export const ServerViewSkeleton: React.FC = () => {
    return (
        <div className="w-full font-sans select-none pb-12 animate-in fade-in duration-150" aria-label="Loading server...">
            {/* Top Server Header */}
            <div className="mb-6 pb-6 border-b border-[#141414] space-y-4">
                {/* Breadcrumbs & Status Row */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <Skeleton height={14} width={90} rounded="sm" className="opacity-60" />
                        <span className="text-[#3f3f46] text-xs">/</span>
                        <Skeleton height={16} width={130} rounded="sm" />
                        <Skeleton height={18} width={60} rounded="full" className="opacity-80 ml-2" />
                    </div>

                    {/* Power Action Buttons (Start, Restart, Stop, Kill) */}
                    <div className="flex items-center gap-2">
                        <Skeleton height={32} width={65} rounded="md" className="opacity-80" />
                        <Skeleton height={32} width={75} rounded="md" className="opacity-80" />
                        <Skeleton height={32} width={65} rounded="md" className="opacity-80" />
                        <Skeleton height={32} width={55} rounded="md" className="opacity-80" />
                    </div>
                </div>

                {/* Server Quick Stats Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 rounded-lg border border-[#141414] bg-[#000000]">
                    <div>
                        <Skeleton height={10} width={50} rounded="sm" className="opacity-50 mb-2" />
                        <Skeleton height={18} width={100} rounded="sm" />
                    </div>
                    <div>
                        <Skeleton height={10} width={60} rounded="sm" className="opacity-50 mb-2" />
                        <Skeleton height={18} width={90} rounded="sm" />
                    </div>
                    <div>
                        <Skeleton height={10} width={55} rounded="sm" className="opacity-50 mb-2" />
                        <Skeleton height={18} width={110} rounded="sm" />
                    </div>
                    <div>
                        <Skeleton height={10} width={70} rounded="sm" className="opacity-50 mb-2" />
                        <Skeleton height={18} width={130} rounded="sm" />
                    </div>
                </div>
            </div>

            {/* Navigation Tab Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-[#141414]">
                {['Console', 'File Manager', 'Databases', 'Schedules', 'Users', 'Backups', 'Network', 'Startup', 'Settings'].map(
                    (tab, idx) => (
                        <Skeleton
                            key={`skel-tab-${idx}`}
                            height={32}
                            width={idx === 0 ? 80 : idx === 1 ? 110 : 85}
                            rounded="md"
                            className={idx === 0 ? 'opacity-90' : 'opacity-50'}
                        />
                    )
                )}
            </div>

            {/* Subview Skeleton: Console & Telemetry Canvas */}
            <div className="space-y-6">
                {/* 3 Telemetry Gauges (Memory, CPU, Disk) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <div
                            key={`skel-gauge-${idx}`}
                            className="p-4 sm:p-5 rounded-lg border border-[#141414] bg-[#000000] flex flex-col justify-between min-h-[100px] space-y-3"
                        >
                            <div className="flex justify-between items-center">
                                <Skeleton height={12} width={60} rounded="sm" className="opacity-60" />
                                <Skeleton height={12} width={40} rounded="sm" className="opacity-80" />
                            </div>
                            <Skeleton height={8} width="100%" rounded="full" className="opacity-30" />
                            <Skeleton height={10} width={90} rounded="sm" className="opacity-40" />
                        </div>
                    ))}
                </div>

                {/* Console Terminal Canvas Skeleton */}
                <div className="rounded-lg border border-[#1F1F1F] bg-[#000000] p-4 sm:p-5 space-y-3 min-h-[360px] flex flex-col justify-between">
                    <div className="space-y-2 font-mono">
                        <Skeleton height={14} width="35%" rounded="sm" className="opacity-50" />
                        <Skeleton height={14} width="55%" rounded="sm" className="opacity-40" />
                        <Skeleton height={14} width="45%" rounded="sm" className="opacity-40" />
                        <Skeleton height={14} width="70%" rounded="sm" className="opacity-30" />
                    </div>
                    {/* Command Input Bar */}
                    <div className="pt-3 border-t border-[#141414] flex items-center gap-3">
                        <Skeleton height={36} width="100%" rounded="md" className="opacity-60" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerViewSkeleton;
