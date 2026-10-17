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
    <div class="craft-header-container">
        {{-- Left: History Chevrons (< >) --}}
        <div class="craft-nav-chevrons">
            <button type="button" class="craft-nav-btn" onclick="window.history.back()" title="Back">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
            <button type="button" class="craft-nav-btn" onclick="window.history.forward()" title="Forward">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>
        </div>

        {{-- Main Header Cluster (Design Inspiration: (+) | Title and Content/Feeds pills) --}}
        <div class="craft-header-main">
            <div class="craft-title-cluster">
                <a href="{{ route('admin.servers.new') }}" class="craft-circle-action" title="Provision New Instance">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </a>
                <span class="craft-title-divider"></span>
                <h1 class="craft-title-text">Knowledgebase &amp; Fleet Mesh</h1>
            </div>

            {{-- Segmented Navigation Pills: Content | Feeds --}}
            <div class="craft-tabs-container">
                <div class="craft-tabs-pill-group">
                    <a href="#topology" class="craft-tab-pill active">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span>Content</span>
                    </a>
                    <a href="{{ route('admin.servers') }}" class="craft-tab-pill">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                        <span>Feeds &amp; Audit</span>
                    </a>
                </div>

                <div class="craft-header-right-meta hidden-xs">
                    <div class="craft-telemetry-badge font-mono">
                        <span class="craft-pulse-dot"></span>
                        <span id="votionHeaderClock">--:--:-- UTC</span>
                        <span class="text-zinc-600">|</span>
                        <span class="text-zinc-400">{{ date('M j, Y') }}</span>
                    </div>

                    <a href="{{ route('admin.index') }}" class="craft-btn-icon" title="Synchronize Fleet Data">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    </div>
@endsection

