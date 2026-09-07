import React, { useState, useMemo, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useUserRole } from '@/plugins/useUserRole';
import { useHistory } from 'react-router-dom';
import http, { PaginatedResult } from '@/api/http';
import { Server } from '@/api/server/getServer';
import getServers, { getFleetStats, FleetStats } from '@/api/getServers';
import { ProductActionModal } from './product-panels/ProductActionModal';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { getTickets, Ticket } from '@/api/tickets';
import { formatDistanceToNow } from 'date-fns';
import { useStoreState } from '@/state/hooks';
import getServerResourceUsage, { ServerPowerState, ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString } from '@/lib/formatters';

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
    page?: number;
    onPageSelect?: (page: number) => void;
    rootAdmin?: boolean;
    showOnlyAdmin?: boolean;
    setShowOnlyAdmin?: any;
}

interface ServerCardProps {
    server: Server;
    currentStatus?: string;
    onOpenDetails: (server: Server) => void;
    onStatusUpdate?: (uuid: string, status: ServerPowerState | 'suspended' | 'installing' | 'offline') => void;
}

const LunarServerCard: React.FC<ServerCardProps> = ({ server, currentStatus, onOpenDetails, onStatusUpdate }) => {
    const history = useHistory();
    const primaryAlloc = server.allocations?.[0];
    const host = primaryAlloc?.alias || primaryAlloc?.ip;
    const port = primaryAlloc?.port;
    const isSuspended = server.status === 'suspended' || server.isNodeUnderMaintenance;
    const isInstalling = server.status === 'installing' || server.status === 'restoring_backup';

    const [stats, setStats] = useState<ServerStats | null>(null);
    const [isChecking, setIsChecking] = useState(!isSuspended && !isInstalling && !currentStatus);

    useEffect(() => {
        if (isSuspended) {
            onStatusUpdate?.(server.uuid, 'suspended');
            return;
        }
        if (isInstalling) {
            onStatusUpdate?.(server.uuid, 'installing');
            return;
        }

        let isMounted = true;
        getServerResourceUsage(server.uuid)
            .then((data) => {
                if (isMounted) {
                    setStats(data);
                    setIsChecking(false);
                    onStatusUpdate?.(server.uuid, data.status);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setIsChecking(false);
                    onStatusUpdate?.(server.uuid, 'offline');
                }
            });

        const timer = setInterval(() => {
            getServerResourceUsage(server.uuid)
                .then((data) => {
                    if (isMounted) {
                        setStats(data);
                        onStatusUpdate?.(server.uuid, data.status);
                    }
                })
                .catch(() => {});
        }, 20000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [server.uuid, isSuspended, isInstalling]);

    const activeStatus = stats?.status || currentStatus;

    let stateLabel = 'Offline';
    let dotClass = 'bg-red-500/80';
    let pingClass = '';
    let pillBorder = 'border-red-500/20 text-red-400/90 bg-red-500/5';
    let footerState = 'Stopped';
    let footerDot = 'bg-red-500/80';

    if (isSuspended || activeStatus === 'suspended') {
        stateLabel = 'Suspended';
        dotClass = 'bg-red-500';
        pillBorder = 'border-red-500/30 text-red-400 bg-red-500/10';
        footerState = 'Action Required';
        footerDot = 'bg-red-500';
    } else if (isInstalling || activeStatus === 'installing') {
        stateLabel = 'Installing';
        dotClass = 'bg-blue-500';
        pingClass = 'bg-blue-400';
        pillBorder = 'border-blue-500/30 text-blue-400 bg-blue-500/10';
        footerState = 'Provisioning';
        footerDot = 'bg-blue-500';
    } else if (isChecking && !stats && !currentStatus) {
        stateLabel = 'Syncing…';
        dotClass = 'bg-zinc-500';
        pingClass = 'bg-zinc-400';
        pillBorder = 'border-[#27272A] text-[#A1A1AA]';
        footerState = 'Querying Daemon';
        footerDot = 'bg-zinc-500';
    } else if (activeStatus === 'running') {
        stateLabel = 'Running';
        dotClass = 'bg-emerald-500';
        pingClass = 'bg-emerald-400';
        pillBorder = 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
        footerState = 'Operational';
        footerDot = 'bg-emerald-500';
    } else if (activeStatus === 'starting') {
        stateLabel = 'Restarting';
        dotClass = 'bg-amber-500';
        pingClass = 'bg-amber-400';
        pillBorder = 'border-amber-500/30 text-amber-400 bg-amber-500/10';
        footerState = 'Booting Engine';
        footerDot = 'bg-amber-500';
    } else if (activeStatus === 'stopping') {
        stateLabel = 'Stopping';
        dotClass = 'bg-amber-500';
        pingClass = 'bg-amber-400';
        pillBorder = 'border-amber-500/30 text-amber-400 bg-amber-500/10';
        footerState = 'Shutting Down';
        footerDot = 'bg-amber-500';
    } else {
        stateLabel = 'Offline';
        dotClass = 'bg-red-500/80';
        pillBorder = 'border-red-500/20 text-red-400/90 bg-red-500/5';
        footerState = 'Stopped / Standby';
        footerDot = 'bg-red-500/80';
    }

    const cpuDisplay = stats?.status === 'running' || stats?.status === 'starting'
        ? `${stats.cpuUsagePercent.toFixed(1)}%`
        : '0%';
    const cpuBar = stats?.status === 'running' || stats?.status === 'starting'
        ? Math.min(100, (stats.cpuUsagePercent / (server.limits.cpu || 100)) * 100)
        : 0;

    const memoryDisplay = stats?.status === 'running' || stats?.status === 'starting'
        ? bytesToString(stats.memoryUsageInBytes)
        : '0 MB';
    const memoryBar = stats?.status === 'running' || stats?.status === 'starting'
        ? Math.min(100, (stats.memoryUsageInBytes / (server.limits.memory * 1024 * 1024 || 1)) * 100)
        : 0;

    const diskDisplay = stats
        ? bytesToString(stats.diskUsageInBytes)
        : `${server.limits.disk} MB`;
    const diskBar = stats && server.limits.disk > 0
        ? Math.min(100, (stats.diskUsageInBytes / (server.limits.disk * 1024 * 1024)) * 100)
        : 0;

    return (
        <div className="bg-[#050505] hover:bg-[#0A0A0A] p-5 rounded-xl border border-[#1F1F1F] hover:border-[#383838] transition-all duration-150 flex flex-col justify-between group relative shadow-lg w-full">
            <div>
                {/* Header: Title & Accurate Status Beacon */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-serif font-medium text-white truncate m-0 tracking-tight">
                            {server.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-[#A0A0A0]">
                                Node: {server.node || 'Local Node'}
                            </span>
                            <span className="text-[#383838] text-xs">&bull;</span>
                            <span className="text-[11px] font-mono text-[#6B7280]">
                                {server.id}
                            </span>
                        </div>
                    </div>

                    {/* Accurate Status Pill */}
                    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium shrink-0 border ${pillBorder}`}>
                        <span className="relative flex h-2 w-2">
                            {pingClass && (
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingClass} opacity-60`} />
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`} />
                        </span>
                        <span className="text-[11px] tracking-tight font-medium">
                            {stateLabel}
                        </span>
                    </span>
                </div>

                {/* Endpoint Address */}
                {host && (
                    <div className="mb-4">
                        <CopyOnClick text={`${host}:${port}`}>
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#383838] font-mono text-xs text-white cursor-pointer transition-all duration-100 active:scale-95">
                                <span>{host}:{port}</span>
                                <svg className="w-3 h-3 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </CopyOnClick>
                    </div>
                )}

                {/* 3-Column Resource Limits & Real-time Usage */}
                <div className="grid grid-cols-3 gap-3 py-3 border-t border-[#141414] text-xs font-mono mb-4">
                    <div>
                        <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                            CPU {stats?.status === 'running' ? 'Load' : 'Limit'}
                        </span>
                        <span className="text-sm font-bold text-white mt-0.5 block truncate">
                            {cpuDisplay} <span className="text-2xs text-[#6B7280] font-normal">/ {server.limits.cpu}%</span>
                        </span>
                        <div className="h-1.5 w-full bg-[#141414] rounded-full overflow-hidden mt-1.5">
                            <div className="h-full bg-[#2563eb] rounded-full transition-all duration-300" style={{ width: `${cpuBar}%` }} />
                        </div>
                    </div>
                    <div>
                        <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                            Memory
                        </span>
                        <span className="text-sm font-bold text-white mt-0.5 block truncate">
                            {memoryDisplay}
                        </span>
                        <div className="h-1.5 w-full bg-[#141414] rounded-full overflow-hidden mt-1.5">
                            <div className="h-full bg-[#8b5cf6] rounded-full transition-all duration-300" style={{ width: `${memoryBar}%` }} />
                        </div>
                    </div>
                    <div>
                        <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                            Storage
                        </span>
                        <span className="text-sm font-bold text-white mt-0.5 block truncate">
                            {diskDisplay}
                        </span>
                        <div className="h-1.5 w-full bg-[#141414] rounded-full overflow-hidden mt-1.5">
                            <div className="h-full bg-[#f59e0b] rounded-full transition-all duration-300" style={{ width: `${diskBar}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Card Actions Footer */}
            <div className="w-full flex items-center justify-between gap-2 pt-3.5 border-t border-[#141414] mt-auto">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#A0A0A0] min-w-0 truncate">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${footerDot}`} />
                    <span className="truncate">{footerState}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {server.isFiveM && (server as any).txadminUrl && (
                        <a
                            href={(server as any).txadminUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 group"
                            title={`Open txAdmin web panel on port ${(server as any).txadminPort || 40120}`}
                        >
                            <svg className="w-3 h-3 text-[#10B981] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span>txAdmin</span>
                        </a>
                    )}

                    <button
                        type="button"
                        onClick={() => onOpenDetails(server)}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 inline-flex items-center justify-center whitespace-nowrap shrink-0 bg-[#0A0A0A] text-[#EDEDED] hover:text-white border border-[#1F1F1F] hover:bg-[#141414] hover:border-[#383838]"
                    >
                        Details
                    </button>

                    <button
                        type="button"
                        onClick={() => history.push(`/server/${server.id}`)}
                        className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 bg-white text-black hover:bg-[#EDEDED] border border-transparent shadow-xs active:scale-[0.98]"
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
};

export default ({ servers, onPageSelect }: Props) => {
    const history = useHistory();
    const { isAdmin } = useUserRole();
    const user = useStoreState((state) => state.user.data);
    const serverList = servers?.items || [];
    const pagination = servers?.pagination;
    const [selectedServer, setSelectedServer] = useState<Server | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Dynamic operations hub state
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [activityLoading, setActivityLoading] = useState(true);
    const [serverStatuses, setServerStatuses] = useState<Record<string, string>>({});

    const handleStatusUpdate = useCallback((uuid: string, status: string) => {
        setServerStatuses((prev) => {
            if (prev[uuid] === status) return prev;
            return { ...prev, [uuid]: status };
        });
    }, []);

    // Fetch all servers across the fleet for complete telemetry and power status scanning
    const { data: allFleetServers } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers-fleet-all', isAdmin],
        () => getServers({ perPage: 1000, type: isAdmin ? 'admin-all' : undefined }),
        { revalidateOnFocus: false }
    );
    const fullServerList = allFleetServers?.items || serverList;

    // Fetch live fleet statistics from backend
    const { data: fleetStats } = useSWR<FleetStats>(
        ['/api/client/stats', isAdmin],
        () => getFleetStats(isAdmin ? 'admin-all' : undefined),
        { refreshInterval: 15000 }
    );

    // Synchronize fleet-wide server power statuses from backend
    useEffect(() => {
        if (fleetStats?.statuses && Object.keys(fleetStats.statuses).length > 0) {
            setServerStatuses((prev) => ({ ...fleetStats.statuses, ...prev }));
        }
    }, [fleetStats?.statuses]);

    // Background fleet status scanner as fallback when fleetStats.statuses is not yet available
    useEffect(() => {
        if (!fullServerList.length) return;
        if (fleetStats?.statuses && Object.keys(fleetStats.statuses).length > 0) return;

        let isCancelled = false;

        const scanAll = async () => {
            const batchSize = 10;
            for (let i = 0; i < fullServerList.length; i += batchSize) {
                if (isCancelled) break;
                const batch = fullServerList.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (server) => {
                        if (server.status === 'suspended' || server.isNodeUnderMaintenance) {
                            return { uuid: server.uuid, status: 'suspended' };
                        }
                        if (server.status === 'installing' || server.status === 'restoring_backup') {
                            return { uuid: server.uuid, status: 'installing' };
                        }
                        try {
                            const data = await getServerResourceUsage(server.uuid);
                            return { uuid: server.uuid, status: data.status };
                        } catch {
                            return { uuid: server.uuid, status: 'offline' };
                        }
                    })
                );

                if (!isCancelled) {
                    const updates: Record<string, string> = {};
                    batchResults.forEach((res) => {
                        updates[res.uuid] = res.status;
                    });
                    setServerStatuses((prev) => ({ ...prev, ...updates }));
                }

                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        };

        scanAll();

        const interval = setInterval(scanAll, 25000);

        return () => {
            isCancelled = true;
            clearInterval(interval);
        };
    }, [fullServerList, fleetStats?.statuses]);

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
        let totalCpu = fleetStats?.cpu ?? 0;
        let totalMemory = fleetStats?.memory ?? 0;
        let totalDisk = fleetStats?.disk ?? 0;
        let runningCount = 0;

        // Prioritize backend fleet-wide running count across all 99 instances
        if (typeof fleetStats?.running === 'number') {
            runningCount = fleetStats.running;
        } else {
            fullServerList.forEach((server) => {
                if (!fleetStats) {
                    totalCpu += server.limits.cpu || 0;
                    totalMemory += server.limits.memory || 0;
                    totalDisk += server.limits.disk || 0;
                }
                if (serverStatuses[server.uuid] === 'running') {
                    runningCount++;
                }
            });
        }

        const totalInstances = fleetStats?.total ?? pagination?.total ?? fullServerList.length;

        return {
            totalInstances,
            runningCount,
            totalCpu,
            totalMemory,
            totalDisk,
        };
    }, [fullServerList, serverStatuses, fleetStats, pagination]);

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
            <div className="mb-7 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1F1F1F] pb-5">
                <div>
                    <h1 className="page-heading text-3xl sm:text-4xl font-serif font-normal text-white tracking-tight m-0">
                        {isAdmin ? 'Admin Infrastructure Overview' : 'My Servers & Bots'}
                    </h1>
                    <p className="text-xs text-[#A0A0A0] font-sans mt-1.5 m-0 leading-relaxed">
                        {isAdmin
                            ? 'Live cluster telemetry, node capacity, and provisioned instances & bots across the entire fleet.'
                            : 'Live telemetry, resource utilization, and management for your active servers, bots, and application containers.'}
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => history.push('/instances')}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 bg-[#0A0A0A] text-[#EDEDED] border border-[#1F1F1F] hover:bg-[#141414] hover:border-[#383838] shadow-sm"
                    >
                        <span>{isAdmin ? 'View All Instances' : 'View Instances & Bots'}</span>
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
                    <div className="ink-block-wrapper bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-2xl">
                        <div className="ink-block-header bg-[#050505] border-b border-[#141414] px-5 py-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="font-serif font-semibold text-sm text-white tracking-tight">
                                    {isAdmin ? 'Cluster Telemetry' : 'Resource Allocation'}
                                </span>
                                <span className="text-[#52525B] text-xs select-none">/</span>
                                <span className="text-[11px] font-mono text-[#A0A0A0]">
                                    {isAdmin ? 'Production Fleet' : 'My Instances & Bots'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                                <span className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-wider">Sync: Live 15s</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#141414] bg-[#000000]">
                            {/* Stat 1: Online Instances */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between bg-[#000000]">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Online Instances
                                    </span>
                                    <div className="text-2xl font-mono font-bold text-white mt-1.5">
                                        {telemetry.runningCount}{' '}
                                        <span className="text-xs font-normal text-[#6B7280]">/ {telemetry.totalInstances} total</span>
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1.5 w-full bg-[#141414] rounded-full overflow-hidden">
                                        <div
                                             className="h-full bg-[#10b981] rounded-full transition-all duration-500"
                                            style={{
                                                width: telemetry.totalInstances > 0
                                                    ? `${Math.round((telemetry.runningCount / telemetry.totalInstances) * 100)}%`
                                                    : '0%',
                                            }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#6B7280] mt-1 block">
                                        {telemetry.totalInstances > 0
                                            ? `${Math.round((telemetry.runningCount / telemetry.totalInstances) * 100)}% verified online`
                                            : '0% online'}
                                    </span>
                                </div>
                            </div>

                            {/* Stat 2: Allocated CPU */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between bg-[#000000]">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Allocated CPU
                                    </span>
                                    <div className="text-2xl font-mono font-bold text-white mt-1.5">
                                        {telemetry.totalCpu}%
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1.5 w-full bg-[#141414] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#2563eb] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, telemetry.totalCpu / 2)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#6B7280] mt-1 block">
                                        Assigned compute limit
                                    </span>
                                </div>
                            </div>

                            {/* Stat 3: Committed RAM */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between bg-[#000000]">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Committed RAM
                                    </span>
                                    <div className="text-2xl font-mono font-bold text-white mt-1.5">
                                        {(telemetry.totalMemory / 1024).toFixed(1)}{' '}
                                        <span className="text-xs font-normal text-[#6B7280]">GB</span>
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1.5 w-full bg-[#141414] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#8b5cf6] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, (telemetry.totalMemory / 8192) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#6B7280] mt-1 block">
                                        Dedicated memory
                                    </span>
                                </div>
                            </div>

                            {/* Stat 4: Storage Pool */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between bg-[#000000]">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Storage Pool
                                    </span>
                                    <div className="text-2xl font-mono font-bold text-white mt-1.5">
                                        {(telemetry.totalDisk / 1024).toFixed(1)}{' '}
                                        <span className="text-xs font-normal text-[#6B7280]">GB</span>
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1.5 w-full bg-[#141414] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#f59e0b] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, (telemetry.totalDisk / 32768) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#6B7280] mt-1 block">
                                        NVMe / ZFS Pool
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Active Instances & Bots List */}
                    <div className="ink-block-wrapper bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-2xl">
                        <div className="ink-block-header bg-[#050505] border-b border-[#141414] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <span className="font-serif font-semibold text-sm text-white tracking-tight">
                                    {isAdmin ? 'All Active Instances & Bots' : 'My Active Instances & Bots'}
                                </span>
                                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#0A0A0A] text-white border border-[#1F1F1F]">
                                    {filteredServers.length}
                                </span>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search servers, bots, nodes..."
                                    className="border border-[#1F1F1F] hover:border-[#383838] focus:border-[#383838] rounded-lg px-3 py-1.5 text-xs text-white bg-[#0A0A0A] outline-none w-56 font-mono placeholder-[#525252] transition-colors"
                                />
                            </div>
                        </div>

                        <div className="p-5 bg-[#000000]">
                            {filteredServers.length === 0 ? (
                                <div className="py-12 text-center text-xs text-[#A0A0A0] font-sans">
                                    No instances or bots deployed or matching search.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredServers.map((server) => (
                                        <LunarServerCard
                                            key={server.id}
                                            server={server}
                                            currentStatus={serverStatuses[server.uuid]}
                                            onOpenDetails={(s) => {
                                                setSelectedServer(s);
                                                setIsDetailsModalOpen(true);
                                            }}
                                            onStatusUpdate={handleStatusUpdate}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pagination Footer */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="bg-[#050505] border-t border-[#141414] px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs font-mono text-[#A0A0A0]">
                                    Showing{' '}
                                    <span className="text-white font-semibold">
                                        {(pagination.currentPage - 1) * pagination.perPage + 1}
                                    </span>{' '}
                                    to{' '}
                                    <span className="text-white font-semibold">
                                        {Math.min(pagination.currentPage * pagination.perPage, pagination.total)}
                                    </span>{' '}
                                    of{' '}
                                    <span className="text-white font-semibold">
                                        {pagination.total}
                                    </span>{' '}
                                    servers (25 per page)
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {/* Previous Page Button */}
                                    <button
                                        type="button"
                                        disabled={pagination.currentPage <= 1}
                                        onClick={() => onPageSelect && onPageSelect(pagination.currentPage - 1)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all duration-150 inline-flex items-center gap-1 border ${
                                            pagination.currentPage <= 1
                                                ? 'opacity-40 cursor-not-allowed bg-transparent border-[#1F1F1F] text-[#52525B]'
                                                : 'cursor-pointer bg-[#0A0A0A] text-[#EDEDED] border-[#1F1F1F] hover:bg-[#141414] hover:border-[#383838]'
                                        }`}
                                    >
                                        &larr; Prev
                                    </button>

                                    {/* Page Number Buttons */}
                                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                                        .filter((p) => {
                                            return (
                                                p === 1 ||
                                                p === pagination.totalPages ||
                                                Math.abs(p - pagination.currentPage) <= 2
                                            );
                                        })
                                        .map((p, idx, arr) => {
                                            const prevP = arr[idx - 1];
                                            const showEllipsis = prevP && p - prevP > 1;
                                            const isActive = p === pagination.currentPage;

                                            return (
                                                <React.Fragment key={p}>
                                                    {showEllipsis && (
                                                        <span className="px-1.5 text-xs text-[#52525B] font-mono select-none">
                                                            …
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onPageSelect && onPageSelect(p)}
                                                        className={`w-7 h-7 rounded-md text-xs font-mono font-medium transition-all duration-150 inline-flex items-center justify-center border ${
                                                            isActive
                                                                ? 'bg-white text-black border-transparent font-bold shadow-xs'
                                                                : 'cursor-pointer bg-[#0A0A0A] text-[#A0A0A0] border-[#1F1F1F] hover:bg-[#141414] hover:text-white'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                </React.Fragment>
                                            );
                                        })}

                                    {/* Next Page Button */}
                                    <button
                                        type="button"
                                        disabled={pagination.currentPage >= pagination.totalPages}
                                        onClick={() => onPageSelect && onPageSelect(pagination.currentPage + 1)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all duration-150 inline-flex items-center gap-1 border ${
                                            pagination.currentPage >= pagination.totalPages
                                                ? 'opacity-40 cursor-not-allowed bg-transparent border-[#1F1F1F] text-[#52525B]'
                                                : 'cursor-pointer bg-[#0A0A0A] text-[#EDEDED] border-[#1F1F1F] hover:bg-[#141414] hover:border-[#383838]'
                                        }`}
                                    >
                                        Next &rarr;
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ---------- RIGHT: OPERATIONS HUB (1:1 Votion Rail) ---------- */}
                <aside className="w-full lg:w-[320px] max-w-full lg:max-w-[340px] bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shrink-0 shadow-2xl">
                    {/* 1. Open Tickets */}
                    <div className="bg-[#050505] border-b border-[#141414] px-4 py-3 flex items-center justify-between">
                        <span className="font-serif font-semibold text-xs text-white flex items-center gap-2">
                            Open tickets
                            <span className="bg-[#0A0A0A] text-[#A0A0A0] border border-[#1F1F1F] text-[10px] font-mono px-2 py-0.5 rounded-full">
                                {openTickets.length}
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={() => history.push('/support')}
                            className="text-[11px] font-mono text-[#3B82F6] hover:underline cursor-pointer bg-transparent border-none p-0"
                        >
                            + New
                        </button>
                    </div>

                    {ticketsLoading ? (
                        <div className="px-4 py-3.5 border-b border-[#141414] text-center text-xs text-[#A0A0A0] font-mono animate-pulse">
                            Checking support queue...
                        </div>
                    ) : openTickets.length > 0 ? (
                        openTickets.slice(0, 2).map((ticket) => (
                            <div
                                key={ticket.id}
                                onClick={() => history.push('/support')}
                                className="px-4 py-3.5 border-b border-[#141414] hover:bg-[#0A0A0A] transition-colors cursor-pointer"
                            >
                                <div className="py-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] text-[#A0A0A0]">
                                            #T-{ticket.ticket_id || ticket.id}
                                        </span>
                                        <span className="text-xs flex-1 truncate text-white font-medium">
                                            {ticket.title}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0A0A0A] border border-[#1F1F1F] text-[10px] font-mono text-[#EDEDED]">
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
                                    <p className="text-[11px] text-[#A0A0A0] mt-1.5 m-0 font-sans">
                                        {ticket.department} &bull; Updated {formatRelativeTime(ticket.updated_at || ticket.created_at)}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-4 border-b border-[#141414] text-center">
                            <p className="text-xs text-[#A0A0A0] m-0">No active support tickets.</p>
                            <button
                                type="button"
                                onClick={() => history.push('/support')}
                                className="mt-1.5 text-xs text-[#3B82F6] hover:underline font-medium cursor-pointer bg-transparent border-none p-0"
                            >
                                Open a ticket &rarr;
                            </button>
                        </div>
                    )}

                    {/* 2. Account & Billing */}
                    <div className="bg-[#050505] border-b border-[#141414] px-4 py-3 flex items-center justify-between">
                        <span className="font-serif font-semibold text-xs text-white">Account &amp; billing</span>
                        <button
                            type="button"
                            onClick={() => history.push('/billing')}
                            className="text-[11px] font-mono text-[#3B82F6] hover:underline cursor-pointer bg-transparent border-none p-0"
                        >
                            Manage &rarr;
                        </button>
                    </div>

                    <div className="px-4 py-3.5 border-b border-[#141414] space-y-2.5 text-xs font-mono">
                        <div className="flex justify-between items-center">
                            <span className="text-[#A0A0A0]">Next renewal due</span>
                            <span className="text-white font-medium">{nextDueDate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[#A0A0A0]">Active instances</span>
                            <span className="text-white font-medium">{serverList.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[#A0A0A0]">Suspended instances</span>
                            <span className={`font-medium ${suspendedServers.length > 0 ? 'text-amber-500' : 'text-[#4ADE80]'}`}>
                                {suspendedServers.length}
                            </span>
                        </div>

                        {suspendedServers.length > 0 ? (
                            <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300 leading-relaxed font-sans flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    {suspendedServers.length} server(s) suspended.
                                </span>
                                <button
                                    type="button"
                                    onClick={() => history.push('/billing')}
                                    className="text-xs font-semibold underline ml-1 cursor-pointer bg-transparent border-none p-0 text-amber-200"
                                >
                                    Renew now &rarr;
                                </button>
                            </div>
                        ) : (
                            <div className="mt-2.5 rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] px-3 py-2 text-[11px] text-[#A0A0A0] leading-relaxed font-sans flex items-center gap-2">
                                <span className="text-emerald-500 font-bold">✓</span>
                                <span>Billing account in good standing. All compute nodes cleared.</span>
                            </div>
                        )}
                    </div>

                    {/* 3. Incidents & Audit */}
                    <div className="bg-[#050505] border-b border-[#141414] px-4 py-3 flex items-center justify-between">
                        <span className="font-serif font-semibold text-xs text-white">Incidents &amp; audit</span>
                        <button
                            type="button"
                            onClick={() => history.push(isAdmin ? '/audit-logs' : '/account/activity')}
                            className="text-[11px] font-mono text-[#3B82F6] hover:underline cursor-pointer bg-transparent border-none p-0"
                        >
                            View all &rarr;
                        </button>
                    </div>

                    <div className="px-4 py-3.5 space-y-3">
                        {activityLoading ? (
                            <div className="py-2 text-center text-xs text-[#A0A0A0] font-mono animate-pulse">
                                Loading activity...
                            </div>
                        ) : activityLogs.length > 0 ? (
                            activityLogs.map((log, index) => {
                                const actor = log.relationships?.actor?.attributes?.username || user?.username || 'user';
                                const time = formatRelativeTime(log.attributes?.timestamp);
                                const eventTitle = formatEventName(log.attributes?.event, log.attributes?.description);

                                return (
                                    <div key={log.attributes?.id || index} className="text-xs">
                                        <div className="flex items-center justify-between text-[11px] text-[#A0A0A0] font-mono">
                                            <span className="text-white font-semibold">{actor}</span>
                                            <span>{time}</span>
                                        </div>
                                        <div className="text-white mt-1 text-xs font-medium font-sans">
                                            {eventTitle}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-2 text-center text-xs text-[#A0A0A0]">
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
                        <div className="flex justify-between py-2 border-b border-[#141414]">
                            <span className="text-[#A0A0A0]">UUID</span>
                            <span className="text-white">{selectedServer.uuid}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[#141414]">
                            <span className="text-[#A0A0A0]">Identifier</span>
                            <span className="text-white">{selectedServer.id}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[#141414]">
                            <span className="text-[#A0A0A0]">Node Location</span>
                            <span className="text-white">{selectedServer.node || 'Local Node'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[#141414]">
                            <span className="text-[#A0A0A0]">Allocated Ports</span>
                            <span className="text-white">
                                {selectedServer.allocations?.map((a) => `${a.alias || a.ip}:${a.port}`).join(', ') || 'None'}
                            </span>
                        </div>
                        {selectedServer.isFiveM && (selectedServer as any).txadminUrl && (
                            <div className="flex justify-between items-center py-2 border-b border-[#141414]">
                                <span className="text-[#A0A0A0]">txAdmin Web Panel</span>
                                <a
                                    href={(selectedServer as any).txadminUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#10B981] hover:underline flex items-center gap-1 font-semibold"
                                >
                                    <span>Port {(selectedServer as any).txadminPort || 40120}</span>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>
                        )}
                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => history.push(`/server/${selectedServer.id}`)}
                                className="px-4 py-2 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 bg-white text-black hover:bg-[#EDEDED] border border-transparent shadow-xs active:scale-[0.98]"
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
