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
/* Authentic Votion / Lunar Panel Editorial Design System */
.v-metric-card {
    background: #0A0A0A;
    border: 1px solid #1F1F1F;
    border-radius: 6px;
    padding: 16px 20px;
    margin-bottom: 20px;
    transition: border-color 0.15s ease;
}
.v-metric-card:hover {
    border-color: #333333;
}
.v-metric-num {
    font-size: 26px;
    font-weight: 700;
    color: #FFFFFF;
    font-family: var(--font-display, inherit);
    line-height: 1.1;
}
.v-metric-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888888;
    margin-top: 4px;
}
.v-server-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #050505;
    border: 1px solid #1F1F1F;
    color: #CCCCCC;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    margin: 2px;
    text-decoration: none !important;
    transition: all 0.12s ease;
}
.v-server-tag:hover {
    background: #141414;
    border-color: #383838;
    color: #FFFFFF;
}
.v-server-tag code {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    color: #888888;
    font-size: 10px;
}
.v-progress-wrap {
    width: 100px;
    background: #141414;
    border: 1px solid #1F1F1F;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    margin-top: 4px;
}
.v-progress-fill {
    background: #10B981;
    height: 100%;
    border-radius: 3px;
}
</style>

{{-- 1. TOP ACTIONS TOOLBAR --}}
<div class="row" style="margin-bottom: 18px;">
    <div class="col-xs-12" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
            <span class="label label-success">
                <i class="fa fa-circle" style="font-size: 6px; margin-right: 4px;"></i> Fleet Active
            </span>
            <span class="text-muted" style="font-size: 12px;">
                Manage node network endpoints, perform 1-click dedicated server IP migrations, and purge abandoned allocations.
            </span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <form action="{{ route('admin.ip-manager.clean-orphans') }}" method="POST" style="margin: 0;" onsubmit="return confirm('Clean dangling allocation records pointing to deleted servers or nodes?');">
                {!! csrf_field() !!}
                <button type="submit" class="btn btn-sm btn-default" title="Clean dangling allocation database records">
                    <i class="fa fa-trash-o text-muted"></i> Clean Orphans
                </button>
            </form>
            <button type="button" class="btn btn-sm btn-primary" onclick="openMigrateModal()">
                <i class="fa fa-random"></i> 1-Click IP Migration
            </button>
        </div>
    </div>
</div>

{{-- 2. BENTO METRIC CARDS --}}
<div class="row">
    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="v-metric-card">
            <div class="v-metric-num">{{ $inventory['summary']['total_nodes'] }}</div>
            <div class="v-metric-label">Nodes in Fleet</div>
        </div>
    </div>
    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="v-metric-card">
            <div class="v-metric-num">{{ $inventory['summary']['total_ips'] }}</div>
            <div class="v-metric-label">Unique Bind IPs</div>
        </div>
    </div>
    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="v-metric-card">
            <div class="v-metric-num">{{ $inventory['summary']['total_assigned'] }}</div>
            <div class="v-metric-label">Assigned Ports (Active)</div>
        </div>
    </div>
    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="v-metric-card">
            <div class="v-metric-num" style="{{ $inventory['summary']['total_unassigned'] > 0 ? 'color: #F59E0B;' : '' }}">
                {{ $inventory['summary']['total_unassigned'] }}
            </div>
            <div class="v-metric-label">Unallocated / Idle Ports</div>
        </div>
    </div>
</div>

