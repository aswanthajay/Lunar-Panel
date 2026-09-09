import React, { useContext, useEffect } from 'react';
import { ServerContext } from '@/state/server';
import { CloudUploadIcon, XIcon } from '@heroicons/react/solid';
import asDialog from '@/hoc/asDialog';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import Code from '@/components/elements/Code';
import { useSignal } from '@preact/signals-react';

const ProgressBar = ({ progress, className }: { progress: number; className?: string }) => (
    <div className={`h-1.5 bg-zinc-800 rounded-full overflow-hidden shrink-0 ${className || 'w-12'}`}>
        <div
            className="h-full bg-emerald-400 transition-all duration-300"
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
        <div className={'space-y-2 mt-6'}>
            {uploads.map(([name, file]) => (
                <div key={name} className={'flex items-center space-x-3 bg-gray-700 p-3 rounded'}>
                    <Tooltip content={`${Math.floor((file.loaded / file.total) * 100)}%`} placement={'left'}>
                        <div className={'flex-shrink-0'}>
                            <ProgressBar progress={(file.loaded / file.total) * 100} className={'w-16'} />
                        </div>
                    </Tooltip>
                    <Code className={'flex-1 truncate'}>{name}</Code>
                    <button
                        onClick={cancelFileUpload.bind(this, name)}
                        className={'text-gray-500 hover:text-gray-200 transition-colors duration-75'}
                    >
                        <XIcon className={'w-5 h-5'} />
                    </button>
                </div>
            ))}
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
    title: 'File Uploads',
    description: 'The following files are being uploaded to your server.',
})(FileUploadList);

export default () => {
    const open = useSignal(false);

    const count = ServerContext.useStoreState((state) => Object.keys(state.files.uploads).length);
    const progress = ServerContext.useStoreState((state) => ({
        uploaded: Object.values(state.files.uploads).reduce((count, file) => count + file.loaded, 0),
        total: Object.values(state.files.uploads).reduce((count, file) => count + file.total, 0),
    }));

    useEffect(() => {
        if (count === 0) {
            open.value = false;
        }
    }, [count]);

    return (
        <>
            {count > 0 && (
                <Tooltip content={`${count} files are uploading, click to view`}>
                    <button
                        className={'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors'}
                        onClick={() => (open.value = true)}
                    >
                        <CloudUploadIcon className={'h-3.5 w-3.5 animate-pulse text-emerald-400 shrink-0'} />
                        <ProgressBar progress={(progress.uploaded / progress.total) * 100} className={'w-12'} />
                    </button>
                </Tooltip>
            )}
            <FileUploadListDialog open={open.value} onClose={() => (open.value = false)} />
        </>
    );
};
