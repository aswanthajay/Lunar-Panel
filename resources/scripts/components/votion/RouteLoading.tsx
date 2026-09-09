import React from 'react';
import { PulseLoader } from '@/components/elements/Spinner';

/**
 * RouteLoading: Matches modern luxury dark theme
 * Clean, high-contrast non-circular pulse loader with 'LOADING VIEW'
 */
export const RouteLoading: React.FC<{ message?: string }> = ({ message = 'Loading View' }) => (
    <div className="app-content flex items-center justify-center min-h-[50vh] w-full py-16 select-none" aria-busy="true">
        <div className="flex flex-col items-center gap-4">
            <PulseLoader size="large" />
            <div className="text-xs font-bold uppercase tracking-widest text-[#656b6b] dark:text-[#a0a0a0] font-mono" role="status">
                {message}
            </div>
        </div>
    </div>
);

/**
 * VotionCloudPreloader
 * Proprietary Votion Preloader for Overview & Dashboard environments
 */
export const VotionCloudPreloader: React.FC<{ title?: string; subtitle?: string }> = ({
    title = 'Votion Cloud',
    subtitle = 'Preparing your environment…',
}) => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 select-none text-center min-h-[50vh] w-full" aria-busy="true">
        <div className="mb-4">
            <PulseLoader size="large" />
        </div>
        <h2 className="text-base font-semibold text-[#1a1a1a] dark:text-white tracking-tight m-0 font-sans">
            {title}
        </h2>
        <p className="text-xs text-[#656b6b] dark:text-[#a0a0a0] mt-1 m-0 font-mono">
            {subtitle}
        </p>
    </div>
);

/**
 * OverlayLoading
 * Backdrop overlay loader with frosted glass effect
 */
export const OverlayLoading: React.FC<{ message?: string }> = ({ message = 'Loading View' }) => (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-white/40 dark:bg-black/60 backdrop-blur-sm select-none" aria-busy="true">
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-white dark:bg-[#0e0e10] border border-[#dedfdf] dark:border-[#262626] shadow-xl">
            <PulseLoader size="large" />
            <div className="text-xs font-bold uppercase tracking-widest text-[#656b6b] dark:text-[#a0a0a0] font-mono" role="status">
                {message}
            </div>
        </div>
    </div>
);

export default RouteLoading;
