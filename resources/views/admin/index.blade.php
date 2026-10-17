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
    <div class="shadcn-hero-header">
        <div class="shadcn-hero-left">
            <div class="flex items-center gap-2 mb-1">
                <span class="shadcn-pill-accent">Fleet Control</span>
                <span class="text-zinc-600 text-xs">•</span>
                <span class="text-zinc-400 text-xs font-mono">Region Cluster Alpha</span>
            </div>
            <h1 class="shadcn-hero-title">Executive Overview</h1>
            <p class="shadcn-hero-desc">
                Fleet of <span class="shadcn-chip-mono">{{ $serverCount }}</span> provisioned instance{{ $serverCount === 1 ? '' : 's' }} across <span class="shadcn-chip-mono">{{ $nodeCount }}</span> compute hypervisor{{ $nodeCount === 1 ? '' : 's' }} &bull; <span class="shadcn-chip-mono">{{ $locationCount }}</span> cluster {{ \Illuminate\Support\Str::plural('location', $locationCount) }}
            </p>
        </div>

        <div class="shadcn-hero-right">
            {{-- Digital Live Clock Badge --}}
            <div class="shadcn-clock-badge font-mono" title="Cluster Telemetry Clock">
                <span class="shadcn-live-dot"></span>
                <span id="votionHeaderClock">--:--:-- UTC</span>
                <span class="shadcn-clock-sep">|</span>
                <span class="text-zinc-400">{{ date('M j, Y') }}</span>
            </div>

            {{-- Action Buttons --}}
            <a href="{{ route('admin.servers.new') }}" class="shadcn-btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Provision Instance</span>
            </a>

            <a href="{{ route('admin.index') }}" class="shadcn-btn-secondary" title="Force immediate synchronization">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                <span>Refresh</span>
            </a>
        </div>
    </div>
@endsection

