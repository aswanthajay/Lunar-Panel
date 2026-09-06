import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';

interface PawnFile {
    name: string;
    path: string;
    type: 'gamemode' | 'filterscript' | 'root';
    size: number;
    modified: string | null;
    has_amx: boolean;
    amx_path: string;
    amx_size: number;
}

interface CompileResult {
    success: boolean;
    logs: string;
    amx_path: string;
    amx_size: number;
    errors_count: number;
    warnings_count: number;
    timestamp: string;
}

export default () => {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.id;
    const isSamp = Boolean(server?.isSamp);

    const [loadingFiles, setLoadingFiles] = useState(true);
    const [files, setFiles] = useState<PawnFile[]>([]);
    const [selectedPath, setSelectedPath] = useState<string>('');
    const [fileContent, setFileContent] = useState<string>('');
    const [originalContent, setOriginalContent] = useState<string>('');
    const [loadingContent, setLoadingContent] = useState(false);
    const [saving, setSaving] = useState(false);
    const [compiling, setCompiling] = useState(false);
    const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
    const [toast, setToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

    const editorRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    const isDirty = fileContent !== originalContent;

    // Fetch discovered .pwn files
    const loadFiles = useCallback(async () => {
        if (!uuid || !isSamp) return;
        setLoadingFiles(true);
        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/samp/compiler/files`);
            const list: PawnFile[] = data.files || [];
            setFiles(list);

            // Auto-select first gamemode or file if nothing selected
            if (list.length > 0 && (!selectedPath || !list.some((f) => f.path === selectedPath))) {
                const preferred = list.find((f) => f.type === 'gamemode') || list[0];
                setSelectedPath(preferred.path);
            }
        } catch (err: any) {
            setToast({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to scan server for .pwn files.',
            });
        } finally {
            setLoadingFiles(false);
        }
    }, [uuid, isSamp, selectedPath]);

    useEffect(() => {
        loadFiles();
    }, [uuid, isSamp]);

    // Fetch selected file content
    const loadFileContent = useCallback(async (path: string) => {
        if (!uuid || !path) return;
        setLoadingContent(true);
        try {
            const { data } = await http.get(`/api/client/servers/${uuid}/samp/compiler/file`, {
                params: { path },
            });
            setFileContent(data.content || '');
            setOriginalContent(data.content || '');
            setCompileResult(null);
        } catch (err: any) {
            setToast({
                type: 'error',
                text: err?.response?.data?.error || `Failed to read ${path}`,
            });
        } finally {
            setLoadingContent(false);
        }
    }, [uuid]);

    useEffect(() => {
        if (selectedPath) {
            loadFileContent(selectedPath);
        }
    }, [selectedPath, loadFileContent]);

    // Save current file
    const handleSave = async () => {
        if (!uuid || !selectedPath || saving) return;
        setSaving(true);
        setToast(null);
        try {
            await http.post(`/api/client/servers/${uuid}/samp/compiler/file`, {
                path: selectedPath,
                content: fileContent,
            });
            setOriginalContent(fileContent);
            setToast({ type: 'ok', text: `Saved ${selectedPath} successfully.` });
        } catch (err: any) {
            setToast({
                type: 'error',
                text: err?.response?.data?.error || 'Failed to save changes.',
            });
        } finally {
            setSaving(false);
        }
    };

    // Compile current file
    const handleCompile = async () => {
        if (!uuid || !selectedPath || compiling) return;
        setCompiling(true);
        setToast(null);
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/samp/compiler/compile`, {
                target: selectedPath,
                content: fileContent, // automatically includes unsaved edits
            });

            setCompileResult(data);
            setOriginalContent(fileContent); // successful compile automatically syncs state

            if (data.success) {
                setToast({
                    type: 'ok',
                    text: `Compiled ${data.amx_path} successfully (${(data.amx_size / 1024).toFixed(1)} KB).`,
                });
                // Refresh files list so has_amx updates
                loadFiles();
            } else {
                setToast({
                    type: 'error',
                    text: `Compilation failed with ${data.errors_count} error(s). Review console output below.`,
                });
            }
        } catch (err: any) {
            const errData = err?.response?.data;
            if (errData?.logs) {
                setCompileResult(errData);
            }
            setToast({
                type: 'error',
                text: errData?.logs || err?.message || 'Compilation process failed.',
            });
        } finally {
            setCompiling(false);
        }
    };

    // Tab key indent handler & keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'Enter')) {
            e.preventDefault();
            handleCompile();
        } else if (e.key === 'F5') {
            e.preventDefault();
            handleCompile();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            const val = textarea.value;
            textarea.value = val.substring(0, start) + '    ' + val.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 4;
            setFileContent(textarea.value);
        }
    };

    // Jump to line in editor when user clicks an error log
    const jumpToLine = (lineNumber: number) => {
        if (!editorRef.current) return;
        const lines = fileContent.split('\n');
        let pos = 0;
        for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
            pos += lines[i].length + 1;
        }

        editorRef.current.focus();
        editorRef.current.setSelectionRange(pos, pos + (lines[lineNumber - 1]?.length || 0));

        // Scroll textarea
        const lineHeight = 18; // approx line height
        editorRef.current.scrollTop = Math.max(0, (lineNumber - 5) * lineHeight);
    };

    // Sync line numbers scrolling with editor
    const handleScroll = () => {
        if (editorRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = editorRef.current.scrollTop;
        }
    };

    // Line counts
    const lineCount = Math.max(1, fileContent.split('\n').length);

    if (!isSamp) {
        return (
            <ServerContentBlock title={'Pawn Compiler'}>
                <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-8 text-center max-w-xl mx-auto my-12">
                    <div className="w-12 h-12 rounded-full bg-[#111111] border border-[#242424] flex items-center justify-center mx-auto mb-4 text-[#EDEDED]">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-sans font-semibold text-white mb-2">SA-MP Only Feature</h3>
                    <p className="text-sm text-[#A0A0A0] leading-relaxed font-sans">
                        The Pawn Compiler is configured exclusively for SA-MP and open.mp servers.
                        To enable this feature for this server, configure the Game Server Type as SA-MP in the admin panel.
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    const currentFileObj = files.find((f) => f.path === selectedPath);

    return (
        <ServerContentBlock title={'Pawn Compiler'}>
            <div className="w-full max-w-7xl mx-auto space-y-4" style={{ fontFamily: 'var(--font-sans)' }}>

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F1F1F] pb-4">
                    <div>
                        <h1 className="text-2xl font-bold font-sans text-white tracking-tight flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#111111] border border-[#242424] text-[#EDEDED] flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                            </div>
                            Pawn Compiler
                            <span className="text-[10px] uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-full bg-[#111111] text-[#A0A0A0] border border-[#242424]">
                                SA-MP / open.mp
                            </span>
                        </h1>
                        <p className="text-xs text-[#737373] mt-1 font-sans">
                            Compile Pawn source (.pwn) gamemodes and filterscripts directly to server binaries (.amx) using Zeex Pawn 3.10.10.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={loadFiles}
                            disabled={loadingFiles}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[#242424] bg-[#111111] hover:bg-[#1A1A1A] text-[#EDEDED] transition-colors flex items-center gap-2 cursor-pointer"
                        >
                            <svg className={`w-3.5 h-3.5 text-[#737373] ${loadingFiles ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Toast Notification */}
                {toast && (
                    <div
                        className={`p-3.5 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                            toast.type === 'ok'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${toast.type === 'ok' ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
                            <span>{toast.text}</span>
                        </div>
                        <button onClick={() => setToast(null)} className="text-[#737373] hover:text-white transition-colors">
                            ✕
                        </button>
                    </div>
                )}

                {/* ── Action Toolbar ── */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl">
                    {/* Left: Target File Dropdown */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
                        <span className="text-[11px] uppercase tracking-wider text-[#737373] font-semibold whitespace-nowrap">
                            Target Source:
                        </span>
                        {loadingFiles ? (
                            <div className="text-xs text-[#737373] flex items-center gap-2">
                                <Spinner size="small" /> Scanning server scripts…
                            </div>
                        ) : files.length === 0 ? (
                            <span className="text-xs text-[#A0A0A0]">No .pwn files found in server root, gamemodes/ or filterscripts/.</span>
                        ) : (
                            <select
                                value={selectedPath}
                                onChange={(e) => setSelectedPath(e.target.value)}
                                className="flex-1 max-w-md bg-[#050505] border border-[#1F1F1F] hover:border-[#333333] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#404040] font-mono cursor-pointer"
                            >
                                {files.map((f) => (
                                    <option key={f.path} value={f.path}>
                                        {f.path} {f.has_amx ? '✓ (.amx ready)' : '(no .amx)'}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2.5">
                        {isDirty && (
                            <span className="text-[10px] font-mono text-[#EDEDED] bg-[#141414] border border-[#262626] px-2 py-0.5 rounded">
                                • Unsaved edits
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !selectedPath || loadingContent}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[#242424] bg-[#111111] hover:bg-[#1A1A1A] text-[#EDEDED] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Save source code (Ctrl+S)"
                        >
                            {saving && <Spinner size="small" />}
                            <span>Save Source</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCompile}
                            disabled={compiling || !selectedPath || loadingContent}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#E5E5E5] text-black transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                            title="Compile AMX binary (F5 or Ctrl+B)"
                        >
                            {compiling ? (
                                <>
                                    <Spinner size="small" />
                                    <span>Compiling…</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span>Compile to .AMX</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Editor Container ── */}
                <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] overflow-hidden flex flex-col">
                    {/* Editor File Bar */}
                    <div className="px-4 py-2 bg-[#050505] border-b border-[#141414] flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                            <span className="text-[#6B7280]">File:</span>
                            <span className="text-white font-medium">{selectedPath || 'None selected'}</span>
                            {currentFileObj && (
                                <span className="text-[#525252] text-[11px]">
                                    ({(currentFileObj.size / 1024).toFixed(1)} KB)
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#6B7280]">
                            <span>Lines: {lineCount}</span>
                            <span>Output: {selectedPath.replace(/\.pwn$/i, '.amx')}</span>
                        </div>
                    </div>

                    {/* Editor Main */}
                    <div className="relative flex h-[460px] bg-[#000000] overflow-hidden">
                        {loadingContent && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-10">
                                <div className="flex flex-col items-center gap-2 text-xs text-[#A0A0A0]">
                                    <Spinner size="large" />
                                    <span>Loading Pawn source…</span>
                                </div>
                            </div>
                        )}

                        {/* Line Numbers Gutter */}
                        <div
                            ref={lineNumbersRef}
                            className="w-12 bg-[#050505] border-r border-[#141414] select-none py-3 pr-2.5 text-right font-mono text-[11px] text-[#404040] overflow-hidden leading-[18px]"
                        >
                            {Array.from({ length: lineCount }).map((_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>

                        {/* Code Textarea */}
                        <textarea
                            ref={editorRef}
                            value={fileContent}
                            onChange={(e) => setFileContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onScroll={handleScroll}
                            placeholder="// Select or write Pawn code here..."
                            spellCheck={false}
                            className="flex-1 h-full bg-[#000000] text-[#E5E7EB] font-mono text-[12px] leading-[18px] p-3 outline-none resize-none border-0 overflow-y-auto placeholder-[#404040]"
                            style={{ tabSize: 4 }}
                        />
                    </div>
                </div>

                {/* ── Compiler Console Pane ── */}
                <div className="border border-[#1F1F1F] rounded-lg bg-[#000000] overflow-hidden">
                    <div className="px-4 py-2.5 bg-[#050505] border-b border-[#141414] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    compiling
                                        ? 'bg-amber-400 animate-pulse'
                                        : compileResult?.success
                                        ? 'bg-[#10B981]'
                                        : compileResult?.errors_count
                                        ? 'bg-[#EF4444]'
                                        : 'bg-[#404040]'
                                }`}
                            />
                            <span className="text-[10px] uppercase tracking-wider text-[#737373] font-semibold">
                                Compiler Console Output
                            </span>
                            {compileResult && (
                                <span className="text-xs font-mono text-[#A0A0A0] ml-2">
                                    {compileResult.errors_count > 0 ? (
                                        <span className="text-rose-400">{compileResult.errors_count} error(s)</span>
                                    ) : (
                                        <span className="text-emerald-400">0 errors</span>
                                    )}
                                    {compileResult.warnings_count > 0 && (
                                        <span className="text-amber-400 ml-2">({compileResult.warnings_count} warnings)</span>
                                    )}
                                </span>
                            )}
                        </div>

                        {compileResult && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCompileResult(null)}
                                    className="text-[11px] font-mono text-[#737373] hover:text-white transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="p-4 font-mono text-xs max-h-56 overflow-y-auto select-text leading-relaxed bg-[#000000]">
                        {compiling ? (
                            <div className="flex items-center gap-2 text-amber-400">
                                <Spinner size="small" /> Running Zeex Pawn Compiler 3.10.10…
                            </div>
                        ) : !compileResult ? (
                            <p className="text-[#525252] m-0">
                                Ready to compile. Click "Compile to .AMX" above or press F5 to build your gamemode.
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {compileResult.logs.split('\n').map((line, idx) => {
                                    const isError = /error\s+\d+:/i.test(line);
                                    const isWarning = /warning\s+\d+:/i.test(line);
                                    const isSuccess = /Header size:|Total requirements:|Compilation finished/i.test(line);

                                    // Extract line number if present: file.pwn(123)
                                    const lineMatch = line.match(/\((\d+)\)\s*:/);
                                    const targetLine = lineMatch ? parseInt(lineMatch[1], 10) : null;

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => targetLine && jumpToLine(targetLine)}
                                            className={`transition-colors ${
                                                isError
                                                    ? 'text-rose-400 hover:bg-rose-950/20 cursor-pointer underline decoration-dotted'
                                                    : isWarning
                                                    ? 'text-amber-300 hover:bg-amber-950/20 cursor-pointer underline decoration-dotted'
                                                    : isSuccess
                                                    ? 'text-emerald-400'
                                                    : 'text-[#A0A0A0]'
                                            }`}
                                            title={targetLine ? `Click to jump to line ${targetLine}` : undefined}
                                        >
                                            {line}
                                        </div>
                                    );
                                })}

                                {compileResult.success && (
                                    <div className="pt-2 mt-2 border-t border-[#141414] text-emerald-400 font-medium">
                                        ✓ Binary successfully deployed to {compileResult.amx_path} ({(compileResult.amx_size / 1024).toFixed(1)} KB)
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </ServerContentBlock>
    );
};
