import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { useHistory } from 'react-router-dom';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import { Server } from '@/api/server/getServer';
import getServers, { getFleetStats, FleetStats } from '@/api/getServers';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { Skeleton } from '@/components/elements/Skeleton';
import { TableSkeleton } from '@/components/elements/TableSkeleton';
import getServerResourceUsage, { ServerPowerState, ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString } from '@/lib/formatters';

interface InstanceFleetRowProps {
    server: Server;
    currentStatus?: string;
    onStatusUpdate?: (uuid: string, status: ServerPowerState | 'suspended' | 'installing' | 'offline') => void;
}

const InstanceFleetRow: React.FC<InstanceFleetRowProps> = ({ server, currentStatus, onStatusUpdate }) => {
    const history = useHistory();
    const alloc = server.allocations?.[0];
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
    let pillClass = 'bg-[#1F0A0A] text-red-400 border-red-500/30';

    if (isSuspended || activeStatus === 'suspended') {
        stateLabel = 'Suspended';
        dotClass = 'bg-[#EF4444]';
        pillClass = 'bg-[#1F080A] text-[#EF4444] border-[#EF4444]/40';
    } else if (isInstalling || activeStatus === 'installing') {
        stateLabel = 'Installing';
        dotClass = 'bg-[#3B82F6] animate-pulse';
        pillClass = 'bg-[#0A1428] text-[#3B82F6] border-[#3B82F6]/40';
    } else if (isChecking && !stats && !currentStatus) {
        stateLabel = 'Syncing…';
        dotClass = 'bg-zinc-500 animate-pulse';
        pillClass = 'bg-[#141416] text-[#A1A1AA] border-[#27272A]';
    } else if (activeStatus === 'running') {
        stateLabel = 'Running';
        dotClass = 'bg-[#10B981] animate-pulse';
        pillClass = 'bg-[#051F14] text-[#10B981] border-[#10B981]/40';
    } else if (activeStatus === 'starting') {
        stateLabel = 'Restarting';
        dotClass = 'bg-[#F59E0B] animate-pulse';
        pillClass = 'bg-[#1C1405] text-[#F59E0B] border-[#F59E0B]/40';
    } else if (activeStatus === 'stopping') {
        stateLabel = 'Stopping';
        dotClass = 'bg-[#F59E0B] animate-pulse';
        pillClass = 'bg-[#1C1405] text-[#F59E0B] border-[#F59E0B]/40';
    } else {
        stateLabel = 'Offline';
        dotClass = 'bg-red-500/80';
        pillClass = 'bg-[#1F0A0A] text-red-400 border-red-500/20';
    }

    const memoryStr = stats?.status === 'running' || stats?.status === 'starting'
        ? bytesToString(stats.memoryUsageInBytes)
        : `${server.limits.memory} MB limit`;
    const cpuStr = stats?.status === 'running' || stats?.status === 'starting'
        ? `${stats.cpuUsagePercent.toFixed(1)}%`
        : `${server.limits.cpu}% limit`;

    return (
        <tr className="hover:bg-[#050505] transition-colors group">
            {/* Server ID */}
            <td className="py-3.5 px-4 sm:px-5 font-mono text-xs text-[#737373] group-hover:text-[#A0A0A0]">
                {server.id}
            </td>

            {/* Server Name & UUID */}
            <td className="py-3.5 px-4 sm:px-5">
                <div className="font-sans text-sm font-medium text-[#FFFFFF] tracking-tight">
                    {server.name}
                </div>
                <div className="text-[10px] font-mono text-[#525252] mt-0.5">
                    {server.uuid.split('-')[0]}...
                </div>
            </td>

            {/* Status Pill */}
            <td className="py-3.5 px-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border shrink-0 ${pillClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                    <span>{stateLabel}</span>
                </span>
            </td>

            {/* Host Node */}
            <td className="py-3.5 px-4 text-xs font-mono text-[#D4D4D4]">
                {server.node || 'Local Node'}
            </td>

            {/* Connection Address with CopyOnClick */}
            <td className="py-3.5 px-4">
                {alloc ? (
                    <CopyOnClick text={`${alloc.alias || alloc.ip}:${alloc.port}`}>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#0A0A0A] border border-[#1A1A1A] hover:border-[#333333] font-mono text-xs text-[#D4D4D4] hover:text-[#FFFFFF] cursor-pointer transition-colors">
                            <span>{alloc.alias || alloc.ip}:{alloc.port}</span>
                            <svg className="w-3 h-3 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                    </CopyOnClick>
                ) : (
                    <span className="font-mono text-xs text-[#525252]">—</span>
                )}
            </td>

            {/* Memory */}
            <td className="py-3.5 px-4">
                <div className="font-mono text-xs text-[#FFFFFF]">
                    {memoryStr}
                </div>
                <div className="h-1 w-20 bg-[#141414] rounded-full overflow-hidden mt-1.5">
                    <div
                        className="h-full bg-[#E5A93C] rounded-full"
                        style={{ width: `${Math.min(100, (server.limits.memory / 4096) * 100)}%` }}
                    />
                </div>
            </td>

            {/* CPU */}
            <td className="py-3.5 px-4">
                <div className="font-mono text-xs text-[#FFFFFF]">
                    {cpuStr}
                </div>
                <div className="h-1 w-16 bg-[#141414] rounded-full overflow-hidden mt-1.5">
                    <div
                        className="h-full bg-[#FFFFFF] rounded-full"
                        style={{ width: `${Math.min(100, server.limits.cpu / 2)}%` }}
                    />
                </div>
            </td>

            {/* Actions */}
            <td className="py-3.5 px-4 sm:px-5 text-right whitespace-nowrap">
                <button
                    type="button"
                    onClick={() => history.push(`/server/${server.id}`)}
                    className="px-3.5 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] text-xs font-semibold transition-all cursor-pointer border-none shadow-sm inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                    <span>Console</span>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </button>
            </td>
        </tr>
    );
};

