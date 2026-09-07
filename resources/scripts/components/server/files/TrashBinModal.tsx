import React, { useState, useEffect } from 'react';
import { ServerContext } from '@/state/server';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import deleteFiles from '@/api/server/files/deleteFiles';
import renameFiles from '@/api/server/files/renameFiles';
import { bytesToString } from '@/lib/formatters';
import { formatDistanceToNow } from 'date-fns';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';

interface Props {
    visible: boolean;
    onDismiss: () => void;
    onRestoredOrPurged: () => void;
}

export const TrashBinModal: React.FC<Props> = ({ visible, onDismiss, onRestoredOrPurged }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { addFlash } = useFlash();

    const [files, setFiles] = useState<FileObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchTrashFiles = () => {
        setLoading(true);
        setError(null);
        loadDirectory(uuid, '/.trash')
            .then((data) => {
                setFiles(data || []);
                setLoading(false);
            })
            .catch(() => {
                // If .trash folder does not exist yet, that's completely normal (empty trash)
                setFiles([]);
                setLoading(false);
            });
    };

    useEffect(() => {
        if (visible) {
            fetchTrashFiles();
        }
    }, [visible, uuid]);

    const handleRestore = (file: FileObject) => {
        setActionLoading(file.name);
        renameFiles(uuid, '/.trash', [{ from: file.name, to: `../${file.name}` }])
            .then(() => {
                addFlash({
                    key: 'files',
                    type: 'success',
                    message: `Restored "${file.name}" to server root directory.`,
                });
                setFiles((prev) => prev.filter((f) => f.name !== file.name));
                onRestoredOrPurged();
            })
            .catch((err) => {
                setError(httpErrorToHuman(err));
            })
            .finally(() => {
                setActionLoading(null);
            });
    };

    const handlePurge = (file: FileObject) => {
        setActionLoading(file.name);
        deleteFiles(uuid, '/.trash', [file.name])
            .then(() => {
                setFiles((prev) => prev.filter((f) => f.name !== file.name));
                onRestoredOrPurged();
            })
            .catch((err) => {
                setError(httpErrorToHuman(err));
            })
            .finally(() => {
                setActionLoading(null);
            });
    };

    const handleEmptyTrash = () => {
        if (!files.length) return;
        if (!confirm('Are you sure you want to permanently delete all items in the Recycle Bin? This action cannot be undone.')) {
            return;
        }

        setActionLoading('all');
        deleteFiles(uuid, '/.trash', files.map((f) => f.name))
            .then(() => {
                setFiles([]);
                addFlash({
                    key: 'files',
                    type: 'success',
                    message: 'Recycle Bin emptied successfully.',
                });
                onRestoredOrPurged();
            })
            .catch((err) => {
                setError(httpErrorToHuman(err));
            })
            .finally(() => {
                setActionLoading(null);
            });
    };

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none"
            onClick={onDismiss}
        >
            <div
                className="bg-[#050505] border border-[#1F1F1F] rounded-t-2xl sm:rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-[#141414] bg-[#0A0A0A] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-serif font-medium text-white m-0 tracking-tight">
                                Recycle Bin
                            </h3>
                            <p className="text-[11px] font-mono text-[#737373] m-0">
                                {files.length} deleted {files.length === 1 ? 'item' : 'items'} stored in .trash
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {files.length > 0 && (
                            <button
                                type="button"
                                onClick={handleEmptyTrash}
                                disabled={actionLoading !== null}
                                className="px-2.5 py-1 text-xs font-mono text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded transition-colors"
                            >
                                Empty Bin
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onDismiss}
                            className="p-1 rounded text-[#737373] hover:text-white hover:bg-[#141414] transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-5 bg-[#000000]">
                    {error && (
                        <div className="p-3 mb-4 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="py-12 text-center text-xs font-mono text-[#A0A0A0] flex flex-col items-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Checking recycle bin contents...</span>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="py-16 text-center text-xs font-sans text-[#737373] flex flex-col items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-[#0A0A0A] border border-[#1F1F1F] flex items-center justify-center mb-3 text-[#525252]">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <span>Recycle bin is clean and empty.</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {files.map((file) => (
                                <div
                                    key={file.name}
                                    className="p-3 rounded-lg bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#383838] transition-colors flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-mono text-xs text-white truncate font-medium">
                                            {file.name}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#737373]">
                                            <span>{bytesToString(file.size)}</span>
                                            <span>&bull;</span>
                                            <span>
                                                Deleted {formatDistanceToNow(file.modifiedAt, { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            disabled={actionLoading === file.name}
                                            onClick={() => handleRestore(file)}
                                            className="px-3 py-1.5 rounded text-xs font-mono bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors disabled:opacity-50"
                                            title="Restore to server root"
                                        >
                                            {actionLoading === file.name ? 'Restoring...' : 'Restore'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={actionLoading === file.name}
                                            onClick={() => handlePurge(file)}
                                            className="px-2.5 py-1.5 rounded text-xs font-mono text-[#737373] hover:text-red-400 hover:bg-[#141414] transition-colors disabled:opacity-50"
                                            title="Delete permanently"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
