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
import { trackRecentDownload } from '@/helpers';

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

type BootPhase =
    | 'Initialization & Provisioning'
    | 'Runtime Boot'
    | 'Resource & Dependency Scanning'
    | 'Services Ready & Listening'
    | 'Server Termination';

const detectPhase = (text: string): BootPhase | null => {
    // 1. Termination
    if (/\b(?:stopping server|server shutting down|saving (?:players|worlds|chunks)|terminating process|stopping container|container stopped|server marked as offline)\b/i.test(text)) {
        return 'Server Termination';
    }
    // 2. Ready / Listening
    if (/\b(?:done \([0-9.]+s\)! for help|server started|listening on (?:port|\*|0\.0\.0\.0|127\.0\.0\.1)|ready for connections|started in [0-9.]+s|server is now running)\b/i.test(text)) {
        return 'Services Ready & Listening';
    }
    // 3. Resource & Dependency Scanning
    if (/\b(?:loading (?:libraries|plugins|mods|datapacks|recipes|world|dimension)|mounting resources|starting resource|scanning dependencies|resolving dependencies|yarn install|npm install|pip install)\b/i.test(text)) {
        return 'Resource & Dependency Scanning';
    }
    // 4. Runtime Boot
    if (/\b(?:booting|starting (?:minecraft|server|runtime|process)|openjdk|java version|node v\d|python 3\.\d|fxserver|environment setup|executing start command)\b/i.test(text)) {
        return 'Runtime Boot';
    }
    // 5. Container / Initialization
    if (/\b(?:container (?:init|starting|provision)|pulling image|allocating container|pterodactyl system|connecting to daemon)\b/i.test(text)) {
        return 'Initialization & Provisioning';
    }
    return null;
};

