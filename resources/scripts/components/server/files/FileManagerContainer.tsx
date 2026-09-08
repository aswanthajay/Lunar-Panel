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
import { Button } from '@/components/elements/button/index';
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

    // View mode state - defaults to tree view
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const saved = localStorage.getItem('lunar:file_view_mode_v2');
        if (saved === 'tree' || saved === 'list' || saved === 'compact' || saved === 'grid') {
            return saved;
        }
        return 'tree';
    });

    const handleSetViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('lunar:file_view_mode_v2', mode);
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
                    <FileManagerBreadcrumbs
                        renderLeft={
                            <FileActionCheckbox
                                type={'checkbox'}
                                css={tw`mx-4`}
                                checked={selectedFilesLength === (files?.length === 0 ? -1 : files?.length)}
                                onChange={onSelectAllClick}
                            />
                        }
                    />

                    <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
                        {/* View Mode Switcher Group */}
                        <div className="flex items-center rounded-lg bg-[#0A0A0A] border border-[#1F1F1F] p-0.5 select-none">
                            <button
                                type="button"
                                onClick={() => handleSetViewMode('tree')}
                                className={`px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1 ${
                                    viewMode === 'tree'
                                        ? 'bg-[#1F1F1F] text-white shadow-xs'
                                        : 'text-[#737373] hover:text-white'
                                }`}
                                title="Directory Tree Explorer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span className="hidden sm:inline text-[11px] font-mono">Tree</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSetViewMode('list')}
                                className={`px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1 ${
                                    viewMode === 'list'
                                        ? 'bg-[#1F1F1F] text-white shadow-xs'
                                        : 'text-[#737373] hover:text-white'
                                }`}
                                title="List View"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                                <span className="hidden sm:inline text-[11px] font-mono">List</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSetViewMode('compact')}
                                className={`px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1 ${
                                    viewMode === 'compact'
                                        ? 'bg-[#1F1F1F] text-white shadow-xs'
                                        : 'text-[#737373] hover:text-white'
                                }`}
                                title="Compact High-Density View"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span className="hidden sm:inline text-[11px] font-mono">Compact</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSetViewMode('grid')}
                                className={`px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1 ${
                                    viewMode === 'grid'
                                        ? 'bg-[#1F1F1F] text-white shadow-xs'
                                        : 'text-[#737373] hover:text-white'
                                }`}
                                title="Grid Cards View"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                <span className="hidden sm:inline text-[11px] font-mono">Grid</span>
                            </button>
                        </div>

                        {/* Operations Toolbar */}
                        <div className="flex items-center gap-2">
                            <Can action={'file.create'}>
                                <button
                                    type="button"
                                    onClick={() => setShowPullModal(true)}
                                    className="px-3 py-1.5 rounded-md bg-[#0A0A0A] hover:bg-[#141414] text-[#EDEDED] hover:text-white border border-[#1F1F1F] hover:border-[#383838] text-xs font-mono transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                    title="Download file from remote URL directly into active directory"
                                >
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span className="hidden sm:inline">Pull URL</span>
                                </button>
                            </Can>

                            <Can action={'file.create'}>
                                <div className={style.manager_actions}>
                                    <FileManagerStatus />
                                    <NewDirectoryButton />
                                    <UploadButton />
                                    <NavLink to={`/server/${id}/files/new${window.location.hash}`}>
                                        <Button>New File</Button>
                                    </NavLink>
                                </div>
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
                                            <div className="hidden sm:flex items-center px-4 py-2 border-b border-[#141414] bg-[#050505] text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-semibold select-none">
                                                <div className="w-12" />
                                                <div className="flex-1">Name</div>
                                                <div className="w-[15%] text-right mr-4 hidden sm:block">Size</div>
                                                <div className="w-8" />
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
                                    <FileCompactView files={sortedFiles} onOpenMedia={setActiveMediaFile} />
                                )}

                                {/* --- VIEW 4: STANDARD LIST VIEW --- */}
                                {viewMode === 'list' && (
                                    <>
                                        <div className="hidden sm:flex items-center px-4 py-2 border-b border-[#141414] bg-[#050505] text-[10px] uppercase tracking-[0.1em] text-[#6B7280] font-semibold select-none rounded-t-md">
                                            <div className="w-12" />
                                            <div className="flex-1">Name</div>
                                            <div className="w-[12%] text-right mr-4 hidden sm:block">Size</div>
                                            <div className="w-[18%] text-right mr-4 hidden md:block">Last Modified</div>
                                            <div className="w-8" />
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
