@extends('layouts.admin')

@section('title')
    Host SSH Terminal
@endsection

@section('content-header')
    <h1>Host SSH Terminal
        <small>Direct interactive operating system shell on node {{ $node ? $node->name : 'N/A' }}.</small>
    </h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">SSH Shell</li>
    </ol>
@endsection

@section('content')
<div class="votion-ssh-dashboard">
    <div class="box box-solid ssh-box">
        {{-- Top Context Bar --}}
        <div class="ssh-toolbar">
            <div class="ssh-toolbar-left">
                <div class="ssh-status-pill" id="sshStatusPill">
                    <span class="ssh-status-dot" id="sshStatusDot"></span>
                    <span class="ssh-status-text font-mono" id="sshStatusText">Connecting...</span>
                </div>

                @if($node)
                <div class="ssh-node-chip">
                    <span class="ssh-chip-label">NODE</span>
                    <span class="ssh-chip-val font-mono">{{ $node->name }}</span>
                    <span class="ssh-chip-sep">•</span>
                    <span class="ssh-chip-host font-mono">{{ $node->fqdn }}</span>
                </div>
                @endif

                @if(count($nodes) > 1)
                <div class="ssh-node-selector">
                    <select id="nodeSelect" onchange="window.location.href = '{{ route('admin.ssh') }}?node_id=' + this.value;">
                        @foreach($nodes as $n)
                        <option value="{{ $n->id }}" {{ $node && $node->id === $n->id ? 'selected' : '' }}>
                            {{ $n->name }} ({{ $n->fqdn }})
                        </option>
                        @endforeach
                    </select>
                </div>
                @endif
            </div>

            <div class="ssh-toolbar-right">
                <div class="ssh-security-notice">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span>Logged Out Session (Authenticate with User/Password)</span>
                </div>
                <button type="button" class="btn btn-default btn-sm ssh-btn" onclick="clearTerminal()" title="Clear terminal screen">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>Clear</span>
                </button>
                <button type="button" class="btn btn-default btn-sm ssh-btn" onclick="reconnectTerminal()" title="Reconnect SSH session">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    <span>Reconnect</span>
                </button>
                <button type="button" class="btn btn-default btn-sm ssh-btn" onclick="toggleFullscreen()" title="Toggle Fullscreen">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="fullscreenIcon">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                    </svg>
                    <span id="fullscreenText">Fullscreen</span>
                </button>
            </div>
        </div>

        {{-- Terminal Outer Wrapper --}}
        <div class="ssh-terminal-wrapper" id="sshTerminalCard">
            <div id="terminal" class="ssh-terminal-body"></div>
        </div>
    </div>
</div>

<link rel="stylesheet" href="/vendor/xterm/xterm.css" onerror="this.onerror=null;this.href='https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css';">

<style>
.votion-ssh-dashboard {
    margin-top: 6px;
    font-family: var(--font-sans, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
}

.ssh-box {
    background-color: #0c0c0e !important;
    border: 1px solid #27272a !important;
    border-radius: 12px !important;
    overflow: hidden !important;
    box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.6) !important;
    margin-bottom: 24px !important;
}

.ssh-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0c0c0e;
    border-bottom: 1px solid #27272a;
    padding: 10px 16px;
    gap: 12px;
    flex-wrap: wrap;
}

.ssh-toolbar-left, .ssh-toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.ssh-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 9999px;
    background: #18181b;
    border: 1px solid #27272a;
    font-size: 11px;
    font-weight: 500;
    color: #a1a1aa;
    transition: all 0.2s ease;
}

.ssh-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f59e0b;
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
    transition: all 0.2s ease;
}

.ssh-status-pill.connected {
    background: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.25);
    color: #10b981;
}

.ssh-status-pill.connected .ssh-status-dot {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.ssh-status-pill.connected .ssh-status-text {
    color: #10b981;
}

.ssh-status-pill.disconnected {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.25);
    color: #ef4444;
}

.ssh-status-pill.disconnected .ssh-status-dot {
    background: #ef4444;
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
}

.ssh-status-pill.disconnected .ssh-status-text {
    color: #ef4444;
}

.ssh-node-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #18181b;
    border: 1px solid #27272a;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    color: #a1a1aa;
}

.ssh-chip-label {
    color: #71717a;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
}

.ssh-chip-val {
    color: #fafafa;
    font-weight: 500;
}

.ssh-chip-sep {
    color: #3f3f46;
}

.ssh-chip-host {
    color: #a1a1aa;
}

.ssh-node-selector select {
    background: #18181b;
    border: 1px solid #27272a;
    color: #fafafa;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11.5px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease;
}

.ssh-node-selector select:hover {
    border-color: #3f3f46;
}

.ssh-security-notice {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #d97706;
    font-size: 11px;
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.18);
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 500;
}

.ssh-btn {
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    background-color: #18181b !important;
    border: 1px solid #27272a !important;
    color: #e4e4e7 !important;
    padding: 4px 10px !important;
    border-radius: 6px !important;
    font-size: 11.5px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: all 140ms ease !important;
}

.ssh-btn:hover {
    background-color: #27272a !important;
    border-color: #3f3f46 !important;
    color: #ffffff !important;
}

