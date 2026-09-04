import React, { useState, useEffect } from 'react';

export const AppSwitcher: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    return (
        <div
            id="app-switcher"
            className="theme-app-switcher text-xs h-9 leading-9 relative z-[100] select-none font-sans"
            style={{
                backgroundColor: '#000000',
                borderBottom: isOpen ? '1px solid #141414' : '1px solid #1f1f1f',
            }}
        >
            <div className="flex items-center justify-between px-4 sm:px-6 h-full">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                    aria-label="Switch Votion products"
                    className="flex items-center gap-2 text-[#a7aaaa] hover:text-[#ffffff] cursor-pointer font-medium transition-all duration-150 active:scale-95 bg-transparent border-none p-0 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                    style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                >
                    <span className="text-xs">Switch products...</span>
                    <svg
                        height="11"
                        viewBox="0 0 22 22"
                        width="11"
                        className={`fill-current transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    >
                        <path clipRule="evenodd" d="m10 16.1-9-8L3 6l8 7 8-7L21 8l-9 8c-.6.5-1.4.5-2 0Z" fillRule="evenodd" />
                    </svg>
                </button>
                <div className="font-medium text-xs text-[#a7aaaa] flex items-center gap-1.5">
                    <span className="font-bold text-[#ffffff]">Votion One™</span>
                    <span className="text-[#ededed]">Platform</span>
                </div>
            </div>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 top-9 bg-black/75 backdrop-blur-sm z-[98]"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="VOTION Product Suite"
                        className="theme-app-switcher-drawer bg-[#000000] border-b border-[#1f1f1f] p-6 pb-10 absolute top-9 left-0 right-0 z-[99] shadow-2xl animate-in slide-in-from-top-2 fade-in duration-200 ease-out origin-top max-h-[85vh] overflow-y-auto"
                        style={{ backgroundColor: '#000000', borderBottom: '1px solid #1f1f1f' }}
                    >
                        <div className="max-w-[1200px] mx-auto bg-[#000000]" style={{ backgroundColor: '#000000' }}>
                            <div className="app-switcher-heading text-base font-semibold mb-4 text-white">VOTION Product Suite</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 bg-[#000000]" style={{ backgroundColor: '#000000' }}>
                                <a
                                    href="#"
                                    role="link"
                                    aria-label="Lunar Panel (Current): Next-generation game server management and container orchestration platform."
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsOpen(false);
                                    }}
                                    className="app-product-card bg-[#0a0a0a] text-[#ededed] p-5 rounded-lg border border-[#202024] hover:border-[#38383e] hover:bg-[#121214] transition-all duration-150 flex flex-col gap-2.5 no-underline group shadow-sm outline-none focus:outline-none"
                                    style={{ backgroundColor: '#0a0a0a', borderColor: '#202024' }}
                                >
                                    <div className="flex items-center justify-between font-semibold text-sm text-[#ffffff]">
                                        <span>Lunar Panel</span>
                                        <span
                                            className="app-product-current-badge bg-[#1c1c1c] text-[#ededed] border border-[#36363b] text-[11px] px-2.5 py-0.5 rounded-full font-medium leading-[1.1]"
                                            style={{ backgroundColor: '#1c1c1c', borderColor: '#36363b', color: '#ededed' }}
                                        >
                                            Current
                                        </span>
                                    </div>
                                    <div className="card-description text-[#a1a1aa] text-xs leading-relaxed group-hover:text-[#d4d4d8] transition-colors">
                                        Next-generation game server management and container orchestration platform.
                                    </div>
                                </a>

                                <a
                                    href="#"
                                    role="link"
                                    aria-label="Legacy Game panel: Classic server management for legacy gaming infrastructure and older workloads."
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsOpen(false);
                                    }}
                                    className="app-product-card bg-[#0a0a0a] text-[#ededed] p-5 rounded-lg border border-[#202024] hover:border-[#38383e] hover:bg-[#121214] transition-all duration-150 flex flex-col gap-2.5 no-underline group shadow-sm outline-none focus:outline-none"
                                    style={{ backgroundColor: '#0a0a0a', borderColor: '#202024' }}
                                >
                                    <div className="flex items-center justify-between font-semibold text-sm text-[#ffffff]">
                                        <span>Legacy Game panel</span>
                                    </div>
                                    <div className="card-description text-[#a1a1aa] text-xs leading-relaxed group-hover:text-[#d4d4d8] transition-colors">
                                        Classic server management for legacy gaming infrastructure and older workloads.
                                    </div>
                                </a>

                                <a
                                    href="#"
                                    role="link"
                                    aria-label="Votion AI: Advanced machine learning workloads and generative AI infrastructure deployment."
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsOpen(false);
                                    }}
                                    className="app-product-card bg-[#0a0a0a] text-[#ededed] p-5 rounded-lg border border-[#202024] hover:border-[#38383e] hover:bg-[#121214] transition-all duration-150 flex flex-col gap-2.5 no-underline group shadow-sm outline-none focus:outline-none"
                                    style={{ backgroundColor: '#0a0a0a', borderColor: '#202024' }}
                                >
                                    <div className="flex items-center justify-between font-semibold text-sm text-[#ffffff]">
                                        <span>Votion AI</span>
                                    </div>
                                    <div className="card-description text-[#a1a1aa] text-xs leading-relaxed group-hover:text-[#d4d4d8] transition-colors">
                                        Advanced machine learning workloads and generative AI infrastructure deployment.
                                    </div>
                                </a>

                                <a
                                    href="#"
                                    role="link"
                                    aria-label="Lunar Shield: Enterprise DDoS protection, Web Application Firewall, and threat mitigation."
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsOpen(false);
                                    }}
                                    className="app-product-card bg-[#0a0a0a] text-[#ededed] p-5 rounded-lg border border-[#202024] hover:border-[#38383e] hover:bg-[#121214] transition-all duration-150 flex flex-col gap-2.5 no-underline group shadow-sm outline-none focus:outline-none"
                                    style={{ backgroundColor: '#0a0a0a', borderColor: '#202024' }}
                                >
                                    <div className="flex items-center justify-between font-semibold text-sm text-[#ffffff]">
                                        <span>Lunar Shield</span>
                                    </div>
                                    <div className="card-description text-[#a1a1aa] text-xs leading-relaxed group-hover:text-[#d4d4d8] transition-colors">
                                        Enterprise DDoS protection, Web Application Firewall, and threat mitigation.
                                    </div>
                                </a>

                                <a
                                    href="#"
                                    role="link"
                                    aria-label="Votion Mail Suite: Enterprise-grade email hosting, spam filtering, and secure delivery network."
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsOpen(false);
                                    }}
                                    className="app-product-card bg-[#0a0a0a] text-[#ededed] p-5 rounded-lg border border-[#202024] hover:border-[#38383e] hover:bg-[#121214] transition-all duration-150 flex flex-col gap-2.5 no-underline group shadow-sm outline-none focus:outline-none"
                                    style={{ backgroundColor: '#0a0a0a', borderColor: '#202024' }}
                                >
                                    <div className="flex items-center justify-between font-semibold text-sm text-[#ffffff]">
                                        <span>Votion Mail Suite</span>
                                    </div>
                                    <div className="card-description text-[#a1a1aa] text-xs leading-relaxed group-hover:text-[#d4d4d8] transition-colors">
                                        Enterprise-grade email hosting, spam filtering, and secure delivery network.
                                    </div>
                                </a>

                                <a
                                    href="#"
                                    role="link"
                                    aria-label="Votion Drive: Secure cloud storage, S3-compatible object storage, and global file sharing."
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsOpen(false);
                                    }}
                                    className="app-product-card bg-[#0a0a0a] text-[#ededed] p-5 rounded-lg border border-[#202024] hover:border-[#38383e] hover:bg-[#121214] transition-all duration-150 flex flex-col gap-2.5 no-underline group shadow-sm outline-none focus:outline-none"
                                    style={{ backgroundColor: '#0a0a0a', borderColor: '#202024' }}
                                >
                                    <div className="flex items-center justify-between font-semibold text-sm text-[#ffffff]">
                                        <span>Votion Drive</span>
                                    </div>
                                    <div className="card-description text-[#a1a1aa] text-xs leading-relaxed group-hover:text-[#d4d4d8] transition-colors">
                                        Secure cloud storage, S3-compatible object storage, and global file sharing.
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AppSwitcher;
