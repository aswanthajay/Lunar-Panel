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
            <div className="mb-7 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#141414] pb-5">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#FFFFFF] tracking-tight m-0">
                        Game Infrastructure Overview
                    </h1>
                    <p className="text-xs text-[#8A8A8A] font-sans mt-1.5 m-0 leading-relaxed">
                        Live cluster telemetry, node capacity, and provisioned instances across the fleet.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => history.push('/instances')}
                        className="px-3.5 py-1.5 rounded-md text-xs font-mono text-[#D4D4D4] hover:text-[#FFFFFF] bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] transition-colors cursor-pointer"
                    >
                        View All Servers →
                    </button>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* ---------- LEFT: TELEMETRY & INSTANCES ---------- */}
                <section className="flex-1 min-w-0 w-full space-y-6">
                    {/* Node & Game Telemetry Bento */}
                    <div className="bg-[#000000] border border-[#1F1F1F] rounded-lg overflow-hidden">
                        <div className="bg-[#050505] border-b border-[#141414] px-5 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="font-serif font-normal text-sm text-[#FFFFFF] tracking-tight">
                                    Cluster Telemetry
                                </span>
                                <span className="text-[#333333] text-xs select-none">/</span>
                                <span className="text-[11px] font-mono text-[#737373]">Production Fleet</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                                <span className="text-[10px] font-mono text-[#8A8A8A] uppercase tracking-wider">Sync: Live 15s</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#141414] bg-[#000000]">
                            {/* Stat 1: Online Servers */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Online Servers
                                    </span>
                                    <div className="text-2xl font-mono font-medium text-[#FFFFFF] mt-1.5">
                                        {telemetry.runningCount}{' '}
                                        <span className="text-xs font-normal text-[#737373]">/ {telemetry.totalInstances} active</span>
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1 w-full bg-[#141414] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#10B981] rounded-full transition-all duration-500"
                                            style={{
                                                width: telemetry.totalInstances > 0
                                                    ? `${Math.round((telemetry.runningCount / telemetry.totalInstances) * 100)}%`
                                                    : '0%',
                                            }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                                        {telemetry.totalInstances > 0
                                            ? `${Math.round((telemetry.runningCount / telemetry.totalInstances) * 100)}% online`
                                            : '0% online'}
                                    </span>
                                </div>
                            </div>

                            {/* Stat 2: Allocated CPU */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Allocated CPU
                                    </span>
                                    <div className="text-2xl font-mono font-medium text-[#FFFFFF] mt-1.5">
                                        {telemetry.totalCpu}%
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1 w-full bg-[#141414] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#FFFFFF] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, telemetry.totalCpu / 2)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                                        Assigned compute limit
                                    </span>
                                </div>
                            </div>

                            {/* Stat 3: Committed RAM */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Committed RAM
                                    </span>
                                    <div className="text-2xl font-mono font-medium text-[#FFFFFF] mt-1.5">
                                        {(telemetry.totalMemory / 1024).toFixed(1)}{' '}
                                        <span className="text-xs font-normal text-[#737373]">GB</span>
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1 w-full bg-[#141414] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#E5A93C] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, (telemetry.totalMemory / 8192) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                                        Dedicated memory
                                    </span>
                                </div>
                            </div>

                            {/* Stat 4: Storage Pool */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Storage Pool
                                    </span>
                                    <div className="text-2xl font-mono font-medium text-[#FFFFFF] mt-1.5">
                                        {(telemetry.totalDisk / 1024).toFixed(1)}{' '}
                                        <span className="text-xs font-normal text-[#737373]">GB</span>
                                    </div>
                                </div>
                                <div className="mt-3.5">
                                    <div className="h-1 w-full bg-[#141414] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, (telemetry.totalDisk / 32768) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                                        NVMe / ZFS Pool
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Active Game Servers List */}
                    <div className="bg-[#000000] border border-[#1F1F1F] rounded-lg overflow-hidden">
                        <div className="bg-[#050505] border-b border-[#141414] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="font-serif font-normal text-sm text-[#FFFFFF] tracking-tight">
                                    Active Game Servers
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0A0A0A] border border-[#1F1F1F] text-[#8A8A8A]">
                                    {filteredServers.length}
                                </span>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search game servers..."
                                    className="border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] rounded-md px-3 py-1.5 text-xs text-[#FFFFFF] bg-[#000000] outline-none w-52 font-mono placeholder-[#525252] transition-colors"
                                />
                            </div>
                        </div>

                        <div className="p-5">
                            {filteredServers.length === 0 ? (
                                <div className="py-12 text-center text-xs text-[#737373] font-sans">
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
                                                className="bg-[#050505] p-5 rounded-lg border border-[#1F1F1F] hover:border-[#383838] transition-all duration-150 flex flex-col justify-between group relative"
                                            >
                                                <div>
                                                    {/* Header: Title & Status Beacon */}
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-base font-serif font-normal text-[#FFFFFF] group-hover:text-[#FFFFFF] truncate m-0 tracking-tight">
                                                                {server.name}
                                                            </h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[11px] font-mono text-[#737373]">
                                                                    Node: {server.node || 'Local Node'}
                                                                </span>
                                                                <span className="text-[#333333] text-xs">&bull;</span>
                                                                <span className="text-[11px] font-mono text-[#525252]">
                                                                    {server.id}
                                                                </span>
                                                            </div>
                                                        </div>

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
                                                    </div>

                                                    {/* Endpoint Address */}
                                                    {host && (
                                                        <div className="mb-4">
                                                            <CopyOnClick text={`${host}:${port}`}>
                                                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#000000] border border-[#1A1A1A] hover:border-[#333333] font-mono text-xs text-[#D4D4D4] hover:text-[#FFFFFF] cursor-pointer transition-colors">
                                                                    <span>{host}:{port}</span>
                                                                    <svg className="w-3 h-3 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                    </svg>
                                                                </div>
                                                            </CopyOnClick>
                                                        </div>
                                                    )}

                                                    {/* 3-Column Resource Limits */}
                                                    <div className="grid grid-cols-3 gap-3 py-3 border-t border-[#141414] text-xs font-mono mb-4">
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                                                                CPU Limit
                                                            </span>
                                                            <span className="text-sm font-medium text-[#FFFFFF] mt-0.5 block">
                                                                {server.limits.cpu}%
                                                            </span>
                                                            <div className="h-1 w-full bg-[#141414] rounded-full overflow-hidden mt-1.5">
                                                                <div className="h-full bg-[#FFFFFF] rounded-full" style={{ width: `${Math.min(100, server.limits.cpu / 2)}%` }} />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                                                                Memory
                                                            </span>
                                                            <span className="text-sm font-medium text-[#FFFFFF] mt-0.5 block">
                                                                {server.limits.memory} <span className="text-2xs text-[#737373]">MB</span>
                                                            </span>
                                                            <div className="h-1 w-full bg-[#141414] rounded-full overflow-hidden mt-1.5">
                                                                <div className="h-full bg-[#E5A93C] rounded-full" style={{ width: `${Math.min(100, (server.limits.memory / 4096) * 100)}%` }} />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                                                                Storage
                                                            </span>
                                                            <span className="text-sm font-medium text-[#FFFFFF] mt-0.5 block">
                                                                {server.limits.disk} <span className="text-2xs text-[#737373]">MB</span>
                                                            </span>
                                                            <div className="h-1 w-full bg-[#141414] rounded-full overflow-hidden mt-1.5">
                                                                <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${Math.min(100, (server.limits.disk / 16384) * 100)}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card Actions Footer */}
                                                <div className="flex items-center justify-between pt-3 border-t border-[#141414]">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedServer(server);
                                                            setIsDetailsModalOpen(true);
                                                        }}
                                                        className="px-3 py-1.5 rounded-md text-xs font-medium text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] transition-colors cursor-pointer"
                                                    >
                                                        Details
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => history.push(`/server/${server.id}`)}
                                                        className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-[#000000] bg-[#FFFFFF] hover:bg-[#E5E5E5] transition-all cursor-pointer shadow-sm"
                                                    >
                                                        Console →
                                                    </button>
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
                <aside className="w-full lg:w-[320px] max-w-full lg:max-w-[340px] bg-[#000000] border border-[#1F1F1F] rounded-lg overflow-hidden shrink-0 space-y-0">
                    {/* 1. Open Tickets */}
                    <div className="bg-[#050505] border-b border-[#141414] px-4 py-3 flex items-center justify-between">
                        <span className="font-serif font-normal text-xs text-[#FFFFFF] flex items-center gap-2">
                            Open tickets
                            <span className="bg-[#051F14] text-[#10B981] border border-[#10B981]/40 text-[9px] font-mono px-1.5 py-0.2 rounded-full">
                                1
                            </span>
                        </span>
                        <button
                            onClick={() => history.push('/support')}
                            className="text-[11px] font-mono text-[#737373] hover:text-[#FFFFFF] cursor-pointer bg-transparent border-none transition-colors"
                        >
                            + New
                        </button>
                    </div>

                    <div className="px-4 py-3.5 border-b border-[#141414] hover:bg-[#050505] transition-colors">
                        <div className="py-0.5">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-[#737373]">#T-1042</span>
                                <span className="text-xs flex-1 truncate text-[#FFFFFF] font-medium">
                                    DDoS Shielded Port Allocation
                                </span>
                                <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#051F14] text-[#10B981] border border-[#10B981]/40">
                                    Open
                                </span>
                            </div>
                            <p className="text-[11px] text-[#737373] mt-1.5 m-0 font-sans">
                                Anti-DDoS routing profile active on cluster edge.
                            </p>
                        </div>
                    </div>

                    {/* 2. Account & Billing */}
                    <div className="bg-[#050505] border-b border-[#141414] px-4 py-3">
                        <span className="font-serif font-normal text-xs text-[#FFFFFF]">Account &amp; billing</span>
                    </div>

                    <div className="px-4 py-3.5 border-b border-[#141414] space-y-2.5 text-xs font-mono">
                        <div className="flex justify-between items-center">
                            <span className="text-[#737373]">Next payment due</span>
                            <span className="text-[#FFFFFF] font-medium">Oct 01, 2026</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[#737373]">Projected monthly</span>
                            <span className="text-[#FFFFFF] font-medium">$120.00</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[#737373]">Outstanding balance</span>
                            <span className="font-medium text-[#10B981]">$0.00</span>
                        </div>
                        <div className="mt-2.5 rounded-md border border-[#10B981]/30 bg-[#051F14] px-3 py-2 text-[11px] text-[#10B981] leading-relaxed font-sans">
                            ✓ Billing account in good standing. All compute nodes cleared.
                        </div>
                    </div>

                    {/* 3. Incidents & Audit */}
                    <div className="bg-[#050505] border-b border-[#141414] px-4 py-3">
                        <span className="font-serif font-normal text-xs text-[#FFFFFF]">Incidents &amp; audit</span>
                    </div>

                    <div className="px-4 py-3.5 space-y-3">
                        <div className="text-xs">
                            <div className="flex items-center justify-between text-[11px] text-[#737373] font-mono">
                                <span className="text-[#A0A0A0]">lunaradmin</span>
                                <span>10m ago</span>
                            </div>
                            <div className="text-[#FFFFFF] mt-1 text-xs font-medium font-sans">Server instance started</div>
                        </div>

                        <div className="text-xs">
                            <div className="flex items-center justify-between text-[11px] text-[#737373] font-mono">
                                <span className="text-[#A0A0A0]">system</span>
                                <span>25m ago</span>
                            </div>
                            <div className="text-[#FFFFFF] mt-1 text-xs font-medium font-sans">Telemetry sync completed</div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Server Details Modal */}
            {selectedServer && (
                <ProductActionModal
                    isOpen={isDetailsModalOpen}
                    onClose={() => setIsDetailsModalOpen(false)}
                    title={selectedServer.name}
                    description={selectedServer.description || (selectedServer.node ? `Node: ${selectedServer.node}` : '')}
                    confirmAction={{
                        label: 'Open Terminal Console',
                        onClick: () => {
                            setIsDetailsModalOpen(false);
                            history.push(`/server/${selectedServer.id}`);
                        },
                    }}
                    cancelAction={{
                        label: 'Close',
                        onClick: () => setIsDetailsModalOpen(false),
                    }}
                >
                    <div className="space-y-4">
                        <div className="p-3.5 bg-[#050505] border border-[#1F1F1F] rounded-md font-mono text-xs">
                            <span className="text-[#737373] block mb-1 uppercase tracking-wider text-[10px]">
                                Server UUID
                            </span>
                            <span className="text-[#FFFFFF] select-all">{selectedServer.uuid}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3.5 bg-[#050505] border border-[#1F1F1F] rounded-md">
                                <span className="text-[10px] text-[#737373] uppercase font-semibold block">CPU Limit</span>
                                <span className="text-sm font-mono text-[#FFFFFF] mt-1 block">
                                    {selectedServer.limits.cpu}%
                                </span>
                            </div>
                            <div className="p-3.5 bg-[#050505] border border-[#1F1F1F] rounded-md">
                                <span className="text-[10px] text-[#737373] uppercase font-semibold block">Memory</span>
                                <span className="text-sm font-mono text-[#FFFFFF] mt-1 block">
                                    {selectedServer.limits.memory} MB
                                </span>
                            </div>
                            <div className="p-3.5 bg-[#050505] border border-[#1F1F1F] rounded-md">
                                <span className="text-[10px] text-[#737373] uppercase font-semibold block">Disk</span>
                                <span className="text-sm font-mono text-[#FFFFFF] mt-1 block">
                                    {selectedServer.limits.disk} MB
                                </span>
                            </div>
                        </div>
                    </div>
                </ProductActionModal>
            )}
        </div>
    );
};
