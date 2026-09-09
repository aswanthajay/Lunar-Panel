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
    const rawStatus = ServerContext.useStoreState((state) => state.status.value);
    const status = rawStatus || 'offline';
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

    const isOffline = status === 'offline';
    const isStopping = status === 'stopping';
    const isStarting = status === 'starting';
    const killable = isStopping;

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
                    className="px-3.5 py-1.5 rounded-md font-medium text-xs text-[#09090b] bg-[#fafafa] hover:bg-[#e4e4e7] transition-colors cursor-pointer border border-[#fafafa] disabled:opacity-30 disabled:pointer-events-none disabled:cursor-not-allowed select-none"
                    disabled={!isOffline}
                    onClick={onButtonClick.bind(this, 'start')}
                >
                    Start
                </button>
            </Can>
            <Can action={'control.restart'}>
                <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-md font-medium text-xs text-[#f4f4f5] bg-[#121215] hover:bg-[#1c1c21] border border-[#27272a] hover:border-[#3f3f46] transition-colors cursor-pointer disabled:opacity-30 disabled:text-neutral-500 disabled:border-[#1F1F1F] disabled:bg-[#0A0A0A] disabled:pointer-events-none disabled:cursor-not-allowed select-none"
                    disabled={isOffline || isStarting || isStopping}
                    onClick={onButtonClick.bind(this, 'restart')}
                >
                    Restart
                </button>
            </Can>
            <Can action={'control.stop'}>
                <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-md font-medium text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 transition-colors cursor-pointer disabled:opacity-30 disabled:text-neutral-500 disabled:bg-[#0A0A0A] disabled:border-[#1F1F1F] disabled:pointer-events-none disabled:cursor-not-allowed select-none"
                    disabled={isOffline}
                    onClick={onButtonClick.bind(this, killable ? 'kill' : 'stop')}
                >
                    {killable ? 'Kill' : 'Stop'}
                </button>
            </Can>
        </div>
    );
};
