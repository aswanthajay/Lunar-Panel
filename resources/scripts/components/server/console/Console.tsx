import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ITerminalOptions, Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { SearchBarAddon } from 'xterm-addon-search-bar';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { ScrollDownHelperAddon } from '@/plugins/XtermScrollDownHelperAddon';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
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
    background: '#000000',
    cursor: '#FFFFFF',
    cursorAccent: '#000000',
    black: '#000000',
    red: '#EF4444',
    green: '#10B981',
    yellow: '#F59E0B',
    blue: '#3B82F6',
    magenta: '#A855F7',
    cyan: '#06B6D4',
    white: '#E5E7EB',
    brightBlack: '#2B2B2B',
    brightRed: '#F87171',
    brightGreen: '#34D399',
    brightYellow: '#FBBF24',
    brightBlue: '#60A5FA',
    brightMagenta: '#C084FC',
    brightCyan: '#22D3EE',
    brightWhite: '#FFFFFF',
    selection: 'rgba(255, 255, 255, 0.2)',
};

const terminalProps: ITerminalOptions = {
    disableStdin: true,
    cursorStyle: 'underline',
    allowTransparency: true,
    fontSize: 12,
    fontFamily: th('fontFamily.mono'),
    rows: 32,
    theme: terminalTheme,
};

export default () => {
    const TERMINAL_PRELUDE = '\u001b[38;2;107;114;128m[system]\u001b[0m ';

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
        const formatted = (prelude ? TERMINAL_PRELUDE : '') + cleanLine + '\u001b[0m';

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
        const formatted = TERMINAL_PRELUDE + '\u001b[38;2;239;68;68m' + line.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m';
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
        <div className={classNames(styles.terminal, 'relative select-none w-full')}>
            <SpinnerOverlay visible={!connected} size={'large'} />

            {/* Pro Stream Toolbar */}
            <div className="bg-[#050505] border border-[#1F1F1F] border-b-0 rounded-t-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Left: Stream Level Filter Pills */}
                <div className="flex items-center gap-1.5 font-mono">
                    <button
                        type="button"
                        onClick={() => applyFilter('all', textQuery)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                            streamFilter === 'all'
                                ? 'bg-[#1A1A1A] text-[#FFFFFF] border-[#333333] font-medium'
                                : 'bg-transparent text-[#6B7280] border-transparent hover:text-[#FFFFFF]'
                        }`}
                    >
                        All Output
                    </button>
                    <button
                        type="button"
                        onClick={() => applyFilter('errors', textQuery)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                            streamFilter === 'errors'
                                ? 'bg-[#290B0E] text-[#EF4444] border-[#7F1D1D] font-medium'
                                : 'bg-transparent text-[#6B7280] border-transparent hover:text-[#EF4444]'
                        }`}
                    >
                        Errors (stderr)
                    </button>
                    <button
                        type="button"
                        onClick={() => applyFilter('warnings', textQuery)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                            streamFilter === 'warnings'
                                ? 'bg-[#2E1B00] text-[#F59E0B] border-[#78350F] font-medium'
                                : 'bg-transparent text-[#6B7280] border-transparent hover:text-[#F59E0B]'
                        }`}
                    >
                        Warnings
                    </button>
                </div>

                {/* Middle: Live Filter Input */}
                <div className="flex-1 max-w-xs min-w-[160px]">
                    <input
                        type="text"
                        placeholder="Search or regex filter..."
                        value={textQuery}
                        onChange={(e) => applyFilter(streamFilter, e.target.value)}
                        className="w-full bg-[#000000] border border-[#1F1F1F] hover:border-[#333333] rounded px-2.5 py-1 text-xs font-mono text-[#FFFFFF] outline-none focus:border-[#FFFFFF] placeholder-[#737373]"
                    />
                </div>

                {/* Right: Stream Utilities */}
                <div className="flex items-center gap-2 font-mono text-xs">
                    <button
                        type="button"
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`px-2.5 py-1 rounded border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                            autoScroll
                                ? 'bg-[#062419] text-[#10B981] border-[#064E3B]'
                                : 'bg-[#0A0A0A] text-[#6B7280] border-[#1F1F1F] hover:text-[#FFFFFF]'
                        }`}
                        title="Toggle auto-scroll lock"
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${autoScroll ? 'bg-[#10B981]' : 'bg-[#6B7280]'}`} />
                        <span>Auto-scroll</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleClear}
                        className="px-2.5 py-1 rounded bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838] transition-colors cursor-pointer"
                        title="Clear terminal buffer"
                    >
                        Clear
                    </button>

                    <button
                        type="button"
                        onClick={handleDownload}
                        className="px-2.5 py-1 rounded bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838] transition-colors cursor-pointer"
                        title="Download raw log"
                    >
                        Export .log
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="px-2.5 py-1 rounded bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838] transition-colors cursor-pointer"
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? 'Exit' : 'Fullscreen'}
                    </button>
                </div>
            </div>

            {/* Terminal Window */}
            <div
                className={classNames(
                    styles.container,
                    styles.overflows_container,
                    'border border-[#1F1F1F] bg-[#000000] p-3.5',
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
                    <div className="flex items-center bg-[#000000] border border-t border-[#141414] border-x-[#1F1F1F] border-b-[#1F1F1F] rounded-b-lg px-3.5 py-2.5 focus-within:border-[#383838] transition-colors">
                        <span className="font-mono text-xs text-[#10B981] select-none mr-2.5 font-semibold">$</span>
                        <input
                            className="flex-1 bg-transparent text-[#FFFFFF] font-mono text-xs outline-none placeholder-[#737373]"
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
                            className="px-2.5 py-1 rounded bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#222222] hover:border-[#383838] text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1"
                        >
                            Return ↵
                        </button>
                    </div>
                </div>
            )}

            {/* Fullscreen Focus Overlay */}
            {isFullscreen && (
                <div className="fixed inset-0 z-50 bg-[#000000] p-6 flex flex-col space-y-3 font-mono">
                    <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                            <span className="text-sm font-medium text-[#FFFFFF]">Terminal Stream Focus</span>
                            <span className="text-xs text-[#6B7280]">#{serverId}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(false)}
                            className="px-3 py-1 rounded bg-[#161616] hover:bg-[#222222] text-xs text-[#9CA3AF] hover:text-[#FFFFFF] border border-[#2B2B2B] cursor-pointer"
                        >
                            Close Fullscreen
                        </button>
                    </div>
                    <div className="flex-1 bg-[#0A0A0A] border border-[#222222] rounded-lg p-4 overflow-hidden">
                        <div className="h-full w-full" ref={fullscreenRef} />
                    </div>
                </div>
            )}
        </div>
    );
};
