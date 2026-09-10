import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { encodePathSegments } from '@/helpers';

export interface RecentFile {
    path: string;
    name: string;
    timestamp: number;
}

export const normalizeFilePath = (p: string): string => {
    return p.replace(/^#?\/?/, '').replace(/\/+/g, '/').trim();
};

export const addRecentFile = (uuid: string, path: string) => {
    try {
        const key = `lunar:recent_files:${uuid}`;
        const existing: RecentFile[] = JSON.parse(localStorage.getItem(key) || '[]');
        const cleanPath = normalizeFilePath(path);
        if (!cleanPath) return;
        const name = cleanPath.split('/').pop() || cleanPath;

        const filtered = existing.filter((f) => normalizeFilePath(f.path) !== cleanPath && f.name !== name);
        const updated = [{ path: cleanPath, name, timestamp: Date.now() }, ...filtered].slice(0, 8);
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
            const seen = new Set<string>();
            const deduped: RecentFile[] = [];
            for (const f of stored) {
                const norm = normalizeFilePath(f.path);
                if (norm && !seen.has(norm) && !seen.has(f.name)) {
                    seen.add(norm);
                    seen.add(f.name);
                    deduped.push({ ...f, path: norm });
                }
            }
            setRecentFiles(deduped);
            if (deduped.length !== stored.length) {
                localStorage.setItem(key, JSON.stringify(deduped));
            }
        } catch {
            setRecentFiles([]);
        }
    }, [uuid]);

    const handleRemove = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        const norm = normalizeFilePath(path);
        const updated = recentFiles.filter((f) => normalizeFilePath(f.path) !== norm);
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
        <div className="mb-3.5 py-1 px-0.5 flex items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
                <span className="text-[11px] font-sans text-[#71717A] shrink-0 mr-1 flex items-center gap-1.5 select-none">
                    <svg className="w-3.5 h-3.5 text-[#71717A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Recent</span>
                </span>

                {recentFiles.map((file) => (
                    <div
                        key={file.path}
                        onClick={() => history.push(`/server/${id}/files/edit#/${encodePathSegments(file.path)}`)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0D0D0D] hover:bg-[#181818] border border-[#1F1F1F] hover:border-[#383838] cursor-pointer transition-colors shrink-0 group text-xs font-mono text-[#D4D4D4] hover:text-white"
                        title={file.path}
                    >
                        <svg className="w-3 h-3 text-[#71717A] group-hover:text-[#A1A1AA] shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate max-w-[120px] sm:max-w-[160px]">{file.name}</span>
                        <button
                            type="button"
                            onClick={(e) => handleRemove(e, file.path)}
                            className="text-[#525252] hover:text-rose-400 p-0.5 rounded transition-colors opacity-50 group-hover:opacity-100"
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
                className="text-xs font-sans text-[#71717A] hover:text-[#D4D4D4] shrink-0 transition-colors hidden sm:inline cursor-pointer bg-transparent border-none p-0"
                title="Clear recent files"
            >
                Clear
            </button>
        </div>
    );
};
