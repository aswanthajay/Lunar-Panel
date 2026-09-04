import React, { useState, useEffect } from 'react';
import StellarSidebar from '@/components/dashboard/StellarSidebar';
import StellarTopBar from '@/components/dashboard/StellarTopBar';
import { AppSwitcher } from '@/components/votion/AppSwitcher';
import { CommandPalette } from '@/components/votion/CommandPalette';
import '@/components/dashboard/product-panels/ProductPanels.css';

interface Props {
    children: React.ReactNode;
    serverCount?: number;
}

export default ({ children }: Props) => {
    const [isCmdOpen, setIsCmdOpen] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) {
                e.preventDefault();
                setIsCmdOpen((prev) => !prev);
            }
            if (e.key === 'Escape') {
                setIsMobileNavOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="app-container h-screen w-screen flex flex-col overflow-hidden font-sans bg-[#000000] text-[#F3F4F6] select-none">
            {/* 1. Top Fixed Navigation Header Region (AppSwitcher + StellarTopBar) */}
            <div className="shrink-0 z-40 flex flex-col">
                <AppSwitcher />
                <StellarTopBar
                    onOpenCmd={() => setIsCmdOpen(true)}
                    isMobileNavOpen={isMobileNavOpen}
                    onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
                />
            </div>

            {/* 2. Main Body Shell (Sidebar stays pinned left; only main content scrolls) */}
            <div className="app-body flex flex-1 min-h-0 w-full overflow-hidden relative">
                {/* Mobile Drawer Backdrop (invisible on desktop) */}
                {isMobileNavOpen && (
                    <div
                        className="fixed inset-0 bg-black/75 z-40 md:hidden backdrop-blur-sm transition-opacity"
                        onClick={() => setIsMobileNavOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* Sidenav (pinned left on desktop, off-canvas drawer on mobile) */}
                <StellarSidebar
                    onOpenCmd={() => setIsCmdOpen(true)}
                    isMobileOpen={isMobileNavOpen}
                    onCloseMobile={() => setIsMobileNavOpen(false)}
                />

                {/* Primary Content Container: ONLY this scrolls */}
                <main
                    id="main-content"
                    className="app-content flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8"
                    role="main"
                >
                    {children}
                </main>
            </div>

            {/* 3. Global Command Palette Modal */}
            <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />
        </div>
    );
};
