import React from 'react';
import classNames from 'classnames';

interface CodeProps {
    dark?: boolean | undefined;
    className?: string;
    children: React.ReactChild | React.ReactFragment | React.ReactPortal;
}

export default ({ dark, className, children }: CodeProps) => (
    <code
        className={classNames(
            'relative rounded-md font-mono text-xs px-1.5 py-0.5 inline-block border transition-colors',
            {
                'bg-zinc-900 border-zinc-800 text-zinc-200': dark !== false,
                'bg-zinc-800/60 border-zinc-700/60 text-zinc-100': dark === false,
            },
            className
        )}
    >
        {children}
    </code>
);