@section('content')
<div class="shadcn-dashboard-wrapper">

    {{-- =========================================================================
        1. MASTER 4-TIER EXECUTIVE BENTO GRID (shadcn/ui style Card components)
       ========================================================================= --}}
    <section class="shadcn-grid-4">
        
        {{-- TILE 1: COMPUTE ENGINE --}}
        <div class="shadcn-card-metric">
            <div class="shadcn-metric-top">
                <div class="shadcn-metric-head">
                    <div class="flex items-center gap-2">
                        <div class="shadcn-icon-box shadcn-icon-blue">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                                <line x1="6" y1="18" x2="6.01" y2="18"></line>
                            </svg>
                        </div>
                        <span class="shadcn-kicker">Compute Engine</span>
                    </div>
                    <span class="shadcn-badge-mono font-mono">{{ $nodeCount }}/{{ $nodeCount ?: 1 }} Nodes</span>
                </div>

                <div class="shadcn-metric-body">
                    <div>
                        <div class="shadcn-stat-number font-sans">{{ $nodeCount }}</div>
                        <div class="shadcn-stat-label">Cluster Hypervisors</div>
                    </div>
                    <div class="shadcn-sparkline-wrap">
                        <svg width="92" height="28" viewBox="0 0 92 28" class="shadcn-spark-svg">
                            <defs>
                                <linearGradient id="sparkBlueGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.28" />
                                    <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,28 0,18 18,19 36,13 54,15 72,9 92,4 92,28" fill="url(#sparkBlueGrad)" />
                            <polyline fill="none" stroke="#3B82F6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,18 18,19 36,13 54,15 72,9 92,4" />
                            <circle cx="92" cy="4" r="2.5" fill="#3B82F6" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="shadcn-metric-foot">
                <div class="shadcn-progress-track">
                    <div class="shadcn-progress-fill" style="width: 100%; background: linear-gradient(90deg, #3B82F6, #60A5FA);"></div>
                </div>
                <div class="shadcn-foot-meta font-mono">
                    <span class="text-zinc-500">Daemon:</span>
                    <span class="shadcn-status-chip-green">
                        <span class="shadcn-pulse-dot-sm"></span>
                        Active • Synchronized
                    </span>
                </div>
            </div>
        </div>

        {{-- TILE 2: INSTANCES & BOTS --}}
        <div class="shadcn-card-metric">
            <div class="shadcn-metric-top">
                <div class="shadcn-metric-head">
                    <div class="flex items-center gap-2">
                        <div class="shadcn-icon-box shadcn-icon-emerald">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                <polyline points="2 17 12 22 22 17"></polyline>
                                <polyline points="2 12 12 17 22 12"></polyline>
                            </svg>
                        </div>
                        <span class="shadcn-kicker">Instances &amp; Bots</span>
                    </div>
                    <span class="shadcn-badge-mono font-mono">{{ $serverCount }} Total</span>
                </div>

                <div class="shadcn-metric-body">
                    <div>
                        <div class="shadcn-stat-number font-sans">{{ $serverCount }}</div>
                        <div class="shadcn-stat-label">Total Provisioned</div>
                    </div>
                    <div class="shadcn-sparkline-wrap">
                        <svg width="92" height="28" viewBox="0 0 92 28" class="shadcn-spark-svg">
                            <defs>
                                <linearGradient id="sparkGreenGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#10B981" stop-opacity="0.28" />
                                    <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,28 0,22 18,18 36,20 54,11 72,14 92,5 92,28" fill="url(#sparkGreenGrad)" />
                            <polyline fill="none" stroke="#10B981" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,22 18,18 36,20 54,11 72,14 92,5" />
                            <circle cx="92" cy="5" r="2.5" fill="#10B981" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="shadcn-metric-foot">
                <div class="shadcn-progress-track">
                    <div class="shadcn-progress-fill" style="width: {{ $serverCount > 0 ? '100' : '0' }}%; background: linear-gradient(90deg, #10B981, #34D399);"></div>
                </div>
                <div class="shadcn-foot-meta font-mono">
                    <div class="flex items-center gap-1.5">
                        <span class="shadcn-indicator-dot bg-emerald-500"></span>
                        <span class="text-zinc-200">{{ $serverCount - $suspendedServers }} Active</span>
                    </div>
                    @if($suspendedServers > 0)
                        <div class="flex items-center gap-1.5">
                            <span class="shadcn-indicator-dot bg-amber-500"></span>
                            <span class="text-amber-400">{{ $suspendedServers }} Suspended</span>
                        </div>
                    @else
                        <span class="text-zinc-500">0 Suspended</span>
                    @endif
                </div>
            </div>
        </div>

        {{-- TILE 3: USER ACCOUNTS --}}
        <div class="shadcn-card-metric">
            <div class="shadcn-metric-top">
                <div class="shadcn-metric-head">
                    <div class="flex items-center gap-2">
                        <div class="shadcn-icon-box shadcn-icon-purple">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <span class="shadcn-kicker">Client Access</span>
                    </div>
                    <span class="shadcn-badge-mono font-mono">{{ $userCount }} Users</span>
                </div>

                <div class="shadcn-metric-body">
                    <div>
                        <div class="shadcn-stat-number font-sans">{{ $userCount }}</div>
                        <div class="shadcn-stat-label">Registered Accounts</div>
                    </div>
                    <div class="shadcn-sparkline-wrap">
                        <svg width="92" height="28" viewBox="0 0 92 28" class="shadcn-spark-svg">
                            <defs>
                                <linearGradient id="sparkPurpleGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#A855F7" stop-opacity="0.28" />
                                    <stop offset="100%" stop-color="#A855F7" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,28 0,23 18,19 36,21 54,14 72,16 92,6 92,28" fill="url(#sparkPurpleGrad)" />
                            <polyline fill="none" stroke="#A855F7" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,23 18,19 36,21 54,14 72,16 92,6" />
                            <circle cx="92" cy="6" r="2.5" fill="#A855F7" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="shadcn-metric-foot">
                <div class="shadcn-progress-track">
                    <div class="shadcn-progress-fill" style="width: {{ $userCount > 0 ? '100' : '0' }}%; background: linear-gradient(90deg, #A855F7, #C084FC);"></div>
                </div>
                <div class="shadcn-foot-meta font-mono">
                    <span class="text-zinc-500">Partition:</span>
                    <span class="text-zinc-200">{{ $adminCount }} {{ \Illuminate\Support\Str::plural('Admin', $adminCount) }} &bull; {{ max(0, $userCount - $adminCount) }} Clients</span>
                </div>
            </div>
        </div>

        {{-- TILE 4: DATABASE & KSM --}}
        <div class="shadcn-card-metric">
            <div class="shadcn-metric-top">
                <div class="shadcn-metric-head">
                    <div class="flex items-center gap-2">
                        <div class="shadcn-icon-box shadcn-icon-amber">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                            </svg>
                        </div>
                        <span class="shadcn-kicker">Relational DBs</span>
                    </div>
                    <span class="shadcn-badge-mono font-mono">{{ $dbHostCount }} Connected</span>
                </div>

                <div class="shadcn-metric-body">
                    <div>
                        <div class="shadcn-stat-number font-sans">{{ $dbHostCount }}</div>
                        <div class="shadcn-stat-label">Database Hosts</div>
                    </div>
                    <div class="shadcn-sparkline-wrap">
                        <svg width="92" height="28" viewBox="0 0 92 28" class="shadcn-spark-svg">
                            <defs>
                                <linearGradient id="sparkAmberGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.28" />
                                    <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,28 0,20 18,20 36,16 54,17 72,11 92,6 92,28" fill="url(#sparkAmberGrad)" />
                            <polyline fill="none" stroke="#F59E0B" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,20 18,20 36,16 54,17 72,11 92,6" />
                            <circle cx="92" cy="6" r="2.5" fill="#F59E0B" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="shadcn-metric-foot">
                <div class="shadcn-progress-track">
                    <div class="shadcn-progress-fill" style="width: {{ $dbHostCount > 0 ? '100' : '0' }}%; background: linear-gradient(90deg, #F59E0B, #FBBF24);"></div>
                </div>
                <div class="shadcn-foot-meta font-mono">
                    <a href="{{ route('admin.ksm') }}" class="shadcn-link-emerald">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                            <rect x="9" y="9" width="6" height="6"></rect>
                            <line x1="9" y1="1" x2="9" y2="4"></line>
                            <line x1="15" y1="1" x2="15" y2="4"></line>
                            <line x1="9" y1="20" x2="9" y2="23"></line>
                            <line x1="15" y1="20" x2="15" y2="23"></line>
                            <line x1="20" y1="9" x2="23" y2="9"></line>
                            <line x1="20" y1="14" x2="23" y2="14"></line>
                            <line x1="1" y1="9" x2="4" y2="9"></line>
                            <line x1="1" y1="14" x2="4" y2="14"></line>
                        </svg>
                        <span>KSM Active &rarr;</span>
                    </a>
                </div>
            </div>
        </div>

    </section>

    {{-- =========================================================================
        2. HYPERVISOR NODE TOPOLOGY (shadcn/ui Data Table)
       ========================================================================= --}}
    <section class="shadcn-panel-card">
        <div class="shadcn-panel-header">
            <div>
                <div class="flex items-center gap-2 mb-0.5">
                    <h3 class="shadcn-panel-title">Hypervisor Node Topology</h3>
                    <span class="shadcn-badge-success font-mono">Active Mesh</span>
                </div>
                <p class="shadcn-panel-subtitle">Real-time compute nodes, daemon health, memory allocation, and storage pools.</p>
            </div>
            <span class="shadcn-badge-mono font-mono">{{ $nodeCount }} Nodes Active</span>
        </div>

        <div class="table-responsive" style="margin: 0; border: none;">
            <table class="shadcn-table">
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
                                <div class="flex items-center gap-3">
                                    <div class="shadcn-table-node-icon">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                                            <line x1="6" y1="6" x2="6.01" y2="6"></line>
                                            <line x1="6" y1="18" x2="6.01" y2="18"></line>
                                        </svg>
                                    </div>
                                    <div>
                                        <a href="{{ route('admin.nodes.view', $node->id) }}" class="shadcn-node-name">
                                            {{ $node->name }}
                                        </a>
                                        <div class="shadcn-node-fqdn font-mono">
                                            {{ $node->fqdn }}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <td>
                                @if($node->maintenance_mode)
                                    <span class="shadcn-pill-amber">
                                        <span class="shadcn-dot-amber"></span> Maintenance
                                    </span>
                                @else
                                    <span class="shadcn-pill-emerald">
                                        <span class="shadcn-dot-emerald"></span> Online
                                    </span>
                                @endif
                            </td>

                            <td>
                                <div class="font-mono text-zinc-100 font-medium text-xs">
                                    {{ number_format($node->memory) }} MiB
                                </div>
                                <div class="shadcn-mini-bar">
                                    <div class="shadcn-mini-fill" style="width: 75%; background: #3B82F6;"></div>
                                </div>
                            </td>

                            <td>
                                <div class="font-mono text-zinc-100 font-medium text-xs">
                                    {{ number_format($node->disk) }} MiB
                                </div>
                                <div class="shadcn-mini-bar">
                                    <div class="shadcn-mini-fill" style="width: 60%; background: #10B981;"></div>
                                </div>
                            </td>

                            <td class="text-center font-mono font-semibold text-zinc-100 text-xs">
                                <span class="shadcn-cell-badge">{{ $node->servers_count }}</span>
                            </td>

                            <td class="text-center font-mono text-xs text-zinc-400">
                                <code class="shadcn-code-chip">{{ $node->scheme }}://:{{ $node->daemonListen }}</code>
                            </td>

                            <td class="text-right" style="padding-right: 20px;">
                                <a href="{{ route('admin.nodes.view', $node->id) }}" class="shadcn-btn-ghost-icon" title="Configure Node">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="4" y1="21" x2="4" y2="14"></line>
                                        <line x1="4" y1="10" x2="4" y2="3"></line>
                                        <line x1="12" y1="21" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12" y2="3"></line>
                                        <line x1="20" y1="21" x2="20" y2="16"></line>
                                        <line x1="20" y1="12" x2="20" y2="3"></line>
                                        <line x1="1" y1="14" x2="7" y2="14"></line>
                                        <line x1="9" y1="8" x2="15" y2="8"></line>
                                        <line x1="17" y1="16" x2="23" y2="16"></line>
                                    </svg>
                                </a>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="text-center py-8 text-zinc-500">
                                No compute nodes provisioned. <a href="{{ route('admin.nodes.new') }}" class="text-zinc-100 underline hover:text-white">Provision a node &rarr;</a>
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </section>

    {{-- =========================================================================
        3. LOWER SPLIT: QUICK OPERATIONS & SYSTEM ENVIRONMENT
       ========================================================================= --}}
    <div class="row">
        
        {{-- LEFT COLUMN: QUICK ADMINISTRATIVE OPERATIONS --}}
        <div class="col-md-6 col-xs-12">
            <div class="shadcn-panel-card">
                <div class="shadcn-panel-header">
                    <div>
                        <h3 class="shadcn-panel-title">Quick Operations</h3>
                        <p class="shadcn-panel-subtitle">Instant shortcuts to administrative management tasks.</p>
                    </div>
                </div>

                <div class="shadcn-ops-grid">
                    <a href="{{ route('admin.servers.new') }}" class="shadcn-op-tile group">
                        <div class="shadcn-op-icon-box">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </div>
                        <div>
                            <div class="shadcn-op-tile-title">Create Server</div>
                            <div class="shadcn-op-tile-desc">Provision game instance</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.nodes.new') }}" class="shadcn-op-tile group">
                        <div class="shadcn-op-icon-box">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="3" width="6" height="5" rx="1"></rect>
                                <rect x="3" y="16" width="6" height="5" rx="1"></rect>
                                <rect x="15" y="16" width="6" height="5" rx="1"></rect>
                                <path d="M12 8v4m-6 4v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </div>
                        <div>
                            <div class="shadcn-op-tile-title">Provision Node</div>
                            <div class="shadcn-op-tile-desc">Attach daemon runner</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.users.new') }}" class="shadcn-op-tile group">
                        <div class="shadcn-op-icon-box">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <line x1="19" y1="8" x2="19" y2="14"></line>
                                <line x1="22" y1="11" x2="16" y2="11"></line>
                            </svg>
                        </div>
                        <div>
                            <div class="shadcn-op-tile-title">Add Client</div>
                            <div class="shadcn-op-tile-desc">Register user account</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.settings') }}" class="shadcn-op-tile group">
                        <div class="shadcn-op-icon-box">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </div>
                        <div>
                            <div class="shadcn-op-tile-title">Settings</div>
                            <div class="shadcn-op-tile-desc">System configuration</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.ksm') }}" class="shadcn-op-tile group">
                        <div class="shadcn-op-icon-box text-emerald-400 border-emerald-500/20 bg-emerald-500/10">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                                <rect x="9" y="9" width="6" height="6"></rect>
                                <line x1="9" y1="1" x2="9" y2="4"></line>
                                <line x1="15" y1="1" x2="15" y2="4"></line>
                                <line x1="9" y1="20" x2="9" y2="23"></line>
                                <line x1="15" y1="20" x2="15" y2="23"></line>
                            </svg>
                        </div>
                        <div>
                            <div class="shadcn-op-tile-title text-emerald-400">KSM Memory</div>
                            <div class="shadcn-op-tile-desc">Deduplication engine</div>
                        </div>
                    </a>

                    <a href="{{ route('admin.api.index') }}" class="shadcn-op-tile group">
                        <div class="shadcn-op-icon-box">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                            </svg>
                        </div>
                        <div>
                            <div class="shadcn-op-tile-title">Application API</div>
                            <div class="shadcn-op-tile-desc">Access tokens & webhooks</div>
                        </div>
                    </a>
                </div>
            </div>
        </div>

        {{-- RIGHT COLUMN: SYSTEM ENVIRONMENT INSTRUMENT TABLE --}}
        <div class="col-md-6 col-xs-12">
            <div class="shadcn-panel-card">
                <div class="shadcn-panel-header">
                    <div>
                        <h3 class="shadcn-panel-title">System Environment</h3>
                        <p class="shadcn-panel-subtitle">Cluster runtime parameters and security posture.</p>
                    </div>
                </div>

                <div class="table-responsive" style="margin: 0; border: none;">
                    <table class="shadcn-env-table">
                        <tbody>
                            <tr>
                                <td class="shadcn-env-label">Control Panel Version</td>
                                <td class="font-mono text-zinc-100">
                                    <code class="shadcn-code-chip">v{{ config('app.version') }}</code>
                                </td>
                            </tr>
                            <tr>
                                <td class="shadcn-env-label">PHP Runtime</td>
                                <td class="font-mono text-zinc-100">
                                    <code class="shadcn-code-chip">PHP {{ phpversion() }}</code>
                                </td>
                            </tr>
                            <tr>
                                <td class="shadcn-env-label">Environment Mode</td>
                                <td>
                                    <span class="shadcn-badge-blue font-mono">
                                        {{ strtoupper(config('app.env', 'production')) }}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td class="shadcn-env-label">2-Factor Authentication</td>
                                <td>
                                    @php $twoFa = config('pterodactyl.auth.2fa_required'); @endphp
                                    @if($twoFa == 2)
                                        <span class="shadcn-badge-red font-mono">Mandatory (All)</span>
                                    @elseif($twoFa == 1)
                                        <span class="shadcn-badge-amber font-mono">Admin Only</span>
                                    @else
                                        <span class="shadcn-badge-mono font-mono">Optional</span>
                                    @endif
                                </td>
                            </tr>
                            <tr>
                                <td class="shadcn-env-label">Kernel Memory (KSM)</td>
                                <td>
                                    <a href="{{ route('admin.ksm') }}" class="shadcn-pill-emerald" style="text-decoration: none;">
                                        <span class="shadcn-dot-emerald"></span> Active &bull; View Telemetry
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td class="shadcn-env-label">Cluster Timezone</td>
                                <td class="font-mono text-zinc-400 text-xs">
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
    SHADCN/UI HIGH-FIDELITY DESIGN SYSTEM FOR ADMIN DASHBOARD
   ========================================================================= --}}
<style>
/* Header Styles */
.content-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
    background: transparent !important;
    padding: 24px 28px !important;
    margin-bottom: 24px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    flex-wrap: wrap !important;
    gap: 16px !important;
    width: 100% !important;
    box-sizing: border-box !important;
}

.shadcn-hero-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    width: 100%;
}

