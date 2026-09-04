import React, { useEffect, useState } from 'react';
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

    const history = useHistory();
    const { hash } = useLocation();

    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);
    const { addError, clearFlashes } = useFlash();

    let fetchFileContent: null | (() => Promise<string>) = null;

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

    const save = (name?: string) => {
        if (!fetchFileContent) {
            return;
        }

        setLoading(true);
        clearFlashes('files:view');
        fetchFileContent()
            .then((content) => saveFileContents(uuid, name || hashToPath(hash), content))
            .then(() => {
                if (name) {
                    history.push(`/server/${id}/files/edit#/${encodePathSegments(name)}`);
                    return;
                }
                return Promise.resolve();
            })
            .catch((error) => {
                console.error(error);
                addError({ message: httpErrorToHuman(error), key: 'files:view' });
            })
            .then(() => setLoading(false));
    };

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
                        fetchFileContent = value;
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
                            className="px-5 py-2 rounded-md font-medium text-xs text-[#000000] bg-[#FFFFFF] hover:bg-[#E5E5E5] transition-colors cursor-pointer border border-[#FFFFFF] shadow-sm flex items-center gap-2"
                        >
                            <span>Save Content</span>
                            <span className="text-[10px] font-mono text-[#404040]">Ctrl+S</span>
                        </button>
                    </Can>
                ) : (
                    <Can action={'file.create'}>
                        <button
                            type="button"
                            onClick={() => setModalVisible(true)}
                            className="px-5 py-2 rounded-md font-medium text-xs text-[#000000] bg-[#FFFFFF] hover:bg-[#E5E5E5] transition-colors cursor-pointer border border-[#FFFFFF] shadow-sm"
                        >
                            Create File
                        </button>
                    </Can>
                )}
            </div>
        </PageContentBlock>
    );
};