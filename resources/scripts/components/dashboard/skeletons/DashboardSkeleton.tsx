import React from 'react';
import { Skeleton } from '@/components/elements/Skeleton';

/**
 * 1:1 Structural Parity Skeleton for LunarDashboard.
 * Zero layout shift (CLS = 0). Matches typography, grid breaks, card padding, and button placement.
 */
export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="w-full font-sans select-none pb-12 animate-in fade-in duration-150" aria-label="Loading dashboard...">
            {/* Header: Editorial Page title */}
            <div className="mb-7 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#141414] pb-5">
                <div className="space-y-2 max-w-xl">
                    <Skeleton height={36} width={340} rounded="sm" />
                    <Skeleton height={14} width={420} rounded="sm" className="opacity-60" />
                </div>
                <div className="flex items-center gap-2.5">
                    <Skeleton height={32} width={135} rounded="md" className="opacity-80" />
                </div>
            </div>

            {/* 4 Telemetry Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
                {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                        key={`skel-metric-${idx}`}
                        className="p-4 sm:p-5 rounded-lg border border-[#141414] bg-[#000000] flex flex-col justify-between min-h-[110px]"
                    >
                        <Skeleton height={12} width="55%" rounded="sm" className="opacity-70" />
                        <Skeleton height={28} width="40%" rounded="sm" className="my-2" />
                        <Skeleton height={11} width="70%" rounded="sm" className="opacity-50" />
                    </div>
                ))}
            </div>

            {/* Main 2-Column Dashboard Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
                {/* LEFT: Server Fleet Grid (8 Cols) */}
                <div className="xl:col-span-8 space-y-6">
                    {/* Search & Filter Bar */}
                    <div className="p-3 rounded-lg border border-[#141414] bg-[#000000] flex items-center justify-between gap-4">
                        <Skeleton height={20} width={220} rounded="sm" className="opacity-60" />
                        <Skeleton height={24} width={90} rounded="md" className="opacity-80" />
                    </div>

                    {/* Server Cards List */}
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div
                                key={`skel-server-card-${idx}`}
                                className="rounded-lg border border-[#141414] bg-[#000000] p-5 sm:p-6 space-y-5"
                            >
                                {/* Card Header Row */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-3">
                                            <Skeleton height={20} width={180} rounded="sm" />
                                            <Skeleton height={18} width={65} rounded="full" className="opacity-80" />
                                        </div>
                                        <Skeleton height={12} width={240} rounded="sm" className="opacity-50" />
                                    </div>
                                    <Skeleton height={24} width={100} rounded="md" className="opacity-70 shrink-0" />
                                </div>

                                {/* Resource Usage Gauges (CPU, RAM, Disk) */}
                                <div className="grid grid-cols-3 gap-4 pt-1">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <Skeleton height={10} width={30} rounded="sm" className="opacity-60" />
                                            <Skeleton height={10} width={35} rounded="sm" className="opacity-60" />
                                        </div>
                                        <Skeleton height={6} width="100%" rounded="full" className="opacity-40" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <Skeleton height={10} width={35} rounded="sm" className="opacity-60" />
                                            <Skeleton height={10} width={45} rounded="sm" className="opacity-60" />
                                        </div>
                                        <Skeleton height={6} width="100%" rounded="full" className="opacity-40" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <Skeleton height={10} width={30} rounded="sm" className="opacity-60" />
                                            <Skeleton height={10} width={40} rounded="sm" className="opacity-60" />
                                        </div>
                                        <Skeleton height={6} width="100%" rounded="full" className="opacity-40" />
                                    </div>
                                </div>

                                {/* Footer Action Buttons */}
                                <div className="flex items-center justify-between pt-2 border-t border-[#141414]">
                                    <Skeleton height={12} width={110} rounded="sm" className="opacity-40" />
                                    <div className="flex items-center gap-2">
                                        <Skeleton height={28} width={70} rounded="md" className="opacity-70" />
                                        <Skeleton height={28} width={85} rounded="md" className="opacity-90" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Operations Hub Rail (4 Cols) */}
                <div className="xl:col-span-4 space-y-6">
                    {/* Rail Heading */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#141414]">
                        <Skeleton height={16} width={140} rounded="sm" />
                        <Skeleton height={12} width={50} rounded="full" className="opacity-60" />
                    </div>

                    {/* Maintenance / Notice Card */}
                    <div className="p-4 rounded-lg border border-[#141414] bg-[#000000] space-y-3">
                        <Skeleton height={14} width="60%" rounded="sm" />
                        <Skeleton height={11} width="90%" rounded="sm" className="opacity-60" />
                        <Skeleton height={11} width="75%" rounded="sm" className="opacity-60" />
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="space-y-2.5">
                        <Skeleton height={38} width="100%" rounded="md" className="opacity-80" />
                        <Skeleton height={38} width="100%" rounded="md" className="opacity-70" />
                        <Skeleton height={38} width="100%" rounded="md" className="opacity-60" />
                    </div>

                    {/* Cluster Health / Telemetry Widget */}
                    <div className="p-5 rounded-lg border border-[#141414] bg-[#000000] space-y-4">
                        <div className="flex justify-between items-center">
                            <Skeleton height={14} width={120} rounded="sm" />
                            <Skeleton height={14} width={50} rounded="full" className="opacity-70" />
                        </div>
                        <Skeleton height={80} width="100%" rounded="md" className="opacity-30" />
                        <div className="flex justify-between pt-2 border-t border-[#141414]">
                            <Skeleton height={10} width={80} rounded="sm" className="opacity-50" />
                            <Skeleton height={10} width={60} rounded="sm" className="opacity-50" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardSkeleton;
