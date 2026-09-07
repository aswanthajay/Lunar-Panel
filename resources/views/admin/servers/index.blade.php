@extends('layouts.admin')

@section('title')
    Server Fleet
@endsection

@section('content-header')
    <h1>Server Fleet<small>All provisioned gaming instances across compute nodes.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Servers</li>
    </ol>
@endsection

@section('content')
<div class="row">
    <div class="col-xs-12">
        <div class="box box-primary">
            <div class="box-header with-border">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <h3 class="box-title">Server Fleet Roster</h3>
                    <span class="lunar-topbar-pill" style="font-size: 9px; padding: 1px 6px;">{{ $servers->total() }} Total</span>
                </div>
                <div class="box-tools search01" style="display: flex; align-items: center; gap: 8px;">
                    <form action="{{ route('admin.servers') }}" method="GET" style="margin: 0;">
                        <div class="input-group input-group-sm" style="width: 220px;">
                            <input type="text" name="filter[*]" class="form-control" value="{{ request()->input()['filter']['*'] ?? '' }}" placeholder="Search by name, uuid, owner...">
                            <span class="input-group-btn">
                                <button type="submit" class="btn btn-default btn-sm"><i class="fa fa-search"></i></button>
                            </span>
                        </div>
                    </form>
                    <a href="{{ route('admin.servers.new') }}" class="btn btn-sm btn-primary" style="white-space: nowrap;">
                        <i class="fa fa-plus" style="font-size: 10px; margin-right: 4px;"></i> Create Server
                    </a>
                </div>
            </div>
            <div class="box-body table-responsive no-padding">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th style="padding-left: 20px;">Server Name</th>
                            <th>Identifier</th>
                            <th>Owner</th>
                            <th>Node</th>
                            <th>Connection</th>
                            <th class="text-center">Status</th>
                            <th class="text-right" style="padding-right: 20px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($servers as $server)
                            <tr data-server="{{ $server->uuidShort }}">
                                <td style="padding-left: 20px;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="width: 28px; height: 28px; border-radius: 6px; background: #121214; border: 1px solid #222226; display: flex; align-items: center; justify-content: center; color: #A0A0A0; flex-shrink: 0;">
                                            <i class="fa fa-server" style="font-size: 11px;"></i>
                                        </div>
                                        <div>
                                            <a href="{{ route('admin.servers.view', $server->id) }}" style="color: #FFFFFF; font-weight: 500; font-size: 13px;">
                                                {{ $server->name }}
                                            </a>
                                            <div style="font-size: 10px; color: #71717A; font-family: var(--font-mono); margin-top: 1px;">
                                                {{ $server->uuidShort }}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <code title="{{ $server->uuid }}" style="font-size: 10px; cursor: help;">{{ substr($server->uuid, 0, 8) }}...{{ substr($server->uuid, -4) }}</code>
                                </td>
                                <td>
                                    <a href="{{ route('admin.users.view', $server->user->id) }}" style="display: inline-flex; align-items: center; color: #D4D4D4; text-decoration: none;">
                                        <span class="votion-avatar-sm">{{ strtoupper(substr($server->user->username ?? 'U', 0, 2)) }}</span>
                                        <span style="font-size: 12px;">{{ $server->user->username }}</span>
                                    </a>
                                </td>
                                <td>
                                    <a href="{{ route('admin.nodes.view', $server->node->id) }}" style="color: #A0A0A0; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                                        <i class="fa fa-sitemap" style="font-size: 10px; color: #71717A;"></i>
                                        <span>{{ $server->node->name }}</span>
                                    </a>
                                </td>
                                <td>
                                    <code style="font-size: 11px; background-color: #060608; border-color: #1A1A1E; color: #B0B0B0;">
                                        {{ $server->allocation->alias }}:{{ $server->allocation->port }}
                                    </code>
                                </td>
                                <td class="text-center">
                                    @if($server->isSuspended())
                                        <span class="status-pill status-suspended">
                                            <span class="status-pill-dot"></span>
                                            <span>Suspended</span>
                                        </span>
                                    @elseif(! $server->isInstalled())
                                        <span class="status-pill status-installing">
                                            <span class="status-pill-dot"></span>
                                            <span>Installing</span>
                                        </span>
                                    @else
                                        <span class="status-pill status-active">
                                            <span class="status-pill-dot"></span>
                                            <span>Active</span>
                                        </span>
                                    @endif
                                </td>
                                <td class="text-right" style="padding-right: 20px;">
                                    <div style="display: inline-flex; align-items: center; gap: 4px;">
                                        <a class="btn btn-xs btn-default" href="{{ route('admin.servers.view', $server->id) }}" data-toggle="tooltip" data-placement="top" title="Configure Server in Admin">
                                            <i class="fa fa-cog"></i>
                                        </a>
                                        <a class="btn btn-xs btn-default" href="/server/{{ $server->uuidShort }}" target="_blank" data-toggle="tooltip" data-placement="top" title="Open Console in Client Area">
                                            <i class="fa fa-terminal"></i>
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 48px 16px;">
                                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4B5563" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                                            <line x1="6" y1="6" x2="6.01" y2="6"></line>
                                            <line x1="6" y1="18" x2="6.01" y2="18"></line>
                                        </svg>
                                        <p style="font-size: 13px; color: #FFFFFF; margin: 0; font-weight: 500;">No servers found</p>
                                        <p style="font-size: 11px; color: #71717A; margin: 0;">No server instances match the current query or filter criteria.</p>
                                    </div>
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            <div class="box-footer with-border">
                <div class="col-sm-6 text-left" style="line-height: 32px; padding-left: 0;">
                    <small class="text-muted font-mono" style="font-size: 11px;">
                        Showing {{ $servers->firstItem() ?? 0 }} to {{ $servers->lastItem() ?? 0 }} of {{ $servers->total() }} servers (25 per page)
                    </small>
                </div>
                <div class="col-sm-6 text-right" style="padding-right: 0;">
                    @if($servers->hasPages())
                        {!! $servers->appends(Request::query())->render() !!}
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

@section('footer-scripts')
    @parent
    <script>
        $('.console-popout').on('click', function (event) {
            event.preventDefault();
            window.open($(this).attr('href'), 'Pterodactyl Console', 'width=800,height=400');
        });
    </script>
@endsection