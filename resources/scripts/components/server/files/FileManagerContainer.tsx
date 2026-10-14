import React, { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/http';
import { CSSTransition } from 'react-transition-group';
import { FileManagerSkeleton } from '@/components/server/skeletons/FileManagerSkeleton';
import FileObjectRow from '@/components/server/files/FileObjectRow';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import { FileObject } from '@/api/server/files/loadDirectory';
import NewDirectoryButton from '@/components/server/files/NewDirectoryButton';
import { NavLink, useLocation } from 'react-router-dom';
import Can from '@/components/elements/Can';
import { ServerError } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { ServerContext } from '@/state/server';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import FileManagerStatus from '@/components/server/files/FileManagerStatus';
import MassActionsBar from '@/components/server/files/MassActionsBar';
import UploadButton from '@/components/server/files/UploadButton';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { useStoreActions } from '@/state/hooks';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { FileActionCheckbox } from '@/components/server/files/SelectFileCheckbox';
import { hashToPath } from '@/helpers';
import { join } from 'path';
import style from './style.module.css';

// Better Files Manager additions
import { PullFromUrlModal } from './PullFromUrlModal';
import { RecentFilesStrip } from './RecentFilesStrip';
import { FileGridView } from './views/FileGridView';
import { FileCompactView } from './views/FileCompactView';
import { FileTreeView } from './views/FileTreeView';
import { MediaPlayerModal } from './media/MediaPlayerModal';
import { AudioMiniPlayer } from './media/AudioMiniPlayer';
import useEventListener from '@/plugins/useEventListener';

const sortFiles = (files: FileObject[]): FileObject[] => {
    const sortedFiles: FileObject[] = files
        .sort((a, b) => a.name.localeCompare(b.name))
        .sort((a, b) => (a.isFile === b.isFile ? 0 : a.isFile ? 1 : -1));
    return sortedFiles.filter((file, index) => index === 0 || file.name !== sortedFiles[index - 1].name);
};

export type ViewMode = 'list' | 'compact' | 'grid' | 'tree';

export default () => {
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const { hash } = useLocation();
    const { data: files, error, mutate } = useFileManagerSwr();
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const clearFlashes = useStoreActions((actions) => actions.flashes.clearFlashes);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);

    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);
    const selectedFilesLength = ServerContext.useStoreState((state) => state.files.selectedFiles.length);

    // View mode state - defaults to compact view
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const saved = localStorage.getItem('lunar:file_view_mode_v3');
        if (saved === 'tree' || saved === 'list' || saved === 'compact' || saved === 'grid') {
            return saved;
        }
        return 'compact';
    });

    const handleSetViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('lunar:file_view_mode_v3', mode);
        } catch {}
    };

    // Modals state
    const [showPullModal, setShowPullModal] = useState(false);
    const [activeMediaFile, setActiveMediaFile] = useState<FileObject | null>(null);
    const [miniPlayerAudio, setMiniPlayerAudio] = useState<{ title: string; url: string } | null>(null);

    useEventListener('lunar:files:open-media', (e: CustomEvent) => {
        if (e.detail) {
            setActiveMediaFile(e.detail);
        }
    });

    useEffect(() => {
        clearFlashes('files');
        setSelectedFiles([]);
        setDirectory(hashToPath(hash));
    }, [hash]);

    useEffect(() => {
        mutate();
    }, [directory]);

    const onSelectAllClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedFiles(e.currentTarget.checked ? files?.map((file) => file.name) || [] : []);
    };

    if (error) {
        return <ServerError message={httpErrorToHuman(error)} onRetry={() => mutate()} />;
    }

    const sortedFiles = files ? sortFiles(files.slice(0, 250)) : [];

    return (
        <ServerContentBlock title={'File Manager'} showFlashKey={'files'}>
            <ErrorBoundary>
                <div className={'flex flex-wrap-reverse md:flex-nowrap mb-4 items-center justify-between gap-3'}>
                    <FileManagerBreadcrumbs />

                    <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
                        {/* View Mode Switcher Group */}
                        <div className="flex items-center rounded-lg bg-[#0A0A0A] border border-[#1F1F1F] p-0.5 select-none">
                            <button
                                type="button"
                                onClick={() => handleSetViewMode('compact')}
                                className={`px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1 font-sans ${
                                    viewMode === 'compact'
                                        ? 'bg-[#1F1F1F] text-white shadow-xs'
                                        : 'text-[#737373] hover:text-white'
                                }`}
                                title="Compact High-Density View"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span className="hidden sm:inline text-xs font-sans font-medium">Compact</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSetViewMode('list')}
                                className={`px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1 font-sans ${
                                    viewMode === 'list'
                                        ? 'bg-[#1F1F1F] text-white shadow-xs'
                                        : 'text-[#737373] hover:text-white'
                                }`}
                                title="List View"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                                <span className="hidden sm:inline text-xs font-sans font-medium">List</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSetViewMode('tree')}
                                className={`px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1 font-sans ${
                                    viewMode === 'tree'
                                        ? 'bg-[#1F1F1F] text-white shadow-xs'
                                        : 'text-[#737373] hover:text-white'
                                }`}
                                title="Directory Tree Explorer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span className="hidden sm:inline text-xs font-sans font-medium">Tree</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSetViewMode('grid')}
                                className={`px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1 font-sans ${
                                    viewMode === 'grid'
                                        ? 'bg-[#1F1F1F] text-white shadow-xs'
                                        : 'text-[#737373] hover:text-white'
                                }`}
                                title="Grid Cards View"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                <span className="hidden sm:inline text-xs font-sans font-medium">Grid</span>
                            </button>
                        </div>

                        {/* Operations Toolbar */}
                        <div className="flex items-center flex-wrap gap-2">
                            <FileManagerStatus />

                            <a
                                href={`/server/${id}/votion-code${window.location.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-9 px-3.5 rounded-md bg-[#121215] hover:bg-[#1c1c21] text-[#f4f4f5] hover:text-white border border-[#27272a] hover:border-[#3f3f46] text-xs font-medium font-sans transition-all flex items-center gap-1.5 shadow-xs select-none no-underline active:scale-[0.98]"
                                title="Open server workspace in Votion Code Cloud Studio"
                            >
                                <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                <span>Votion Code</span>
                                <span className="text-[10px] text-zinc-500">↗</span>
                            </a>

                            <Can action={'file.create'}>
                                <Button
                                    isSecondary
                                    type="button"
                                    onClick={() => setShowPullModal(true)}
                                    title="Download file from remote URL directly into active directory"
                                    className="flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>Pull URL</span>
                                </Button>

                                <NewDirectoryButton />
                                <UploadButton />

                                <NavLink to={`/server/${id}/files/new${window.location.hash}`} className="no-underline">
                                    <Button className="flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span>New File</span>
                                    </Button>
                                </NavLink>
                            </Can>
                        </div>
                    </div>
                </div>
            </ErrorBoundary>

            {/* Quick Access: Recently Edited Files Strip */}
            <RecentFilesStrip />

            {!files ? (
                <FileManagerSkeleton />
            ) : (
                <>
                    {!files.length ? (
                        <div className="border border-[#1F1F1F] rounded-md bg-[#000000] p-12 text-center">
                            <p className="text-sm text-[#737373] font-sans">This directory is empty.</p>
                        </div>
                    ) : (
                        <CSSTransition classNames={'fade'} timeout={150} appear in>
                            <div className="border border-[#1F1F1F] rounded-md bg-[#000000]">
                                {files.length > 250 && (
                                    <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-3 text-center rounded-t-md">
                                        <p className="text-yellow-400 text-xs font-mono">
                                            This directory is too large to display in the browser, limiting output to the first 250 files.
                                        </p>
                                    </div>
                                )}

                                {/* --- VIEW 1: TREE VIEW (SPLIT LAYOUT) --- */}
                                {viewMode === 'tree' && (
                                    <div className="flex flex-col md:flex-row gap-4 p-4 items-start">
                                        <div className="w-full md:w-64 lg:w-72 shrink-0 md:sticky md:top-4">
                                            <FileTreeView
                                                initialRootFiles={
                                                    directory === '/'
                                                        ? (files || []).filter((f) => !f.isFile)
                                                        : undefined
                                                }
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 w-full border border-[#141414] rounded-lg overflow-hidden">
                                            <div className="hidden sm:flex items-center border-b border-[#141414] bg-[#050505] text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold font-sans select-none">
                                                <div className="w-12 flex items-center justify-center shrink-0 py-2">
                                                    <Tooltip content={selectedFilesLength > 0 && selectedFilesLength === (files?.length || 0) ? 'Deselect all' : 'Select all'} placement={'top'}>
                                                        <div className="flex items-center justify-center">
                                                            <FileActionCheckbox
                                                                type={'checkbox'}
                                                                checked={selectedFilesLength === (files?.length === 0 ? -1 : files?.length)}
                                                                onChange={onSelectAllClick}
                                                            />
                                                        </div>
                                                    </Tooltip>
                                                </div>
                                                <div className="flex flex-1 items-center px-4 py-2 min-w-0 font-sans">
                                                    <div className="flex-1 font-sans">NAME</div>
                                                    <div className="w-[12%] text-right mr-4 hidden sm:block font-sans">SIZE</div>
                                                    <div className="w-[18%] text-right mr-4 hidden md:block font-sans">MODIFIED</div>
                                                </div>
                                                <div className="w-12 shrink-0" />
                                            </div>
                                            {sortedFiles.map((file) => (
                                                <FileObjectRow key={file.key} file={file} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* --- VIEW 2: GRID CARDS VIEW --- */}
                                {viewMode === 'grid' && (
                                    <FileGridView files={sortedFiles} onOpenMedia={setActiveMediaFile} />
                                )}

                                {/* --- VIEW 3: COMPACT VIEW --- */}
                                {viewMode === 'compact' && (
                                    <FileCompactView
                                        files={sortedFiles}
                                        onOpenMedia={setActiveMediaFile}
                                        onSelectAllClick={onSelectAllClick}
                                        selectedFilesLength={selectedFilesLength}
                                        totalFiles={files.length}
                                    />
                                )}

                                {/* --- VIEW 4: STANDARD LIST VIEW --- */}
                                {viewMode === 'list' && (
                                    <>
                                        <div className="hidden sm:flex items-center border-b border-[#141414] bg-[#050505] text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold font-sans select-none rounded-t-md">
                                            <div className="w-12 flex items-center justify-center shrink-0 py-2">
                                                <Tooltip content={selectedFilesLength > 0 && selectedFilesLength === (files?.length || 0) ? 'Deselect all' : 'Select all'} placement={'top'}>
                                                    <div className="flex items-center justify-center">
                                                        <FileActionCheckbox
                                                            type={'checkbox'}
                                                            checked={selectedFilesLength === (files?.length === 0 ? -1 : files?.length)}
                                                            onChange={onSelectAllClick}
                                                        />
                                                    </div>
                                                </Tooltip>
                                            </div>
                                            <div className="flex flex-1 items-center px-4 py-2 min-w-0 font-sans">
                                                <div className="flex-1 font-sans">NAME</div>
                                                <div className="w-[12%] text-right mr-4 hidden sm:block font-sans">SIZE</div>
                                                <div className="w-[18%] text-right mr-4 hidden md:block font-sans">MODIFIED</div>
                                            </div>
                                            <div className="w-12 shrink-0" />
                                        </div>
                                        {sortedFiles.map((file) => (
                                            <FileObjectRow key={file.key} file={file} />
                                        ))}
                                    </>
                                )}

                                <MassActionsBar />
                            </div>
                        </CSSTransition>
                    )}
                </>
            )}

            {/* Pull Remote File from URL Modal */}
            <PullFromUrlModal
                visible={showPullModal}
                directory={directory}
                onDismiss={() => setShowPullModal(false)}
                onFilePulled={mutate}
            />


            {/* Media Player Modal (Image, Audio, Video) */}
            <MediaPlayerModal
                visible={!!activeMediaFile}
                fileName={activeMediaFile?.name || ''}
                filePath={activeMediaFile ? join(directory, activeMediaFile.name) : ''}
                fileSize={activeMediaFile?.size}
                onDismiss={() => setActiveMediaFile(null)}
                onPlayInBackground={(title, url) => setMiniPlayerAudio({ title, url })}
            />

            {/* Persistent Floating Audio Mini Player */}
            {miniPlayerAudio && (
                <AudioMiniPlayer
                    title={miniPlayerAudio.title}
                    url={miniPlayerAudio.url}
                    onClose={() => setMiniPlayerAudio(null)}
                />
            )}
        </ServerContentBlock>
    );
};
