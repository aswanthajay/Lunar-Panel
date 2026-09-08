import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { PowerAction } from '@/components/server/console/ServerConsoleContainer';
import Can from '@/components/elements/Can';

const STORAGE_KEY = 'votion_code_endpoint_url';

const VotionCodeContainer: React.FC = () => {
    const history = useHistory();
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const status = ServerContext.useStoreState((state) => state.status.value) || 'offline';
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

    // Determine default connection endpoint
    const defaultEndpoint = useMemo(() => {
        // If the server has an allocation on 8080, 8443, etc. (standalone egg server)
        const dedicatedAlloc = server.allocations?.find((a) => a.port === 8080 || a.port === 8443);
        if (dedicatedAlloc) {
            const host = dedicatedAlloc.alias || dedicatedAlloc.ip;
            return `http://${host}:${dedicatedAlloc.port}`;
        }

        // Check local storage override
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return saved;
        }

        // Default to node/host sidecar on port 8443 or relative /votion-code
        if (window.location.port) {
            return `${window.location.protocol}//${window.location.hostname}:8443`;
        }
        return `${window.location.origin}/votion-code`;
    }, [server.allocations]);

    const [endpoint, setEndpoint] = useState<string>(defaultEndpoint);
    const [tempEndpoint, setTempEndpoint] = useState<string>(defaultEndpoint);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [iframeKey, setIframeKey] = useState(1);
    const [copied, setCopied] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Compute the full iframe URL with the workspace folder
    const targetUrl = useMemo(() => {
        const cleanBase = endpoint.replace(/\/+$/, '');
        // If the base contains a port matching the dedicated allocation, default to /home/container
        const dedicatedAlloc = server.allocations?.find((a) => a.port === 8080 || a.port === 8443);
        if (dedicatedAlloc && cleanBase.includes(String(dedicatedAlloc.port))) {
            return `${cleanBase}/?folder=/home/container`;
        }
        // Universal sidecar mode mounts all pterodactyl volumes under /home/coder/projects
        return `${cleanBase}/?folder=/home/coder/projects/${server.uuid}`;
    }, [endpoint, server.allocations, server.uuid]);

    const handleSaveEndpoint = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = tempEndpoint.trim().replace(/\/+$/, '');
        if (trimmed) {
            setEndpoint(trimmed);
            localStorage.setItem(STORAGE_KEY, trimmed);
            setIsConfigOpen(false);
            setIframeKey((prev) => prev + 1);
        }
    };

    const handleResetDefault = () => {
        const resetVal = `${window.location.protocol}//${window.location.hostname}:8443`;
        setTempEndpoint(resetVal);
        setEndpoint(resetVal);
        localStorage.setItem(STORAGE_KEY, resetVal);
        setIsConfigOpen(false);
        setIframeKey((prev) => prev + 1);
    };

    // Power Actions
    const handlePowerAction = (action: PowerAction) => {
        if (instance) {
            instance.send('set state', action);
        }
    };

    const copyDockerCommand = () => {
        const cmd = `docker run -d --name votion-code --restart always -p 8443:8080 -v /var/lib/pterodactyl/volumes:/home/coder/projects codercom/code-server:latest --auth none --disable-telemetry --app-name "Votion Code"`;
        navigator.clipboard.writeText(cmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                    {/* Status Indicator Pill */}
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

                    {/* Server Start / Restart / Stop Controls */}
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
                    {/* Reload Frame */}
                    <button
                        type="button"
                        onClick={() => setIframeKey((prev) => prev + 1)}
                        className="px-2 py-1 rounded-md text-xs text-zinc-400 hover:text-white bg-[#0A0A0A] hover:bg-[#141414] border border-[#1A1A1A] transition-colors cursor-pointer"
                        title="Reload VS Code Frame"
                    >
                        🔄
                    </button>

                    {/* Endpoint Configuration / Setup */}
                    <button
                        type="button"
                        onClick={() => setIsConfigOpen(true)}
                        className="px-2.5 py-1 rounded-md text-xs font-mono text-zinc-300 hover:text-white bg-[#0A0A0A] hover:bg-[#141414] border border-[#1A1A1A] hover:border-zinc-600 transition-colors cursor-pointer flex items-center gap-1"
                        title="Configure Votion Code Engine Endpoint"
                    >
                        <span>⚙</span>
                        <span className="hidden md:inline">Endpoint</span>
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

            {/* 2. MAIN BODY: GENUINE CODER/CODE-SERVER IFRAME */}
            <main className="flex-1 w-full h-full relative bg-[#000000] overflow-hidden">
                <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    src={targetUrl}
                    title="Votion Code - VS Code Cloud Studio"
                    className="w-full h-full border-0 bg-[#000000]"
                    allow="clipboard-read; clipboard-write; fullscreen; camera; microphone; payment; usb; display-capture"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                />
            </main>

            {/* 3. CONNECTION & ENDPOINT MODAL */}
            {isConfigOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-[#0A0A0A] border border-[#222222] rounded-xl shadow-2xl p-6 font-sans select-text">
                        <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A] mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] font-mono text-xs">
                                    &lt;/&gt;
                                </div>
                                <h3 className="font-semibold text-white text-sm m-0">
                                    Votion Code Engine Settings
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsConfigOpen(false)}
                                className="text-zinc-500 hover:text-white text-sm p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEndpoint} className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono text-zinc-400 mb-1.5">
                                    Code-Server Base URL / Reverse Proxy:
                                </label>
                                <input
                                    type="text"
                                    value={tempEndpoint}
                                    onChange={(e) => setTempEndpoint(e.target.value)}
                                    placeholder="http://your-node-ip:8443 or /votion-code"
                                    className="w-full bg-[#000000] border border-[#262626] rounded-md px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500 transition-colors"
                                />
                                <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                                    Target workspace: <code className="text-emerald-400">{targetUrl}</code>
                                </p>
                            </div>

                            {/* One-Click VPS Sidecar Command */}
                            <div className="bg-[#050505] border border-[#1A1A1A] rounded-lg p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono font-semibold text-zinc-300">
                                        VPS Setup Command (coder/code-server):
                                    </span>
                                    <button
                                        type="button"
                                        onClick={copyDockerCommand}
                                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                    >
                                        {copied ? '✓ Copied!' : 'Copy Docker Command'}
                                    </button>
                                </div>
                                <div className="text-[11px] font-mono text-zinc-400 bg-[#000000] p-2 rounded border border-[#141414] overflow-x-auto">
                                    <code>
                                        docker run -d --name votion-code --restart always -p 8443:8080 -v /var/lib/pterodactyl/volumes:/home/coder/projects codercom/code-server:latest --auth none --disable-telemetry --app-name "Votion Code"
                                    </code>
                                </div>
                                <p className="text-[10px] text-zinc-500 font-mono">
                                    Running this command on your node mounts all server volumes directly into code-server for 1-click editing without file transfers.
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-[#1A1A1A]">
                                <button
                                    type="button"
                                    onClick={handleResetDefault}
                                    className="text-xs font-mono text-zinc-500 hover:text-zinc-300"
                                >
                                    Reset to Default
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsConfigOpen(false)}
                                        className="px-3 py-1.5 rounded-md text-xs font-mono text-zinc-400 hover:text-white bg-[#141414] border border-[#222222]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 rounded-md text-xs font-mono font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
                                    >
                                        Save & Connect
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VotionCodeContainer;
