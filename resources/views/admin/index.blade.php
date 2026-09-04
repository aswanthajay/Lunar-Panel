@extends('layouts.admin')

@section('title')
    Overview
@endsection

@section('content-header')
    <h1>Lunar Control Center<small>Real-time infrastructure health & management overview.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}"><i class="fa fa-dashboard"></i> Admin</a></li>
        <li class="active">Overview</li>
    </ol>
@endsection

@section('content')
@php
    $serverCount = \Pterodactyl\Models\Server::count();
    $suspendedServers = \Pterodactyl\Models\Server::where('status', 'suspended')->count();
    $nodeCount = \Pterodactyl\Models\Node::count();
    $userCount = \Pterodactyl\Models\User::count();
    $adminCount = \Pterodactyl\Models\User::where('root_admin', 1)->count();
    $dbHostCount = \Pterodactyl\Models\DatabaseHost::count();
    $locationCount = \Pterodactyl\Models\Location::count();
@endphp

{{-- Hero Status Banner --}}
<div class="lunar-hero-banner">
    <div>
        <h2 class="lunar-hero-title">Lunar Infrastructure Overview</h2>
        <p class="lunar-hero-subtitle">All systems operating within normal parameters. Cluster services are online.</p>
    </div>
    <div>
        @if ($version->isLatestPanel())
            <div class="lunar-status-pill up-to-date">
                <span class="lunar-status-dot"></span>
                <span>System Up-to-Date &bull; v{{ config('app.version') }}</span>
            </div>
        @else
            <div class="lunar-status-pill outdated">
                <span class="lunar-status-dot"></span>
                <span>Update Available: v{{ $version->getPanel() }}</span>
            </div>
        @endif
    </div>
</div>

{{-- Metric Telemetry Cards Grid --}}
<div class="row">
    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="lunar-metric-card">
            <div class="lunar-metric-info">
                <span class="lunar-metric-label">Game Servers</span>
                <span class="lunar-metric-value">{{ $serverCount }}</span>
                <span class="lunar-metric-subtext">
                    @if($suspendedServers > 0)
                        <span class="text-warning">{{ $suspendedServers }} suspended</span>
                    @else
                        <span class="text-success">All active & healthy</span>
                    @endif
                </span>
            </div>
            <div class="lunar-metric-icon-wrap indigo">
                <i class="fa fa-server"></i>
            </div>
        </div>
    </div>

    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="lunar-metric-card">
            <div class="lunar-metric-info">
                <span class="lunar-metric-label">Compute Nodes</span>
                <span class="lunar-metric-value">{{ $nodeCount }}</span>
                <span class="lunar-metric-subtext">
                    Across {{ $locationCount }} {{ \Illuminate\Support\Str::plural('location', $locationCount) }}
                </span>
            </div>
            <div class="lunar-metric-icon-wrap emerald">
                <i class="fa fa-sitemap"></i>
            </div>
        </div>
    </div>

    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="lunar-metric-card">
            <div class="lunar-metric-info">
                <span class="lunar-metric-label">User Accounts</span>
                <span class="lunar-metric-value">{{ $userCount }}</span>
                <span class="lunar-metric-subtext">
                    {{ $adminCount }} {{ \Illuminate\Support\Str::plural('administrator', $adminCount) }}
                </span>
            </div>
            <div class="lunar-metric-icon-wrap amber">
                <i class="fa fa-users"></i>
            </div>
        </div>
    </div>

    <div class="col-xs-12 col-sm-6 col-md-3">
        <div class="lunar-metric-card">
            <div class="lunar-metric-info">
                <span class="lunar-metric-label">Databases</span>
                <span class="lunar-metric-value">{{ $dbHostCount }}</span>
                <span class="lunar-metric-subtext">Active database hosts</span>
            </div>
            <div class="lunar-metric-icon-wrap sky">
                <i class="fa fa-database"></i>
            </div>
        </div>
    </div>
</div>

