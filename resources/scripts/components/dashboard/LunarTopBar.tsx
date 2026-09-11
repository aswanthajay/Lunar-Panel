import React, { useState, useRef, useEffect } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { useHistory } from 'react-router-dom';
import http from '@/api/http';
import { RecentDownloadItem, formatDownloadTime } from '@/helpers';

interface DownloadTool {
    id: string;
    name: string;
    category: 'sftp' | 'ssh' | 'server';
    categoryLabel: string;
    platform: string;
    description: string;
    url: string;
    badge?: string;
}

const RECOMMENDED_TOOLS: DownloadTool[] = [
    {
        id: 'winscp',
        name: 'WinSCP',
        category: 'sftp',
        categoryLabel: 'SFTP',
        platform: 'Windows',
        description: 'Popular SFTP and SCP client with built-in remote editor and transfer queues',
        url: 'https://winscp.net/eng/download.php',
        badge: 'Recommended',
    },
    {
        id: 'cyberduck',
        name: 'Cyberduck',
        category: 'sftp',
        categoryLabel: 'SFTP',
        platform: 'macOS & Windows',
        description: 'Modern, user-friendly SFTP and cloud storage browser with drag-and-drop',
        url: 'https://cyberduck.io/download/',
    },
    {
        id: 'filezilla',
        name: 'FileZilla',
        category: 'sftp',
        categoryLabel: 'SFTP',
        platform: 'Multi-platform',
        description: 'Fast and reliable cross-platform FTP/SFTP client for bulk transfers',
        url: 'https://filezilla-project.org/download.php?type=client',
    },
    {
        id: 'termius',
        name: 'Termius',
        category: 'ssh',
        categoryLabel: 'SSH',
        platform: 'Multi-platform',
        description: 'Modern SSH terminal client with encrypted vault and seamless sync',
        url: 'https://termius.com/download',
        badge: 'Modern',
    },
    {
        id: 'putty',
        name: 'PuTTY',
        category: 'ssh',
        categoryLabel: 'SSH',
        platform: 'Windows',
        description: 'Lightweight, portable SSH and Telnet terminal emulator',
        url: 'https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html',
    },
    {
        id: 'adoptium',
        name: 'Adoptium Temurin',
        category: 'server',
        categoryLabel: 'Runtime',
        platform: 'Java 17 & 21',
        description: 'Enterprise-grade OpenJDK runtimes optimized for modern Minecraft servers',
        url: 'https://adoptium.net/temurin/releases/',
        badge: 'Essential',
    },
    {
        id: 'papermc',
        name: 'PaperMC',
        category: 'server',
        categoryLabel: 'Server JAR',
        platform: 'Minecraft 1.20+',
        description: 'High-performance Minecraft game server software fixing lag and exploits',
        url: 'https://papermc.io/downloads/paper',
    },
    {
        id: 'purpur',
        name: 'Purpur',
        category: 'server',
        categoryLabel: 'Server JAR',
        platform: 'Minecraft 1.20+',
        description: 'Configurable Paper fork with extensive customization options and gameplay tweaks',
        url: 'https://purpurmc.org/downloads',
    },
    {
        id: 'geyser',
        name: 'GeyserMC',
        category: 'server',
        categoryLabel: 'Bridge',
        platform: 'Bedrock Proxy',
        description: 'Proxy translator enabling Minecraft Bedrock players to join Java servers',
        url: 'https://geysermc.org/download',
    },
];

interface HeaderProps {
    onOpenCmd?: (q?: string) => void;
    isMobileNavOpen?: boolean;
    onToggleMobileNav?: () => void;
    selectedServerName?: string;
    onSelectServerScope?: (serverId: string | null) => void;
}