@section('content')
<div class="craft-workspace-body">

    {{-- =========================================================================
        1. MASTER 4-TIER EXECUTIVE BENTO GRID (Craft / Inset surfaces)
       ========================================================================= --}}
    <section class="craft-grid-4">
        
        {{-- TILE 1: COMPUTE ENGINE --}}
        <div class="craft-metric-card">
            <div class="craft-metric-top">
                <div class="craft-metric-header">
                    <div class="flex items-center gap-2">
                        <div class="craft-icon-squircle craft-icon-blue">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                                <line x1="6" y1="18" x2="6.01" y2="18"></line>
                            </svg>
                        </div>
                        <span class="craft-kicker">Compute Engine</span>
                    </div>
                    <span class="craft-badge-mono font-mono">{{ $nodeCount }}/{{ $nodeCount ?: 1 }} Nodes</span>
                </div>

                <div class="craft-metric-body">
                    <div>
                        <div class="craft-stat-val font-sans">{{ $nodeCount }}</div>
                        <div class="craft-stat-desc">Cluster Hypervisors</div>
                    </div>
                    <div class="craft-sparkline-wrap">
                        <svg width="88" height="26" viewBox="0 0 88 26">
                            <defs>
                                <linearGradient id="sparkBlueGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.28" />
                                    <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,16 16,18 34,12 52,14 70,8 88,4 88,26" fill="url(#sparkBlueGrad)" />
                            <polyline fill="none" stroke="#3B82F6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,16 16,18 34,12 52,14 70,8 88,4" />
                            <circle cx="88" cy="4" r="2.5" fill="#3B82F6" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="craft-metric-foot">
                <div class="craft-progress-track">
                    <div class="craft-progress-fill" style="width: 100%; background: linear-gradient(90deg, #3B82F6, #60A5FA);"></div>
                </div>
                <div class="craft-foot-meta font-mono">
                    <span class="text-zinc-500">Daemon:</span>
                    <span class="craft-status-green">
                        <span class="craft-dot-emerald"></span>
                        Active • Synchronized
                    </span>
                </div>
            </div>
        </div>

        {{-- TILE 2: INSTANCES & BOTS --}}
        <div class="craft-metric-card">
            <div class="craft-metric-top">
                <div class="craft-metric-header">
                    <div class="flex items-center gap-2">
                        <div class="craft-icon-squircle craft-icon-emerald">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                <polyline points="2 17 12 22 22 17"></polyline>
                                <polyline points="2 12 12 17 22 12"></polyline>
                            </svg>
                        </div>
                        <span class="craft-kicker">Instances &amp; Bots</span>
                    </div>
                    <span class="craft-badge-mono font-mono">{{ $serverCount }} Total</span>
                </div>

                <div class="craft-metric-body">
                    <div>
                        <div class="craft-stat-val font-sans">{{ $serverCount }}</div>
                        <div class="craft-stat-desc">Provisioned Servers</div>
                    </div>
                    <div class="craft-sparkline-wrap">
                        <svg width="88" height="26" viewBox="0 0 88 26">
                            <defs>
                                <linearGradient id="sparkGreenGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#10B981" stop-opacity="0.28" />
                                    <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,20 16,16 34,18 52,10 70,12 88,4 88,26" fill="url(#sparkGreenGrad)" />
                            <polyline fill="none" stroke="#10B981" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,20 16,16 34,18 52,10 70,12 88,4" />
                            <circle cx="88" cy="4" r="2.5" fill="#10B981" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="craft-metric-foot">
                <div class="craft-progress-track">
                    <div class="craft-progress-fill" style="width: {{ $serverCount > 0 ? '100' : '0' }}%; background: linear-gradient(90deg, #10B981, #34D399);"></div>
                </div>
                <div class="craft-foot-meta font-mono">
                    <div class="flex items-center gap-1.5">
                        <span class="craft-indicator-dot bg-emerald-500"></span>
                        <span class="text-zinc-200">{{ $serverCount - $suspendedServers }} Active</span>
                    </div>
                    @if($suspendedServers > 0)
                        <div class="flex items-center gap-1.5">
                            <span class="craft-indicator-dot bg-amber-500"></span>
                            <span class="text-amber-400">{{ $suspendedServers }} Suspended</span>
                        </div>
                    @else
                        <span class="text-zinc-500">0 Suspended</span>
                    @endif
                </div>
            </div>
        </div>

        {{-- TILE 3: USER ACCOUNTS --}}
        <div class="craft-metric-card">
            <div class="craft-metric-top">
                <div class="craft-metric-header">
                    <div class="flex items-center gap-2">
                        <div class="craft-icon-squircle craft-icon-purple">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <span class="craft-kicker">Client Access</span>
                    </div>
                    <span class="craft-badge-mono font-mono">{{ $userCount }} Users</span>
                </div>

                <div class="craft-metric-body">
                    <div>
                        <div class="craft-stat-val font-sans">{{ $userCount }}</div>
                        <div class="craft-stat-desc">Registered Accounts</div>
                    </div>
                    <div class="craft-sparkline-wrap">
                        <svg width="88" height="26" viewBox="0 0 88 26">
                            <defs>
                                <linearGradient id="sparkPurpleGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#A855F7" stop-opacity="0.28" />
                                    <stop offset="100%" stop-color="#A855F7" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,22 16,18 34,20 52,12 70,14 88,5 88,26" fill="url(#sparkPurpleGrad)" />
                            <polyline fill="none" stroke="#A855F7" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,22 16,18 34,20 52,12 70,14 88,5" />
                            <circle cx="88" cy="5" r="2.5" fill="#A855F7" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="craft-metric-foot">
                <div class="craft-progress-track">
                    <div class="craft-progress-fill" style="width: {{ $userCount > 0 ? '100' : '0' }}%; background: linear-gradient(90deg, #A855F7, #C084FC);"></div>
                </div>
                <div class="craft-foot-meta font-mono">
                    <span class="text-zinc-500">Partition:</span>
                    <span class="text-zinc-200">{{ $adminCount }} {{ \Illuminate\Support\Str::plural('Admin', $adminCount) }} &bull; {{ max(0, $userCount - $adminCount) }} Clients</span>
                </div>
            </div>
        </div>

        {{-- TILE 4: DATABASE & KSM --}}
        <div class="craft-metric-card">
            <div class="craft-metric-top">
                <div class="craft-metric-header">
                    <div class="flex items-center gap-2">
                        <div class="craft-icon-squircle craft-icon-amber">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                            </svg>
                        </div>
                        <span class="craft-kicker">Relational DBs</span>
                    </div>
                    <span class="craft-badge-mono font-mono">{{ $dbHostCount }} Hosts</span>
                </div>

                <div class="craft-metric-body">
                    <div>
                        <div class="craft-stat-val font-sans">{{ $dbHostCount }}</div>
                        <div class="craft-stat-desc">Database Hosts</div>
                    </div>
                    <div class="craft-sparkline-wrap">
                        <svg width="88" height="26" viewBox="0 0 88 26">
                            <defs>
                                <linearGradient id="sparkAmberGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.28" />
                                    <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,19 16,19 34,14 52,15 70,9 88,5 88,26" fill="url(#sparkAmberGrad)" />
                            <polyline fill="none" stroke="#F59E0B" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,19 16,19 34,14 52,15 70,9 88,5" />
                            <circle cx="88" cy="5" r="2.5" fill="#F59E0B" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="craft-metric-foot">
                <div class="craft-progress-track">
                    <div class="craft-progress-fill" style="width: {{ $dbHostCount > 0 ? '100' : '0' }}%; background: linear-gradient(90deg, #F59E0B, #FBBF24);"></div>
                </div>
                <div class="craft-foot-meta font-mono">
                    <a href="{{ route('admin.ksm') }}" class="craft-link-emerald">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                            <rect x="9" y="9" width="6" height="6"></rect>
                        </svg>
                        <span>KSM Active &rarr;</span>
                    </a>
                </div>
            </div>
        </div>

    </section>

    {{-- =========================================================================
        2. MASTER RESOURCE LIST (Matching Design Inspiration: Checkboxes & Vibrant Folder Icons)
       ========================================================================= --}}
    <section class="craft-panel-container" id="topology">
        <div class="craft-panel-bar">
            <div class="flex items-center gap-2">
                <span class="craft-panel-heading">Hypervisor Node Topology</span>
                <span class="craft-badge-cyan font-mono">{{ $nodeCount }} Nodes Active</span>
            </div>
            <a href="{{ route('admin.nodes.new') }}" class="craft-link-subtle">
                <span>+ Provision Node</span>
            </a>
        </div>

        <div class="table-responsive" style="margin: 0; border: none;">
            <table class="craft-table">
                <thead>
                    <tr>
                        <th style="width: 44px; padding-left: 20px;">
                            <input type="checkbox" class="craft-checkbox" id="selectAllNodes" checked title="Select All Nodes">
                        </th>
                        <th>Name</th>
                        <th>Daemon Status</th>
                        <th>Memory Allocation</th>
                        <th>Disk Capacity</th>
                        <th class="text-center">Instances</th>
                        <th class="text-center">Port</th>
                        <th class="text-right" style="padding-right: 20px;">Configure</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($nodesList as $node)
                        <tr class="craft-row">
                            <td style="padding-left: 20px;">
                                <input type="checkbox" class="craft-checkbox node-item-cb" checked>
                            </td>

                            <td>
                                <div class="flex items-center gap-3">
                                    {{-- Glowing Cyan/Blue Folder Icon (Project Chimera style in inspiration image) --}}
                                    <div class="craft-folder-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20 5h-9.586L8.707 3.293A1 1 0 0 0 8 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <a href="{{ route('admin.nodes.view', $node->id) }}" class="craft-item-name">
                                            {{ $node->name }}
                                        </a>
                                        <div class="craft-item-sub font-mono">
                                            {{ $node->fqdn }}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <td>
                                @if($node->maintenance_mode)
                                    <span class="craft-pill-amber">
                                        <span class="craft-dot-amber"></span> Maintenance
                                    </span>
                                @else
                                    <span class="craft-pill-emerald">
                                        <span class="craft-dot-emerald"></span> Online
                                    </span>
                                @endif
                            </td>

                            <td>
                                <div class="font-mono text-zinc-100 font-medium text-xs">
                                    {{ number_format($node->memory) }} MiB
                                </div>
                                <div class="craft-mini-bar">
                                    <div class="craft-mini-fill" style="width: 75%; background: #3B82F6;"></div>
                                </div>
                            </td>

                            <td>
                                <div class="font-mono text-zinc-100 font-medium text-xs">
                                    {{ number_format($node->disk) }} MiB
                                </div>
                                <div class="craft-mini-bar">
                                    <div class="craft-mini-fill" style="width: 60%; background: #10B981;"></div>
                                </div>
                            </td>

                            <td class="text-center font-mono font-semibold text-zinc-100 text-xs">
                                <span class="craft-cell-badge">{{ $node->servers_count }}</span>
                            </td>

                            <td class="text-center font-mono text-xs text-zinc-400">
                                <code class="craft-code-chip">{{ $node->daemonListen }}</code>
                            </td>

                            <td class="text-right" style="padding-right: 20px;">
                                <a href="{{ route('admin.nodes.view', $node->id) }}" class="craft-ghost-btn" title="Configure Node">
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
                            <td colspan="8" class="text-center py-8 text-zinc-500">
                                No compute nodes provisioned. <a href="{{ route('admin.nodes.new') }}" class="text-zinc-100 underline hover:text-white">Provision a node &rarr;</a>
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </section>

    {{-- =========================================================================
        3. LOWER SECTION: RESOURCE DOCUMENTS (Inspired by file rows in design) & ENVIRONMENT
       ========================================================================= --}}
    <div class="row">
        
        {{-- LEFT COLUMN: FLEET RESOURCE BLUEPRINTS (Styled as Files from inspiration image) --}}
        <div class="col-md-6 col-xs-12">
            <div class="craft-panel-container">
                <div class="craft-panel-bar">
                    <span class="craft-panel-heading">Cluster Resources &amp; Blueprints</span>
                    <span class="craft-badge-mono font-mono">4 Attached</span>
                </div>

                <div class="craft-file-list">
                    {{-- Row 1: PDF Style --}}
                    <div class="craft-file-row">
                        <input type="checkbox" class="craft-checkbox" checked>
                        <div class="craft-file-icon craft-file-pdf">
                            <span class="craft-file-tag">PDF</span>
                        </div>
                        <div class="craft-file-info">
                            <a href="{{ route('admin.servers') }}" class="craft-file-title">network_topology_manifest.pdf</a>
                            <span class="craft-file-meta">Cluster Routing &bull; 2.4 MB</span>
                        </div>
                        <span class="craft-file-action">&rarr;</span>
                    </div>

                    {{-- Row 2: DOCX Style --}}
                    <div class="craft-file-row">
                        <input type="checkbox" class="craft-checkbox" checked>
                        <div class="craft-file-icon craft-file-doc">
                            <span class="craft-file-tag">DOC</span>
                        </div>
                        <div class="craft-file-info">
                            <a href="{{ route('admin.nests') }}" class="craft-file-title">service_egg_definitions.docx</a>
                            <span class="craft-file-meta">Container Runtime Specs &bull; 840 KB</span>
                        </div>
                        <span class="craft-file-action">&rarr;</span>
                    </div>

                    {{-- Row 3: TXT Style --}}
                    <div class="craft-file-row">
                        <input type="checkbox" class="craft-checkbox">
                        <div class="craft-file-icon craft-file-txt">
                            <span class="craft-file-tag">TXT</span>
                        </div>
                        <div class="craft-file-info">
                            <a href="{{ route('admin.settings') }}" class="craft-file-title">environment_variables.txt</a>
                            <span class="craft-file-meta">PHP {{ phpversion() }} &bull; Laravel Runtime</span>
                        </div>
                        <span class="craft-file-action">&rarr;</span>
                    </div>

                    {{-- Row 4: MP4 Style --}}
                    <div class="craft-file-row">
                        <input type="checkbox" class="craft-checkbox">
                        <div class="craft-file-icon craft-file-media">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </div>
                        <div class="craft-file-info">
                            <a href="{{ route('admin.ksm') }}" class="craft-file-title">telemetry_telecast.mp4</a>
                            <span class="craft-file-meta">Realtime Memory Stream &bull; Live</span>
                        </div>
                        <span class="craft-file-action">&rarr;</span>
                    </div>
                </div>
            </div>
        </div>

        {{-- RIGHT COLUMN: SYSTEM ENVIRONMENT INSTRUMENT TABLE --}}
        <div class="col-md-6 col-xs-12">
            <div class="craft-panel-container">
                <div class="craft-panel-bar">
                    <span class="craft-panel-heading">System Environment</span>
                    <span class="craft-badge-mono font-mono">Production Mode</span>
                </div>

                <div class="table-responsive" style="margin: 0; border: none;">
                    <table class="craft-env-table">
                        <tbody>
                            <tr>
                                <td class="craft-env-label">Control Panel Version</td>
                                <td class="font-mono text-zinc-100">
                                    <code class="craft-code-chip">v{{ config('app.version') }}</code>
                                </td>
                            </tr>
                            <tr>
                                <td class="craft-env-label">PHP Runtime</td>
                                <td class="font-mono text-zinc-100">
                                    <code class="craft-code-chip">PHP {{ phpversion() }}</code>
                                </td>
                            </tr>
                            <tr>
                                <td class="craft-env-label">Environment Mode</td>
                                <td>
                                    <span class="craft-badge-blue font-mono">
                                        {{ strtoupper(config('app.env', 'production')) }}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td class="craft-env-label">2-Factor Authentication</td>
                                <td>
                                    @php $twoFa = config('pterodactyl.auth.2fa_required'); @endphp
                                    @if($twoFa == 2)
                                        <span class="craft-badge-red font-mono">Mandatory (All)</span>
                                    @elseif($twoFa == 1)
                                        <span class="craft-badge-amber font-mono">Admin Only</span>
                                    @else
                                        <span class="craft-badge-mono font-mono">Optional</span>
                                    @endif
                                </td>
                            </tr>
                            <tr>
                                <td class="craft-env-label">Kernel Memory (KSM)</td>
                                <td>
                                    <a href="{{ route('admin.ksm') }}" class="craft-pill-emerald" style="text-decoration: none;">
                                        <span class="craft-dot-emerald"></span> Active &bull; View Telemetry
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td class="craft-env-label">Cluster Timezone</td>
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
    CRAFT / MAC OS DESKTOP INSET STYLES
   ========================================================================= --}}
<style>
/* Header Styles (matching the design inspiration) */
.craft-header-container {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    width: 100%;
}

.craft-nav-chevrons {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 6px;
    flex-shrink: 0;
}

.craft-nav-btn {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: #18181b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #71717a;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 120ms ease;
}
.craft-nav-btn:hover {
    background: #27272a;
    color: #fafafa;
    border-color: rgba(255, 255, 255, 0.16);
}

.craft-header-main {
    flex: 1 1 auto;
}

.craft-title-cluster {
    display: flex;
    align-items: center;
    gap: 12px;
}

.craft-circle-action {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #202024;
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fafafa;
    text-decoration: none !important;
    transition: all 140ms ease;
    flex-shrink: 0;
}
.craft-circle-action:hover {
    background: #2a2a30;
    color: #ffffff;
    transform: scale(1.05);
}

.craft-title-divider {
    width: 1px;
    height: 22px;
    background-color: rgba(255, 255, 255, 0.12);
}

.craft-title-text {
    font-family: var(--font-sans, "Inter", sans-serif) !important;
    font-size: 24px !important;
    font-weight: 700 !important;
    color: #fafafa !important;
    letter-spacing: -0.025em !important;
    margin: 0 !important;
    line-height: 1.2 !important;
}

/* Tabs Pill Row (Content & Feeds) */
.craft-tabs-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 14px;
    flex-wrap: wrap;
    gap: 12px;
}

.craft-tabs-pill-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.craft-tab-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 12.5px;
    font-weight: 500;
    background: #1c1c20;
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #a1a1aa;
    text-decoration: none !important;
    transition: all 140ms ease;
}
.craft-tab-pill:hover {
    background: #27272a;
    color: #fafafa;
}