{{-- 3. NODE INVENTORY BOXES --}}
<div class="row">
    <div class="col-xs-12">
        @foreach($inventory['nodes'] as $nodeGroup)
            @php
                $node = $nodeGroup['node'];
            @endphp
            <div class="box box-primary" style="margin-bottom: 24px;">
                <div class="box-header with-border">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <h3 class="box-title">
                            <a href="{{ route('admin.nodes.view', $node->id) }}" style="color: #FFFFFF; font-weight: 500;">
                                {{ $node->name }}
                            </a>
                        </h3>
                        <code>{{ $node->fqdn }}:{{ $node->daemonListen }}</code>
                        <span class="label label-default" style="font-weight: 400;">
                            {{ $node->servers_count }} active server(s)
                        </span>
                    </div>
                    <div class="box-tools">
                        <a href="{{ route('admin.nodes.view.allocation', $node->id) }}" class="btn btn-xs btn-default">
                            Manage Allocations &rarr;
                        </a>
                        <button type="button" class="btn btn-xs btn-primary" onclick="openMigrateModal({{ $node->id }})">
                            <i class="fa fa-random"></i> Migrate Node IP
                        </button>
                    </div>
                </div>

                <div class="box-body table-responsive no-padding">
                    @if(empty($nodeGroup['ips']))
                        <div style="padding: 32px; text-align: center; color: #737373;">
                            <em>No IP allocations assigned to this node yet. Use "Manage Allocations" to add network ports.</em>
                        </div>
                    @else
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th style="width: 220px;">IP Address & Alias</th>
                                    <th style="width: 150px;">Port Usage</th>
                                    <th>Bound Servers</th>
                                    <th class="text-right" style="width: 260px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($nodeGroup['ips'] as $ipData)
                                    <tr>
                                        <td>
                                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span class="font-mono" style="color: #FFFFFF; font-weight: 600; font-size: 13px;">
                                                        {{ $ipData['ip'] }}
                                                    </span>
                                                    @if(!empty($ipData['alias']))
                                                        <span class="text-muted" style="font-size: 11px;">({{ $ipData['alias'] }})</span>
                                                    @endif
                                                </div>
                                                <div>
                                                    @if($ipData['is_abandoned'])
                                                        <span class="label label-warning">Abandoned / 0 Servers</span>
                                                    @elseif($ipData['unassigned'] === 0)
                                                        <span class="label label-success">{{ $ipData['assigned'] }} Server(s) Active</span>
                                                    @else
                                                        <span class="label label-success">{{ $ipData['assigned'] }} Server(s) Active</span>
                                                        <span class="label label-default" style="margin-left: 4px;">{{ $ipData['unassigned'] }} Idle Ports</span>
                                                    @endif
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div class="font-mono" style="font-size: 12px; color: #FFFFFF;">
                                                {{ $ipData['assigned'] }} <span class="text-muted">/ {{ $ipData['total'] }}</span>
                                            </div>
                                            <div class="v-progress-wrap">
                                                @php
                                                    $pct = $ipData['total'] > 0 ? round(($ipData['assigned'] / $ipData['total']) * 100) : 0;
                                                @endphp
                                                <div class="v-progress-fill" style="width: {{ $pct }}%;"></div>
                                            </div>
                                        </td>
                                        <td>
                                            @if(empty($ipData['servers']))
                                                <span class="text-muted" style="font-size: 11px; font-style: italic;">No servers bound to this IP</span>
                                            @else
                                                <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                                                    @foreach(array_slice($ipData['servers'], 0, 5) as $srv)
                                                        <a href="{{ route('admin.servers.view', $srv['id']) }}" class="v-server-tag" title="Manage {{ $srv['name'] }}">
                                                            <span>{{ Str::limit($srv['name'], 18) }}</span>
                                                            <code>:{{ implode(',', $srv['ports']) }}</code>
                                                        </a>
                                                    @endforeach
                                                    @if(count($ipData['servers']) > 5)
                                                        <span class="label label-default" style="font-size: 10px;">
                                                            +{{ count($ipData['servers']) - 5 }} more
                                                        </span>
                                                    @endif
                                                </div>
                                            @endif
                                        </td>
                                        <td class="text-right">
                                            <div class="btn-group">
                                                {{-- Migrate Button --}}
                                                <button type="button" class="btn btn-xs btn-default" onclick="openMigrateModal({{ $node->id }}, '{{ $ipData['ip'] }}', '{{ $ipData['alias'] }}')" title="Migrate this IP">
                                                    <i class="fa fa-random"></i> Migrate
                                                </button>

                                                {{-- Sync Daemon Button --}}
                                                @if($ipData['assigned'] > 0)
                                                    <form action="{{ route('admin.ip-manager.sync') }}" method="POST" style="display: inline;">
                                                        {!! csrf_field() !!}
                                                        <input type="hidden" name="node_id" value="{{ $node->id }}">
                                                        <input type="hidden" name="ip" value="{{ $ipData['ip'] }}">
                                                        <button type="submit" class="btn btn-xs btn-default" title="Re-sync server containers with Wings daemon">
                                                            <i class="fa fa-refresh"></i> Sync
                                                        </button>
                                                    </form>
                                                @endif

                                                {{-- Clean Unassigned Ports --}}
                                                @if($ipData['unassigned'] > 0)
                                                    <form action="{{ route('admin.ip-manager.delete-abandoned') }}" method="POST" style="display: inline;" onsubmit="return confirm('Remove all {{ $ipData['unassigned'] }} unassigned port allocations for IP {{ $ipData['ip'] }}? Active servers will not be touched.');">
                                                        {!! csrf_field() !!}
                                                        <input type="hidden" name="node_id" value="{{ $node->id }}">
                                                        <input type="hidden" name="ip" value="{{ $ipData['ip'] }}">
                                                        <button type="submit" class="btn btn-xs btn-default" title="Clean unassigned ports for this IP">
                                                            <i class="fa fa-eraser"></i> Prune ({{ $ipData['unassigned'] }})
                                                        </button>
                                                    </form>
                                                @endif

                                                {{-- Purge IP (Only if 0 active servers remain) --}}
                                                @if($ipData['assigned'] === 0)
                                                    <form action="{{ route('admin.ip-manager.purge-ip') }}" method="POST" style="display: inline;" onsubmit="return confirm('Completely purge IP {{ $ipData['ip'] }} from node {{ $node->name }}? This removes all allocation records for this IP.');">
                                                        {!! csrf_field() !!}
                                                        <input type="hidden" name="node_id" value="{{ $node->id }}">
                                                        <input type="hidden" name="ip" value="{{ $ipData['ip'] }}">
                                                        <button type="submit" class="btn btn-xs btn-danger" title="Purge this entire unused IP">
                                                            <i class="fa fa-trash"></i> Purge
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
            </div>
        @endforeach
    </div>
