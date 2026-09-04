@extends('layouts.admin')

@section('title')
    Overview
@endsection

@section('content-header')
    <div>
        <h1>System Infrastructure Overview</h1>
        <small>Live cluster telemetry, compute nodes, and server fleet administration.</small>
    </div>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
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

{{-- Authentic Bento Telemetry Container (from LunarDashboard.tsx) --}}
<div class="lunar-bento-container">
    <div class="lunar-bento-header">
        <div style="display: flex; align-items: center; gap: 8px;">
            <span class="lunar-bento-header-title">Cluster Telemetry</span>
            <span style="color: #333333; font-size: 11px; user-select: none;">/</span>
            <span class="font-mono" style="font-size: 11px; color: #737373;">Production Fleet</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #10B981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);"></span>
            <span class="font-mono" style="font-size: 10px; color: #8A8A8A; text-transform: uppercase; letter-spacing: 0.08em;">
                @if($version->isLatestPanel())
                    v{{ config('app.version') }} &bull; Sync Live
                @else
                    v{{ config('app.version') }} &bull; Update v{{ $version->getPanel() }}
                @endif
            </span>
        </div>
    </div>

    <div class="lunar-bento-grid">
        {{-- Cell 1: Game Servers --}}
        <div class="lunar-bento-cell">
            <div>
                <span class="lunar-bento-label">Game Servers</span>
                <div class="lunar-bento-value">
                    {{ $serverCount }}
                    <span class="lunar-bento-subtext">
                        @if($suspendedServers > 0)
                            / {{ $suspendedServers }} suspended
                        @else
                            / {{ $serverCount }} active
                        @endif
                    </span>
                </div>
            </div>
            <div class="lunar-bento-bar">
                <div class="lunar-bento-bar-fill" style="width: {{ $serverCount > 0 ? '100' : '0' }}%;"></div>
            </div>
        </div>

        {{-- Cell 2: Compute Nodes --}}
        <div class="lunar-bento-cell">
            <div>
                <span class="lunar-bento-label">Compute Nodes</span>
                <div class="lunar-bento-value">
                    {{ $nodeCount }}
                    <span class="lunar-bento-subtext">/ {{ $locationCount }} {{ \Illuminate\Support\Str::plural('location', $locationCount) }}</span>
                </div>
            </div>
            <div class="lunar-bento-bar">
                <div class="lunar-bento-bar-fill" style="width: {{ $nodeCount > 0 ? '100' : '0' }}%;"></div>
            </div>
        </div>

        {{-- Cell 3: User Accounts --}}
        <div class="lunar-bento-cell">
            <div>
                <span class="lunar-bento-label">User Accounts</span>
                <div class="lunar-bento-value">
                    {{ $userCount }}
                    <span class="lunar-bento-subtext">/ {{ $adminCount }} {{ \Illuminate\Support\Str::plural('admin', $adminCount) }}</span>
                </div>
            </div>
            <div class="lunar-bento-bar">
                <div class="lunar-bento-bar-fill" style="width: {{ $userCount > 0 ? '100' : '0' }}%;"></div>
            </div>
        </div>

        {{-- Cell 4: Databases --}}
        <div class="lunar-bento-cell">
            <div>
                <span class="lunar-bento-label">Database Hosts</span>
                <div class="lunar-bento-value">
                    {{ $dbHostCount }}
                    <span class="lunar-bento-subtext">connected</span>
                </div>
            </div>
            <div class="lunar-bento-bar">
                <div class="lunar-bento-bar-fill" style="width: {{ $dbHostCount > 0 ? '100' : '0' }}%;"></div>
            </div>
        </div>
    </div>
</div>