.craft-tab-pill.active {
    background: rgba(37, 99, 235, 0.18) !important;
    border: 1px solid rgba(59, 130, 246, 0.35) !important;
    color: #60a5fa !important;
    font-weight: 600 !important;
}

.craft-header-right-meta {
    display: flex;
    align-items: center;
    gap: 8px;
}

.craft-telemetry-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 12px;
    border-radius: 9999px;
    background: #141417;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    color: #fafafa;
}

.craft-pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
}

.craft-btn-icon {
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    background: #141417;
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a1a1aa;
    text-decoration: none !important;
    transition: all 120ms ease;
}
.craft-btn-icon:hover {
    background: #222226;
    color: #fafafa;
}

/* Workspace Canvas Body */
.craft-workspace-body {
    width: 100%;
}

/* 4-Column Bento Grid */
.craft-grid-4 {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 22px;
}
@media (min-width: 640px) {
    .craft-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1200px) {
    .craft-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

.craft-metric-card {
    background: #101013;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 154px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 140ms ease;
}
.craft-metric-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.craft-metric-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.craft-icon-squircle {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.craft-icon-blue { background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.25); }
.craft-icon-emerald { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
.craft-icon-purple { background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.25); }
.craft-icon-amber { background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); }

.craft-kicker {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #a1a1aa;
}

