import React, { useEffect, useState } from 'react';
import Can from '@/components/elements/Can';
import { ServerContext } from '@/state/server';
import { PowerAction } from '@/components/server/console/ServerConsoleContainer';
import { Dialog } from '@/components/elements/dialog';

interface PowerButtonProps {
    className?: string;
}

export default ({ className }: PowerButtonProps) => {
    const [open, setOpen] = useState(false);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

    const killable = status === 'stopping';
    const onButtonClick = (
        action: PowerAction | 'kill-confirmed',
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ): void => {
        e.preventDefault();
        if (action === 'kill') {
            return setOpen(true);
        }

        if (instance) {
            setOpen(false);
            instance.send('set state', action === 'kill-confirmed' ? 'kill' : action);
        }
    };

    useEffect(() => {
        if (status === 'offline') {
            setOpen(false);
        }
    }, [status]);

    return (
        <div className={className}>
            <Dialog.Confirm
                open={open}
                hideCloseIcon
                onClose={() => setOpen(false)}
                title={'Forcibly Stop Process'}
                confirm={'Continue'}
                onConfirmed={onButtonClick.bind(this, 'kill-confirmed')}
            >
                Forcibly stopping a server can lead to data corruption.
            </Dialog.Confirm>
            <Can action={'control.start'}>
                <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-md font-semibold text-xs text-[#000000] bg-[#FFFFFF] hover:bg-[#EAEAEA] transition-colors cursor-pointer border border-[#FFFFFF] disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={status !== 'offline'}
                    onClick={onButtonClick.bind(this, 'start')}
                >
                    Start
                </button>
            </Can>
            <Can action={'control.restart'}>
                <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-md font-semibold text-xs text-[#F59E0B] bg-[#16161A] hover:bg-[#222228] border border-[#2B2B32] hover:border-[#F59E0B] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={!status}
                    onClick={onButtonClick.bind(this, 'restart')}
                >
                    Restart
                </button>
            </Can>
            <Can action={'control.stop'}>
                <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-md font-semibold text-xs text-[#EF4444] bg-[#16161A] hover:bg-[#1F1315] border border-[#2B2B32] hover:border-[#EF4444] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={status === 'offline'}
                    onClick={onButtonClick.bind(this, killable ? 'kill' : 'stop')}
                >
                    {killable ? 'Kill' : 'Stop'}
                </button>
            </Can>
        </div>
    );
};
