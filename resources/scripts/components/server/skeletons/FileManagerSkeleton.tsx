import React from 'react';
import { Skeleton } from '@/components/elements/Skeleton';

/**
 * 1:1 Parity Skeleton for FileManagerContainer.
 * Matches file list table columns, icon space, size, and timestamp alignments.
 * Zero layout shift (CLS = 0).
 */
export const FileManagerSkeleton: React.FC = () => {
    return (
        <div className="border border-[#1F1F1F] rounded-md bg-[#000000] overflow-hidden animate-in fade-in duration-150" aria-label="Loading files...">
            {/* Table Header Mirror */}
            <div
                className="hidden sm:flex items-center px-4 py-2 border-b border-[#141414] bg-[#050505] text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-semibold select-none"
                style={{ fontFamily: 'var(--font-sans, Inter, sans-serif)' }}
            >
                <div className="w-12" />
                <div className="flex-1">Name</div>
                <div className="w-[12%] text-right mr-4 hidden sm:block">Size</div>
                <div className="w-[18%] text-right mr-4 hidden md:block">Last Modified</div>
            </div>

            {/* 8 File Row Skeletons */}
            <div className="divide-y divide-[#141414]">
                {Array.from({ length: 8 }).map((_, idx) => (
                    <div
                        key={`file-skel-row-${idx}`}
                        className="flex items-center px-4 py-2.5 hover:bg-[#050505] transition-colors select-none"
                    >
                        {/* File Icon Box */}
                        <div className="w-12 flex items-center">
                            <Skeleton height={18} width={18} rounded="sm" className="opacity-50" />
                        </div>

                        {/* File Name */}
                        <div className="flex-1 pr-4">
                            <Skeleton
                                height={15}
                                width={idx % 3 === 0 ? '45%' : idx % 2 === 0 ? '60%' : '35%'}
                                rounded="sm"
                            />
                        </div>

                        {/* Size */}
                        <div className="w-[12%] text-right mr-4 hidden sm:flex justify-end">
                            <Skeleton height={12} width={50} rounded="sm" className="opacity-60" />
                        </div>

                        {/* Last Modified */}
                        <div className="w-[18%] text-right mr-4 hidden md:flex justify-end">
                            <Skeleton height={12} width={90} rounded="sm" className="opacity-50" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FileManagerSkeleton;