.craft-badge-mono {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 4px;
    background: #18181c;
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #a1a1aa;
}

.craft-metric-body {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 12px;
}

.craft-stat-val {
    font-size: 28px;
    font-weight: 700;
    color: #fafafa;
    line-height: 1;
    letter-spacing: -0.03em;
}

.craft-stat-desc {
    font-size: 11px;
    color: #71717a;
    margin-top: 4px;
}

.craft-metric-foot {
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.craft-progress-track {
    height: 3px;
    width: 100%;
    background-color: #18181c;
    border-radius: 9999px;
    overflow: hidden;
    margin-bottom: 8px;
}

.craft-progress-fill {
    height: 100%;
    border-radius: 9999px;
}

.craft-foot-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
}

.craft-status-green {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #10b981;
    font-weight: 500;
}

.craft-indicator-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
}

.craft-link-emerald {
    color: #10b981;
    text-decoration: none !important;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: color 120ms ease;
}
.craft-link-emerald:hover { color: #34d399; }

/* Panel Container */
.craft-panel-container {
    background: #101013;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 22px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.craft-panel-bar {
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(255, 255, 255, 0.015);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
}

.craft-panel-heading {
    font-size: 13.5px;
    font-weight: 600;
    color: #fafafa;
}

.craft-badge-cyan {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: 9999px;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: #38bdf8;
}

.craft-link-subtle {
    font-size: 12px;
    color: #a1a1aa;
    text-decoration: none !important;
    transition: color 120ms ease;
}
.craft-link-subtle:hover { color: #ffffff; }

/* Table Styling */
.craft-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
}

.craft-table th {
    font-size: 11px;
    font-weight: 500;
    color: #71717a;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: transparent;
    text-align: left;
}

.craft-row td {
    padding: 11px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 12.5px;
    color: #d4d4d8;
    vertical-align: middle;
    transition: background 120ms ease;
}

.craft-row:hover td {
    background: rgba(255, 255, 255, 0.025);
}

.craft-row:last-child td {
    border-bottom: none;
}

/* Glowing Cyan/Blue Folder Icon (Inspiration image style) */
.craft-folder-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #38bdf8;
    filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.4));
    flex-shrink: 0;
}

