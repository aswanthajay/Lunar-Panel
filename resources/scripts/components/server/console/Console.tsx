import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ITerminalOptions, Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { SearchBarAddon } from 'xterm-addon-search-bar';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { ScrollDownHelperAddon } from '@/plugins/XtermScrollDownHelperAddon';
import { ServerContext } from '@/state/server';
import { usePermissions } from '@/plugins/usePermissions';
import { theme as th } from 'twin.macro';
import useEventListener from '@/plugins/useEventListener';
import { debounce } from 'debounce';
import { usePersistedState } from '@/plugins/usePersistedState';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import classNames from 'classnames';

import 'xterm/css/xterm.css';
import styles from './style.module.css';

const terminalTheme = {
    background: '#16181D',
    foreground: '#E2E8F0',
    cursor: '#94A3B8',
    cursorAccent: '#16181D',
    black: '#16181D',
    red: '#F87171',
    green: '#2DD4BF',
    yellow: '#FBBF24',
    blue: '#60A5FA',
    magenta: '#A78BFA',
    cyan: '#22D3EE',
    white: '#E2E8F0',
    brightBlack: '#282D37',
    brightRed: '#EF4444',
    brightGreen: '#14B8A6',
    brightYellow: '#F59E0B',
    brightBlue: '#38BDF8',
    brightMagenta: '#C084FC',
    brightCyan: '#67E8F9',
    brightWhite: '#F8FAFC',
    selection: 'rgba(20, 184, 166, 0.25)',
};

const terminalProps: ITerminalOptions = {
    disableStdin: true,
    cursorStyle: 'underline',
    allowTransparency: true,
    fontSize: 12,
    fontFamily: `'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace`,
    lineHeight: 1.4,
    letterSpacing: 0.5,
    rows: 32,
    theme: terminalTheme,
};

// Formats raw log tags into accessible, muted background pills with crisp high-contrast text
const formatLogLevelTags = (line: string): string => {
    return line
        .replace(/\[(INFO)\]/gi, '\u001b[48;2;20;38;42m\u001b[38;2;94;234;212m INFO \u001b[0m')
        .replace(/\[(WARN|WARNING)\]/gi, '\u001b[48;2;48;36;16m\u001b[38;2;252;211;77m WARN \u001b[0m')
        .replace(/\[(ERROR)\]/gi, '\u001b[48;2;53;22;26m\u001b[38;2;252;165;165m ERROR \u001b[0m')
        .replace(/\[(FATAL|SEVERE)\]/gi, '\u001b[48;2;60;18;22m\u001b[38;2;254;202;202m FATAL \u001b[0m')
        .replace(/\[(DEBUG)\]/gi, '\u001b[48;2;30;34;42m\u001b[38;2;156;163;175m DEBUG \u001b[0m')
        .replace(/(:\s*|\/)(INFO)(\]:|\s*\])/g, '$1\u001b[48;2;20;38;42m\u001b[38;2;94;234;212m INFO \u001b[0m$3')
        .replace(/(:\s*|\/)(WARN|WARNING)(\]:|\s*\])/g, '$1\u001b[48;2;48;36;16m\u001b[38;2;252;211;77m WARN \u001b[0m$3')
        .replace(/(:\s*|\/)(ERROR)(\]:|\s*\])/g, '$1\u001b[48;2;53;22;26m\u001b[38;2;252;165;165m ERROR \u001b[0m$3');
};

