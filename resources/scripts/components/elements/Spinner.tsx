import React, { Suspense } from 'react';
import styled, { css, keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import ErrorBoundary from '@/components/elements/ErrorBoundary';

export type SpinnerSize = 'small' | 'base' | 'large';

interface Props {
    size?: SpinnerSize;
    centered?: boolean;
    isBlue?: boolean;
    className?: string;
}

interface Spinner extends React.FC<Props> {
    Size: Record<'SMALL' | 'BASE' | 'LARGE', SpinnerSize>;
    Suspense: React.FC<Props>;
}

export const PulseLoader: React.FC<{ size?: SpinnerSize; isBlue?: boolean; className?: string }> = ({
    size = 'base',
    className = '',
}) => {
    if (size === 'small') {
        return (
            <div className={`inline-flex items-center gap-1 shrink-0 ${className}`} aria-label="Loading...">
                <span className="w-1 h-3 rounded-xs bg-current opacity-75 animate-pulse" />
                <span className="w-1 h-3 rounded-xs bg-current opacity-75 animate-pulse [animation-delay:150ms]" />
                <span className="w-1 h-3 rounded-xs bg-current opacity-75 animate-pulse [animation-delay:300ms]" />
            </div>
        );
    }

    if (size === 'large') {
        return (
            <div className={`inline-flex items-center gap-2 shrink-0 ${className}`} aria-label="Loading...">
                <span className="w-1.5 h-6 rounded-xs bg-zinc-400 dark:bg-zinc-200 opacity-80 animate-pulse" />
                <span className="w-1.5 h-6 rounded-xs bg-zinc-400 dark:bg-zinc-200 opacity-80 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-6 rounded-xs bg-zinc-400 dark:bg-zinc-200 opacity-80 animate-pulse [animation-delay:300ms]" />
            </div>
        );
    }

    return (
        <div className={`inline-flex items-center gap-1.5 shrink-0 ${className}`} aria-label="Loading...">
            <span className="w-1 h-4 rounded-xs bg-zinc-400 dark:bg-zinc-300 opacity-80 animate-pulse" />
            <span className="w-1 h-4 rounded-xs bg-zinc-400 dark:bg-zinc-300 opacity-80 animate-pulse [animation-delay:150ms]" />
            <span className="w-1 h-4 rounded-xs bg-zinc-400 dark:bg-zinc-300 opacity-80 animate-pulse [animation-delay:300ms]" />
        </div>
    );
};

const Spinner: Spinner = ({ centered, size = 'base', className, isBlue, ...props }) =>
    centered ? (
        <div css={[tw`flex justify-center items-center`, size === 'large' ? tw`m-20` : tw`m-6`]}>
            <PulseLoader size={size} isBlue={isBlue} className={className} />
        </div>
    ) : (
        <PulseLoader size={size} isBlue={isBlue} className={className} />
    );
Spinner.displayName = 'Spinner';

Spinner.Size = {
    SMALL: 'small',
    BASE: 'base',
    LARGE: 'large',
};

Spinner.Suspense = ({ children, centered = true, size = Spinner.Size.LARGE, ...props }) => (
    <Suspense fallback={<Spinner centered={centered} size={size} {...props} />}>
        <ErrorBoundary>{children}</ErrorBoundary>
    </Suspense>
);
Spinner.Suspense.displayName = 'Spinner.Suspense';

export default Spinner;