export const InstanceFleetView: React.FC = () => {
    const history = useHistory();
    const { isAdmin } = useUserRole();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'running' | 'stopped'>('all');
    const [pageSize, setPageSize] = useState<number | 'all'>('all');
    const [page, setPage] = useState(1);
    const [serverStatuses, setServerStatuses] = useState<Record<string, string>>({});

    const handleStatusUpdate = useCallback((uuid: string, status: string) => {
        setServerStatuses((prev) => {
            if (prev[uuid] === status) return prev;
            return { ...prev, [uuid]: status };
        });
    }, []);

    // Fleet-wide stats directly from database
    const { data: fleetStats } = useSWR<FleetStats>(
        ['/api/client/stats', isAdmin],
        () => getFleetStats(isAdmin ? 'admin-all' : undefined),
        { refreshInterval: 15000 }
    );

    // Fetch all servers across the fleet (perPage=1000 to load all instances)
    const { data: servers } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers-fleet-all', isAdmin],
        () => getServers({ perPage: 1000, type: isAdmin ? 'admin-all' : undefined }),
        { revalidateOnFocus: false }
    );

    const allServers = servers?.items || [];

    // Synchronize fleet-wide server power statuses from backend
    useEffect(() => {
        if (fleetStats?.statuses && Object.keys(fleetStats.statuses).length > 0) {
            setServerStatuses((prev) => ({ ...fleetStats.statuses, ...prev }));
        }
    }, [fleetStats?.statuses]);

    // Fleet-wide background scanner as fallback when fleetStats.statuses is not yet available
    useEffect(() => {
        if (!allServers.length) return;
        if (fleetStats?.statuses && Object.keys(fleetStats.statuses).length > 0) return;

        let isCancelled = false;

        const scanAll = async () => {
            const batchSize = 10;
            for (let i = 0; i < allServers.length; i += batchSize) {
                if (isCancelled) break;
                const batch = allServers.slice(i, i + batchSize);
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
    }, [allServers, fleetStats?.statuses]);

    const telemetry = useMemo(() => {
        let totalCpu = fleetStats?.cpu ?? 0;
        let totalMemory = fleetStats?.memory ?? 0;
        let totalDisk = fleetStats?.disk ?? 0;
        let runningCount = 0;

        if (typeof fleetStats?.running === 'number') {
            runningCount = fleetStats.running;
        } else {
            allServers.forEach((server) => {
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

        const totalInstances = fleetStats?.total ?? allServers.length;
        const stoppedCount = Math.max(0, totalInstances - runningCount);

        return {
            totalInstances,
            runningCount,
            stoppedCount,
            totalCpu,
            totalMemory,
            totalDisk,
        };
    }, [allServers, fleetStats, serverStatuses]);

    // Search & filter across ALL servers in the fleet
    const filtered = useMemo(() => {
        return allServers.filter((s) => {
            const q = searchQuery.toLowerCase().trim();
            const matchesQuery =
                !q ||
                s.name.toLowerCase().includes(q) ||
                s.id.toLowerCase().includes(q) ||
                (s.node && s.node.toLowerCase().includes(q));
            if (!matchesQuery) return false;

            const currentStatus = serverStatuses[s.uuid];
            if (filterType === 'running') return currentStatus === 'running';
            if (filterType === 'stopped') return currentStatus !== 'running';
            return true;
        });
    }, [allServers, searchQuery, filterType, serverStatuses]);

    // Reset pagination to page 1 whenever search, filter, or page size changes
    useEffect(() => {
        setPage(1);
    }, [searchQuery, filterType, pageSize]);

    // Paginated or complete items to display
    const paginatedItems = useMemo(() => {
        if (pageSize === 'all') return filtered;
        const start = (page - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, page, pageSize]);

    const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));

    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-6 py-8 select-none">
            <div className="max-w-[1324px] mx-auto">
                {/* Header: Modern precision sans-serif */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#141414] pb-6 mb-6">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-sans font-semibold text-[#FFFFFF] tracking-tight m-0">
                            {isAdmin ? 'All Instances & Bots' : 'My Servers & Bots'}
                        </h1>
                        <p className="text-xs text-[#8A8A8A] font-sans mt-1.5 m-0 leading-relaxed">
                            {isAdmin
                                ? 'High-performance servers, discord bots, app containers, and instances across all nodes.'
                                : 'Your active servers, bots, and provisioned container environments.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Page Size Switcher */}
                        <div className="flex items-center bg-[#0A0A0A] border border-[#1F1F1F] rounded-md p-1 gap-1">
                            <span className="text-[10px] font-mono text-[#6B7280] px-1.5 uppercase tracking-wider">Show:</span>
                            {(['all', 25, 50, 100] as const).map((size) => (
                                <button
                                    key={size}
                                    type="button"
                                    onClick={() => setPageSize(size)}
                                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border-none ${
                                        pageSize === size
                                            ? 'bg-[#FFFFFF] text-[#000000] font-bold shadow-sm'
                                            : 'bg-transparent text-[#737373] hover:text-[#FFFFFF]'
                                    }`}
                                >
                                    {size === 'all' ? 'All' : size}
                                </button>
                            ))}
                        </div>

                        {/* Filter Pill Switcher */}
                        <div className="flex items-center bg-[#0A0A0A] border border-[#1F1F1F] rounded-md p-1 gap-1">
                            {(['all', 'running', 'stopped'] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setFilterType(t)}
                                    className={`px-3 py-1 rounded text-[11px] uppercase font-mono tracking-wider transition-colors cursor-pointer border-none ${
                                        filterType === t
                                            ? 'bg-[#FFFFFF] text-[#000000] font-semibold shadow-sm'
                                            : 'bg-transparent text-[#737373] hover:text-[#FFFFFF]'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* Search Bar */}
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter servers, bots, nodes..."
                            className="w-56 text-xs bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] rounded-md px-3.5 py-1.5 text-[#FFFFFF] placeholder-[#525252] font-mono outline-none transition-colors"
                        />
                    </div>
                </div>

                {/* Fleet Overview Micro-Bento */}
                <div className="grid grid-cols-2 md:grid-cols-4 bg-[#000000] border border-[#1F1F1F] rounded-lg mb-6 divide-y md:divide-y-0 md:divide-x divide-[#141414] overflow-hidden">
                    <div className="p-4 sm:p-5">
                        <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                            Total Instances
                        </span>
                        <div className="text-2xl font-mono font-medium text-[#FFFFFF] mt-1">
                            {!servers && !fleetStats ? (
                                <Skeleton height={28} width={50} rounded="sm" className="my-0.5" />
                            ) : (
                                telemetry.totalInstances
                            )}
                        </div>
                        <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                            {allServers.length > 0 ? `${allServers.length} provisioned in fleet` : 'Provisioned containers'}
                        </span>
                    </div>

                    <div className="p-4 sm:p-5">
                        <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                            Active Fleet
                        </span>
                        <div className="text-2xl font-mono font-medium text-[#10B981] mt-1 flex items-center gap-2">
                            {!servers && !fleetStats ? (
                                <Skeleton height={28} width={70} rounded="sm" className="my-0.5" />
                            ) : (
                                <>
                                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                                    {telemetry.runningCount}{' '}
                                    <span className="text-xs font-normal text-[#737373]">online</span>
                                </>
                            )}
                        </div>
                        <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                            {telemetry.stoppedCount} stopped / standby
                        </span>
                    </div>

                    <div className="p-4 sm:p-5">
                        <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                            Committed RAM
                        </span>
                        <div className="text-2xl font-mono font-medium text-[#FFFFFF] mt-1">
                            {!servers && !fleetStats ? (
                                <Skeleton height={28} width={65} rounded="sm" className="my-0.5" />
                            ) : (
                                <>
                                    {(telemetry.totalMemory / 1024).toFixed(1)}{' '}
                                    <span className="text-xs font-normal text-[#737373]">GB</span>
                                </>
                            )}
                        </div>
                        <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                            Dedicated memory pool
                        </span>
                    </div>

                    <div className="p-4 sm:p-5">
                        <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                            Allocated CPU
                        </span>
                        <div className="text-2xl font-mono font-medium text-[#FFFFFF] mt-1">
                            {!servers && !fleetStats ? (
                                <Skeleton height={28} width={60} rounded="sm" className="my-0.5" />
                            ) : (
                                `${telemetry.totalCpu}%`
                            )}
                        </div>
                        <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                            Fleet compute limit
                        </span>
                    </div>
                </div>

                {/* Main Table View */}
                <div className="bg-[#000000] border border-[#1F1F1F] rounded-lg overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#F3F4F6] border-collapse">
                            <thead className="bg-[#050505] border-b border-[#141414] text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280]">
                                <tr>
                                    <th className="py-3 px-4 sm:px-5">Server ID</th>
                                    <th className="py-3 px-4 sm:px-5">Server Name</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Host Node</th>
                                    <th className="py-3 px-4">Connection Address</th>
                                    <th className="py-3 px-4">Memory</th>
                                    <th className="py-3 px-4">CPU</th>
                                    <th className="py-3 px-4 sm:px-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#141414]">
                                {!servers ? (
                                    <TableSkeleton
                                        rows={6}
                                        columns={[
                                            { width: '45px', align: 'left' },
                                            { width: '160px', align: 'left' },
                                            { width: '65px', align: 'left' },
                                            { width: '100px', align: 'left' },
                                            { width: '130px', align: 'left' },
                                            { width: '75px', align: 'left' },
                                            { width: '55px', align: 'left' },
                                            { width: '110px', align: 'right' },
                                        ]}
                                    />
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-xs text-[#737373] font-sans">
                                            No instances or bots found matching criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((server) => (
                                        <InstanceFleetRow
                                            key={server.id}
                                            server={server}
                                            currentStatus={serverStatuses[server.uuid]}
                                            onStatusUpdate={handleStatusUpdate}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination / Fleet Count Footer */}
                    <div className="bg-[#050505] border-t border-[#141414] px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs font-mono text-[#737373]">
                            {pageSize === 'all' ? (
                                <>
                                    Showing <span className="text-[#FFFFFF] font-semibold">all {filtered.length}</span> instances & bots across fleet
                                </>
                            ) : (
                                <>
                                    Showing{' '}
                                    <span className="text-[#FFFFFF] font-semibold">
                                        {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}
                                    </span>{' '}
                                    to{' '}
                                    <span className="text-[#FFFFFF] font-semibold">
                                        {Math.min(page * pageSize, filtered.length)}
                                    </span>{' '}
                                    of{' '}
                                    <span className="text-[#FFFFFF] font-semibold">
                                        {filtered.length}
                                    </span>{' '}
                                    instances & bots ({pageSize} per page)
                                </>
                            )}
                        </div>

                        {pageSize !== 'all' && totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => setPage(page - 1)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors border ${
                                        page <= 1
                                            ? 'opacity-40 cursor-not-allowed bg-transparent border-[#1F1F1F] text-[#525252]'
                                            : 'cursor-pointer bg-[#0A0A0A] text-[#EDEDED] border-[#1F1F1F] hover:bg-[#161616] hover:border-[#383838]'
                                    }`}
                                >
                                    &larr; Prev
                                </button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter((p) => {
                                        return (
                                            p === 1 ||
                                            p === totalPages ||
                                            Math.abs(p - page) <= 2
                                        );
                                    })
                                    .map((p, idx, arr) => {
                                        const prevP = arr[idx - 1];
                                        const showEllipsis = prevP && p - prevP > 1;
                                        const isActive = p === page;

                                        return (
                                            <React.Fragment key={p}>
                                                {showEllipsis && (
                                                    <span className="px-1.5 text-xs text-[#525252] font-mono select-none">
                                                        …
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setPage(p)}
                                                    className={`w-7 h-7 rounded-md text-xs font-mono font-medium transition-colors border ${
                                                        isActive
                                                            ? 'bg-[#FFFFFF] text-[#000000] border-transparent font-bold'
                                                            : 'cursor-pointer bg-[#0A0A0A] text-[#A0A0A0] border-[#1F1F1F] hover:bg-[#161616] hover:text-white'
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}

                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(page + 1)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors border ${
                                        page >= totalPages
                                            ? 'opacity-40 cursor-not-allowed bg-transparent border-[#1F1F1F] text-[#525252]'
                                            : 'cursor-pointer bg-[#0A0A0A] text-[#EDEDED] border-[#1F1F1F] hover:bg-[#161616] hover:border-[#383838]'
                                    }`}
                                >
                                    Next &rarr;
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default InstanceFleetView;

