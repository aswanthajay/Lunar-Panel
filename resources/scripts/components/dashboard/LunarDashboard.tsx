import React, { useState, useMemo } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { useHistory } from 'react-router-dom';
import { PaginatedResult } from '@/api/http';
import { Server } from '@/api/server/getServer';
import { ProductActionModal } from './product-panels/ProductActionModal';
import CopyOnClick from '@/components/elements/CopyOnClick';

interface Props {
    servers: PaginatedResult<Server>;
    rootAdmin?: boolean;
    showOnlyAdmin?: boolean;
    setShowOnlyAdmin?: any;
}

export default ({ servers }: Props) => {
    const history = useHistory();
    const serverList = servers?.items || [];
    const [selectedServer, setSelectedServer] = useState<Server | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
                        Game Infrastructure Overview
                    </h1>
                    <p className="text-xs text-[#656b6b] dark:text-[#a0a0a0] font-sans mt-1.5 m-0 leading-relaxed">
                        Live cluster telemetry, node capacity, and provisioned instances across the fleet.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => history.push('/instances')}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 inline-flex items-center justify-center bg-white dark:bg-[#0a0a0a] text-[#1a1a1a] dark:text-[#ededed] border border-[#dedfdf] dark:border-[#262626] hover:bg-[#f5f5f5] dark:hover:bg-[#161616] hover:border-[#a7aaaa] dark:hover:border-[#383838] shadow-xs"
                    >
                        View All Servers &rarr;
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
                                    Cluster Telemetry
                                </span>
                                <span className="text-[#a7aaaa] dark:text-[#52525b] text-xs select-none">/</span>
                                <span className="text-[11px] font-mono text-[#656b6b] dark:text-[#a0a0a0]">Production Fleet</span>
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
                                    Active Game Servers
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
                                                <div className="w-full flex items-center justify-between pt-3.5 border-t border-[#dedfdf] dark:border-[#262626] mt-auto">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#656b6b] dark:text-[#a0a0a0]">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-red-500' : isStarting ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                        <span>{isSuspended ? 'Action Required' : isStarting ? 'Provisioning' : 'Operational'}</span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedServer(server);
                                                                setIsDetailsModalOpen(true);
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 inline-flex items-center justify-center bg-white dark:bg-[#0a0a0a] text-[#1a1a1a] dark:text-[#ededed] border border-[#dedfdf] dark:border-[#262626] hover:bg-[#f5f5f5] dark:hover:bg-[#161616] hover:border-[#a7aaaa] dark:hover:border-[#383838]"
                                                        >
                                                            Details
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => history.push(`/server/${server.id}`)}
                                                            className="px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 bg-[#1a1a1a] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-[#ededed] border border-transparent shadow-xs active:scale-[0.98]"
                                                        >
                                                            Console &rarr;
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
                            <span className="bg-[#141414] text-[#a0a0a0] border border-[#262626] text-[10px] font-mono px-2 py-0.5 rounded-full">
                                1
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

                    <div className="px-4 py-3.5 border-b border-[#dedfdf] dark:border-[#262626] hover:bg-[#fbfaf9] dark:hover:bg-[#111111] transition-colors">
                        <div className="py-0.5">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-[#656b6b] dark:text-[#a0a0a0]">#T-1042</span>
                                <span className="text-xs flex-1 truncate text-[#1a1a1a] dark:text-white font-medium">
                                    DDoS Shielded Port Allocation
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0a0a0a] border border-[#222222] text-[10px] font-mono text-[#ededed]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Open
                                </span>
                            </div>
                            <p className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0] mt-1.5 m-0 font-sans">
                                Anti-DDoS routing profile active on cluster edge.
                            </p>
                        </div>
                    </div>

                    {/* 2. Account & Billing */}
                    <div className="bg-white dark:bg-black border-b border-[#dedfdf] dark:border-[#262626] px-4 py-3">
                        <span className="font-serif font-semibold text-xs text-[#1a1a1a] dark:text-white">Account &amp; billing</span>
                    </div>

                    <div className="px-4 py-3.5 border-b border-[#dedfdf] dark:border-[#262626] space-y-2.5 text-xs font-mono">
                        <div className="flex justify-between items-center">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">Next payment due</span>
                            <span className="text-[#1a1a1a] dark:text-white font-medium">Oct 01, 2026</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">Projected monthly</span>
                            <span className="text-[#1a1a1a] dark:text-white font-medium">$120.00</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[#656b6b] dark:text-[#a0a0a0]">Outstanding balance</span>
                            <span className="font-medium text-[#15803d] dark:text-[#4ade80]">$0.00</span>
                        </div>
                        <div className="mt-2.5 rounded-lg border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-[11px] text-[#a0a0a0] leading-relaxed font-sans flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">✓</span> Billing account in good standing. All compute nodes cleared.
                        </div>
                    </div>

                    {/* 3. Incidents & Audit */}
                    <div className="bg-white dark:bg-black border-b border-[#dedfdf] dark:border-[#262626] px-4 py-3">
                        <span className="font-serif font-semibold text-xs text-[#1a1a1a] dark:text-white">Incidents &amp; audit</span>
                    </div>

                    <div className="px-4 py-3.5 space-y-3">
                        <div className="text-xs">
                            <div className="flex items-center justify-between text-[11px] text-[#656b6b] dark:text-[#a0a0a0] font-mono">
                                <span className="text-[#1a1a1a] dark:text-white font-semibold">lunaradmin</span>
                                <span>10m ago</span>
                            </div>
                            <div className="text-[#1a1a1a] dark:text-white mt-1 text-xs font-medium font-sans">Server instance started</div>
                        </div>

                        <div className="text-xs">
                            <div className="flex items-center justify-between text-[11px] text-[#656b6b] dark:text-[#a0a0a0] font-mono">
                                <span className="text-[#1a1a1a] dark:text-white font-semibold">system</span>
                                <span>25m ago</span>
                            </div>
                            <div className="text-[#1a1a1a] dark:text-white mt-1 text-xs font-medium font-sans">Telemetry sync completed</div>
                        </div>
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
                                className="px-4 py-2 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 bg-[#1a1a1a] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-[#ededed] border border-transparent shadow-xs active:scale-[0.98]"
                            >
                                Open Server Console &rarr;
                            </button>
                        </div>
                    </div>
                </ProductActionModal>
            )}
        </div>
    );
};