.shadcn-hero-left {
    flex: 1 1 auto;
    min-width: 240px;
}

.shadcn-pill-accent {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.06);
    color: #e4e4e7;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.shadcn-hero-title {
    font-family: var(--font-sans, "Inter", -apple-system, sans-serif) !important;
    font-size: 24px !important;
    font-weight: 700 !important;
    color: #fafafa !important;
    letter-spacing: -0.025em !important;
    margin: 0 !important;
    line-height: 1.25 !important;
}

.shadcn-hero-desc {
    font-size: 12.5px;
    color: #a1a1aa;
    margin: 6px 0 0 0;
    line-height: 1.5;
}

.shadcn-chip-mono {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 4px;
    background: #18181b;
    border: 1px solid #27272a;
    color: #fafafa;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 600;
}

.shadcn-hero-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    flex: 0 0 auto;
}

/* Digital Clock Badge */
.shadcn-clock-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 8px;
    background: #09090b;
    border: 1px solid #27272a;
    font-size: 11.5px;
    color: #fafafa;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

.shadcn-live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
    animation: shadcnPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes shadcnPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
}

.shadcn-clock-sep {
    color: #3f3f46;
}

/* Buttons */
.shadcn-btn-primary {
    background-color: #fafafa !important;
    color: #09090b !important;
    font-weight: 600 !important;
    font-size: 12px !important;
    border-radius: 8px !important;
    padding: 6px 14px !important;
    border: 1px solid #fafafa !important;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: all 140ms ease;
    text-decoration: none !important;
    cursor: pointer;
}
.shadcn-btn-primary:hover {
    background-color: #e4e4e7 !important;
    border-color: #e4e4e7 !important;
    color: #09090b !important;
}

