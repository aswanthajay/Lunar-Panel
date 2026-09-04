import React from 'react';

export interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
    shimmer?: boolean;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

const roundedMap = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-[4px]',
    lg: 'rounded-lg',
    full: 'rounded-full',
};

/**
 * Ultra-lightweight GPU-hardware-accelerated skeleton primitive.
 * Zero JavaScript animation overhead, runs strictly on browser compositor thread.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
    width,
    height,
    rounded = 'md',
    shimmer = true,
    className = '',
    style = {},
    children,
}) => {
    const inlineStyles: React.CSSProperties = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
    };

    return (
        <div
            className={`lunar-skeleton ${shimmer ? 'lunar-skeleton-shimmer' : ''} ${roundedMap[rounded]} ${className}`}
            style={inlineStyles}
            aria-hidden="true"
        >
            {children}
        </div>
    );
};

export default Skeleton;
