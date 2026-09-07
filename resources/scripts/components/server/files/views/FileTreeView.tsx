import React, { useState, useEffect } from 'react';
import { ServerContext } from '@/state/server';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import { useHistory } from 'react-router-dom';
import { encodePathSegments } from '@/helpers';

interface TreeNodeProps {
    path: string;
    name: string;
    currentDirectory: string;
    onSelectPath: (path: string) => void;
    level?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ path, name, currentDirectory, onSelectPath, level = 0 }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [isOpen, setIsOpen] = useState(false);
    const [subdirs, setSubdirs] = useState<FileObject[]>([]);
    const [loading, setLoading] = useState(false);

    const isCurrent = currentDirectory === path || (path === '/' && !currentDirectory);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen && subdirs.length === 0) {
            setLoading(true);
            loadDirectory(uuid, path)
                .then((data) => {
                    const dirs = (data || []).filter((item) => !item.isFile);
                    setSubdirs(dirs);
                    setIsOpen(true);
                })
                .catch(() => {})
                .finally(() => setLoading(false));
        } else {
            setIsOpen(!isOpen);
        }
    };

    return (
        <div>
            <div
                onClick={() => onSelectPath(path)}
                style={{ paddingLeft: `${level * 14 + 8}px` }}
                className={`flex items-center gap-1.5 py-1.5 pr-2.5 rounded-md cursor-pointer transition-colors text-xs font-mono select-none ${
                    isCurrent
                        ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                        : 'text-[#A0A0A0] hover:text-white hover:bg-[#0A0A0A]'
                }`}
            >
                <button
                    type="button"
                    onClick={handleToggle}
                    className="w-4 h-4 flex items-center justify-center text-[#737373] hover:text-white shrink-0"
                >
                    {loading ? (
                        <span className="animate-spin text-[9px]">&#9696;</span>
                    ) : (
                        <span className="text-[10px] transform transition-transform duration-100" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                            &#9656;
                        </span>
                    )}
                </button>

                <svg className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-emerald-400' : 'text-amber-400'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>

                <span className="truncate">{name}</span>
            </div>

            {isOpen && subdirs.length > 0 && (
                <div className="border-l border-[#1F1F1F] ml-3.5 my-0.5">
                    {subdirs.map((dir) => {
                        const subPath = path === '/' ? `/${dir.name}` : `${path}/${dir.name}`;
                        return (
                            <TreeNode
                                key={subPath}
                                path={subPath}
                                name={dir.name}
                                currentDirectory={currentDirectory}
                                onSelectPath={onSelectPath}
                                level={level + 1}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface TreeProps {
    onCloseMobile?: () => void;
}

export const FileTreeView: React.FC<TreeProps> = ({ onCloseMobile }) => {
    const history = useHistory();
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    const handleSelectPath = (p: string) => {
        history.push(`/server/${id}/files#${encodePathSegments(p)}`);
        if (onCloseMobile) onCloseMobile();
    };

    return (
        <div className="w-full h-full p-2.5 overflow-y-auto bg-[#050505] border border-[#1F1F1F] rounded-lg">
            <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-[#141414]">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-[#6B7280] uppercase tracking-wider font-semibold">
                        Directory Tree
                    </span>
                </div>
                {onCloseMobile && (
                    <button
                        type="button"
                        onClick={onCloseMobile}
                        className="text-[#737373] hover:text-white p-1 text-xs"
                    >
                        &times;
                    </button>
                )}
            </div>

            <TreeNode
                path="/"
                name="root"
                currentDirectory={directory}
                onSelectPath={handleSelectPath}
                level={0}
            />
        </div>
    );
};
