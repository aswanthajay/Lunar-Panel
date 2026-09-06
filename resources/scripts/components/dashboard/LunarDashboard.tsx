import React, { useState, useMemo, useEffect } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { useHistory } from 'react-router-dom';
import http, { PaginatedResult } from '@/api/http';
import { Server } from '@/api/server/getServer';
import { ProductActionModal } from './product-panels/ProductActionModal';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { getTickets, Ticket } from '@/api/tickets';
import { formatDistanceToNow } from 'date-fns';
import { useStoreState } from '@/state/hooks';

const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) return '';
    try {
        return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
        return timestamp;
    }
};

const formatDateDisplay = (dateString?: string | null) => {
    if (!dateString || dateString.toLowerCase() === 'never') return 'None pending';
    try {
        const clean = dateString.includes('T') ? dateString.split('T')[0] : dateString;
        const [yyyy, mm, dd] = clean.split('-');
        if (yyyy && mm && dd) {
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        }
        return dateString;
    } catch {
        return dateString;
    }
};

const formatEventName = (event?: string, description?: string | null) => {
    if (description) return description;
    if (!event) return 'Activity logged';
    const eventMap: Record<string, string> = {
        'auth:login': 'Account logged in',
        'auth:success': 'Authentication successful',
        'auth:checkpoint': 'Two-factor checkpoint passed',
        'auth:register': 'New account registered',
        'server:power.start': 'Server instance started',
        'server:power.stop': 'Server instance stopped',
        'server:power.restart': 'Server instance restarted',
        'server:power.kill': 'Server instance killed',
        'server:file.upload': 'File uploaded to server',
        'server:file.delete': 'File deleted from server',
        'server:file.write': 'File edited on server',
        'server:backup.create': 'Server backup created',
        'server:backup.delete': 'Server backup deleted',
        'server:command': 'Console command executed',
        'server:reinstall': 'Server reinstalled',
        'account:profile.update': 'Profile updated',
        'account:password.update': 'Password changed',
        'account:email.update': 'Email address changed',
        'account:api-key.create': 'API credential generated',
        'account:api-key.delete': 'API credential revoked',
    };
    if (eventMap[event]) return eventMap[event];
    return event.replace(/[:._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

interface Props {
    servers: PaginatedResult<Server>;
    rootAdmin?: boolean;
    showOnlyAdmin?: boolean;
    setShowOnlyAdmin?: any;
}

export default ({ servers }: Props) => {
    const history = useHistory();
    const { isAdmin } = useUserRole();
    const user = useStoreState((state) => state.user.data);
    const serverList = servers?.items || [];
    const [selectedServer, setSelectedServer] = useState<Server | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Dynamic operations hub state
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [activityLoading, setActivityLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        getTickets()
            .then((data) => {
                if (isMounted) {
                    setTickets(data || []);
                    setTicketsLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) setTicketsLoading(false);
            });

        http.get('/api/client/account/activity', { params: { per_page: 3 } })
            .then(({ data }) => {
                if (isMounted) {
                    setActivityLogs(data?.data || []);
                    setActivityLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) setActivityLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const openTickets = useMemo(() => {
        return (tickets || []).filter((t) => t.status !== 'closed');
    }, [tickets]);

    const serversWithExpiry = useMemo(() => {
        return serverList
            .filter((s: any) => s.expires_at && s.expires_at !== 'never')
            .sort((a: any, b: any) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());
    }, [serverList]);

    const nextDueDate = useMemo(() => {
        const next = serversWithExpiry[0];
        return next ? formatDateDisplay((next as any).expires_at) : 'None pending';
    }, [serversWithExpiry]);

    const suspendedServers = useMemo(() => {
        return serverList.filter((s) => s.status === 'suspended');
    }, [serverList]);

    const telemetry = useMemo(() => {
        let totalCpu = 0;
        let totalMemory = 0;
        let totalDisk = 0;
        let runningCount = 0;

        serverList.forEach((server) => {
            totalCpu += server.limits.cpu || 0;
            totalMemory += server.limits.memory || 0;
            totalDisk += server.limits.disk || 0;
            if (!server.status && !server.isNodeUnderMaintenance) {
                runningCount++;
            }
        });

        return {
            totalInstances: serverList.length,
            runningCount,
            totalCpu,
            totalMemory,
            totalDisk,
        };
    }, [serverList]);

    const filteredServers = useMemo(() => {
        if (!searchQuery.trim()) return serverList;
        const q = searchQuery.toLowerCase();
        return serverList.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.id.toLowerCase().includes(q) ||
                (s.node && s.node.toLowerCase().includes(q))
        );
    }, [serverList, searchQuery]);

    return (
        <div className="w-full font-sans select-none pb-12">
            {/* Header: Editorial Page title with SangBleu / Newsreader serif */}
            <div className="mb-7 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#dedfdf] dark:border-[#262626] pb-5">
                <div>
                    <h1 className="page-heading text-3xl sm:text-4xl font-serif font-normal text-[#1a1a1a] dark:text-white tracking-tight m-0">
                        {isAdmin ? 'Admin Infrastructure Overview' : 'My Servers Overview'}
                    </h1>
                    <p className="text-xs text-[#656b6b] dark:text-[#a0a0a0] font-sans mt-1.5 m-0 leading-relaxed">
                        {isAdmin
                            ? 'Live cluster telemetry, node capacity, and provisioned instances across the entire fleet.'
                            : 'Live telemetry, resource utilization, and management for your active game server instances.'}
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => history.push('/instances')}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 bg-white dark:bg-[#0a0a0a] text-[#1a1a1a] dark:text-[#ededed] border border-[#dedfdf] dark:border-[#262626] hover:bg-[#f5f5f5] dark:hover:bg-[#161616] hover:border-[#a7aaaa] dark:hover:border-[#383838] shadow-xs"
                    >
                        <span>{isAdmin ? 'View All Servers' : 'View Game Servers'}</span>
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* ---------- LEFT: TELEMETRY & INSTANCES ---------- */}
                <section className="flex-1 min-w-0 w-full space-y-6">
                    {/* Node & Game Telemetry Bento */}
                    <div className="ink-block-wrapper bg-white dark:bg-black border border-[#dedfdf] dark:border-[#262626] rounded-xl overflow-hidden shadow-xs">
                        <div className="ink-block-header bg-white dark:bg-black border-b border-[#dedfdf] dark:border-[#262626] px-5 py-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="font-serif font-semibold text-sm text-[#1a1a1a] dark:text-white tracking-tight">
                                    {isAdmin ? 'Cluster Telemetry' : 'Resource Allocation'}
                                </span>
                                <span className="text-[#a7aaaa] dark:text-[#52525b] text-xs select-none">/</span>
                                <span className="text-[11px] font-mono text-[#656b6b] dark:text-[#a0a0a0]">
                                    {isAdmin ? 'Production Fleet' : 'My Servers'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                                <span className="text-[10px] font-mono text-[#656b6b] dark:text-[#a0a0a0] uppercase tracking-wider">Sync: Live 15s</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#dedfdf] dark:divide-[#262626] bg-white dark:bg-black">
                            {/* Stat 1: Online Servers */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#656b6b] dark:text-[#a0a0a0] block">
                                        Online Servers
                                    </span>
                                    <div className="text-2xl font-mono font-bold text-[#1a1a1a] dark:text-white mt-1.5">
                                        {telemetry.runningCount}{' '}
                                        <span className="text-xs font-normal text-[#656b6b] dark:text-[#a0a0a0]">/ {telemetry.totalInstances} active</span>
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1.5 w-full bg-[#f1f1f1] dark:bg-[#262626] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#10b981] rounded-full transition-all duration-500"
                                            style={{
                                                width: telemetry.totalInstances > 0
                                                    ? `${Math.round((telemetry.runningCount / telemetry.totalInstances) * 100)}%`
                                                    : '0%',
                                            }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#656b6b] dark:text-[#a0a0a0] mt-1 block">
                                        {telemetry.totalInstances > 0
                                            ? `${Math.round((telemetry.runningCount / telemetry.totalInstances) * 100)}% online`
                                            : '0% online'}
                                    </span>
                                </div>
                            </div>

                            {/* Stat 2: Allocated CPU */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#656b6b] dark:text-[#a0a0a0] block">
                                        Allocated CPU
                                    </span>
                                    <div className="text-2xl font-mono font-bold text-[#1a1a1a] dark:text-white mt-1.5">
                                        {telemetry.totalCpu}%
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1.5 w-full bg-[#f1f1f1] dark:bg-[#262626] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#2563eb] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, telemetry.totalCpu / 2)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#656b6b] dark:text-[#a0a0a0] mt-1 block">
                                        Assigned compute limit
                                    </span>
                                </div>
                            </div>

                            {/* Stat 3: Committed RAM */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#656b6b] dark:text-[#a0a0a0] block">
                                        Committed RAM
                                    </span>
                                    <div className="text-2xl font-mono font-bold text-[#1a1a1a] dark:text-white mt-1.5">
                                        {(telemetry.totalMemory / 1024).toFixed(1)}{' '}
                                        <span className="text-xs font-normal text-[#656b6b] dark:text-[#a0a0a0]">GB</span>
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1.5 w-full bg-[#f1f1f1] dark:bg-[#262626] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#8b5cf6] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, (telemetry.totalMemory / 8192) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#656b6b] dark:text-[#a0a0a0] mt-1 block">
                                        Dedicated memory
                                    </span>
                                </div>
                            </div>

                            {/* Stat 4: Storage Pool */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#656b6b] dark:text-[#a0a0a0] block">
                                        Storage Pool
                                    </span>
                                    <div className="text-2xl font-mono font-bold text-[#1a1a1a] dark:text-white mt-1.5">
                                        {(telemetry.totalDisk / 1024).toFixed(1)}{' '}
                                        <span className="text-xs font-normal text-[#656b6b] dark:text-[#a0a0a0]">GB</span>
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1.5 w-full bg-[#f1f1f1] dark:bg-[#262626] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#f59e0b] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, (telemetry.totalDisk / 32768) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#656b6b] dark:text-[#a0a0a0] mt-1 block">
                                        NVMe / ZFS Pool
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Active Game Servers List */}
                    <div className="ink-block-wrapper bg-white dark:bg-black border border-[#dedfdf] dark:border-[#262626] rounded-xl overflow-hidden shadow-xs">
                        <div className="ink-block-header bg-white dark:bg-black border-b border-[#dedfdf] dark:border-[#262626] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <span className="font-serif font-semibold text-sm text-[#1a1a1a] dark:text-white tracking-tight">
                                    {isAdmin ? 'All Active Game Servers' : 'My Active Game Servers'}
                                </span>
                                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#f1f1f1] dark:bg-[#1a1a1a] text-[#1a1a1a] dark:text-white border border-[#dedfdf] dark:border-[#383838]">
                                    {filteredServers.length}
                                </span>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search game servers..."
                                    className="border border-[#dedfdf] dark:border-[#262626] hover:border-[#a7aaaa] dark:hover:border-[#52525b] focus:border-[#2563eb] rounded-lg px-3 py-1.5 text-xs text-[#1a1a1a] dark:text-white bg-white dark:bg-black outline-none w-56 font-mono placeholder-[#a7aaaa] transition-colors"
                                />
                            </div>
                        </div>

                        <div className="p-5 bg-[#fbfaf9] dark:bg-black">
                            {filteredServers.length === 0 ? (
                                <div className="py-12 text-center text-xs text-[#656b6b] dark:text-[#a0a0a0] font-sans">
                                    No game servers deployed or matching search.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredServers.map((server) => {
                                        const primaryAlloc = server.allocations?.[0];
                                        const host = primaryAlloc?.alias || primaryAlloc?.ip;
                                        const port = primaryAlloc?.port;
                                        const isSuspended = server.status === 'suspended' || server.isNodeUnderMaintenance;
                                        const isStarting = server.status === 'installing' || server.status === 'restoring_backup';

                                        return (
                                            <div
                                                key={server.id}
                                                className="bg-white dark:bg-black p-5 rounded-xl border border-[#dedfdf] dark:border-[#262626] hover:border-[#a7aaaa] dark:hover:border-[#404040] transition-all duration-150 flex flex-col justify-between group relative shadow-xs w-full"
                                            >
                                                <div>
                                                    {/* Header: Title & Status Beacon */}
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-base font-serif font-medium text-[#1a1a1a] dark:text-white truncate m-0 tracking-tight">
                                                                {server.name}
                                                            </h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[11px] font-mono text-[#656b6b] dark:text-[#a0a0a0]">
                                                                    Node: {server.node || 'Local Node'}
                                                                </span>
                                                                <span className="text-[#dedfdf] dark:text-[#383838] text-xs">&bull;</span>
                                                                <span className="text-[11px] font-mono text-[#a7aaaa] dark:text-[#656b6b]">
                                                                    {server.id}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Refined Carta Ink Status Pill */}
                                                        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium shrink-0 bg-[#f5f5f5] dark:bg-[#0a0a0a] border border-[#dedfdf] dark:border-[#222222] text-[#1a1a1a] dark:text-[#ededed]">
                                                            <span className="relative flex h-2 w-2">
                                                                {isSuspended ? (
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                                                ) : isStarting ? (
                                                                    <>
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                                                    </>
                                                                )}
                                                            </span>
                                                            <span className="text-[11px] tracking-tight">
                                                                {isSuspended ? 'Suspended' : isStarting ? 'Starting' : 'Running'}
                                                            </span>
                                                        </span>
                                                    </div>

                                                    {/* Endpoint Address */}
                                                    {host && (
                                                        <div className="mb-4">
                                                            <CopyOnClick text={`${host}:${port}`}>
                                                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#fbfaf9] dark:bg-black border border-[#dedfdf] dark:border-[#262626] hover:border-[#a7aaaa] dark:hover:border-[#52525b] font-mono text-xs text-[#1a1a1a] dark:text-white cursor-pointer transition-all duration-100 active:scale-95">
                                                                    <span>{host}:{port}</span>
                                                                    <svg className="w-3 h-3 text-[#656b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                    </svg>
                                                                </div>
                                                            </CopyOnClick>
                                                        </div>
                                                    )}

                                                    {/* 3-Column Resource Limits */}
                                                    <div className="grid grid-cols-3 gap-3 py-3 border-t border-[#dedfdf] dark:border-[#262626] text-xs font-mono mb-4">
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-[#656b6b] dark:text-[#a0a0a0] uppercase tracking-wider block">
                                                                CPU Limit
                                                            </span>
                                                            <span className="text-sm font-bold text-[#1a1a1a] dark:text-white mt-0.5 block">
                                                                {server.limits.cpu}%
                                                            </span>
                                                            <div className="h-1.5 w-full bg-[#f1f1f1] dark:bg-[#262626] rounded-full overflow-hidden mt-1.5">
                                                                <div className="h-full bg-[#2563eb] rounded-full" style={{ width: `${Math.min(100, server.limits.cpu / 2)}%` }} />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-[#656b6b] dark:text-[#a0a0a0] uppercase tracking-wider block">
                                                                Memory
                                                            </span>
                                                            <span className="text-sm font-bold text-[#1a1a1a] dark:text-white mt-0.5 block">
                                                                {server.limits.memory} <span className="text-2xs text-[#656b6b]">MB</span>
                                                            </span>
                                                            <div className="h-1.5 w-full bg-[#f1f1f1] dark:bg-[#262626] rounded-full overflow-hidden mt-1.5">
                                                                <div className="h-full bg-[#8b5cf6] rounded-full" style={{ width: `${Math.min(100, (server.limits.memory / 4096) * 100)}%` }} />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-[#656b6b] dark:text-[#a0a0a0] uppercase tracking-wider block">
                                                                Storage
                                                            </span>
                                                            <span className="text-sm font-bold text-[#1a1a1a] dark:text-white mt-0.5 block">
                                                                {server.limits.disk} <span className="text-2xs text-[#656b6b]">MB</span>
                                                            </span>
                                                            <div className="h-1.5 w-full bg-[#f1f1f1] dark:bg-[#262626] rounded-full overflow-hidden mt-1.5">
                                                                <div className="h-full bg-[#f59e0b] rounded-full" style={{ width: `${Math.min(100, (server.limits.disk / 16384) * 100)}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card Actions Footer: Cohesive Button Pair with Proper Gap & Left Status */}
                                                <div className="w-full flex items-center justify-between gap-2 pt-3.5 border-t border-[#dedfdf] dark:border-[#262626] mt-auto">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#656b6b] dark:text-[#a0a0a0] min-w-0 truncate">
                                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSuspended ? 'bg-red-500' : isStarting ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                        <span className="truncate">{isSuspended ? 'Action Required' : isStarting ? 'Provisioning' : 'Operational'}</span>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedServer(server);
                                                                setIsDetailsModalOpen(true);
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 inline-flex items-center justify-center whitespace-nowrap shrink-0 bg-white dark:bg-[#0a0a0a] text-[#1a1a1a] dark:text-[#ededed] border border-[#dedfdf] dark:border-[#262626] hover:bg-[#f5f5f5] dark:hover:bg-[#161616] hover:border-[#a7aaaa] dark:hover:border-[#383838]"
                                                        >
                                                            Details
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => history.push(`/server/${server.id}`)}
                                                            className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 bg-[#1a1a1a] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-[#ededed] border border-transparent shadow-xs active:scale-[0.98]"
                                                        >
                                                            <span>Console</span>
                                                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ---------- RIGHT: OPERATIONS HUB (1:1 Votion Rail) ---------- */}
                <aside className="w-full lg:w-[320px] max-w-full lg:max-w-[340px] bg-white dark:bg-black border border-[#dedfdf] dark:border-[#262626] rounded-xl overflow-hidden shrink-0 shadow-xs">
                    {/* 1. Open Tickets */}
                    <div className="bg-white dark:bg-black border-b border-[#dedfdf] dark:border-[#262626] px-4 py-3 flex items-center justify-between">
                        <span className="font-serif font-semibold text-xs text-[#1a1a1a] dark:text-white flex items-center gap-2">
                            Open tickets
                            <span className="bg-[#f1f1f1] dark:bg-[#141414] text-[#1a1a1a] dark:text-[#a0a0a0] border border-[#dedfdf] dark:border-[#262626] text-[10px] font-mono px-2 py-0.5 rounded-full">
                                {openTickets.length}
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={() => history.push('/support')}
                            className="text-[11px] font-mono text-[#2563eb] hover:underline cursor-pointer bg-transparent border-none p-0"
                        >
                            + New
                        </button>
                    </div>

                    {ticketsLoading ? (
                        <div className="px-4 py-3.5 border-b border-[#dedfdf] dark:border-[#262626] text-center text-xs text-[#656b6b] dark:text-[#a0a0a0] font-mono animate-pulse">
                            Checking support queue...
                        </div>
                    ) : openTickets.length > 0 ? (
                        openTickets.slice(0, 2).map((ticket) => (
                            <div
                                key={ticket.id}
                                onClick={() => history.push('/support')}
                                className="px-4 py-3.5 border-b border-[#dedfdf] dark:border-[#262626] hover:bg-[#fbfaf9] dark:hover:bg-[#111111] transition-colors cursor-pointer"
                            >
                                <div className="py-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] text-[#656b6b] dark:text-[#a0a0a0]">
                                            #T-{ticket.ticket_id || ticket.id}
                                        </span>
                                        <span className="text-xs flex-1 truncate text-[#1a1a1a] dark:text-white font-medium">
                                            {ticket.title}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#f1f1f1] dark:bg-[#0a0a0a] border border-[#dedfdf] dark:border-[#222222] text-[10px] font-mono text-[#1a1a1a] dark:text-[#ededed]">
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                    ticket.status === 'open'
                                                        ? 'bg-emerald-500'
                                                        : ticket.status === 'answered'
                                                        ? 'bg-purple-500'
                                                        : 'bg-blue-500'
                                                }`}
                                            />
                                            {ticket.status === 'in_progress' ? 'In Progress' : ticket.status}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0] mt-1.5 m-0 font-sans">
                                        {ticket.department} &bull; Updated {formatRelativeTime(ticket.updated_at || ticket.created_at)}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-4 border-b border-[#dedfdf] dark:border-[#262626] text-center">
                            <p className="text-xs text-[#656b6b] dark:text-[#a0a0a0] m-0">No active support tickets.</p>
                            <button
                                type="button"
                                onClick={() => history.push('/support')}
                                className="mt-1.5 text-xs text-[#2563eb] hover:underline font-medium cursor-pointer bg-transparent border-none p-0"
                            >
                                Open a ticket &rarr;
                            </button>
                        </div>
                    )}

                    {/* 2. Account & Billing */}
                    <div className="bg-white dark:bg-black border-b border-[#dedfdf] dark:border-[#262626] px-4 py-3 flex items-center justify-between">
                        <span className="font-serif font-semibold text-xs text-[#1a1a1a] dark:text-white">Account &amp; billing</span>
                        <button
                            type="button"
                            onClick={() => history.push('/billing')}
                            className="text-[11px] font-mono text-[#2563eb] hover:underline cursor-pointer bg-transparent border-none p-0"
                        >
                            Manage &rarr;
                        </button>
                    </div>

                    <div className="px-4 py-3.5 border-b border-[#dedfdf] dark:border-[#262626] space-y-2.5 text-xs font-mono">
                        <div className="flex justify-between items-center">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">Next renewal due</span>
                            <span className="text-[#1a1a1a] dark:text-white font-medium">{nextDueDate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">Active instances</span>
                            <span className="text-[#1a1a1a] dark:text-white font-medium">{serverList.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">Suspended instances</span>
                            <span className={`font-medium ${suspendedServers.length > 0 ? 'text-amber-500' : 'text-[#15803d] dark:text-[#4ade80]'}`}>
                                {suspendedServers.length}
                            </span>
                        </div>

                        {suspendedServers.length > 0 ? (
                            <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed font-sans flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    {suspendedServers.length} server(s) suspended.
                                </span>
                                <button
                                    type="button"
                                    onClick={() => history.push('/billing')}
                                    className="text-xs font-semibold underline ml-1 cursor-pointer bg-transparent border-none p-0 text-amber-800 dark:text-amber-200"
                                >
                                    Renew now &rarr;
                                </button>
                            </div>
                        ) : (
                            <div className="mt-2.5 rounded-lg border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#0a0a0a] px-3 py-2 text-[11px] text-[#656b6b] dark:text-[#a0a0a0] leading-relaxed font-sans flex items-center gap-2">
                                <span className="text-emerald-500 font-bold">✓</span>
                                <span>Billing account in good standing. All compute nodes cleared.</span>
                            </div>
                        )}
                    </div>

                    {/* 3. Incidents & Audit */}
                    <div className="bg-white dark:bg-black border-b border-[#dedfdf] dark:border-[#262626] px-4 py-3 flex items-center justify-between">
                        <span className="font-serif font-semibold text-xs text-[#1a1a1a] dark:text-white">Incidents &amp; audit</span>
                        <button
                            type="button"
                            onClick={() => history.push(isAdmin ? '/audit-logs' : '/account/activity')}
                            className="text-[11px] font-mono text-[#2563eb] hover:underline cursor-pointer bg-transparent border-none p-0"
                        >
                            View all &rarr;
                        </button>
                    </div>

                    <div className="px-4 py-3.5 space-y-3">
                        {activityLoading ? (
                            <div className="py-2 text-center text-xs text-[#656b6b] dark:text-[#a0a0a0] font-mono animate-pulse">
                                Loading activity...
                            </div>
                        ) : activityLogs.length > 0 ? (
                            activityLogs.map((log, index) => {
                                const actor = log.relationships?.actor?.attributes?.username || user?.username || 'user';
                                const time = formatRelativeTime(log.attributes?.timestamp);
                                const eventTitle = formatEventName(log.attributes?.event, log.attributes?.description);

                                return (
                                    <div key={log.attributes?.id || index} className="text-xs">
                                        <div className="flex items-center justify-between text-[11px] text-[#656b6b] dark:text-[#a0a0a0] font-mono">
                                            <span className="text-[#1a1a1a] dark:text-white font-semibold">{actor}</span>
                                            <span>{time}</span>
                                        </div>
                                        <div className="text-[#1a1a1a] dark:text-white mt-1 text-xs font-medium font-sans">
                                            {eventTitle}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-2 text-center text-xs text-[#656b6b] dark:text-[#a0a0a0]">
                                No recent activity recorded.
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {/* Server Details Modal */}
            {selectedServer && (
                <ProductActionModal
                    isOpen={isDetailsModalOpen}
                    onClose={() => {
                        setIsDetailsModalOpen(false);
                        setSelectedServer(null);
                    }}
                    title={selectedServer.name}
                >
                    <div className="space-y-4 text-xs font-mono">
                        <div className="flex justify-between py-2 border-b border-[#dedfdf] dark:border-[#262626]">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">UUID</span>
                            <span className="text-[#1a1a1a] dark:text-white">{selectedServer.uuid}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[#dedfdf] dark:border-[#262626]">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">Identifier</span>
                            <span className="text-[#1a1a1a] dark:text-white">{selectedServer.id}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[#dedfdf] dark:border-[#262626]">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">Node Location</span>
                            <span className="text-[#1a1a1a] dark:text-white">{selectedServer.node || 'Local Node'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[#dedfdf] dark:border-[#262626]">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">Allocated Ports</span>
                            <span className="text-[#1a1a1a] dark:text-white">
                                {selectedServer.allocations?.map((a) => `${a.alias || a.ip}:${a.port}`).join(', ') || 'None'}
                            </span>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => history.push(`/server/${selectedServer.id}`)}
                                className="px-4 py-2 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 bg-[#1a1a1a] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-[#ededed] border border-transparent shadow-xs active:scale-[0.98]"
                            >
                                <span>Open Server Console</span>
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </ProductActionModal>
            )}
        </div>
    );
};