.shadcn-btn-secondary {
    background-color: #09090b !important;
    color: #d4d4d8 !important;
    font-weight: 500 !important;
    font-size: 12px !important;
    border-radius: 8px !important;
    padding: 6px 12px !important;
    border: 1px solid #27272a !important;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    transition: all 140ms ease;
    text-decoration: none !important;
    cursor: pointer;
}
.shadcn-btn-secondary:hover {
    background-color: #18181b !important;
    border-color: #3f3f46 !important;
    color: #ffffff !important;
}

/* Wrapper */
.shadcn-dashboard-wrapper {
    color: #e4e4e7;
    font-family: var(--font-sans, "Inter", -apple-system, sans-serif);
    width: 100% !important;
    max-width: 100% !important;
    display: block !important;
    box-sizing: border-box !important;
}

/* 4-Column Bento Grid */
.shadcn-grid-4 {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}

@media (min-width: 640px) {
    .shadcn-grid-4 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (min-width: 1200px) {
    .shadcn-grid-4 {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

/* Metric Card */
.shadcn-card-metric {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 168px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
}

.shadcn-card-metric:hover {
    border-color: #3f3f46;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    transform: translateY(-1px);
}

.shadcn-metric-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
}

.shadcn-icon-box {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
}
.shadcn-icon-blue {
    background: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
    border-color: rgba(59, 130, 246, 0.2);
}
.shadcn-icon-emerald {
    background: rgba(16, 185, 129, 0.1);
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.2);
}
.shadcn-icon-purple {
    background: rgba(168, 85, 247, 0.1);
    color: #c084fc;
    border-color: rgba(168, 85, 247, 0.2);
}
.shadcn-icon-amber {
    background: rgba(245, 158, 11, 0.1);
    color: #fbbf24;
    border-color: rgba(245, 158, 11, 0.2);
}

.shadcn-kicker {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #a1a1aa;
}

.shadcn-badge-mono {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: 4px;
    background: #18181b;
    border: 1px solid #27272a;
    color: #a1a1aa;
}

.shadcn-metric-body {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 14px;
}

.shadcn-stat-number {
    font-size: 30px;
    font-weight: 700;
    color: #fafafa;
    line-height: 1;
    letter-spacing: -0.03em;
}

.shadcn-stat-label {
    font-size: 11.5px;
    color: #71717a;
    margin-top: 5px;
    font-weight: 400;
}

.shadcn-sparkline-wrap {
    flex-shrink: 0;
}

.shadcn-spark-svg {
    display: block;
    overflow: visible;
}

.shadcn-metric-foot {
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.shadcn-progress-track {
    height: 3.5px;
    width: 100%;
    background-color: #18181b;
    border-radius: 9999px;
    overflow: hidden;
    margin-bottom: 8px;
}

.shadcn-progress-fill {
    height: 100%;
    border-radius: 9999px;
}

.shadcn-foot-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
}

.shadcn-status-chip-green {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #10b981;
    font-weight: 500;
}

.shadcn-pulse-dot-sm {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
    display: inline-block;
}

.shadcn-indicator-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
}