.craft-item-name {
    color: #fafafa !important;
    font-weight: 500;
    font-size: 13px;
    text-decoration: none !important;
    display: block;
    transition: color 120ms ease;
}
.craft-item-name:hover {
    color: #38bdf8 !important;
}

.craft-item-sub {
    font-size: 10.5px;
    color: #71717a;
    margin-top: 1px;
}

.craft-pill-emerald {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 7px;
    border-radius: 9999px;
    font-family: var(--font-mono, monospace);
    font-size: 10.5px;
    font-weight: 500;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #10b981;
}

.craft-dot-emerald {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
}

.craft-pill-amber {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 7px;
    border-radius: 9999px;
    font-family: var(--font-mono, monospace);
    font-size: 10.5px;
    font-weight: 500;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fbbf24;
}

.craft-dot-amber {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #f59e0b;
}

.craft-mini-bar {
    height: 3px;
    width: 80px;
    background-color: #18181c;
    border-radius: 9999px;
    overflow: hidden;
    margin-top: 4px;
}

.craft-mini-fill {
    height: 100%;
    border-radius: 9999px;
}

.craft-cell-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 4px;
    background: #18181c;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    color: #fafafa;
}

.craft-code-chip {
    background: #18181c !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    color: #a1a1aa !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-size: 10.5px !important;
    font-family: var(--font-mono, monospace) !important;
}

