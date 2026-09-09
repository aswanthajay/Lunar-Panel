import React from 'react';
import { Skeleton } from '@/components/elements/Skeleton';

/**
 * 1:1 Structural Parity Skeleton for Refactored LunarDashboard.
 * Zero layout shift (CLS = 0). Matches typography, asymmetric telemetry, and tiered instance hierarchy.
 */
export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="relative w-full font-sans select-none pb-12 animate-in fade-in duration-150" aria-label="Loading dashboard...">
            {/* Header: Editorial Page title */}
            <div className="mb-7 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.06] pb-5">
                <div className="space-y-2 max-w-xl">
                    <Skeleton height={32} width={340} rounded="sm" />
                    <Skeleton height={14} width={420} rounded="sm" className="opacity-60" />
                </div>
                <div className="flex items-center gap-2.5">
                    <Skeleton height={32} width={135} rounded="md" className="opacity-80" />
                </div>
            </div>

            {/* Asymmetric Telemetry Command Hub Skeleton */}
            <div className="rounded-xl border border-white/[0.06] bg-[#070709] overflow-hidden mb-6 shadow-xl">
                <div className="bg-[#0A0A0D] border-b border-white/[0.04] px-5 py-3 flex items-center justify-between">
                    <Skeleton height={12} width={200} rounded="sm" className="opacity-60" />
                    <Skeleton height={12} width={80} rounded="sm" className="opacity-40" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.04]">
                    <div className="lg:col-span-5 p-5 space-y-4">
                        <Skeleton height={12} width="40%" rounded="sm" className="opacity-60" />
                        <Skeleton height={36} width="60%" rounded="sm" className="opacity-90" />
                        <Skeleton height={8} width="100%" rounded="full" className="opacity-40" />
                    </div>
                    <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.04]">
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={`skel-telemetry-${idx}`} className="p-5 space-y-3">
                                <Skeleton height={10} width="60%" rounded="sm" className="opacity-50" />
                                <Skeleton height={26} width="45%" rounded="sm" className="opacity-80" />
                                <Skeleton height={6} width="100%" rounded="full" className="opacity-30" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* LEFT: Instances (Showcase / Matrix) */}
                <div className="flex-1 min-w-0 w-full space-y-4">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-1">
                        <Skeleton height={16} width={180} rounded="sm" className="opacity-60" />
                        <div className="flex items-center gap-3">
                            <Skeleton height={28} width={160} rounded="md" className="opacity-50" />
                            <Skeleton height={28} width={180} rounded="md" className="opacity-50" />
                        </div>
                    </div>

                    {/* Primary Focal Instance Card Skeleton */}
                    <div className="rounded-xl border border-white/[0.08] bg-[#08080A] p-5 sm:p-6 space-y-5 shadow-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                                <Skeleton height={10} width={140} rounded="sm" className="opacity-50" />
                                <Skeleton height={22} width={220} rounded="sm" className="opacity-90" />
                                <Skeleton height={12} width={180} rounded="sm" className="opacity-40" />
                            </div>
                            <Skeleton height={24} width={75} rounded="sm" className="opacity-70" />
                        </div>
                        <Skeleton height={28} width={160} rounded="md" className="opacity-60" />
                        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/[0.04]">
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <div key={`skel-gauge-${idx}`} className="space-y-2">
                                    <Skeleton height={10} width={40} rounded="sm" className="opacity-50" />
                                    <Skeleton height={18} width={60} rounded="sm" className="opacity-80" />
                                    <Skeleton height={4} width="100%" rounded="full" className="opacity-30" />
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                            <Skeleton height={12} width={100} rounded="sm" className="opacity-40" />
                            <div className="flex items-center gap-2">
                                <Skeleton height={30} width={70} rounded="md" className="opacity-60" />
                                <Skeleton height={30} width={85} rounded="md" className="opacity-90" />
                            </div>
                        </div>
                    </div>

                    {/* Secondary Row Skeletons */}
                    <div className="space-y-2 pt-2">
                        {Array.from({ length: 2 }).map((_, idx) => (
                            <div key={`skel-sec-${idx}`} className="px-4 py-3 rounded-lg border border-white/[0.04] bg-[#070709] flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <Skeleton height={20} width={60} rounded="sm" className="opacity-60" />
                                    <div className="space-y-1">
                                        <Skeleton height={14} width={140} rounded="sm" className="opacity-80" />
                                        <Skeleton height={10} width={80} rounded="sm" className="opacity-40" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Skeleton height={24} width={65} rounded="md" className="opacity-50" />
                                    <Skeleton height={24} width={75} rounded="md" className="opacity-70" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Operations Rail Skeleton */}
                <aside className="w-full lg:w-[320px] max-w-full lg:max-w-[340px] bg-[#070709] border border-white/[0.06] rounded-xl overflow-hidden shrink-0 space-y-4 shadow-xl">
                    <div className="bg-[#0A0A0D] border-b border-white/[0.04] px-4 py-3 flex items-center justify-between">
                        <Skeleton height={12} width={140} rounded="sm" className="opacity-60" />
                        <Skeleton height={8} width={8} rounded="full" className="opacity-50" />
                    </div>
                    <div className="px-4 py-2 space-y-3">
                        <Skeleton height={12} width="50%" rounded="sm" className="opacity-50" />
                        <Skeleton height={40} width="100%" rounded="md" className="opacity-30" />
                        <Skeleton height={40} width="100%" rounded="md" className="opacity-30" />
                    </div>
                    <div className="px-4 py-2 border-t border-white/[0.04] space-y-3">
                        <Skeleton height={12} width="50%" rounded="sm" className="opacity-50" />
                        <div className="grid grid-cols-2 gap-2">
                            {Array.from({ length: 4 }).map((_, idx) => (
                                <Skeleton key={`skel-rail-${idx}`} height={45} rounded="md" className="opacity-30" />
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default DashboardSkeleton;
