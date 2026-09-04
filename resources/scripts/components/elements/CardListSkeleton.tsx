import React from 'react';
import { Skeleton } from './Skeleton';

export interface CardListSkeletonProps {
    count?: number;
    height?: number;
    className?: string;
}

/**
 * 1:1 Parity Card List Skeleton.
 * Replaces centered spinner wheels in sub-resource views (Databases, Schedules, Users, Network).
 */
export const CardListSkeleton: React.FC<CardListSkeletonProps> = ({
    count = 3,
    height = 68,
    className = '',
}) => {
    return (
        <div className={`space-y-2.5 w-full ${className}`}>
            {Array.from({ length: count }, (_, idx) => (
                <div
                    key={`card-skel-${idx}`}
                    className="lunar-skeleton-card p-4 sm:p-5 flex items-center justify-between gap-4 border border-[#1c1c1f] rounded-lg bg-[#0a0a0a]"
                    style={{ minHeight: `${height}px` }}
                >
                    <div className="space-y-2 flex-1 max-w-md">
                        <Skeleton height={15} width="45%" rounded="sm" />
                        <Skeleton height={11} width="70%" rounded="sm" className="opacity-60" />
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Skeleton height={28} width={75} rounded="md" className="opacity-80" />
                        <Skeleton height={28} width={28} rounded="md" className="opacity-50" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default CardListSkeleton;
