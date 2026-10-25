import React, { useEffect, useState } from 'react';
import { Websocket } from '@/plugins/Websocket';
import { ServerContext } from '@/state/server';
import getWebsocketToken from '@/api/server/getWebsocketToken';
import { CSSTransition } from 'react-transition-group';
import { PulseLoader } from '@/components/elements/Spinner';

const reconnectErrors = ['jwt: exp claim is invalid', 'jwt: created too far in past (denylist)'];

export default () => {
    let updatingToken = false;
    const [error, setError] = useState<'connecting' | string>('');
    const [isTabVisible, setIsTabVisible] = useState<boolean>(() => (typeof document !== 'undefined' ? !document.hidden : true));
    const [showErrorBanner, setShowErrorBanner] = useState(false);

    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const setServerStatus = ServerContext.useStoreActions((actions) => actions.status.setServerStatus);
    const { setInstance, setConnectionState } = ServerContext.useStoreActions((actions) => actions.socket);

    const updateToken = (uuid: string, socket: Websocket) => {
        if (updatingToken) return;

        updatingToken = true;
        getWebsocketToken(uuid)
            .then((data) => socket.setToken(data.token, true))
            .catch((error) => console.error(error))
            .then(() => {
                updatingToken = false;
            });
    };

    // 1. Tab visibility listener: don't show error while user is in another tab
    useEffect(() => {
        const handleVisibilityChange = () => {
            const visible = !document.hidden;
            setIsTabVisible(visible);

            if (visible) {
                if (instance && !connected) {
                    try {
                        instance.reconnect();
                    } catch (e) {
                        console.warn('Failed to trigger websocket reconnect on tab focus:', e);
                    }
                }
            } else {
                setShowErrorBanner(false);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [instance, connected]);

    // 2. 10-Second Delay Timer: only show if disconnected for 10+ seconds while active in tab
    useEffect(() => {
        if (connected || !isTabVisible) {
            setShowErrorBanner(false);
            if (connected) {
                setError('');
            }
            return;
        }

        const timer = setTimeout(() => {
            if (!document.hidden) {
                setShowErrorBanner(true);
            }
        }, 10000);

        return () => clearTimeout(timer);
    }, [connected, error, isTabVisible]);

    // 3. Strict Per-Server Lifecycle Management (guarantees NO cross-server socket leakage)
    useEffect(() => {
        if (!uuid) {
            return;
        }

        let isCancelled = false;
        let activeSocket: Websocket | null = null;

        // If an old instance is lingering from another server, terminate it immediately
        if (instance) {
            try {
                instance.removeAllListeners();
                instance.close();
            } catch {}
            setInstance(null);
            setConnectionState(false);
        }

        const socket = new Websocket();
        activeSocket = socket;

        socket.on('auth success', () => {
            if (isCancelled) return;
            setConnectionState(true);
            setError('');
            setShowErrorBanner(false);
        });

        socket.on('SOCKET_CLOSE', () => {
            if (isCancelled) return;
            setConnectionState(false);
        });

        socket.on('SOCKET_ERROR', () => {
            if (isCancelled) return;
            setError('connecting');
            setConnectionState(false);
        });

        socket.on('status', (status) => {
            if (isCancelled) return;
            setServerStatus(status);
        });

        socket.on('daemon error', (message) => {
            console.warn('Got error message from daemon socket:', message);
        });

        socket.on('token expiring', () => updateToken(uuid, socket));
        socket.on('token expired', () => updateToken(uuid, socket));
        socket.on('jwt error', (err: string) => {
            if (isCancelled) return;
            setConnectionState(false);
            console.warn('JWT validation error from wings:', err);

            if (reconnectErrors.find((v) => err.toLowerCase().indexOf(v) >= 0)) {
                updateToken(uuid, socket);
            } else {
                setError(
                    'There was an error validating the credentials provided for the websocket. Please refresh the page.'
                );
            }
        });

        socket.on('transfer status', (status: string) => {
            if (isCancelled || status === 'starting' || status === 'success') {
                return;
            }

            socket.close();
            setError('connecting');
            setConnectionState(false);
            setInstance(null);
        });

        getWebsocketToken(uuid)
            .then((data) => {
                if (isCancelled) {
                    try {
                        socket.removeAllListeners();
                        socket.close();
                    } catch {}
                    return;
                }
                socket.setToken(data.token).connect(data.socket);
                setInstance(socket);
            })
            .catch((err) => {
                if (!isCancelled) {
                    console.error(err);
                }
            });

        return () => {
            isCancelled = true;
            if (activeSocket) {
                try {
                    activeSocket.removeAllListeners();
                    activeSocket.close();
                } catch {}
            }
            setConnectionState(false);
            setInstance(null);
        };
    }, [uuid]);

    const handleManualRetry = () => {
        if (instance) {
            try {
                instance.removeAllListeners();
                instance.close();
            } catch {}
        }
        setConnectionState(false);
        setInstance(null);
        if (uuid) {
            const socket = new Websocket();
            getWebsocketToken(uuid)
                .then((data) => {
                    socket.setToken(data.token).connect(data.socket);
                    setInstance(socket);
                })
                .catch((e) => console.error(e));
        }
    };

    return (
        <CSSTransition timeout={200} in={showErrorBanner && isTabVisible} appear unmountOnExit classNames={'fade'}>
            <div className="w-full mb-3">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-[#140A0B] border border-[#7F1D1D]/50 text-xs shadow-lg">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                        </span>
                        <span className="text-[#F1F1F1] text-xs font-sans">
                            {error && error !== 'connecting'
                                ? error
                                : "Trouble maintaining connection to server daemon, attempting to reconnect..."}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleManualRetry}
                            className="px-2.5 py-1 rounded bg-[#2A1215] hover:bg-[#3D1A1E] text-rose-300 hover:text-white border border-[#7F1D1D]/60 text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                            <PulseLoader size="small" />
                            <span>Reconnect</span>
                        </button>
                    </div>
                </div>
            </div>
        </CSSTransition>
    );
};