.shadcn-link-emerald {
    color: #10b981;
    text-decoration: none !important;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: color 140ms ease;
}
.shadcn-link-emerald:hover {
    color: #34d399;
}

/* Panel Card */
.shadcn-panel-card {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.shadcn-panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid #27272a;
    background: rgba(24, 24, 27, 0.4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
}

.shadcn-panel-title {
    font-family: var(--font-sans, "Inter", sans-serif);
    font-size: 14.5px;
    font-weight: 600;
    color: #fafafa;
    margin: 0;
    letter-spacing: -0.01em;
}

.shadcn-panel-subtitle {
    font-size: 11.5px;
    color: #71717a;
    margin: 2px 0 0 0;
}

.shadcn-badge-success {
    font-size: 9.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 9999px;
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.25);
}

/* shadcn Table */
.shadcn-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
}

.shadcn-table th {
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #71717a;
    background: #0c0c0e;
    padding: 10px 16px;
    border-bottom: 1px solid #27272a;
    text-align: left;
}

.shadcn-table td {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(39, 39, 42, 0.6);
    font-size: 12.5px;
    color: #d4d4d8;
    vertical-align: middle;
    transition: background 120ms ease;
}

.shadcn-table tbody tr:hover td {
    background: rgba(255, 255, 255, 0.02);
}

