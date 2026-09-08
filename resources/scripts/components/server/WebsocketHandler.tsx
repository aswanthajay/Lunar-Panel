import React, { useEffect, useState } from 'react';
import { Websocket } from '@/plugins/Websocket';
import { ServerContext } from '@/state/server';
import getWebsocketToken from '@/api/server/getWebsocketToken';
import { CSSTransition } from 'react-transition-group';

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

    const connect = (uuid: string) => {
        const socket = new Websocket();

        socket.on('auth success', () => {
            setConnectionState(true);
            setError('');
            setShowErrorBanner(false);
        });

        socket.on('SOCKET_CLOSE', () => {
            setConnectionState(false);
        });

        socket.on('SOCKET_ERROR', () => {
            setError('connecting');
            setConnectionState(false);
        });

        socket.on('status', (status) => setServerStatus(status));

        socket.on('daemon error', (message) => {
            console.warn('Got error message from daemon socket:', message);
        });

        socket.on('token expiring', () => updateToken(uuid, socket));
        socket.on('token expired', () => updateToken(uuid, socket));
        socket.on('jwt error', (error: string) => {
            setConnectionState(false);
            console.warn('JWT validation error from wings:', error);

            if (reconnectErrors.find((v) => error.toLowerCase().indexOf(v) >= 0)) {
                updateToken(uuid, socket);
            } else {
                setError(
                    'There was an error validating the credentials provided for the websocket. Please refresh the page.'
                );
            }
        });

        socket.on('transfer status', (status: string) => {
            if (status === 'starting' || status === 'success') {
                return;
            }

            // Force a reconnection to the websocket
            socket.close();
            setError('connecting');
            setConnectionState(false);
            setInstance(null);
            connect(uuid);
        });

        getWebsocketToken(uuid)
            .then((data) => {
                socket.setToken(data.token).connect(data.socket);
                setInstance(socket);
            })
            .catch((error) => console.error(error));
    };

    // 1. Tab visibility listener: don't show error while user is in another tab
    useEffect(() => {
        const handleVisibilityChange = () => {
            const visible = !document.hidden;
            setIsTabVisible(visible);

            if (visible) {
                // When returning to tab, attempt immediate reconnection if disconnected
                if (instance && !connected) {
                    try {
                        instance.reconnect();
                    } catch (e) {
                        console.warn('Failed to trigger websocket reconnect on tab focus:', e);
                    }
                }
            } else {
                // User switched to another tab: suppress error banner immediately
                setShowErrorBanner(false);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [instance, connected]);

    // 2. 10-Second Delay Timer: only show if disconnected for 10+ seconds while active in tab
    useEffect(() => {
        // If connected or tab is hidden, hide banner and clear timers
        if (connected || !isTabVisible) {
            setShowErrorBanner(false);
            if (connected) {
                setError('');
            }
            return;
        }

        // Only show banner after 10 continuous seconds of disconnection in an active tab
        const timer = setTimeout(() => {
            if (!document.hidden) {
                setShowErrorBanner(true);
            }
        }, 10000);

        return () => clearTimeout(timer);
    }, [connected, error, isTabVisible]);

    useEffect(() => {
        return () => {
            instance && instance.close();
        };
    }, [instance]);

    useEffect(() => {
        if (instance || !uuid) {
            return;
        }

        connect(uuid);
    }, [uuid]);

    const handleManualRetry = () => {
        if (instance) {
            try {
                instance.close();
            } catch {}
        }
        setConnectionState(false);
        setInstance(null);
        if (uuid) {
            connect(uuid);
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
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Reconnect</span>
                        </button>
                    </div>
                </div>
            </div>
        </CSSTransition>
    );
};

