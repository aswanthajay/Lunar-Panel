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
    <div className={`rounded-md bg-[#000000] border border-[#1F1F1F] overflow-hidden shadow-none transition-colors ${className || ''}`}>
        <div className="bg-[#050505] px-4 py-2.5 border-b border-[#141414] flex items-center">
            {typeof title === 'string' ? (
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6B7280] font-sans m-0">
                    {icon && <FontAwesomeIcon icon={icon} className="mr-2 text-[#707070]" />}
                    {title}
                </p>
            ) : (
                title
            )}
        </div>
        <div className="p-4 text-[#D4D4D4] font-sans">{children}</div>
    </div>
);

export default memo(TitledGreyBox, isEqual);
