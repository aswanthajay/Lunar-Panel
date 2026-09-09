import React, { useState, useEffect, useCallback } from 'react';
import { ServerContext } from '@/state/server';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import { useHistory } from 'react-router-dom';
import { encodePathSegments } from '@/helpers';
import Tooltip from '@/components/elements/tooltip/Tooltip';

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
                style={{ paddingLeft: `${level * 14 + 6}px` }}
                className={`group flex items-center gap-1.5 py-1.5 pr-2.5 rounded-md cursor-pointer transition-all duration-150 text-[12px] select-none my-0.5 ${
                    isCurrent
                        ? 'bg-white/[0.08] text-white font-medium shadow-xs border border-white/[0.06]'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
                }`}
            >
                <button
                    type="button"
                    onClick={handleArrowToggle}
                    className="w-4 h-4 flex items-center justify-center text-neutral-500 group-hover:text-neutral-300 hover:!text-white shrink-0 transition-colors"
                    title={isOpen ? 'Collapse' : 'Expand'}
                >
                    {loading ? (
                        <span className="w-2.5 h-2.5 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
                    ) : (
                        <svg
                            className={`w-3 h-3 transform transition-transform duration-150 ${
                                isOpen ? 'rotate-90 text-neutral-400' : 'text-neutral-600'
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    )}
                </button>

                <svg
                    className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                        isCurrent
                            ? 'text-amber-400'
                            : isOpen
                            ? 'text-amber-400/90'
                            : 'text-neutral-500 group-hover:text-neutral-400'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    {isOpen ? (
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H2V6zm0 3h16v7a2 2 0 01-2 2H4a2 2 0 01-2-2V9z" />
                    ) : (
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    )}
                </svg>

                <span className="truncate flex-1 font-sans">{name}</span>

                {isCurrent && (
                    <Tooltip content="Currently active directory" placement="left">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                            <span className="font-sans text-[10px]">Active</span>
                        </span>
                    </Tooltip>
                )}

                {subdirs.length > 0 && !isCurrent && (
                    <span className="text-[10px] text-neutral-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                        {subdirs.length}
                    </span>
                )}
            </div>

            {isOpen && subdirs.length > 0 && (
                <div className="border-l border-white/[0.06] ml-3.5 pl-1 my-0.5">
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
                                defaultExpanded={level < 1}
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
        <div className="w-full h-full min-h-[460px] max-h-[720px] flex flex-col overflow-hidden bg-[#050505] border border-[#1F1F1F] rounded-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#141414] select-none shrink-0 bg-[#080808]">
                <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-[11px] font-mono tracking-wider uppercase text-neutral-400 font-semibold">
                        Explorer
                    </span>
                </div>

                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={handleExpandAll}
                        title="Expand all"
                        className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={handleCollapseAll}
                        title="Collapse all"
                        className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v5m0 0H4m5 0L3 3m12 1v5m0 0h5m-5 0l6-6M9 20v-5m0 0H4m5 0l-6 6m12-1v-5m0 0h5m-5 0l6 6" />
                        </svg>
                    </button>
                    {onCloseMobile && (
                        <button
                            type="button"
                            onClick={onCloseMobile}
                            className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors ml-1"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Tree Body */}
            <div className="flex-1 overflow-y-auto p-2 select-none custom-scrollbar">
                <TreeNode
                    path="/"
                    name="root"
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
