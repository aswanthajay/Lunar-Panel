import React from 'react';

/**
 * RouteLoading: Matches votion-frontend/src/App.tsx line 500
 * Clean, high-contrast spinning ring with 'LOADING VIEW'
 */
export const RouteLoading: React.FC<{ message?: string }> = ({ message = 'Loading View' }) => (
    <div className="app-content flex items-center justify-center min-h-[50vh] w-full py-16 select-none" aria-busy="true">
        <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#dedfdf] dark:border-[#262626] border-t-[#1a1a1a] dark:border-t-white" />
            <div className="text-xs font-bold uppercase tracking-widest text-[#656b6b] dark:text-[#a0a0a0] font-mono" role="status">
                {message}
            </div>
        </div>
    </div>
);

/**
 * VotionCloudPreloader: Matches votion-frontend/src/src/components/OverviewDashboard.tsx line 615
 * Proprietary Votion Preloader for Overview & Dashboard environments
 */
export const VotionCloudPreloader: React.FC<{ title?: string; subtitle?: string }> = ({
    title = 'Votion Cloud',
    subtitle = 'Preparing your environment…',
}) => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 select-none text-center min-h-[50vh] w-full" aria-busy="true">
        <div className="w-8 h-8 rounded-full border-2 border-[#dedfdf] dark:border-[#313131] border-t-[#1a1a1a] dark:border-t-white animate-spin mb-4" />
        <h2 className="text-base font-semibold text-[#1a1a1a] dark:text-white tracking-tight m-0 font-sans">
            {title}
        </h2>
        <p className="text-xs text-[#656b6b] dark:text-[#a0a0a0] mt-1 m-0 font-mono">
            {subtitle}
        </p>
    </div>
);

/**
 * OverlayLoading: Matches votion-frontend/src/App.tsx line 510
 * Backdrop overlay loader with frosted glass effect
 */
export const OverlayLoading: React.FC<{ message?: string }> = ({ message = 'Loading View' }) => (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-white/40 dark:bg-black/60 backdrop-blur-sm select-none" aria-busy="true">
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-white dark:bg-[#0e0e10] border border-[#dedfdf] dark:border-[#262626] shadow-xl">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#dedfdf] dark:border-[#262626] border-t-[#1a1a1a] dark:border-t-white" />
            <div className="text-xs font-bold uppercase tracking-widest text-[#656b6b] dark:text-[#a0a0a0] font-mono" role="status">
                {message}
            </div>
        </div>
    </div>
);

export default RouteLoading;