export default () => {
    const TERMINAL_PRELUDE = '\u001b[38;2;113;113;122m[system]\u001b[0m ';

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
    const inHtmlBlockRef = useRef(false);
    const currentPhaseRef = useRef<BootPhase | null>(null);

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
        if (typeof line !== 'string') return;
        const cleanLine = line.replace(/(?:\r\n|\r|\n)$/im, '');

        // 1. Detect and suppress raw HTML error bodies (e.g. 502 Bad Gateway)
        const isHtmlStart = /<!doctype\s+html|<html[\s>]/i.test(cleanLine);
        if (isHtmlStart || inHtmlBlockRef.current) {
            if (isHtmlStart) {
                const titleMatch = cleanLine.match(/<title>([^<]+)<\/title>/i);
                const statusMatch = cleanLine.match(/\b(50[0-9]|40[0-9])\b/);
                const errorName = titleMatch ? titleMatch[1].trim() : (statusMatch ? `${statusMatch[1]} Gateway Error` : '502 Bad Gateway');
                const summary = `${prelude ? TERMINAL_PRELUDE : ''}\u001b[38;2;248;113;113m[Gateway Error: ${errorName}] Upstream daemon connection error — raw HTML suppressed\u001b[0m`;

                rawBufferRef.current.push({ raw: `[Gateway Error: ${errorName}] Upstream daemon error`, formatted: summary });
                if (matchesFilter(summary, streamFilter, textQuery)) {
                    terminal.writeln(summary);
                    if (autoScroll) terminal.scrollToBottom();
                }
            }
            if (/<\/html>/i.test(cleanLine)) {
                inHtmlBlockRef.current = false;
            } else if (isHtmlStart) {
                inHtmlBlockRef.current = true;
            }
            return;
        }

        // 2. Strip raw ANSI color/formatting escape codes to eliminate odd background artifacts
        const strippedLine = cleanLine.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
        if (!strippedLine.trim()) {
            terminal.writeln('');
            return;
        }

        // 3. Phase detection & subtle divider insertion
        const phase = detectPhase(strippedLine);
        if (phase && phase !== currentPhaseRef.current) {
            currentPhaseRef.current = phase;
            const dividerText = `─── [Phase: ${phase}] ───────────────────────────────────────────────`;
            const dividerFormatted = `\r\n\u001b[38;2;82;82;91m─── \u001b[1m\u001b[38;2;212;212;216m[Phase: ${phase}]\u001b[0m \u001b[38;2;82;82;91m───────────────────────────────────────────────\u001b[0m`;
            rawBufferRef.current.push({ raw: dividerText, formatted: dividerFormatted });
            if (matchesFilter(dividerText, streamFilter, textQuery)) {
                terminal.writeln(dividerFormatted);
            }
        }

        // 4. Normalize engine colors into unified palette:
        // Error = Rose Red (#F87171), Warning = Amber (#F59E0B), Success = Emerald (#34D399), Info = Muted White/Zinc (#E5E7EB)
        const isError = /\b(?:error|exception|fatal|severe|failure|critical|crash|panic)\b|^\s*at\s+[\w\W]+:\d+:\d+|caused by:\s+|\[(?:error|severe|fatal)\]/i.test(strippedLine);
        const isWarn = !isError && /\b(?:warn|warning|alert|deprecated)\b|\[(?:warn|warning)\]/i.test(strippedLine);
        const isSuccess = !isError && !isWarn && /\b(?:ready|done \([0-9.]+s\)!|server started|listening on (?:port|\*|\d)|started in [0-9.]+s|successfully started)\b/i.test(strippedLine);

        let colorCode = '\u001b[38;2;229;231;235m'; // Standard Info
        if (isError) {
            colorCode = '\u001b[38;2;248;113;113m'; // Error Red
        } else if (isWarn) {
            colorCode = '\u001b[38;2;245;158;11m'; // Warning Amber
        } else if (isSuccess) {
            colorCode = '\u001b[38;2;52;211;153m'; // Success Emerald
        }

        const formatted = (prelude ? TERMINAL_PRELUDE : '') + colorCode + strippedLine + '\u001b[0m';

        rawBufferRef.current.push({ raw: strippedLine, formatted });
        if (rawBufferRef.current.length > 2500) {
            rawBufferRef.current.shift();
        }

        if (matchesFilter(strippedLine, streamFilter, textQuery)) {
            terminal.writeln(formatted);
            if (autoScroll) {
                terminal.scrollToBottom();
            }
        }
    };

    const handleDaemonErrorOutput = (line: string) => {
        if (typeof line !== 'string') return;
        const cleanLine = line.replace(/(?:\r\n|\r|\n)$/im, '');
        const strippedLine = cleanLine.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
        const formatted = TERMINAL_PRELUDE +
            '\u001b[38;2;248;113;113m[Daemon Error] ' +
            strippedLine +
            '\u001b[0m';
        rawBufferRef.current.push({ raw: strippedLine, formatted });
        terminal.writeln(formatted);
        if (autoScroll) terminal.scrollToBottom();
    };

    const handlePowerChangeEvent = (state: string) => {
        if (state === 'starting') {
            currentPhaseRef.current = null;
        }
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
        currentPhaseRef.current = null;
    };

    const handleDownload = () => {
        const content = rawBufferRef.current.map((item) => item.raw).join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const fileName = `console-${serverId}-${Date.now()}.log`;
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        trackRecentDownload(fileName, undefined, 'log');
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
            {/* Pro Stream Toolbar */}
            <div className="bg-[#050505] border border-[#1F1F1F] border-b-0 rounded-t-lg px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                {/* Left: Stream Level Filter Pills */}
                <div className="flex items-center gap-1 font-mono">
                    <button
                        type="button"
                        onClick={() => applyFilter('all', textQuery)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                            streamFilter === 'all'
                                ? 'bg-[#18181B] text-[#FFFFFF] border-[#27272A] font-medium'
                                : 'bg-transparent text-[#71717A] border-transparent hover:text-[#FFFFFF] hover:bg-[#18181B]/50'
                        }`}
                    >
                        All Output
                    </button>
                    <button
                        type="button"
                        onClick={() => applyFilter('errors', textQuery)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                            streamFilter === 'errors'
                                ? 'bg-[#18181B] text-[#F87171] border-[#27272A] font-medium'
                                : 'bg-transparent text-[#71717A] border-transparent hover:text-[#F87171] hover:bg-[#18181B]/50'
                        }`}
                    >
                        Errors
                    </button>
                    <button
                        type="button"
                        onClick={() => applyFilter('warnings', textQuery)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                            streamFilter === 'warnings'
                                ? 'bg-[#18181B] text-[#F59E0B] border-[#27272A] font-medium'
                                : 'bg-transparent text-[#71717A] border-transparent hover:text-[#F59E0B] hover:bg-[#18181B]/50'
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
                        className="w-full bg-[#000000] border border-[#27272A] hover:border-[#3F3F46] focus:border-[#52525B] rounded px-2.5 py-1 text-xs font-mono text-[#FFFFFF] outline-none placeholder-[#71717A] transition-colors"
                    />
                </div>

                {/* Right: Stream Utilities */}
                <div className="flex items-center gap-1.5 font-mono text-xs">
                    <button
                        type="button"
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`px-2.5 py-1 rounded border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                            autoScroll
                                ? 'bg-[#18181B] text-[#FAFAFA] border-[#27272A]'
                                : 'bg-transparent text-[#71717A] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#18181B]/50'
                        }`}
                        title="Toggle auto-scroll lock"
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${autoScroll ? 'bg-[#10B981]' : 'bg-[#52525B]'}`} />
                        <span>Auto-scroll</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleClear}
                        className="px-2.5 py-1 rounded bg-transparent hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] border border-[#27272A] transition-colors cursor-pointer"
                        title="Clear terminal buffer"
                    >
                        Clear
                    </button>

                    <button
                        type="button"
                        onClick={handleDownload}
                        className="px-2.5 py-1 rounded bg-transparent hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] border border-[#27272A] transition-colors cursor-pointer"
                        title="Download raw log"
                    >
                        Export .log
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="px-2.5 py-1 rounded bg-transparent hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] border border-[#27272A] transition-colors cursor-pointer"
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
                    <div className="flex items-center bg-[#000000] border border-t border-[#141414] border-x-[#1F1F1F] border-b-[#1F1F1F] rounded-b-lg px-3.5 py-2 focus-within:border-[#383838] transition-colors">
                        <span className="font-mono text-xs text-[#10B981] select-none mr-2.5 font-semibold">$</span>
                        <input
                            className="flex-1 bg-transparent text-[#FFFFFF] font-mono text-xs outline-none placeholder-[#71717A]"
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
                            className="px-3 py-1 rounded bg-[#18181B] hover:bg-[#27272A] text-[#E4E4E7] hover:text-[#FFFFFF] border border-[#27272A] text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                            <span>Return</span>
                            <span className="text-[10px] text-[#71717A]">↵</span>
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