.shadcn-table tbody tr:last-child td {
    border-bottom: none;
}

.shadcn-table-node-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #18181b;
    border: 1px solid #27272a;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a1a1aa;
    flex-shrink: 0;
}

.shadcn-node-name {
    color: #fafafa !important;
    font-weight: 600;
    font-size: 13px;
    text-decoration: none !important;
    display: block;
    transition: color 120ms ease;
}
.shadcn-node-name:hover {
    color: #60a5fa !important;
}

.shadcn-node-fqdn {
    font-size: 11px;
    color: #71717a;
    margin-top: 1px;
}

/* Pills */
.shadcn-pill-emerald {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 9999px;
    font-family: var(--font-mono, monospace);
    font-size: 10.5px;
    font-weight: 500;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #10b981;
}

.shadcn-dot-emerald {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
}

.shadcn-pill-amber {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 9999px;
    font-family: var(--font-mono, monospace);
    font-size: 10.5px;
    font-weight: 500;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fbbf24;
}

.shadcn-dot-amber {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #f59e0b;
}

.shadcn-mini-bar {
    height: 3.5px;
    width: 90px;
    background-color: #18181b;
    border-radius: 9999px;
    overflow: hidden;
    margin-top: 5px;
}

.shadcn-mini-fill {
    height: 100%;
    border-radius: 9999px;
}