.craft-ghost-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: transparent;
    color: #71717a;
    text-decoration: none !important;
    transition: all 120ms ease;
}
.craft-ghost-btn:hover {
    background: #1e1e24;
    color: #fafafa;
}

/* File List (Matching Inspiration Image) */
.craft-file-list {
    display: flex;
    flex-direction: column;
}

.craft-file-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 120ms ease;
}
.craft-file-row:last-child {
    border-bottom: none;
}
.craft-file-row:hover {
    background: rgba(255, 255, 255, 0.025);
}

.craft-file-icon {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.craft-file-tag {
    font-family: var(--font-mono, monospace);
    font-size: 8px;
    font-weight: 700;
    line-height: 1;
}

.craft-file-pdf { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); }
.craft-file-doc { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.25); }
.craft-file-txt { background: rgba(161, 161, 170, 0.15); color: #d4d4d8; border: 1px solid rgba(161, 161, 170, 0.25); }
.craft-file-media { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.25); }

.craft-file-info {
    flex: 1 1 auto;
    min-width: 0;
}

.craft-file-title {
    color: #fafafa !important;
    font-size: 12.5px;
    font-weight: 500;
    text-decoration: none !important;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 120ms ease;
}
.craft-file-title:hover {
    color: #60a5fa !important;
}

.craft-file-meta {
    font-size: 10.5px;
    color: #71717a;
}

.craft-file-action {
    color: #52525b;
    font-size: 14px;
    transition: transform 120ms ease, color 120ms ease;
}
.craft-file-row:hover .craft-file-action {
    color: #fafafa;
    transform: translateX(2px);
}

/* System Environment Instrument Table */
.craft-env-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
}
.craft-env-table td {
    padding: 10.5px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 12px;
    vertical-align: middle;
}
.craft-env-table tbody tr:last-child td {
    border-bottom: none;
}
.craft-env-label {
    width: 44%;
    color: #a1a1aa;
    font-weight: 500;
}

.craft-badge-blue {
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

.craft-badge-red {
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

.craft-badge-amber {
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
            // Live UTC Digital Clock
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

            // Select all nodes checkbox interaction
            $('#selectAllNodes').on('change', function () {
                var isChecked = $(this).prop('checked');
                $('.node-item-cb').prop('checked', isChecked);
            });
        });
    </script>
@endsection