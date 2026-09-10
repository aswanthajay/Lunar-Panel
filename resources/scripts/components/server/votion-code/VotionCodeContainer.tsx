import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ServerContext } from '@/state/server';
import { PulseLoader } from '@/components/elements/Spinner';
import { AppSwitcher } from '@/components/votion/AppSwitcher';
import { SocketEvent, SocketRequest } from '@/components/server/events';

const VotionCodeContainer: React.FC = () => {
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);

    // Clean up any legacy full-mode localStorage keys
    useEffect(() => {
        localStorage.removeItem('votion_code_folder_mode_v2');
        localStorage.removeItem('votion_code_endpoint_url');
        localStorage.removeItem(`votion_code_mode_${server.uuid}`);
    }, [server.uuid]);

    const targetUrl = useMemo(() => {
        const cleanUuid = (server.uuid || '').toLowerCase();
        const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
        return `/votion-code-lite/?server=${cleanUuid}&v=2.9${csrf ? `&csrf=${encodeURIComponent(csrf)}` : ''}`;
    }, [server.uuid]);

    const [isIframeLoading, setIsIframeLoading] = useState<boolean>(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);

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

    // Rolling history cache of captured console and system output for Votion Code terminal
    const logHistoryRef = useRef<Array<{ data: string; kind: string }>>([]);

    const postToIframe = useCallback((payload: any) => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(payload, '*');
        }
    }, []);

    const instanceRef = useRef(instance);
    const connectedRef = useRef(connected);
    useEffect(() => {
        instanceRef.current = instance;
    }, [instance]);
    useEffect(() => {
        connectedRef.current = connected;
    }, [connected]);

    // Listen for child iframe commands and log requests across the full component lifecycle
    useEffect(() => {
        const handleChildMessage = (e: MessageEvent) => {
            if (!e.data || typeof e.data !== 'object') return;

            if (e.data.type === 'VOTION_SEND_COMMAND' && typeof e.data.command === 'string') {
                if (instanceRef.current) {
                    instanceRef.current.send('send command', e.data.command);
                }
            } else if (e.data.type === 'VOTION_REQUEST_LOGS' || e.data.type === 'VOTION_READY') {
                // Replay all buffered logs immediately to iframe
                if (logHistoryRef.current.length > 0) {
                    postToIframe({
                        type: 'VOTION_SERVER_LOG_BATCH',
                        logs: logHistoryRef.current,
                        status: server.status || undefined,
                    });
                }
                // Request live backlog from daemon socket
                if (connectedRef.current && instanceRef.current) {
                    instanceRef.current.send(SocketRequest.SEND_LOGS);
                }
            }
        };

        window.addEventListener('message', handleChildMessage);
        return () => {
            window.removeEventListener('message', handleChildMessage);
        };
    }, [postToIframe, server.status]);

    // Bridge server socket output and commands to/from the embedded VS Code terminal
    useEffect(() => {
        if (!instance) return;

        const listeners: Record<string, (line: string) => void> = {
            [SocketEvent.STATUS]: (s: string) => {
                const entry = { data: `Instance transitioned to ${s}`, kind: 'system' };
                logHistoryRef.current.push(entry);
                if (logHistoryRef.current.length > 1000) logHistoryRef.current.shift();
                postToIframe({ type: 'VOTION_SERVER_STATUS', status: s });
            },
            [SocketEvent.CONSOLE_OUTPUT]: (line: string) => {
                const entry = { data: line, kind: 'output' };
                logHistoryRef.current.push(entry);
                if (logHistoryRef.current.length > 1000) logHistoryRef.current.shift();
                postToIframe({ type: 'VOTION_SERVER_LOG', data: line, kind: 'output' });
            },
            [SocketEvent.INSTALL_OUTPUT]: (line: string) => {
                const entry = { data: line, kind: 'install' };
                logHistoryRef.current.push(entry);
                if (logHistoryRef.current.length > 1000) logHistoryRef.current.shift();
                postToIframe({ type: 'VOTION_SERVER_LOG', data: line, kind: 'install' });
            },
            [SocketEvent.TRANSFER_LOGS]: (line: string) => {
                const entry = { data: line, kind: 'transfer' };
                logHistoryRef.current.push(entry);
                if (logHistoryRef.current.length > 1000) logHistoryRef.current.shift();
                postToIframe({ type: 'VOTION_SERVER_LOG', data: line, kind: 'transfer' });
            },
            [SocketEvent.TRANSFER_STATUS]: (line: string) => {
                const entry = { data: line || 'Transfer status update', kind: 'transfer' };
                logHistoryRef.current.push(entry);
                if (logHistoryRef.current.length > 1000) logHistoryRef.current.shift();
                postToIframe({ type: 'VOTION_SERVER_LOG', data: line || 'Transfer status update', kind: 'transfer' });
            },
            [SocketEvent.DAEMON_MESSAGE]: (line: string) => {
                const entry = { data: line, kind: 'daemon' };
                logHistoryRef.current.push(entry);
                if (logHistoryRef.current.length > 1000) logHistoryRef.current.shift();
                postToIframe({ type: 'VOTION_SERVER_LOG', data: line, kind: 'daemon' });
            },
            [SocketEvent.DAEMON_ERROR]: (line: string) => {
                const entry = { data: line, kind: 'error' };
                logHistoryRef.current.push(entry);
                if (logHistoryRef.current.length > 1000) logHistoryRef.current.shift();
                postToIframe({ type: 'VOTION_SERVER_LOG', data: line, kind: 'error' });
            },
        };

        Object.keys(listeners).forEach((key) => {
            instance.addListener(key, listeners[key]);
        });

        // Request historical backlog logs as soon as websocket is connected
        if (connected) {
            instance.send(SocketRequest.SEND_LOGS);
        }

        return () => {
            Object.keys(listeners).forEach((key) => {
                instance.removeListener(key, listeners[key]);
            });
        };
    }, [instance, connected, postToIframe]);

    return (
        <div className="w-screen h-screen flex flex-col bg-[#0a0a0a] text-[#ededed] font-sans select-none overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            {/* 1. Authentic Votion One Platform Header */}
            <AppSwitcher />

            {/* 2. MAIN BODY */}
            <main className="flex-1 relative min-h-0">
                <iframe
                    ref={iframeRef}
                    src={targetUrl}
                    title="Votion Code - Cloud Studio"
                    onLoad={() => {
                        setTimeout(() => {
                            setIsIframeLoading(false);
                        }, 500);
                        if (server.status) {
                            postToIframe({ type: 'VOTION_SERVER_STATUS', status: server.status });
                        }
                        if (logHistoryRef.current.length > 0) {
                            postToIframe({
                                type: 'VOTION_SERVER_LOG_BATCH',
                                logs: logHistoryRef.current,
                                status: server.status || undefined,
                            });
                        }
                        if (connected && instance) {
                            instance.send(SocketRequest.SEND_LOGS);
                        }
                    }}
                    style={{ backgroundColor: '#181818', colorScheme: 'dark' } as any}
                    className={`w-full h-full border-0 bg-[#181818] dark transition-opacity duration-500 ${
                        isIframeLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                    allow="clipboard-read; clipboard-write; fullscreen; camera; microphone; payment; usb; display-capture"
                />

                {/* Dark Loading Screen */}
                {isIframeLoading && (
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
                            <span>Loading Votion Code...</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono m-0">
                            Mounting server workspace via REST API
                        </p>

                        <div className="w-48 h-1 bg-[#141414] rounded-full overflow-hidden mt-4">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-pulse w-3/4" />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default VotionCodeContainer;