export default () => {
    const TERMINAL_PRELUDE = '\u001b[48;2;28;32;40m\u001b[38;2;156;163;175m system \u001b[0m ';

    const ref = useRef<HTMLDivElement>(null);
    const fullscreenRef = useRef<HTMLDivElement>(null);
    const terminal = useMemo(() => new Terminal({ ...terminalProps }), []);
    const fitAddon = useMemo(() => new FitAddon(), []);
    const searchAddon = useMemo(() => new SearchAddon(), []);
    const searchBar = useMemo(() => new SearchBarAddon({ searchAddon }), [searchAddon]);
    const webLinksAddon = useMemo(() => new WebLinksAddon(), []);
    const scrollDownHelperAddon = useMemo(() => new ScrollDownHelperAddon(), []);

    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const [canSendCommands] = usePermissions(['control.console']);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);

    const [history, setHistory] = usePersistedState<string[]>(`${serverId}:command_history`, []);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [commandInputValue, setCommandInputValue] = useState('');

    // Stream & Display Controls
    const [streamFilter, setStreamFilter] = useState<'all' | 'errors' | 'warnings'>('all');
    const [textQuery, setTextQuery] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // In-memory buffer of captured output
    const rawBufferRef = useRef<{ raw: string; formatted: string }[]>([]);

    const zIndex = `
    .xterm-search-bar__addon {
        z-index: 20;
    }`;

    const matchesFilter = (text: string, filter: 'all' | 'errors' | 'warnings', query: string) => {
        if (query.trim()) {
            try {
                const regex = new RegExp(query, 'i');
                if (!regex.test(text)) return false;
            } catch {
                if (!text.toLowerCase().includes(query.toLowerCase())) return false;
            }
        }

        if (filter === 'errors') {
            return /(?:error|exception|fatal|severe|failure|crit)/i.test(text);
        }
        if (filter === 'warnings') {
            return /(?:warn|warning|alert)/i.test(text);
        }
        return true;
    };

    const handleConsoleOutput = (line: string, prelude = false) => {
        const cleanLine = line.replace(/(?:\r\n|\r|\n)$/im, '');
        const taggedLine = formatLogLevelTags(cleanLine);
        const formatted = (prelude ? TERMINAL_PRELUDE : '') + taggedLine + '\u001b[0m';

        rawBufferRef.current.push({ raw: cleanLine, formatted });
        if (rawBufferRef.current.length > 2500) {
            rawBufferRef.current.shift();
        }

        if (matchesFilter(cleanLine, streamFilter, textQuery)) {
            terminal.writeln(formatted);
            if (autoScroll) {
                terminal.scrollToBottom();
            }
        }
    };

    const handleDaemonErrorOutput = (line: string) => {
        const cleanLine = line.replace(/(?:\r\n|\r|\n)$/im, '');
        const formatted = TERMINAL_PRELUDE + '\u001b[48;2;53;22;26m\u001b[38;2;252;165;165m ERROR \u001b[0m \u001b[38;2;248;113;113m' + cleanLine + '\u001b[0m';
        rawBufferRef.current.push({ raw: line, formatted });
        terminal.writeln(formatted);
        if (autoScroll) terminal.scrollToBottom();
    };

    const handlePowerChangeEvent = (state: string) => {
        handleConsoleOutput(`Instance transitioned to ${state}.`, true);
    };

    // Replay buffer on filter or search change
    const applyFilter = (newFilter: 'all' | 'errors' | 'warnings', newQuery: string) => {
        setStreamFilter(newFilter);
        setTextQuery(newQuery);
        terminal.clear();
        const matches = rawBufferRef.current.filter((item) => matchesFilter(item.raw, newFilter, newQuery));
        matches.forEach((item) => terminal.writeln(item.formatted));
        if (autoScroll) terminal.scrollToBottom();
    };

    const handleClear = () => {
        terminal.clear();
    };

    const handleDownload = () => {
        const content = rawBufferRef.current.map((item) => item.raw).join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `console-${serverId}-${Date.now()}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            const newIndex = Math.min(historyIndex + 1, history!.length - 1);
            setHistoryIndex(newIndex);
            setCommandInputValue(history![newIndex] || '');
            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            const newIndex = Math.max(historyIndex - 1, -1);
            setHistoryIndex(newIndex);
            setCommandInputValue(history![newIndex] || '');
        }

        if (e.key === 'Enter' && commandInputValue.trim().length > 0) {
            const cmd = commandInputValue.trim();
            setHistory((prevHistory) => [cmd, ...prevHistory!].slice(0, 32));
            setHistoryIndex(-1);

            instance && instance.send('send command', cmd);
            setCommandInputValue('');
        }
    };

    useEffect(() => {
        const targetRef = isFullscreen ? fullscreenRef.current : ref.current;
        if (connected && targetRef && !terminal.element) {
            terminal.loadAddon(fitAddon);
            terminal.loadAddon(searchAddon);
            terminal.loadAddon(searchBar);
            terminal.loadAddon(webLinksAddon);
            terminal.loadAddon(scrollDownHelperAddon);

            terminal.open(targetRef);
            fitAddon.fit();
            searchBar.addNewStyle(zIndex);

            terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                    document.execCommand('copy');
                    return false;
                } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                    e.preventDefault();
                    searchBar.show();
                    return false;
                } else if (e.key === 'Escape') {
                    searchBar.hidden();
                }
                return true;
            });
        }
    }, [terminal, connected, isFullscreen]);

    useEventListener(
        'resize',
        debounce(() => {
            if (terminal.element) {
                fitAddon.fit();
            }
        }, 100)
    );

    useEffect(() => {
        setTimeout(() => {
            if (terminal.element) fitAddon.fit();
        }, 50);
    }, [isFullscreen]);

    useEffect(() => {
        const listeners: Record<string, (s: string) => void> = {
            [SocketEvent.STATUS]: handlePowerChangeEvent,
            [SocketEvent.CONSOLE_OUTPUT]: handleConsoleOutput,
            [SocketEvent.INSTALL_OUTPUT]: handleConsoleOutput,
            [SocketEvent.TRANSFER_LOGS]: handleConsoleOutput,
            [SocketEvent.TRANSFER_STATUS]: () => handleConsoleOutput('Transfer status update', true),
            [SocketEvent.DAEMON_MESSAGE]: (line) => handleConsoleOutput(line, true),
            [SocketEvent.DAEMON_ERROR]: handleDaemonErrorOutput,
        };

        if (connected && instance) {
            if (!isTransferring) {
                terminal.clear();
                rawBufferRef.current = [];
            }

            Object.keys(listeners).forEach((key: string) => {
                instance.addListener(key, listeners[key]);
            });
            instance.send(SocketRequest.SEND_LOGS);
        }

        return () => {
            if (instance) {
                Object.keys(listeners).forEach((key: string) => {
                    instance.removeListener(key, listeners[key]);
                });
            }
        };
    }, [connected, instance, streamFilter, textQuery, autoScroll]);

    return (
        <div className={classNames(styles.terminal, 'relative select-none w-full font-sans')}>
            {/* Console Toolbar */}
            <div className="bg-[#16181D] border border-[#262A33] border-b-0 rounded-t-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-sans">
                {/* Left: Stream Level Filter Tabs */}
                <div className="flex items-center gap-1 bg-[#1C1F26] p-1 rounded-md border border-[#262A33]">
                    <button
                        type="button"
                        onClick={() => applyFilter('all', textQuery)}
                        className={`h-7 px-3 rounded text-xs font-sans font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                            streamFilter === 'all'
                                ? 'bg-[#282E3A] text-[#F3F4F6] shadow-xs'
                                : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#282E3A]/40'
                        }`}
                    >
                        <span>Console</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => applyFilter('errors', textQuery)}
                        className={`h-7 px-3 rounded text-xs font-sans font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                            streamFilter === 'errors'
                                ? 'bg-[#352026] text-[#F87171] shadow-xs'
                                : 'text-[#9CA3AF] hover:text-[#F87171] hover:bg-[#352026]/40'
                        }`}
                    >
                        <span>Errors (stderr)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => applyFilter('warnings', textQuery)}
                        className={`h-7 px-3 rounded text-xs font-sans font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                            streamFilter === 'warnings'
                                ? 'bg-[#332A1C] text-[#FBBF24] shadow-xs'
                                : 'text-[#9CA3AF] hover:text-[#FBBF24] hover:bg-[#332A1C]/40'
                        }`}
                    >
                        <span>Warnings</span>
                    </button>
                </div>

                {/* Middle: Live Filter Search Input */}
                <div className="relative flex-1 max-w-xs min-w-[170px]">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#6B7280]">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={textQuery}
                        onChange={(e) => applyFilter(streamFilter, e.target.value)}
                        className="w-full h-8 bg-[#0F1115] border border-[#262A33] hover:border-[#383E4D] focus:border-[#14B8A6] rounded-md pl-8 pr-7 text-xs font-sans text-[#F3F4F6] outline-none placeholder-[#6B7280] transition-colors"
                    />
                    {textQuery && (
                        <button
                            type="button"
                            onClick={() => applyFilter(streamFilter, '')}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#6B7280] hover:text-[#D1D5DB] cursor-pointer"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Right: Unified Action Buttons */}
                <div className="flex items-center gap-2 font-sans">
                    <button
                        type="button"
                        onClick={() => setAutoScroll(!autoScroll)}
                        className="h-8 px-3 py-1.5 rounded-md bg-[#1C1F26] hover:bg-[#252A34] text-[#D1D5DB] hover:text-[#FFFFFF] border border-[#2B303C] hover:border-[#3A4150] text-xs font-sans font-medium transition-colors cursor-pointer flex items-center gap-2"
                        title="Toggle auto-scroll lock"
                    >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${autoScroll ? 'bg-[#14B8A6]' : 'bg-[#4B5563]'}`} />
                        <span>Auto-scroll</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleClear}
                        className="h-8 px-3 py-1.5 rounded-md bg-[#1C1F26] hover:bg-[#252A34] text-[#D1D5DB] hover:text-[#FFFFFF] border border-[#2B303C] hover:border-[#3A4150] text-xs font-sans font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Clear terminal buffer"
                    >
                        <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Clear</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDownload}
                        className="h-8 px-3 py-1.5 rounded-md bg-[#1C1F26] hover:bg-[#252A34] text-[#D1D5DB] hover:text-[#FFFFFF] border border-[#2B303C] hover:border-[#3A4150] text-xs font-sans font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Export raw log file"
                    >
                        <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Export .log</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="h-8 px-3 py-1.5 rounded-md bg-[#1C1F26] hover:bg-[#252A34] text-[#D1D5DB] hover:text-[#FFFFFF] border border-[#2B303C] hover:border-[#3A4150] text-xs font-sans font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Toggle fullscreen"
                    >
                        <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isFullscreen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 9L4 4m0 0h4m-4 0v4m6 6l5 5m0 0h-4m4 0v-4" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            )}
                        </svg>
                        <span>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
                    </button>
                </div>
            </div>

            {/* Terminal Window */}
            <div
                className={classNames(
                    styles.container,
                    styles.overflows_container,
                    'border border-[#262A33] bg-[#16181D] p-3.5',
                    { 'rounded-b-lg': !canSendCommands }
                )}
            >
                <div className={'h-full'}>
                    <div id={styles.terminal} ref={ref} />
                </div>
            </div>

            {/* Command Bar */}
            {canSendCommands && (
                <div className={classNames('relative', styles.overflows_container)}>
                    <div className="flex items-center bg-[#16181D] border border-t-0 border-[#262A33] rounded-b-lg px-3.5 py-2.5 focus-within:border-[#383E4D] transition-colors">
                        <span className="font-mono text-xs text-[#14B8A6] select-none mr-2.5 font-semibold">$</span>
                        <input
                            className="flex-1 bg-transparent text-[#F3F4F6] font-mono text-xs outline-none placeholder:font-sans placeholder:text-[#6B7280]"
                            type={'text'}
                            value={commandInputValue}
                            onChange={(e) => setCommandInputValue(e.target.value)}
                            placeholder={'Type command or process input...'}
                            aria-label={'Console command input.'}
                            disabled={!instance || !connected}
                            onKeyDown={handleCommandKeyDown}
                            autoCorrect={'off'}
                            autoCapitalize={'none'}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                if (commandInputValue.trim().length > 0 && instance) {
                                    instance.send('send command', commandInputValue.trim());
                                    setHistory((prev) => [commandInputValue.trim(), ...prev!].slice(0, 32));
                                    setCommandInputValue('');
                                }
                            }}
                            className="h-8 px-3 py-1.5 rounded-md bg-[#1C1F26] hover:bg-[#252A34] text-[#D1D5DB] hover:text-[#FFFFFF] border border-[#2B303C] hover:border-[#3A4150] text-xs font-sans font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                            <span>Send</span>
                            <span className="text-[10px] text-[#6B7280]">↵</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Fullscreen Focus Overlay */}
            {isFullscreen && (
                <div className="fixed inset-0 z-50 bg-[#0F1115] p-6 flex flex-col space-y-3 font-sans">
                    <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
                        <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
                            <span className="text-sm font-medium text-[#F3F4F6]">Terminal Focus</span>
                            <span className="text-xs text-[#6B7280] font-mono">#{serverId}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(false)}
                            className="h-8 px-3 py-1.5 rounded-md bg-[#1C1F26] hover:bg-[#252A34] text-xs font-sans font-medium text-[#D1D5DB] hover:text-[#FFFFFF] border border-[#2B303C] cursor-pointer"
                        >
                            Exit fullscreen
                        </button>
                    </div>
                    <div className="flex-1 bg-[#16181D] border border-[#262A33] rounded-lg p-4 overflow-hidden">
                        <div className="h-full w-full" ref={fullscreenRef} />
                    </div>
                </div>
            )}
        </div>
    );
};
