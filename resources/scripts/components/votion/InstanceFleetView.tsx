import React, { useState, useMemo } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { useHistory } from 'react-router-dom';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { Skeleton } from '@/components/elements/Skeleton';
import { TableSkeleton } from '@/components/elements/TableSkeleton';

export const InstanceFleetView: React.FC = () => {
    const history = useHistory();
    const { isAdmin } = useUserRole();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'running' | 'stopped'>('all');

    const { data: servers } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers', isAdmin],
        () => getServers({ type: isAdmin ? 'admin-all' : undefined })
    );

    const serverList = servers?.items || [];

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
            stoppedCount: serverList.length - runningCount,
            totalCpu,
            totalMemory,
            totalDisk,
        };
    }, [serverList]);

    const filtered = serverList.filter((s) => {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
            s.name.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q) ||
            (s.node && s.node.toLowerCase().includes(q));
        if (!matchesQuery) return false;

        const isRunning = !s.status && !s.isNodeUnderMaintenance;
        if (filterType === 'running') return isRunning;
        if (filterType === 'stopped') return !isRunning;
        return true;
    });

    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-6 py-8 select-none">
            <div className="max-w-[1324px] mx-auto">
                {/* Header: Editorial Page title with SangBleu / Newsreader serif */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#141414] pb-6 mb-6">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#FFFFFF] tracking-tight m-0">
                            Game Servers
                        </h1>
                        <p className="text-xs text-[#8A8A8A] font-sans mt-1.5 m-0 leading-relaxed">
                            High-performance game servers, containers, and active instances across all nodes.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
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
                            placeholder="Filter game servers..."
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
                            {!servers ? <Skeleton height={28} width={50} rounded="sm" className="my-0.5" /> : telemetry.totalInstances}
                        </div>
                        <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                            Provisioned containers
                        </span>
                    </div>

                    <div className="p-4 sm:p-5">
                        <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                            Active Fleet
                        </span>
                        <div className="text-2xl font-mono font-medium text-[#10B981] mt-1 flex items-center gap-2">
                            {!servers ? (
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
                            {!servers ? (
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
                            {!servers ? (
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
                                            No game servers found matching criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((server) => {
                                        const alloc = server.allocations?.[0];
                                        const isSuspended = server.status === 'suspended' || server.isNodeUnderMaintenance;
                                        const isStarting = server.status === 'installing' || server.status === 'restoring_backup';

                                        return (
                                            <tr
                                                key={server.id}
                                                className="hover:bg-[#050505] transition-colors group"
                                            >
                                                {/* Server ID */}
                                                <td className="py-3.5 px-4 sm:px-5 font-mono text-xs text-[#737373] group-hover:text-[#A0A0A0]">
                                                    {server.id}
                                                </td>

                                                {/* Server Name & UUID */}
                                                <td className="py-3.5 px-4 sm:px-5">
                                                    <div className="font-serif text-sm font-normal text-[#FFFFFF] tracking-tight">
                                                        {server.name}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-[#525252] mt-0.5">
                                                        {server.uuid.split('-')[0]}...
                                                    </div>
                                                </td>

                                                {/* Status Pill */}
                                                <td className="py-3.5 px-4">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border shrink-0 ${
                                                            isSuspended
                                                                ? 'bg-[#1F080A] text-[#EF4444] border-[#EF4444]/40'
                                                                : isStarting
                                                                ? 'bg-[#1C1405] text-[#F59E0B] border-[#F59E0B]/40'
                                                                : 'bg-[#051F14] text-[#10B981] border-[#10B981]/40'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`w-1.5 h-1.5 rounded-full ${
                                                                isSuspended
                                                                    ? 'bg-[#EF4444]'
                                                                    : isStarting
                                                                    ? 'bg-[#F59E0B]'
                                                                    : 'bg-[#10B981] animate-pulse'
                                                            }`}
                                                        />
                                                        <span>{isSuspended ? 'Suspended' : isStarting ? 'Starting' : 'Running'}</span>
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
                                                        {server.limits.memory} <span className="text-[10px] text-[#737373]">MB</span>
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
                                                        {server.limits.cpu}%
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
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default InstanceFleetView;

