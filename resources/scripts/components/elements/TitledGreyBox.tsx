import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import isEqual from 'react-fast-compare';

interface Props {
    icon?: IconProp;
    title: string | React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

const TitledGreyBox = ({ icon, title, children, className }: Props) => (
    <div className={`rounded-xl bg-zinc-950/60 border border-zinc-800/80 overflow-hidden shadow-xs backdrop-blur-sm transition-colors ${className || ''}`}>
        <div className="bg-zinc-900/30 px-4 py-3 border-b border-zinc-800/80 flex items-center">
            {typeof title === 'string' ? (
                <p className="text-xs font-medium text-zinc-300 font-sans m-0 flex items-center">
                    {icon && <FontAwesomeIcon icon={icon} className="mr-2 text-zinc-400" />}
                    {title}
                </p>
            ) : (
                title
            )}
        </div>
        <div className="p-4 text-zinc-300 font-sans text-xs">{children}</div>
    </div>
);

export default memo(TitledGreyBox, isEqual);
