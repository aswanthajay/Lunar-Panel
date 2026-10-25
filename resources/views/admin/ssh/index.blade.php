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
    {{-- Top Context Bar --}}
    <div class="ssh-toolbar">
        <div class="ssh-toolbar-left">
            <div class="ssh-status-pill" id="sshStatusPill">
                <span class="ssh-status-dot" id="sshStatusDot"></span>
                <span class="ssh-status-text" id="sshStatusText">Connecting...</span>
            </div>

            @if($node)
            <div class="ssh-node-chip">
                <span class="ssh-chip-label">NODE:</span>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Logged Out Session (Authenticate with User/Password)</span>
            </div>
            <button type="button" class="ssh-btn" onclick="clearTerminal()" title="Clear terminal screen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Clear</span>
            </button>
            <button type="button" class="ssh-btn" onclick="reconnectTerminal()" title="Reconnect SSH session">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>Reconnect</span>
            </button>
            <button type="button" class="ssh-btn" onclick="toggleFullscreen()" title="Toggle Fullscreen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="fullscreenIcon">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
                <span id="fullscreenText">Fullscreen</span>
            </button>
        </div>
    </div>

    {{-- Terminal Outer Wrapper --}}
    <div class="ssh-terminal-card" id="sshTerminalCard">
        <div id="terminal" class="ssh-terminal-body"></div>
    </div>
</div>

<link rel="stylesheet" href="/vendor/xterm/xterm.css" onerror="this.onerror=null;this.href='https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css';">

<style>
.votion-ssh-dashboard {
    margin-top: 10px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.ssh-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0B0F19;
    border: 1px solid #1E293B;
    border-bottom: none;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    padding: 10px 16px;
    gap: 12px;
    flex-wrap: wrap;
}

.ssh-toolbar-left, .ssh-toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.ssh-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 20px;
    background: #0F172A;
    border: 1px solid #334155;
    font-size: 11px;
    font-weight: 600;
    color: #94A3B8;
}

.ssh-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #F59E0B;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
    transition: all 0.3s ease;
}

.ssh-status-pill.connected .ssh-status-dot {
    background: #10B981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
}

.ssh-status-pill.connected .ssh-status-text {
    color: #34D399;
}

.ssh-status-pill.disconnected .ssh-status-dot {
    background: #EF4444;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
}

.ssh-status-pill.disconnected .ssh-status-text {
    color: #F87171;
}

.ssh-node-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #111827;
    border: 1px solid #1F2937;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
}

.ssh-chip-label {
    color: #6B7280;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
}

.ssh-chip-val {
    color: #E5E7EB;
    font-weight: 600;
}

.ssh-chip-sep {
    color: #4B5563;
}

.ssh-chip-host {
    color: #9CA3AF;
}

.ssh-node-selector select {
    background: #111827;
    border: 1px solid #374151;
    color: #E5E7EB;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    cursor: pointer;
}

.ssh-security-notice {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #94A3B8;
    font-size: 11px;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #334155;
    padding: 4px 10px;
    border-radius: 6px;
}

.ssh-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #1E293B;
    border: 1px solid #334155;
    color: #E2E8F0;
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.ssh-btn:hover {
    background: #334155;
    border-color: #475569;
    color: #FFFFFF;
}

.ssh-terminal-card {
    background: #070A13;
    border: 1px solid #1E293B;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    padding: 12px;
    min-height: 560px;
    position: relative;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
}

.ssh-terminal-body {
    width: 100%;
    height: 560px;
}

/* Fullscreen mode */
.ssh-terminal-card.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99999;
    border-radius: 0;
    border: none;
    padding: 16px;
}

.ssh-terminal-card.fullscreen .ssh-terminal-body {
    height: 100%;
}
</style>
@endsection

@section('footer-scripts')
@parent
<script src="/vendor/xterm/xterm.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js';"></script>
<script src="/vendor/xterm/xterm-addon-fit.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js';"></script>

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
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1.25,
        theme: {
            background: '#070A13',
            foreground: '#E2E8F0',
            cursor: '#10B981',
            cursorAccent: '#070A13',
            selectionBackground: 'rgba(16, 185, 129, 0.35)',
            black: '#0F172A',
            red: '#EF4444',
            green: '#10B981',
            yellow: '#F59E0B',
            blue: '#3B82F6',
            magenta: '#EC4899',
            cyan: '#06B6D4',
            white: '#F8FAFC',
            brightBlack: '#475569',
            brightRed: '#F87171',
            brightGreen: '#34D399',
            brightYellow: '#FBBF24',
            brightBlue: '#60A5FA',
            brightMagenta: '#F472B6',
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
        updateStatus('disconnected', 'No Node URL Configured');
        term.writeln('\x1b[31;1m[Error: Node connection address or daemon token could not be resolved.]\x1b[0m');
        return;
    }

    updateStatus('', 'Connecting...');

    try {
        socket = new WebSocket(wsUrl);
        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
            updateStatus('connected', 'Connected');
            if (fitAddon) {
                fitAddon.fit();
            }
            sendResize();
            term.focus();
        };

        socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                term.write(new Uint8Array(event.data));
            } else if (typeof event.data === 'string') {
                term.write(event.data);
            }
        };

        socket.onclose = () => {
            updateStatus('disconnected', 'Disconnected');
            term.writeln('\r\n\x1b[33;1m[Session terminated. Click "Reconnect" or reload page to open a new SSH shell]\x1b[0m\r\n');
        };

        socket.onerror = (err) => {
            updateStatus('disconnected', 'Error');
            console.error('SSH WebSocket Error:', err);
        };
    } catch (e) {
        updateStatus('disconnected', 'Connection Failed');
        term.writeln('\r\n\x1b[31;1m[WebSocket connection error: ' + e.message + ']\x1b[0m\r\n');
    }
}

function reconnectTerminal() {
    if (socket) {
        try {
            socket.close();
        } catch {}
    }
    if (term) {
        term.clear();
    }
    connectWebSocket();
}

function clearTerminal() {
    if (term) {
        term.clear();
    }
}

function toggleFullscreen() {
    const card = document.getElementById('sshTerminalCard');
    const text = document.getElementById('fullscreenText');
    if (!card) return;

    card.classList.toggle('fullscreen');
    const isFull = card.classList.contains('fullscreen');
    if (text) text.innerText = isFull ? 'Exit Fullscreen' : 'Fullscreen';

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
