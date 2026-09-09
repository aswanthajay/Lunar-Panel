import React, { useEffect, useState, useRef, useCallback } from 'react';
import getFileContents from '@/api/server/files/getFileContents';
import { httpErrorToHuman } from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import saveFileContents from '@/api/server/files/saveFileContents';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import { useHistory, useLocation, useParams, NavLink } from 'react-router-dom';
import FileNameModal from '@/components/server/files/FileNameModal';
import Can from '@/components/elements/Can';
import FlashMessageRender from '@/components/FlashMessageRender';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { ServerError } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { encodePathSegments, hashToPath } from '@/helpers';
import { dirname } from 'path';
import MonacoEditor, { MONACO_LANGUAGES } from '@/components/elements/MonacoEditor';
import { formatCode } from './CodeFormatter';
import { addRecentFile } from './RecentFilesStrip';

interface EditorTab {
    path: string;
    name: string;
    isNew?: boolean;
}

export default () => {
    const [error, setError] = useState('');
    const { action } = useParams<{ action: 'new' | string }>();
    const [loading, setLoading] = useState(action === 'edit');
    const [content, setContent] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [mode, setMode] = useState('plaintext');
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const history = useHistory();
    const { hash } = useLocation();

    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);
    const { addFlash, addError, clearFlashes } = useFlash();

    const fetchFileContent = useRef<null | (() => Promise<string>)>(null);

    // Multi-Tab session state
    const currentPath = action === 'new' ? '' : hashToPath(hash);
    const [tabs, setTabs] = useState<EditorTab[]>(() => {
        if (action === 'new') {
            return [{ path: '', name: 'Untitled File', isNew: true }];
        }
        const name = currentPath.split('/').pop() || currentPath;
        return [{ path: currentPath, name, isNew: false }];
    });

    // Split View state
    const [splitView, setSplitView] = useState(false);
    const [pane2Path, setPane2Path] = useState<string | null>(null);
    const [pane2Content, setPane2Content] = useState('');
    const [pane2Mode, setPane2Mode] = useState('plaintext');
    const [pane2Loading, setPane2Loading] = useState(false);
    const [pane2Saving, setPane2Saving] = useState(false);
    const [mobileActivePane, setMobileActivePane] = useState<1 | 2>(1);
    const fetchPane2Content = useRef<null | (() => Promise<string>)>(null);

    // Synchronize open tabs with current file
    useEffect(() => {
        if (action === 'new') {
            if (!tabs.some((t) => t.isNew)) {
                setTabs((prev) => [...prev, { path: '', name: 'Untitled File', isNew: true }]);
            }
            return;
        }

        const path = hashToPath(hash);
        if (!path) return;

        const name = path.split('/').pop() || path;
        setTabs((prev) => {
            if (prev.some((t) => t.path === path)) return prev;
            return [...prev, { path, name, isNew: false }];
        });

        // Track in recently edited files
        addRecentFile(uuid, path);
    }, [action, hash, uuid]);

    useEffect(() => {
        if (action === 'new') return;

        setError('');
        setLoading(true);
        const path = hashToPath(hash);
        setDirectory(dirname(path));
        getFileContents(uuid, path)
            .then((data) => {
                setContent(data);
            })
            .catch((error) => {
                console.error(error);
                setError(httpErrorToHuman(error));
            })
            .then(() => setLoading(false));
    }, [action, uuid, hash]);

    // Load pane 2 file when pane2Path changes
    useEffect(() => {
        if (!splitView || !pane2Path) return;

        setPane2Loading(true);
        getFileContents(uuid, pane2Path)
            .then((data) => {
                setPane2Content(data);
            })
            .catch((err) => {
                console.error(err);
            })
            .finally(() => setPane2Loading(false));
    }, [splitView, pane2Path, uuid]);

    const save = useCallback(
        (name?: string) => {
            if (!fetchFileContent.current) return;

            setIsSaving(true);
            clearFlashes('files:view');
            const targetPath = name || hashToPath(hash);

            fetchFileContent.current()
                .then((currentVal) => saveFileContents(uuid, targetPath, currentVal))
                .then(() => {
                    addRecentFile(uuid, targetPath);
                    if (name) {
                        history.push(`/server/${id}/files/edit#/${encodePathSegments(name)}`);
                        return;
                    }
                    setIsSaved(true);
                    setTimeout(() => setIsSaved(false), 2500);
                    addFlash({
                        type: 'success',
                        message: 'File saved successfully.',
                        key: 'files:view',
                    });
                    return Promise.resolve();
                })
                .catch((error) => {
                    console.error(error);
                    addError({ message: httpErrorToHuman(error), key: 'files:view' });
                })
                .finally(() => {
                    setIsSaving(false);
                });
        },
        [uuid, hash, id, history]
    );

    const savePane2 = useCallback(() => {
        if (!fetchPane2Content.current || !pane2Path) return;

        setPane2Saving(true);
        clearFlashes('files:view');

        fetchPane2Content.current()
            .then((val) => saveFileContents(uuid, pane2Path, val))
            .then(() => {
                addRecentFile(uuid, pane2Path);
                addFlash({
                    type: 'success',
                    message: `Saved secondary file "${pane2Path.split('/').pop()}".`,
                    key: 'files:view',
                });
            })
            .catch((err) => {
                addError({ message: httpErrorToHuman(err), key: 'files:view' });
            })
            .finally(() => setPane2Saving(false));
    }, [uuid, pane2Path]);

    const handleFormatCode = async () => {
        if (!fetchFileContent.current) return;
        const currentVal = await fetchFileContent.current();
        const activeFilename = action === 'new' ? 'file.txt' : hash.replace(/^#/, '');
        const res = formatCode(currentVal, activeFilename, mode);

        if (res.success) {
            setContent(res.formatted);
            addFlash({
                type: 'success',
                message: 'Code / Config formatted successfully.',
                key: 'files:view',
            });
        } else {
            addError({
                message: res.error || 'Formatting failed.',
                key: 'files:view',
            });
        }
    };

    const handleCloseTab = (e: React.MouseEvent, tabToClose: EditorTab) => {
        e.stopPropagation();
        const remaining = tabs.filter((t) => t !== tabToClose);

        if (!remaining.length) {
            history.push(`/server/${id}/files`);
            return;
        }

        setTabs(remaining);
        const isActive = tabToClose.isNew ? action === 'new' : tabToClose.path === hashToPath(hash);
        if (isActive) {
            const next = remaining[remaining.length - 1];
            if (next.isNew) {
                history.push(`/server/${id}/files/new`);
            } else {
                history.push(`/server/${id}/files/edit#/${encodePathSegments(next.path)}`);
            }
        }
    };

    const handleSelectTab = (tab: EditorTab) => {
        if (tab.isNew) {
            history.push(`/server/${id}/files/new`);
        } else {
            history.push(`/server/${id}/files/edit#/${encodePathSegments(tab.path)}`);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (action !== 'edit') {
                    setModalVisible(true);
                } else {
                    save();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [action, save]);

    if (error) {
        return <ServerError message={error} onBack={() => history.goBack()} />;
    }

    const otherTabs = tabs.filter((t) => !t.isNew && t.path !== hashToPath(hash));

    return (
        <PageContentBlock title={'File Editor'}>
            <FlashMessageRender byKey={'files:view'} css={tw`mb-4`} />

            {/* Breadcrumb row */}
            <ErrorBoundary>
                <div className="mb-3">
                    <FileManagerBreadcrumbs withinFileEditor isNewFile={action !== 'edit'} />
                </div>
            </ErrorBoundary>

            {/* Editor Tabs Strip */}
            <div className="flex items-center justify-between gap-2 border-b border-[#1F1F1F] mb-3 select-none overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1 min-w-0">
                    {tabs.map((tab, idx) => {
                        const isCurrent = tab.isNew ? action === 'new' : tab.path === hashToPath(hash);
                        return (
                            <div
                                key={tab.path || idx}
                                onClick={() => handleSelectTab(tab)}
                                className={`group px-3 py-2 text-xs font-mono rounded-t-lg flex items-center gap-2 cursor-pointer transition-all border-t-2 ${
                                    isCurrent
                                        ? 'bg-[#0A0A0A] text-white border-emerald-500 font-semibold shadow-xs'
                                        : 'bg-[#050505] text-[#737373] hover:text-[#D4D4D4] border-transparent hover:bg-[#080808]'
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0" />
                                <span className="truncate max-w-[130px] sm:max-w-[180px]">{tab.name}</span>
                                <button
                                    type="button"
                                    onClick={(e) => handleCloseTab(e, tab)}
                                    className="p-0.5 rounded text-[#71717A] hover:text-red-400 hover:bg-white/5 transition-colors ml-1"
                                    title="Close tab"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })}

                    <NavLink
                        to={`/server/${id}/files/new${window.location.hash}`}
                        className="px-2 py-1 text-xs text-[#737373] hover:text-white rounded hover:bg-[#141414] transition-colors ml-1 flex items-center"
                        title="New file tab"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                    </NavLink>
                </div>

                {/* Right controls: Create File CTA & Split view */}
                <div className="flex items-center gap-2 shrink-0 pb-1">
                    {action !== 'edit' && (
                        <Can action={'file.create'}>
                            <button
                                type="button"
                                onClick={() => setModalVisible(true)}
                                disabled={isSaving || loading}
                                className="px-3 py-1 rounded text-xs font-semibold text-black bg-white hover:bg-zinc-200 transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Create File</span>
                            </button>
                        </Can>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            const next = !splitView;
                            setSplitView(next);
                            if (next && !pane2Path && otherTabs.length > 0) {
                                setPane2Path(otherTabs[0].path);
                            }
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-mono border transition-all flex items-center gap-1.5 ${
                            splitView
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-[#0A0A0A] text-[#737373] hover:text-white border-[#1F1F1F]'
                        }`}
                        title="Toggle Dual Split-View Editing"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v16m6-16v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
                        </svg>
                        <span className="hidden sm:inline">Split View</span>
                    </button>
                </div>
            </div>

            {/* Mobile Dual-Pane Segment Switcher */}
            {splitView && (
                <div className="md:hidden flex items-center justify-center gap-2 mb-3 bg-[#0A0A0A] p-1 rounded-lg border border-[#1F1F1F]">
                    <button
                        type="button"
                        onClick={() => setMobileActivePane(1)}
                        className={`flex-1 py-1.5 text-xs font-mono rounded-md transition-colors ${
                            mobileActivePane === 1 ? 'bg-[#1F1F1F] text-white font-semibold' : 'text-[#737373]'
                        }`}
                    >
                        Pane 1 ({action === 'new' ? 'Untitled' : hashToPath(hash).split('/').pop()})
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileActivePane(2)}
                        className={`flex-1 py-1.5 text-xs font-mono rounded-md transition-colors ${
                            mobileActivePane === 2 ? 'bg-[#1F1F1F] text-white font-semibold' : 'text-[#737373]'
                        }`}
                    >
                        Pane 2 ({pane2Path ? pane2Path.split('/').pop() : 'Select File'})
                    </button>
                </div>
            )}

            {hash.replace(/^#/, '').endsWith('.pteroignore') && (
                <div className="mb-4 p-4 border-l-4 bg-[#121212] rounded border-[#10B981]">
                    <p className="text-[#A0A0A0] text-sm m-0">
                        You&apos;re editing a <code className="font-mono bg-[#0A0A0A] text-[#FFFFFF] rounded py-px px-1.5 border border-[#262626]">.pteroignore</code>{' '}
                        file. Any files or directories listed in here will be excluded from backups. Wildcards are
                        supported by using an asterisk (<code className="font-mono bg-[#0A0A0A] text-[#FFFFFF] rounded py-px px-1.5 border border-[#262626]">*</code>).
                        You can negate a prior rule by prepending an exclamation point (<code className="font-mono bg-[#0A0A0A] text-[#FFFFFF] rounded py-px px-1.5 border border-[#262626]">!</code>).
                    </p>
                </div>
            )}

            <FileNameModal
                visible={modalVisible}
                onDismissed={() => setModalVisible(false)}
                onFileNamed={(name) => {
                    setModalVisible(false);
                    save(name);
                }}
            />

            {/* --- EDITOR WORKSPACE (SINGLE OR SPLIT) --- */}
            <div className={splitView ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'relative'}>
                {/* PANE 1: PRIMARY EDITOR */}
                <div className={`relative ${splitView && mobileActivePane !== 1 ? 'hidden md:block' : 'block'}`}>
                    <SpinnerOverlay visible={loading} />
                    <MonacoEditor
                        mode={mode}
                        filename={hash.replace(/^#/, '')}
                        onModeChanged={setMode}
                        initialContent={content}
                        fetchContent={(value) => {
                            fetchFileContent.current = value;
                        }}
                        onContentSaved={() => {
                            if (action !== 'edit') {
                                setModalVisible(true);
                            } else {
                                save();
                            }
                        }}
                        onFormat={handleFormatCode}
                    />
                </div>

                {/* PANE 2: SPLIT VIEW EDITOR */}
                {splitView && (
                    <div className={`relative flex flex-col border border-[#1F1F1F] rounded-lg overflow-hidden bg-[#000000] ${mobileActivePane !== 2 ? 'hidden md:flex' : 'flex'}`}>
                        {/* Pane 2 Header selector */}
                        <div className="p-2 border-b border-[#141414] bg-[#0A0A0A] flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-mono text-[#6B7280] uppercase tracking-wider">Pane 2:</span>
                                <select
                                    value={pane2Path || ''}
                                    onChange={(e) => setPane2Path(e.target.value)}
                                    className="bg-[#000000] border border-[#1F1F1F] rounded px-2.5 py-1 text-xs font-mono text-white outline-none"
                                >
                                    <option value="" disabled>Select second file...</option>
                                    {otherTabs.map((t) => (
                                        <option key={t.path} value={t.path}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {pane2Path && (
                                <button
                                    type="button"
                                    onClick={savePane2}
                                    disabled={pane2Saving || pane2Loading}
                                    className="px-3 py-1 text-xs font-mono rounded bg-white text-black hover:bg-[#E5E5E5] font-semibold transition-colors disabled:opacity-50"
                                >
                                    {pane2Saving ? 'Saving...' : 'Save Pane 2'}
                                </button>
                            )}
                        </div>

                        <div className="relative flex-1 min-h-[350px]">
                            <SpinnerOverlay visible={pane2Loading} />
                            {pane2Path ? (
                                <MonacoEditor
                                    key={pane2Path}
                                    mode={pane2Mode}
                                    filename={pane2Path}
                                    onModeChanged={setPane2Mode}
                                    initialContent={pane2Content}
                                    fetchContent={(val) => {
                                        fetchPane2Content.current = val;
                                    }}
                                    onContentSaved={savePane2}
                                />
                            ) : (
                                <div className="h-96 flex flex-col items-center justify-center text-xs font-mono text-[#525252]">
                                    <span>Select a secondary file from the dropdown above to edit side-by-side.</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[#141414]">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#6B7280] uppercase tracking-wider">Syntax:</span>
                        <select
                            value={mode}
                            onChange={(e) => setMode(e.currentTarget.value)}
                            className="bg-[#000000] hover:bg-[#0A0A0A] border border-[#1F1F1F] rounded px-3 py-1.5 text-xs font-mono text-[#FFFFFF] outline-none cursor-pointer transition-colors"
                        >
                            {MONACO_LANGUAGES.map((lang) => (
                                <option key={lang.id} value={lang.id}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {action === 'edit' ? (
                        <Can action={'file.update'}>
                            <button
                                type="button"
                                onClick={() => save()}
                                disabled={isSaving || loading}
                                className={`px-5 py-2 rounded-md font-medium text-xs transition-colors cursor-pointer border shadow-sm flex items-center gap-2 ${
                                    isSaved
                                        ? 'bg-[#10B981] text-black border-[#10B981]'
                                        : 'bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] border-[#FFFFFF] disabled:opacity-50 disabled:cursor-not-allowed'
                                }`}
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span>Saving...</span>
                                    </>
                                ) : isSaved ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Saved!</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Save Content</span>
                                        <span className="text-[10px] font-mono text-[#404040]">Ctrl+S</span>
                                    </>
                                )}
                            </button>
                        </Can>
                    ) : (
                        <Can action={'file.create'}>
                            <button
                                type="button"
                                onClick={() => setModalVisible(true)}
                                disabled={isSaving || loading}
                                className="px-4 py-2 rounded-md font-medium text-xs text-zinc-400 hover:text-white bg-transparent hover:bg-zinc-800/60 transition-colors cursor-pointer border border-zinc-800 disabled:opacity-50"
                            >
                                Create File
                            </button>
                        </Can>
                    )}
                </div>
            </div>
        </PageContentBlock>
    );
};