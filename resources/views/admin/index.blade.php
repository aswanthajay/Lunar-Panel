@extends('layouts.admin')

@section('title')
    Overview
@endsection

@section('content-header')
    <h1>Overview<small>Live cluster telemetry, compute nodes, and server fleet administration.</small></h1>
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

{{-- Executive Context Bar --}}
<div class="votion-context-bar">
    <div class="votion-context-left">
        <div class="votion-context-badge">
            <span class="votion-clock-dot"></span>
            <span style="color: #FFFFFF; font-weight: 500;">Fleet Cluster: Operational & Synchronized</span>
        </div>
        <span style="color: #333333;">&bull;</span>
        <div class="votion-context-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Daemon Runner Protocol Active</span>
        </div>
    </div>
    <div class="votion-context-right">
        <div class="votion-context-badge">
            <span style="color: #71717A;">Release:</span>
            <code style="font-size: 10px;">v{{ config('app.version') }}</code>
        </div>
        <a href="{{ route('admin.ksm') }}" class="btn btn-xs btn-default" style="font-family: var(--font-mono); font-size: 10px; gap: 4px;">
            <i class="fa fa-microchip" style="color: #10B981;"></i> KSM Telemetry &rarr;
        </a>
    </div>
</div>

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
            <div class="lunar-bento-top-row">
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
                <svg class="votion-sparkline votion-sparkline-green" viewBox="0 0 68 26">
                    <polyline points="0,20 10,18 20,22 30,12 40,15 50,8 60,11 68,5" />
                </svg>
            </div>
            <div class="lunar-bento-bar">
                <div class="lunar-bento-bar-fill" style="width: {{ $serverCount > 0 ? '100' : '0' }}%;"></div>
            </div>
        </div>

        {{-- Cell 2: Compute Nodes --}}
        <div class="lunar-bento-cell">
            <div class="lunar-bento-top-row">
                <div>
                    <span class="lunar-bento-label">Compute Nodes</span>
                    <div class="lunar-bento-value">
                        {{ $nodeCount }}
                        <span class="lunar-bento-subtext">/ {{ $locationCount }} {{ \Illuminate\Support\Str::plural('location', $locationCount) }}</span>
                    </div>
                </div>
                <svg class="votion-sparkline votion-sparkline-blue" viewBox="0 0 68 26">
                    <polyline points="0,22 12,19 24,19 36,10 48,14 60,6 68,9" />
                </svg>
            </div>
            <div class="lunar-bento-bar">
                <div class="lunar-bento-bar-fill" style="width: {{ $nodeCount > 0 ? '100' : '0' }}%; background-color: #3B82F6;"></div>
            </div>
        </div>

        {{-- Cell 3: User Accounts --}}
        <div class="lunar-bento-cell">
            <div class="lunar-bento-top-row">
                <div>
                    <span class="lunar-bento-label">User Accounts</span>
                    <div class="lunar-bento-value">
                        {{ $userCount }}
                        <span class="lunar-bento-subtext">/ {{ $adminCount }} {{ \Illuminate\Support\Str::plural('admin', $adminCount) }}</span>
                    </div>
                </div>
                <svg class="votion-sparkline votion-sparkline-purple" viewBox="0 0 68 26">
                    <polyline points="0,24 14,20 28,21 42,13 54,16 68,7" />
                </svg>
            </div>
            <div class="lunar-bento-bar">
                <div class="lunar-bento-bar-fill" style="width: {{ $userCount > 0 ? '100' : '0' }}%; background-color: #A855F7;"></div>
            </div>
        </div>

        {{-- Cell 4: Databases --}}
        <div class="lunar-bento-cell">
            <div class="lunar-bento-top-row">
                <div>
                    <span class="lunar-bento-label">Database Hosts</span>
                    <div class="lunar-bento-value">
                        {{ $dbHostCount }}
                        <span class="lunar-bento-subtext">connected</span>
                    </div>
                </div>
                <svg class="votion-sparkline votion-sparkline-amber" viewBox="0 0 68 26">
                    <polyline points="0,18 12,18 24,14 36,16 48,9 60,11 68,4" />
                </svg>
            </div>
            <div class="lunar-bento-bar">
                <div class="lunar-bento-bar-fill" style="width: {{ $dbHostCount > 0 ? '100' : '0' }}%; background-color: #F59E0B;"></div>
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
                            <td style="color: #6B7280; font-family: var(--font-sans); font-size: 11px; font-weight: 500;">Kernel Memory (KSM)</td>
                            <td>
                                <a href="{{ route('admin.ksm') }}" class="status-pill status-active" style="text-decoration: none;">
                                    <span class="status-pill-dot"></span>
                                    <span>Engine Active &bull; View Dashboard</span>
                                </a>
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

                <a href="{{ route('admin.ksm') }}" class="lunar-action-card">
                    <div class="lunar-action-card-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                            <rect x="9" y="9" width="6" height="6"></rect>
                            <line x1="9" y1="1" x2="9" y2="4"></line>
                            <line x1="15" y1="1" x2="15" y2="4"></line>
                            <line x1="9" y1="20" x2="9" y2="23"></line>
                            <line x1="15" y1="20" x2="15" y2="23"></line>
                            <line x1="20" y1="9" x2="23" y2="9"></line>
                            <line x1="20" y1="15" x2="23" y2="15"></line>
                            <line x1="1" y1="9" x2="4" y2="9"></line>
                            <line x1="1" y1="15" x2="4" y2="15"></line>
                        </svg>
                    </div>
                    <div>
                        <h4 class="lunar-action-card-title">Kernel Memory (KSM)</h4>
                        <p class="lunar-action-card-desc">Deduplication engine & memory saver</p>
                    </div>
                </a>
            </div>
        </div>
    </div>
</div>
@endsection