import React, { useState, useEffect, useCallback } from 'react';
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
    initialSubdirs?: FileObject[];
    defaultExpanded?: boolean;
    expandSignal?: number;
    collapseSignal?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({
    path,
    name,
    currentDirectory,
    onSelectPath,
    level = 0,
    initialSubdirs,
    defaultExpanded = false,
    expandSignal,
    collapseSignal,
}) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [isOpen, setIsOpen] = useState(level === 0 || defaultExpanded);
    const [subdirs, setSubdirs] = useState<FileObject[]>(initialSubdirs || []);
    const [loading, setLoading] = useState(false);

    const isCurrent = currentDirectory === path || (path === '/' && !currentDirectory);
    const isAncestor = currentDirectory.startsWith(path === '/' ? '/' : path + '/');

    const fetchSubdirs = useCallback(() => {
        if (loading) return;
        setLoading(true);
        loadDirectory(uuid, path)
            .then((data) => {
                const dirs = (data || []).filter((item) => !item.isFile);
                setSubdirs(dirs);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [uuid, path, loading]);

    // Expand on mount if root or defaultExpanded
    useEffect(() => {
        if ((level === 0 || defaultExpanded) && subdirs.length === 0) {
            fetchSubdirs();
            setIsOpen(true);
        }
    }, [level, defaultExpanded]);

    // Keep active ancestor folders expanded as user navigates
    useEffect(() => {
        if (isAncestor && !isOpen) {
            setIsOpen(true);
            if (subdirs.length === 0) {
                fetchSubdirs();
            }
        }
    }, [isAncestor, isOpen, subdirs.length, fetchSubdirs]);

    // React to global Expand All signal
    useEffect(() => {
        if (expandSignal && expandSignal > 0) {
            setIsOpen(true);
            if (subdirs.length === 0) {
                fetchSubdirs();
            }
        }
    }, [expandSignal]);

    // React to global Collapse All signal (root stays open)
    useEffect(() => {
        if (collapseSignal && collapseSignal > 0 && level > 0) {
            setIsOpen(false);
        }
    }, [collapseSignal, level]);

    const handleArrowToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen && subdirs.length === 0) {
            fetchSubdirs();
            setIsOpen(true);
        } else {
            setIsOpen(!isOpen);
        }
    };

    const handleRowClick = () => {
        onSelectPath(path);
        // Automatically open if closed
        if (!isOpen) {
            if (subdirs.length === 0) {
                fetchSubdirs();
            }
            setIsOpen(true);
        }
    };

    return (
        <div>
            <div
                onClick={handleRowClick}
                style={{ paddingLeft: `${level * 12 + 6}px` }}
                className={`flex items-center gap-1.5 py-1.5 pr-2 rounded-md cursor-pointer transition-colors text-xs font-mono select-none my-0.5 ${
                    isCurrent
                        ? 'bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20'
                        : 'text-[#9E9E9E] hover:text-white hover:bg-[#0A0A0A]'
                }`}
            >
                <button
                    type="button"
                    onClick={handleArrowToggle}
                    className="w-4 h-4 flex items-center justify-center text-[#737373] hover:text-white shrink-0"
                    title={isOpen ? 'Collapse' : 'Expand'}
                >
                    {loading ? (
                        <span className="animate-spin text-[9px] text-[#A0A0A0]">&#9696;</span>
                    ) : (
                        <span
                            className="text-[10px] transform transition-transform duration-150 inline-block"
                            style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                        >
                            &#9656;
                        </span>
                    )}
                </button>

                <svg
                    className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-emerald-400' : isOpen ? 'text-amber-300' : 'text-amber-400/80'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    {isOpen ? (
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H2V6zm0 3h16v7a2 2 0 01-2 2H4a2 2 0 01-2-2V9z" />
                    ) : (
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    )}
                </svg>

                <span className="truncate flex-1">{name}</span>

                {subdirs.length > 0 && (
                    <span className="text-[10px] text-[#525252] font-mono px-1 py-0.2 rounded bg-[#141414]">
                        {subdirs.length}
                    </span>
                )}
            </div>

            {isOpen && subdirs.length > 0 && (
                <div className="border-l border-[#1F1F1F] ml-3 pl-1 my-0.5">
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
                                defaultExpanded={level < 1} // Auto-expand level 0 and level 1 by default
                                expandSignal={expandSignal}
                                collapseSignal={collapseSignal}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface TreeProps {
    initialRootFiles?: FileObject[];
    onCloseMobile?: () => void;
}

export const FileTreeView: React.FC<TreeProps> = ({ initialRootFiles, onCloseMobile }) => {
    const history = useHistory();
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    const [expandSignal, setExpandSignal] = useState<number>(0);
    const [collapseSignal, setCollapseSignal] = useState<number>(0);

    const handleSelectPath = (p: string) => {
        history.push(`/server/${id}/files#${encodePathSegments(p)}`);
        if (onCloseMobile) onCloseMobile();
    };

    const handleExpandAll = () => {
        setExpandSignal(Date.now());
    };

    const handleCollapseAll = () => {
        setCollapseSignal(Date.now());
    };

    return (
        <div className="w-full h-full min-h-[420px] max-h-[720px] flex flex-col p-2.5 overflow-hidden bg-[#050505] border border-[#1F1F1F] rounded-lg">
            <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-[#141414] shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#737373] uppercase tracking-wider font-semibold">
                        Directory Tree
                    </span>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        Auto-Expanded
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handleExpandAll}
                        title="Expand All Directories"
                        className="px-1.5 py-0.5 text-[10px] font-mono text-[#737373] hover:text-white bg-[#0A0A0A] hover:bg-[#141414] rounded border border-[#1F1F1F] transition-colors"
                    >
                        + Expand
                    </button>
                    <button
                        type="button"
                        onClick={handleCollapseAll}
                        title="Collapse Sub-directories"
                        className="px-1.5 py-0.5 text-[10px] font-mono text-[#737373] hover:text-white bg-[#0A0A0A] hover:bg-[#141414] rounded border border-[#1F1F1F] transition-colors"
                    >
                        - Collapse
                    </button>
                    {onCloseMobile && (
                        <button
                            type="button"
                            onClick={onCloseMobile}
                            className="text-[#737373] hover:text-white px-1 text-sm leading-none ml-1"
                        >
                            &times;
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 select-none custom-scrollbar">
                <TreeNode
                    path="/"
                    name="/ (root)"
                    currentDirectory={directory}
                    onSelectPath={handleSelectPath}
                    level={0}
                    initialSubdirs={initialRootFiles}
                    defaultExpanded={true}
                    expandSignal={expandSignal}
                    collapseSignal={collapseSignal}
                />
            </div>
        </div>
    );
};
