import React, { useState } from 'react';
import { ServerContext } from '@/state/server';
import pullFile from '@/api/server/files/pullFile';
import { httpErrorToHuman } from '@/api/http';
import useFlash from '@/plugins/useFlash';

interface Props {
    visible: boolean;
    directory: string;
    onDismiss: () => void;
    onFilePulled: () => void;
}

export const PullFromUrlModal: React.FC<Props> = ({ visible, directory, onDismiss, onFilePulled }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { addFlash } = useFlash();

    const [url, setUrl] = useState('');
    const [filename, setFilename] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!visible) return null;

    const handlePull = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanUrl = url.trim();
        if (!cleanUrl) {
            setError('Please provide a valid remote download URL.');
            return;
        }

        setLoading(true);
        setError(null);

        pullFile(uuid, directory || '/', cleanUrl, filename.trim() || undefined)
            .then(() => {
                addFlash({
                    key: 'files',
                    type: 'success',
                    message: `Daemon queued download from URL into ${directory || '/'}. File will appear shortly.`,
                });
                setUrl('');
                setFilename('');
                onFilePulled();
                onDismiss();
            })
            .catch((err) => {
                console.error(err);
                setError(httpErrorToHuman(err));
            })
            .finally(() => {
                setLoading(false);
            });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={onDismiss}
        >
            <div
                className="bg-[#050505] border border-[#1F1F1F] rounded-t-2xl sm:rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-[#141414] bg-[#0A0A0A] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-serif font-medium text-white m-0 tracking-tight">
                                Pull Remote File
                            </h3>
                            <p className="text-[11px] font-mono text-[#737373] m-0">
                                Target: {directory || '/'}
                            </p>
                        </div>
                    </div>

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

                {/* Form Body */}
                <form onSubmit={handlePull} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="text-[11px] font-mono text-[#A0A0A0] uppercase tracking-wider block mb-1.5">
                            Remote URL <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="url"
                            required
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/archive.zip"
                            className="w-full bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#383838] rounded-lg px-3.5 py-2 text-xs font-mono text-white placeholder-[#525252] outline-none transition-colors"
                        />
                        <p className="text-[10px] font-mono text-[#6B7280] mt-1">
                            Direct HTTP/HTTPS link to download directly into the server daemon.
                        </p>
                    </div>

                    <div>
                        <label className="text-[11px] font-mono text-[#A0A0A0] uppercase tracking-wider block mb-1.5">
                            Custom File Name <span className="text-[#6B7280]">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            placeholder="archive.zip (Leave empty to use remote filename)"
                            className="w-full bg-[#0A0A0A] border border-[#1F1F1F] focus:border-[#383838] rounded-lg px-3.5 py-2 text-xs font-mono text-white placeholder-[#525252] outline-none transition-colors"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#141414]">
                        <button
                            type="button"
                            onClick={onDismiss}
                            disabled={loading}
                            className="px-4 py-2 rounded-md bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-white border border-[#1F1F1F] text-xs font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !url.trim()}
                            className="px-5 py-2 rounded-md bg-white hover:bg-[#EDEDED] text-black text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Pulling...</span>
                                </>
                            ) : (
                                <span>Start Download</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
