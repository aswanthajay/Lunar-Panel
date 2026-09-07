import React from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { ServerContext } from '@/state/server';
import PowerButtons from '@/components/server/console/PowerButtons';
import Can from '@/components/elements/Can';

const STATUS: Record<string, { label: string; dot: string; accent: string }> = {
    running:  { label: 'Running',  dot: 'bg-[#10B981]',               accent: '#10B981' },
    starting: { label: 'Starting', dot: 'bg-[#F59E0B] animate-pulse', accent: '#F59E0B' },
    stopping: { label: 'Stopping', dot: 'bg-[#EF4444] animate-pulse', accent: '#EF4444' },
    offline:  { label: 'Offline',  dot: 'bg-[#333333]',               accent: '#1F1F1F' },
};

export default () => {
    const { isAdmin } = useUserRole();
    const server = ServerContext.useStoreState((state) => state.server.data);
    const status = ServerContext.useStoreState((state) => state.status.value) || 'offline';

    const serverName    = server?.name || 'Service Instance';
    const serverShortId = server?.id   || '—';
    const serverId      = server?.internalId;
    const nodeName      = server?.node || 'Local Node';
    const limits        = server?.limits || { cpu: 0, memory: 0, disk: 0 };

    const primaryAlloc = server?.allocations?.find((a) => a.isDefault) ?? server?.allocations?.[0];
    const address = primaryAlloc ? `${primaryAlloc.alias || primaryAlloc.ip}:${primaryAlloc.port}` : '—';

    const s = STATUS[status] ?? STATUS.offline;

    return (
        <div className="w-full mb-5 select-none">
            {/* Thin top accent line */}
            <div
                className="h-px w-full transition-colors duration-700"
                style={{ backgroundColor: s.accent }}
            />

            {/* Main service bar */}
            <div className="bg-[#000000] border-x border-b border-[#1F1F1F] px-6 py-3 flex items-center justify-between gap-6">

                {/* LEFT: status + name */}
                <div className="flex items-center gap-5 min-w-0">
                    {/* Status */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`w-[7px] h-[7px] rounded-full ${s.dot}`} />
                        <span
                            className="text-[10px] uppercase tracking-[0.14em] text-[#909090]"
                            style={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }}
                        >
                            {s.label}
                        </span>
                    </div>

                    {/* Divider */}
                    <span className="w-px h-4 bg-[#1F1F1F] hidden sm:block shrink-0" />

                    {/* Name — editorial serif */}
                    <div className="min-w-0 hidden sm:block">
                        <div className="flex items-center gap-2.5">
                            <h1
                                className="text-[15px] text-[#FFFFFF] font-normal truncate m-0"
                                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.015em' }}
                            >
                                {serverName}
                            </h1>
                            <code
                                className="text-[10px] text-[#383838] bg-[#0A0A0A] border border-[#1F1F1F] px-1.5 py-0.5 rounded shrink-0"
                                style={{ fontFamily: 'var(--font-mono)' }}
                            >
                                {serverShortId}
                            </code>
                        </div>

                        {/* Meta row */}
                        <div
                            className="flex items-center gap-2 mt-[3px] text-[11px] text-[#909090]"
                            style={{ fontFamily: 'var(--font-mono)' }}
                        >
                            <span className="text-[#909090] select-all">{address}</span>
                            <span className="text-[#444444]">/</span>
                            <span>{nodeName}</span>
                            {limits.cpu > 0 && <>
                                <span className="text-[#444444]">/</span>
                                <span>{limits.cpu}% CPU</span>
                            </>}
                            {limits.memory > 0 && <>
                                <span className="text-[#444444]">/</span>
                                <span>{(limits.memory / 1024).toFixed(1)} GiB RAM</span>
                            </>}
                        </div>
                    </div>
                </div>

                {/* RIGHT: power controls */}
                <div className="flex items-center gap-2 shrink-0">
                    <Can action={['control.start', 'control.stop', 'control.restart']} matchAny>
                        <PowerButtons className="flex items-center gap-2" />
                    </Can>

                    {isAdmin && serverId && (
                        <a
                            href={`/admin/servers/view/${serverId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 rounded text-[11px] text-[#909090] hover:text-[#A0A0A0] border border-[#1F1F1F] hover:border-[#2B2B2B] bg-[#000000] transition-colors no-underline"
                            style={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }}
                        >
                            Admin
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};
