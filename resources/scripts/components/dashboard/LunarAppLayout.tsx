import React, { useState, useEffect } from 'react';
import LunarSidebar from '@/components/dashboard/LunarSidebar';
import LunarTopBar from '@/components/dashboard/LunarTopBar';
import { CommandPalette } from '@/components/votion/CommandPalette';
import VotionRelayWidget from '@/components/votion/VotionRelayWidget';

interface Props {
    children: React.ReactNode;
    serverCount?: number;
}

export default ({ children }: Props) => {
    const [isCmdOpen, setIsCmdOpen] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [selectedServerScope, setSelectedServerScope] = useState<string | null>(null);

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
        <div className="app-container h-screen w-full max-w-full flex flex-col overflow-hidden font-sans bg-[#000000] text-[#ededed] select-none transition-colors duration-150">
            {/* 1. Top Navigation Region (Votion Cloud Floating Capsule Navbar) */}
            <div className="shrink-0 z-40 flex flex-col">
                <LunarTopBar
                    onOpenCmd={() => setIsCmdOpen(true)}
                    isMobileNavOpen={isMobileNavOpen}
                    onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
                    onSelectServerScope={(id) => setSelectedServerScope(id)}
                />
            </div>

            {/* 2. Main Body Shell (Pinned Sidebar + Scrollable Content) */}
            <div className="app-body flex flex-1 min-h-0 w-full overflow-hidden relative">
                {/* Mobile Drawer Backdrop */}
                {isMobileNavOpen && (
                    <div
                        className="fixed inset-0 bg-black/80 z-[200] md:hidden backdrop-blur-md transition-opacity"
                        onClick={() => setIsMobileNavOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* Sidenav */}
                <LunarSidebar
                    onOpenCmd={() => setIsCmdOpen(true)}
                    isMobileOpen={isMobileNavOpen}
                    onCloseMobile={() => setIsMobileNavOpen(false)}
                />

                {/* Primary Content Container: ONLY this scrolls */}
                <main
                    id="main-content"
                    className="app-content hide-scrollbar flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-[#000000] relative"
                    role="main"
                >
                    {children}
                </main>
            </div>

            {/* 3. Global Floating "Chat with Relay" Capsule Widget */}
            <VotionRelayWidget />

            {/* 4. Global Command Palette Modal */}
            <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />
        </div>
    );
};
