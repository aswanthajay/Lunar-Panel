import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import getFileContents from '@/api/server/files/getFileContents';
import saveFileContents from '@/api/server/files/saveFileContents';
import createDirectory from '@/api/server/files/createDirectory';
import deleteFiles from '@/api/server/files/deleteFiles';
import loader from '@monaco-editor/loader';
import { getMonacoLanguage } from '@/components/elements/MonacoEditor';
import Console from '@/components/server/console/Console';
import { PowerAction } from '@/components/server/console/ServerConsoleContainer';
import Can from '@/components/elements/Can';

interface OpenFileTab {
    path: string;
    name: string;
    content: string;
    originalContent: string;
    isModified: boolean;
    language: string;
}

interface DirectoryNode {
    path: string;
    name: string;
    isOpen: boolean;
    loading: boolean;
    children: (FileObject & { fullPath: string })[];
}

const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
        case 'js':
        case 'mjs':
        case 'cjs':
            return { label: 'JS', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' };
        case 'ts':
        case 'tsx':
            return { label: 'TS', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
        case 'jsx':
            return { label: 'JSX', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
        case 'py':
            return { label: 'PY', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
        case 'json':
            return { label: '{}', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
        case 'yml':
        case 'yaml':
            return { label: 'YML', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
        case 'sh':
        case 'bash':
            return { label: 'SH', color: 'bg-green-500/20 text-green-300 border-green-500/40' };
        case 'env':
        case 'properties':
        case 'ini':
        case 'cfg':
            return { label: 'CFG', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' };
        case 'java':
        case 'jar':
            return { label: 'JV', color: 'bg-red-500/20 text-red-300 border-red-500/40' };
        case 'md':
            return { label: 'MD', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
        case 'html':
        case 'htm':
            return { label: '<>', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' };
        case 'css':
        case 'scss':
            return { label: '#', color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' };
        case 'sql':
            return { label: 'DB', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
        case 'dockerfile':
            return { label: 'DK', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
        default:
            return { label: 'FILE', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    }
};

const VotionCodeContainer: React.FC = () => {
    const history = useHistory();
    const location = useLocation();
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const status = ServerContext.useStoreState((state) => state.status.value) || 'offline';
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

    // Explorer State
    const [isExplorerOpen, setIsExplorerOpen] = useState(true);
    const [explorerWidth] = useState(260);
    const [directoryTree, setDirectoryTree] = useState<Record<string, DirectoryNode>>({
        '/': { path: '/', name: 'root', isOpen: true, loading: false, children: [] },
    });
    const [filterQuery, setFilterQuery] = useState('');

    // Editor & Tabs State
    const [openTabs, setOpenTabs] = useState<OpenFileTab[]>([]);
    const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveToast, setSaveToast] = useState<string | null>(null);
    const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

    // Terminal Drawer State
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [terminalHeight, setTerminalHeight] = useState(260);

    // New File / Folder inline prompt state
    const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
    const [creatingInPath, setCreatingInPath] = useState('/');
    const [newItemName, setNewItemName] = useState('');

    const editorContainerRef = useRef<HTMLDivElement>(null);
    const monacoInstanceRef = useRef<any>(null);
    const editorInstanceRef = useRef<any>(null);

    // Active tab helper
    const activeTab = useMemo(() => {
        return openTabs.find((t) => t.path === activeTabPath) || null;
    }, [openTabs, activeTabPath]);

    // Fetch directory contents helper
    const loadDir = useCallback(
        async (dirPath: string) => {
            setDirectoryTree((prev) => ({
                ...prev,
                [dirPath]: {
                    path: dirPath,
                    name: dirPath.split('/').filter(Boolean).pop() || 'root',
                    isOpen: true,
                    loading: true,
                    children: prev[dirPath]?.children || [],
                },
            }));

            try {
                const items = await loadDirectory(server.uuid, dirPath);
                const formatted = items.map((item) => ({
                    ...item,
                    fullPath: dirPath === '/' ? `/${item.name}` : `${dirPath}/${item.name}`,
                }));

                setDirectoryTree((prev) => ({
                    ...prev,
                    [dirPath]: {
                        path: dirPath,
                        name: dirPath.split('/').filter(Boolean).pop() || 'root',
                        isOpen: true,
                        loading: false,
                        children: formatted,
                    },
                }));
            } catch (err) {
                console.error('Failed to load directory:', dirPath, err);
                setDirectoryTree((prev) => ({
                    ...prev,
                    [dirPath]: {
                        ...prev[dirPath],
                        loading: false,
                    },
                }));
            }
        },
        [server.uuid]
    );

    // Initialize root directory
    useEffect(() => {
        loadDir('/');
    }, [loadDir]);

    // Open file into tab
    const openFile = useCallback(
        async (filePath: string) => {
            const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
            const existing = openTabs.find((t) => t.path === cleanPath);
            if (existing) {
                setActiveTabPath(cleanPath);
                return;
            }

            try {
                const fileName = cleanPath.split('/').pop() || 'file';
                const content = await getFileContents(server.uuid, cleanPath);
                const language = getMonacoLanguage(fileName);

                const newTab: OpenFileTab = {
                    path: cleanPath,
                    name: fileName,
                    content,
                    originalContent: content,
                    isModified: false,
                    language,
                };

                setOpenTabs((prev) => [...prev, newTab]);
                setActiveTabPath(cleanPath);
            } catch (err) {
                console.error('Failed to open file:', cleanPath, err);
                alert(`Could not open file: ${cleanPath}`);
            }
        },
        [openTabs, server.uuid]
    );

    // Parse URL hash for initial file open if provided (e.g. #/src/index.js)
    useEffect(() => {
        if (location.hash) {
            const pathFromHash = decodeURIComponent(location.hash.replace(/^#\/?/, '/'));
            if (pathFromHash) {
                openFile(pathFromHash);
            }
        }
    }, [location.hash, openFile]);

    // Close tab helper
    const closeTab = useCallback(
        (path: string, e?: React.MouseEvent) => {
            if (e) e.stopPropagation();
            const tabToClose = openTabs.find((t) => t.path === path);
            if (tabToClose?.isModified) {
                const discard = window.confirm(`File "${tabToClose.name}" has unsaved changes. Discard?`);
                if (!discard) return;
            }

            setOpenTabs((prev) => {
                const nextTabs = prev.filter((t) => t.path !== path);
                if (activeTabPath === path) {
                    const currentIndex = prev.findIndex((t) => t.path === path);
                    const newActive = nextTabs[currentIndex] || nextTabs[currentIndex - 1] || null;
                    setActiveTabPath(newActive ? newActive.path : null);
                }
                return nextTabs;
            });
        },
        [openTabs, activeTabPath]
    );

    // Save active file
    const saveActiveFile = useCallback(async () => {
        if (!activeTab || isSaving) return;
        setIsSaving(true);
        try {
            const currentVal = editorInstanceRef.current ? editorInstanceRef.current.getValue() : activeTab.content;
            await saveFileContents(server.uuid, activeTab.path, currentVal);

            setOpenTabs((prev) =>
                prev.map((t) =>
                    t.path === activeTab.path
                        ? { ...t, content: currentVal, originalContent: currentVal, isModified: false }
                        : t
                )
            );

            setSaveToast('Saved to server');
            setTimeout(() => setSaveToast(null), 2500);
        } catch (err) {
            console.error('Failed to save file:', err);
            alert('Failed to save file. Check permissions or network.');
        } finally {
            setIsSaving(false);
        }
    }, [activeTab, isSaving, server.uuid]);

    // Keyboard shortcuts (Ctrl+S / Cmd+S to save, Ctrl+` to toggle terminal, Ctrl+B to toggle explorer)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveActiveFile();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
                e.preventDefault();
                setIsTerminalOpen((prev) => !prev);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                setIsExplorerOpen((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [saveActiveFile]);

    // Mount / Update Monaco Editor
    useEffect(() => {
        if (!editorContainerRef.current) return;

        let isDisposed = false;

        loader.init().then((monaco) => {
            if (isDisposed || !editorContainerRef.current) return;
            monacoInstanceRef.current = monaco;

            if (!editorInstanceRef.current) {
                editorInstanceRef.current = monaco.editor.create(editorContainerRef.current, {
                    value: activeTab?.content || '',
                    language: activeTab?.language || 'plaintext',
                    theme: 'vs-dark',
                    automaticLayout: true,
                    fontSize: 13,
                    fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
                    lineNumbers: 'on',
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    tabSize: 4,
                    wordWrap: 'on',
                    renderWhitespace: 'selection',
                    cursorBlinking: 'smooth',
                    smoothScrolling: true,
                    scrollbar: {
                        verticalScrollbarSize: 8,
                        horizontalScrollbarSize: 8,
                    },
                });

                editorInstanceRef.current.onDidChangeModelContent(() => {
                    const val = editorInstanceRef.current.getValue();
                    setOpenTabs((prev) =>
                        prev.map((t) => {
                            if (t.path === activeTabPath) {
                                return {
                                    ...t,
                                    content: val,
                                    isModified: val !== t.originalContent,
                                };
                            }
                            return t;
                        })
                    );
                });

                editorInstanceRef.current.onDidChangeCursorPosition((e: any) => {
                    setCursorPos({
                        line: e.position.lineNumber,
                        col: e.position.column,
                    });
                });
            } else {
                const currentModel = editorInstanceRef.current.getModel();
                const newContent = activeTab?.content || '';
                const newLang = activeTab?.language || 'plaintext';

                if (currentModel) {
                    monaco.editor.setModelLanguage(currentModel, newLang);
                    if (editorInstanceRef.current.getValue() !== newContent) {
                        editorInstanceRef.current.setValue(newContent);
                    }
                }
            }
        });

        return () => {
            isDisposed = true;
        };
    }, [activeTabPath]);

    // Power Actions
    const handlePowerAction = (action: PowerAction) => {
        if (instance) {
            instance.send('set state', action);
        }
    };

    // Create item handler (file or folder)
    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim()) return;

        const targetPath = creatingInPath === '/' ? `/${newItemName.trim()}` : `${creatingInPath}/${newItemName.trim()}`;

        try {
            if (creatingType === 'folder') {
                await createDirectory(server.uuid, creatingInPath, newItemName.trim());
            } else {
                await saveFileContents(server.uuid, targetPath, '');
                openFile(targetPath);
            }
            loadDir(creatingInPath);
        } catch (err) {
            console.error('Failed to create item:', err);
            alert('Failed to create item.');
        } finally {
            setCreatingType(null);
            setNewItemName('');
        }
    };

    // Delete item handler
    const handleDeleteItem = async (item: FileObject & { fullPath: string }, e: React.MouseEvent) => {
        e.stopPropagation();
        const confirmDelete = window.confirm(`Permanently delete "${item.name}"?`);
        if (!confirmDelete) return;

        const dir = item.fullPath.substring(0, item.fullPath.lastIndexOf('/')) || '/';
        try {
            await deleteFiles(server.uuid, dir, [item.name]);
            loadDir(dir);
            closeTab(item.fullPath);
        } catch (err) {
            console.error('Failed to delete item:', err);
            alert('Failed to delete item.');
        }
    };

    return (
        <div className="w-screen h-screen flex flex-col bg-[#000000] text-[#D4D4D8] font-sans select-none overflow-hidden">
            {/* 1. TOP HEADER TOOLBAR */}
            <header className="h-12 bg-[#050505] border-b border-[#1A1A1A] px-4 flex items-center justify-between shrink-0 z-30">
                {/* Left: Branding & Server Name */}
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] font-mono font-bold text-xs">
                            &lt;/&gt;
                        </div>
                        <span className="font-serif font-bold text-sm text-white tracking-tight">
                            Votion Code
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 uppercase">
                            Cloud Studio
                        </span>
                    </div>

                    <span className="text-[#333333] hidden md:inline">|</span>

                    <div className="hidden sm:flex items-center gap-2 min-w-0 text-xs font-mono">
                        <span className="text-white font-medium truncate max-w-[180px]" title={server.name}>
                            {server.name}
                        </span>
                        <code className="text-[10px] text-[#71717A] bg-[#0A0A0A] border border-[#1A1A1A] px-1.5 py-0.5 rounded">
                            {server.id}
                        </code>
                    </div>
                </div>

                {/* Center: Power Action Controls & Status */}
                <div className="flex items-center gap-2">
                    {/* Status Pill */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0A0A0A] border border-[#1A1A1A] text-[11px] font-mono">
                        <span
                            className={`w-2 h-2 rounded-full ${
                                status === 'running'
                                    ? 'bg-[#10B981] animate-pulse'
                                    : status === 'starting'
                                    ? 'bg-amber-400 animate-pulse'
                                    : status === 'stopping'
                                    ? 'bg-red-400 animate-pulse'
                                    : 'bg-zinc-600'
                            }`}
                        />
                        <span className="capitalize text-zinc-300">{status}</span>
                    </div>

                    {/* Start / Restart / Stop Controls */}
                    <Can action={'control.start'}>
                        <button
                            type="button"
                            disabled={status !== 'offline'}
                            onClick={() => handlePowerAction('start')}
                            className="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all bg-[#0A0A0A] hover:bg-[#141414] text-white border border-[#1F1F1F] hover:border-emerald-500/50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                            title="Start Server"
                        >
                            <span className="text-emerald-400 font-bold">▶</span>
                            <span className="hidden lg:inline">Start</span>
                        </button>
                    </Can>

                    <Can action={'control.restart'}>
                        <button
                            type="button"
                            disabled={status === 'offline'}
                            onClick={() => handlePowerAction('restart')}
                            className="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all bg-[#0A0A0A] hover:bg-[#141414] text-white border border-[#1F1F1F] hover:border-blue-500/50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                            title="Restart Server"
                        >
                            <span className="text-blue-400 font-bold">↻</span>
                            <span className="hidden lg:inline">Restart</span>
                        </button>
                    </Can>

                    <Can action={'control.stop'}>
                        <button
                            type="button"
                            disabled={status === 'offline'}
                            onClick={() => handlePowerAction('stop')}
                            className="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all bg-[#0A0A0A] hover:bg-[#141414] text-white border border-[#1F1F1F] hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                            title="Stop Server"
                        >
                            <span className="text-amber-400 font-bold">■</span>
                            <span className="hidden lg:inline">Stop</span>
                        </button>
                    </Can>
                </div>

                {/* Right: Workspace & Save Controls */}
                <div className="flex items-center gap-2">
                    {/* Quick Save Button */}
                    <button
                        type="button"
                        disabled={!activeTab || !activeTab.isModified || isSaving}
                        onClick={saveActiveFile}
                        className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab?.isModified
                                ? 'bg-emerald-500 text-black shadow-sm hover:bg-emerald-400'
                                : 'bg-[#0A0A0A] text-zinc-500 border border-[#1A1A1A] cursor-not-allowed'
                        }`}
                        title="Save active file (Ctrl+S)"
                    >
                        <span>💾</span>
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>

                    {/* Terminal Drawer Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsTerminalOpen((prev) => !prev)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isTerminalOpen
                                ? 'bg-[#1F1F1F] text-white border-[#383838]'
                                : 'bg-[#0A0A0A] text-zinc-400 border-[#1A1A1A] hover:text-white'
                        }`}
                        title="Toggle Live Terminal (Ctrl+`)"
                    >
                        <span>💻</span>
                        <span className="hidden sm:inline">Terminal</span>
                    </button>

                    {/* Explorer Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsExplorerOpen((prev) => !prev)}
                        className={`p-1.5 rounded-md text-xs transition-all cursor-pointer border ${
                            isExplorerOpen
                                ? 'bg-[#1F1F1F] text-white border-[#383838]'
                                : 'bg-[#0A0A0A] text-zinc-400 border-[#1A1A1A] hover:text-white'
                        }`}
                        title="Toggle Explorer (Ctrl+B)"
                    >
                        📁
                    </button>

                    {/* Exit to Panel */}
                    <button
                        type="button"
                        onClick={() => history.push(`/server/${server.id}`)}
                        className="px-2.5 py-1 rounded-md text-xs font-mono text-zinc-400 hover:text-white bg-[#0A0A0A] hover:bg-[#141414] border border-[#1A1A1A] transition-all cursor-pointer flex items-center gap-1"
                        title="Exit Votion Code back to Server Console"
                    >
                        <span>Exit</span>
                        <span>↗</span>
                    </button>
                </div>
            </header>

            {/* 2. MAIN BODY (EXPLORER + EDITOR + TERMINAL) */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* ---------- LEFT: PROJECT EXPLORER ---------- */}
                {isExplorerOpen && (
                    <aside
                        style={{ width: `${explorerWidth}px` }}
                        className="h-full bg-[#050505] border-r border-[#1A1A1A] flex flex-col shrink-0 select-none overflow-hidden"
                    >
                        {/* Explorer Header */}
                        <div className="px-3 py-2.5 border-b border-[#141414] flex items-center justify-between text-xs">
                            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                                Project Explorer
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreatingType('file');
                                        setCreatingInPath('/');
                                    }}
                                    className="p-1 text-zinc-400 hover:text-white hover:bg-[#1A1A1A] rounded transition-colors"
                                    title="New File in root"
                                >
                                    +📄
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreatingType('folder');
                                        setCreatingInPath('/');
                                    }}
                                    className="p-1 text-zinc-400 hover:text-white hover:bg-[#1A1A1A] rounded transition-colors"
                                    title="New Folder in root"
                                >
                                    +📁
                                </button>
                                <button
                                    type="button"
                                    onClick={() => loadDir('/')}
                                    className="p-1 text-zinc-400 hover:text-white hover:bg-[#1A1A1A] rounded transition-colors"
                                    title="Refresh Explorer"
                                >
                                    🔄
                                </button>
                            </div>
                        </div>

                        {/* Search Filter */}
                        <div className="p-2 border-b border-[#141414]">
                            <input
                                type="text"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder="Filter files..."
                                className="w-full bg-[#0A0A0A] border border-[#1A1A1A] rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500 font-mono placeholder:text-zinc-600"
                            />
                        </div>

                        {/* Inline Item Creation Form */}
                        {creatingType && (
                            <form onSubmit={handleCreateItem} className="p-2 bg-[#0C0C0C] border-b border-[#1F1F1F]">
                                <div className="text-[10px] text-emerald-400 font-mono mb-1">
                                    New {creatingType === 'file' ? 'File' : 'Folder'} in {creatingInPath}
                                </div>
                                <div className="flex gap-1">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        placeholder={creatingType === 'file' ? 'app.js' : 'src'}
                                        className="flex-1 bg-[#141414] border border-[#262626] rounded px-1.5 py-0.5 text-xs text-white outline-none font-mono"
                                    />
                                    <button
                                        type="submit"
                                        className="px-2 py-0.5 bg-emerald-500 text-black text-xs font-bold rounded"
                                    >
                                        ✓
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCreatingType(null)}
                                        className="px-1.5 py-0.5 bg-[#1F1F1F] text-zinc-400 text-xs rounded"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Directory File Tree List */}
                        <div className="flex-1 overflow-y-auto py-1 px-1 font-mono text-xs">
                            {directoryTree['/']?.loading ? (
                                <div className="p-3 text-center text-xs text-zinc-500 animate-pulse">
                                    Scanning server tree...
                                </div>
                            ) : (
                                (directoryTree['/']?.children || [])
                                    .filter((item) =>
                                        filterQuery ? item.name.toLowerCase().includes(filterQuery.toLowerCase()) : true
                                    )
                                    .map((item) => {
                                        const icon = getFileIcon(item.name);
                                        const isDir = !item.isFile;
                                        const isOpened = activeTabPath === item.fullPath;

                                        return (
                                            <div
                                                key={item.fullPath}
                                                onClick={() => {
                                                    if (isDir) {
                                                        const node = directoryTree[item.fullPath];
                                                        if (node?.isOpen) {
                                                            setDirectoryTree((prev) => ({
                                                                ...prev,
                                                                [item.fullPath]: { ...node, isOpen: false },
                                                            }));
                                                        } else {
                                                            loadDir(item.fullPath);
                                                        }
                                                    } else {
                                                        openFile(item.fullPath);
                                                    }
                                                }}
                                                className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                                                    isOpened
                                                        ? 'bg-[#1A1A1A] text-white font-medium'
                                                        : 'hover:bg-[#121212] text-zinc-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0 truncate">
                                                    {isDir ? (
                                                        <span className="text-amber-400 text-xs">
                                                            {directoryTree[item.fullPath]?.isOpen ? '📂' : '📁'}
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className={`text-[9px] px-1 py-0.2 rounded font-bold border ${icon.color}`}
                                                        >
                                                            {icon.label}
                                                        </span>
                                                    )}
                                                    <span className="truncate">{item.name}</span>
                                                </div>

                                                {/* Delete quick action */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteItem(item, e)}
                                                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 px-1 text-[11px]"
                                                    title="Delete"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </aside>
                )}

                {/* ---------- CENTER: MULTI-TAB MONACO EDITOR ---------- */}
                <main className="flex-1 flex flex-col h-full bg-[#000000] min-w-0 overflow-hidden">
                    {/* Tab Strip */}
                    <div className="h-9 bg-[#080808] border-b border-[#1A1A1A] flex items-center overflow-x-auto select-none shrink-0 px-1">
                        {openTabs.length === 0 ? (
                            <div className="text-xs text-zinc-600 px-3 font-mono">
                                No files open. Select a file from the explorer on the left.
                            </div>
                        ) : (
                            openTabs.map((tab) => {
                                const isActive = tab.path === activeTabPath;
                                const icon = getFileIcon(tab.name);
                                return (
                                    <div
                                        key={tab.path}
                                        onClick={() => setActiveTabPath(tab.path)}
                                        className={`group flex items-center gap-2 px-3 h-full border-r border-[#141414] text-xs font-mono cursor-pointer transition-colors shrink-0 ${
                                            isActive
                                                ? 'bg-[#000000] text-white border-t-2 border-t-emerald-500 font-medium'
                                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#0E0E0E]'
                                        }`}
                                    >
                                        <span className={`text-[8px] px-1 py-0.2 rounded font-bold border ${icon.color}`}>
                                            {icon.label}
                                        </span>
                                        <span className="truncate max-w-[150px]">{tab.name}</span>
                                        {tab.isModified && (
                                            <span
                                                className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                                                title="Unsaved changes"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => closeTab(tab.path, e)}
                                            className="text-zinc-500 hover:text-white ml-1 rounded hover:bg-[#1F1F1F] w-4 h-4 inline-flex items-center justify-center text-[10px]"
                                            title="Close tab"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Monaco Editor Canvas */}
                    <div className="flex-1 relative bg-[#000000] overflow-hidden">
                        {openTabs.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[#000000]">
                                <div className="w-16 h-16 rounded-2xl bg-[#0A0A0A] border border-[#1A1A1A] flex items-center justify-center text-3xl mb-4 shadow-xl">
                                    &lt;/&gt;
                                </div>
                                <h2 className="font-serif text-xl font-normal text-white m-0">
                                    Votion Code Workspace
                                </h2>
                                <p className="text-xs text-zinc-500 max-w-sm mt-2 font-mono leading-relaxed">
                                    Ready to develop directly on your server. Pick a file from the explorer on the left or create a new file to begin editing.
                                </p>
                                <div className="flex gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreatingType('file');
                                            setCreatingInPath('/');
                                            setIsExplorerOpen(true);
                                        }}
                                        className="px-3.5 py-1.5 rounded-md bg-[#10B981] text-black font-semibold text-xs cursor-pointer hover:bg-emerald-400 transition-all font-mono"
                                    >
                                        + New File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsTerminalOpen(true)}
                                        className="px-3.5 py-1.5 rounded-md bg-[#0A0A0A] text-white border border-[#1F1F1F] font-semibold text-xs cursor-pointer hover:bg-[#141414] transition-all font-mono"
                                    >
                                        Open Terminal
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div ref={editorContainerRef} className="w-full h-full" />
                        )}
                    </div>

                    {/* Editor Status Bar */}
                    <footer className="h-6 bg-[#050505] border-t border-[#141414] px-3 flex items-center justify-between text-[11px] font-mono text-zinc-500 shrink-0 select-none">
                        <div className="flex items-center gap-4">
                            <span>
                                Ln {cursorPos.line}, Col {cursorPos.col}
                            </span>
                            {saveToast && (
                                <span className="text-emerald-400 font-medium animate-bounce">
                                    ✓ {saveToast}
                                </span>
                            )}
                            {activeTab?.isModified && (
                                <span className="text-amber-400 font-medium">● Unsaved changes</span>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="uppercase">{activeTab?.language || 'plaintext'}</span>
                            <span>UTF-8</span>
                            <span>Spaces: 4</span>
                        </div>
                    </footer>

                    {/* ---------- BOTTOM: INTEGRATED TERMINAL DRAWER ---------- */}
                    {isTerminalOpen && (
                        <div
                            style={{ height: `${terminalHeight}px` }}
                            className="border-t border-[#1F1F1F] bg-[#050505] flex flex-col shrink-0 transition-all duration-150 relative"
                        >
                            {/* Terminal Header */}
                            <div className="h-8 bg-[#080808] border-b border-[#141414] px-3 flex items-center justify-between shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="font-mono text-xs font-semibold text-white">
                                        Terminal / Live Server Console
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                                        (Interactive WebSocket)
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTerminalHeight((prev) => (prev === 260 ? 420 : 260))}
                                        className="text-zinc-400 hover:text-white text-xs px-1"
                                        title="Toggle Height"
                                    >
                                        {terminalHeight === 260 ? '⤢' : '⤡'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsTerminalOpen(false)}
                                        className="text-zinc-400 hover:text-white text-xs px-1"
                                        title="Close Terminal (Ctrl+`)"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Embedded Live Console */}
                            <div className="flex-1 overflow-hidden p-2 bg-[#000000]">
                                <Console />
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default VotionCodeContainer;
