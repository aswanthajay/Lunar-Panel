import React, { useState } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { useHistory, useLocation, useRouteMatch } from 'react-router-dom';

interface SidebarProps {
    onOpenCmd?: (q?: string) => void;
    isMobileOpen?: boolean;
    onCloseMobile?: () => void;
}

export default ({ onOpenCmd, isMobileOpen = false, onCloseMobile }: SidebarProps) => {
    const { isAdmin } = useUserRole();
    const history = useHistory();
    const location = useLocation();
    const serverMatch = useRouteMatch<{ id: string }>('/server/:id');
    const serverId = serverMatch?.params?.id;
    const isServerView = Boolean(serverId);

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [essentialsOpen, setEssentialsOpen] = useState(true);

    const onNavigate = (path: string) => {
        history.push(path);
        if (onCloseMobile) {
            onCloseMobile();
        }
    };

    const adminNavItems = [
        {
            title: 'Overview', adminOnly: false,
            path: '/',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="currentColor">
                    <path clipRule="evenodd" d="M1 9.387h8V1.387H1v8ZM13 1.387h8v8h-8v-8ZM21 12.613h-8v8h8v-8ZM9 20.613H1v-8h8v8Z" fillRule="evenodd" />
                </svg>
            )
        },
        {
            title: 'Game Servers', adminOnly: false,
            path: '/instances',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="currentColor">
                    <path d="M2 3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm2 1v14h14V4H4zm2 2h10v2H6V6zm0 4h10v2H6v-2zm0 4h5v2H6v-2z" />
                </svg>
            )
        },
        {
            title: isAdmin ? 'Billing Operations' : 'Billing and Renewals',
            adminOnly: false,
            path: isAdmin ? '/billing-operations' : '/billing',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="currentColor">
                    <path d="M4 3.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V5A1.5 1.5 0 0 1 4 3.5Zm0 2a.5.5 0 0 0-.5.5v1h15V6a.5.5 0 0 0-.5-.5H4Zm-.5 4v7a.5.5 0 0 0 .5.5h14a.5.5 0 0 0 .5-.5v-7h-15Z" />
                    <path d="M6 12h4v2H6zm6 0h4v2h-4z" />
                </svg>
            )
        },
        {
            title: 'Ticket Management', adminOnly: false,
            path: '/support',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h9A2.5 2.5 0 0 1 18 5.5v7A2.5 2.5 0 0 1 15.5 15H10l-4.5 3V15.2A2.5 2.5 0 0 1 4 12.5v-7Z" />
                    <path d="M7.5 8.5h7M7.5 11.5h4.5" />
                </svg>
            )
        },
        {
            title: 'Node Audit Logs', adminOnly: true,
            path: '/audit-logs',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="currentColor">
                    <path clipRule="evenodd" d="M4 2h10l4 4v14H4V2Zm10 2.5V7h2.5L14 4.5ZM6 10h10v2H6v-2Zm0 4h10v2H6v-2Zm0 4h6v2H6v-2Z" fillRule="evenodd" />
                </svg>
            )
        },
        {
            title: 'Reinstall Requests', adminOnly: true,
            path: '/reimage-requests',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="currentColor">
                    <path d="M11 2.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 11 2.5Zm0 15a6.5 6.5 0 1 1 6.5-6.5 6.51 6.51 0 0 1-6.5-6.5Z" />
                    <path d="M10 6h2v6h-2zm0 7.5h2v2h-2z" />
                </svg>
            )
        },
        {
            title: 'Daemon Nodes', adminOnly: true,
            path: '/proxmox-connections',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
            )
        },
        {
            title: 'User Management', adminOnly: true,
            path: '/user-management',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="currentColor">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
            )
        },
        {
            title: 'Network Allocations', adminOnly: true,
            path: '/ovh-manager',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="18" height="7" rx="2" ry="2" />
                    <rect x="2" y="13" width="18" height="7" rx="2" ry="2" />
                    <line x1="6" y1="5.5" x2="6.01" y2="5.5" />
                    <line x1="6" y1="16.5" x2="6.01" y2="16.5" />
                </svg>
            )
        },
        {
            title: 'System Settings', adminOnly: true,
            path: '/system-settings',
            icon: (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 22 22" fill="currentColor">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>
                </svg>
            )
        },
    ];

    const q = searchQuery.toLowerCase().trim();

    return (
        <aside
            id="stellar-sidebar-nav"
            className={`${
                isMobileOpen
                    ? 'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl flex md:relative md:z-30 md:w-60 md:min-w-[15rem] md:max-w-[15rem]'
                    : 'hidden md:flex md:w-60 md:min-w-[15rem] md:max-w-[15rem]'
            } bg-[#000000] border-r border-[#1F1F1F] flex-col justify-between h-full select-none font-sans transition-all duration-200 ${
                isCollapsed ? 'md:!w-16 md:!min-w-[4rem]' : ''
            }`}
            aria-label="Main Navigation"
        >
            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                {/* Top Search & Toggle Header */}
                <div className={`border-b border-[#141414] ${isCollapsed ? 'p-2 flex flex-col gap-2 items-center' : 'p-3 flex items-center justify-between gap-2'}`}>
                    {isServerView ? (
                        isCollapsed ? (
                            <button
                                type="button"
                                onClick={() => history.push('/')}
                                className="w-8 h-8 shrink-0 flex items-center justify-center bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] rounded text-[#FFFFFF] transition-colors cursor-pointer"
                                title="Back to Servers"
                                aria-label="Back to Servers"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => history.push('/')}
                                className="flex-1 flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] rounded px-2.5 py-1 text-xs font-semibold text-[#FFFFFF] transition-colors cursor-pointer"
                                aria-label="Back to Servers"
                            >
                                <span aria-hidden="true">←</span>
                                <span>Back to Servers</span>
                            </button>
                        )
                    ) : !isCollapsed ? (
                        <div
                            className="flex-1 flex items-center justify-between bg-[#050505] border border-[#1F1F1F] hover:border-[#383838] rounded h-8 px-2.5 cursor-pointer relative"
                            onClick={() => onOpenCmd?.(searchQuery)}
                        >
                            <input
                                type="text"
                                placeholder="Navigate to..."
                                aria-label="Navigate to server, node, or command (Ctrl+K)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onOpenCmd?.(searchQuery);
                                }}
                                className="bg-transparent border-none outline-none text-xs text-[#FFFFFF] placeholder-[#656B6B] w-full font-medium"
                                style={{ outline: 'none', boxShadow: 'none' }}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-[10px] font-mono text-[#656B6B] shrink-0 ml-1" aria-hidden="true">Ctrl+K</span>
                        </div>
                    ) : null}

                    {/* Desktop Collapse Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden md:flex w-8 h-8 shrink-0 items-center justify-center text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] rounded transition-colors cursor-pointer"
                        title={isCollapsed ? 'Expand Menu' : 'Collapse Menu'}
                        aria-label={isCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
                        aria-expanded={!isCollapsed}
                    >
                        <svg height="14" viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d={isCollapsed ? 'M13 7h-9M13 12h-9M13 17h-9M17 16l4-4-4-4' : 'M11 7h9M11 12h9M11 17h9M7 16l-4-4 4-4'} />
                        </svg>
                    </button>

                    {/* Mobile Drawer Close Button (only visible on mobile drawer) */}
                    {onCloseMobile && (
                        <button
                            type="button"
                            onClick={onCloseMobile}
                            className="md:hidden w-8 h-8 shrink-0 flex items-center justify-center text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] rounded transition-colors cursor-pointer"
                            aria-label="Close navigation drawer"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Navigation Items List */}
                <nav aria-label="Sidebar Menu">
                    <ul className="p-2 space-y-1 list-none m-0">
                    {isServerView ? (
                        /* SERVER CONTEXT MENU */
                        [
                            {
                                name: 'Console',
                                path: `/server/${serverId}`,
                                exact: true,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="4 17 10 11 4 5" />
                                        <line x1="12" y1="19" x2="20" y2="19" />
                                    </svg>
                                ),
                            },
                            {
                                name: 'File Manager',
                                path: `/server/${serverId}/files`,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    </svg>
                                ),
                            },
                            {
                                name: 'Databases',
                                path: `/server/${serverId}/databases`,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                                    </svg>
                                ),
                            },
                            {
                                name: 'Schedules',
                                path: `/server/${serverId}/schedules`,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                ),
                            },
                            {
                                name: 'Users & Subusers',
                                path: `/server/${serverId}/users`,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                ),
                            },
                            {
                                name: 'Backups',
                                path: `/server/${serverId}/backups`,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                        <polyline points="17 21 17 13 7 13 7 21" />
                                        <polyline points="7 3 7 8 15 8" />
                                    </svg>
                                ),
                            },
                            {
                                name: 'Network & Ports',
                                path: `/server/${serverId}/network`,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                        <line x1="6" y1="6" x2="6.01" y2="6" />
                                        <line x1="6" y1="18" x2="6.01" y2="18" />
                                    </svg>
                                ),
                            },
                            {
                                name: 'Startup Config',
                                path: `/server/${serverId}/startup`,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                ),
                            },
                            {
                                name: 'Settings',
                                path: `/server/${serverId}/settings`,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                ),
                            },
                            {
                                name: 'Activity Audit',
                                path: `/server/${serverId}/activity`,
                                icon: (
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                ),
                            },
                        ].map((item) => {
                            const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
                            return (
                                <li key={item.name}>
                                    <button
                                        type="button"
                                        onClick={() => onNavigate(item.path)}
                                        title={item.name}
                                        className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 h-9' : 'gap-3 px-3 py-2'} rounded-md transition-colors cursor-pointer border-none text-left ${
                                            isActive
                                                ? `bg-[#0A0A0A] text-[#FFFFFF] font-medium ${isCollapsed ? 'border-r-2 border-[#FFFFFF]' : 'border-l-2 border-[#FFFFFF] pl-2.5'}`
                                                : 'bg-transparent text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#0A0A0A]'
                                        }`}
                                    >
                                        <span className="text-[#A0A0A0] flex items-center justify-center shrink-0">
                                            {item.icon}
                                        </span>
                                        {!isCollapsed && <span className="text-xs font-medium truncate">{item.name}</span>}
                                    </button>
                                </li>
                            );
                        })
                    ) : (
                        /* GLOBAL FLEET MENU */
                        <>
                            {/* Overview */}
                            {(!q || 'overview'.includes(q)) && (
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => onNavigate('/')}
                                        title="Overview"
                                        className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 h-9' : 'gap-3 px-3 py-2'} rounded-md transition-colors cursor-pointer border-none text-left ${
                                            location.pathname === '/' || location.pathname === '/overview'
                                                ? `bg-[#0A0A0A] text-[#FFFFFF] font-medium ${isCollapsed ? 'border-r-2 border-[#FFFFFF]' : 'border-l-2 border-[#FFFFFF] pl-2.5'}`
                                                : 'bg-transparent text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#0A0A0A]'
                                        }`}
                                    >
                                        <span className="text-[#A0A0A0] flex items-center justify-center">{adminNavItems[0].icon}</span>
                                        {!isCollapsed && <span className="text-xs font-medium truncate">Overview</span>}
                                    </button>
                                </li>
                            )}

                            {/* Essentials Accordion */}
                            {!isCollapsed && (
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => setEssentialsOpen(!essentialsOpen)}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-transparent text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#121212] transition-colors cursor-pointer border-none text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 22 22" fill="currentColor">
                                                <path clipRule="evenodd" d="M13.02 9.23H18l-7.08 11.66-.06.11H9.1v-8.2H4l.23-.38 6.86-11.3.06-.12h1.87z" fillRule="evenodd" />
                                            </svg>
                                            <span className="text-xs font-medium">Essentials</span>
                                        </div>
                                        <svg
                                            className={`w-3 h-3 transition-transform duration-200 ${essentialsOpen ? 'rotate-90' : ''}`}
                                            viewBox="0 0 22 22"
                                            fill="currentColor"
                                        >
                                            <path d="m18.2 11.14-9.67 9.67-1.06-1.06 8.61-8.61-8.61-8.61 1.06-1.06 9.67 9.67Z" />
                                        </svg>
                                    </button>

                                    {essentialsOpen && (
                                        <div className="pl-9 pr-2 py-1 space-y-1">
                                            {[
                                                { title: 'All Game Servers', path: '/instances' },
                                                isAdmin
                                                    ? { title: 'Billing Operations', path: '/billing-operations' }
                                                    : { title: 'Billing and Renewals', path: '/billing' },
                                                { title: 'Support Tickets', path: '/support' },
                                                isAdmin ? { title: 'Daemon Nodes', path: '/proxmox-connections' } : null,
                                            ].filter(Boolean).map((sub: any) => (
                                                <button
                                                    key={sub.title}
                                                    type="button"
                                                    onClick={() => onNavigate(sub.path)}
                                                    className={`w-full text-left py-1.5 px-2 rounded text-xs transition-colors cursor-pointer border-none block truncate ${
                                                        location.pathname === sub.path
                                                            ? 'text-[#FFFFFF] font-semibold bg-[#16161A]'
                                                            : 'text-[#656B6B] hover:text-[#FFFFFF] bg-transparent'
                                                    }`}
                                                >
                                                    {sub.title}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            )}

                            {/* Other Main Nav Items with inline Icons */}
                            {adminNavItems.slice(1).filter((item: any) => !item.adminOnly || isAdmin).map((item) => {
                                if (q && !item.title.toLowerCase().includes(q)) return null;
                                const isActive = location.pathname === item.path;
                                return (
                                    <li key={item.title}>
                                        <button
                                            type="button"
                                            onClick={() => onNavigate(item.path)}
                                            title={item.title}
                                            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 h-9' : 'gap-3 px-3 py-2'} rounded-md transition-colors cursor-pointer border-none text-left ${
                                                isActive
                                                    ? `bg-[#121212] text-[#FFFFFF] font-semibold ${isCollapsed ? 'border-r-2 border-[#FFFFFF]' : 'border-l-2 border-[#FFFFFF] pl-2.5'}`
                                                    : 'bg-transparent text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#121212]'
                                            }`}
                                        >
                                            <span className="text-[#A0A0A0] flex items-center justify-center shrink-0">{item.icon}</span>
                                            {!isCollapsed && <span className="text-xs font-medium truncate">{item.title}</span>}
                                        </button>
                                    </li>
                                );
                            })}

                            {!isCollapsed && (
                                <li className="pt-3 pb-1 px-3">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#656B6B] block border-t border-[#262626] pt-3">
                                        MORE
                                    </span>
                                </li>
                            )}

                            <li>
                                <button
                                    type="button"
                                    onClick={() => onNavigate('/account')}
                                    title="User Settings"
                                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 h-9' : 'gap-3 px-3 py-2'} rounded-md transition-colors cursor-pointer border-none text-left ${
                                        location.pathname.startsWith('/account')
                                            ? `bg-[#121212] text-[#FFFFFF] font-semibold ${isCollapsed ? 'border-r-2 border-[#FFFFFF]' : 'border-l-2 border-[#FFFFFF] pl-2.5'}`
                                            : 'bg-transparent text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#121212]'
                                    }`}
                                >
                                    <svg className="w-4 h-4 shrink-0 text-[#A0A0A0]" viewBox="0 0 22 22" fill="currentColor">
                                        <path clipRule="evenodd" d="M11 1.613a9.387 9.387 0 1 0 0 18.774 9.387 9.387 0 0 0 0-18.774ZM3.613 11a7.387 7.387 0 1 1 14.774 0 7.387 7.387 0 0 1-14.774 0Zm7.387-4a1 1 0 0 0-1 1v2H8a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2V8a1 1 0 0 0-1-1Z" fillRule="evenodd" />
                                    </svg>
                                    {!isCollapsed && <span className="text-xs font-medium truncate">User Settings</span>}
                                </button>
                            </li>
                        </>
                    )}
                </ul>
                </nav>
            </div>
        </aside>
    );
};
