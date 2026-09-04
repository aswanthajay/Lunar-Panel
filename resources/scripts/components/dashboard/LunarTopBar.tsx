import { useUserRole } from '@/plugins/useUserRole';
import React, { useState, useRef, useEffect } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { Link, useHistory } from 'react-router-dom';
import http from '@/api/http';

interface HeaderProps {
    onOpenCmd?: (q?: string) => void;
    isMobileNavOpen?: boolean;
    onToggleMobileNav?: () => void;
}

export default ({ onOpenCmd, isMobileNavOpen, onToggleMobileNav }: HeaderProps) => {
    const history = useHistory();
    const user = useStoreState((state: ApplicationStore) => state.user.data);
    const { isAdmin, toggleRole, rootAdmin } = useUserRole();

    const [tasksOpen, setTasksOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
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

    return (
        <header
            className="h-[54px] flex items-center justify-between px-4 sm:px-6 relative z-30 select-none text-[#F3F4F6] font-sans"
            style={{
                backgroundColor: '#09090b',
                borderBottom: '1px solid #242424',
            }}
            role="banner"
        >
            {/* Header Left: Mobile Drawer Trigger, Brand Logo & Lunar Panel Title */}
            <div className="flex items-center gap-2.5 sm:gap-3">
                {onToggleMobileNav && (
                    <button
                        type="button"
                        onClick={onToggleMobileNav}
                        aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        aria-expanded={isMobileNavOpen}
                        aria-controls="lunar-sidebar-nav"
                        className="md:hidden flex items-center justify-center w-9 h-9 rounded-md text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#18181b] border border-[#27272a] transition-all duration-150 active:scale-95 cursor-pointer bg-transparent"
                    >
                        {isMobileNavOpen ? (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        )}
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => history.push('/')}
                    className="brand-logo cursor-pointer bg-transparent border-none p-0 flex items-center gap-3 transition-transform duration-100 active:scale-95"
                    title="Lunar Panel"
                    aria-label="Go to Lunar Panel Dashboard"
                >
                    <div className="border border-[#3f3f46] bg-[#000000] text-[#FFFFFF] px-2.5 py-0.5 text-sm font-extrabold lowercase tracking-tight flex items-center justify-center rounded">
                        votion
                    </div>
                </button>

                <div className="flex items-center gap-2.5">
                    <span className="text-[#3f3f46] text-sm select-none">/</span>
                    <h2 className="font-serif text-base font-normal text-[#FFFFFF] tracking-tight m-0 select-none">
                        Lunar Panel
                    </h2>
                </div>

                {/* Role Switcher */}
                {rootAdmin && (
                    <button
                        type="button"
                        onClick={toggleRole}
                        className={`ml-2 px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-95 border cursor-pointer ${
                            isAdmin
                                ? 'bg-[#062419] text-[#10B981] border-[#064E3B] hover:bg-[#083324]'
                                : 'bg-[#141416] text-[#A0A0A0] border-[#27272a] hover:bg-[#18181b] hover:text-[#FFFFFF] hover:border-[#3f3f46]'
                        }`}
                        title={isAdmin ? 'Switch to Client Mode (Simulate customer view)' : 'Switch to Admin Mode (Full cluster controls)'}
                        aria-label={isAdmin ? 'Switch to Client Mode' : 'Switch to Admin Mode'}
                        role="switch"
                        aria-checked={isAdmin}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3" />
                        </svg>
                        <span>{isAdmin ? 'Admin Mode' : 'Client Mode'}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-[#10B981] animate-pulse' : 'bg-[#656B6B]'}`} aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Header Right: Tasks, Notifications, User Profile */}
            <div className="flex items-center gap-3">
                {/* Tasks Button */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            setTasksOpen(!tasksOpen);
                            setUserMenuOpen(false);
                        }}
                        aria-label="Active background tasks"
                        aria-expanded={tasksOpen}
                        aria-haspopup="dialog"
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer border ${
                            tasksOpen
                                ? 'bg-[#18181b] text-[#FFFFFF] border-[#3f3f46]'
                                : 'bg-[#141416] text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]'
                        }`}
                    >
                        {/* List / tasks icon */}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <polyline points="3 6 4 7 6 5" />
                            <polyline points="3 12 4 13 6 11" />
                            <polyline points="3 18 4 19 6 17" />
                        </svg>
                        <span className="font-sans">Tasks</span>
                        {/* Live count badge */}
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#062419] border border-[#10B981]/40 text-[#10B981] text-[9px] font-mono font-semibold leading-none">
                            1
                        </span>
                    </button>

                    {tasksOpen && (
                        <div
                            className="motion-dropdown absolute right-0 top-[calc(100%+6px)] w-80 bg-[#000000] border border-[#1F1F1F] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-50 overflow-hidden"
                            role="dialog"
                            aria-label="Active Tasks"
                        >
                            {/* Panel Header */}
                            <div className="bg-[#050505] border-b border-[#141414] px-4 py-3 flex items-center justify-between">
                                <span className="font-serif text-sm font-normal text-[#FFFFFF] tracking-tight">Active Tasks</span>
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#10B981]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" aria-hidden="true" />
                                    1 Running
                                </span>
                            </div>

                            {/* Task Rows */}
                            <div className="p-2 flex flex-col gap-1">
                                {/* Row: Cluster Telemetry Sync */}
                                <div className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg bg-[#050505] hover:bg-[#080808] border border-[#141414] hover:border-[#1F1F1F] transition-all duration-150 group">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        {/* Animated status dot */}
                                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse shrink-0" aria-hidden="true" />
                                        <div className="min-w-0">
                                            <p className="font-mono text-[11px] text-[#FFFFFF] font-medium m-0 truncate">
                                                Cluster Telemetry Sync
                                            </p>
                                            <p className="text-[10px] text-[#525252] font-sans mt-0.5 m-0">
                                                Syncing hardware gauges every 15s
                                            </p>
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-[#10B981] bg-[#051F14] border border-[#10B981]/25 px-1.5 py-0.5 rounded-full mt-0.5">
                                        Active
                                    </span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t border-[#0D0D0D] px-4 py-2.5">
                                <p className="text-[10px] font-mono text-[#3A3A3A] m-0">
                                    Background tasks managed by the Votion scheduler
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Notifications Bell */}
                <button
                    type="button"
                    onClick={() => onOpenCmd && onOpenCmd()}
                    className="p-1.5 text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#121212] rounded-md transition-all duration-100 active:scale-90 cursor-pointer bg-transparent border-none"
                    title="Command Palette (Ctrl+K)"
                    aria-label="Command Palette and Notifications (Ctrl+K)"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </button>

                {/* User Menu Trigger */}
                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => {
                            setUserMenuOpen(!userMenuOpen);
                            setTasksOpen(false);
                        }}
                        aria-label={`User account menu for ${user?.username || 'lunaradmin'}`}
                        aria-expanded={userMenuOpen}
                        aria-haspopup="menu"
                        className="flex items-center gap-2 hover:bg-[#121212] px-2 py-1 rounded-md transition-all duration-150 active:scale-95 cursor-pointer bg-transparent border border-transparent hover:border-[#262626]"
                    >
                        <div className="w-6 h-6 rounded-full bg-[#1A1A1A] border border-[#262626] flex items-center justify-center font-mono text-[10px] text-[#FFFFFF] font-bold" aria-hidden="true">
                            {user?.username?.substring(0, 2).toUpperCase() || 'LU'}
                        </div>
                        <span className="text-xs font-medium text-[#FFFFFF] hidden sm:inline">{user?.username || 'lunaradmin'}</span>
                        <svg className="w-3.5 h-3.5 text-[#656B6B]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>

                    {userMenuOpen && (
                        <div
                            className="motion-dropdown absolute right-0 top-10 w-60 bg-[#0A0A0A] border border-[#1F1F1F] rounded-md shadow-2xl py-1.5 z-50 text-xs"
                            role="menu"
                            aria-label="User Account Menu"
                        >
                            <div className="px-3 py-2 border-b border-[#1A1A1A]">
                                <p className="font-semibold text-[#FFFFFF] truncate m-0">{user?.username}</p>
                                <p className="text-[#707070] text-[11px] truncate m-0 font-mono mt-0.5">{user?.email}</p>
                            </div>

                            <div className="py-1" role="none">
                                <Link
                                    to="/account"
                                    onClick={() => setUserMenuOpen(false)}
                                    className="block px-3 py-1.5 text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#141414] transition-colors no-underline"
                                    role="menuitem"
                                >
                                    User Settings
                                </Link>
                                <Link
                                    to="/account/api"
                                    onClick={() => setUserMenuOpen(false)}
                                    className="block px-3 py-1.5 text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#141414] transition-colors no-underline"
                                    role="menuitem"
                                >
                                    API Credentials
                                </Link>
                                <Link
                                    to="/account/ssh"
                                    onClick={() => setUserMenuOpen(false)}
                                    className="block px-3 py-1.5 text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#1A1A1A] transition-colors no-underline"
                                    role="menuitem"
                                >
                                    SSH Public Keys
                                </Link>
                                <Link
                                    to="/account/activity"
                                    onClick={() => setUserMenuOpen(false)}
                                    className="block px-3 py-1.5 text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#1A1A1A] transition-colors no-underline"
                                    role="menuitem"
                                >
                                    Account Activity
                                </Link>
                            </div>

                            {rootAdmin && (
                                <div className="border-t border-[#262626] py-1" role="none">
                                    <a
                                        href="/admin"
                                        className="block px-3 py-1.5 text-[#10B981] hover:bg-[#1A1A1A] transition-colors no-underline font-medium"
                                        role="menuitem"
                                    >
                                        Administration
                                    </a>
                                </div>
                            )}

                            <div className="border-t border-[#262626] pt-1" role="none">
                                <button
                                    onClick={onTriggerLogout}
                                    className="block w-full text-left px-3 py-1.5 text-[#EF4444] hover:bg-[#1A1A1A] transition-colors cursor-pointer bg-transparent border-none text-xs"
                                    role="menuitem"
                                    aria-label="Log out of account"
                                >
                                    Log out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};