import React, { useState } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { useHistory, useLocation, useRouteMatch } from 'react-router-dom';
import { ServerContext } from '@/state/server';

interface SidebarProps {
    onOpenCmd?: (q?: string) => void;
    isMobileOpen?: boolean;
    onCloseMobile?: () => void;
}

interface ServerNavProps {
    serverId: string;
    isCollapsed: boolean;
    onNavigate: (p: string) => void;
    locationPathname: string;
    searchQuery: string;
}

const ServerNavigationItems = ({
    serverId,
    isCollapsed,
    onNavigate,
    locationPathname,
    searchQuery,
}: ServerNavProps) => {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const isMinecraft = Boolean(server?.isMinecraft);
    const isSamp = Boolean(server?.isSamp);
    const isFiveM = Boolean(server?.isFiveM);
    const q = searchQuery.toLowerCase().trim();

    const baseItems = [
        {
            name: 'Console',
            path: `/server/${serverId}`,
            exact: true,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
            ),
        },
        {
            name: 'File Manager',
            path: `/server/${serverId}/files`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M2 4a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l1.414 1.414a1 1 0 0 0 .707.293H18a2 2 0 0 1 2 2v1H2V4zm0 3h18v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z" />
                </svg>
            ),
        },
        {
            name: 'Databases',
            path: `/server/${serverId}/databases`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="11" cy="5" rx="8" ry="3" />
                    <path d="M3 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
                    <path d="M3 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
                </svg>
            ),
        },
        {
            name: 'Schedules',
            path: `/server/${serverId}/schedules`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <polyline points="11 6 11 11 15 13" />
                </svg>
            ),
        },
        {
            name: 'Users & Subusers',
            path: `/server/${serverId}/users`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
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
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M19.53 8.35C18.9 5.86 16.65 4 14 4c-1.87 0-3.51.98-4.43 2.45C9.07 6.16 8.55 6 8 6 6.34 6 5 7.34 5 9c0 .17.02.34.05.5C3.3 9.87 2 11.28 2 13c0 1.93 1.57 3.5 3.5 3.5h13.17c1.84 0 3.33-1.49 3.33-3.33 0-1.7-1.26-3.11-2.92-3.32h-.05C19.51 8.84 19.53 8.6 19.53 8.35zM14 5.5c2.08 0 3.88 1.45 4.38 3.47l.13.56.57.06c1.07.12 1.92 1.05 1.92 2.16 0 1.2-.97 2.17-2.17 2.17H5.5C4.4 13.86 3.5 12.96 3.5 11.86c0-1.07.83-1.95 1.88-2.03l.63-.05.15-.61c.15-.65.73-1.11 1.4-1.11.45 0 .86.2 1.15.54l.32.39.42-.25C10.22 7.74 12 6.55 14 5.5z" />
                </svg>
            ),
        },
        {
            name: 'Network & Ports',
            path: `/server/${serverId}/network`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="18" height="7" rx="2" ry="2" />
                    <rect x="2" y="13" width="18" height="7" rx="2" ry="2" />
                    <line x1="6" y1="5.5" x2="6.01" y2="5.5" />
                    <line x1="6" y1="16.5" x2="6.01" y2="16.5" />
                </svg>
            ),
        },
        {
            name: 'Custom Domains',
            path: `/server/${serverId}/domains`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="3" y1="11" x2="19" y2="11" />
                    <path d="M11 3a13 13 0 0 1 3.5 8 13 13 0 0 1-3.5 8 13 13 0 0 1-3.5-8 13 13 0 0 1 3.5-8z" />
                </svg>
            ),
        },
        {
            name: 'Startup Variables',
            path: `/server/${serverId}/startup`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M13 2L3 13h7l-2 7 10-11h-7l2-7z" />
                </svg>
            ),
        },
        {
            name: 'Server Settings',
            path: `/server/${serverId}/settings`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            ),
        },
        {
            name: 'Activity Logs',
            path: `/server/${serverId}/activity`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path clipRule="evenodd" d="M4 2h10l4 4v14H4V2Zm10 2.5V7h2.5L14 4.5ZM6 10h10v2H6v-2Zm0 4h10v2H6v-2Zm0 4h6v2H6v-2Z" fillRule="evenodd" />
                </svg>
            ),
        },
        {
            name: 'Notes & Scratchpad',
            path: `/server/${serverId}/notes`,
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                </svg>
            ),
        },
    ];

    const minecraftItems = isMinecraft
        ? [
              {
                  name: 'JAR / Versions',
                  path: `/server/${serverId}/versions`,
                  icon: (
                      <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                          <line x1="6" y1="8" x2="10" y2="8" />
                          <line x1="6" y1="12" x2="18" y2="12" />
                      </svg>
                  ),
              },
              {
                  name: 'Plugins & Mods',
                  path: `/server/${serverId}/plugins`,
                  icon: (
                      <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19.439 7.85c0-1.571-1.28-2.85-2.85-2.85h-1.59V3.41C15 2.08 13.92 1 12.59 1s-2.41 1.08-2.41 2.41V5H8.59C7.02 5 5.74 6.28 5.74 7.85v1.59H4.15C2.82 9.44 1.74 10.52 1.74 11.85s1.08 2.41 2.41 2.41h1.59v1.59c0 1.57 1.28 2.85 2.85 2.85h1.59v1.59c0 1.33 1.08 2.41 2.41 2.41s2.41-1.08 2.41-2.41V18.7h1.59c1.57 0 2.85-1.28 2.85-2.85v-1.59h1.59c1.33 0 2.41-1.08 2.41-2.41s-1.08-2.41-2.41-2.41h-1.59V7.85z" />
                      </svg>
                  ),
              },
              {
                  name: 'Player Manager',
                  path: `/server/${serverId}/players`,
                  icon: (
                      <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                  ),
              },
              {
                  name: 'World Manager',
                  path: `/server/${serverId}/worlds`,
                  icon: (
                      <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                  ),
              },
              {
                  name: 'Bedrock Addons',
                  path: `/server/${serverId}/addons`,
                  icon: (
                      <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                          <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                  ),
              },
          ]
        : [];

    const sampItems = isSamp
        ? [
              {
                  name: 'Pawn Compiler',
                  path: `/server/${serverId}/samp/compiler`,
                  icon: (
                      <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="16 18 22 12 16 6" />
                          <polyline points="8 6 2 12 8 18" />
                      </svg>
                  ),
              },
          ]
        : [];

    const fivemItems = isFiveM
        ? [
              {
                  name: 'Player Manager',
                  path: `/server/${serverId}/players`,
                  icon: (
                      <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                  ),
              },
          ]
        : [];

    const filteredBase = baseItems.filter((i) => !q || i.name.toLowerCase().includes(q));
    const filteredMinecraft = minecraftItems.filter((i) => !q || i.name.toLowerCase().includes(q));
    const filteredSamp = sampItems.filter((i) => !q || i.name.toLowerCase().includes(q));
    const filteredFivem = fivemItems.filter((i) => !q || i.name.toLowerCase().includes(q));

    return (
        <>
            {filteredBase.map((item) => {
                const active = item.exact ? locationPathname === item.path : locationPathname.startsWith(item.path);
                return (
                    <li key={item.name} className="sidenav-item">
                        <div
                            onClick={() => onNavigate(item.path)}
                            className={`sidenav-link cursor-pointer px-4 py-2 text-sm font-medium flex items-center justify-between transition-colors ${
                                active
                                    ? 'bg-[#f1f1f1] dark:bg-[#161616] font-semibold text-[#1a1a1a] dark:text-white border-l-[3px] border-[#1a1a1a] dark:border-white pl-[13px]'
                                    : 'text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#161616] hover:text-[#1a1a1a] dark:hover:text-white'
                            }`}
                            title={item.name}
                        >
                            <div className="sidenav-link-left flex items-center gap-3">
                                <span className="sidenav-icon w-4 h-4 flex items-center justify-center shrink-0">
                                    {item.icon}
                                </span>
                                {!isCollapsed && <span className="sidenav-link-text truncate">{item.name}</span>}
                            </div>
                        </div>
                    </li>
                );
            })}

            {filteredMinecraft.length > 0 && (
                <>
                    {!isCollapsed && (
                        <li className="px-4 pt-3.5 pb-1 text-[10px] font-bold tracking-wider uppercase text-[#888888] dark:text-[#555555] select-none">
                            Minecraft Tools
                        </li>
                    )}
                    {isCollapsed && <li className="my-2 mx-3 border-t border-[#e0e0e0] dark:border-[#222222]" />}
                    {filteredMinecraft.map((item) => {
                        const active = locationPathname.startsWith(item.path);
                        return (
                            <li key={item.name} className="sidenav-item">
                                <div
                                    onClick={() => onNavigate(item.path)}
                                    className={`sidenav-link cursor-pointer px-4 py-2 text-sm font-medium flex items-center justify-between transition-colors ${
                                        active
                                            ? 'bg-[#f1f1f1] dark:bg-[#161616] font-semibold text-[#1a1a1a] dark:text-white border-l-[3px] border-[#10B981] dark:border-[#10B981] pl-[13px]'
                                            : 'text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#161616] hover:text-[#1a1a1a] dark:hover:text-white'
                                    }`}
                                    title={item.name}
                                >
                                    <div className="sidenav-link-left flex items-center gap-3">
                                        <span className="sidenav-icon w-4 h-4 flex items-center justify-center shrink-0 text-emerald-500">
                                            {item.icon}
                                        </span>
                                        {!isCollapsed && <span className="sidenav-link-text truncate">{item.name}</span>}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </>
            )}

            {filteredSamp.length > 0 && (
                <>
                    {!isCollapsed && (
                        <li className="px-4 pt-3.5 pb-1 text-[10px] font-bold tracking-wider uppercase text-[#888888] dark:text-[#555555] select-none">
                            SA-MP Tools
                        </li>
                    )}
                    {isCollapsed && <li className="my-2 mx-3 border-t border-[#e0e0e0] dark:border-[#222222]" />}
                    {filteredSamp.map((item) => {
                        const active = locationPathname.startsWith(item.path);
                        return (
                            <li key={item.name} className="sidenav-item">
                                <div
                                    onClick={() => onNavigate(item.path)}
                                    className={`sidenav-link cursor-pointer px-4 py-2 text-sm font-medium flex items-center justify-between transition-colors ${
                                        active
                                            ? 'bg-[#f1f1f1] dark:bg-[#161616] font-semibold text-[#1a1a1a] dark:text-white border-l-[3px] border-[#10B981] dark:border-[#10B981] pl-[13px]'
                                            : 'text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#161616] hover:text-[#1a1a1a] dark:hover:text-white'
                                    }`}
                                    title={item.name}
                                >
                                    <div className="sidenav-link-left flex items-center gap-3">
                                        <span className="sidenav-icon w-4 h-4 flex items-center justify-center shrink-0 text-emerald-500">
                                            {item.icon}
                                        </span>
                                        {!isCollapsed && <span className="sidenav-link-text truncate">{item.name}</span>}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </>
            )}

            {filteredFivem.length > 0 && (
                <>
                    {!isCollapsed && (
                        <li className="px-4 pt-3.5 pb-1 text-[10px] font-bold tracking-wider uppercase text-[#888888] dark:text-[#555555] select-none">
                            FiveM Tools
                        </li>
                    )}
                    {isCollapsed && <li className="my-2 mx-3 border-t border-[#e0e0e0] dark:border-[#222222]" />}
                    {filteredFivem.map((item) => {
                        const active = locationPathname.startsWith(item.path);
                        return (
                            <li key={item.name} className="sidenav-item">
                                <div
                                    onClick={() => onNavigate(item.path)}
                                    className={`sidenav-link cursor-pointer px-4 py-2 text-sm font-medium flex items-center justify-between transition-colors ${
                                        active
                                            ? 'bg-[#f1f1f1] dark:bg-[#161616] font-semibold text-[#1a1a1a] dark:text-white border-l-[3px] border-[#10B981] dark:border-[#10B981] pl-[13px]'
                                            : 'text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#161616] hover:text-[#1a1a1a] dark:hover:text-white'
                                    }`}
                                    title={item.name}
                                >
                                    <div className="sidenav-link-left flex items-center gap-3">
                                        <span className="sidenav-icon w-4 h-4 flex items-center justify-center shrink-0 text-emerald-500">
                                            {item.icon}
                                        </span>
                                        {!isCollapsed && <span className="sidenav-link-text truncate">{item.name}</span>}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </>
            )}
        </>
    );
};

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
            title: 'Overview',
            adminOnly: false,
            path: '/',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path clipRule="evenodd" d="M1 9.387h8V1.387H1v8ZM13 1.387h8v8h-8v-8ZM21 12.613h-8v8h8v-8ZM9 20.613H1v-8h8v8Z" fillRule="evenodd" />
                </svg>
            ),
        },
        {
            title: 'Game Servers',
            adminOnly: false,
            path: '/instances',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M2 3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm2 1v14h14V4H4zm2 2h10v2H6V6zm0 4h10v2H6v-2zm0 4h5v2H6v-2z" />
                </svg>
            ),
        },
        {
            title: isAdmin ? 'Billing Operations' : 'Billing and Renewals',
            adminOnly: false,
            path: isAdmin ? '/billing-operations' : '/billing',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M4 3.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V5A1.5 1.5 0 0 1 4 3.5Zm0 2a.5.5 0 0 0-.5.5v1h15V6a.5.5 0 0 0-.5-.5H4Zm-.5 4v7a.5.5 0 0 0 .5.5h14a.5.5 0 0 0 .5-.5v-7h-15Z" />
                    <path d="M6 12h4v2H6zm6 0h4v2h-4z" />
                </svg>
            ),
        },
        {
            title: 'Ticket Management',
            adminOnly: false,
            path: '/support',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h9A2.5 2.5 0 0 1 18 5.5v7A2.5 2.5 0 0 1 15.5 15H10l-4.5 3V15.2A2.5 2.5 0 0 1 4 12.5v-7Z" />
                    <path d="M7.5 8.5h7M7.5 11.5h4.5" />
                </svg>
            ),
        },
        {
            title: 'Node Audit Logs',
            adminOnly: true,
            path: '/audit-logs',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path clipRule="evenodd" d="M4 2h10l4 4v14H4V2Zm10 2.5V7h2.5L14 4.5ZM6 10h10v2H6v-2Zm0 4h10v2H6v-2Zm0 4h6v2H6v-2Z" fillRule="evenodd" />
                </svg>
            ),
        },
        {
            title: 'OS Reinstall Requests',
            adminOnly: true,
            path: '/reimage-requests',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M11 2.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 11 2.5Zm0 15a6.5 6.5 0 1 1 6.5-6.5 6.51 6.51 0 0 1-6.5-6.5Z" />
                    <path d="M10 6h2v6h-2zm0 7.5h2v2h-2z" />
                </svg>
            ),
        },
        {
            title: 'Cluster Connections',
            adminOnly: true,
            path: '/proxmox-connections',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
            ),
        },
        {
            title: 'User Management',
            adminOnly: true,
            path: '/user-management',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
            ),
        },
        {
            title: 'Router Manager',
            adminOnly: true,
            path: '/ovh-manager',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="18" height="7" rx="2" ry="2" />
                    <rect x="2" y="13" width="18" height="7" rx="2" ry="2" />
                    <line x1="6" y1="5.5" x2="6.01" y2="5.5" />
                    <line x1="6" y1="16.5" x2="6.01" y2="16.5" />
                </svg>
            ),
        },
        {
            title: 'System Settings',
            adminOnly: true,
            path: '/system-settings',
            icon: (
                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            ),
        },
    ];

    const activeNavItems = adminNavItems.filter((i) => !i.adminOnly || isAdmin);
    const q = searchQuery.toLowerCase().trim();

    const essentialsSublinks = [
        {
            title: 'Active Game Servers',
            path: '/instances',
            exact: false,
        },
        {
            title: isAdmin ? 'Billing Operations' : 'Invoices & Renewals',
            path: isAdmin ? '/billing-operations' : '/billing',
            exact: false,
        },
        {
            title: 'Support Tickets',
            path: '/support',
            exact: false,
        },
        {
            title: 'Account Settings',
            path: '/account',
            exact: true,
        },
        {
            title: 'API Credentials',
            path: '/account/api',
            exact: false,
        },
        {
            title: 'SSH Key Pairs',
            path: '/account/ssh',
            exact: false,
        },
    ];

    const filteredEssentials = essentialsSublinks.filter((s) => !q || s.title.toLowerCase().includes(q));

    return (
        <aside
            id="lunar-sidebar-nav"
            className={`app-sidenav ${
                isMobileOpen
                    ? 'mobile-open fixed inset-y-0 !top-0 !bottom-0 left-0 z-[250] w-72 max-w-[85vw] shadow-2xl flex !translate-x-0 !transform-none !visible !opacity-100 md:relative md:!top-auto md:!bottom-auto md:z-30 md:w-60 md:min-w-[15rem] md:max-w-[15rem]'
                    : 'hidden md:flex md:w-60 md:min-w-[15rem] md:max-w-[15rem]'
            } bg-white dark:bg-[#050505] border-r border-[#dedfdf] dark:border-[#262626] flex-col justify-between h-full select-none font-sans transition-all duration-200 ${
                isCollapsed ? 'md:!w-16 md:!min-w-[4rem]' : ''
            }`}
            aria-label="Main Navigation"
        >
            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                {/* Top Search & Toggle Sticky Header */}
                <div className={`sidenav-top-sticky flex items-center justify-between gap-1 w-full p-[14px] border-b border-[#dedfdf] dark:border-[#262626] ${isCollapsed ? 'flex-col gap-2' : ''}`}>
                    {isServerView ? (
                        isCollapsed ? (
                            <button
                                type="button"
                                onClick={() => history.push('/')}
                                className="w-[30px] h-[30px] shrink-0 flex items-center justify-center bg-[#f4f5f5] dark:bg-[#0a0a0a] hover:bg-[#dedfdf] dark:hover:bg-[#161616] rounded text-[#1a1a1a] dark:text-white transition-colors cursor-pointer"
                                title="Back to Servers"
                                aria-label="Back to Servers"
                            >
                                <span className="text-sm font-bold">←</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => history.push('/')}
                                className="flex-1 flex items-center gap-2 bg-[#f4f5f5] dark:bg-[#0a0a0a] hover:bg-[#dedfdf] dark:hover:bg-[#161616] rounded px-2.5 py-1 text-xs font-semibold text-[#1a1a1a] dark:text-white transition-colors cursor-pointer"
                                aria-label="Back to Servers"
                            >
                                <span aria-hidden="true">←</span>
                                <span>Back to Servers</span>
                            </button>
                        )
                    ) : !isCollapsed ? (
                        <div
                            className="flex flex-1 items-center justify-between bg-[#f4f5f5] dark:bg-[#0a0a0a] rounded h-[30px] px-2.5 cursor-pointer relative"
                            onClick={() => onOpenCmd?.(searchQuery)}
                        >
                            <input
                                type="text"
                                placeholder="Navigate to..."
                                aria-label="Navigate to server or command (Ctrl+K)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onOpenCmd?.(searchQuery);
                                }}
                                className="bg-transparent border-none outline-none text-[13px] text-[#1a1a1a] dark:text-white placeholder-[#656b6b] w-full font-medium"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-[11px] font-medium text-[#656b6b] pl-1 absolute right-2.5">
                                Ctrl+K
                            </span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="collapsed-sidebar-control w-[30px] h-[30px] flex items-center justify-center text-[#1a1a1a] dark:text-white rounded hover:bg-[#f4f5f5] dark:hover:bg-[#161616] transition-colors cursor-pointer"
                            onClick={() => onOpenCmd?.()}
                            title="Search (Ctrl+K)"
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                            </svg>
                        </button>
                    )}

                    {/* Collapse Toggle Button (Desktop only) */}
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="collapsed-sidebar-control hidden md:flex w-[30px] h-[30px] shrink-0 items-center justify-center text-[#1a1a1a] dark:text-white rounded hover:bg-[#f4f5f5] dark:hover:bg-[#161616] transition-colors cursor-pointer"
                        title={isCollapsed ? 'Expand Menu' : 'Collapse Menu'}
                        aria-label={isCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
                    >
                        <svg aria-label="Toggle menu" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d={isCollapsed ? 'M13 7h-9M13 12h-9M13 17h-9M17 16l4-4-4-4' : 'M11 7h9M11 12h9M11 17h9M7 16l-4-4 4-4'} />
                        </svg>
                    </button>

                    {/* Mobile Drawer Close Button */}
                    {onCloseMobile && (
                        <button
                            type="button"
                            onClick={onCloseMobile}
                            className="md:hidden w-[30px] h-[30px] shrink-0 flex items-center justify-center text-[#1a1a1a] dark:text-white rounded hover:bg-[#f4f5f5] dark:hover:bg-[#161616] transition-colors cursor-pointer text-sm font-bold"
                            aria-label="Close navigation drawer"
                        >
                            <svg className={'w-4 h-4'} fill={'none'} stroke={'currentColor'} viewBox={'0 0 24 24'}>
                                <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={2} d={'M6 18L18 6M6 6l12 12'} />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Sidenav Items List */}
                <ul className="sidenav-nav-groups p-0 m-0 list-none" id="sidenav-nav-groups">
                    {isServerView ? (
                        <ServerNavigationItems
                            serverId={serverId!}
                            isCollapsed={isCollapsed}
                            onNavigate={onNavigate}
                            locationPathname={location.pathname}
                            searchQuery={searchQuery}
                        />
                    ) : (
                        /* ROOT / INFRASTRUCTURE MENU */
                        <>
                            {/* 1. OVERVIEW (First Item) */}
                            {activeNavItems[0] && (!q || activeNavItems[0].title.toLowerCase().includes(q) || 'overview'.includes(q)) && (
                                <li key={activeNavItems[0].title} className="sidenav-item">
                                    <div
                                        onClick={() => onNavigate(activeNavItems[0].path)}
                                        className={`sidenav-link cursor-pointer px-4 py-2 text-sm font-medium flex items-center justify-between transition-colors ${
                                            location.pathname === '/'
                                                ? 'bg-[#f1f1f1] dark:bg-[#161616] font-semibold text-[#1a1a1a] dark:text-white border-l-[3px] border-[#1a1a1a] dark:border-white pl-[13px]'
                                                : 'text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#161616] hover:text-[#1a1a1a] dark:hover:text-white'
                                        }`}
                                        title={activeNavItems[0].title}
                                    >
                                        <div className="sidenav-link-left flex items-center gap-3 min-w-0">
                                            <span className="sidenav-icon w-4 h-4 flex items-center justify-center shrink-0">
                                                {activeNavItems[0].icon}
                                            </span>
                                            {!isCollapsed && <span className="sidenav-link-text truncate">{activeNavItems[0].title}</span>}
                                        </div>
                                    </div>
                                </li>
                            )}

                            {/* 2. ESSENTIALS SECTION ACCORDION (Immediately After Overview) */}
                            {(!q || filteredEssentials.length > 0) && (
                                <li className="sidenav-item mt-0.5">
                                    <div
                                        onClick={() => {
                                            if (isCollapsed) {
                                                setIsCollapsed(false);
                                                setEssentialsOpen(true);
                                            } else {
                                                setEssentialsOpen((prev) => !prev);
                                            }
                                        }}
                                        className="sidenav-link cursor-pointer px-4 py-2 text-sm font-medium flex items-center justify-between text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#161616] hover:text-[#1a1a1a] dark:hover:text-white transition-colors select-none"
                                        title="Essentials"
                                        role="button"
                                        tabIndex={0}
                                        aria-expanded={essentialsOpen}
                                    >
                                        <div className="sidenav-link-left flex items-center gap-3 min-w-0">
                                            <span className="sidenav-icon w-4 h-4 flex items-center justify-center shrink-0">
                                                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                                                    <path clipRule="evenodd" d="M13.02 9.23H18l-7.08 11.66-.06.11H9.1v-8.2H4l.23-.38 6.86-11.3.06-.12h1.87z" fillRule="evenodd" />
                                                </svg>
                                            </span>
                                            {!isCollapsed && <span className="sidenav-link-text truncate">Essentials</span>}
                                        </div>
                                        {!isCollapsed && (
                                            <svg
                                                className={`sidenav-twiddle ${essentialsOpen || q ? 'open' : ''}`}
                                                aria-hidden="true"
                                                height="11"
                                                viewBox="0 0 22 22"
                                                width="11"
                                                fill="currentColor"
                                            >
                                                <path d="m18.2 11.14-9.67 9.67-1.06-1.06 8.61-8.61-8.61-8.61 1.06-1.06 9.67 9.67Z" />
                                            </svg>
                                        )}
                                    </div>

                                    {!isCollapsed && (essentialsOpen || q) && (
                                        <ul
                                            className="sidenav-subitems open !block list-none p-0 m-0"
                                            style={{ display: 'block' }}
                                        >
                                            {filteredEssentials.map((sub) => {
                                                const active = sub.exact
                                                    ? location.pathname === sub.path
                                                    : location.pathname.startsWith(sub.path);
                                                return (
                                                    <li key={sub.title}>
                                                        <div
                                                            onClick={() => onNavigate(sub.path)}
                                                            className={`sidenav-sublink cursor-pointer ${active ? 'active' : ''}`}
                                                            title={sub.title}
                                                        >
                                                            {sub.title}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>
                            )}

                            {/* 3. REMAINING ACTIVE NAV ITEMS (Game Servers, Billing, Tickets, Admin...) */}
                            {activeNavItems.slice(1).map((item) => {
                                if (q && !item.title.toLowerCase().includes(q)) return null;
                                const active = location.pathname.startsWith(item.path);
                                return (
                                    <li key={item.title} className="sidenav-item">
                                        <div
                                            onClick={() => onNavigate(item.path)}
                                            className={`sidenav-link cursor-pointer px-4 py-2 text-sm font-medium flex items-center justify-between transition-colors ${
                                                active
                                                    ? 'bg-[#f1f1f1] dark:bg-[#161616] font-semibold text-[#1a1a1a] dark:text-white border-l-[3px] border-[#1a1a1a] dark:border-white pl-[13px]'
                                                    : 'text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#161616] hover:text-[#1a1a1a] dark:hover:text-white'
                                            }`}
                                            title={item.title}
                                        >
                                            <div className="sidenav-link-left flex items-center gap-3 min-w-0">
                                                <span className="sidenav-icon w-4 h-4 flex items-center justify-center shrink-0">
                                                    {item.icon}
                                                </span>
                                                {!isCollapsed && <span className="sidenav-link-text truncate">{item.title}</span>}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}

                            {/* MORE SECTION */}
                            {!q && (
                                <li className="sidenav-section-label border-t border-[#dedfdf] dark:border-[#262626] mt-3 pt-3 px-4 pb-1 text-[11px] font-bold text-[#656b6b] dark:text-[#a0a0a0] uppercase tracking-wider">
                                    {!isCollapsed && 'MORE'}
                                </li>
                            )}

                            {/* User Settings in MORE */}
                            {(!q || 'user settings'.includes(q) || 'account'.includes(q)) && (
                                <li className="sidenav-item">
                                    <div
                                        onClick={() => onNavigate('/account')}
                                        className={`sidenav-link cursor-pointer px-4 py-2 text-sm font-medium flex items-center justify-between transition-colors ${
                                            location.pathname.startsWith('/account')
                                                ? 'bg-[#f1f1f1] dark:bg-[#161616] font-semibold text-[#1a1a1a] dark:text-white border-l-[3px] border-[#1a1a1a] dark:border-white pl-[13px]'
                                                : 'text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#161616] hover:text-[#1a1a1a] dark:hover:text-white'
                                        }`}
                                        title="User Settings"
                                    >
                                        <div className="sidenav-link-left flex items-center gap-3">
                                            <span className="sidenav-icon w-4 h-4 flex items-center justify-center shrink-0">
                                                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                                                    <path clipRule="evenodd" d="M11 1.613a9.387 9.387 0 1 0 0 18.774 9.387 9.387 0 0 0 0-18.774ZM3.613 11a7.387 7.387 0 1 1 14.774 0 7.387 7.387 0 0 1-14.774 0Zm7.387-4a1 1 0 0 0-1 1v2H8a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2V8a1 1 0 0 0-1-1Z" fillRule="evenodd" />
                                                </svg>
                                            </span>
                                            {!isCollapsed && <span className="sidenav-link-text">User Settings</span>}
                                        </div>
                                    </div>
                                </li>
                            )}

                            {/* System Settings for Admin in MORE */}
                            {isAdmin && (!q || 'system settings'.includes(q) || 'admin'.includes(q)) && (
                                <li className="sidenav-item">
                                    <div
                                        onClick={() => {
                                            window.location.href = '/admin';
                                        }}
                                        className="sidenav-link cursor-pointer px-4 py-2 text-sm font-medium flex items-center justify-between text-[#656b6b] dark:text-[#a0a0a0] hover:bg-[#f1f1f1] dark:hover:bg-[#161616] hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
                                        title="System Administration"
                                    >
                                        <div className="sidenav-link-left flex items-center gap-3">
                                            <span className="sidenav-icon w-4 h-4 flex items-center justify-center shrink-0">
                                                <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                                                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            </span>
                                            {!isCollapsed && <span className="sidenav-link-text">Admin Console</span>}
                                        </div>
                                    </div>
                                </li>
                            )}
                        </>
                    )}
                </ul>
            </div>
        </aside>
    );
};