</div>

{{-- 4. 1-CLICK IP MIGRATION MODAL (Native Votion / Lunar Modal) --}}
<div class="modal fade" id="ipmMigrateModal" tabindex="-1" role="dialog">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <form action="{{ route('admin.ip-manager.migrate') }}" method="POST" id="ipmMigrateForm">
                {!! csrf_field() !!}
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 class="modal-title">
                        <i class="fa fa-random" style="margin-right: 6px;"></i> 1-Click Node IP Migration
                    </h4>
                </div>

                <div class="modal-body">
                    <div class="alert alert-info" style="background: #050505 !important; border: 1px solid #1F1F1F !important; color: #CCCCCC !important; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
                        <i class="fa fa-info-circle" style="color: #38bdf8; margin-right: 6px;"></i>
                        <strong>In-Place Migration:</strong> Preserves all primary allocation IDs, port bindings, and server configurations in an atomic database transaction.
                    </div>

                    {{-- Target Node --}}
                    <div class="form-group">
                        <label for="modalNodeSelect">Target Node</label>
                        <select name="node_id" id="modalNodeSelect" class="form-control" onchange="onNodeSelected(this.value)" required>
                            <option value="" disabled selected>-- Select a Node --</option>
                            @foreach($nodes as $n)
                                <option value="{{ $n->id }}" data-fqdn="{{ $n->fqdn }}">{{ $n->name }} ({{ $n->fqdn }})</option>
                            @endforeach
                        </select>
                    </div>

                    {{-- Source IP --}}
                    <div class="form-group">
                        <label for="modalOldIpSelect">Current / Source IP to Migrate</label>
                        <select name="old_ip" id="modalOldIpSelect" class="form-control" required>
                            <option value="" disabled selected>-- Select a Node First --</option>
                        </select>
                    </div>

                    {{-- Destination IP --}}
                    <div class="form-group">
                        <label for="modalNewIp">New Destination IP Address</label>
                        <input type="text" name="new_ip" id="modalNewIp" class="form-control font-mono" placeholder="e.g. 51.79.160.85" required pattern="^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)(\.(?!$)|$)){4}$">
                    </div>

                    {{-- Destination Alias --}}
                    <div class="form-group">
                        <label for="modalNewAlias">New IP Alias / Hostname <small class="text-muted">(Optional)</small></label>
                        <input type="text" name="new_alias" id="modalNewAlias" class="form-control" placeholder="e.g. node1.yourdomain.com">
                    </div>

                    {{-- Node FQDN --}}
                    <div class="form-group">
                        <label for="modalNewFqdn">Node Connection FQDN <small class="text-muted">(Optional - if dedicated server hostname changed)</small></label>
                        <input type="text" name="new_fqdn" id="modalNewFqdn" class="form-control" placeholder="e.g. de1.yourdomain.com">
                    </div>

                    {{-- Sync Daemon Checkbox --}}
                    <div class="checkbox" style="margin-top: 15px;">
                        <label style="color: #CCCCCC;">
                            <input type="checkbox" name="sync_daemon" id="modalSyncDaemon" value="1" checked>
                            Automatically re-synchronize affected server containers with node daemon (Wings/Agent)
                        </label>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="btnSubmitMigrate">
                        <i class="fa fa-check" style="margin-right: 4px;"></i> Execute 1-Click Migration
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
@endsection

@section('footer-scripts')
@parent
<script>
// Inventory data passed from PHP
const fleetData = @json($inventory['nodes']);

function openMigrateModal(nodeId = null, prefillIp = null, prefillAlias = null) {
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

    $('#ipmMigrateModal').modal('show');
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
