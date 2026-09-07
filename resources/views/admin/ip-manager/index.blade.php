@extends('layouts.admin')

@section('title')
    Node IP & Allocation Manager
@endsection

@section('content-header')
    <h1>IP & Allocation Manager
        <small>1-Click node IP migration, multi-server rebinding, and database allocation cleaner.</small>
    </h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">IP & Allocations</li>
    </ol>
@endsection

@section('content')
<style>
:root {
    --ipm-bg: #0b0f19;
    --ipm-card: #111827;
    --ipm-card-hover: #161f33;
    --ipm-border: rgba(255, 255, 255, 0.08);
    --ipm-border-focus: #3b82f6;
    --ipm-text: #f9fafb;
    --ipm-muted: #9ca3af;
    --ipm-emerald: #10b981;
    --ipm-blue: #3b82f6;
    --ipm-amber: #f59e0b;
    --ipm-rose: #ef4444;
    --ipm-purple: #8b5cf6;
}

.ipm-container {
    color: var(--ipm-text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin-bottom: 40px;
}

/* 1. Header Toolbar */
.ipm-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--ipm-card);
    border: 1px solid var(--ipm-border);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 24px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
}

.ipm-toolbar-title {
    display: flex;
    align-items: center;
    gap: 12px;
}

.ipm-toolbar-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(16, 185, 129, 0.12);
    color: var(--ipm-emerald);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.ipm-toolbar-actions {
    display: flex;
    gap: 10px;
}

.ipm-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    text-decoration: none !important;
}

.ipm-btn-primary {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #ffffff !important;
    box-shadow: 0 2px 10px rgba(37, 99, 235, 0.35);
}
.ipm-btn-primary:hover {
    background: linear-gradient(135deg, #1d4ed8, #1e40af);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
}

.ipm-btn-secondary {
    background: rgba(255, 255, 255, 0.06);
    color: var(--ipm-text) !important;
    border: 1px solid var(--ipm-border);
}
.ipm-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.18);
}

.ipm-btn-danger {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5 !important;
    border: 1px solid rgba(239, 68, 68, 0.3);
}
.ipm-btn-danger:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
    color: #ffffff !important;
}

.ipm-btn-sm {
    padding: 5px 10px;
    font-size: 12px;
    border-radius: 6px;
}

/* 2. KPI Stat Cards */
.ipm-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}

.ipm-stat-card {
    background: var(--ipm-card);
    border: 1px solid var(--ipm-border);
    border-radius: 12px;
    padding: 18px 20px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.2);
}

.ipm-stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
}

.ipm-stat-card.stat-blue::before { background: var(--ipm-blue); }
.ipm-stat-card.stat-emerald::before { background: var(--ipm-emerald); }
.ipm-stat-card.stat-purple::before { background: var(--ipm-purple); }
.ipm-stat-card.stat-amber::before { background: var(--ipm-amber); }

.ipm-stat-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ipm-muted);
    margin-bottom: 6px;
}

.ipm-stat-value {
    font-size: 26px;
    font-weight: 700;
    color: #ffffff;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.ipm-stat-subtext {
    font-size: 12px;
    color: var(--ipm-muted);
    margin-top: 4px;
}

/* 3. Node Inventory Cards */
.ipm-node-card {
    background: var(--ipm-card);
    border: 1px solid var(--ipm-border);
    border-radius: 12px;
    margin-bottom: 24px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}

.ipm-node-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--ipm-border);
}

.ipm-node-title {
    display: flex;
    align-items: center;
    gap: 12px;
}

.ipm-node-name {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
}

.ipm-node-fqdn {
    font-size: 13px;
    color: var(--ipm-blue);
    font-family: ui-monospace, SFMono-Regular, monospace;
    background: rgba(59, 130, 246, 0.1);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(59, 130, 246, 0.2);
}

.ipm-node-badge {
    font-size: 12px;
    color: var(--ipm-muted);
}

/* IP Table */
.ipm-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.ipm-table th {
    background: rgba(0,0,0,0.2);
    color: var(--ipm-muted);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
    padding: 12px 20px;
    border-bottom: 1px solid var(--ipm-border);
    text-align: left;
}

.ipm-table td {
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    vertical-align: middle;
}

.ipm-table tr:hover {
    background: var(--ipm-card-hover);
}

.ipm-ip-cell {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
}

.ipm-alias-tag {
    font-size: 11px;
    font-weight: 500;
    color: #93c5fd;
    background: rgba(59, 130, 246, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
}

.ipm-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
}

