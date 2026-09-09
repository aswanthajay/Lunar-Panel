@extends('layouts.admin')

@section('title')
    Overview
@endsection

@php
    try {
        $serverCount = \Pterodactyl\Models\Server::count();
        $suspendedServers = \Pterodactyl\Models\Server::where('status', 'suspended')->count();
        $nodeCount = \Pterodactyl\Models\Node::count();
        $userCount = \Pterodactyl\Models\User::count();
        $adminCount = \Pterodactyl\Models\User::where('root_admin', 1)->count();
        $dbHostCount = \Pterodactyl\Models\DatabaseHost::count();
        $locationCount = \Pterodactyl\Models\Location::count();
        $nodesList = \Pterodactyl\Models\Node::withCount('servers')->get();
    } catch (\Throwable $e) {
        $serverCount = 0;
        $suspendedServers = 0;
        $nodeCount = 0;
        $userCount = 0;
        $adminCount = 0;
        $dbHostCount = 0;
        $locationCount = 0;
        $nodesList = collect();
    }
@endphp

@section('content-header')
    <div class="votion-bar-left">
        <h1 class="votion-hero-title font-serif">Executive Overview</h1>
        <p class="votion-hero-desc">
            Fleet of <span class="text-white font-mono">{{ $serverCount }}</span> provisioned instance{{ $serverCount === 1 ? '' : 's' }} &amp; bot{{ $serverCount === 1 ? '' : 's' }} across <span class="text-white font-mono">{{ $nodeCount }}</span> compute hypervisor{{ $nodeCount === 1 ? '' : 's' }} &bull; <span class="text-white font-mono">{{ $locationCount }}</span> cluster {{ \Illuminate\Support\Str::plural('location', $locationCount) }}
        </p>
    </div>

    <div class="votion-bar-right">
        {{-- Digital Live Clock Badge --}}
        <div class="votion-time-badge font-mono">
            <span class="votion-live-dot"></span>
            <span id="votionHeaderClock">--:--:-- UTC</span>
            <span style="color: #333336;">|</span>
            <span style="color: #A0A0A0;">{{ date('M j') }}</span>
        </div>

        {{-- Action Buttons --}}
        <a href="{{ route('admin.servers.new') }}" class="votion-btn-white">
            <i class="fa fa-plus" style="font-size: 10px; margin-right: 4px;"></i> Provision Instance
        </a>

        <a href="{{ route('admin.index') }}" class="votion-btn-dark" title="Force immediate synchronization">
            <i class="fa fa-refresh" style="font-size: 11px; margin-right: 4px;"></i> Refresh
        </a>
    </div>
@endsection

