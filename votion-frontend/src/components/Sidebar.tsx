import React, { useEffect, useState } from 'react';
import { apiClient, type ApiNavigationUsage } from '../services/apiClient';

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse: () => void;
  onOpenCmdModal: (query?: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentView: string;
  onNavigate: (view: any) => void;
  userRole: 'admin' | 'client';
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onOpenCmdModal,
  searchQuery,
  onSearchChange,
  currentView,
  onNavigate,
  userRole,
  isMobileOpen,
  onCloseMobile,
}) => {
  const [essentialsOpen, setEssentialsOpen] = useState(true);
  const [navigationUsage, setNavigationUsage] = useState<ApiNavigationUsage[]>([]);
  const [hasLoadedNavigationUsage, setHasLoadedNavigationUsage] = useState(false);

  // Distinct SVGs & dedicated view keys corresponding 1:1 to Carta Ink Design System
  const adminNavItems = [
    { 
      title: 'Overview',
      key: 'overview',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path clipRule="evenodd" d="M1 9.387h8V1.387H1v8ZM13 1.387h8v8h-8v-8ZM21 12.613h-8v8h8v-8ZM9 20.613H1v-8h8v8Z" fillRule="evenodd"></path>
        </svg>
      )
    },
    {
      title: 'Virtual Machines',
      key: 'instances-qemu',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M2 3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm2 1v14h14V4H4zm2 2h10v2H6V6zm0 4h10v2H6v-2zm0 4h5v2H6v-2z"/>
        </svg>
      )
    },
    { 
      title: 'All Instances',
      key: 'instances',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path clipRule="evenodd" d="M18.8 6.55a5.55 5.55 0 1 1-11.1 0 5.55 5.55 0 0 1 11.1 0ZM13.25 3a3.55 3.55 0 1 0 0 7.1 3.55 3.55 0 0 0 0-7.1ZM1 13.9a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1ZM6.3 17.5a1 1 0 0 1 1-1h9.4a1 1 0 1 1 0 2H7.3a1 1 0 0 1-1-1Z" fillRule="evenodd"></path>
        </svg>
      )
    },
    
    {
      title: 'Billing Operations',
      key: 'billing-operations',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M4 3.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V5A1.5 1.5 0 0 1 4 3.5Zm0 2a.5.5 0 0 0-.5.5v1h15V6a.5.5 0 0 0-.5-.5H4Zm-.5 4v7a.5.5 0 0 0 .5.5h14a.5.5 0 0 0 .5-.5v-7h-15Z" />
          <path d="M6 12h4v2H6zm6 0h4v2h-4z" />
        </svg>
      )
    },
    {
      title: 'Ticket Management',
      key: 'support',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h9A2.5 2.5 0 0 1 18 5.5v7A2.5 2.5 0 0 1 15.5 15H10l-4.5 3V15.2A2.5 2.5 0 0 1 4 12.5v-7Z" />
          <path d="M7.5 8.5h7M7.5 11.5h4.5" />
        </svg>
      )
    },
    {
      title: 'Cluster Audit Logs',
      key: 'audit-logs',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path clipRule="evenodd" d="M4 2h10l4 4v14H4V2Zm10 2.5V7h2.5L14 4.5ZM6 10h10v2H6v-2Zm0 4h10v2H6v-2Zm0 4h6v2H6v-2Z" fillRule="evenodd"></path>
        </svg>
      )
    },
    {
      title: 'OS Reimage Requests',
      key: 'reimage-requests',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M11 2.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 11 2.5Zm0 15a6.5 6.5 0 1 1 6.5-6.5 6.51 6.51 0 0 1-6.5-6.5Z" />
          <path d="M10 6h2v6h-2zm0 7.5h2v2h-2z" />
        </svg>
      )
    },
    {
      title: 'Operator Reimage Console',
      key: 'operator-reimage',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M8.8 2.5a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6Zm0 2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6ZM14 13.5a1 1 0 0 0-1 1v2h-2v2h2v2h2v-2h2v-2h-2v-2a1 1 0 0 0-1-1Z" />
          <path d="M1.5 20.5a7.3 7.3 0 0 1 14.6 0h-2a5.3 5.3 0 0 0-10.6 0h-2Z" />
        </svg>
      )
    },
    { 
      title: 'Cluster Connections',
      key: 'proxmox-connections',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      title: 'User Management', 
      key: 'user-management',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      )
    },
    { 
      title: 'Router Manager', 
      key: 'ovh-manager',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="18" height="7" rx="2" ry="2" />
          <rect x="2" y="13" width="18" height="7" rx="2" ry="2" />
          <line x1="6" y1="5.5" x2="6.01" y2="5.5" />
          <line x1="6" y1="16.5" x2="6.01" y2="16.5" />
        </svg>
      )
    },
    { 
      title: 'System Settings', 
      key: 'system-settings',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>
        </svg>
      )
    },
  ];

  const clientNavItems = [
    { 
      title: 'Overview',
      key: 'overview',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path clipRule="evenodd" d="M1 9.387h8V1.387H1v8ZM13 1.387h8v8h-8v-8ZM21 12.613h-8v8h8v-8ZM9 20.613H1v-8h8v8Z" fillRule="evenodd"></path>
        </svg>
      )
    },
    {
      title: 'Virtual Machines',
      key: 'instances-qemu',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M2 3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm2 1v14h14V4H4zm2 2h10v2H6V6zm0 4h10v2H6v-2zm0 4h5v2H6v-2z"/>
        </svg>
      )
    },
    { 
      title: 'All Instances',
      key: 'instances',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path clipRule="evenodd" d="M18.8 6.55a5.55 5.55 0 1 1-11.1 0 5.55 5.55 0 0 1 11.1 0ZM13.25 3a3.55 3.55 0 1 0 0 7.1 3.55 3.55 0 0 0 0-7.1ZM1 13.9a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1ZM6.3 17.5a1 1 0 0 1 1-1h9.4a1 1 0 1 1 0 2H7.3a1 1 0 0 1-1-1Z" fillRule="evenodd"></path>
        </svg>
      )
    },
    {
      title: 'Support Tickets',
      key: 'support',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h9A2.5 2.5 0 0 1 18 5.5v7A2.5 2.5 0 0 1 15.5 15H10l-4.5 3V15.2A2.5 2.5 0 0 1 4 12.5v-7Z" />
          <path d="M7.5 8.5h7M7.5 11.5h4.5" />
        </svg>
      )
    },
    { 
      title: 'VNC Web Consoles', 
      key: 'client-instances-vnc',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M14 13.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 12.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM11 13.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
          <path clipRule="evenodd" d="M2 4h18v14H2V4zm16 12V6H4v10h14z" fillRule="evenodd"></path>
        </svg>
      )
    },
    { 
      title: 'Resource Metrics', 
      key: 'client-instances-metrics',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M2.54 10.68 7.92 5.3l3.85 3.84 6.6-6.6h-5.32V1H21v7.95h-1.54V3.63l-7.69 7.69-3.85-3.85-5.38 5.39v6.6H21V21H1V1h1.54z"></path>
        </svg>
      )
    },
    { 
      title: 'Network Firewall', 
      key: 'client-instances-firewall',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M11 2L2 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.89-7 10.02-3.87-1.13-7-5.35-7-10.02v-4.7l7-3.12zM11 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"></path>
        </svg>
      )
    },
    { 
      title: 'Snapshot Backups', 
      key: 'client-instances-backups',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M19.53 8.35C18.9 5.86 16.65 4 14 4c-1.87 0-3.51.98-4.43 2.45C9.07 6.16 8.55 6 8 6 6.34 6 5 7.34 5 9c0 .17.02.34.05.5C3.3 9.87 2 11.28 2 13c0 1.93 1.57 3.5 3.5 3.5h13.17c1.84 0 3.33-1.49 3.33-3.33 0-1.7-1.26-3.11-2.92-3.32h-.05C19.51 8.84 19.53 8.6 19.53 8.35zM14 5.5c2.08 0 3.88 1.45 4.38 3.47l.13.56.57.06c1.07.12 1.92 1.05 1.92 2.16 0 1.2-.97 2.17-2.17 2.17H5.5C4.4 13.86 3.5 12.96 3.5 11.86c0-1.07.83-1.95 1.88-2.03l.63-.05.15-.61c.15-.65.73-1.11 1.4-1.11.45 0 .86.2 1.15.54l.32.39.42-.25C10.22 7.74 12 6.55 14 5.5z"></path>
        </svg>
      )
    },
    {
      title: 'Reimage Requests',
      key: 'reimage-requests',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M11 2.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 11 2.5Zm0 15a6.5 6.5 0 1 1 6.5-6.5 6.51 6.51 0 0 1-6.5-6.5Z" />
          <path d="M10 6h2v6h-2zm0 7.5h2v2h-2z" />
        </svg>
      )
    },
    { 
      title: 'API Access Keys', 
      key: 'client-api-keys',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M12.65 3.35A5.5 5.5 0 0 0 4.5 10.7L1.35 13.85v3.65h3.65l1.05-1.05h2.1v-2.1l2.45-2.45a5.5 5.5 0 0 0 6.6-4.9c0-.44-.06-.88-.17-1.3l-2.43 2.43-2.1-2.1 2.43-2.43a5.5 5.5 0 0 0-1.3-.17ZM10.5 8.85l-4.1 4.1L3.85 15.5H2.85v-1l2.55-2.55 4.1-4.1a4 4 0 1 1 1 1Z" />
          <circle cx="15.5" cy="6.5" r="1.5" />
        </svg>
      )
    },
    { 
      title: 'SSH Public Keys', 
      key: 'client-ssh-keys',
      icon: (
        <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-5.5V11H7v2h3v1.5L13.5 12 10 9.5v1.5z"></path>
        </svg>
      )
    }
  ];


  const getVmPrefix = (connName?: string | null) => {
    if (!connName) return 'VM';
    return connName.match(/[A-Z]{2}/)?.[0] || 'VM';
  };

  const activeNavItems = userRole === 'admin' ? adminNavItems : clientNavItems;

    const defaultClientEssentials = [
    
    { title: 'VNC Console Access', key: 'client-instances-vnc' },
    { title: 'Resource Metrics', key: 'client-instances-metrics' },
    { title: 'Snapshot Backups', key: 'client-instances-backups' },
    { title: 'Network Firewall', key: 'client-instances-firewall' },
    { title: 'Support Center', key: 'support' },
    { title: 'Team Access', key: 'team-access' },
    { title: 'User Profile Settings', key: 'user-settings' },
  ];
  const destinationTitles: Record<string, string> = {
    'instances': 'All Instances',
    'instances-qemu': 'My Virtual Machines',
    
    'client-instances-vnc': 'VNC Console Access',
    'client-instances-metrics': 'Resource Metrics',
    'client-instances-firewall': 'Network Firewall',
    'client-instances-backups': 'Snapshot Backups',
    'support': 'Support Center',
    'team-access': 'Team Access',
    'user-settings': 'User Profile Settings',
  };

  const refreshNavigationUsage = () => {
    if (userRole !== 'client') return;
    void apiClient.getNavigationUsage()
      .then(items => setNavigationUsage(items))
      .catch(() => setNavigationUsage([]))
      .finally(() => setHasLoadedNavigationUsage(true));
  };

  useEffect(() => {
    setNavigationUsage([]);
    setHasLoadedNavigationUsage(userRole !== 'client');
    if (userRole !== 'client') return;
    refreshNavigationUsage();
    const handleUsageUpdate = () => refreshNavigationUsage();
    window.addEventListener('votion-navigation-usage', handleUsageUpdate);
    return () => window.removeEventListener('votion-navigation-usage', handleUsageUpdate);
  }, [userRole]);

  const personalizedClientEssentials = navigationUsage
    .filter(item => item.type === 'vm' || (item.key !== 'overview' && item.key !== 'instances' && item.key !== 'instances-qemu' && destinationTitles[item.key]))
    .map(item => item.type === 'vm'
      ? {
          title: item.name ? `${getVmPrefix(item.proxmoxConnectionName)}-${item.vmid} · ${item.name}` : `${getVmPrefix(item.proxmoxConnectionName)}-${item.vmid}`,
          key: item.proxmoxConnectionId ? `vm:${item.proxmoxConnectionId}:${item.vmid}` : `vm:${item.vmid}`,
        }
      : { title: destinationTitles[item.key], key: item.key })
    .filter((item, index, items) => items.findIndex(candidate => candidate.key === item.key) === index);
  const personalizedKeys = new Set(personalizedClientEssentials.map(item => item.key));
  const clientEssentials = [...personalizedClientEssentials, ...defaultClientEssentials.filter(item => !personalizedKeys.has(item.key))].slice(0, 5);
  const essentialsSublinks = userRole === 'admin' ? [
    
    
  ] : clientEssentials;

  const q = searchQuery.toLowerCase().trim();

  const filteredSublinks = essentialsSublinks.filter(s => !q || s.title.toLowerCase().includes(q));
  const isEssentialsMatch = essentialsSublinks.length > 0 && (!q || 'essentials'.includes(q) || filteredSublinks.length > 0);

  return (
    <aside className={`app-sidenav ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Top Search & Toggle */}
      <div className="sidenav-top-sticky flex items-center justify-between gap-1 w-full p-[14px]">
        <button type="button" className="mobile-sidebar-close" onClick={onCloseMobile} aria-label="Close navigation menu">×</button>
        {!isCollapsed && (
          <div 
            className="flex flex-1 items-center justify-between bg-[#f4f5f5] rounded h-[30px] px-2.5 cursor-pointer relative"
            onClick={() => onOpenCmdModal(searchQuery)}
          >
            <input
              type="text"
              placeholder="Navigate to..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onOpenCmdModal(searchQuery);
              }}
              className="bg-transparent border-none outline-none text-[13px] text-[#656b6b] placeholder-[#656b6b] w-full font-medium"
              onClick={(e) => e.stopPropagation()}
            />
            <span
              className="text-[12px] font-medium text-[#656b6b] bg-[#f4f5f5] pl-1 absolute right-2.5"
            >
              Ctrl+K
            </span>
          </div>
        )}

        {isCollapsed && (
          <button 
            className="collapsed-sidebar-control w-[30px] h-[30px] flex items-center justify-center text-[#1a1a1a] rounded transition-colors"
            onClick={() => onOpenCmdModal()}
            title="Search (Ctrl+K)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>
        )}

        <button
          className="collapsed-sidebar-control w-[30px] h-[30px] shrink-0 flex items-center justify-center text-[#1a1a1a] rounded transition-colors cursor-pointer"
          onClick={onToggleCollapse}
          title="Toggle Side Menu"
        >
          <svg aria-label="Close menu" height="16" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 7h9" />
            <path d="M11 12h9" />
            <path d="M11 17h9" />
            <path d="M7 16l-4-4 4-4" />
          </svg>
        </button>
      </div>

      {/* Nav List */}
      <ul className="sidenav-nav-groups" id="sidenav-nav-groups">
        
        {/* Main View Item */}
        {(!q || activeNavItems[0].title.toLowerCase().includes(q) || activeNavItems[0].key.includes(q) || 'overview'.includes(q) || 'instances'.includes(q)) && (
          <li className="sidenav-item">
            <div 
              onClick={() => onNavigate(activeNavItems[0].key)}
              className={`sidenav-link cursor-pointer ${currentView === activeNavItems[0].key ? 'active' : ''}`}
              title={activeNavItems[0].title}
            >
              <div className="sidenav-link-left">
                <span className="sidenav-icon">
                  {activeNavItems[0].icon}
                </span>
                <span className="sidenav-link-text">{activeNavItems[0].title}</span>
              </div>
            </div>
          </li>
        )}

        {/* Essentials Accordion */}
        {isEssentialsMatch && (
          <li className="sidenav-item">
            <div 
              onClick={() => setEssentialsOpen(!essentialsOpen)}
              className="sidenav-link cursor-pointer" 
              title="Essentials"
            >
              <div className="sidenav-link-left">
                <span className="sidenav-icon">
                  <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <title>Essentials</title>
                    <path clipRule="evenodd" d="M13.02 9.23H18l-7.08 11.66-.06.11H9.1v-8.2H4l.23-.38 6.86-11.3.06-.12h1.87z" fillRule="evenodd"></path>
                  </svg>
                </span>
                                <span className="sidenav-link-text">Essentials</span>

              </div>
              <svg 
                className={`sidenav-twiddle ${essentialsOpen || q ? 'open' : ''}`} 
                aria-hidden="true" 
                height="11" 
                viewBox="0 0 22 22" 
                width="11" 
                fill="currentColor"
              >
                <path d="m18.2 11.14-9.67 9.67-1.06-1.06 8.61-8.61-8.61-8.61 1.06-1.06 9.67 9.67Z"></path>
              </svg>
            </div>

            {/* Sublinks */}
            <ul className={`sidenav-subitems ${essentialsOpen || q ? 'open' : ''}`}>
              {filteredSublinks.map((sub) => (
                <li key={sub.title}>
                  <div 
                    onClick={() => onNavigate(sub.key)}
                    className={`sidenav-sublink cursor-pointer ${currentView === sub.key ? 'active' : ''}`}
                  >
                    {sub.title}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        )}

        {/* Other Active Items (Each with its distinct SVG icon and view key!) */}
        {activeNavItems.slice(1).map((item) => {
          if (q && !item.title.toLowerCase().includes(q)) return null;
          if (essentialsSublinks.some(sub => sub.key === item.key)) return null;
          return (
            <li key={item.title} className="sidenav-item">
              <div 
                onClick={() => onNavigate(item.key)}
                className={`sidenav-link cursor-pointer ${currentView === item.key ? 'active' : ''}`}
                title={item.title}
              >
                <div className="sidenav-link-left">
                  <span className="sidenav-icon">
                    {item.icon}
                  </span>
                  <span className="sidenav-link-text">{item.title}</span>
                </div>
              </div>
            </li>
          );
        })}

        {!q && <li className="sidenav-section-label">MORE</li>}

        {/* User Settings in MORE section */}
        {(!q || 'user settings'.includes(q) || 'login & security'.includes(q)) && (
          <li className="sidenav-item">
            <div 
              onClick={() => onNavigate('user-settings')}
              className={`sidenav-link cursor-pointer ${currentView === 'user-settings' ? 'active' : ''}`}
              title="User Settings"
            >
              <div className="sidenav-link-left">
                <span className="sidenav-icon">
                  <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path clipRule="evenodd" d="M11 1.613a9.387 9.387 0 1 0 0 18.774 9.387 9.387 0 0 0 0-18.774ZM3.613 11a7.387 7.387 0 1 1 14.774 0 7.387 7.387 0 0 1-14.774 0Zm7.387-4a1 1 0 0 0-1 1v2H8a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2V8a1 1 0 0 0-1-1Z" fillRule="evenodd"></path>
                  </svg>
                </span>
                <span className="sidenav-link-text">User Settings</span>
              </div>
            </div>
          </li>
        )}

        {/* System Settings for Admin in MORE section */}
        {userRole === 'admin' && (!q || 'system settings'.includes(q) || 'cluster settings'.includes(q)) && (
          <li className="sidenav-item">
            <div 
              onClick={() => onNavigate('system-settings')}
              className={`sidenav-link cursor-pointer ${currentView === 'system-settings' ? 'active' : ''}`}
              title="System Settings"
            >
              <div className="sidenav-link-left">
                <span className="sidenav-icon">
                  <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="currentColor">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </span>
                <span className="sidenav-link-text">System Settings</span>
              </div>
            </div>
          </li>
        )}

        {/* Support Tickets for Client in MORE section */}
        {userRole === 'client' && (!q || 'support tickets'.includes(q) || 'help'.includes(q)) && (
          <li className="sidenav-item">
            <div 
              onClick={() => onNavigate('support')}
              className={`sidenav-link cursor-pointer ${currentView === 'support' ? 'active' : ''}`}
              title="Support Tickets"
            >
              <div className="sidenav-link-left">
                <span className="sidenav-icon">
                  <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h9A2.5 2.5 0 0 1 18 5.5v7A2.5 2.5 0 0 1 15.5 15H10l-4.5 3V15.2A2.5 2.5 0 0 1 4 12.5v-7Z" />
                    <path d="M7.5 8.5h7M7.5 11.5h4.5" />
                  </svg>
                </span>
                <span className="sidenav-link-text">Support Tickets</span>
              </div>
            </div>
          </li>
        )}


      </ul>
    </aside>
  );
};
