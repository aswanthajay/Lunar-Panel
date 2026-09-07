import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { encodePathSegments } from '@/helpers';

export interface RecentFile {
    path: string;
    name: string;
    timestamp: number;
}

export const addRecentFile = (uuid: string, path: string) => {
    try {
        const key = `lunar:recent_files:${uuid}`;
        const existing: RecentFile[] = JSON.parse(localStorage.getItem(key) || '[]');
        const cleanPath = path.replace(/^#?\/?/, '/');
        const name = cleanPath.split('/').pop() || cleanPath;

        const filtered = existing.filter((f) => f.path !== cleanPath);
        const updated = [{ path: cleanPath, name, timestamp: Date.now() }, ...filtered].slice(0, 10);
        localStorage.setItem(key, JSON.stringify(updated));
    } catch {
        // Ignore localStorage quota errors
    }
};

export const RecentFilesStrip: React.FC = () => {
    const history = useHistory();
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

    useEffect(() => {
        try {
            const key = `lunar:recent_files:${uuid}`;
            const stored: RecentFile[] = JSON.parse(localStorage.getItem(key) || '[]');
            setRecentFiles(stored);
        } catch {
            setRecentFiles([]);
        }
    }, [uuid]);

    const handleRemove = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        const updated = recentFiles.filter((f) => f.path !== path);
        setRecentFiles(updated);
        try {
            localStorage.setItem(`lunar:recent_files:${uuid}`, JSON.stringify(updated));
        } catch {}
    };

    const handleClearAll = () => {
        setRecentFiles([]);
        try {
            localStorage.removeItem(`lunar:recent_files:${uuid}`);
        } catch {}
    };

    if (!recentFiles.length) return null;

    return (
        <div className="mb-3 px-3.5 py-2.5 rounded-lg bg-[#050505] border border-[#1A1A1A] flex items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
                <span className="text-[10px] font-mono text-[#6B7280] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Recent:</span>
                </span>

                {recentFiles.map((file) => (
                    <div
                        key={file.path}
                        onClick={() => history.push(`/server/${id}/files/edit#/${encodePathSegments(file.path)}`)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] cursor-pointer transition-all duration-150 shrink-0 group text-xs font-mono text-[#D4D4D4] hover:text-white active:scale-95"
                        title={file.path}
                    >
                        <svg className="w-3 h-3 text-[#A0A0A0] group-hover:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate max-w-[120px] sm:max-w-[160px]">{file.name}</span>
                        <button
                            type="button"
                            onClick={(e) => handleRemove(e, file.path)}
                            className="text-[#525252] hover:text-red-400 p-0.5 rounded transition-colors ml-0.5"
                            title="Remove from recents"
                        >
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={handleClearAll}
                className="text-[10px] font-mono text-[#525252] hover:text-[#A0A0A0] shrink-0 transition-colors hidden sm:inline"
                title="Clear recent files"
            >
                Clear
            </button>
        </div>
    );
};
