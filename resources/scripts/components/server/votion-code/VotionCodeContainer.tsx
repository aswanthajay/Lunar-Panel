import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { PowerAction } from '@/components/server/console/ServerConsoleContainer';
import Can from '@/components/elements/Can';

const STORAGE_ENDPOINT_KEY = 'votion_code_endpoint_url';

const VotionCodeContainer: React.FC = () => {
    const history = useHistory();
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const status = ServerContext.useStoreState((state) => state.status.value) || 'offline';
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

    // Default endpoint:
    // If dedicated code-server allocation exists, use that.
    // Otherwise, default to reverse proxy path /votion-code
    const defaultEndpoint = useMemo(() => {
        const dedicatedAlloc = server.allocations?.find((a) => a.port === 8080 || a.port === 8443);
        if (dedicatedAlloc) {
            const host = dedicatedAlloc.alias || dedicatedAlloc.ip;
            return `http://${host}:${dedicatedAlloc.port}`;
        }
        const saved = localStorage.getItem(STORAGE_ENDPOINT_KEY);
        if (saved) {
            return saved;
        }
        return `${window.location.origin}/votion-code`;
    }, [server.allocations]);

    type FolderMode = 'server' | 'all' | 'short';

    const [folderMode, setFolderMode] = useState<FolderMode>(() => {
        return (localStorage.getItem('votion_code_folder_mode') as FolderMode) || 'server';
    });

    const [endpoint, setEndpoint] = useState<string>(defaultEndpoint);
    const [tempEndpoint, setTempEndpoint] = useState<string>(defaultEndpoint);
    const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
    const [copiedScript, setCopiedScript] = useState(false);
    const [copiedDiag, setCopiedDiag] = useState(false);
    const [iframeKey, setIframeKey] = useState(1);
    const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const handleFolderModeChange = (mode: FolderMode) => {
        setFolderMode(mode);
        localStorage.setItem('votion_code_folder_mode', mode);
        setIframeKey((prev) => prev + 1);
    };

    // Compute the target URL with workspace folder and dark theme by default
    const targetUrl = useMemo(() => {
        const cleanBase = endpoint.trim().replace(/\/+$/, '');
        const dedicatedAlloc = server.allocations?.find((a) => a.port === 8080 || a.port === 8443);
        if (dedicatedAlloc && cleanBase.includes(String(dedicatedAlloc.port))) {
            return `${cleanBase}/?folder=/home/container`;
        }

        let folderParam = `/home/coder/projects/${server.uuid}`;
        if (folderMode === 'all') {
            folderParam = '/home/coder/projects';
        } else if (folderMode === 'short') {
            folderParam = `/home/coder/projects/${server.id}`;
        }
        return `${cleanBase}/?folder=${folderParam}`;
    }, [endpoint, server.allocations, server.uuid, server.id, folderMode]);

    // Active health check to detect if coder/code-server is responding
    const checkConnection = useCallback(async (testUrl: string) => {
        setEngineStatus('checking');
        const clean = testUrl.trim().replace(/\/+$/, '');
        try {
            // Check healthz or root endpoint
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const res = await fetch(`${clean}/healthz`, {
                method: 'GET',
                signal: controller.signal,
            }).catch(() => null);

            clearTimeout(timeoutId);

            if (res && (res.status === 200 || res.status === 302)) {
                setEngineStatus('online');
                return true;
            }

            // Fallback: check root
            const rootRes = await fetch(`${clean}/`, {
                method: 'GET',
                headers: { Accept: 'text/html' },
            }).catch(() => null);

            // If response header is from code-server (not panel)
            if (rootRes && (rootRes.status === 200 || rootRes.status === 302)) {
                const text = await rootRes.text();
                // If it returned the panel HTML (contains pterodactyl or lunar), it's not code-server yet
                if (text.includes('code-server') || text.includes('vs/code') || text.includes('monaco')) {
                    setEngineStatus('online');
                    return true;
                }
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
            localStorage.setItem(STORAGE_ENDPOINT_KEY, trimmed);
            checkConnection(trimmed);
        }
        setIsSetupOpen(false);
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

    const nodeDirectUrl = `http://${server.sftpDetails?.ip || window.location.hostname}:8443`;

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
                        <span className="text-white font-medium truncate max-w-[200px]" title={server.name}>
                            {server.name}
                        </span>
                        <code className="text-[10px] text-[#71717A] bg-[#0A0A0A] border border-[#1A1A1A] px-1.5 py-0.5 rounded">
                            {server.id}
                        </code>
                    </div>
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
                            title={`Open Server Volume Folder (/home/coder/projects/${server.uuid})`}
                        >
                            <span>📁</span>
                            <span className="hidden sm:inline">Server</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFolderModeChange('all')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                                folderMode === 'all'
                                    ? 'bg-emerald-500/20 text-emerald-400 font-semibold shadow-xs'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                            title="Open All Server Volumes Root (/home/coder/projects) — guarantees all server disks are visible"
                        >
                            <span>🗂</span>
                            <span className="hidden sm:inline">All Disks</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFolderModeChange('short')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                                folderMode === 'short'
                                    ? 'bg-emerald-500/20 text-emerald-400 font-semibold shadow-xs'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                            title={`Open by Short ID (/home/coder/projects/${server.id})`}
                        >
                            <span>🏷</span>
                            <span className="hidden md:inline">{server.id}</span>
                        </button>
                    </div>

                    {/* Reload Iframe Button */}
                    <button
                        type="button"
                        onClick={() => setIframeKey((prev) => prev + 1)}
                        className="px-2 py-1 rounded-md text-xs font-mono bg-[#0A0A0A] hover:bg-[#141414] text-zinc-400 hover:text-white border border-[#1A1A1A] transition-colors cursor-pointer flex items-center gap-1"
                        title="Reload Studio Frame"
                    >
                        <span>↻</span>
                    </button>

                    {/* Setup / Endpoint Button */}
                    <button
                        type="button"
                        onClick={() => setIsSetupOpen(true)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 border ${
                            isSetupOpen
                                ? 'bg-[#1F1F1F] text-white border-[#383838]'
                                : 'bg-[#0A0A0A] text-zinc-300 hover:text-white border-[#1A1A1A] hover:border-zinc-600'
                        }`}
                        title="Configure Votion Code Engine Endpoint & Diagnostics"
                    >
                        <span>⚙</span>
                        <span className="hidden md:inline">Setup / Endpoint</span>
                    </button>

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
                {/* Genuine Coder / Code-Server Iframe (when online) */}
                {engineStatus === 'online' ? (
                    <iframe
                        key={iframeKey}
                        ref={iframeRef}
                        src={targetUrl}
                        title="Votion Code - VS Code Cloud Studio"
                        style={{ colorScheme: 'dark' } as any}
                        className="w-full h-full border-0 bg-[#000000] dark"
                        allow="clipboard-read; clipboard-write; fullscreen; camera; microphone; payment; usb; display-capture"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                    />
                ) : (
                    /* Offline Guard Screen: prevents 404 loop */
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#050505]">
                        <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-2xl font-mono text-[#10B981] mb-4 shadow-xl">
                            &lt;/&gt;
                        </div>
                        <h2 className="font-serif text-xl font-normal text-white m-0">
                            Votion Code Engine is not running on your VPS
                        </h2>
                        <p className="text-xs text-zinc-400 font-mono max-w-lg mt-2 mb-6 leading-relaxed">
                            Votion Code uses the genuine <span className="text-white font-semibold">coder/code-server</span> engine to let you edit your server files in Microsoft VS Code with real bash terminals.
                            <br />
                            Run the 1-click command on your VPS terminal to start it.
                        </p>

                        <div className="w-full max-w-xl bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-4 text-left space-y-3 shadow-2xl mb-6">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-zinc-300 font-semibold">
                                    Run on your VPS (SSH Terminal):
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
                            <p className="text-[11px] text-zinc-500 font-mono m-0">
                                This pulls coder/code-server, mounts all server disks, and configures the Nginx HTTPS reverse proxy automatically.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => checkConnection(endpoint)}
                                className="px-5 py-2 rounded-md bg-emerald-500 text-black font-mono text-xs font-semibold hover:bg-emerald-400 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                            >
                                <span>{engineStatus === 'checking' ? 'Checking...' : 'Check Connection Again'}</span>
                                <span>🔄</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsSetupOpen(true)}
                                className="px-4 py-2 rounded-md bg-[#141414] hover:bg-[#1E1E1E] text-zinc-300 hover:text-white border border-[#262626] font-mono text-xs transition-colors cursor-pointer"
                            >
                                Custom Endpoint Settings
                            </button>

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
                            <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A] mb-5">
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
                                        placeholder="https://terminal.lunarcloud.in/votion-code"
                                        className="w-full bg-[#000000] border border-[#262626] rounded-md px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500 transition-colors"
                                    />
                                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-zinc-400">
                                        <span>Quick presets:</span>
                                        <button
                                            type="button"
                                            onClick={() => setTempEndpoint(`${window.location.origin}/votion-code`)}
                                            className="underline hover:text-white cursor-pointer"
                                        >
                                            /votion-code (Nginx Proxy)
                                        </button>
                                        <span>•</span>
                                        <button
                                            type="button"
                                            onClick={() => setTempEndpoint(nodeDirectUrl)}
                                            className="underline hover:text-white cursor-pointer"
                                        >
                                            Port :8443 (Direct Node IP)
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
                                                <span>Server UUID</span>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 mt-1 truncate">
                                                /projects/{server.uuid}
                                            </div>
                                        </button>

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
                                                /projects/{server.id}
                                            </div>
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 font-mono m-0">
                                        💡 Tip: If &quot;Workspace does not exist&quot; appears, select <strong className="text-emerald-400">All Disks Root</strong> to view all mounted server files directly in VS Code.
                                    </p>
                                </div>

                                {/* Active URL Preview */}
                                <div className="p-2.5 rounded bg-[#050505] border border-[#1A1A1A] text-[11px] font-mono text-zinc-400 flex items-center justify-between gap-2 overflow-hidden">
                                    <div className="truncate">
                                        Active URL:&nbsp;<code className="text-emerald-400">{targetUrl}</code>
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

                                {/* Diagnostics Box */}
                                <div className="p-3 rounded-lg bg-[#050505] border border-[#1F1F1F] space-y-2 text-xs font-mono">
                                    <div className="flex items-center justify-between">
                                        <span className="text-zinc-300 font-semibold">SSH Troubleshooting & Diagnostics:</span>
                                        <button
                                            type="button"
                                            onClick={copyDiagCommand}
                                            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] transition-colors cursor-pointer"
                                        >
                                            {copiedDiag ? '✓ Copied Diag Cmd' : 'Copy Diag Command'}
                                        </button>
                                    </div>
                                    <div className="text-[11px] text-zinc-400">
                                        Inspect container files via SSH:
                                        <code className="block bg-[#000000] p-1.5 rounded border border-[#1A1A1A] text-emerald-400 mt-1 select-all">
                                            docker exec votion-code ls -la /home/coder/projects
                                        </code>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-[11px] text-zinc-500">Update / Sync Sidecar:</span>
                                        <button
                                            type="button"
                                            onClick={copySetupScript}
                                            className="text-emerald-400 hover:underline text-[11px] cursor-pointer"
                                        >
                                            {copiedScript ? '✓ Copied Setup Script' : 'Copy 1-Click Update Script'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-[#1A1A1A] gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTempEndpoint(`${window.location.origin}/votion-code`);
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