{{-- Quick Administrative Actions --}}
<div class="row">
    <div class="col-xs-12">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title">Quick Operations</h3>
            </div>
            <div class="box-body" style="padding: 16px;">
                <div class="row">
                    <div class="col-xs-12 col-sm-6 col-md-3" style="margin-bottom: 10px;">
                        <a href="{{ route('admin.servers.new') }}" class="lunar-action-card">
                            <div class="lunar-action-card-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </div>
                            <div>
                                <h4 class="lunar-action-card-title">Create Server</h4>
                                <p class="lunar-action-card-desc">Provision instance</p>
                            </div>
                        </a>
                    </div>

                    <div class="col-xs-12 col-sm-6 col-md-3" style="margin-bottom: 10px;">
                        <a href="{{ route('admin.nodes.new') }}" class="lunar-action-card">
                            <div class="lunar-action-card-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                                    <line x1="6" y1="6" x2="6.01" y2="6"></line>
                                    <line x1="6" y1="18" x2="6.01" y2="18"></line>
                                </svg>
                            </div>
                            <div>
                                <h4 class="lunar-action-card-title">Provision Node</h4>
                                <p class="lunar-action-card-desc">Attach daemon runner</p>
                            </div>
                        </a>
                    </div>

                    <div class="col-xs-12 col-sm-6 col-md-3" style="margin-bottom: 10px;">
                        <a href="{{ route('admin.users.new') }}" class="lunar-action-card">
                            <div class="lunar-action-card-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="8.5" cy="7" r="4"></circle>
                                    <line x1="20" y1="8" x2="20" y2="14"></line>
                                    <line x1="23" y1="11" x2="17" y2="11"></line>
                                </svg>
                            </div>
                            <div>
                                <h4 class="lunar-action-card-title">Add User</h4>
                                <p class="lunar-action-card-desc">Register client account</p>
                            </div>
                        </a>
                    </div>

                    <div class="col-xs-12 col-sm-6 col-md-3" style="margin-bottom: 10px;">
                        <a href="{{ route('admin.settings') }}" class="lunar-action-card">
                            <div class="lunar-action-card-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </div>
                            <div>
                                <h4 class="lunar-action-card-title">Settings</h4>
                                <p class="lunar-action-card-desc">Configure system & mail</p>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

{{-- Environment & Documentation --}}
<div class="row">
    <div class="col-md-7 col-xs-12">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title">System Environment</h3>
            </div>
            <div class="box-body no-padding">
                <table class="table table-hover">
                    <tbody>
                        <tr>
                            <td style="width: 38%; color: #6B7280; font-family: var(--font-sans); font-size: 11px; font-weight: 500;">Control Panel Version</td>
                            <td><code>v{{ config('app.version') }}</code></td>
                        </tr>
                        <tr>
                            <td style="color: #6B7280; font-family: var(--font-sans); font-size: 11px; font-weight: 500;">PHP Runtime</td>
                            <td><code>PHP {{ phpversion() }}</code></td>
                        </tr>
                        <tr>
                            <td style="color: #6B7280; font-family: var(--font-sans); font-size: 11px; font-weight: 500;">Environment Mode</td>
                            <td>
                                <span class="label label-info">{{ strtoupper(config('app.env', 'production')) }}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #6B7280; font-family: var(--font-sans); font-size: 11px; font-weight: 500;">2-Factor Authentication</td>
                            <td>
                                @php $twoFa = config('pterodactyl.auth.2fa_required'); @endphp
                                @if($twoFa == 2)
                                    <span class="label label-danger">Mandatory (All)</span>
                                @elseif($twoFa == 1)
                                    <span class="label label-warning">Admin Only</span>
                                @else
                                    <span class="label label-default">Optional</span>
                                @endif
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #6B7280; font-family: var(--font-sans); font-size: 11px; font-weight: 500;">Cluster Clock / Timezone</td>
                            <td class="font-mono" style="font-size: 11px; color: #A0A0A0;">{{ config('app.timezone') }} &bull; {{ date('Y-m-d H:i:s') }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="col-md-5 col-xs-12">
        <div class="box">
            <div class="box-header">
                <h3 class="box-title">Support & Documentation</h3>
            </div>
            <div class="box-body" style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
                <a href="https://pterodactyl.io" target="_blank" class="lunar-action-card">
                    <div class="lunar-action-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                        </svg>
                    </div>
                    <div>
                        <h4 class="lunar-action-card-title">Documentation</h4>
                        <p class="lunar-action-card-desc">Official manuals & configuration</p>
                    </div>
                </a>

                <a href="{{ $version->getDiscord() }}" target="_blank" class="lunar-action-card">
                    <div class="lunar-action-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <div>
                        <h4 class="lunar-action-card-title">Community Discord</h4>
                        <p class="lunar-action-card-desc">Troubleshooting & operational support</p>
                    </div>
                </a>

                <a href="{{ route('admin.api.index') }}" class="lunar-action-card">
                    <div class="lunar-action-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                    </div>
                    <div>
                        <h4 class="lunar-action-card-title">Application API</h4>
                        <p class="lunar-action-card-desc">Cluster API keys and webhooks</p>
                    </div>
                </a>
            </div>
        </div>
    </div>
</div>
@endsection