@section('content')
<div class="votion-admin-dashboard">

    {{-- =========================================================================
        1. MASTER 4-TIER EXECUTIVE BENTO GRID (matching DashboardContent.tsx)
       ========================================================================= --}}
    <section class="votion-grid-4">
        
        {{-- TILE 1: COMPUTE ENGINE --}}
        <div class="votion-card-tile">
            <div>
                <div class="votion-tile-head">
                    <span class="votion-kicker">Compute Engine</span>
                    <span class="votion-pill-mono font-mono">{{ $nodeCount }}/{{ $nodeCount ?: 1 }} Nodes</span>
                </div>

                <div class="votion-tile-metrics">
                    <div>
                        <div class="votion-stat-num font-sans">{{ $nodeCount }}</div>
                        <div class="votion-stat-caption">Cluster Hypervisors</div>
                    </div>
                    <div class="votion-spark-wrap">
                        <svg width="88" height="26" viewBox="0 0 88 26" class="votion-sparkline-svg">
                            <defs>
                                <linearGradient id="sparkBlue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.32" />
                                    <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,16 16,18 32,12 48,14 64,8 88,4 88,26" fill="url(#sparkBlue)" />
                            <polyline fill="none" stroke="#3B82F6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="0,16 16,18 32,12 48,14 64,8 88,4" />
                            <circle cx="88" cy="4" r="2.5" fill="#3B82F6" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="votion-tile-foot">
                <div class="votion-usage-bar">
                    <div class="votion-bar-fill" style="width: 100%; background: #3B82F6;"></div>
                </div>
                <div class="votion-foot-meta font-mono">
                    <span style="color: #71717A;">Daemon Protocol:</span>
                    <span style="color: #10B981; font-weight: 500;">Active &bull; Synchronized</span>
                </div>
            </div>
        </div>

        {{-- TILE 2: INSTANCE & BOT FLEET --}}
        <div class="votion-card-tile">
            <div>
                <div class="votion-tile-head">
                    <span class="votion-kicker">Instances &amp; Bots</span>
                    <span class="votion-pill-mono font-mono">{{ $serverCount }} Total</span>
                </div>

                <div class="votion-tile-metrics">
                    <div>
                        <div class="votion-stat-num font-sans">{{ $serverCount }}</div>
                        <div class="votion-stat-caption">Total Provisioned</div>
                    </div>
                    <div class="votion-spark-wrap">
                        <svg width="88" height="26" viewBox="0 0 88 26" class="votion-sparkline-svg">
                            <defs>
                                <linearGradient id="sparkGreen" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#10B981" stop-opacity="0.32" />
                                    <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,20 16,17 32,19 48,10 64,13 88,5 88,26" fill="url(#sparkGreen)" />
                            <polyline fill="none" stroke="#10B981" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="0,20 16,17 32,19 48,10 64,13 88,5" />
                            <circle cx="88" cy="5" r="2.5" fill="#10B981" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="votion-tile-foot">
                <div class="votion-usage-bar">
                    <div class="votion-bar-fill" style="width: {{ $serverCount > 0 ? '100' : '0' }}%; background: #10B981;"></div>
                </div>
                <div class="votion-foot-meta font-mono">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10B981;"></span>
                        <span class="text-white">{{ $serverCount - $suspendedServers }} Active</span>
                    </div>
                    @if($suspendedServers > 0)
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #F59E0B;"></span>
                            <span style="color: #F59E0B;">{{ $suspendedServers }} Suspended</span>
                        </div>
                    @else
                        <span style="color: #71717A;">0 Suspended</span>
                    @endif
                </div>
            </div>
        </div>

        {{-- TILE 3: USER ACCOUNTS --}}
        <div class="votion-card-tile">
            <div>
                <div class="votion-tile-head">
                    <span class="votion-kicker">Client Access</span>
                    <span class="votion-pill-mono font-mono">{{ $userCount }} Users</span>
                </div>

                <div class="votion-tile-metrics">
                    <div>
                        <div class="votion-stat-num font-sans">{{ $userCount }}</div>
                        <div class="votion-stat-caption">Registered Accounts</div>
                    </div>
                    <div class="votion-spark-wrap">
                        <svg width="88" height="26" viewBox="0 0 88 26" class="votion-sparkline-svg">
                            <defs>
                                <linearGradient id="sparkPurple" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#A855F7" stop-opacity="0.32" />
                                    <stop offset="100%" stop-color="#A855F7" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,22 16,18 32,20 48,13 64,15 88,6 88,26" fill="url(#sparkPurple)" />
                            <polyline fill="none" stroke="#A855F7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="0,22 16,18 32,20 48,13 64,15 88,6" />
                            <circle cx="88" cy="6" r="2.5" fill="#A855F7" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="votion-tile-foot">
                <div class="votion-usage-bar">
                    <div class="votion-bar-fill" style="width: {{ $userCount > 0 ? '100' : '0' }}%; background: #A855F7;"></div>
                </div>
                <div class="votion-foot-meta font-mono">
                    <span style="color: #71717A;">Role Partition:</span>
                    <span class="text-white">{{ $adminCount }} {{ \Illuminate\Support\Str::plural('Admin', $adminCount) }} &bull; {{ max(0, $userCount - $adminCount) }} Clients</span>
                </div>
            </div>
        </div>

        {{-- TILE 4: DATABASE & KSM --}}
        <div class="votion-card-tile">
            <div>
                <div class="votion-tile-head">
                    <span class="votion-kicker">Relational DBs</span>
                    <span class="votion-pill-mono font-mono">{{ $dbHostCount }} Connected</span>
                </div>

                <div class="votion-tile-metrics">
                    <div>
                        <div class="votion-stat-num font-sans">{{ $dbHostCount }}</div>
                        <div class="votion-stat-caption">Database Hosts</div>
                    </div>
                    <div class="votion-spark-wrap">
                        <svg width="88" height="26" viewBox="0 0 88 26" class="votion-sparkline-svg">
                            <defs>
                                <linearGradient id="sparkAmber" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.32" />
                                    <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,19 16,19 32,15 48,16 64,10 88,5 88,26" fill="url(#sparkAmber)" />
                            <polyline fill="none" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="0,19 16,19 32,15 48,16 64,10 88,5" />
                            <circle cx="88" cy="5" r="2.5" fill="#F59E0B" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="votion-tile-foot">
                <div class="votion-usage-bar">
                    <div class="votion-bar-fill" style="width: {{ $dbHostCount > 0 ? '100' : '0' }}%; background: #F59E0B;"></div>
                </div>
                <div class="votion-foot-meta font-mono">
                    <a href="{{ route('admin.ksm') }}" style="color: #10B981; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa fa-microchip"></i> KSM Deduplication Active &rarr;
                    </a>
                </div>
            </div>
        </div>

    </section>

    {{-- =========================================================================
        3. HYPERVISOR NODE TOPOLOGY (matching DashboardContent.tsx line 677)
       ========================================================================= --}}
    <section class="votion-panel-card">
        <div class="votion-panel-head">
            <div>
                <h3 class="votion-panel-title font-sans">Hypervisor Node Topology</h3>
                <p class="votion-panel-sub font-sans">Real-time compute nodes, daemon health, memory allocation, and storage pools.</p>
            </div>
            <span class="votion-pill-mono font-mono">{{ $nodeCount }} Nodes Active</span>
        </div>

        <div class="table-responsive" style="margin: 0; border: none;">
            <table class="votion-instrument-table">
                <thead>
                    <tr>
                        <th style="padding-left: 20px;">Node Identity</th>
                        <th>Daemon Status</th>
                        <th>Memory Allocation</th>
                        <th>Disk Capacity</th>
                        <th class="text-center">Instances</th>
                        <th class="text-center">Daemon Port</th>
                        <th class="text-right" style="padding-right: 20px;">Configure</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($nodesList as $node)
                        <tr>
                            <td style="padding-left: 20px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div class="votion-node-icon">
                                        <i class="fa fa-sitemap"></i>
                                    </div>
                                    <div>
                                        <a href="{{ route('admin.nodes.view', $node->id) }}" style="color: #FFFFFF; font-weight: 600; font-size: 13px; text-decoration: none;">
                                            {{ $node->name }}
                                        </a>
                                        <div class="font-mono" style="font-size: 11px; color: #71717A; margin-top: 2px;">
                                            {{ $node->fqdn }}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <td>
                                @if($node->maintenance_mode)
                                    <span class="votion-pill-amber">
                                        <span class="votion-dot-amber"></span> Maintenance
                                    </span>
                                @else
                                    <span class="votion-pill-green">
                                        <span class="votion-dot-green"></span> Online
                                    </span>
                                @endif
                            </td>

                            <td>
                                <div class="font-mono text-white" style="font-size: 11px; font-weight: 500;">
                                    {{ number_format($node->memory) }} MiB
                                </div>
                                <div class="votion-sub-bar">
                                    <div class="votion-sub-fill" style="width: 75%; background: #3B82F6;"></div>
                                </div>
                            </td>

                            <td>
                                <div class="font-mono text-white" style="font-size: 11px; font-weight: 500;">
                                    {{ number_format($node->disk) }} MiB
                                </div>
                                <div class="votion-sub-bar">
                                    <div class="votion-sub-fill" style="width: 60%; background: #10B981;"></div>
                                </div>
                            </td>

                            <td class="text-center font-mono" style="font-size: 12px; font-weight: 600; color: #FFFFFF;">
                                {{ $node->servers_count }}
                            </td>

                            <td class="text-center font-mono" style="font-size: 11px; color: #A0A0A0;">
                                <code>{{ $node->scheme }}://:{{ $node->daemonListen }}</code>
                            </td>

                            <td class="text-right" style="padding-right: 20px;">
                                <a href="{{ route('admin.nodes.view', $node->id) }}" class="votion-btn-icon" title="Configure Node in Admin">
                                    <i class="fa fa-sliders"></i>
                                </a>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 36px 20px; color: #71717A;">
                                No compute nodes provisioned. <a href="{{ route('admin.nodes.new') }}" style="color: #FFFFFF; text-decoration: underline;">Provision a node &rarr;</a>
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </section>

    {{-- =========================================================================
        4. LOWER SPLIT: QUICK OPERATIONS & SYSTEM ENVIRONMENT
       ========================================================================= --}}
    <div class="row">
        
        {{-- LEFT COLUMN: QUICK ADMINISTRATIVE OPERATIONS --}}
        <div class="col-md-6 col-xs-12">
            <div class="votion-panel-card">
                <div class="votion-panel-head">
                    <div>
                        <h3 class="votion-panel-title font-sans">Quick Operations</h3>
                        <p class="votion-panel-sub font-sans">Instant shortcuts to administrative management tasks.</p>
                    </div>
                </div>

                <div class="votion-ops-grid">
                    <a href="{{ route('admin.servers.new') }}" class="votion-op-item">
                        <div class="votion-op-icon">
                            <i class="fa fa-plus"></i>
                        </div>
                        <div>
                            <div class="votion-op-title font-sans">Create Server</div>
                            <div class="votion-op-desc">Provision game instance</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.nodes.new') }}" class="votion-op-item">
                        <div class="votion-op-icon">
                            <i class="fa fa-sitemap"></i>
                        </div>
                        <div>
                            <div class="votion-op-title font-sans">Provision Node</div>
                            <div class="votion-op-desc">Attach daemon runner</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.users.new') }}" class="votion-op-item">
                        <div class="votion-op-icon">
                            <i class="fa fa-user-plus"></i>
                        </div>
                        <div>
                            <div class="votion-op-title font-sans">Add Client</div>
                            <div class="votion-op-desc">Register user account</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.settings') }}" class="votion-op-item">
                        <div class="votion-op-icon">
                            <i class="fa fa-sliders"></i>
                        </div>
                        <div>
                            <div class="votion-op-title font-sans">Settings</div>
                            <div class="votion-op-desc">System configuration</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.ksm') }}" class="votion-op-item">
                        <div class="votion-op-icon" style="color: #10B981; border-color: rgba(16, 185, 129, 0.3);">
                            <i class="fa fa-microchip"></i>
                        </div>
                        <div>
                            <div class="votion-op-title font-sans" style="color: #10B981;">KSM Deduplication</div>
                            <div class="votion-op-desc">Memory saver & tuning</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.api.index') }}" class="votion-op-item">
                        <div class="votion-op-icon">
                            <i class="fa fa-key"></i>
                        </div>
                        <div>
                            <div class="votion-op-title font-sans">Application API</div>
                            <div class="votion-op-desc">Access tokens & webhooks</div>
                        </div>
                    </a>
                </div>
            </div>
        </div>

        {{-- RIGHT COLUMN: SYSTEM ENVIRONMENT INSTRUMENT TABLE --}}
        <div class="col-md-6 col-xs-12">
            <div class="votion-panel-card">
                <div class="votion-panel-head">
                    <div>
                        <h3 class="votion-panel-title font-sans">System Environment</h3>
                        <p class="votion-panel-sub font-sans">Cluster runtime runtime parameters and security posture.</p>
                    </div>
                </div>

                <div class="table-responsive" style="margin: 0; border: none;">
                    <table class="votion-instrument-table">
                        <tbody>
                            <tr>
                                <td style="padding-left: 20px; width: 44%; color: #71717A; font-weight: 500;">Control Panel Version</td>
                                <td class="font-mono text-white"><code>v{{ config('app.version') }}</code></td>
                            </tr>
                            <tr>
                                <td style="padding-left: 20px; color: #71717A; font-weight: 500;">PHP Runtime</td>
                                <td class="font-mono text-white"><code>PHP {{ phpversion() }}</code></td>
                            </tr>
                            <tr>
                                <td style="padding-left: 20px; color: #71717A; font-weight: 500;">Environment Mode</td>
                                <td>
                                    <span class="votion-pill-mono font-mono" style="color: #60A5FA; border-color: rgba(59, 130, 246, 0.3);">
                                        {{ strtoupper(config('app.env', 'production')) }}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding-left: 20px; color: #71717A; font-weight: 500;">2-Factor Authentication</td>
                                <td>
                                    @php $twoFa = config('pterodactyl.auth.2fa_required'); @endphp
                                    @if($twoFa == 2)
                                        <span class="votion-pill-red font-mono">Mandatory (All)</span>
                                    @elseif($twoFa == 1)
                                        <span class="votion-pill-amber font-mono">Admin Only</span>
                                    @else
                                        <span class="votion-pill-mono font-mono">Optional</span>
                                    @endif
                                </td>
                            </tr>
                            <tr>
                                <td style="padding-left: 20px; color: #71717A; font-weight: 500;">Kernel Memory (KSM)</td>
                                <td>
                                    <a href="{{ route('admin.ksm') }}" class="votion-pill-green" style="text-decoration: none;">
                                        <span class="votion-dot-green"></span> Engine Active &bull; View Telemetry
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding-left: 20px; color: #71717A; font-weight: 500;">Cluster Clock / Timezone</td>
                                <td class="font-mono" style="color: #A0A0A0; font-size: 11px;">
                                    {{ config('app.timezone') }} &bull; {{ date('Y-m-d H:i:s') }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

    </div>

</div>

{{-- =========================================================================
    EMBEDDED VOTION LUXURY DARK STYLESHEET (1:1 Votion Match, Zero Cache Blip)
   ========================================================================= --}}
<style>
.content-header {
    border-bottom: 1px solid #1F1F24 !important;
    padding: 20px 28px !important;
    margin-bottom: 24px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    flex-wrap: wrap !important;
    gap: 16px !important;
    width: 100% !important;
    box-sizing: border-box !important;
}

.votion-bar-left {
    flex: 1 1 auto;
    min-width: 240px;
}

.votion-hero-title {
    font-family: var(--font-display, "Newsreader", serif) !important;
    font-size: 26px !important;
    font-weight: 400 !important;
    color: #FFFFFF !important;
    letter-spacing: -0.02em !important;
    margin: 0 !important;
    line-height: 1.2 !important;
}

.votion-hero-desc {
    font-size: 12px;
    color: #8A8A8A;
    margin: 5px 0 0 0;
    line-height: 1.4;
}

.votion-bar-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    flex: 0 0 auto;
}

.votion-admin-dashboard {
    color: #D4D4D4;
    font-family: var(--font-sans, "Inter", sans-serif);
    width: 100% !important;
    max-width: 100% !important;
    display: block !important;
    clear: both !important;
    margin-top: 0 !important;
    box-sizing: border-box !important;
}

.votion-time-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 6px;
    background: #0E0E10;
    border: 1px solid #242428;
    font-size: 11px;
    color: #EDEDED;
}

.votion-live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10B981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
    animation: votionPulseDot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes votionPulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
}

.votion-btn-white {
    background-color: #FFFFFF !important;
    color: #000000 !important;
    font-weight: 600 !important;
    font-size: 12px !important;
    border-radius: 6px !important;
    padding: 6px 14px !important;
    border: 1px solid #FFFFFF !important;
    display: inline-flex;
    align-items: center;
    transition: all 150ms ease;
    text-decoration: none !important;
}
.votion-btn-white:hover {
    background-color: #E5E5E5 !important;
    color: #000000 !important;
}

.votion-btn-dark {
    background-color: #121214 !important;
    color: #D4D4D4 !important;
    font-weight: 500 !important;
    font-size: 12px !important;
    border-radius: 6px !important;
    padding: 6px 14px !important;
    border: 1px solid #242428 !important;
    display: inline-flex;
    align-items: center;
    transition: all 150ms ease;
    text-decoration: none !important;
}
.votion-btn-dark:hover {
    background-color: #1A1A1E !important;
    color: #FFFFFF !important;
    border-color: #383838 !important;
}

/* 2. Bento Grid (4 Columns) */
.votion-grid-4 {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}

@media (min-width: 640px) {
    .votion-grid-4 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (min-width: 1200px) {
    .votion-grid-4 {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

.votion-card-tile {
    background-color: #0A0A0C;
    border: 1px solid #1F1F24;
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 160px;
    transition: border-color 150ms ease, transform 150ms ease;
}

.votion-card-tile:hover {
    border-color: #383842;
    transform: translateY(-1px);
}

.votion-tile-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.votion-kicker {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #71717A;
}

.votion-pill-mono {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: 4px;
    background: #141418;
    border: 1px solid #24242C;
    color: #A0A0A0;
}

.votion-tile-metrics {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 12px;
}

.votion-stat-num {
    font-family: var(--font-sans, "Inter", sans-serif);
    font-size: 32px;
    font-weight: 600;
    color: #FFFFFF;
    line-height: 1;
    letter-spacing: -0.02em;
}

.votion-stat-caption {
    font-size: 11px;
    color: #71717A;
    margin-top: 5px;
}

.votion-spark-wrap {
    flex-shrink: 0;
}

.votion-sparkline-svg {
    display: block;
    overflow: visible;
}

.votion-tile-foot {
    padding-top: 12px;
    border-top: 1px solid #18181E;
}

.votion-usage-bar {
    height: 4px;
    width: 100%;
    background-color: #18181E;
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 8px;
}

.votion-bar-fill {
    height: 100%;
    border-radius: 999px;
}

.votion-foot-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
}

/* 3. Panel Cards */
.votion-panel-card {
    background-color: #0A0A0C;
    border: 1px solid #1F1F24;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 24px;
}

.votion-panel-head {
    padding: 16px 20px;
    border-bottom: 1px solid #18181E;
    background-color: #060608;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
}

.votion-panel-title {
    font-family: var(--font-sans, "Inter", sans-serif);
    font-size: 15px;
    font-weight: 600;
    color: #FFFFFF;
    margin: 0;
    letter-spacing: -0.01em;
}

.votion-panel-sub {
    font-size: 11px;
    color: #71717A;
    margin: 3px 0 0 0;
}

/* 4. Instrument Table */
.votion-instrument-table {
    width: 100%;
    border-collapse: collapse;
}

.votion-instrument-table th {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #666666;
    background-color: #060608;
    padding: 10px 14px;
    border-bottom: 1px solid #18181E;
    text-align: left;
}

.votion-instrument-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #141418;
    font-size: 12px;
    color: #D4D4D4;
    vertical-align: middle;
}

.votion-instrument-table tbody tr:hover {
    background-color: #0E0E12;
}

.votion-instrument-table tbody tr:last-child td {
    border-bottom: none;
}

.votion-node-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background-color: #121216;
    border: 1px solid #22222A;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #A0A0A0;
    font-size: 11px;
    flex-shrink: 0;
}

.votion-sub-bar {
    height: 3px;
    width: 90px;
    background-color: #18181E;
    border-radius: 999px;
    overflow: hidden;
    margin-top: 5px;
}

.votion-sub-fill {
    height: 100%;
    border-radius: 999px;
}

.votion-btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background-color: #121216;
    border: 1px solid #22222A;
    color: #A0A0A0;
    text-decoration: none !important;
    transition: all 150ms ease;
}
.votion-btn-icon:hover {
    background-color: #181820;
    border-color: #383842;
    color: #FFFFFF;
}

/* Pills */
.votion-pill-green {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    background-color: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #10B981;
}

.votion-dot-green {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10B981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
}

.votion-pill-amber {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #F59E0B;
}

.votion-dot-amber {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #F59E0B;
}

.votion-pill-red {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #F87171;
}

/* 5. Quick Operations Grid */
.votion-ops-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 16px 20px;
}

