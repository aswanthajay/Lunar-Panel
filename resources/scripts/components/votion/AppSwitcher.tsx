import React, { useState, useEffect, useRef } from 'react';

export const AppSwitcher: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        const handleClickOutside = (e: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div id="app-switcher" ref={drawerRef} className="theme-app-switcher bg-[#1a1a1a] text-white text-xs h-9 leading-9 relative z-[100] select-none font-sans">
            <div className="flex items-center justify-between px-[18px] h-full">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 text-[#a7aaaa] cursor-pointer font-medium hover:text-white transition-colors"
                >
                    <span>Switch products...</span>
                    <svg
                        aria-label="open dropdown"
                        height="12"
                        viewBox="0 0 22 22"
                        width="12"
                        className={`fill-current transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    >
                        <path clipRule="evenodd" d="m10 16.1-9-8L3 6l8 7 8-7L21 8l-9 8c-.6.5-1.4.5-2 0Z" fillRule="evenodd" />
                    </svg>
                </div>
                <div className="font-medium text-[#a7aaaa]">
                    <span className="font-bold text-[#fff]">Votion One™</span> Platform
                </div>
            </div>

            {isOpen && (
                <div className="theme-app-switcher-drawer bg-[#1a1a1a] border-b border-[#656b6b] p-6 pb-10 absolute top-9 left-0 right-0 z-[99] shadow-2xl animate-in slide-in-from-top-2 fade-in duration-200 ease-out origin-top">
                    <div className="max-w-[1200px] mx-auto">
                        <div className="app-switcher-heading text-base font-semibold mb-3 text-white">VOTION Product Suite</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                            <a
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setIsOpen(false);
                                }}
                                className="app-product-card bg-white text-[#1a1a1a] p-5 rounded-lg border border-[#dedfdf] hover:border-[#656b6b] transition-all flex flex-col gap-2 no-underline"
                            >
                                <div className="flex items-center justify-between font-semibold text-sm">
                                    <span>Lunar Panel</span>
                                    <span className="app-product-current-badge bg-[#1a1a1a] text-white dark:bg-[#1c1c1c] dark:text-[#ededed] dark:border dark:border-[#52525b] text-[11px] px-2.5 py-0.5 rounded-full font-medium inline-flex items-center">
                                        Current
                                    </span>
                                </div>
                                <div className="text-[#656b6b] text-xs leading-relaxed">
                                    Next-generation game server management and container orchestration platform.
                                </div>
                            </a>

                            <a
                                href="#"
                                onClick={(e) => e.preventDefault()}
                                className="app-product-card bg-white text-[#1a1a1a] p-5 rounded-lg border border-[#dedfdf] hover:border-[#656b6b] transition-all flex flex-col gap-2 no-underline"
                            >
                                <div className="flex items-center justify-between font-semibold text-sm">
                                    <span>Legacy Game panel</span>
                                </div>
                                <div className="text-[#656b6b] text-xs leading-relaxed">
                                    Classic server management for legacy gaming infrastructure and older workloads.
                                </div>
                            </a>

                            <a
                                href="#"
                                onClick={(e) => e.preventDefault()}
                                className="app-product-card bg-white text-[#1a1a1a] p-5 rounded-lg border border-[#dedfdf] hover:border-[#656b6b] transition-all flex flex-col gap-2 no-underline"
                            >
                                <div className="flex items-center justify-between font-semibold text-sm">
                                    <span>Votion AI</span>
                                </div>
                                <div className="text-[#656b6b] text-xs leading-relaxed">
                                    Advanced machine learning workloads and generative AI infrastructure deployment.
                                </div>
                            </a>

                            <a
                                href="#"
                                onClick={(e) => e.preventDefault()}
                                className="app-product-card bg-white text-[#1a1a1a] p-5 rounded-lg border border-[#dedfdf] hover:border-[#656b6b] transition-all flex flex-col gap-2 no-underline"
                            >
                                <div className="flex items-center justify-between font-semibold text-sm">
                                    <span>Lunar Shield</span>
                                </div>
                                <div className="text-[#656b6b] text-xs leading-relaxed">
                                    Enterprise DDoS protection, Web Application Firewall, and threat mitigation.
                                </div>
                            </a>

                            <a
                                href="#"
                                onClick={(e) => e.preventDefault()}
                                className="app-product-card bg-white text-[#1a1a1a] p-5 rounded-lg border border-[#dedfdf] hover:border-[#656b6b] transition-all flex flex-col gap-2 no-underline"
                            >
                                <div className="flex items-center justify-between font-semibold text-sm">
                                    <span>Votion Mail Suite</span>
                                </div>
                                <div className="text-[#656b6b] text-xs leading-relaxed">
                                    Enterprise-grade email hosting, spam filtering, and secure delivery network.
                                </div>
                            </a>

                            <a
                                href="#"
                                onClick={(e) => e.preventDefault()}
                                className="app-product-card bg-white text-[#1a1a1a] p-5 rounded-lg border border-[#dedfdf] hover:border-[#656b6b] transition-all flex flex-col gap-2 no-underline"
                            >
                                <div className="flex items-center justify-between font-semibold text-sm">
                                    <span>Votion Drive</span>
                                </div>
                                <div className="text-[#656b6b] text-xs leading-relaxed">
                                    Secure cloud storage, S3-compatible object storage, and global file sharing.
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