.ssh-terminal-wrapper {
    background: #000000;
    padding: 12px 16px;
    min-height: 580px;
    position: relative;
}

.ssh-terminal-body {
    width: 100%;
    height: 580px;
}

.xterm {
    padding: 2px;
}

.xterm .xterm-viewport {
    background-color: #000000 !important;
    scrollbar-width: thin;
    scrollbar-color: #27272a #000000;
}

.xterm .xterm-viewport::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.xterm .xterm-viewport::-webkit-scrollbar-thumb {
    background: #27272a;
    border-radius: 3px;
}

.xterm .xterm-viewport::-webkit-scrollbar-thumb:hover {
    background: #3f3f46;
}

.xterm .xterm-viewport::-webkit-scrollbar-track {
    background: #000000;
}

/* Fullscreen mode */
.ssh-terminal-wrapper.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99999;
    border-radius: 0;
    border: none;
    padding: 16px;
    box-sizing: border-box;
}

.ssh-terminal-wrapper.fullscreen .ssh-terminal-body {
    height: 100%;
}
</style>
@endsection

@section('footer-scripts')
@parent
<script src="/vendor/xterm/xterm.js" onerror="this.onerror=null;this.href='https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js';"></script>
<script src="/vendor/xterm/xterm-addon-fit.js" onerror="this.onerror=null;this.href='https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js';"></script>

<script>
let term;
let fitAddon;
let socket;
const wsUrl = @json($wsUrl);

function initTerminal() {
    if (!window.Terminal) {
        setTimeout(initTerminal, 100);
        return;
    }

    term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontFamily: '"JetBrains Mono", "Roboto Mono", Menlo, Monaco, Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.35,
        theme: {
            background: '#000000',
            foreground: '#E5E7EB',
            cursor: '#FFFFFF',
            cursorAccent: '#000000',
            selectionBackground: 'rgba(255, 255, 255, 0.2)',
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
        }
    });

    if (window.FitAddon) {
        fitAddon = new (window.FitAddon.FitAddon || window.FitAddon)();
        term.loadAddon(fitAddon);
    }

    const container = document.getElementById('terminal');
    term.open(container);

    if (fitAddon) {
        setTimeout(() => fitAddon.fit(), 50);
    }

    term.onData(data => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(data);
        }
    });

    window.addEventListener('resize', () => {
        if (fitAddon) {
            fitAddon.fit();
            sendResize();
        }
    });

    connectWebSocket();
}

function sendResize() {
    if (socket && socket.readyState === WebSocket.OPEN && term) {
        socket.send(JSON.stringify({
            event: 'resize',
            cols: term.cols,
            rows: term.rows
        }));
    }
}

function updateStatus(status, text) {
    const pill = document.getElementById('sshStatusPill');
    const label = document.getElementById('sshStatusText');
    if (!pill || !label) return;

    pill.className = 'ssh-status-pill ' + status;
    label.innerText = text;
}

function connectWebSocket() {
    if (!wsUrl) {
        updateStatus('disconnected', 'No Node WS URL');
        term.writeln('\x1b[31;1m[Configuration Error: Node daemon WebSocket URL is unavailable]\x1b[0m');
        return;
    }

    updateStatus('', 'Connecting...');

    try {
        socket = new WebSocket(wsUrl);
        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
            updateStatus('connected', 'Connected');
            sendResize();
        };

        socket.onmessage = (event) => {
            if (typeof event.data === 'string') {
                term.write(event.data);
            } else if (event.data instanceof ArrayBuffer) {
                term.write(new Uint8Array(event.data));
            }
        };

        socket.onclose = () => {
            updateStatus('disconnected', 'Disconnected');
            term.writeln('\r\n\x1b[33;1m[Session terminated. Click "Reconnect" or reload page to open a new SSH shell]\x1b[0m\r\n');
        };

        socket.onerror = (err) => {
            console.error('SSH WebSocket Error:', err);
            updateStatus('disconnected', 'Connection Error');
        };
    } catch (e) {
        updateStatus('disconnected', 'Error');
        term.writeln('\r\n\x1b[31;1m[Failed to establish WebSocket: ' + e.message + ']\x1b[0m\r\n');
    }
}

function clearTerminal() {
    if (term) {
        term.clear();
    }
}

function reconnectTerminal() {
    if (socket) {
        socket.close();
    }
    if (term) {
        term.reset();
    }
    connectWebSocket();
}

function toggleFullscreen() {
    const card = document.getElementById('sshTerminalCard');
    const icon = document.getElementById('fullscreenIcon');
    const label = document.getElementById('fullscreenText');
    if (!card) return;

    const isFullscreen = card.classList.toggle('fullscreen');

    if (isFullscreen) {
        label.innerText = 'Exit Fullscreen';
        icon.innerHTML = '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>';
    } else {
        label.innerText = 'Fullscreen';
        icon.innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>';
    }

    setTimeout(() => {
        if (fitAddon) {
            fitAddon.fit();
            sendResize();
        }
    }, 100);
}

document.addEventListener('DOMContentLoaded', initTerminal);
</script>
@endsection