@media (max-width: 500px) {
    .votion-ops-grid {
        grid-template-columns: 1fr;
    }
}

.votion-op-item {
    background-color: #0E0E12;
    border: 1px solid #1F1F26;
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none !important;
    transition: all 150ms ease;
}

.votion-op-item:hover {
    background-color: #14141A;
    border-color: #383844;
    transform: translateY(-1px);
}

.votion-op-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background-color: #181820;
    border: 1px solid #282834;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #A0A0A0;
    font-size: 12px;
    flex-shrink: 0;
    transition: all 150ms ease;
}

.votion-op-item:hover .votion-op-icon {
    color: #FFFFFF;
    border-color: #4B4B58;
}

.votion-op-title {
    font-size: 12px;
    font-weight: 600;
    color: #FFFFFF;
    margin: 0;
}

.votion-op-desc {
    font-size: 11px;
    color: #71717A;
    margin-top: 2px;
}
</style>

@endsection

@section('footer-scripts')
    @parent
    <script>
        $(function () {
            function updateDashClock() {
                var el = document.getElementById('votionHeaderClock');
                if (!el) return;
                var now = new Date();
                var h = String(now.getUTCHours()).padStart(2, '0');
                var m = String(now.getUTCMinutes()).padStart(2, '0');
                var s = String(now.getUTCSeconds()).padStart(2, '0');
                el.textContent = h + ':' + m + ':' + s + ' UTC';
            }
            setInterval(updateDashClock, 1000);
            updateDashClock();
        });
    </script>
@endsection