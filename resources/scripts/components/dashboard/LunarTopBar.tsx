import React, { useState, useRef, useEffect } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { useHistory } from 'react-router-dom';
import http from '@/api/http';

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
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [tasksList, setTasksList] = useState<any[]>([]);

    const menuRef = useRef<HTMLDivElement>(null);
    const taskRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                    <div className="theme-brand-logo h-[31px] border-[3px] border-[#1a1a1a] dark:border-[#3f3f46] bg-white dark:bg-[#0a0a0a] px-3.5 text-base font-extrabold lowercase tracking-tight flex items-center justify-center text-[#1a1a1a] dark:text-[#ededed] select-none transition-transform group-hover:scale-[1.02] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                        votion
                    </div>
                    <span className="text-[#c4c7c7] dark:text-[#383838] text-sm select-none font-light">/</span>
                    <span className="font-sans text-[17px] sm:text-[18px] font-bold text-[#1a1a1a] dark:text-white tracking-tight select-none leading-none">
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
                {/* ALERT RULES (Admin only) */}
                {isAdmin && (
                    <button
                        type="button"
                        onClick={() => history.push('/audit-logs')}
                        className="header-alert-control cursor-pointer hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f1f1f1] dark:hover:bg-[#161616] transition-colors border border-transparent hover:border-[#dedfdf] dark:hover:border-[#262626]"
                        title="Manage alert thresholds and audit rules"
                        aria-label="Manage alert rules"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="4" y1="21" x2="4" y2="14" />
                            <line x1="4" y1="10" x2="4" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12" y2="3" />
                            <line x1="20" y1="21" x2="20" y2="16" />
                            <line x1="20" y1="12" x2="20" y2="3" />
                            <line x1="1" y1="14" x2="7" y2="14" />
                            <line x1="9" y1="8" x2="15" y2="8" />
                            <line x1="17" y1="16" x2="23" y2="16" />
                        </svg>
                        <span>Alert Rules</span>
                    </button>
                )}

                {/* NOTIFICATION BELL */}
                <div className="header-notification-wrap relative" ref={notifRef}>
                    <button
                        type="button"
                        onClick={() => {
                            setNotificationsOpen(!notificationsOpen);
                            setTasksOpen(false);
                            setUserMenuOpen(false);
                        }}
                        className="header-notification-control w-8 h-8 flex items-center justify-center rounded-md border border-[#dedfdf] dark:border-[#262626] text-[#1a1a1a] dark:text-white hover:bg-[#f1f1f1] dark:hover:bg-[#161616] transition-colors cursor-pointer relative"
                        title="Notifications"
                        aria-label="View notifications"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                            <div className="py-6 text-center text-[#656b6b] dark:text-[#a0a0a0]">
                                <span className="text-xl mb-1 block">✓</span>
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
                            setUserMenuOpen(false);
                        }}
                        className="header-task-control header-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f1f1f1] dark:hover:bg-[#161616] transition-colors cursor-pointer border border-transparent hover:border-[#dedfdf] dark:hover:border-[#262626]"
                    >
                        <span>Tasks</span>
                        {activeBadgeCount > 0 && (
                            <span className="task-count bg-[#1a1a1a] dark:bg-white text-white dark:text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center" aria-label={`${activeBadgeCount} active tasks`}>
                                {activeBadgeCount}
                            </span>
                        )}
                        <svg
                            className={`transition-transform duration-200 ${tasksOpen ? 'rotate-180' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
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
                            <div className="tasks-empty-state py-6 text-center text-[#656b6b] dark:text-[#a0a0a0]">
                                <span className="text-xl mb-1 block">✓</span>
                                <p className="font-semibold text-xs text-[#1a1a1a] dark:text-white">No active tasks</p>
                                <span className="text-[11px]">Background work and container provisioning will appear here.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* DOWNLOADS BUTTON */}
                <button
                    type="button"
                    onClick={() => onOpenCmd?.('downloads')}
                    className="header-secondary-control header-link hidden lg:inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f1f1f1] dark:hover:bg-[#161616] transition-colors cursor-pointer"
                >
                    <span>Downloads</span>
                </button>

                {/* UPGRADE LINK */}
                <button
                    type="button"
                    onClick={() => history.push('/billing')}
                    className="header-secondary-control header-link hidden lg:inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f1f1f1] dark:hover:bg-[#161616] transition-colors cursor-pointer"
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
                        }}
                        className={`header-user-trigger flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                            userMenuOpen
                                ? 'border-[#1a1a1a] dark:border-white bg-[#f1f1f1] dark:bg-[#161616] text-[#1a1a1a] dark:text-white'
                                : 'border-transparent text-[#1a1a1a] dark:text-white hover:bg-[#f1f1f1] dark:hover:bg-[#161616]'
                        }`}
                    >
                        <span>{currentUserName}</span>
                        <svg
                            className={`transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
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