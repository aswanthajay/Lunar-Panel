import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from '@/components/elements/Spinner';
import { CardListSkeleton } from '@/components/elements/CardListSkeleton';
import { useFlashKey } from '@/plugins/useFlash';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { ServerContext } from '@/state/server';
import AllocationRow from '@/components/server/network/AllocationRow';
import Button from '@/components/elements/Button';
import createServerAllocation from '@/api/server/network/createServerAllocation';
import tw from 'twin.macro';
import Can from '@/components/elements/Can';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import getServerAllocations from '@/api/swr/getServerAllocations';
import isEqual from 'react-fast-compare';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';

const NetworkContainer = () => {
    const [loading, setLoading] = useState(false);
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server!.uuid;
    const id = server?.id;
    const allocationLimit = server!.featureLimits.allocations;
    const allocations = ServerContext.useStoreState((state) => state.server.data!.allocations, isEqual);
    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);

    const { clearFlashes, clearAndAddHttpError } = useFlashKey('server:network');
    const { data, error, mutate } = getServerAllocations();

    useEffect(() => {
        mutate(allocations);
    }, []);

    useEffect(() => {
        clearAndAddHttpError(error);
    }, [error]);

    useDeepCompareEffect(() => {
        if (!data) return;

        setServerFromState((state) => ({ ...state, allocations: data }));
    }, [data]);

    const onCreateAllocation = () => {
        clearFlashes();

        setLoading(true);
        createServerAllocation(uuid)
            .then((allocation) => {
                setServerFromState((s) => ({ ...s, allocations: s.allocations.concat(allocation) }));
                return mutate(data?.concat(allocation), false);
            })
            .catch((error) => clearAndAddHttpError(error))
            .then(() => setLoading(false));
    };

    return (
        <ServerContentBlock showFlashKey={'server:network'} title={'Network'}>
            {!data ? (
                <CardListSkeleton count={4} height={56} />
            ) : (
                <>
                    {id && (
                        <div className="mb-4 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded bg-[#141416] border border-[#27272A] flex items-center justify-center text-[#A0A0A0] shrink-0">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="2" y1="12" x2="22" y2="12" />
                                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[#FFFFFF]">Custom Domains & Nginx Reverse Proxy</div>
                                    <div className="text-[11px] text-[#737373] truncate">Link your domain directly to web ports or game service allocations with automated SSL.</div>
                                </div>
                            </div>
                            <Link
                                to={`/server/${id}/domains`}
                                className="px-3 py-1.5 rounded bg-[#141416] hover:bg-[#1E1E22] border border-[#27272A] text-[#EDEDED] hover:text-[#FFFFFF] text-xs font-medium shrink-0 transition-colors inline-flex items-center gap-1 self-start sm:self-auto"
                            >
                                Manage Custom Domains &rarr;
                            </Link>
                        </div>
                    )}
                    {server?.isFiveM && (server as any).txadminUrl && (
                        <div className="mb-4 bg-[#0A0A0A] border border-[#10B981]/30 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] shrink-0">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-2">
                                        <span>txAdmin Web Panel</span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                            Port {(server as any).txadminPort || 40120}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-[#737373] truncate">
                                        Remote management, server console, and player moderation web dashboard.
                                    </div>
                                </div>
                            </div>
                            <a
                                href={(server as any).txadminUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-1.5 rounded bg-[#10B981] hover:bg-[#059669] text-black font-semibold text-xs shrink-0 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
                            >
                                <span>Open txAdmin</span>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    )}
                    {data.map((allocation) => (
                        <AllocationRow key={`${allocation.ip}:${allocation.port}`} allocation={allocation} />
                    ))}
                    {allocationLimit > 0 && (
                        <Can action={'allocation.create'}>
                            <SpinnerOverlay visible={loading} />
                            <div css={tw`mt-6 sm:flex items-center justify-end`}>
                                <p css={tw`text-sm text-neutral-300 mb-4 sm:mr-6 sm:mb-0`}>
                                    You are currently using {data.length} of {allocationLimit} allowed allocations for
                                    this server.
                                </p>
                                {allocationLimit > data.length && (
                                    <Button css={tw`w-full sm:w-auto`} color={'primary'} onClick={onCreateAllocation}>
                                        Create Allocation
                                    </Button>
                                )}
                            </div>
                        </Can>
                    )}
                </>
            )}
        </ServerContentBlock>
    );
};

export default NetworkContainer;