.shadcn-cell-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    background: #18181b;
    border: 1px solid #27272a;
    font-size: 11.5px;
    color: #fafafa;
}

.shadcn-code-chip {
    background: #18181b !important;
    border: 1px solid #27272a !important;
    color: #a1a1aa !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-size: 11px !important;
    font-family: var(--font-mono, monospace) !important;
}

.shadcn-btn-ghost-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid transparent;
    color: #71717a;
    text-decoration: none !important;
    transition: all 140ms ease;
}
.shadcn-btn-ghost-icon:hover {
    background: #18181b;
    border-color: #27272a;
    color: #fafafa;
}

/* Quick Operations Grid */
.shadcn-ops-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 18px 20px;
}

@media (max-width: 540px) {
    .shadcn-ops-grid {
        grid-template-columns: 1fr;
    }
}

.shadcn-op-tile {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none !important;
    transition: border-color 150ms ease, background-color 150ms ease, transform 150ms ease;
}
.shadcn-op-tile:hover {
    background: #121215;
    border-color: #3f3f46;
    transform: translateY(-1px);
}

.shadcn-op-icon-box {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: #18181b;
    border: 1px solid #27272a;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a1a1aa;
    flex-shrink: 0;
    transition: color 150ms ease, border-color 150ms ease, transform 150ms ease;
}
.shadcn-op-tile:hover .shadcn-op-icon-box {
    color: #fafafa;
    border-color: #52525b;
}

.shadcn-op-tile-title {
    font-size: 12.5px;
    font-weight: 600;
    color: #fafafa;
    margin: 0;
    transition: color 150ms ease;
}
.shadcn-op-tile-desc {
    font-size: 11px;
    color: #71717a;
    margin-top: 1px;
}

/* System Environment Instrument Table */
.shadcn-env-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
}
.shadcn-env-table td {
    padding: 11px 20px;
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
    font-size: 12px;
    vertical-align: middle;
}
.shadcn-env-table tbody tr:last-child td {
    border-bottom: none;
}
.shadcn-env-label {
    width: 44%;
    color: #a1a1aa;
    font-weight: 500;
}

.shadcn-badge-blue {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    background: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.25);
}

.shadcn-badge-red {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.25);
}

.shadcn-badge-amber {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    background: rgba(245, 158, 11, 0.1);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.25);
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