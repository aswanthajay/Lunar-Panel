import React, { useEffect, useState, useRef, useCallback } from 'react';
import getFileContents from '@/api/server/files/getFileContents';
import { httpErrorToHuman } from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import saveFileContents from '@/api/server/files/saveFileContents';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import { useHistory, useLocation, useParams } from 'react-router';
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

    useEffect(() => {
        if (action === 'new') return;

        setError('');
        setLoading(true);
        const path = hashToPath(hash);
        setDirectory(dirname(path));
        getFileContents(uuid, path)
            .then(setContent)
            .catch((error) => {
                console.error(error);
                setError(httpErrorToHuman(error));
            })
            .then(() => setLoading(false));
    }, [action, uuid, hash]);

    const save = useCallback((name?: string) => {
        if (!fetchFileContent.current) {
            return;
        }

        setIsSaving(true);
        clearFlashes('files:view');
        fetchFileContent.current()
            .then((content) => saveFileContents(uuid, name || hashToPath(hash), content))
            .then(() => {
                if (name) {
                    history.push(`/server/${id}/files/edit#/${encodePathSegments(name)}`);
                    return;
                }
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2500);
                addFlash({
                    type: 'success',
                    message: 'Your changes have been saved successfully.',
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
    }, [uuid, hash, id, history]);

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

    return (
        <PageContentBlock title={'File Editor'}>
            <FlashMessageRender byKey={'files:view'} css={tw`mb-4`} />
            <ErrorBoundary>
                <div className="mb-4">
                    <FileManagerBreadcrumbs withinFileEditor isNewFile={action !== 'edit'} />
                </div>
            </ErrorBoundary>
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
            <div className="relative">
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
                />
            </div>
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2.5">
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
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                            className="px-5 py-2 rounded-md font-medium text-xs text-[#000000] bg-[#FFFFFF] hover:bg-[#E5E5E5] transition-colors cursor-pointer border border-[#FFFFFF] shadow-sm disabled:opacity-50"
                        >
                            Create File
                        </button>
                    </Can>
                )}
            </div>
        </PageContentBlock>
    );
};