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
import ServerStatusBox from '@/components/elements/ServerStatusBox';
import { usePersistedState } from '@/plugins/usePersistedState';

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

/**
 * Primary / Focal Instance Card
 * High visual authority with rich live telemetry, clear connection badge, and prominent console CTA.
 */
const FocalServerCard: React.FC<ServerCardProps> = ({ server, currentStatus, onOpenDetails, onStatusUpdate }) => {
    const history = useHistory();
    const primaryAlloc = server.allocations?.[0];
    const host = primaryAlloc?.alias || primaryAlloc?.ip;
    const port = primaryAlloc?.port;
    const isSuspended = server.status === 'suspended' || server.isNodeUnderMaintenance;
    const isInstalling = server.status === 'installing' || server.status === 'restoring_backup';

    const [stats, setStats] = useState<ServerStats | null>(null);

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
                    onStatusUpdate?.(server.uuid, data.status);
                }
            })
            .catch(() => {
                if (isMounted) {
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
        }, 15000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [server.uuid, isSuspended, isInstalling]);

    const activeStatus = stats?.status || currentStatus;

    let statusKey = 'offline';
    let footerState = 'Standby';
    let footerDot = 'bg-zinc-600';

    if (isSuspended || activeStatus === 'suspended') {
        statusKey = 'suspended';
        footerState = 'Suspended — Action Required';
        footerDot = 'bg-red-500';
    } else if (isInstalling || activeStatus === 'installing') {
        statusKey = 'installing';
        footerState = 'Provisioning Container';
        footerDot = 'bg-blue-500';
    } else if (activeStatus === 'running') {
        statusKey = 'running';
        footerState = 'Operational';
        footerDot = 'bg-emerald-500/80';
    } else if (activeStatus === 'starting') {
        statusKey = 'restarting';
        footerState = 'Restarting Engine';
        footerDot = 'bg-amber-500';
    } else if (activeStatus === 'stopping') {
        statusKey = 'stopping';
        footerState = 'Shutting Down';
        footerDot = 'bg-amber-500';
    } else {
        statusKey = 'offline';
        footerState = 'Stopped';
        footerDot = 'bg-zinc-600';
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
        <div className="relative rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#0B0B0E] via-[#08080A] to-[#050507] p-5 sm:p-6 flex flex-col justify-between overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.15] before:to-transparent">
            <div>
                {/* Header: Title, Identifiers, and Status */}
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                Primary Focal Instance
                            </span>
                            <span className="text-zinc-700 text-xs select-none">&bull;</span>
                            <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                                {server.node || 'Local Node'}
                            </span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-sans font-semibold text-zinc-100 truncate m-0 tracking-tight">
                            {server.name}
                        </h3>
                        <span className="text-[11px] font-mono text-zinc-500 mt-0.5 block">
                            UUID: {server.uuid.split('-')[0]}... &bull; ID: #{server.id}
                        </span>
                    </div>

                    {/* Accurate Status Box */}
                    <ServerStatusBox status={statusKey} size="small" />
                </div>

                {/* Connection Address */}
                {host && (
                    <div className="mb-5">
                        <CopyOnClick text={`${host}:${port}`}>
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#000000] border border-white/[0.08] hover:border-white/[0.18] font-mono text-xs text-zinc-300 hover:text-white cursor-pointer transition-all duration-150 select-none group">
                                <span className="text-zinc-500 text-[10px]">ENDPOINT:</span>
                                <span>{host}:{port}</span>
                                <svg className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </CopyOnClick>
                    </div>
                )}

                {/* 3 Hardware Telemetry Strips */}
                <div className="grid grid-cols-3 gap-3 py-3.5 border-t border-white/[0.04] text-xs font-mono mb-4 bg-white/[0.01] rounded-lg px-3">
                    <div>
                        <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-[0.14em] block">
                            CPU Load
                        </span>
                        <span className="text-sm font-bold text-zinc-100 mt-1 block truncate tabular-nums">
                            {cpuDisplay} <span className="text-[10px] text-zinc-500 font-normal">/ {server.limits.cpu}%</span>
                        </span>
                        <div className="h-1 w-full bg-[#141416] rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-zinc-300 rounded-full transition-all duration-300" style={{ width: `${cpuBar}%` }} />
                        </div>
                    </div>
                    <div>
                        <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-[0.14em] block">
                            Memory
                        </span>
                        <span className="text-sm font-bold text-zinc-100 mt-1 block truncate tabular-nums">
                            {memoryDisplay}
                        </span>
                        <div className="h-1 w-full bg-[#141416] rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-zinc-300 rounded-full transition-all duration-300" style={{ width: `${memoryBar}%` }} />
                        </div>
                    </div>
                    <div>
                        <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-[0.14em] block">
                            Storage
                        </span>
                        <span className="text-sm font-bold text-zinc-100 mt-1 block truncate tabular-nums">
                            {diskDisplay}
                        </span>
                        <div className="h-1 w-full bg-[#141416] rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-zinc-300 rounded-full transition-all duration-300" style={{ width: `${diskBar}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Action Bar */}
            <div className="w-full flex items-center justify-between gap-3 pt-3.5 border-t border-white/[0.05] mt-auto">
                <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 min-w-0 truncate">
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
                            className="px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            title={`Open txAdmin web panel on port ${(server as any).txadminPort || 40120}`}
                        >
                            <span>txAdmin</span>
                        </a>
                    )}

                    <button
                        type="button"
                        onClick={() => onOpenDetails(server)}
                        className="px-3 py-1.5 rounded-md text-xs font-mono font-medium cursor-pointer transition-all inline-flex items-center justify-center whitespace-nowrap shrink-0 bg-white/[0.04] text-zinc-300 hover:text-white border border-white/[0.08] hover:bg-white/[0.08]"
                    >
                        Details
                    </button>

                    <button
                        type="button"
                        onClick={() => history.push(`/server/${server.id}`)}
                        className="px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 bg-zinc-100 text-zinc-950 hover:bg-white border border-transparent shadow-xs active:scale-[0.98]"
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

/**
 * Compact System Matrix Row for Secondary / Scaled Instances
 * High density, space-conscious administration row with live telemetry pills and instant action jump.
 */
const CompactServerRow: React.FC<ServerCardProps> = ({ server, currentStatus, onOpenDetails, onStatusUpdate }) => {
    const history = useHistory();
    const primaryAlloc = server.allocations?.[0];
    const host = primaryAlloc?.alias || primaryAlloc?.ip;
    const port = primaryAlloc?.port;
    const isSuspended = server.status === 'suspended' || server.isNodeUnderMaintenance;
    const isInstalling = server.status === 'installing' || server.status === 'restoring_backup';

    const [stats, setStats] = useState<ServerStats | null>(null);

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
                    onStatusUpdate?.(server.uuid, data.status);
                }
            })
            .catch(() => {
                if (isMounted) {
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

    let statusKey = 'offline';
    if (isSuspended || activeStatus === 'suspended') {
        statusKey = 'suspended';
    } else if (isInstalling || activeStatus === 'installing') {
        statusKey = 'installing';
    } else if (activeStatus === 'running') {
        statusKey = 'running';
    } else if (activeStatus === 'starting') {
        statusKey = 'restarting';
    } else if (activeStatus === 'stopping') {
        statusKey = 'stopping';
    } else {
        statusKey = 'offline';
    }

    const cpuDisplay = stats?.status === 'running' || stats?.status === 'starting'
        ? `${stats.cpuUsagePercent.toFixed(0)}%`
        : '0%';
    const memoryDisplay = stats?.status === 'running' || stats?.status === 'starting'
        ? bytesToString(stats.memoryUsageInBytes)
        : '0 MB';

    return (
        <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#060608] hover:bg-[#09090C] border border-white/[0.04] hover:border-white/[0.09] transition-all duration-150">
            {/* Left: Status & Identity */}
            <div className="flex items-center gap-3 min-w-0">
                <ServerStatusBox status={statusKey} size="small" className="shrink-0" />
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-sans font-medium text-zinc-200 group-hover:text-white truncate">
                            {server.name}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.03] px-1.5 py-0.2 rounded border border-white/[0.04]">
                            {server.node || 'Node'}
                        </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 truncate block">
                        #{server.id} &bull; {server.uuid.split('-')[0]}
                    </span>
                </div>
            </div>

            {/* Middle: Compact Metrics */}
            <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 shrink-0">
                <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-0.5 rounded border border-white/[0.04]">
                    <span className="text-[9px] uppercase text-zinc-500">CPU</span>
                    <span className="text-zinc-200 font-semibold">{cpuDisplay}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-0.5 rounded border border-white/[0.04]">
                    <span className="text-[9px] uppercase text-zinc-500">RAM</span>
                    <span className="text-zinc-200 font-semibold">{memoryDisplay}</span>
                </div>
                {host && (
                    <CopyOnClick text={`${host}:${port}`}>
                        <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-white cursor-pointer bg-white/[0.02] hover:bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.04]">
                            <span>{host}:{port}</span>
                        </span>
                    </CopyOnClick>
                )}
            </div>

            {/* Right: Fast Actions */}
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                    type="button"
                    onClick={() => onOpenDetails(server)}
                    className="px-2.5 py-1 rounded text-xs font-mono text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                    Details
                </button>
                <button
                    type="button"
                    onClick={() => history.push(`/server/${server.id}`)}
                    className="px-3 py-1 rounded text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1"
                >
                    <span>Console</span>
                    <svg className="w-3 h-3 text-zinc-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
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
    const [viewMode, setViewMode] = usePersistedState<'showcase' | 'matrix'>('lunar:dashboard_view_mode', 'showcase');

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

    // Background fleet status scanner
    useEffect(() => {
        if (!fullServerList.length) return;

        let isCancelled = false;
        let isScanning = false;

        const scanAll = async () => {
            if (isScanning || isCancelled) return;
            isScanning = true;

            try {
                const batchSize = 6;
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

                    await new Promise((resolve) => setTimeout(resolve, 120));
                }
            } finally {
                isScanning = false;
            }
        };

        scanAll();

        const interval = setInterval(scanAll, 30000);

        return () => {
            isCancelled = true;
            clearInterval(interval);
        };
    }, [fullServerList]);

    useEffect(() => {
        let isMounted = true;

        getTickets(isAdmin ? { admin: true } : undefined)
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
    }, [isAdmin]);

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

        if (!fleetStats) {
            fullServerList.forEach((server) => {
                totalCpu += server.limits.cpu || 0;
                totalMemory += server.limits.memory || 0;
                totalDisk += server.limits.disk || 0;
            });
        }

        const runningUuids = new Set<string>();

        if (fleetStats?.statuses) {
            Object.entries(fleetStats.statuses).forEach(([uuid, status]) => {
                if (status === 'running') {
                    runningUuids.add(uuid);
                }
            });
        }

        Object.entries(serverStatuses).forEach(([uuid, status]) => {
            if (status === 'running') {
                runningUuids.add(uuid);
            } else if (status === 'offline' || status === 'stopped' || status === 'suspended') {
                runningUuids.delete(uuid);
            }
        });

        const runningCount = Math.max(runningUuids.size, fleetStats?.running ?? 0);
        const totalInstances = fleetStats?.total ?? pagination?.total ?? fullServerList.length;

        return {
            totalInstances,
            runningCount,
            totalCpu,
            totalMemory,
            totalDisk,
        };
    }, [fullServerList, serverStatuses, fleetStats, pagination]);

    const clusterNodes = useMemo(() => {
        if (fleetStats?.nodes && fleetStats.nodes.length > 0) {
            return fleetStats.nodes.map((node) => {
                if (node.status === 'online') return node;
                const hasRunningServer = fullServerList.some(
                    (s) => (s.node === node.name || (s as any).node_id === node.id) && serverStatuses[s.uuid] === 'running'
                );
                if (hasRunningServer) {
                    return { ...node, status: 'online' as const };
                }
                return node;
            });
        }
        const nodeMap = new Map<string, { id: number; name: string; servers_count: number }>();
        fullServerList.forEach((s) => {
            const name = s.node || 'Primary Node';
            if (!nodeMap.has(name)) {
                nodeMap.set(name, { id: nodeMap.size + 1, name, servers_count: 0 });
            }
            nodeMap.get(name)!.servers_count += 1;
        });
        return Array.from(nodeMap.values()).map((n) => ({
            id: n.id,
            name: n.name,
            fqdn: n.name,
            scheme: 'https',
            location: 'Cluster',
            status: 'online' as const,
            maintenance_mode: false,
            servers_count: n.servers_count,
            memory: 0,
            disk: 0,
        }));
    }, [fleetStats?.nodes, fullServerList, serverStatuses]);

    const nodesOnlineCount = clusterNodes.filter((n) => n.status === 'online').length;
    const nodesTotalCount = Math.max(clusterNodes.length, 1);

    const fleetTotalServers = fleetStats?.total ?? pagination?.total ?? fullServerList.length;
    const fleetRunningServers = telemetry.runningCount;
    const fleetSuspendedServers = fleetStats?.suspended ?? suspendedServers.length;
    const fleetInstallingServers = fleetStats?.installing ?? fullServerList.filter((s) => s.status === 'installing').length;
    const fleetOfflineServers = Math.max(0, fleetTotalServers - fleetRunningServers - fleetSuspendedServers - fleetInstallingServers);

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

    const focalServer = filteredServers[0];
    const secondaryServers = filteredServers.slice(1);

    return (
        <div className="relative w-full font-sans select-none pb-12">
            {/* Ambient Lighting Vignette */}
            <div
                className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.035)_0%,rgba(0,0,0,0)_70%)] blur-2xl z-0"
                aria-hidden="true"
            />

            {/* Header: Editorial Page title */}
            <div className="relative z-10 mb-7 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.06] pb-5">
                <div>
                    <h1 className="page-heading text-2xl sm:text-3xl font-serif font-normal text-zinc-100 tracking-tight m-0">
                        {isAdmin ? 'Infrastructure Overview & Telemetry' : 'Services & Compute Fleet'}
                    </h1>
                    <p className="text-xs text-zinc-400 font-sans mt-1.5 m-0 leading-relaxed">
                        {isAdmin
                            ? 'Real-time cluster telemetry, node capacity, and instance orchestration across the entire fleet.'
                            : 'Real-time telemetry, resource utilization, and management for your active servers and container services.'}
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => history.push('/instances')}
                        className="px-3.5 py-1.5 rounded-md text-xs font-mono font-medium cursor-pointer transition-all inline-flex items-center justify-center gap-1.5 bg-[#0A0A0D] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.18] shadow-sm"
                    >
                        <span>{isAdmin ? 'View Fleet Table' : 'View Instances Table'}</span>
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="relative z-10 flex flex-col lg:flex-row gap-6 items-start">
                {/* ---------- LEFT: ASYMMETRIC TELEMETRY & INSTANCES ---------- */}
                <section className="flex-1 min-w-0 w-full space-y-6">
                    {/* Asymmetric Telemetry Command Hub */}
                    <div className="rounded-xl border border-white/[0.06] bg-[#070709] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.5)] relative before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.12] before:to-transparent">
                        {/* Header Strip */}
                        <div className="bg-[#0A0A0D] border-b border-white/[0.04] px-5 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 font-semibold">
                                    {isAdmin ? 'INFRASTRUCTURE TELEMETRY' : 'FLEET COMPUTE TELEMETRY'}
                                </span>
                                <span className="text-zinc-600 text-xs">/</span>
                                <span className="text-[11px] font-mono text-zinc-500">
                                    {isAdmin ? 'CLUSTER CORE' : 'ASSIGNED HARDWARE'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">LIVE SYNC 15S</span>
                            </div>
                        </div>

                        {/* Asymmetric 12-Column Telemetry Surface */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.04] bg-[#070709]">
                            {/* Focal Unit: Fleet Engine & Active Ratio (5 Cols) */}
                            <div className="lg:col-span-5 p-5 flex flex-col justify-between bg-gradient-to-b from-[#0A0A0D] to-[#070709]">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                            {isAdmin ? 'FLEET ENGINE STATE' : 'SERVICE ENGINE STATE'}
                                        </span>
                                        <span className="text-[10px] font-mono font-medium text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                            {telemetry.totalInstances > 0 ? `${Math.round((telemetry.runningCount / telemetry.totalInstances) * 100)}% Operational` : 'Standby'}
                                        </span>
                                    </div>
                                    <div className="text-3xl font-mono font-bold text-zinc-100 tracking-tight mt-2.5 tabular-nums">
                                        {telemetry.runningCount}{' '}
                                        <span className="text-sm font-normal text-zinc-500">/ {telemetry.totalInstances} active instances</span>
                                    </div>
                                </div>

                                {/* Segmented Distribution Track */}
                                <div className="mt-5 space-y-2">
                                    <div className="h-1.5 w-full bg-[#121215] rounded-full overflow-hidden flex">
                                        {telemetry.totalInstances > 0 ? (
                                            <>
                                                <div
                                                    className="h-full bg-emerald-500 transition-all duration-500"
                                                    style={{ width: `${(telemetry.runningCount / telemetry.totalInstances) * 100}%` }}
                                                    title={`Running: ${telemetry.runningCount}`}
                                                />
                                                <div
                                                    className="h-full bg-amber-500 transition-all duration-500"
                                                    style={{ width: `${(fleetSuspendedServers / telemetry.totalInstances) * 100}%` }}
                                                    title={`Suspended: ${fleetSuspendedServers}`}
                                                />
                                                <div
                                                    className="h-full bg-blue-500 transition-all duration-500"
                                                    style={{ width: `${(fleetInstallingServers / telemetry.totalInstances) * 100}%` }}
                                                    title={`Installing: ${fleetInstallingServers}`}
                                                />
                                                <div
                                                    className="h-full bg-zinc-800 transition-all duration-500"
                                                    style={{ width: `${(fleetOfflineServers / telemetry.totalInstances) * 100}%` }}
                                                    title={`Offline: ${fleetOfflineServers}`}
                                                />
                                            </>
                                        ) : (
                                            <div className="h-full w-full bg-zinc-800/40" />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                                            {telemetry.runningCount} Running
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                            {fleetOfflineServers} Stopped
                                        </span>
                                        {fleetSuspendedServers > 0 && (
                                            <span className="flex items-center gap-1.5 text-amber-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                {fleetSuspendedServers} Suspended
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Hardware Allocation Cluster (7 Cols) */}
                            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.04] bg-[#070709]">
                                {/* Compute */}
                                <div className="p-4 sm:p-5 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-zinc-500 block">
                                            ASSIGNED COMPUTE
                                        </span>
                                        <div className="text-2xl font-mono font-bold text-zinc-100 mt-2 tabular-nums">
                                            {telemetry.totalCpu}%
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-1">
                                        <div className="h-1 w-full bg-[#121215] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-zinc-400 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, telemetry.totalCpu / 2)}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-mono text-zinc-500 block">
                                            Hardware limit
                                        </span>
                                    </div>
                                </div>

                                {/* Memory */}
                                <div className="p-4 sm:p-5 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-zinc-500 block">
                                            COMMITTED RAM
                                        </span>
                                        <div className="text-2xl font-mono font-bold text-zinc-100 mt-2 tabular-nums">
                                            {(telemetry.totalMemory / 1024).toFixed(1)}{' '}
                                            <span className="text-xs font-normal text-zinc-500">GB</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-1">
                                        <div className="h-1 w-full bg-[#121215] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-zinc-400 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, (telemetry.totalMemory / 8192) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-mono text-zinc-500 block">
                                            Dedicated allocation
                                        </span>
                                    </div>
                                </div>

                                {/* Storage */}
                                <div className="p-4 sm:p-5 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-zinc-500 block">
                                            STORAGE VOLUME
                                        </span>
                                        <div className="text-2xl font-mono font-bold text-zinc-100 mt-2 tabular-nums">
                                            {(telemetry.totalDisk / 1024).toFixed(1)}{' '}
                                            <span className="text-xs font-normal text-zinc-500">GB</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-1">
                                        <div className="h-1 w-full bg-[#121215] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-zinc-400 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, (telemetry.totalDisk / 32768) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-mono text-zinc-500 block">
                                            NVMe / ZFS Pool
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Instance Command Matrix / Tiered Showcase */}
                    <div className="space-y-4">
                        {/* Instance Toolbar: Title, View Switcher & Search Filter */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                            <div className="flex items-center gap-2.5">
                                <span className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-300 font-semibold">
                                    {isAdmin ? 'Deployed Instances & Services' : 'My Provisioned Services'}
                                </span>
                                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-300 border border-white/[0.06]">
                                    {filteredServers.length}
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* View Mode Switcher */}
                                <div className="flex items-center p-0.5 rounded-lg bg-[#070709] border border-white/[0.06] text-xs font-mono">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('showcase')}
                                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                            viewMode === 'showcase'
                                                ? 'bg-white/[0.08] text-white font-medium shadow-xs'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                        title="Showcase view: Featured focal instance with compact secondary fleet"
                                    >
                                        Showcase
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('matrix')}
                                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                            viewMode === 'matrix'
                                                ? 'bg-white/[0.08] text-white font-medium shadow-xs'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                        title="Dense matrix view: High-density administrative systems table"
                                    >
                                        Dense Matrix
                                    </button>
                                </div>

                                {/* Search Filter Bar */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Filter instances..."
                                        className="border border-white/[0.06] hover:border-white/[0.14] focus:border-white/[0.2] rounded-lg px-3 py-1.5 text-xs text-white bg-[#070709] outline-none w-48 sm:w-56 font-mono placeholder-zinc-600 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Instances Render */}
                        {filteredServers.length === 0 ? (
                            <div className="py-16 text-center text-xs text-zinc-500 font-mono rounded-xl border border-white/[0.04] bg-[#070709]">
                                No instances found matching current query.
                            </div>
                        ) : viewMode === 'showcase' ? (
                            <div className="space-y-4">
                                {/* Primary Focal Server */}
                                {focalServer && (
                                    <FocalServerCard
                                        key={focalServer.id}
                                        server={focalServer}
                                        currentStatus={serverStatuses[focalServer.uuid]}
                                        onOpenDetails={(s) => {
                                            setSelectedServer(s);
                                            setIsDetailsModalOpen(true);
                                        }}
                                        onStatusUpdate={handleStatusUpdate}
                                    />
                                )}

                                {/* Secondary Fleet Instances (Tiered down in visual weight) */}
                                {secondaryServers.length > 0 && (
                                    <div className="pt-2 space-y-2.5">
                                        <div className="flex items-center gap-2 px-1">
                                            <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-500 font-semibold">
                                                Additional Fleet Instances ({secondaryServers.length})
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {secondaryServers.map((server) => (
                                                <CompactServerRow
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
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Dense Matrix Mode (Full systems list for dense scanning) */
                            <div className="space-y-2">
                                {filteredServers.map((server) => (
                                    <CompactServerRow
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

                        {/* Pagination Footer */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="rounded-xl border border-white/[0.06] bg-[#070709] px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs font-mono text-zinc-400">
                                    Showing{' '}
                                    <span className="text-zinc-100 font-semibold">
                                        {(pagination.currentPage - 1) * pagination.perPage + 1}
                                    </span>{' '}
                                    to{' '}
                                    <span className="text-zinc-100 font-semibold">
                                        {Math.min(pagination.currentPage * pagination.perPage, pagination.total)}
                                    </span>{' '}
                                    of{' '}
                                    <span className="text-zinc-100 font-semibold">
                                        {pagination.total}
                                    </span>{' '}
                                    servers ({pagination.perPage} per page)
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={pagination.currentPage <= 1}
                                        onClick={() => onPageSelect && onPageSelect(pagination.currentPage - 1)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all inline-flex items-center gap-1 border ${
                                            pagination.currentPage <= 1
                                                ? 'opacity-40 cursor-not-allowed bg-transparent border-white/[0.04] text-zinc-600'
                                                : 'cursor-pointer bg-[#0A0A0D] text-zinc-300 border-white/[0.08] hover:bg-white/[0.06] hover:text-white'
                                        }`}
                                    >
                                        &larr; Prev
                                    </button>

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
                                                        <span className="px-1.5 text-xs text-zinc-600 font-mono select-none">
                                                            …
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onPageSelect && onPageSelect(p)}
                                                        className={`w-7 h-7 rounded-md text-xs font-mono font-medium transition-all inline-flex items-center justify-center border ${
                                                            isActive
                                                                ? 'bg-zinc-100 text-zinc-950 border-transparent font-bold shadow-xs'
                                                                : 'cursor-pointer bg-[#0A0A0D] text-zinc-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-white'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                </React.Fragment>
                                            );
                                        })}

                                    <button
                                        type="button"
                                        disabled={pagination.currentPage >= pagination.totalPages}
                                        onClick={() => onPageSelect && onPageSelect(pagination.currentPage + 1)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all inline-flex items-center gap-1 border ${
                                            pagination.currentPage >= pagination.totalPages
                                                ? 'opacity-40 cursor-not-allowed bg-transparent border-white/[0.04] text-zinc-600'
                                                : 'cursor-pointer bg-[#0A0A0D] text-zinc-300 border-white/[0.08] hover:bg-white/[0.06] hover:text-white'
                                        }`}
                                    >
                                        Next &rarr;
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ---------- RIGHT: SYSTEMS OPERATIONS RAIL ---------- */}
                <aside className="w-full lg:w-[320px] max-w-full lg:max-w-[340px] bg-[#070709] border border-white/[0.06] rounded-xl overflow-hidden shrink-0 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
                    {/* Rail Master Title */}
                    <div className="bg-[#0A0A0D] border-b border-white/[0.04] px-4 py-3 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 font-semibold">
                            {isAdmin ? 'CLUSTER OPERATIONS' : 'SERVICE OPERATIONS'}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
                    </div>

                    {isAdmin ? (
                        <>
                            {/* 1. Support Tickets Queue (Admin System-Wide) */}
                            <div className="bg-white/[0.01] border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold flex items-center gap-2">
                                    Support Queue
                                    <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full border ${
                                        openTickets.length > 0
                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            : 'bg-white/[0.03] text-zinc-500 border-white/[0.04]'
                                    }`}>
                                        {openTickets.length} pending
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => history.push('/support')}
                                    className="text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none p-0 transition-colors"
                                >
                                    Manage &rarr;
                                </button>
                            </div>

                            {ticketsLoading ? (
                                <div className="px-4 py-3.5 border-b border-white/[0.04] text-center text-xs text-zinc-500 font-mono animate-pulse">
                                    Checking support queue...
                                </div>
                            ) : openTickets.length > 0 ? (
                                openTickets.slice(0, 3).map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        onClick={() => history.push('/support')}
                                        className="px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[11px] text-zinc-500">
                                                #T-{ticket.ticket_id || ticket.id}
                                            </span>
                                            <span className="text-xs flex-1 truncate text-zinc-200 font-medium">
                                                {ticket.title}
                                            </span>
                                            <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                                                ticket.priority === 'critical' || ticket.priority === 'high'
                                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    : ticket.priority === 'medium'
                                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                    : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06]'
                                            }`}>
                                                {ticket.priority || 'Normal'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1.5 font-mono">
                                            <span className="truncate max-w-[140px] text-zinc-400">
                                                {ticket.user?.username || 'Client'}
                                            </span>
                                            <span>
                                                {formatRelativeTime(ticket.updated_at || ticket.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-4 border-b border-white/[0.04] text-center">
                                    <p className="text-xs text-zinc-300 font-medium m-0">Support queue clear</p>
                                    <p className="text-[11px] text-zinc-500 mt-0.5 mb-2">All customer inquiries addressed.</p>
                                    <button
                                        type="button"
                                        onClick={() => history.push('/support')}
                                        className="text-xs text-zinc-400 hover:text-white font-medium cursor-pointer bg-transparent border-none p-0 font-mono transition-colors"
                                    >
                                        View all tickets &rarr;
                                    </button>
                                </div>
                            )}

                            {/* 2. Cluster Nodes & Live Health */}
                            <div className="bg-white/[0.01] border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold flex items-center gap-2">
                                    Cluster Nodes
                                    <span className="bg-white/[0.03] text-emerald-400 border border-emerald-500/20 text-[10px] font-mono px-2 py-0.2 rounded-full inline-flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
                                        {nodesOnlineCount} / {nodesTotalCount} Online
                                    </span>
                                </span>
                                <a
                                    href="/admin/nodes"
                                    className="text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none p-0 transition-colors"
                                >
                                    Nodes &rarr;
                                </a>
                            </div>

                            <div className="px-4 py-3 border-b border-white/[0.04] space-y-2">
                                {clusterNodes.slice(0, 4).map((node) => {
                                    const isOnline = node.status === 'online';
                                    const isMaint = node.maintenance_mode || node.status === 'maintenance';
                                    return (
                                        <div key={node.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-[#0A0A0D] border border-white/[0.04]">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                        isMaint
                                                            ? 'bg-amber-400'
                                                            : isOnline
                                                            ? 'bg-emerald-500/80 animate-pulse'
                                                            : 'bg-red-500'
                                                    }`}
                                                />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                                                        <span className="truncate">{node.name}</span>
                                                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/[0.04] text-zinc-400 uppercase">
                                                            {node.location || 'Node'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-zinc-500 truncate">
                                                        {node.fqdn}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-xs font-mono font-medium text-zinc-200 block">
                                                    {node.servers_count}
                                                </span>
                                                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">
                                                    servers
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="pt-1">
                                    <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 mb-1">
                                        <span>Cluster Daemon Health</span>
                                        <span className="text-zinc-300 font-medium">
                                            {nodesTotalCount > 0 ? Math.round((nodesOnlineCount / nodesTotalCount) * 100) : 0}%
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-[#121215] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                            style={{
                                                width: nodesTotalCount > 0 ? `${(nodesOnlineCount / nodesTotalCount) * 100}%` : '0%',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 3. Server Fleet Status */}
                            <div className="bg-white/[0.01] border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold flex items-center gap-2">
                                    Fleet Distribution
                                    <span className="bg-white/[0.03] text-zinc-300 border border-white/[0.06] text-[10px] font-mono px-2 py-0.2 rounded-full">
                                        {fleetTotalServers} Total
                                    </span>
                                </span>
                                <a
                                    href="/admin/servers"
                                    className="text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none p-0 transition-colors"
                                >
                                    Fleet &rarr;
                                </a>
                            </div>

                            <div className="px-4 py-3.5 border-b border-white/[0.04] space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                    <div className="bg-[#0A0A0D] border border-white/[0.04] rounded-lg p-2.5 flex flex-col justify-between">
                                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                                            Running
                                        </span>
                                        <span className="text-lg font-bold text-zinc-100 mt-1 tabular-nums">
                                            {fleetRunningServers}
                                        </span>
                                    </div>

                                    <div className="bg-[#0A0A0D] border border-white/[0.04] rounded-lg p-2.5 flex flex-col justify-between">
                                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                            Offline
                                        </span>
                                        <span className="text-lg font-bold text-zinc-400 mt-1 tabular-nums">
                                            {fleetOfflineServers}
                                        </span>
                                    </div>

                                    <div className="bg-[#0A0A0D] border border-white/[0.04] rounded-lg p-2.5 flex flex-col justify-between">
                                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                            Suspended
                                        </span>
                                        <span className={`text-lg font-bold mt-1 tabular-nums ${fleetSuspendedServers > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                                            {fleetSuspendedServers}
                                        </span>
                                    </div>

                                    <div className="bg-[#0A0A0D] border border-white/[0.04] rounded-lg p-2.5 flex flex-col justify-between">
                                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            Installing
                                        </span>
                                        <span className="text-lg font-bold text-zinc-400 mt-1 tabular-nums">
                                            {fleetInstallingServers}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Admin Quick Control Shortcuts */}
                            <div className="bg-white/[0.01] border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">
                                    Root Admin Operations
                                </span>
                            </div>

                            <div className="p-3 border-b border-white/[0.04] grid grid-cols-2 gap-2 text-xs font-mono">
                                <a
                                    href="/admin/nodes"
                                    className="group px-2.5 py-2 rounded-lg bg-[#0A0A0D] border border-white/[0.04] hover:border-white/[0.12] transition-colors flex items-center gap-2 text-zinc-300 hover:text-white no-underline"
                                >
                                    <div className="truncate">
                                        <div className="text-[11px] font-medium leading-none">Nodes</div>
                                        <div className="text-[9px] text-zinc-500 mt-0.5">Daemon host</div>
                                    </div>
                                </a>

                                <a
                                    href="/admin/servers"
                                    className="group px-2.5 py-2 rounded-lg bg-[#0A0A0D] border border-white/[0.04] hover:border-white/[0.12] transition-colors flex items-center gap-2 text-zinc-300 hover:text-white no-underline"
                                >
                                    <div className="truncate">
                                        <div className="text-[11px] font-medium leading-none">Servers</div>
                                        <div className="text-[9px] text-zinc-500 mt-0.5">Admin fleet</div>
                                    </div>
                                </a>

                                <button
                                    type="button"
                                    onClick={() => history.push('/user-management')}
                                    className="group px-2.5 py-2 rounded-lg bg-[#0A0A0D] border border-white/[0.04] hover:border-white/[0.12] transition-colors flex items-center gap-2 text-zinc-300 hover:text-white text-left cursor-pointer"
                                >
                                    <div className="truncate">
                                        <div className="text-[11px] font-medium leading-none">Users</div>
                                        <div className="text-[9px] text-zinc-500 mt-0.5">Accounts</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => history.push('/billing-operations')}
                                    className="group px-2.5 py-2 rounded-lg bg-[#0A0A0D] border border-white/[0.04] hover:border-white/[0.12] transition-colors flex items-center gap-2 text-zinc-300 hover:text-white text-left cursor-pointer"
                                >
                                    <div className="truncate">
                                        <div className="text-[11px] font-medium leading-none">Billing</div>
                                        <div className="text-[9px] text-zinc-500 mt-0.5">Operations</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => history.push('/reimage-requests')}
                                    className="group px-2.5 py-2 rounded-lg bg-[#0A0A0D] border border-white/[0.04] hover:border-white/[0.12] transition-colors flex items-center gap-2 text-zinc-300 hover:text-white text-left cursor-pointer"
                                >
                                    <div className="truncate">
                                        <div className="text-[11px] font-medium leading-none">Reimages</div>
                                        <div className="text-[9px] text-zinc-500 mt-0.5">OS requests</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => history.push('/audit-logs')}
                                    className="group px-2.5 py-2 rounded-lg bg-[#0A0A0D] border border-white/[0.04] hover:border-white/[0.12] transition-colors flex items-center gap-2 text-zinc-300 hover:text-white text-left cursor-pointer"
                                >
                                    <div className="truncate">
                                        <div className="text-[11px] font-medium leading-none">Audit Logs</div>
                                        <div className="text-[9px] text-zinc-500 mt-0.5">Security trails</div>
                                    </div>
                                </button>
                            </div>

                            {/* 5. Cluster Security Audit */}
                            <div className="bg-white/[0.01] border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">
                                    Security Audit Log
                                </span>
                                <button
                                    type="button"
                                    onClick={() => history.push('/audit-logs')}
                                    className="text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none p-0 transition-colors"
                                >
                                    View all &rarr;
                                </button>
                            </div>

                            <div className="px-4 py-3.5 space-y-3">
                                {activityLoading ? (
                                    <div className="py-2 text-center text-xs text-zinc-500 font-mono animate-pulse">
                                        Loading activity...
                                    </div>
                                ) : activityLogs.length > 0 ? (
                                    activityLogs.map((log, index) => {
                                        const actor = log.relationships?.actor?.attributes?.username || user?.username || 'admin';
                                        const time = formatRelativeTime(log.attributes?.timestamp);
                                        const eventTitle = formatEventName(log.attributes?.event, log.attributes?.description);

                                        return (
                                            <div key={log.attributes?.id || index} className="text-xs">
                                                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                                                    <span className="text-zinc-200 font-semibold">{actor}</span>
                                                    <span>{time}</span>
                                                </div>
                                                <div className="text-zinc-300 mt-1 text-xs font-medium font-sans">
                                                    {eventTitle}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-2 text-center text-xs text-zinc-500">
                                        No recent cluster events recorded.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* 1. Open Tickets */}
                            <div className="bg-white/[0.01] border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold flex items-center gap-2">
                                    Support Desk
                                    <span className="bg-white/[0.03] text-zinc-400 border border-white/[0.06] text-[10px] font-mono px-2 py-0.2 rounded-full">
                                        {openTickets.length}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => history.push('/support')}
                                    className="text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none p-0 transition-colors"
                                >
                                    + New
                                </button>
                            </div>

                            {ticketsLoading ? (
                                <div className="px-4 py-3.5 border-b border-white/[0.04] text-center text-xs text-zinc-500 font-mono animate-pulse">
                                    Checking support desk...
                                </div>
                            ) : openTickets.length > 0 ? (
                                openTickets.slice(0, 2).map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        onClick={() => history.push('/support')}
                                        className="px-4 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
                                    >
                                        <div className="py-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[11px] text-zinc-500">
                                                    #T-{ticket.ticket_id || ticket.id}
                                                </span>
                                                <span className="text-xs flex-1 truncate text-zinc-200 font-medium">
                                                    {ticket.title}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[10px] font-mono text-zinc-300">
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${
                                                            ticket.status === 'open'
                                                                ? 'bg-emerald-500/80'
                                                                : ticket.status === 'answered'
                                                                ? 'bg-purple-400'
                                                                : 'bg-blue-400'
                                                        }`}
                                                    />
                                                    {ticket.status === 'in_progress' ? 'In Progress' : ticket.status}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500 mt-1.5 m-0 font-mono">
                                                {ticket.department} &bull; Updated {formatRelativeTime(ticket.updated_at || ticket.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-4 border-b border-white/[0.04] text-center">
                                    <p className="text-xs text-zinc-400 m-0">No active support tickets.</p>
                                    <button
                                        type="button"
                                        onClick={() => history.push('/support')}
                                        className="mt-1.5 text-xs text-zinc-300 hover:text-white font-medium cursor-pointer bg-transparent border-none p-0 font-mono transition-colors"
                                    >
                                        Open a ticket &rarr;
                                    </button>
                                </div>
                            )}

                            {/* 2. Account & Billing Standing */}
                            <div className="bg-white/[0.01] border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">
                                    Subscription & Standing
                                </span>
                                <button
                                    type="button"
                                    onClick={() => history.push('/billing')}
                                    className="text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none p-0 transition-colors"
                                >
                                    Manage &rarr;
                                </button>
                            </div>

                            <div className="px-4 py-3.5 border-b border-white/[0.04] space-y-2.5 text-xs font-mono">
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-500">Next renewal due</span>
                                    <span className="text-zinc-200 font-medium">{nextDueDate}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-500">Active compute instances</span>
                                    <span className="text-zinc-200 font-medium">{serverList.length}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-500">Suspended instances</span>
                                    <span className={`font-medium ${suspendedServers.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {suspendedServers.length}
                                    </span>
                                </div>

                                {suspendedServers.length > 0 ? (
                                    <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300 leading-relaxed font-sans flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5">
                                            {suspendedServers.length} server(s) suspended.
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => history.push('/billing')}
                                            className="text-xs font-semibold underline ml-1 cursor-pointer bg-transparent border-none p-0 text-amber-200"
                                        >
                                            Renew &rarr;
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-2.5 rounded-lg border border-white/[0.04] bg-[#0A0A0D] px-3 py-2 text-[11px] text-zinc-400 leading-relaxed font-sans flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0" />
                                        <span>Account in good standing. All compute nodes verified operational.</span>
                                    </div>
                                )}
                            </div>

                            {/* 3. Incidents & Activity */}
                            <div className="bg-white/[0.01] border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">
                                    Activity & Audit Stream
                                </span>
                                <button
                                    type="button"
                                    onClick={() => history.push('/account/activity')}
                                    className="text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none p-0 transition-colors"
                                >
                                    View all &rarr;
                                </button>
                            </div>

                            <div className="px-4 py-3.5 space-y-3">
                                {activityLoading ? (
                                    <div className="py-2 text-center text-xs text-zinc-500 font-mono animate-pulse">
                                        Loading activity...
                                    </div>
                                ) : activityLogs.length > 0 ? (
                                    activityLogs.map((log, index) => {
                                        const actor = log.relationships?.actor?.attributes?.username || user?.username || 'user';
                                        const time = formatRelativeTime(log.attributes?.timestamp);
                                        const eventTitle = formatEventName(log.attributes?.event, log.attributes?.description);

                                        return (
                                            <div key={log.attributes?.id || index} className="text-xs">
                                                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                                                    <span className="text-zinc-300 font-semibold">{actor}</span>
                                                    <span>{time}</span>
                                                </div>
                                                <div className="text-zinc-300 mt-1 text-xs font-medium font-sans">
                                                    {eventTitle}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-2 text-center text-xs text-zinc-500">
                                        No recent activity recorded.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
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
                        <div className="flex justify-between py-2 border-b border-white/[0.04]">
                            <span className="text-zinc-500">UUID</span>
                            <span className="text-zinc-200">{selectedServer.uuid}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/[0.04]">
                            <span className="text-zinc-500">Identifier</span>
                            <span className="text-zinc-200">{selectedServer.id}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/[0.04]">
                            <span className="text-zinc-500">Node Location</span>
                            <span className="text-zinc-200">{selectedServer.node || 'Local Node'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/[0.04]">
                            <span className="text-zinc-500">Allocated Ports</span>
                            <span className="text-zinc-200">
                                {selectedServer.allocations?.map((a) => `${a.alias || a.ip}:${a.port}`).join(', ') || 'None'}
                            </span>
                        </div>
                        {selectedServer.isFiveM && (selectedServer as any).txadminUrl && (
                            <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                                <span className="text-zinc-500">txAdmin Web Panel</span>
                                <a
                                    href={(selectedServer as any).txadminUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
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
                                className="px-4 py-2 rounded-md text-xs font-semibold cursor-pointer transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 bg-zinc-100 text-zinc-950 hover:bg-white border border-transparent shadow-xs active:scale-[0.98]"
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