export default ({ onOpenCmd, isMobileNavOpen, onToggleMobileNav, selectedServerName, onSelectServerScope }: HeaderProps) => {
    const history = useHistory();
    const user = useStoreState((state: ApplicationStore) => state.user.data);
    const { isAdmin, toggleRole, rootAdmin } = useUserRole();

    const [tasksOpen, setTasksOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [downloadsOpen, setDownloadsOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [tasksList, setTasksList] = useState<any[]>([]);
    const [downloadTab, setDownloadTab] = useState<'tools' | 'recent'>('tools');
    const [downloadCategory, setDownloadCategory] = useState<'all' | 'sftp' | 'ssh' | 'server'>('all');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [recentDownloads, setRecentDownloads] = useState<RecentDownloadItem[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('votion_recent_downloads') || '[]');
        } catch {
            return [];
        }
    });

    const menuRef = useRef<HTMLDivElement>(null);
    const taskRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const downloadRef = useRef<HTMLDivElement>(null);

    // Sync recent downloads on custom event or local storage update
    useEffect(() => {
        const syncRecent = () => {
            try {
                setRecentDownloads(JSON.parse(localStorage.getItem('votion_recent_downloads') || '[]'));
            } catch {
                setRecentDownloads([]);
            }
        };
        window.addEventListener('votion:download', syncRecent);
        window.addEventListener('storage', syncRecent);
        return () => {
            window.removeEventListener('votion:download', syncRecent);
            window.removeEventListener('storage', syncRecent);
        };
    }, []);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
            if (taskRef.current && !taskRef.current.contains(event.target as Node)) {
                setTasksOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
            if (downloadRef.current && !downloadRef.current.contains(event.target as Node)) {
                setDownloadsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleClearRecent = () => {
        try {
            localStorage.removeItem('votion_recent_downloads');
            setRecentDownloads([]);
        } catch {
            // ignore
        }
    };

    const handleRemoveRecentItem = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const updated = recentDownloads.filter((item) => item.id !== id);
            localStorage.setItem('votion_recent_downloads', JSON.stringify(updated));
            setRecentDownloads(updated);
        } catch {
            // ignore
        }
    };

    const handleCopyUrl = (id: string, url: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!url) return;
        navigator.clipboard?.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredTools = downloadCategory === 'all'
        ? RECOMMENDED_TOOLS
        : RECOMMENDED_TOOLS.filter((t) => t.category === downloadCategory);

    const onTriggerLogout = () => {
        http.post('/auth/logout').finally(() => {
            // @ts-ignore
            window.location = '/';
        });
    };

    const activeBadgeCount = tasksList.filter((t) => t.status === 'running').length;
    const userFullName = [user?.nameFirst, user?.nameLast].filter(Boolean).join(' ').trim() || (user as any)?.name;
    const currentUserName = userFullName || user?.username || (user?.email ? user.email.split('@')[0] : 'Account');

    return (
        <header
            className="app-header h-[60px] bg-white dark:bg-[#0a0a0a] border-b border-[#dedfdf] dark:border-[#262626] flex items-center justify-between px-4 sm:px-6 relative z-30 select-none text-[#1a1a1a] dark:text-[#ededed] font-sans transition-colors duration-150"
            role="banner"
        >
            {/* LEFT: Mobile Menu, Brand Logo, Workspace Selector, Role Switcher */}
            <div className="header-left flex items-center gap-2.5 sm:gap-3 min-w-0">
                {onToggleMobileNav && (
                    <button
                        type="button"
                        onClick={onToggleMobileNav}
                        className="mobile-menu-trigger md:hidden flex items-center justify-center w-8 h-8 rounded-md text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f1f1f1] dark:hover:bg-[#161616] transition-colors cursor-pointer bg-transparent border-none p-0"
                        aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        title="Open navigation menu"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                )}

                {/* BRAND LOGO: VOTION BOX LOGO & LUNAR PANEL WITH SIGNATURE FONT */}
                <button
                    type="button"
                    onClick={() => history.push('/')}
                    className="brand-logo cursor-pointer bg-transparent border-none p-0 flex items-center gap-2.5 sm:gap-3 shrink-0 group"
                    title="Lunar Panel"
                    aria-label="Go to Lunar Panel Dashboard"
                >
                    <div className="theme-brand-logo relative h-[31px] p-[3px] bg-[#1a1a1a] dark:bg-[#3f3f46] flex items-center justify-center select-none transition-transform group-hover:scale-[1.02] overflow-hidden">
                        <span className="comet-trace-beam" />
                        <span className="theme-brand-logo-inner h-full px-[11px] bg-white dark:bg-[#0a0a0a] text-[#1a1a1a] dark:text-[#ededed] text-base font-extrabold lowercase tracking-tight flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] relative z-[2]">
                            votion
                        </span>
                    </div>
                    <span className="text-[#c4c7c7] dark:text-[#383838] text-sm select-none font-light">/</span>
                    <span
                        className="font-serif text-[18px] sm:text-[20px] font-normal text-[#1a1a1a] dark:text-white tracking-tight select-none leading-none"
                        style={{ fontFamily: '"Newsreader", "Playfair Display", Georgia, serif' }}
                    >
                        Lunar Panel
                    </span>
                </button>

                {/* ADMIN vs CLIENT ROLE SWITCHER */}
                {rootAdmin && (
                    <button
                        type="button"
                        onClick={toggleRole}
                        className="header-role-switcher hidden sm:flex px-3 py-1.5 rounded-md text-[13px] font-semibold items-center gap-2 transition-colors border cursor-pointer bg-[#fbfaf9] dark:bg-[#141414] text-[#1a1a1a] dark:text-[#ededed] border-[#dedfdf] dark:border-[#262626] hover:bg-[#f1f1f1] dark:hover:bg-[#1a1a1a]"
                        title={isAdmin ? 'Switch to client workspace' : 'Switch to administrator workspace'}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 3l4 4-4 4" />
                            <path d="M3 7h18" />
                            <path d="M7 21l-4-4 4-4" />
                            <path d="M21 17H3" />
                        </svg>
                        <span>{isAdmin ? 'Switch to Client View' : 'Switch to Admin View'}</span>
                    </button>
                )}
            </div>

            {/* RIGHT: Alert Rules, Notifications, Tasks, Downloads, Upgrade, User Profile */}
            <div className="header-right flex items-center gap-1.5 sm:gap-2.5 relative">

                {/* NOTIFICATION BELL */}
                <div className="header-notification-wrap relative" ref={notifRef}>
                    <button
                        type="button"
                        onClick={() => {
                            setNotificationsOpen(!notificationsOpen);
                            setTasksOpen(false);
                            setDownloadsOpen(false);
                            setUserMenuOpen(false);
                        }}
                        className={`w-8 h-8 flex items-center justify-center rounded-md border transition-colors cursor-pointer relative ${
                            notificationsOpen
                                ? 'border-[#1a1a1a] dark:border-white bg-[#f1f1f1] dark:bg-[#161616] text-[#1a1a1a] dark:text-white'
                                : 'border-[#dedfdf] dark:border-[#262626] text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f1f1f1] dark:hover:bg-[#161616]'
                        }`}
                        title="Notifications"
                        aria-label="View notifications"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ fill: 'none' }}>
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                    </button>

                    {notificationsOpen && (
                        <div className="notification-panel absolute right-0 top-11 w-72 bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-2xl p-4 z-[200] text-xs">
                            <div className="flex items-center justify-between pb-2 border-b border-[#dedfdf] dark:border-[#262626]">
                                <span className="font-bold text-[#1a1a1a] dark:text-white">Notifications</span>
                                <span className="text-[10px] text-[#16a34a] font-semibold">Up to date</span>
                            </div>
                            <div className="py-6 text-center text-[#656b6b] dark:text-[#a0a0a0] flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="font-semibold text-xs text-[#1a1a1a] dark:text-white">All caught up</p>
                                <span className="text-[11px]">No active telemetry threshold alerts.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* TASKS BUTTON */}
                <div className="header-task-menu-wrap relative" ref={taskRef}>
                    <button
                        type="button"
                        onClick={() => {
                            setTasksOpen(!tasksOpen);
                            setNotificationsOpen(false);
                            setDownloadsOpen(false);
                            setUserMenuOpen(false);
                        }}
                        className={`h-8 flex items-center gap-1.5 px-2.5 rounded-md border text-[13px] font-medium transition-all cursor-pointer ${
                            tasksOpen
                                ? 'border-[#1a1a1a] dark:border-white bg-[#f1f1f1] dark:bg-[#161616] text-[#1a1a1a] dark:text-white'
                                : 'border-transparent text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white hover:border-[#dedfdf] dark:hover:border-[#262626] hover:bg-[#f1f1f1] dark:hover:bg-[#161616]'
                        }`}
                    >
                        <span>Tasks</span>
                        {activeBadgeCount > 0 && (
                            <span className="task-count bg-[#1a1a1a] dark:bg-white text-white dark:text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none" aria-label={`${activeBadgeCount} active tasks`}>
                                {activeBadgeCount}
                            </span>
                        )}
                        <svg
                            className={`transition-transform duration-200 shrink-0 ${tasksOpen ? 'rotate-180' : ''}`}
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ fill: 'none' }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {tasksOpen && (
                        <div className="tasks-dropdown-menu active absolute right-0 top-11 w-80 bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-2xl p-4 z-[200] text-xs">
                            <div className="tasks-header font-bold text-[#1a1a1a] dark:text-white pb-2 border-b border-[#dedfdf] dark:border-[#262626] flex items-center justify-between">
                                <span>Active background tasks</span>
                                <span className="font-mono text-[10px] text-[#656b6b]">0 running</span>
                            </div>
                            <div className="tasks-empty-state py-6 text-center text-[#656b6b] dark:text-[#a0a0a0] flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="font-semibold text-xs text-[#1a1a1a] dark:text-white">No active tasks</p>
                                <span className="text-[11px]">Background work and container provisioning will appear here.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* DOWNLOADS BUTTON & DROPDOWN */}
                <div className="header-download-menu-wrap relative hidden sm:block" ref={downloadRef}>
                    <button
                        type="button"
                        onClick={() => {
                            setDownloadsOpen(!downloadsOpen);
                            setNotificationsOpen(false);
                            setTasksOpen(false);
                            setUserMenuOpen(false);
                        }}
                        className={`h-8 flex items-center gap-1.5 px-2.5 rounded-md border text-[13px] font-medium transition-all cursor-pointer ${
                            downloadsOpen
                                ? 'border-[#1a1a1a] dark:border-white bg-[#f1f1f1] dark:bg-[#161616] text-[#1a1a1a] dark:text-white'
                                : 'border-transparent text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white hover:border-[#dedfdf] dark:hover:border-[#262626] hover:bg-[#f1f1f1] dark:hover:bg-[#161616]'
                        }`}
                        title="Downloads & Utilities"
                        aria-label="Downloads and utilities menu"
                    >
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ fill: 'none' }}
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Downloads</span>
                        {recentDownloads.length > 0 && (
                            <span className="bg-[#2563eb] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none" aria-label={`${recentDownloads.length} recent downloads`}>
                                {recentDownloads.length}
                            </span>
                        )}
                        <svg
                            className={`transition-transform duration-200 shrink-0 ${downloadsOpen ? 'rotate-180' : ''}`}
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ fill: 'none' }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {downloadsOpen && (
                        <div className="downloads-dropdown-menu active absolute right-0 top-11 w-80 sm:w-[410px] max-h-[82vh] flex flex-col bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-2xl p-4 z-[200] text-xs">
                            {/* Header */}
                            <div className="flex items-center justify-between pb-2.5 border-b border-[#dedfdf] dark:border-[#262626] shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-md bg-[#2563eb]/10 flex items-center justify-center text-[#2563eb]">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                    </div>
                                    <span className="font-bold text-[13px] text-[#1a1a1a] dark:text-white">Downloads & Utilities</span>
                                </div>
                                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    Ready
                                </span>
                            </div>

                            {/* Tabs Switcher */}
                            <div className="flex items-center gap-1 my-2.5 p-0.5 bg-[#f1f1f1] dark:bg-[#181818] rounded-lg border border-[#dedfdf] dark:border-[#262626] shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setDownloadTab('tools')}
                                    className={`flex-1 py-1.5 px-2 rounded-md font-medium text-[11px] transition-all cursor-pointer text-center ${
                                        downloadTab === 'tools'
                                            ? 'bg-white dark:bg-[#262626] text-[#1a1a1a] dark:text-white shadow-sm font-bold'
                                            : 'text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white'
                                    }`}
                                >
                                    Recommended Tools
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDownloadTab('recent')}
                                    className={`flex-1 py-1.5 px-2 rounded-md font-medium text-[11px] transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                                        downloadTab === 'recent'
                                            ? 'bg-white dark:bg-[#262626] text-[#1a1a1a] dark:text-white shadow-sm font-bold'
                                            : 'text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white'
                                    }`}
                                >
                                    <span>Recent Activity</span>
                                    {recentDownloads.length > 0 && (
                                        <span className="bg-[#2563eb] text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                                            {recentDownloads.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* TAB 1: RECOMMENDED TOOLS */}
                            {downloadTab === 'tools' && (
                                <div className="flex flex-col min-h-0 flex-1">
                                    {/* Category Filter Pills */}
                                    <div className="flex items-center gap-1 pb-2 shrink-0 overflow-x-auto">
                                        {[
                                            { id: 'all', label: 'All' },
                                            { id: 'sftp', label: 'SFTP' },
                                            { id: 'ssh', label: 'SSH' },
                                            { id: 'server', label: 'Server Software' },
                                        ].map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => setDownloadCategory(c.id as any)}
                                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer shrink-0 ${
                                                    downloadCategory === c.id
                                                        ? 'bg-[#1a1a1a] dark:bg-white text-white dark:text-black font-semibold'
                                                        : 'bg-transparent text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#1f1f1f]'
                                                }`}
                                            >
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tools List */}
                                    <div className="overflow-y-auto space-y-2 pr-0.5 max-h-[290px] overscroll-contain">
                                        {filteredTools.map((tool) => (
                                            <div
                                                key={tool.id}
                                                className="p-2.5 rounded-lg border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#161616] hover:border-[#1a1a1a] dark:hover:border-[#404040] transition-colors flex flex-col gap-1.5"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-bold text-xs text-[#1a1a1a] dark:text-white truncate">
                                                            {tool.name}
                                                        </span>
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f1f1f1] dark:bg-[#262626] text-[#656b6b] dark:text-[#a0a0a0] shrink-0 font-medium">
                                                            {tool.platform}
                                                        </span>
                                                        {tool.badge && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0 font-semibold">
                                                                {tool.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <a
                                                        href={tool.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1a1a1a] dark:bg-white text-white dark:text-black text-[10px] font-semibold hover:opacity-90 transition-opacity shrink-0 no-underline"
                                                    >
                                                        <span>Download</span>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                            <polyline points="15 3 21 3 21 9" />
                                                            <line x1="10" y1="14" x2="21" y2="3" />
                                                        </svg>
                                                    </a>
                                                </div>
                                                <p className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0] leading-snug line-clamp-2">
                                                    {tool.description}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: RECENT ACTIVITY */}
                            {downloadTab === 'recent' && (
                                <div className="flex flex-col min-h-0 flex-1">
                                    {recentDownloads.length === 0 ? (
                                        <div className="py-8 text-center text-[#656b6b] dark:text-[#a0a0a0] flex flex-col items-center">
                                            <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                            </div>
                                            <p className="font-semibold text-xs text-[#1a1a1a] dark:text-white">No recent activity</p>
                                            <span className="text-[11px] max-w-[260px] mt-1 leading-snug">
                                                Files, backups, and console logs downloaded from this panel will be tracked here.
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col min-h-0 flex-1">
                                            <div className="overflow-y-auto space-y-2 pr-0.5 max-h-[260px] overscroll-contain">
                                                {recentDownloads.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="p-2 rounded-lg border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#161616] flex items-center justify-between gap-2"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-7 h-7 rounded bg-[#f1f1f1] dark:bg-[#202020] flex items-center justify-center text-[#656b6b] dark:text-[#a0a0a0] shrink-0">
                                                                {item.type === 'backup' ? (
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                                                        <polyline points="3 9 12 15 21 9" />
                                                                    </svg>
                                                                ) : item.type === 'log' ? (
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="4 17 10 11 4 5" />
                                                                        <line x1="12" y1="19" x2="20" y2="19" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                                        <polyline points="14 2 14 8 20 8" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-xs font-semibold text-[#1a1a1a] dark:text-white truncate" title={item.name}>
                                                                    {item.name}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[10px] text-[#656b6b] dark:text-[#a0a0a0]">
                                                                    <span className="capitalize">{item.type}</span>
                                                                    <span>·</span>
                                                                    <span>{formatDownloadTime(item.timestamp)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {item.url && (
                                                                <>
                                                                    <a
                                                                        href={item.url}
                                                                        download={item.name}
                                                                        className="p-1 rounded hover:bg-[#f1f1f1] dark:hover:bg-[#262626] text-[#2563eb] transition-colors"
                                                                        title="Re-download"
                                                                    >
                                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                            <polyline points="7 10 12 15 17 10" />
                                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                                        </svg>
                                                                    </a>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleCopyUrl(item.id, item.url!, e)}
                                                                        className="p-1 rounded hover:bg-[#f1f1f1] dark:hover:bg-[#262626] text-[#656b6b] dark:text-[#a0a0a0] transition-colors cursor-pointer"
                                                                        title={copiedId === item.id ? 'Copied!' : 'Copy download URL'}
                                                                    >
                                                                        {copiedId === item.id ? (
                                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                                <polyline points="20 6 9 17 4 12" />
                                                                            </svg>
                                                                        ) : (
                                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                                            </svg>
                                                                        )}
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleRemoveRecentItem(item.id, e)}
                                                                className="p-1 rounded hover:bg-[#f1f1f1] dark:hover:bg-[#262626] text-[#dc2626]/70 hover:text-[#dc2626] transition-colors cursor-pointer"
                                                                title="Remove from history"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="pt-2 mt-2 border-t border-[#dedfdf] dark:border-[#262626] flex items-center justify-between shrink-0">
                                                <span className="text-[10px] text-[#656b6b] dark:text-[#a0a0a0]">
                                                    {recentDownloads.length} item{recentDownloads.length > 1 ? 's' : ''} recorded
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleClearRecent}
                                                    className="text-[10px] text-[#dc2626] hover:underline cursor-pointer font-semibold"
                                                >
                                                    Clear history
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Dropdown Footer */}
                            <div className="mt-3 pt-2.5 border-t border-[#dedfdf] dark:border-[#262626] flex items-center justify-between text-[11px] shrink-0">
                                <span className="text-[#656b6b] dark:text-[#a0a0a0]">Need SFTP connection info?</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDownloadsOpen(false);
                                        history.push('/instances');
                                    }}
                                    className="text-[#2563eb] hover:underline font-semibold cursor-pointer"
                                >
                                    View Servers →
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* UPGRADE LINK */}
                <button
                    type="button"
                    onClick={() => history.push('/billing')}
                    className="hidden lg:inline-flex items-center h-8 px-2.5 rounded-md border border-transparent hover:border-[#dedfdf] dark:hover:border-[#262626] text-[13px] font-medium text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f1f1f1] dark:hover:bg-[#161616] transition-all cursor-pointer"
                >
                    <span>Upgrade</span>
                </button>

                {/* USER PROFILE BUTTON */}
                <div className="header-user-menu-wrap relative" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => {
                            setUserMenuOpen(!userMenuOpen);
                            setTasksOpen(false);
                            setNotificationsOpen(false);
                            setDownloadsOpen(false);
                        }}
                        className={`h-8 flex items-center gap-1.5 px-2.5 rounded-md border text-[13px] font-semibold transition-all cursor-pointer ${
                            userMenuOpen
                                ? 'border-[#1a1a1a] dark:border-white bg-[#f1f1f1] dark:bg-[#161616] text-[#1a1a1a] dark:text-white'
                                : 'border-transparent text-[#1a1a1a] dark:text-[#ededed] hover:text-black dark:hover:text-white hover:border-[#dedfdf] dark:hover:border-[#262626] hover:bg-[#f1f1f1] dark:hover:bg-[#161616]'
                        }`}
                    >
                        <span>{currentUserName}</span>
                        <svg
                            className={`transition-transform duration-200 shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`}
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ fill: 'none' }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {userMenuOpen && (
                        <div className="header-user-menu absolute right-0 top-11 w-56 bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-lg shadow-xl py-2 z-[350] text-sm text-[#1a1a1a] dark:text-white animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-4 py-2 border-b border-[#dedfdf] dark:border-[#262626] mb-1">
                                <div className="font-semibold text-sm truncate">{currentUserName}</div>
                                {user?.username && currentUserName !== user.username ? (
                                    <div className="text-xs text-[#656b6b] dark:text-[#a0a0a0] truncate">@{user.username}</div>
                                ) : (
                                    <div className="text-xs text-[#656b6b] dark:text-[#a0a0a0] truncate">{user?.email}</div>
                                )}
                            </div>
                            {rootAdmin && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            toggleRole();
                                            setUserMenuOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] dark:hover:bg-[#1a1a1a] transition-colors font-semibold text-[#2563eb] flex items-center justify-between cursor-pointer"
                                        title={isAdmin ? 'Open the client workspace' : 'Open the administrator workspace'}
                                    >
                                        <span>{isAdmin ? 'Switch to Client View' : 'Switch to Admin View'}</span>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M17 3l4 4-4 4" />
                                            <path d="M3 7h18" />
                                            <path d="M7 21l-4-4 4-4" />
                                            <path d="M21 17H3" />
                                        </svg>
                                    </button>
                                    <div className="my-1 border-t border-[#dedfdf] dark:border-[#262626]" />
                                </>
                            )}


                            <button
                                type="button"
                                onClick={() => {
                                    history.push('/account');
                                    setUserMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] dark:hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                            >
                                User settings
                            </button>

                            {isAdmin && (
                                <a
                                    href="/admin"
                                    className="block w-full text-left px-4 py-2 hover:bg-[#f1f1f1] dark:hover:bg-[#1a1a1a] transition-colors cursor-pointer text-[#1a1a1a] dark:text-white no-underline"
                                >
                                    System settings
                                </a>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    history.push('/support');
                                    setUserMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] dark:hover:bg-[#1a1a1a] transition-colors flex items-center justify-between cursor-pointer"
                            >
                                <span>Inbox</span>
                                <span className="bg-[#2563eb] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                                    0
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    history.push('/support');
                                    setUserMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] dark:hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                            >
                                Support tickets
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    history.push('/billing');
                                    setUserMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] dark:hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                            >
                                Plans and pricing
                            </button>

                            <a
                                href="/legal/terms"
                                className="block w-full px-4 py-2 text-left hover:bg-[#f1f1f1] dark:hover:bg-[#1a1a1a] transition-colors text-[#1a1a1a] dark:text-white no-underline"
                            >
                                Terms and privacy
                            </a>

                            <div className="my-1 border-t border-[#dedfdf] dark:border-[#262626]" />

                            {/* Log out */}
                            <button
                                type="button"
                                onClick={onTriggerLogout}
                                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] dark:hover:bg-[#1a1a1a] transition-colors font-medium text-[#dc2626] cursor-pointer"
                            >
                                Log out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};