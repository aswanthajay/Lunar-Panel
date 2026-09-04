import React, { useContext } from 'react';
import { DialogContext } from './';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';

export default ({ children }: { children: React.ReactNode }) => {
    const { setFooter } = useContext(DialogContext);

    useDeepCompareEffect(() => {
        setFooter(
            <div className={'px-6 py-3.5 bg-[#050505] border-t border-[#1A1A1A] flex items-center justify-end space-x-3'}>{children}</div>
        );
    }, [children]);

    return null;
};
