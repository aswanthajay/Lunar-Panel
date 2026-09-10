import React, { useContext, useEffect } from 'react';
import { ServerContext } from '@/state/server';
import { CloudUploadIcon } from '@heroicons/react/outline';
import { XIcon } from '@heroicons/react/solid';
import asDialog from '@/hoc/asDialog';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { useSignal } from '@preact/signals-react';
import { bytesToString } from '@/lib/formatters';

const ProgressBar = ({ progress, className }: { progress: number; className?: string }) => (
    <div className={`h-1.5 bg-[#27272a] rounded-full overflow-hidden ${className || 'w-14 shrink-0'}`}>
        <div
            className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
    </div>
);

const FileUploadList = () => {
    const { close } = useContext(DialogWrapperContext);
    const cancelFileUpload = ServerContext.useStoreActions((actions) => actions.files.cancelFileUpload);
    const clearFileUploads = ServerContext.useStoreActions((actions) => actions.files.clearFileUploads);
    const uploads = ServerContext.useStoreState((state) =>
        Object.entries(state.files.uploads).sort(([a], [b]) => a.localeCompare(b))
    );

    return (
        <div className="space-y-2 mt-4 select-none font-sans">
            {uploads.map(([name, file]) => {
                const percent = file.total > 0 ? Math.min(100, Math.round((file.loaded / file.total) * 100)) : 0;
                return (
                    <div key={name} className="flex items-center gap-3 p-3 rounded-lg bg-[#0A0A0A] border border-[#1F1F1F]">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-mono text-zinc-200 truncate">{name}</span>
                                <span className="font-mono text-[11px] text-zinc-400 ml-2 shrink-0">
                                    {bytesToString(file.loaded)} / {bytesToString(file.total)} ({percent}%)
                                </span>
                            </div>
                            <ProgressBar progress={percent} className="w-full" />
                        </div>
                        <button
                            type="button"
                            onClick={cancelFileUpload.bind(this, name)}
                            className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
                            title="Cancel upload"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
            <Dialog.Footer>
                <Button.Danger variant={Button.Variants.Secondary} onClick={() => clearFileUploads()}>
                    Cancel Uploads
                </Button.Danger>
                <Button.Text onClick={close}>Close</Button.Text>
            </Dialog.Footer>
        </div>
    );
};

const FileUploadListDialog = asDialog({
    title: 'Active File Uploads',
    description: 'Track and manage the progress of files uploading to your server.',
})(FileUploadList);

export default () => {
    const open = useSignal(false);

    const count = ServerContext.useStoreState((state) => Object.keys(state.files.uploads).length);
    const progress = ServerContext.useStoreState((state) => ({
        uploaded: Object.values(state.files.uploads).reduce((acc, file) => acc + file.loaded, 0),
        total: Object.values(state.files.uploads).reduce((acc, file) => acc + file.total, 0),
    }));

    useEffect(() => {
        if (count === 0) {
            open.value = false;
        }
    }, [count]);

    if (count === 0) {
        return null;
    }

    const percentage = progress.total > 0 ? Math.min(100, Math.round((progress.uploaded / progress.total) * 100)) : 0;

    return (
        <>
            <Tooltip
                content={`${count} file${count > 1 ? 's' : ''} uploading (${bytesToString(progress.uploaded)} / ${bytesToString(progress.total)} • ${percentage}%). Click to view details.`}
            >
                <button
                    type="button"
                    onClick={() => (open.value = true)}
                    className="h-9 px-3.5 rounded-md bg-[#121215] hover:bg-[#1c1c21] text-[#f4f4f5] hover:text-white border border-[#27272a] hover:border-[#3f3f46] text-xs font-medium font-sans transition-all flex items-center gap-2 shadow-xs select-none active:scale-[0.98] cursor-pointer"
                >
                    <CloudUploadIcon className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />

                    <span className="font-sans text-xs text-[#f4f4f5] whitespace-nowrap">
                        Uploading {count > 1 ? `${count} files` : '1 file'}
                    </span>

                    <span className="font-mono text-[11px] text-emerald-400 font-semibold tabular-nums shrink-0">
                        {percentage}%
                    </span>

                    <ProgressBar progress={percentage} className="w-12 sm:w-16 shrink-0" />
                </button>
            </Tooltip>
            <FileUploadListDialog open={open.value} onClose={() => (open.value = false)} />
        </>
    );
};