.ipm-badge-active {
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.ipm-badge-abandoned {
    background: rgba(245, 158, 11, 0.15);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.ipm-server-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 320px;
}

.ipm-server-chip {
    font-size: 11px;
    background: rgba(255, 255, 255, 0.06);
    color: #e5e7eb;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--ipm-border);
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.ipm-server-chip:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    text-decoration: none;
}

.ipm-empty-state {
    padding: 40px 20px;
    text-align: center;
    color: var(--ipm-muted);
}

/* Modals */
.ipm-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 1050;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.ipm-modal {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    width: 100%;
    max-width: 580px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    animation: ipmModalFade 0.2s ease-out;
}

@keyframes ipmModalFade {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
}

.ipm-modal-header {
    padding: 20px 24px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid var(--ipm-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.ipm-modal-title {
    font-size: 17px;
    font-weight: 700;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
}

.ipm-modal-close {
    background: none;
    border: none;
    color: var(--ipm-muted);
    font-size: 18px;
    cursor: pointer;
}
.ipm-modal-close:hover { color: #ffffff; }

.ipm-modal-body {
    padding: 24px;
}

.ipm-modal-footer {
    padding: 16px 24px;
    background: rgba(0,0,0,0.25);
    border-top: 1px solid var(--ipm-border);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.ipm-form-group {
    margin-bottom: 18px;
}

.ipm-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ipm-muted);
    margin-bottom: 6px;
}

.ipm-input, .ipm-select {
    width: 100%;
    background: #0b0f19;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 14px;
    font-family: inherit;
    transition: all 0.15s ease;
}

.ipm-input:focus, .ipm-select:focus {
    outline: none;
    border-color: var(--ipm-blue);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
}

.ipm-alert-box {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    color: #93c5fd;
    margin-bottom: 18px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.ipm-alert-box-warn {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
    color: #fcd34d;
}

.ipm-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #e5e7eb;
    cursor: pointer;
    margin-top: 8px;
}
</style>

<div class="ipm-container">

    {{-- Top Action Toolbar --}}
    <div class="ipm-toolbar">
        <div class="ipm-toolbar-title">
            <h2 style="margin: 0; font-size: 18px; font-weight: 700;">Fleet IP & Allocation Hub</h2>
            <span class="ipm-toolbar-badge">
                <span style="width: 6px; height: 6px; background: currentColor; border-radius: 50%;"></span>
                Automated Rebinding
            </span>
        </div>
        <div class="ipm-toolbar-actions">
            <button type="button" onclick="openMigrateModal()" class="ipm-btn ipm-btn-primary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3l4 4-4 4"></path>
                    <path d="M3 7h18"></path>
                    <path d="M7 21l-4-4 4-4"></path>
                    <path d="M21 17H3"></path>
                </svg>
                1-Click IP Migration
            </button>
            <form action="{{ route('admin.ip-manager.clean-orphans') }}" method="POST" style="display: inline;" onsubmit="return confirm('Clean global orphan allocations pointing to deleted nodes or servers?');">
                {!! csrf_field() !!}
                <button type="submit" class="ipm-btn ipm-btn-secondary" title="Prune dangling database allocation records">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Clean Orphans
                </button>
            </form>
        </div>
    </div>

    {{-- Fleet KPI Stats Grid --}}
    <div class="ipm-stats-grid">
        <div class="ipm-stat-card stat-blue">
            <div class="ipm-stat-label">Nodes in Fleet</div>
            <div class="ipm-stat-value">{{ number_format($inventory['summary']['total_nodes']) }}</div>
            <div class="ipm-stat-subtext">Active host machines</div>
        </div>
        <div class="ipm-stat-card stat-emerald">
            <div class="ipm-stat-label">Unique Bind IPs</div>
            <div class="ipm-stat-value">{{ number_format($inventory['summary']['total_ips']) }}</div>
            <div class="ipm-stat-subtext">Configured network endpoints</div>
        </div>
        <div class="ipm-stat-card stat-purple">
            <div class="ipm-stat-label">Assigned Ports</div>
            <div class="ipm-stat-value">{{ number_format($inventory['summary']['total_assigned']) }}</div>
            <div class="ipm-stat-subtext">Bound to active containers</div>
        </div>
        <div class="ipm-stat-card stat-amber">
            <div class="ipm-stat-label">Unallocated / Idle Ports</div>
            <div class="ipm-stat-value">{{ number_format($inventory['summary']['total_unassigned']) }}</div>
            <div class="ipm-stat-subtext">Available or abandoned</div>
        </div>
    </div>

    {{-- Nodes & Allocation Inventory --}}
    @foreach($inventory['nodes'] as $nodeGroup)
        @php
            $node = $nodeGroup['node'];
            $ips = $nodeGroup['ips'];
        @endphp
        <div class="ipm-node-card">
            <div class="ipm-node-header">
                <div class="ipm-node-title">
                    <span class="ipm-node-name">{{ $node->name }}</span>
                    <span class="ipm-node-fqdn">{{ $node->fqdn }}:{{ $node->daemonListen }}</span>
                    <span class="ipm-node-badge">{{ $node->servers_count }} active server(s)</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <a href="{{ route('admin.nodes.view.allocation', $node->id) }}" class="ipm-btn ipm-btn-secondary ipm-btn-sm" title="View standard allocation list">
                        Manage Allocations &rarr;
                    </a>
                    <button type="button" onclick="openMigrateModal({{ $node->id }})" class="ipm-btn ipm-btn-primary ipm-btn-sm">
                        Migrate Node IP
                    </button>
                </div>
            </div>

            @if(empty($ips))
                <div class="ipm-empty-state">
                    No allocations configured for this node yet.
                </div>
            @else
                <table class="ipm-table">
                    <thead>
                        <tr>
                            <th style="width: 25%;">IP Address & Alias</th>
                            <th style="width: 15%;">Port Usage</th>
                            <th style="width: 35%;">Bound Servers</th>
                            <th style="width: 25%; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($ips as $ipData)
                            <tr>
                                <td>
                                    <div class="ipm-ip-cell">
                                        <span>{{ $ipData['ip'] }}</span>
                                        @if($ipData['alias'])
                                            <span class="ipm-alias-tag font-mono">{{ $ipData['alias'] }}</span>
                                        @endif
                                    </div>
                                    <div style="font-size: 11px; color: var(--ipm-muted); margin-top: 4px;">
                                        @if($ipData['is_abandoned'])
                                            <span class="ipm-badge ipm-badge-abandoned">No Servers Bound</span>
                                        @else
                                            <span class="ipm-badge ipm-badge-active">{{ count($ipData['servers']) }} Server(s) Active</span>
                                        @endif
                                    </div>
                                </td>
                                <td>
                                    <div style="font-family: monospace; font-size: 13px; font-weight: 600;">
                                        <span style="color: #ffffff;">{{ $ipData['assigned'] }}</span>
                                        <span style="color: var(--ipm-muted);">/ {{ $ipData['total'] }}</span>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.08); height: 4px; border-radius: 2px; margin-top: 6px; width: 100px; overflow: hidden;">
                                        <div style="background: {{ $ipData['assigned'] > 0 ? '#10b981' : '#f59e0b' }}; height: 100%; width: {{ $ipData['total'] > 0 ? min(100, ($ipData['assigned'] / $ipData['total']) * 100) : 0 }}%;"></div>
                                    </div>
                                </td>
                                <td>
                                    @if(empty($ipData['servers']))
                                        <span style="color: var(--ipm-muted); font-style: italic; font-size: 12px;">No active containers</span>
                                    @else
                                        <div class="ipm-server-chips">
                                            @foreach(array_slice($ipData['servers'], 0, 4) as $s)
                                                <a href="{{ route('admin.servers.view', $s['id']) }}" class="ipm-server-chip" title="Server: {{ $s['name'] }} (UUID: {{ $s['uuidShort'] }})">
                                                    <span>{{ \Illuminate\Support\Str::limit($s['name'], 15) }}</span>
                                                    <span style="color: var(--ipm-muted); font-size: 10px;">:{{ implode(',', array_slice($s['ports'], 0, 2)) }}</span>
                                                </a>
                                            @endforeach
                                            @if(count($ipData['servers']) > 4)
                                                <span class="ipm-server-chip" style="background: rgba(59, 130, 246, 0.15); color: #93c5fd;">
                                                    +{{ count($ipData['servers']) - 4 }} more
                                                </span>
                                            @endif
                                        </div>
                                    @endif
                                </td>
                                <td style="text-align: right;">
                                    <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                                        {{-- 1-Click Migrate Button --}}
                                        <button type="button" onclick="openMigrateModal({{ $node->id }}, '{{ $ipData['ip'] }}', '{{ $ipData['alias'] }}')" class="ipm-btn ipm-btn-secondary ipm-btn-sm" title="Migrate this IP to a new IP">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M17 3l4 4-4 4"></path>
                                                <path d="M3 7h18"></path>
                                                <path d="M7 21l-4-4 4-4"></path>
                                                <path d="M21 17H3"></path>
                                            </svg>
                                            Migrate
                                        </button>

                                        {{-- Sync with Daemon Button --}}
                                        @if($ipData['assigned'] > 0)
                                            <form action="{{ route('admin.ip-manager.sync') }}" method="POST" style="display: inline;">
                                                {!! csrf_field() !!}
                                                <input type="hidden" name="node_id" value="{{ $node->id }}">
                                                <input type="hidden" name="ip" value="{{ $ipData['ip'] }}">
                                                <button type="submit" class="ipm-btn ipm-btn-secondary ipm-btn-sm" title="Force re-sync server configs with Wings">
                                                    Sync
                                                </button>
                                            </form>
                                        @endif

                                        {{-- Delete Abandoned Unassigned Ports --}}
                                        @if($ipData['unassigned'] > 0)
                                            <form action="{{ route('admin.ip-manager.delete-abandoned') }}" method="POST" style="display: inline;" onsubmit="return confirm('Delete all {{ $ipData['unassigned'] }} unassigned port(s) on IP {{ $ipData['ip'] }}?');">
                                                {!! csrf_field() !!}
                                                <input type="hidden" name="node_id" value="{{ $node->id }}">
                                                <input type="hidden" name="ip" value="{{ $ipData['ip'] }}">
                                                <button type="submit" class="ipm-btn ipm-btn-secondary ipm-btn-sm" title="Delete unassigned ports for this IP">
                                                    Prune ({{ $ipData['unassigned'] }})
                                                </button>
                                            </form>
                                        @endif

                                        {{-- Purge Entire IP (if 0 servers) --}}
                                        @if($ipData['assigned'] === 0)
                                            <form action="{{ route('admin.ip-manager.purge-ip') }}" method="POST" style="display: inline;" onsubmit="return confirm('Completely purge IP {{ $ipData['ip'] }} from node {{ $node->name }}? This removes all allocation records for this IP.');">
                                                {!! csrf_field() !!}
                                                <input type="hidden" name="node_id" value="{{ $node->id }}">
                                                <input type="hidden" name="ip" value="{{ $ipData['ip'] }}">
                                                <button type="submit" class="ipm-btn ipm-btn-danger ipm-btn-sm" title="Purge unused IP completely">
                                                    Purge
                                                </button>
                                            </form>
                                        @endif
                                    </div>
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            @endif
        </div>
    @endforeach

</div>

{{-- =========================================================================
    1-Click IP Migration Modal
   ========================================================================= --}}
<div id="ipmMigrateModal" class="ipm-modal-backdrop">
    <div class="ipm-modal">
        <div class="ipm-modal-header">
            <div class="ipm-modal-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3l4 4-4 4"></path>
                    <path d="M3 7h18"></path>
                    <path d="M7 21l-4-4 4-4"></path>
                    <path d="M21 17H3"></path>
                </svg>
                1-Click Node IP Migration
            </div>
            <button type="button" class="ipm-modal-close" onclick="closeMigrateModal()">&times;</button>
        </div>

        <form action="{{ route('admin.ip-manager.migrate') }}" method="POST" id="ipmMigrateForm">
            {!! csrf_field() !!}

            <div class="ipm-modal-body">
                <div class="ipm-alert-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <div>
                        <strong>Seamless In-Place Migration:</strong> All existing ports, server IDs, primary allocations, and container builds are preserved. Only the host IP address is updated.
                    </div>
                </div>

                {{-- Node Selection --}}
                <div class="ipm-form-group">
                    <label class="ipm-label">Target Node</label>
                    <select name="node_id" id="modalNodeSelect" class="ipm-select" onchange="onNodeSelected(this.value)" required>
                        <option value="" disabled selected>-- Select a Node --</option>
                        @foreach($nodes as $n)
                            <option value="{{ $n->id }}" data-fqdn="{{ $n->fqdn }}">{{ $n->name }} ({{ $n->fqdn }})</option>
                        @endforeach
                    </select>
                </div>

                {{-- Old IP Selection --}}
                <div class="ipm-form-group">
                    <label class="ipm-label">Current / Source IP to Migrate</label>
                    <select name="old_ip" id="modalOldIpSelect" class="ipm-select" required>
                        <option value="" disabled selected>-- Select an IP --</option>
                    </select>
                </div>

                {{-- New IP Input --}}
                <div class="ipm-form-group">
                    <label class="ipm-label">New Destination IP Address</label>
                    <input type="text" name="new_ip" id="modalNewIp" class="ipm-input" placeholder="e.g. 51.79.160.85" required pattern="^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)(\.(?!$)|$)){4}$">
                </div>

                {{-- New Alias (Optional) --}}
                <div class="ipm-form-group">
                    <label class="ipm-label">New IP Alias / Hostname <span style="font-weight: 400; text-transform: none; color: var(--ipm-muted);">(Optional)</span></label>
                    <input type="text" name="new_alias" id="modalNewAlias" class="ipm-input" placeholder="e.g. sg.lunarcloud.in">
                </div>

                {{-- Node FQDN (Optional) --}}
                <div class="ipm-form-group">
                    <label class="ipm-label">Node Connection FQDN <span style="font-weight: 400; text-transform: none; color: var(--ipm-muted);">(Optional - if dedicated server domain changed)</span></label>
                    <input type="text" name="new_fqdn" id="modalNewFqdn" class="ipm-input" placeholder="e.g. sg2.lunarcloud.in">
                </div>

                {{-- Sync with Daemon Checkbox --}}
                <div class="ipm-checkbox-label">
                    <input type="checkbox" name="sync_daemon" id="modalSyncDaemon" value="1" checked>
                    <span>Immediately synchronize affected server containers with node daemon (Wings/Agent)</span>
                </div>
            </div>

            <div class="ipm-modal-footer">
                <button type="button" class="ipm-btn ipm-btn-secondary" onclick="closeMigrateModal()">Cancel</button>
                <button type="submit" class="ipm-btn ipm-btn-primary" id="btnSubmitMigrate">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Execute 1-Click Migration
                </button>
            </div>
        </form>
    </div>
</div>

<script>
// Inventory data passed from PHP
const fleetData = @json($inventory['nodes']);

function openMigrateModal(nodeId = null, prefillIp = null, prefillAlias = null) {
    const modal = document.getElementById('ipmMigrateModal');
    const nodeSelect = document.getElementById('modalNodeSelect');
    const oldIpSelect = document.getElementById('modalOldIpSelect');
    const newIpInput = document.getElementById('modalNewIp');
    const newAliasInput = document.getElementById('modalNewAlias');
    const newFqdnInput = document.getElementById('modalNewFqdn');

    newIpInput.value = '';
    newAliasInput.value = prefillAlias || '';

    if (nodeId) {
        nodeSelect.value = nodeId;
        onNodeSelected(nodeId, prefillIp);
    } else {
        nodeSelect.selectedIndex = 0;
        oldIpSelect.innerHTML = '<option value="" disabled selected>-- Select a Node First --</option>';
        newFqdnInput.value = '';
    }

    modal.style.display = 'flex';
}

function closeMigrateModal() {
    document.getElementById('ipmMigrateModal').style.display = 'none';
}

function onNodeSelected(nodeId, prefillIp = null) {
    const oldIpSelect = document.getElementById('modalOldIpSelect');
    const newFqdnInput = document.getElementById('modalNewFqdn');
    oldIpSelect.innerHTML = '';

    const selectedOption = document.querySelector(`#modalNodeSelect option[value="${nodeId}"]`);
    if (selectedOption) {
        newFqdnInput.value = selectedOption.getAttribute('data-fqdn') || '';
    }

    const nodeGroup = fleetData.find(g => g.node.id == nodeId);
    if (!nodeGroup || !nodeGroup.ips || nodeGroup.ips.length === 0) {
        oldIpSelect.innerHTML = '<option value="" disabled selected>No IPs found on this node</option>';
        return;
    }

    nodeGroup.ips.forEach(ipData => {
        const opt = document.createElement('option');
        opt.value = ipData.ip;
        opt.textContent = `${ipData.ip} (${ipData.assigned} active servers, ${ipData.total} total ports)`;
        if (prefillIp && ipData.ip === prefillIp) {
            opt.selected = true;
        }
        oldIpSelect.appendChild(opt);
    });

    if (!prefillIp && oldIpSelect.options.length > 0) {
        oldIpSelect.selectedIndex = 0;
    }
}

// Close modal when clicking outside
document.getElementById('ipmMigrateModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeMigrateModal();
    }
});

// Confirmation on form submit
document.getElementById('ipmMigrateForm').addEventListener('submit', function(e) {
    const oldIp = document.getElementById('modalOldIpSelect').value;
    const newIp = document.getElementById('modalNewIp').value;
    const confirmMsg = `Are you sure you want to migrate all server allocations from ${oldIp} to ${newIp}?\n\nThis will rebind all affected server containers on this node.`;
    if (!confirm(confirmMsg)) {
        e.preventDefault();
    }
});
</script>
@endsection
