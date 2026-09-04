import React, { useState, useMemo, useCallback } from 'react';

export interface NavItem {
    id: string;
    label: string;
    path: string;
    icon?: React.ReactNode;
    badge?: string;
    children?: Array<Omit<NavItem, 'icon' | 'children'>>;
}

export interface NavGroup {
    id: string;
    sectionTitle?: string;
    items: NavItem[];
}

export interface UserSessionData {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
}

export interface OrganizationContext {
    id: string;
    name: string;
    planLabel?: string;
}

export interface ProductPanelsNavigationProps {
    currentUser: UserSessionData;
    currentOrganization: OrganizationContext;
    navGroups: NavGroup[];
    activePath: string;
    isProductDrawerOpen?: boolean;
    onToggleProductDrawer?: () => void;
    onNavigate: (path: string) => void;
    onLogout?: () => void;
    onSearchTrigger?: () => void;
    brandLogo?: React.ReactNode;
    headerActions?: React.ReactNode;
}

export const ProductPanelsNavigation: React.FC<ProductPanelsNavigationProps> = ({
    currentUser,
    currentOrganization,
    navGroups,
    activePath,
    isProductDrawerOpen = false,
    onToggleProductDrawer,
    onNavigate,
    onLogout,
    onSearchTrigger,
    brandLogo,
    headerActions,
}) => {
    const [isOrgMenuOpen, setIsOrgMenuOpen] = useState<boolean>(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
    const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState<string>('');

    const toggleAccordion = useCallback((itemId: string) => {
        setOpenAccordions((prev) => ({
            ...prev,
            [itemId]: !prev[itemId],
        }));
    }, []);

    const isRouteActive = useCallback((itemPath: string): boolean => {
        if (!itemPath || !activePath) return false;
        if (itemPath === '/' && activePath === '/') return true;
        if (itemPath !== '/' && activePath.startsWith(itemPath)) return true;
        return false;
    }, [activePath]);

    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return navGroups;
        const query = searchQuery.toLowerCase();
        return navGroups.map((group) => ({
            ...group,
            items: group.items.filter(
                (item) =>
                    item.label.toLowerCase().includes(query) ||
                    item.children?.some((child) => child.label.toLowerCase().includes(query))
            ),
        })).filter((group) => group.items.length > 0);
    }, [navGroups, searchQuery]);

    return (
        <div className="w-full select-none bg-[#000000] text-[#FFFFFF] font-sans">
            {/* 1. Top Trigger Bar (36px, Pure Black #000000) */}
            <div className="h-9 w-full bg-[#000000] border-b border-[#1C1C20] flex items-center justify-between px-4 z-50">
                <button
                    type="button"
                    onClick={onToggleProductDrawer}
                    aria-expanded={isProductDrawerOpen}
                    className="inline-flex items-center space-x-2 text-xs font-medium text-[#9A9AA2] hover:text-[#FFFFFF] bg-transparent border-none p-1 cursor-pointer transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                    style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                >
                    <span>Switch products...</span>
                    <svg
                        className={`w-3 h-3 text-[#5E5E67] transition-transform duration-200 ${isProductDrawerOpen ? 'rotate-180' : ''}`}
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path d="M4.293 5.293a1 1 0 011.414 0L8 7.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                    </svg>
                </button>

                {currentOrganization.planLabel && (
                    <span className="text-[11px] font-semibold text-[#5E5E67] uppercase tracking-wider">
                        {currentOrganization.planLabel}
                    </span>
                )}
            </div>

            {/* 2. Main App Header (56px, Pure Black #000000, Border-b #1C1C20) */}
            <header className="h-14 w-full bg-[#000000] border-b border-[#1C1C20] flex items-center justify-between px-4 sticky top-0 z-40">
                <div className="flex items-center space-x-3">
                    {brandLogo && (
                        <div className="flex items-center cursor-pointer" onClick={() => onNavigate('/')}>
                            {brandLogo}
                        </div>
                    )}

                    <div className="relative border-l border-[#1C1C20] pl-3">
                        <button
                            type="button"
                            onClick={() => setIsOrgMenuOpen((prev) => !prev)}
                            aria-haspopup="true"
                            aria-expanded={isOrgMenuOpen}
                            className="inline-flex items-center space-x-2 text-sm font-semibold text-[#FFFFFF] hover:bg-[#0E0E11] px-2.5 py-1.5 rounded bg-transparent border border-transparent hover:border-[#2B2B32] transition-colors cursor-pointer"
                        >
                            <span>{currentOrganization.name}</span>
                            <svg className="w-3.5 h-3.5 text-[#5E5E67]" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M4.293 5.293a1 1 0 011.414 0L8 7.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                            </svg>
                        </button>

                        {isOrgMenuOpen && (
                            <div className="absolute left-0 mt-2 w-56 bg-[#0E0E11] border border-[#2B2B32] rounded-md shadow-2xl py-1 z-50">
                                <div className="px-3 py-2 border-b border-[#1C1C20]">
                                    <p className="text-[11px] text-[#5E5E67] uppercase font-bold tracking-wider">Active Workspace</p>
                                    <p className="text-xs font-semibold text-[#FFFFFF] truncate mt-0.5">{currentOrganization.name}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOrgMenuOpen(false);
                                        onNavigate('/organization/settings');
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-[#9A9AA2] hover:text-[#FFFFFF] hover:bg-[#16161A] bg-transparent border-none cursor-pointer"
                                >
                                    Workspace Settings
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {headerActions}

                    <div className="relative border-l border-[#1C1C20] pl-3">
                        <button
                            type="button"
                            onClick={() => setIsUserMenuOpen((prev) => !prev)}
                            aria-haspopup="true"
                            aria-expanded={isUserMenuOpen}
                            className="inline-flex items-center space-x-2 text-xs font-medium text-[#FFFFFF] hover:bg-[#0E0E11] px-2.5 py-1.5 rounded bg-transparent border border-transparent hover:border-[#2B2B32] transition-colors cursor-pointer"
                        >
                            {currentUser.avatarUrl ? (
                                <img
                                    src={currentUser.avatarUrl}
                                    alt={currentUser.name}
                                    className="w-5 h-5 rounded-full object-cover border border-[#2B2B32]"
                                />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-[#16161A] border border-[#2B2B32] flex items-center justify-center text-[10px] font-bold text-[#FFFFFF]">
                                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
                                </div>
                            )}
                            <span className="font-semibold">{currentUser.name}</span>
                            <svg className="w-3 h-3 text-[#5E5E67]" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M4.293 5.293a1 1 0 011.414 0L8 7.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                            </svg>
                        </button>

                        {isUserMenuOpen && (
                            <div className="absolute right-0 mt-2 w-52 bg-[#0E0E11] border border-[#2B2B32] rounded-md shadow-2xl py-1 z-50">
                                <div className="px-3 py-2 border-b border-[#1C1C20]">
                                    <p className="text-xs font-semibold text-[#FFFFFF] truncate">{currentUser.name}</p>
                                    {currentUser.email && (
                                        <p className="text-[11px] text-[#5E5E67] truncate mt-0.5">{currentUser.email}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsUserMenuOpen(false);
                                        onNavigate('/account');
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-[#9A9AA2] hover:text-[#FFFFFF] hover:bg-[#16161A] bg-transparent border-none cursor-pointer"
                                >
                                    Account Settings
                                </button>
                                {onLogout && (
                                    <div className="border-t border-[#1C1C20] mt-1 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsUserMenuOpen(false);
                                                onLogout();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-[#EF4444] hover:bg-[#1F1315] bg-transparent border-none cursor-pointer"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </div>
    );
};
