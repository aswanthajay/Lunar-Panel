import React, { useEffect, useRef, useState, useMemo } from 'react';
import loader from '@monaco-editor/loader';

export interface MonacoEditorProps {
    style?: React.CSSProperties;
    initialContent?: string;
    filename?: string;
    mode?: string;
    onModeChanged?: (mode: string) => void;
    fetchContent: (callback: () => Promise<string>) => void;
    onContentSaved: () => void;
}

export const getMonacoLanguage = (filename: string): string => {
    const name = (filename || '').toLowerCase();
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'yaml';
    if (name.endsWith('.js') || name.endsWith('.mjs') || name.endsWith('.cjs')) return 'javascript';
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'typescript';
    if (name.endsWith('.py')) return 'python';
    if (name.endsWith('.sh') || name.endsWith('.bash') || name.endsWith('.zsh')) return 'shell';
    if (name.endsWith('.properties') || name.endsWith('.env') || name.endsWith('.ini') || name.endsWith('.cfg') || name.endsWith('.conf')) return 'ini';
    if (name.endsWith('.xml') || name.endsWith('.svg')) return 'xml';
    if (name.endsWith('.html') || name.endsWith('.htm')) return 'html';
    if (name.endsWith('.css') || name.endsWith('.scss') || name.endsWith('.less')) return 'css';
    if (name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
    if (name.endsWith('.sql')) return 'sql';
    if (name.endsWith('.lua')) return 'lua';
    if (name.endsWith('.go')) return 'go';
    if (name.endsWith('.rs')) return 'rust';
    if (name.endsWith('.java') || name.endsWith('.class')) return 'java';
    if (name.endsWith('.c') || name.endsWith('.h') || name.endsWith('.cpp') || name.endsWith('.hpp')) return 'cpp';
    if (name.endsWith('.dockerfile') || name === 'dockerfile') return 'dockerfile';
    return 'plaintext';
};

export const MONACO_LANGUAGES = [
    { label: 'Plain Text', id: 'plaintext' },
    { label: 'JSON', id: 'json' },
    { label: 'YAML', id: 'yaml' },
    { label: 'JavaScript', id: 'javascript' },
    { label: 'TypeScript', id: 'typescript' },
    { label: 'Python', id: 'python' },
    { label: 'Shell Script', id: 'shell' },
    { label: 'Properties / INI', id: 'ini' },
    { label: 'XML', id: 'xml' },
    { label: 'HTML', id: 'html' },
    { label: 'CSS', id: 'css' },
    { label: 'Markdown', id: 'markdown' },
    { label: 'SQL', id: 'sql' },
    { label: 'Lua', id: 'lua' },
    { label: 'Go', id: 'go' },
    { label: 'Rust', id: 'rust' },
    { label: 'Java', id: 'java' },
    { label: 'C / C++', id: 'cpp' },
    { label: 'Dockerfile', id: 'dockerfile' },
];

export default ({
    style,
    initialContent = '',
    filename = '',
    mode,
    fetchContent,
    onContentSaved,
    onModeChanged,
}: MonacoEditorProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
    const [showMinimap, setShowMinimap] = useState(true);

    const detectedLanguage = useMemo(() => getMonacoLanguage(filename), [filename]);
    const activeLanguage = mode || detectedLanguage;

    useEffect(() => {
        if (onModeChanged && !mode) {
            onModeChanged(detectedLanguage);
        }
    }, [detectedLanguage, onModeChanged, mode]);

    useEffect(() => {
        let isMounted = true;
        let editorInstance: any = null;

        loader.init().then((monaco) => {
            if (!isMounted || !containerRef.current) return;
            monacoRef.current = monaco;

            // Define Votion Luxury Dark Theme
            monaco.editor.defineTheme('votion-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: '656B6B', fontStyle: 'italic' },
                    { token: 'keyword', foreground: '10B981', fontStyle: 'bold' },
                    { token: 'string', foreground: 'F59E0B' },
                    { token: 'number', foreground: '38BDF8' },
                    { token: 'type', foreground: 'A78BFA' },
                    { token: 'delimiter', foreground: 'A0A0A0' },
                    { token: 'identifier', foreground: 'F3F4F6' },
                ],
                colors: {
                    'editor.background': '#000000',
                    'editor.foreground': '#F3F4F6',
                    'editorLineNumber.foreground': '#404040',
                    'editorLineNumber.activeForeground': '#FFFFFF',
                    'editorCursor.foreground': '#FFFFFF',
                    'editor.selectionBackground': '#222222',
                    'editor.inactiveSelectionBackground': '#141414',
                    'editor.lineHighlightBackground': '#0A0A0A',
                    'editorGutter.background': '#000000',
                    'minimap.background': '#000000',
                    'editorWidget.background': '#0A0A0A',
                    'editorWidget.border': '#1F1F1F',
                    'editorSuggestWidget.background': '#0A0A0A',
                    'editorSuggestWidget.border': '#1F1F1F',
                    'editorSuggestWidget.selectedBackground': '#141414',
                    'editorSuggestWidget.highlightForeground': '#10B981',
                    'dropdown.background': '#121212',
                    'dropdown.border': '#262626',
                    'input.background': '#0A0A0A',
                    'input.border': '#262626',
                    'scrollbarSlider.background': '#26262680',
                    'scrollbarSlider.hoverBackground': '#313131',
                    'scrollbarSlider.activeBackground': '#404040',
                },
            });

            // Create Monaco Editor Instance
            editorInstance = monaco.editor.create(containerRef.current, {
                value: initialContent,
                language: activeLanguage,
                theme: 'votion-dark',
                fontSize: 13,
                fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
                fontLigatures: true,
                tabSize: 4,
                insertSpaces: true,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                automaticLayout: true,
                wordWrap: wordWrap,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                minimap: {
                    enabled: showMinimap,
                    side: 'right',
                },
                bracketPairColorization: {
                    enabled: true,
                },
                folding: true,
                foldingStrategy: 'indentation',
                showFoldingControls: 'always',
                matchBrackets: 'always',
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                formatOnPaste: true,
                formatOnType: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: true,
                },
                contextmenu: true,
            });

            editorRef.current = editorInstance;

            // Register Ctrl+S / Cmd+S save command
            editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                onContentSaved();
            });

            // Register fetchContent callback for parent container
            fetchContent(() => Promise.resolve(editorInstance.getValue()));

            setIsReady(true);
        }).catch((err) => {
            console.error('Failed to initialize Monaco Editor:', err);
        });

        return () => {
            isMounted = false;
            if (editorInstance) {
                editorInstance.dispose();
            }
        };
    }, []);

    // Update content when initialContent changes
    useEffect(() => {
        if (editorRef.current && initialContent !== undefined) {
            if (editorRef.current.getValue() !== initialContent) {
                editorRef.current.setValue(initialContent);
            }
        }
    }, [initialContent]);

    // Update language when activeLanguage changes
    useEffect(() => {
        if (editorRef.current && monacoRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
                monacoRef.current.editor.setModelLanguage(model, activeLanguage);
            }
        }
    }, [activeLanguage]);

    const toggleWordWrap = () => {
        const next = wordWrap === 'on' ? 'off' : 'on';
        setWordWrap(next);
        if (editorRef.current) {
            editorRef.current.updateOptions({ wordWrap: next });
        }
    };

    const toggleMinimap = () => {
        const next = !showMinimap;
        setShowMinimap(next);
        if (editorRef.current) {
            editorRef.current.updateOptions({ minimap: { enabled: next } });
        }
    };

    const formatCode = () => {
        if (editorRef.current) {
            const action = editorRef.current.getAction('editor.action.formatDocument');
            if (action) {
                action.run();
            }
        }
    };

    return (
        <div className="w-full flex flex-col bg-[#000000] border border-[#1F1F1F] rounded-md overflow-hidden" style={style}>
            {/* Monaco Header Toolbar */}
            <div className="bg-[#000000] border-b border-[#141414] px-4 py-2 flex items-center justify-between text-xs select-none">
                <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-[#A0A0A0] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                        {activeLanguage.toUpperCase()}
                    </span>
                    <span className="text-[#2B2B2B]">|</span>
                    <span className="text-[#656B6B] font-mono text-[11px] truncate max-w-xs">{filename || 'Untitled'}</span>
                </div>

                {/* Monaco Controls Toolbar */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={formatCode}
                        className="px-2.5 py-1 rounded text-[11px] font-medium text-[#808080] hover:text-[#FFFFFF] bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#2E2E2E] transition-colors cursor-pointer"
                        title="Format Document (Shift+Alt+F)"
                    >
                        Format
                    </button>
                    <button
                        type="button"
                        onClick={toggleWordWrap}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border ${wordWrap === 'on' ? 'bg-[#141414] border-[#2E2E2E] text-[#FFFFFF]' : 'bg-[#0A0A0A] border-[#1F1F1F] text-[#656B6B] hover:text-[#FFFFFF]'}`}
                        title="Toggle Word Wrap"
                    >
                        Wrap: {wordWrap.toUpperCase()}
                    </button>
                    <button
                        type="button"
                        onClick={toggleMinimap}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border ${showMinimap ? 'bg-[#141414] border-[#2E2E2E] text-[#FFFFFF]' : 'bg-[#0A0A0A] border-[#1F1F1F] text-[#656B6B] hover:text-[#FFFFFF]'}`}
                        title="Toggle Minimap"
                    >
                        Minimap: {showMinimap ? 'ON' : 'OFF'}
                    </button>
                    <span className="text-[10px] font-mono text-[#525252] border border-[#1F1F1F] px-1.5 py-0.5 rounded">Ctrl+S to save</span>
                </div>
            </div>

            {/* Editor Canvas */}
            <div className="relative w-full h-[calc(100vh-22rem)] min-h-[440px]">
                {!isReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A] text-xs text-[#656B6B] font-mono z-10">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                            <span>Initializing Monaco Editor engine…</span>
                        </div>
                    </div>
                )}
                <div ref={containerRef} className="w-full h-full" />
            </div>
        </div>
    );
};