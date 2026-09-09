import { ExclamationIcon, ShieldExclamationIcon } from '@heroicons/react/outline';
import React from 'react';
import classNames from 'classnames';

interface AlertProps {
    type: 'warning' | 'danger';
    className?: string;
    children: React.ReactNode;
}

export default ({ type, className, children }: AlertProps) => {
    return (
        <div
            className={classNames(
                'relative w-full rounded-lg border p-4 text-xs font-sans flex items-start gap-3 shadow-xs transition-colors',
                {
                    'border-red-900/50 bg-red-950/30 text-red-200': type === 'danger',
                    'border-amber-900/50 bg-amber-950/30 text-amber-200': type === 'warning',
                },
                className
            )}
        >
            {type === 'danger' ? (
                <ShieldExclamationIcon className={'w-4 h-4 mt-0.5 shrink-0 text-red-400'} />
            ) : (
                <ExclamationIcon className={'w-4 h-4 mt-0.5 shrink-0 text-amber-400'} />
            )}
            <div className={'flex-1 leading-relaxed'}>{children}</div>
        </div>
    );
};
