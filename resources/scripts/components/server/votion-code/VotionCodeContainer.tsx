import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { ServerContext } from '@/state/server';
import { PowerAction } from '@/components/server/console/ServerConsoleContainer';
import Can from '@/components/elements/Can';

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

    type FolderMode = 'server' | 'all' | 'short';

    // Default to 'server' so VS Code directly opens the target server folder.
    // Non-root admins are strictly locked to 'server' mode.
    const [folderMode, setFolderMode] = useState<FolderMode>(() => {
        if (!rootAdmin) return 'server';
        const saved = localStorage.getItem('votion_code_folder_mode_v2') as FolderMode;
        if (saved && ['server', 'all', 'short'].includes(saved)) {
            return saved;
        }
        return 'server';
    });

    const [endpoint, setEndpoint] = useState<string>(defaultEndpoint);
    const [tempEndpoint, setTempEndpoint] = useState<string>(defaultEndpoint);
    const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
    const [copiedScript, setCopiedScript] = useState(false);
    const [copiedDiag, setCopiedDiag] = useState(false);
    const [iframeKey, setIframeKey] = useState(1);
    const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [isIframeLoading, setIsIframeLoading] = useState<boolean>(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Sync tempEndpoint whenever defaultEndpoint changes (e.g. switching server node)
    useEffect(() => {
        setEndpoint(defaultEndpoint);
        setTempEndpoint(defaultEndpoint);
    }, [defaultEndpoint]);

    const handleFolderModeChange = (mode: FolderMode) => {
        // Enforce strict multi-tenant isolation: non-root admins can never switch to 'all' disks
        if (!rootAdmin && mode === 'all') {
            return;
        }
        setFolderMode(mode);
        localStorage.setItem('votion_code_folder_mode_v2', mode);
        setIsIframeLoading(true);
        setIframeKey((prev) => prev + 1);
    };

    // Compute the target URL with workspace folder and dark theme by default
    const targetUrl = useMemo(() => {
        const cleanBase = endpoint.trim().replace(/\/+$/, '');
        const dedicatedAlloc = server.allocations?.find((a) => a.port === 8080 || a.port === 8443);
        if (dedicatedAlloc && cleanBase.includes(String(dedicatedAlloc.port))) {
            return `${cleanBase}/?folder=/home/container`;
        }

        const cleanUuid = (server.uuid || '').toLowerCase();
        // Strict security: If user is not rootAdmin, ALWAYS lock folder strictly to their own server UUID!
        let folderParam = `/home/coder/projects/${cleanUuid}`;
        if (rootAdmin && folderMode === 'all') {
            folderParam = '/home/coder/projects';
        } else if (rootAdmin && folderMode === 'short') {
            folderParam = `/home/coder/projects/${(server.id || '').toLowerCase()}`;
        }
        return `${cleanBase}/?folder=${folderParam}`;
    }, [endpoint, server.allocations, server.uuid, server.id, folderMode, rootAdmin]);

    // Whenever targetUrl or iframeKey changes, show the dark loading screen
    useEffect(() => {
        setIsIframeLoading(true);
    }, [targetUrl, iframeKey]);

    // Safety fallback so loading screen never gets stuck indefinitely
    useEffect(() => {
        if (isIframeLoading) {
            const timer = setTimeout(() => {
                setIsIframeLoading(false);
            }, 8000);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isIframeLoading]);

    // Active health check to detect if coder/code-server is responding.
    // Uses mode: 'no-cors' so cross-origin health check does not throw browser CORS errors
    // when requesting the node daemon directly (e.g. https://de-nuremberg-01.votioncloud.org:8443).
    const checkConnection = useCallback(async (testUrl: string) => {
        setEngineStatus('checking');
        const clean = testUrl.trim().replace(/\/+$/, '');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            // mode: 'no-cors' allows browser to reach https://<node>:8443 without throwing a CORS exception!
            const res = await fetch(`${clean}/healthz`, {
                method: 'GET',
                mode: 'no-cors',
                signal: controller.signal,
            }).catch(() => null);

            clearTimeout(timeoutId);

            if (res) {
                setEngineStatus('online');
                return true;
            }

            // Fallback: test root with no-cors
            const rootRes = await fetch(`${clean}/`, {
                method: 'GET',
                mode: 'no-cors',
            }).catch(() => null);

            if (rootRes) {
                setEngineStatus('online');
                return true;
            }

            setEngineStatus('offline');
            return false;
        } catch {
            setEngineStatus('offline');
            return false;
        }
    }, []);

    useEffect(() => {
        checkConnection(endpoint);
    }, [endpoint, checkConnection]);

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
        const cmd = `docker exec votion-code ls -la /home/coder/projects`;
        navigator.clipboard.writeText(cmd);
        setCopiedDiag(true);
        setTimeout(() => setCopiedDiag(false), 2500);
    };

    const nodeHttpsUrl = `https://${nodeHost}:8443`;
    const nodeHttpUrl = `http://${nodeHost}:8443`;
    const panelProxyUrl = `${window.location.origin}/votion-code`;

    return (
        <div className="w-screen h-screen flex flex-col bg-[#000000] text-[#D4D4D8] font-sans select-none overflow-hidden">
            {/* 1. TOP HEADER TOOLBAR */}
            <header className="h-11 bg-[#050505] border-b border-[#1A1A1A] px-3.5 flex items-center justify-between shrink-0 z-30">
                {/* Left: Branding & Server Name */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] font-mono font-bold text-xs shadow-xs">
                            &lt;/&gt;
                        </div>
                        <span className="font-serif font-bold text-sm text-white tracking-tight">
                            Votion Code
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 uppercase tracking-wider hidden sm:inline">
                            VS Code Studio
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

                    {/* Node Badge */}
                    <button
                        type="button"
                        onClick={() => setIsSetupOpen(true)}
                        className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0A0A0A] border border-[#1A1A1A] hover:border-zinc-700 text-[10px] font-mono transition-colors cursor-pointer"
                        title={`Server hosted on ${nodeHost}. Click to configure connection.`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${
                                engineStatus === 'online'
                                    ? 'bg-[#10B981]'
                                    : engineStatus === 'checking'
                                    ? 'bg-amber-400 animate-pulse'
                                    : 'bg-rose-500'
                            }`}
                        />
                        <span className="text-zinc-500">Node:</span>
                        <span className="text-zinc-300 font-semibold">{nodeHost}</span>
                    </button>
                </div>

                {/* Center: Server Lifecycle Controls & Status */}
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

                {/* Right: Studio Utilities & Exit */}
                <div className="flex items-center gap-2">
                    {/* Folder Mode Switcher */}
                    <div className="flex items-center bg-[#0A0A0A] border border-[#1A1A1A] rounded-md p-0.5 text-[11px] font-mono">
                        <button
                            type="button"
                            onClick={() => handleFolderModeChange('server')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                                folderMode === 'server'
                                    ? 'bg-emerald-500/20 text-emerald-400 font-semibold shadow-xs'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                            title={`Open Server Volume Folder (/home/coder/projects/${server.uuid.toLowerCase()})`}
                        >
                            <span>📁</span>
                            <span className="hidden sm:inline">Server</span>
                        </button>
                        {rootAdmin && (
                            <button
                                type="button"
                                onClick={() => handleFolderModeChange('all')}
                                className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                                    folderMode === 'all'
                                        ? 'bg-emerald-500/20 text-emerald-400 font-semibold shadow-xs'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                                title="Open All Server Volumes Root (/home/coder/projects) — view all disks on this node (Admin only)"
                            >
                                <span>🗂</span>
                                <span className="hidden sm:inline">All Disks</span>
                            </button>
                        )}
                        {rootAdmin && (
                            <button
                                type="button"
                                onClick={() => handleFolderModeChange('short')}
                                className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                                    folderMode === 'short'
                                        ? 'bg-emerald-500/20 text-emerald-400 font-semibold shadow-xs'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                                title={`Open by Short ID (/home/coder/projects/${server.id.toLowerCase()})`}
                            >
                                <span>🏷</span>
                                <span className="hidden md:inline">{server.id}</span>
                            </button>
                        )}
                    </div>

                    {/* Reload Iframe Button */}
                    <button
                        type="button"
                        onClick={() => {
                            setIsIframeLoading(true);
                            setIframeKey((prev) => prev + 1);
                        }}
                        className="px-2 py-1 rounded-md text-xs font-mono bg-[#0A0A0A] hover:bg-[#141414] text-zinc-400 hover:text-white border border-[#1A1A1A] transition-colors cursor-pointer flex items-center gap-1"
                        title="Reload Studio Frame"
                    >
                        <span>↻</span>
                    </button>

                    {/* Setup / Endpoint Button (Root Admin only) */}
                    {rootAdmin && (
                        <button
                            type="button"
                            onClick={() => setIsSetupOpen(true)}
                            className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 border ${
                                isSetupOpen
                                    ? 'bg-[#1F1F1F] text-white border-[#383838]'
                                    : 'bg-[#0A0A0A] text-zinc-300 hover:text-white border-[#1A1A1A] hover:border-zinc-600'
                            }`}
                            title="Configure Votion Code Engine Endpoint & Diagnostics (Admin only)"
                        >
                            <span>⚙</span>
                            <span className="hidden md:inline">Setup / Endpoint</span>
                        </button>
                    )}

                    {/* Pop-out in dedicated tab */}
                    <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-md text-xs font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1 no-underline"
                        title="Open VS Code directly in full dedicated tab"
                    >
                        <span>Pop-out</span>
                        <span>↗</span>
                    </a>

                    {/* Exit to Server Console */}
                    <button
                        type="button"
                        onClick={() => history.push(`/server/${server.id}`)}
                        className="px-2.5 py-1 rounded-md text-xs font-mono text-zinc-400 hover:text-white bg-[#0A0A0A] hover:bg-[#141414] border border-[#1A1A1A] transition-colors cursor-pointer flex items-center gap-1"
                        title="Exit Votion Code back to Server Console"
                    >
                        <span>Exit</span>
                        <span>✕</span>
                    </button>
                </div>
            </header>

            {/* 2. MAIN BODY */}
            <main className="flex-1 w-full h-full relative bg-[#000000] overflow-hidden">
                {/* Genuine Coder / Code-Server Iframe — Always active so the browser connects directly */}
                <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    src={targetUrl}
                    title="Votion Code - VS Code Cloud Studio"
                    onLoad={() => {
                        setEngineStatus('online');
                        setTimeout(() => {
                            setIsIframeLoading(false);
                        }, 500);
                    }}
                    style={{ backgroundColor: '#000000', colorScheme: 'dark' } as any}
                    className={`w-full h-full border-0 bg-[#000000] dark transition-opacity duration-500 ${
                        isIframeLoading || engineStatus === 'offline' ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                    allow="clipboard-read; clipboard-write; fullscreen; camera; microphone; payment; usb; display-capture"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                />

                {/* Dark Loading Screen — completely hides Chromium white subframe flash and connection checks */}
                {(isIframeLoading || engineStatus === 'checking') && engineStatus !== 'offline' && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#000000] text-zinc-400 font-mono select-none pointer-events-none transition-opacity duration-300">
                        <div className="relative mb-5">
                            <div className="w-14 h-14 rounded-2xl bg-[#080808] border border-[#1A1A1A] flex items-center justify-center text-[#10B981] font-mono font-bold text-xl shadow-2xl shadow-emerald-500/10">
                                &lt;/&gt;
                            </div>
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                            </span>
                        </div>

                        <div className="flex items-center gap-2.5 text-xs text-white font-medium mb-1">
                            <svg className="w-3.5 h-3.5 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Loading Votion Code Studio...</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono m-0">
                            Connecting to node <span className="text-zinc-300">{nodeHost}</span> &amp; initializing workspace
                        </p>

                        <div className="w-48 h-1 bg-[#141414] rounded-full overflow-hidden mt-4">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-pulse w-3/4" />
                        </div>
                    </div>
                )}

                {/* Offline Guard Screen — only shown if both network and iframe fail */}
                {engineStatus === 'offline' && isIframeLoading && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-[#050505]">
                        <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-2xl font-mono text-[#10B981] mb-4 shadow-xl">
                            &lt;/&gt;
                        </div>
                        <h2 className="font-serif text-xl font-normal text-white m-0">
                            Votion Code Engine is not reachable on {isRemoteNode ? `Node (${nodeHost})` : 'your VPS'}
                        </h2>
                        <p className="text-xs text-zinc-400 font-mono max-w-lg mt-2 mb-6 leading-relaxed">
                            Votion Code uses genuine <span className="text-white font-semibold">coder/code-server</span> to let you edit your server files in Microsoft VS Code with real bash terminals.
                            <br />
                            {isRemoteNode ? (
                                <span>This server is hosted on Wings Node <strong className="text-emerald-400">{nodeHost}</strong>.</span>
                            ) : (
                                <span>Run the setup command on your VPS terminal to start the engine.</span>
                            )}
                        </p>

                        {rootAdmin && (
                            <div className="w-full max-w-xl bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-4 text-left space-y-3 shadow-2xl mb-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono text-zinc-300 font-semibold">
                                        Run on {isRemoteNode ? `Node (${nodeHost})` : 'VPS'} via SSH:
                                    </span>
                                    <button
                                        type="button"
                                        onClick={copySetupScript}
                                        className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-semibold transition-all cursor-pointer shadow-xs"
                                    >
                                        {copiedScript ? '✓ Copied!' : 'Copy 1-Click Command'}
                                    </button>
                                </div>
                                <div className="bg-[#000000] p-3 rounded-lg border border-[#1A1A1A] font-mono text-xs text-emerald-400 overflow-x-auto select-all">
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
                                className="px-5 py-2 rounded-md bg-emerald-500 text-black font-mono text-xs font-semibold hover:bg-emerald-400 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                            >
                                <span>Launch Studio Frame</span>
                                <span>⚡</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => checkConnection(endpoint)}
                                className="px-4 py-2 rounded-md bg-[#141414] hover:bg-[#1E1E1E] text-zinc-300 hover:text-white border border-[#262626] font-mono text-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                                <span>Retry Connection</span>
                                <span>🔄</span>
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
                            <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A] mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] font-mono font-bold text-sm">
                                        &lt;/&gt;
                                    </div>
                                    <div>
                                        <h3 className="font-serif font-bold text-white text-base m-0">
                                            Votion Code Engine Settings
                                        </h3>
                                        <p className="text-xs text-zinc-400 font-mono m-0">
                                            Powered by coder/code-server (Microsoft VS Code Web)
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSetupOpen(false)}
                                    className="text-zinc-400 hover:text-white text-base p-1.5 rounded hover:bg-[#1A1A1A] transition-colors"
                                >
                                    ✕
                                </button>
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

                                {/* Folder Mode Scope Selector */}
                                <div className="space-y-1.5 pt-1">
                                    <label className="block text-xs font-mono text-zinc-300">
                                        Workspace Scope / Target Folder:
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                                        <button
                                            type="button"
                                            onClick={() => handleFolderModeChange('server')}
                                            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                                folderMode === 'server'
                                                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                                                    : 'bg-[#050505] border-[#1F1F1F] text-zinc-400 hover:text-white hover:border-[#333333]'
                                            }`}
                                        >
                                            <div className="font-semibold flex items-center gap-1.5">
                                                <span>📁</span>
                                                <span>Server Volume</span>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 mt-1 truncate">
                                                /projects/{server.uuid.toLowerCase()}
                                            </div>
                                        </button>

                                        {rootAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => handleFolderModeChange('all')}
                                                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                                    folderMode === 'all'
                                                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                                                        : 'bg-[#050505] border-[#1F1F1F] text-zinc-400 hover:text-white hover:border-[#333333]'
                                                }`}
                                            >
                                                <div className="font-semibold flex items-center gap-1.5">
                                                    <span>🗂</span>
                                                    <span>All Disks Root</span>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 mt-1 truncate">
                                                    /projects (all server disks)
                                                </div>
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => handleFolderModeChange('short')}
                                            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                                folderMode === 'short'
                                                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                                                    : 'bg-[#050505] border-[#1F1F1F] text-zinc-400 hover:text-white hover:border-[#333333]'
                                            }`}
                                        >
                                            <div className="font-semibold flex items-center gap-1.5">
                                                <span>🏷</span>
                                                <span>Short ID</span>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 mt-1 truncate">
                                                /projects/{server.id.toLowerCase()}
                                            </div>
                                        </button>
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
