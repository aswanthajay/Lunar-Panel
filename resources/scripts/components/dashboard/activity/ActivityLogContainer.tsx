import React, { useEffect, useState } from 'react';
import { ActivityLogFilters, useActivityLogs } from '@/api/account/activity';
import { useFlashKey } from '@/plugins/useFlash';
import PageContentBlock from '@/components/elements/PageContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import PaginationFooter from '@/components/elements/table/PaginationFooter';
import Spinner from '@/components/elements/Spinner';
import ActivityLogEntry from '@/components/elements/activity/ActivityLogEntry';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import useLocationHash from '@/plugins/useLocationHash';

export default () => {
    const { hash } = useLocationHash();
    const { clearAndAddHttpError } = useFlashKey('account');
    const [filters, setFilters] = useState<ActivityLogFilters>({ page: 1, sorts: { timestamp: -1 } });
    const { data, isValidating, error } = useActivityLogs(filters, {
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });

    useEffect(() => {
        setFilters((value) => ({ ...value, filters: { ip: hash.ip, event: hash.event } }));
    }, [hash]);

    useEffect(() => {
        clearAndAddHttpError(error);
    }, [error]);

    const activeFilterCount = (filters.filters?.event ? 1 : 0) + (filters.filters?.ip ? 1 : 0);

    return (
        <PageContentBlock title={'Account Activity'}>
            <FlashMessageRender byKey={'account'} />

            {/* Main Pure Black Bento Card */}
            <section className="bg-[#000000] border border-[#1F1F1F] rounded-xl overflow-hidden shadow-sm select-none font-sans">
                {/* Header */}
                <div className="bg-[#050505] border-b border-[#141414] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="font-serif text-base font-normal text-[#FFFFFF] tracking-tight m-0">
                            Account Activity
                        </h2>
                        <p className="text-[11px] font-sans text-[#737373] mt-0.5 m-0">
                            Cryptographic audit log of sessions, authentications, and API interactions
                        </p>
                    </div>
                    <span className="text-[10px] font-mono text-[#737373] bg-[#000000] px-2.5 py-1 rounded border border-[#1F1F1F]">
                        {data?.pagination.total || 0} events
                    </span>
                </div>

                {/* Filter Active Bar */}
                {activeFilterCount > 0 && (
                    <div className="bg-[#0A0A0A] border-b border-[#141414] px-6 py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-[#A0A0A0]">
                            <span className="text-[#737373]">Active filter:</span>
                            {filters.filters?.event && (
                                <span className="px-2 py-0.5 rounded bg-[#000000] border border-[#1F1F1F] text-[#FFFFFF]">
                                    event: {filters.filters.event}
                                </span>
                            )}
                            {filters.filters?.ip && (
                                <span className="px-2 py-0.5 rounded bg-[#000000] border border-[#1F1F1F] text-[#FFFFFF]">
                                    ip: {filters.filters.ip}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setFilters((value) => ({ ...value, filters: {} }))}
                            className="px-2.5 py-1 rounded text-[11px] font-mono bg-[#000000] hover:bg-[#141414] text-[#EF4444] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#EF4444]/40 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                            <span>Clear Filters</span>
                            <span>✕</span>
                        </button>
                    </div>
                )}

                {/* Content */}
                {!data && isValidating ? (
                    <div className="p-16 text-center">
                        <Spinner centered />
                    </div>
                ) : !data?.items.length ? (
                    <div className="p-16 text-center text-xs font-mono text-[#525252]">
                        No activity records found matching criteria.
                    </div>
                ) : (
                    <div className="divide-y divide-[#141414]">
                        {data.items.map((activity) => (
                            <ActivityLogEntry key={activity.id} activity={activity}>
                                {typeof activity.properties.useragent === 'string' && (
                                    <Tooltip content={activity.properties.useragent} placement={'top'}>
                                        <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center text-[#737373]">
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                                <line x1="8" y1="21" x2="16" y2="21" />
                                                <line x1="12" y1="17" x2="12" y2="21" />
                                            </svg>
                                        </span>
                                    </Tooltip>
                                )}
                            </ActivityLogEntry>
                        ))}
                    </div>
                )}
            </section>

            {/* Pagination */}
            {data && data.pagination.total > 0 && (
                <div className="mt-4 px-1">
                    <PaginationFooter
                        pagination={data.pagination}
                        onPageSelect={(page) => setFilters((value) => ({ ...value, page }))}
                    />
                </div>
            )}
        </PageContentBlock>
    );
};

