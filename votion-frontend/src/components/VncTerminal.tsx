import React, { useCallback, useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc';
import { API_ORIGIN } from '../services/apiClient';

interface VncTerminalProps {
  vmid: number;
  node: string;
  type: 'qemu' | 'lxc' | string;
  proxmoxConnectionId?: string | null;
}

type QualityPreset = 'performance' | 'balanced' | 'clarity';

const QUALITY_PRESETS: Record<QualityPreset, { label: string; quality: number; compression: number }> = {
  performance: { label: 'Performance', quality: 5, compression: 9 },
  balanced: { label: 'Balanced', quality: 6, compression: 6 },
  clarity: { label: 'Clarity', quality: 9, compression: 2 },
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest('input, textarea, select, button, [contenteditable="true"]'));
};

export const VncTerminal: React.FC<VncTerminalProps> = ({ vmid, node, type, proxmoxConnectionId }) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRfbRef = useRef<any>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualDisconnectRef = useRef(false);

  const [rfb, setRfb] = useState<any>(null);
  const [status, setStatus] = useState('Initializing VNC proxy…');
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [scaleViewport, setScaleViewport] = useState(true);
  const [clipViewport, setClipViewport] = useState(false);
  const [showDotCursor, setShowDotCursor] = useState(true);
  const [quality, setQuality] = useState<QualityPreset>('balanced');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCtrlAltDelConfirm, setShowCtrlAltDelConfirm] = useState(false);
  const [remoteClipboard, setRemoteClipboard] = useState('');
  const [clipboardMessage, setClipboardMessage] = useState<string | null>(null);

  const isConnected = status === 'Connected';

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const requestRetry = useCallback(() => {
    clearRetryTimer();
    manualDisconnectRef.current = false;
    setError(null);
    setStatus('Retrying console connection…');
    setRetryCount(0);
    setRetryKey(value => value + 1);
  }, [clearRetryTimer]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await shellRef.current?.requestFullscreen();
      }
    } catch {
      setClipboardMessage('Fullscreen is not available in this browser context.');
    }
  }, []);

  const disconnectSession = useCallback(() => {
    manualDisconnectRef.current = true;
    clearRetryTimer();
    activeRfbRef.current?.disconnect();
    activeRfbRef.current = null;
    setRfb(null);
    setError(null);
    setStatus('Disconnected');
  }, [clearRetryTimer]);

  const sendCtrlAltDel = useCallback(() => {
    if (activeRfbRef.current && isConnected) {
      activeRfbRef.current.sendCtrlAltDel();
    }
    setShowCtrlAltDelConfirm(false);
  }, [isConnected]);

  const requestCtrlAltDel = useCallback(() => {
    if (activeRfbRef.current && isConnected && !viewOnly) {
      setShowCtrlAltDelConfirm(true);
    }
  }, [isConnected, viewOnly]);

  const pasteClipboard = useCallback(async () => {
    if (!activeRfbRef.current || !isConnected) return;
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard access is unavailable');
      const text = await navigator.clipboard.readText();
      if (!text) {
        setClipboardMessage('The local clipboard is empty.');
        return;
      }
      activeRfbRef.current.clipboardPasteFrom(text);
      setClipboardMessage('Local clipboard pasted into the guest.');
    } catch {
      setClipboardMessage('Clipboard permission was unavailable. Use the browser permission prompt and try again.');
    }
  }, [isConnected]);

  const copyRemoteClipboard = useCallback(async () => {
    if (!remoteClipboard) return;
    try {
      await navigator.clipboard.writeText(remoteClipboard);
      setClipboardMessage('Guest clipboard copied locally.');
    } catch {
      setClipboardMessage('Browser permission prevented copying the guest clipboard.');
    }
  }, [remoteClipboard]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const current = activeRfbRef.current;
    if (!current) return;
    current.viewOnly = viewOnly;
    current.scaleViewport = scaleViewport;
    current.clipViewport = clipViewport;
    current.showDotCursor = showDotCursor;
    current.resizeSession = false;
  }, [viewOnly, scaleViewport, clipViewport, showDotCursor]);

  useEffect(() => {
    const current = activeRfbRef.current;
    if (!current) return;
    const preset = QUALITY_PRESETS[quality];
    current.qualityLevel = preset.quality;
    current.compressionLevel = preset.compression;
  }, [quality]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        void toggleFullscreen();
      }
      if (event.key === 'Escape' && document.fullscreenElement) {
        void document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFullscreen]);

  useEffect(() => {
    let disposed = false;
    let activeRfb: any = null;
    let attempt = 0;
    manualDisconnectRef.current = false;
    setError(null);
    setStatus('Initializing VNC proxy…');
    setRetryCount(0);
    setSessionStartedAt(null);
    clearRetryTimer();

    const scheduleRetry = (delayMs?: number) => {
      if (disposed || manualDisconnectRef.current) return;
      if (attempt >= 3) {
        setError('The console relay could not authenticate or reconnect after several attempts.');
        setStatus('Connection failed');
        return;
      }
      const nextAttempt = attempt + 1;
      attempt = nextAttempt;
      setRetryCount(nextAttempt);
      setStatus(`Reconnecting console… attempt ${nextAttempt} of 3`);
      clearRetryTimer();
      retryTimerRef.current = setTimeout(() => {
        void connect();
      }, delayMs || Math.min(1500 * nextAttempt, 6000));
    };

    const connect = async () => {
      try {
        setStatus(attempt === 0 ? 'Initializing VNC proxy…' : 'Connecting to console relay…');
        const apiHost = API_ORIGIN;
        const apiUrl = new URL(`${apiHost}/api/vnc/init`, window.location.origin);
        const sessionToken = localStorage.getItem('votion_jwt_token');
        const response = await fetch(apiUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify({ vmid, node, type, proxmoxConnectionId }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || `Console initialization failed (HTTP ${response.status})`);
        }

        const { ticket, password, port } = payload.data;
        // In Proxmox QEMU, the DES VNC password is up to 8 chars (or the portion before the colon in ticket)
        let vncPassword = password;
        if (!vncPassword && ticket) {
          const colonIdx = ticket.indexOf(':');
          vncPassword = colonIdx > 0 ? ticket.slice(0, colonIdx) : ticket;
        }
        if (vncPassword && vncPassword.length > 8 && !vncPassword.startsWith('PVEVNC:')) {
          vncPassword = vncPassword.slice(0, 8);
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsBase = new URL(apiHost || '/', window.location.origin);
        const wsPath = `${wsBase.pathname.replace(/\/$/, '')}/api/vnc/ws`;
        const wsUrl = `${wsProtocol}://${wsBase.host}${wsPath}?node=${encodeURIComponent(node)}&vmid=${vmid}&type=${type}&port=${port}&ticket=${encodeURIComponent(ticket)}${proxmoxConnectionId ? `&proxmoxConnectionId=${encodeURIComponent(proxmoxConnectionId)}` : ''}`;

        if (disposed || !containerRef.current) return;

        // Disconnect previous active instance before binding a new one
        if (activeRfbRef.current) {
          try { activeRfbRef.current.disconnect(); } catch {}
          activeRfbRef.current = null;
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        setStatus('Connecting to console relay…');
        activeRfb = new RFB(containerRef.current, wsUrl, {
          credentials: { password: vncPassword },
          wsProtocols: ['binary'],
        });
        activeRfb.viewOnly = viewOnly;
        activeRfb.scaleViewport = scaleViewport;
        activeRfb.clipViewport = clipViewport;
        activeRfb.resizeSession = false;
        activeRfb.showDotCursor = showDotCursor;
        activeRfb.qualityLevel = QUALITY_PRESETS[quality].quality;
        activeRfb.compressionLevel = QUALITY_PRESETS[quality].compression;
        activeRfbRef.current = activeRfb;

        activeRfb.addEventListener('connect', () => {
          if (disposed) return;
          attempt = 0;
          setRetryCount(0);
          setError(null);
          setStatus('Connected');
          setSessionStartedAt(Date.now());
        });
        activeRfb.addEventListener('disconnect', (event: any) => {
          if (disposed) return;
          const clean = Boolean(event?.detail?.clean);
          setStatus(clean || manualDisconnectRef.current ? 'Disconnected' : 'Disconnected unexpectedly');
          if (!clean && !manualDisconnectRef.current) {
            // Delay retry slightly to allow Proxmox QEMU VNC task to gracefully reset
            scheduleRetry(1200 * Math.max(1, attempt));
          }
        });
        activeRfb.addEventListener('credentialsrequired', () => {
          if (vncPassword) {
            activeRfb?.sendCredentials({ password: vncPassword });
          }
        });
        activeRfb.addEventListener('clipboard', (event: any) => {
          const text = String(event?.detail?.text || '');
          if (text) setRemoteClipboard(text);
        });
        setRfb(activeRfb);
      } catch (caught: any) {
        if (disposed) return;
        const message = caught?.message || 'Failed to initialize the VNC console.';
        if (attempt < 3) {
          setStatus(message);
          scheduleRetry(1500 * (attempt + 1));
        } else {
          setError(message);
          setStatus('Connection failed');
        }
      }
    };

    void connect();

    return () => {
      disposed = true;
      clearRetryTimer();
      manualDisconnectRef.current = true;
      try {
        activeRfb?.disconnect();
      } catch {
        // noVNC can throw while tearing down a half-open websocket; cleanup continues.
      }
      if (activeRfbRef.current === activeRfb) activeRfbRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [vmid, node, type, retryKey, clearRetryTimer]);

  const formattedStart = sessionStartedAt ? new Date(sessionStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  if (error) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center bg-[#fef2f2] text-[#991b1b] p-6 font-mono text-sm text-center border border-[#fecaca] rounded-xl">
        <span className="text-3xl mb-3">!</span>
        <span className="font-bold mb-2">VNC Connection Failed</span>
        <span className="text-[#991b1b]/80 text-xs max-w-md leading-relaxed">{error}</span>
        <button onClick={requestRetry} className="mt-5 bg-white border border-[#fca5a5] text-[#991b1b] px-4 py-2 rounded-md text-xs font-bold hover:bg-[#fff7f7] cursor-pointer">
          Retry console connection
        </button>
      </div>
    );
  }

  return (
      <div ref={shellRef} className="w-full h-full min-h-[340px] flex flex-col relative bg-[#1a1a1a] border border-[#333333] rounded-xl overflow-hidden">
        {showCtrlAltDelConfirm && (
          <div className="vnc-confirm-backdrop" role="presentation">
            <div className="vnc-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ctrl-alt-del-title" aria-describedby="ctrl-alt-del-description">
              <div className="vnc-confirm-eyebrow">Guest control</div>
              <h2 id="ctrl-alt-del-title">Send Ctrl+Alt+Del?</h2>
              <p id="ctrl-alt-del-description">Linux guests may interpret this command as a reboot, shutdown, or secure-attention request depending on their system configuration. Continue only if you intend to interrupt VM-{vmid}.</p>
              <div className="vnc-confirm-actions">
                <button type="button" className="vnc-confirm-cancel" onClick={() => setShowCtrlAltDelConfirm(false)}>Cancel</button>
                <button type="button" className="vnc-confirm-proceed" onClick={sendCtrlAltDel}>Send command</button>
              </div>
            </div>
          </div>
        )}
      <div className="vnc-console-header theme-vnc-toolbar">
        <div className="vnc-session-status" role="status" aria-live="polite">
          <span className={`vnc-status-indicator ${isConnected ? 'is-connected' : status.includes('failed') ? 'is-failed' : 'is-pending'}`} aria-hidden="true" />
          <span className="vnc-status-label">Console session</span>
          <span className="vnc-status-value">{status}</span>
        </div>
        <span className="vnc-session-context">VM-{vmid} · {type.toUpperCase()}</span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button onClick={requestCtrlAltDel} disabled={!isConnected || viewOnly} title="Send Ctrl+Alt+Del to the guest (may reboot or shut down Linux guests)" className="vnc-toolbar-button vnc-toolbar-button-danger" type="button">Ctrl+Alt+Del</button>
          <button onClick={pasteClipboard} disabled={!isConnected || viewOnly} title="Paste the local clipboard into the guest" className="vnc-toolbar-button" type="button">Paste</button>
          <button onClick={() => setShowShortcuts(value => !value)} title="Show keyboard shortcuts" className="vnc-toolbar-button" type="button">Shortcuts</button>
          <button onClick={() => void toggleFullscreen()} title="Toggle fullscreen (Ctrl+F)" className="vnc-toolbar-button" type="button">{isFullscreen ? 'Exit full screen' : 'Full screen'}</button>
          <button onClick={disconnectSession} disabled={!isConnected && status === 'Disconnected'} title="Close the current VNC session" className="vnc-toolbar-button vnc-toolbar-button-disconnect !text-[#991b1b]" type="button">Disconnect</button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 bg-[#242424] text-white border-b border-[#3b3b3b] px-3 py-1.5 text-[10px] font-mono shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={viewOnly} onChange={event => setViewOnly(event.target.checked)} /> View only</label>
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={scaleViewport} onChange={event => { setScaleViewport(event.target.checked); if (event.target.checked) setClipViewport(false); }} /> Fit</label>
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={clipViewport} onChange={event => { setClipViewport(event.target.checked); if (event.target.checked) setScaleViewport(false); }} /> 1:1 clip</label>
          <label className="hidden sm:flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showDotCursor} onChange={event => setShowDotCursor(event.target.checked)} /> Cursor</label>
        </div>
        <label className="flex items-center gap-1.5">Quality
          <select value={quality} onChange={event => setQuality(event.target.value as QualityPreset)} className="bg-[#242424] text-white border border-[#555] rounded px-1.5 py-0.5 cursor-pointer">
            {Object.entries(QUALITY_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
          </select>
        </label>
      </div>

      <div className="flex-1 min-h-0 relative bg-black overflow-hidden">
        <div ref={containerRef} className="w-full h-full bg-black relative cursor-crosshair overflow-hidden" aria-label={`VNC console for VM ${vmid}`} />
        {!isConnected && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#111111]/90 text-white font-mono text-xs text-center px-5">
            <div className="w-6 h-6 border-2 border-[#86efac] border-t-transparent rounded-full animate-spin mb-3" />
            <div>{status}</div>
            {retryCount > 0 && <div className="text-[#a7aaaa] mt-1">The session will retry automatically.</div>}
          </div>
        )}
      </div>

      {(showShortcuts || remoteClipboard || clipboardMessage) && (
        <div className="bg-[#fbfaf9] border-t border-[#dedfdf] px-3 sm:px-4 py-2.5 text-[10px] text-[#656b6b] flex flex-wrap items-center gap-x-4 gap-y-2">
          {showShortcuts && (
            <div className="flex items-center gap-2"><span className="font-bold text-[#1a1a1a]">Shortcuts</span><span><kbd className="vnc-kbd">Ctrl+F</kbd> fullscreen</span><span><kbd className="vnc-kbd">Esc</kbd> exit fullscreen</span><span><kbd className="vnc-kbd">Ctrl+Alt+Del</kbd> guest secure attention</span></div>
          )}
          {remoteClipboard && <button type="button" onClick={copyRemoteClipboard} className="text-[#2563eb] hover:underline cursor-pointer">Copy guest clipboard ({remoteClipboard.length} chars)</button>}
          {clipboardMessage && <span className="text-[#15803d]">{clipboardMessage}</span>}
        </div>
      )}

      <div className="bg-[#fbfaf9] border-t border-[#dedfdf] px-3 sm:px-4 py-1.5 flex items-center justify-between text-[10px] text-[#656b6b] font-mono shrink-0">
        <span>Session started {formattedStart} · {viewOnly ? 'read-only' : 'interactive'} · {QUALITY_PRESETS[quality].label.toLowerCase()} stream</span>
        <button type="button" onClick={requestRetry} disabled={isConnected} className="text-[#2563eb] hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer">Reconnect</button>
      </div>
    </div>
  );
};