{{-- Quick Administrative Actions Grid --}}
<div class="row">
    <div class="col-xs-12">
        <div class="box">
            <div class="box-header with-border">
                <h3 class="box-title"><i class="fa fa-bolt text-warning" style="margin-right: 8px;"></i> Quick Actions</h3>
            </div>
            <div class="box-body" style="padding: 16px 20px;">
                <div class="row">
                    <div class="col-xs-12 col-sm-6 col-md-3" style="margin-bottom: 12px;">
                        <a href="{{ route('admin.servers.new') }}" class="lunar-action-tile">
                            <div class="lunar-action-tile-icon">
                                <i class="fa fa-plus"></i>
                            </div>
                            <div>
                                <div class="lunar-action-tile-title">Create Server</div>
                                <div class="lunar-action-tile-desc">Deploy a new game server instance</div>
                            </div>
                        </a>
                    </div>

                    <div class="col-xs-12 col-sm-6 col-md-3" style="margin-bottom: 12px;">
                        <a href="{{ route('admin.nodes.new') }}" class="lunar-action-tile">
                            <div class="lunar-action-tile-icon">
                                <i class="fa fa-hdd-o"></i>
                            </div>
                            <div>
                                <div class="lunar-action-tile-title">Provision Node</div>
                                <div class="lunar-action-tile-desc">Connect a new daemon daemon runner</div>
                            </div>
                        </a>
                    </div>

                    <div class="col-xs-12 col-sm-6 col-md-3" style="margin-bottom: 12px;">
                        <a href="{{ route('admin.users.new') }}" class="lunar-action-tile">
                            <div class="lunar-action-tile-icon">
                                <i class="fa fa-user-plus"></i>
                            </div>
                            <div>
                                <div class="lunar-action-tile-title">Add User</div>
                                <div class="lunar-action-tile-desc">Register client or administrator</div>
                            </div>
                        </a>
                    </div>

                    <div class="col-xs-12 col-sm-6 col-md-3" style="margin-bottom: 12px;">
                        <a href="{{ route('admin.settings') }}" class="lunar-action-tile">
                            <div class="lunar-action-tile-icon">
                                <i class="fa fa-cog"></i>
                            </div>
                            <div>
                                <div class="lunar-action-tile-title">System Settings</div>
                                <div class="lunar-action-tile-desc">Configure security, mail & panel</div>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

{{-- Environment & System Telemetry --}}
<div class="row">
    <div class="col-md-7 col-xs-12">
        <div class="box">
            <div class="box-header with-border">
                <h3 class="box-title"><i class="fa fa-shield text-info" style="margin-right: 8px;"></i> System Environment</h3>
            </div>
            <div class="box-body no-padding">
                <table class="table table-hover">
                    <tbody>
                        <tr>
                            <td style="width: 35%; color: var(--lunar-text-dim); font-weight: 600;">Control Panel Version</td>
                            <td><code>v{{ config('app.version') }}</code></td>
                        </tr>
                        <tr>
                            <td style="color: var(--lunar-text-dim); font-weight: 600;">PHP Runtime</td>
                            <td><code>PHP {{ phpversion() }}</code></td>
                        </tr>
                        <tr>
                            <td style="color: var(--lunar-text-dim); font-weight: 600;">Environment</td>
                            <td>
                                <span class="label label-primary">{{ strtoupper(config('app.env', 'production')) }}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="color: var(--lunar-text-dim); font-weight: 600;">Two-Factor Requirement</td>
                            <td>
                                @php $twoFa = config('pterodactyl.auth.2fa_required'); @endphp
                                @if($twoFa == 2)
                                    <span class="label label-danger">Mandatory for All Users</span>
                                @elseif($twoFa == 1)
                                    <span class="label label-warning">Admins Only</span>
                                @else
                                    <span class="label label-default">Optional</span>
                                @endif
                            </td>
                        </tr>
                        <tr>
                            <td style="color: var(--lunar-text-dim); font-weight: 600;">Timezone / Clock</td>
                            <td>{{ config('app.timezone') }} &bull; {{ date('Y-m-d H:i:s T') }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="col-md-5 col-xs-12">
        <div class="box">
            <div class="box-header with-border">
                <h3 class="box-title"><i class="fa fa-life-ring text-success" style="margin-right: 8px;"></i> Support & Documentation</h3>
            </div>
            <div class="box-body" style="display: flex; flex-direction: column; gap: 10px;">
                <p class="text-muted small no-margin" style="margin-bottom: 8px;">
                    Access Lunar Panel documentation, API specifications, and community resources.
                </p>
                <a href="https://pterodactyl.io" target="_blank" class="lunar-action-tile" style="padding: 12px 14px;">
                    <div class="lunar-action-tile-icon" style="width: 32px; height: 32px; font-size: 13px;">
                        <i class="fa fa-book"></i>
                    </div>
                    <div>
                        <div class="lunar-action-tile-title" style="font-size: 12px;">Documentation</div>
                        <div class="lunar-action-tile-desc">Official configuration manuals and guides</div>
                    </div>
                </a>
                <a href="{{ $version->getDiscord() }}" target="_blank" class="lunar-action-tile" style="padding: 12px 14px;">
                    <div class="lunar-action-tile-icon" style="width: 32px; height: 32px; font-size: 13px;">
                        <i class="fa fa-comments"></i>
                    </div>
                    <div>
                        <div class="lunar-action-tile-title" style="font-size: 12px;">Community Discord</div>
                        <div class="lunar-action-tile-desc">Real-time troubleshooting & support</div>
                    </div>
                </a>
                <a href="{{ route('admin.api.index') }}" class="lunar-action-tile" style="padding: 12px 14px;">
                    <div class="lunar-action-tile-icon" style="width: 32px; height: 32px; font-size: 13px;">
                        <i class="fa fa-code"></i>
                    </div>
                    <div>
                        <div class="lunar-action-tile-title" style="font-size: 12px;">Application API</div>
                        <div class="lunar-action-tile-desc">Manage API credentials & webhooks</div>
                    </div>
                </a>
            </div>
        </div>
    </div>
</div>
@endsection
