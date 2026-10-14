import React, { useState } from 'react';
import { useUserRole } from '@/plugins/useUserRole';
import { ServerContext } from '@/state/server';
import PowerButtons from '@/components/server/console/PowerButtons';
import Can from '@/components/elements/Can';
import CopyOnClick from '@/components/elements/CopyOnClick';
import ServerStatusBox, { STATUS_CONFIG } from '@/components/elements/ServerStatusBox';

export default () => {
    const { isAdmin } = useUserRole();
    const server = ServerContext.useStoreState((state) => state.server.data);
    const status = ServerContext.useStoreState((state) => state.status.value) || 'offline';
    const isRestarting = ServerContext.useStoreState((state) => state.status.isRestarting);

    const serverName    = server?.name || 'Service Instance';
    const serverShortId = server?.id || '';
    const serverId      = server?.internalId;
    const nodeName      = server?.node || 'Local Node';

    const primaryAlloc = server?.allocations?.find((a) => a.isDefault) ?? server?.allocations?.[0];
    const address = primaryAlloc ? `${primaryAlloc.alias || primaryAlloc.ip}:${primaryAlloc.port}` : 'No allocation';

    const currentKey = isRestarting ? 'restarting' : (status || 'offline').toLowerCase();
    const s = STATUS_CONFIG[currentKey] || STATUS_CONFIG.offline;

    const [copiedAddress, setCopiedAddress] = useState(false);

    const onCopyAddress = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!primaryAlloc) return;
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
    };

    return (
        <div className="w-full mb-5 select-none">
            {/* Thin top accent line */}
            <div
                className="h-0.5 w-full transition-colors duration-500"
                style={{ backgroundColor: s.accent }}
            />

            {/* Main service bar */}
            <div className="bg-[#000000] border-x border-b border-[#1F1F1F] px-6 py-3 flex items-center justify-between gap-6">

                {/* LEFT: status + name */}
                <div className="flex items-center gap-5 min-w-0">
                    {/* Status Indicator Box */}
                    <ServerStatusBox status={status} isRestarting={isRestarting} size="medium" />

                    {/* Divider */}
                    <span className="w-px h-4 bg-[#1F1F1F] hidden sm:block shrink-0" />

                    {/* Name — editorial serif */}
                    <div className="min-w-0 hidden sm:block">
                        <div className="flex items-center gap-2.5">
                            <h1
                                className="text-[20px] sm:text-[22px] text-[#FFFFFF] font-semibold truncate m-0 font-sans tracking-tight leading-none"
                            >
                                {serverName}
                            </h1>
                            <CopyOnClick text={serverShortId}>
                                <code
                                    className="text-[11px] font-mono text-[#71717A] hover:text-[#D4D4D8] bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] px-2 py-0.5 rounded shrink-0 cursor-pointer transition-colors tabular-nums font-medium"
                                    style={{ fontFamily: 'var(--font-mono)' }}
                                    title="Click to copy server ID"
                                >
                                    {serverShortId}
                                </code>
                            </CopyOnClick>
                        </div>

                        {/* Meta row */}
                        <div
                            className="flex items-center gap-2 mt-1 text-xs"
                        >
                            {primaryAlloc ? (
                                <CopyOnClick text={address}>
                                    <button
                                        type="button"
                                        onClick={onCopyAddress}
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all cursor-pointer group text-[11px] font-mono tabular-nums select-none ${
                                            copiedAddress
                                                ? 'bg-[#051F14] border-[#065F46] text-[#34D399]'
                                                : 'bg-[#0A0A0A] hover:bg-[#141414] border-[#1F1F1F] hover:border-[#383838] text-[#A3A3A3] hover:text-[#FFFFFF]'
                                        }`}
                                        style={{ fontFamily: 'var(--font-mono)' }}
                                        title="Click to copy server IP:Port"
                                    >
                                        <span className="tabular-nums">{address}</span>
                                        {copiedAddress ? (
                                            <span className="flex items-center gap-1 text-[#34D399] text-[10px] font-sans font-medium">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>Copied</span>
                                            </span>
                                        ) : (
                                            <svg className="w-3 h-3 text-[#52525B] group-hover:text-[#A1A1AA] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        )}
                                    </button>
                                </CopyOnClick>
                            ) : (
                                <span className="text-[#A1A1AA] font-mono text-[11px] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{address}</span>
                            )}
                            <span className="text-[#3F3F46]">/</span>
                            <span className="text-[#71717A] font-sans text-xs">{nodeName}</span>
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
