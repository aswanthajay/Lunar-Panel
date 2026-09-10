import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { ServerContext } from '@/state/server';
import { PowerAction } from '@/components/server/console/ServerConsoleContainer';
import Can from '@/components/elements/Can';
import { PulseLoader } from '@/components/elements/Spinner';

const STORAGE_ENDPOINT_KEY = 'votion_code_endpoint_url';

const VotionCodeContainer: React.FC = () => {
    const history = useHistory();
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data?.rootAdmin || false);
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const status = ServerContext.useStoreState((state) => state.status.value) || 'offline';
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

    // Compute the node hostname where this server is physically hosted
    const nodeHost = useMemo(() => {
        return server.sftpDetails?.ip || window.location.hostname;
    }, [server.sftpDetails?.ip]);

    const isRemoteNode = useMemo(() => {
        return Boolean(nodeHost && nodeHost !== window.location.hostname && nodeHost !== '127.0.0.1' && nodeHost !== 'localhost');
    }, [nodeHost]);

    const storageKey = `votion_code_endpoint_${nodeHost}`;

    // Smart default endpoint:
    // 1. Dedicated allocation if present (e.g. port 8080 or 8443)
    // 2. Saved per-node endpoint override
    // 3. If server is on a remote Wings node (e.g. Sg1.lunarcloud.in), default to https://${nodeHost}:8443
    // 4. Otherwise, default to reverse proxy path /votion-code on the panel VPS
    const defaultEndpoint = useMemo(() => {
        const dedicatedAlloc = server.allocations?.find((a) => a.port === 8080 || a.port === 8443);
        if (dedicatedAlloc) {
            const host = dedicatedAlloc.alias || dedicatedAlloc.ip;
            return `https://${host}:${dedicatedAlloc.port}`;
        }
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            return saved;
        }
        if (isRemoteNode) {
            return `https://${nodeHost}:8443`;
        }
        return `${window.location.origin}/votion-code`;
    }, [server.allocations, storageKey, isRemoteNode, nodeHost]);

    // Clean up any stale folder mode key from localStorage (no longer used)
    useEffect(() => {
        localStorage.removeItem('votion_code_folder_mode_v2');
    }, []);

    const assignedMode = server.votionCodeMode || 'both';
    const modeStorageKey = `votion_code_mode_${server.uuid}`;

    const [mode, setMode] = useState<'full' | 'lite'>(() => {
        if (assignedMode === 'lite') return 'lite';
        if (assignedMode === 'full') return 'full';
        const saved = localStorage.getItem(modeStorageKey);
        if (saved === 'full' || saved === 'lite') return saved;
        return 'lite';
    });

    const handleSetMode = (newMode: 'full' | 'lite') => {
        setMode(newMode);
        localStorage.setItem(modeStorageKey, newMode);
        setIsIframeLoading(true);
        setIframeKey((prev) => prev + 1);
    };

    const [endpoint, setEndpoint] = useState<string>(defaultEndpoint);
    const [tempEndpoint, setTempEndpoint] = useState<string>(defaultEndpoint);
    const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
    const [copiedScript, setCopiedScript] = useState(false);
    const [copiedDiag, setCopiedDiag] = useState(false);
    const [iframeKey, setIframeKey] = useState(1);
    const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [isIframeLoading, setIsIframeLoading] = useState<boolean>(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const checkAbortRef = useRef<AbortController | null>(null);

    // Sync tempEndpoint whenever defaultEndpoint changes (e.g. switching server node)
    useEffect(() => {
        setEndpoint(defaultEndpoint);
        setTempEndpoint(defaultEndpoint);
    }, [defaultEndpoint]);

    const targetUrl = useMemo(() => {
        const cleanUuid = (server.uuid || '').toLowerCase();
        if (mode === 'lite') {
            const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
            return `/votion-code-lite/?server=${cleanUuid}&v=2.7${csrf ? `&csrf=${encodeURIComponent(csrf)}` : ''}`;
        }
        const cleanBase = endpoint.trim().replace(/\/+$/, '');
        return `${cleanBase}/?folder=/home/coder/projects/${cleanUuid}`;
    }, [mode, endpoint, server.uuid]);

    // Whenever targetUrl or iframeKey changes, show the dark loading screen
    useEffect(() => {
        setIsIframeLoading(true);
    }, [targetUrl, iframeKey]);

    // Safety fallback so loading screen never gets stuck indefinitely (3.5s max)
    useEffect(() => {
        if (isIframeLoading) {
            const timer = setTimeout(() => {
                setIsIframeLoading(false);
            }, 3500);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isIframeLoading]);

    // Bridge server socket output and commands to/from the embedded VS Code Lite terminal
    useEffect(() => {
        if (!instance || mode !== 'lite') return;

        const handleConsoleOutput = (line: string) => {
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: 'VOTION_SERVER_LOG', data: line, kind: 'output' },
                    '*'
                );
            }
        };

        const handleDaemonError = (line: string) => {
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: 'VOTION_SERVER_LOG', data: line, kind: 'error' },
                    '*'
                );
            }
        };

        const handleStatus = (s: string) => {
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: 'VOTION_SERVER_STATUS', status: s },
                    '*'
                );
            }
        };

        instance.on('console output', handleConsoleOutput);
        instance.on('daemon error', handleDaemonError);
        instance.on('status', handleStatus);

        const handleChildMessage = (e: MessageEvent) => {
            if (e.data?.type === 'VOTION_SEND_COMMAND' && typeof e.data?.command === 'string') {
                instance.send('send command', e.data.command);
            } else if (e.data?.type === 'VOTION_REQUEST_LOGS') {
                instance.send('send logs');
            }
        };

        window.addEventListener('message', handleChildMessage);

        return () => {
            instance.removeListener('console output', handleConsoleOutput);
            instance.removeListener('daemon error', handleDaemonError);
            instance.removeListener('status', handleStatus);
            window.removeEventListener('message', handleChildMessage);
        };
    }, [instance, mode]);

    // Active health check to detect if coder/code-server is responding.
    const checkConnection = useCallback(async (testUrl: string) => {
        if (checkAbortRef.current) {
            checkAbortRef.current.abort();
        }
        const controller = new AbortController();
        checkAbortRef.current = controller;

        setEngineStatus('checking');
        const clean = testUrl.trim().replace(/\/+$/, '');
        try {
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(`${clean}/healthz`, {
                method: 'GET',
                mode: 'no-cors',
                signal: controller.signal,
            }).catch(() => null);

            clearTimeout(timeoutId);

            if (res) {
                setEngineStatus('online');
                setIsIframeLoading(false);
                return true;
            }

            // Fallback: test root with no-cors and 2000ms timeout
            const fallbackController = new AbortController();
            const fallbackTimeout = setTimeout(() => fallbackController.abort(), 2000);
            const rootRes = await fetch(`${clean}/`, {
                method: 'GET',
                mode: 'no-cors',
                signal: fallbackController.signal,
            }).catch(() => null);
            clearTimeout(fallbackTimeout);

            if (rootRes) {
                setEngineStatus('online');
                setIsIframeLoading(false);
                return true;
            }

            // If iframe has already loaded, keep it online
            setEngineStatus((prev) => (prev === 'online' ? 'online' : 'offline'));
            return false;
        } catch {
            setEngineStatus((prev) => (prev === 'online' ? 'online' : 'offline'));
            return false;
        }
    }, []);

    useEffect(() => {
        if (mode === 'lite') {
            setEngineStatus('online');
            return;
        }
        checkConnection(endpoint);
    }, [mode, endpoint, checkConnection]);

    const handleSaveEndpoint = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = tempEndpoint.trim().replace(/\/+$/, '');
        if (trimmed) {
            setEndpoint(trimmed);
            localStorage.setItem(storageKey, trimmed);
            localStorage.setItem(STORAGE_ENDPOINT_KEY, trimmed);
            checkConnection(trimmed);
        }
        setIsSetupOpen(false);
        setIsIframeLoading(true);
        setIframeKey((prev) => prev + 1);
    };

    const handlePowerAction = (action: PowerAction) => {
        if (instance) {
            instance.send('set state', action);
        }
    };

    const copySetupScript = () => {
        const cmd = `bash <(curl -fsSL https://raw.githubusercontent.com/aswanthajay/Lunar-Panel/stellar/scripts/setup-votion-code.sh)`;
        navigator.clipboard.writeText(cmd);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2500);
    };

    const copyDiagCommand = () => {
        const cleanUuid = (server.uuid || '').toLowerCase();
        const cmd = `docker exec votion-code ls -la /home/coder/projects/${cleanUuid}`;
        navigator.clipboard.writeText(cmd);
        setCopiedDiag(true);
        setTimeout(() => setCopiedDiag(false), 2500);
    };



    const nodeHttpsUrl = `https://${nodeHost}:8443`;
    const nodeHttpUrl = `http://${nodeHost}:8443`;
    const panelProxyUrl = `${window.location.origin}/votion-code`;

    return (
        <div className="w-screen h-screen flex flex-col bg-[#181818] text-[#cccccc] font-sans select-none overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            {/* 1. VS CODE NATIVE TITLEBAR */}
            <header className="h-[35px] bg-[#181818] border-b border-[#2b2b2b] px-2 flex items-center justify-between shrink-0 z-30 select-none">
                {/* Left: VS Code Brand & Menu Bar */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-2 pl-1 pr-1.5">
                        {/* Official VS Code Logo */}
                        <svg className="w-4 h-4 text-[#007ACC] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.94-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                        </svg>
                        <span className="text-[12px] font-medium text-[#cccccc] tracking-normal">
                            Votion Code
                        </span>
                        <span className="text-[10px] font-mono text-[#8b949e] px-1.5 py-0.5 bg-[#222222] border border-[#2b2b2b] rounded">
                            {mode === 'lite' ? 'Lite Web' : 'Studio'}
                        </span>
                    </div>
                </div>

                {/* Center: VS Code Command Center (Search & Server Indicator) */}
                <div className="flex items-center justify-center flex-1 max-w-[480px] mx-2">
                    <div className="w-full h-[24px] bg-[#1f1f1f] hover:bg-[#252526] border border-[#2b2b2b] hover:border-[#3c3c3c] rounded-[6px] px-2.5 flex items-center justify-between gap-3 text-[12px] transition-all cursor-default shadow-xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-3 h-3 text-[#8b949e] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                            </svg>
                            <span className="truncate font-medium text-[#e6edf3]">{server.name}</span>
                            <span className="text-[#8b949e] text-[11px] font-mono shrink-0">[{server.id}]</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 text-[11px]">
                                <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                        status === 'running'
                                            ? 'bg-[#3fb950] animate-pulse'
                                            : status === 'starting'
                                            ? 'bg-[#d29922] animate-pulse'
                                            : status === 'stopping'
                                            ? 'bg-[#f85149] animate-pulse'
                                            : 'bg-[#6e7681]'
                                    }`}
                                />
                                <span className="capitalize text-[#8b949e]">{status}</span>
                            </div>
                            <span className="text-[#3c3c3c] hidden sm:inline">•</span>
                            <button
                                type="button"
                                onClick={() => setIsSetupOpen(true)}
                                className="hidden sm:inline text-[11px] text-[#8b949e] hover:text-[#58a6ff] transition-colors cursor-pointer truncate max-w-[120px]"
                                title={`Node Host: ${nodeHost}. Click for endpoint settings.`}
                            >
                                {nodeHost}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: VS Code Debug / Power Toolbar & Window Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Mode Switcher: Lite (Static Web) vs Full (Cloud Studio) */}
                    {(assignedMode === 'both' || rootAdmin) ? (
                        <div className="flex items-center bg-[#1f1f1f] border border-[#2b2b2b] rounded-[4px] p-[2px] mr-1">
                            <button
                                type="button"
                                onClick={() => handleSetMode('lite')}
                                className={`h-[22px] px-2 rounded-[3px] text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                    mode === 'lite'
                                        ? 'bg-[#007ACC] text-white shadow-xs font-semibold'
                                        : 'text-[#8b949e] hover:text-[#cccccc] hover:bg-[#ffffff12]'
                                }`}
                                title="Votion Code Lite (Pure Static VS Code Web Client — Zero Server/Node Overhead)"
                            >
                                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z"/>
                                </svg>
                                <span className="hidden sm:inline">Lite Web</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetMode('full')}
                                className={`h-[22px] px-2 rounded-[3px] text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                    mode === 'full'
                                        ? 'bg-[#007ACC] text-white shadow-xs font-semibold'
                                        : 'text-[#8b949e] hover:text-[#cccccc] hover:bg-[#ffffff12]'
                                }`}
                                title="Votion Code Full (Code-Server Cloud Studio with Real Bash Terminal & Copilot)"
                            >
                                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25H1.75zM3.22 4.47a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 0 1 0 1.06l-2.5 2.5a.75.75 0 0 1-1.06-1.06L5.19 7.5 3.22 5.53a.75.75 0 0 1 0-1.06zM8 9.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5A.75.75 0 0 1 8 9.25z"/>
                                </svg>
                                <span className="hidden sm:inline">Full Studio</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center px-2 py-0.5 rounded bg-[#1f1f1f] border border-[#2b2b2b] text-[11px] font-mono text-[#8b949e] mr-1">
                            <span className="text-[#007ACC] font-semibold mr-1">{mode === 'lite' ? 'Lite' : 'Full'}</span>
                            <span className="hidden sm:inline">{mode === 'lite' ? 'Web' : 'Studio'}</span>
                        </div>
                    )}

                    {/* Server Power Controls (Styled like VS Code Debug Control Toolbar) */}
                    <div className="flex items-center bg-[#1f1f1f] border border-[#2b2b2b] rounded-[4px] p-[2px] mr-1">
                        <Can action={'control.start'}>
                            <button
                                type="button"
                                disabled={status !== 'offline'}
                                onClick={() => handlePowerAction('start')}
                                className="h-[22px] px-2 rounded-[3px] text-[11px] font-medium transition-colors hover:bg-[#ffffff15] text-[#cccccc] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                                title="Start Server (▶)"
                            >
                                <svg className="w-3 h-3 text-[#3fb950] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M3 2.5a.5.5 0 0 1 .77-.42l10 5.5a.5.5 0 0 1 0 .84l-10 5.5A.5.5 0 0 1 3 13.5v-11z" />
                                </svg>
                                <span className="hidden sm:inline text-[#cccccc]">Start</span>
                            </button>
                        </Can>

                        <Can action={'control.restart'}>
                            <button
                                type="button"
                                disabled={status === 'offline'}
                                onClick={() => handlePowerAction('restart')}
                                className="h-[22px] px-2 rounded-[3px] text-[11px] font-medium transition-colors hover:bg-[#ffffff15] text-[#cccccc] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                                title="Restart Server (↻)"
                            >
                                <svg className="w-3 h-3 text-[#3794ff] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                                </svg>
                                <span className="hidden sm:inline text-[#cccccc]">Restart</span>
                            </button>
                        </Can>

                        <Can action={'control.stop'}>
                            <button
                                type="button"
                                disabled={status === 'offline'}
                                onClick={() => handlePowerAction('stop')}
                                className="h-[22px] px-2 rounded-[3px] text-[11px] font-medium transition-colors hover:bg-[#ffffff15] text-[#cccccc] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                                title="Stop Server (■)"
                            >
                                <svg className="w-3 h-3 text-[#f85149] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                                    <rect x="3" y="3" width="10" height="10" rx="1.5" />
                                </svg>
                                <span className="hidden sm:inline text-[#cccccc]">Stop</span>
                            </button>
                        </Can>
                    </div>

                    <div className="h-[14px] w-[1px] bg-[#2b2b2b] mx-0.5 hidden sm:block" />

                    {/* Setup / Endpoint Button (Root Admin only) */}
                    {rootAdmin && (
                        <button
                            type="button"
                            onClick={() => setIsSetupOpen(true)}
                            className="w-[28px] h-[24px] flex items-center justify-center rounded-[4px] hover:bg-[#ffffff15] text-[#8b949e] hover:text-[#cccccc] transition-colors cursor-pointer"
                            title="Configure Votion Code Endpoint & Diagnostics"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                                <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/>
                            </svg>
                        </button>
                    )}

                    {/* Pop-out in dedicated tab */}
                    <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-[28px] h-[24px] flex items-center justify-center rounded-[4px] hover:bg-[#ffffff15] text-[#8b949e] hover:text-[#cccccc] transition-colors cursor-pointer"
                        title="Open in Full Dedicated Window"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                            <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                        </svg>
                    </a>

                    {/* Close / Exit Window Control (VS Code Native Window Style) */}
                    <button
                        type="button"
                        onClick={() => history.push(`/server/${server.id}`)}
                        className="w-[34px] h-[24px] flex items-center justify-center rounded-[4px] hover:bg-[#e81123] text-[#8b949e] hover:text-white transition-colors cursor-pointer ml-0.5"
                        title="Close Studio (Back to Server Console)"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                        </svg>
                    </button>
                </div>
            </header>



            {/* 2. MAIN BODY */}
            <main className="flex-1 relative min-h-0">
                {/* Genuine Coder / Code-Server or VS Code Web Iframe */}
                    <iframe
                        key={`${mode}-${iframeKey}`}
                        ref={iframeRef}
                        src={targetUrl}
                        title={mode === 'lite' ? 'Votion Code Lite - Pure Static VS Code Web' : 'Votion Code Full - VS Code Cloud Studio'}
                        onLoad={() => {
                            setEngineStatus('online');
                            setTimeout(() => {
                                setIsIframeLoading(false);
                            }, 500);
                        }}
                        style={{ backgroundColor: '#181818', colorScheme: 'dark' } as any}
                        className={`w-full h-full border-0 bg-[#181818] dark transition-opacity duration-500 ${
                            isIframeLoading || engineStatus === 'offline' ? 'opacity-0 pointer-events-none' : 'opacity-100'
                        }`}
                        allow="clipboard-read; clipboard-write; fullscreen; camera; microphone; payment; usb; display-capture"
                    />

                    {/* Dark Loading Screen — completely hides Chromium white subframe flash */}
                    {isIframeLoading && engineStatus !== 'offline' && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#181818] text-zinc-400 font-mono select-none pointer-events-none transition-opacity duration-300">
                            <div className="relative mb-5">
                                <div className="w-14 h-14 rounded-2xl bg-[#121212] border border-[#2b2b2b] flex items-center justify-center text-[#007ACC] font-mono font-bold text-xl shadow-2xl">
                                    <svg className="w-7 h-7 text-[#007ACC]" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.94-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                                    </svg>
                                </div>
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                                </span>
                            </div>

                            <div className="flex items-center gap-2.5 text-xs text-white font-medium mb-1">
                                <PulseLoader size="small" />
                                <span>{mode === 'lite' ? 'Loading Votion Code Lite (Web)...' : 'Loading Votion Code Studio...'}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 font-mono m-0">
                                {mode === 'lite' ? 'Mounting file workspace via panel REST API' : `Connecting to node ${nodeHost} & initializing workspace`}
                            </p>

                            <div className="w-48 h-1 bg-[#141414] rounded-full overflow-hidden mt-4">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-pulse w-3/4" />
                            </div>
                        </div>
                    )}

                    {/* Offline Guard Screen — only shown if mode === 'full' and backend is unreachable */}
                    {mode === 'full' && engineStatus === 'offline' && isIframeLoading && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-[#050505]">
                            <div className="w-14 h-14 rounded-2xl bg-[#007ACC]/10 border border-[#007ACC]/30 flex items-center justify-center text-2xl font-mono text-[#007ACC] mb-4 shadow-xl">
                                <svg className="w-7 h-7 text-[#007ACC]" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.94-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                                </svg>
                            </div>
                            <h2 className="font-serif text-xl font-normal text-white m-0">
                            Votion Code Engine is not reachable on {isRemoteNode ? `Node (${nodeHost})` : 'your VPS'}
                        </h2>
                        <p className="text-xs text-zinc-400 font-mono max-w-lg mt-2 mb-6 leading-relaxed">
                            Votion Code Full uses genuine <span className="text-white font-semibold">coder/code-server</span> to let you edit your server files in Microsoft VS Code with real bash terminals.
                            <br />
                            {isRemoteNode ? (
                                <span>This server is hosted on Wings Node <strong className="text-blue-400">{nodeHost}</strong>.</span>
                            ) : (
                                <span>Run the setup command on your VPS terminal to start the engine.</span>
                            )}
                        </p>

                        <div className="flex items-center gap-3 flex-wrap justify-center mb-6">
                            <button
                                type="button"
                                onClick={() => handleSetMode('lite')}
                                className="px-5 py-2 rounded-md bg-[#007ACC] hover:bg-[#0062a3] text-white font-mono text-xs font-semibold transition-all cursor-pointer shadow-sm flex items-center gap-2"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z"/>
                                </svg>
                                <span>Switch to Votion Code Lite (Instant)</span>
                            </button>
                        </div>

                        {rootAdmin && (
                            <div className="w-full max-w-xl bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-4 text-left space-y-3 shadow-2xl mb-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono text-zinc-300 font-semibold">
                                        Run on {isRemoteNode ? `Node (${nodeHost})` : 'VPS'} via SSH:
                                    </span>
                                    <button
                                        type="button"
                                        onClick={copySetupScript}
                                        className="px-3 py-1 rounded bg-blue-500 hover:bg-blue-400 text-white text-xs font-mono font-semibold transition-all cursor-pointer shadow-xs"
                                    >
                                        {copiedScript ? '✓ Copied!' : 'Copy 1-Click Command'}
                                    </button>
                                </div>
                                <div className="bg-[#000000] p-3 rounded-lg border border-[#1A1A1A] font-mono text-xs text-blue-400 overflow-x-auto select-all">
                                    <code>
                                        bash &lt;(curl -fsSL https://raw.githubusercontent.com/aswanthajay/Lunar-Panel/stellar/scripts/setup-votion-code.sh)
                                    </code>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 flex-wrap justify-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setEngineStatus('online');
                                    setIsIframeLoading(false);
                                }}
                                className="px-5 py-2 rounded-md bg-[#252526] hover:bg-[#333333] text-white font-mono text-xs font-semibold border border-[#3c3c3c] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                            >
                                <span>Launch Studio Frame</span>
                                <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </svg>
                            </button>

                            <button
                                type="button"
                                onClick={() => checkConnection(endpoint)}
                                className="px-4 py-2 rounded-md bg-[#141414] hover:bg-[#1E1E1E] text-zinc-300 hover:text-white border border-[#262626] font-mono text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                                <span>Retry Connection</span>
                                <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="23 4 23 10 17 10" />
                                    <polyline points="1 20 1 14 7 14" />
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                </svg>
                            </button>

                            {rootAdmin && (
                                <button
                                    type="button"
                                    onClick={() => setIsSetupOpen(true)}
                                    className="px-4 py-2 rounded-md bg-[#0A0A0A] hover:bg-[#141414] text-zinc-400 hover:text-white border border-[#1F1F1F] font-mono text-xs transition-colors cursor-pointer"
                                >
                                    Endpoint Settings
                                </button>
                            )}

                            <a
                                href={targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-md bg-[#0A0A0A] hover:bg-[#141414] text-zinc-400 hover:text-white border border-[#1F1F1F] font-mono text-xs transition-colors no-underline"
                            >
                                Force Open in New Tab ↗
                            </a>
                        </div>
                    </div>
                )}

                {/* Setup & Connection Modal */}
                {isSetupOpen && (
                    <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                        <div className="w-full max-w-2xl bg-[#0A0A0A] border border-[#262626] rounded-xl shadow-2xl p-6 font-sans select-text my-auto">
                            {/* Modal Header */}
                            {/* Modal Header */}
                            <div className="flex items-center justify-between pb-3.5 border-b border-[#2b2b2b] mb-4">
                                <div className="flex items-center gap-2.5">
                                    <svg className="w-5 h-5 text-[#007ACC] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.94-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                                    </svg>
                                    <div>
                                        <h3 className="font-sans font-semibold text-[#e6edf3] text-sm m-0">
                                            Votion Code Settings
                                        </h3>
                                        <p className="text-[11px] text-[#8b949e] m-0">
                                            Configure connection to code-server on your Wings node
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSetupOpen(false)}
                                    className="w-6 h-6 flex items-center justify-center rounded-[3px] text-[#8b949e] hover:text-[#cccccc] hover:bg-[#ffffff15] transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                                    </svg>
                                </button>
                            </div>


                            {/* Mode Selection in Settings */}
                            <div className="p-3 rounded-lg bg-[#050505] border border-[#1F1F1F] mb-4 space-y-2">
                                <div className="text-xs font-mono text-zinc-300 font-semibold flex items-center justify-between">
                                    <span>Votion Code Engine Version:</span>
                                    <span className="text-[11px] text-[#8b949e]">
                                        Assigned by Admin: <strong className="text-white capitalize">{assignedMode}</strong>
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSetMode('lite')}
                                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                            mode === 'lite'
                                                ? 'bg-[#007ACC]/10 border-[#007ACC] text-white shadow-xs'
                                                : 'bg-[#0A0A0A] border-[#1F1F1F] text-[#8b949e] hover:border-[#333]'
                                        }`}
                                    >
                                        <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                            </svg>
                                            <span>Lite Version</span>
                                            {mode === 'lite' && <span className="text-[10px] text-[#007ACC]">● Active</span>}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 mt-1 leading-snug">
                                            Pure Static VS Code Web. Instant file editing via Pterodactyl REST API. Zero server/node setup.
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSetMode('full')}
                                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                            mode === 'full'
                                                ? 'bg-[#007ACC]/10 border-[#007ACC] text-white shadow-xs'
                                                : 'bg-[#0A0A0A] border-[#1F1F1F] text-[#8b949e] hover:border-[#333]'
                                        }`}
                                    >
                                        <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6.05 11a22.35 22.35 0 0 1-3.95 2z" />
                                            </svg>
                                            <span>Full Studio</span>
                                            {mode === 'full' && <span className="text-[10px] text-[#007ACC]">● Active</span>}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 mt-1 leading-snug">
                                            Genuine code-server instance with live container bash terminals, ripgrep, and Copilot.
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Node Info Banner */}
                            <div className="p-3 rounded-lg bg-[#050505] border border-[#1F1F1F] text-xs font-mono mb-4 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-400">Server Instance:</span>
                                    <span className="text-white font-semibold">{server.name} ({server.id})</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-400">Daemon Node:</span>
                                    <span className="text-emerald-400 font-semibold">{nodeHost}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-400">Engine Status:</span>
                                    <span className={engineStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'}>
                                        {engineStatus === 'online' ? '● Online (Connected)' : engineStatus === 'checking' ? '○ Checking...' : '● Offline'}
                                    </span>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleSaveEndpoint} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-mono text-zinc-300">
                                        Votion Code Endpoint Base URL:
                                    </label>
                                    <input
                                        type="text"
                                        value={tempEndpoint}
                                        onChange={(e) => setTempEndpoint(e.target.value)}
                                        placeholder={`https://${nodeHost}:8443`}
                                        className="w-full bg-[#000000] border border-[#262626] rounded-md px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500 transition-colors"
                                    />
                                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-zinc-400">
                                        <span>Quick presets:</span>
                                        <button
                                            type="button"
                                            onClick={() => setTempEndpoint(nodeHttpsUrl)}
                                            className="underline hover:text-white cursor-pointer text-emerald-400"
                                        >
                                            {nodeHost}:8443 (Direct HTTPS — Recommended)
                                        </button>
                                        <span>•</span>
                                        <button
                                            type="button"
                                            onClick={() => setTempEndpoint(nodeHttpUrl)}
                                            className="underline hover:text-white cursor-pointer"
                                        >
                                            Port :8443 (HTTP)
                                        </button>
                                        <span>•</span>
                                        <button
                                            type="button"
                                            onClick={() => setTempEndpoint(panelProxyUrl)}
                                            className="underline hover:text-white cursor-pointer"
                                        >
                                            /votion-code (Panel Proxy)
                                        </button>
                                    </div>
                                </div>

                                {/* Workspace Scope — locked to this server's UUID folder */}
                                <div className="space-y-1.5 pt-1">
                                    <label className="block text-xs font-mono text-zinc-300">
                                        Workspace Scope / Target Folder:
                                    </label>
                                    <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-xs font-mono flex items-center gap-2">
                                        <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                        </svg>
                                        <div>
                                            <div className="text-emerald-300 font-semibold">Server Volume (locked)</div>
                                            <div className="text-zinc-500 text-[10px] mt-0.5 truncate">
                                                /home/coder/projects/{server.uuid.toLowerCase()}
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Active URL Preview */}
                                <div className="p-2.5 rounded bg-[#050505] border border-[#1A1A1A] text-[11px] font-mono text-zinc-400 flex items-center justify-between gap-2 overflow-hidden">
                                    <div className="truncate">
                                        Target URL:&nbsp;<code className="text-emerald-400">{targetUrl}</code>
                                    </div>
                                    <a
                                        href={targetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-400 hover:underline shrink-0"
                                    >
                                        Open ↗
                                    </a>
                                </div>

                                {/* Multi-Node Guidance Box */}
                                <div className="p-3 rounded-lg bg-[#050505] border border-[#1F1F1F] space-y-2 text-xs font-mono">
                                    <div className="flex items-center justify-between">
                                        <span className="text-zinc-300 font-semibold">
                                            Run on Node <span className="text-emerald-400">{nodeHost}</span>:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={copySetupScript}
                                            className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] transition-colors cursor-pointer border border-emerald-500/40"
                                        >
                                            {copiedScript ? '✓ Copied' : 'Copy 1-Click Command'}
                                        </button>
                                    </div>
                                    <div className="text-[11px] text-zinc-400">
                                        Run via SSH on <strong>{nodeHost}</strong> (where the bot/server files reside):
                                        <code className="block bg-[#000000] p-1.5 rounded border border-[#1A1A1A] text-emerald-400 mt-1 select-all overflow-x-auto">
                                            bash &lt;(curl -fsSL https://raw.githubusercontent.com/aswanthajay/Lunar-Panel/stellar/scripts/setup-votion-code.sh)
                                        </code>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-[11px] text-zinc-500">Check files in container:</span>
                                        <button
                                            type="button"
                                            onClick={copyDiagCommand}
                                            className="text-zinc-400 hover:text-white text-[11px] cursor-pointer underline"
                                        >
                                            {copiedDiag ? '✓ Copied Diag Cmd' : 'Copy Diag Command'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-[#1A1A1A] gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTempEndpoint(defaultEndpoint);
                                        }}
                                        className="text-xs font-mono text-zinc-500 hover:text-zinc-300"
                                    >
                                        Reset to Default
                                    </button>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsSetupOpen(false)}
                                            className="px-3.5 py-2 rounded-md text-xs font-mono text-zinc-400 hover:text-white bg-[#141414] border border-[#222222]"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2 rounded-md text-xs font-mono font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer shadow-sm"
                                        >
                                            Save & Connect
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default VotionCodeContainer;
