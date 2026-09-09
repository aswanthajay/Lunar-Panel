@extends('layouts.admin')

@section('title')
    Kernel Samepage Merging (KSM)
@endsection

@section('content-header')
    <h1>Kernel Samepage Merging (KSM)
        <small>Real-time memory deduplication, container memory consolidation, and kernel tuning.</small>
    </h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Kernel Memory (KSM)</li>
    </ol>
@endsection

@section('content')
<div class="votion-dashboard font-sans">

    {{-- Toast Notification (Votion Signature Floating Toast) --}}
    <div id="votionToast" class="votion-toast" style="display: none;">
        <div class="votion-toast-content">
            <span class="votion-pulse-dot" style="background-color: #10B981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);"></span>
            <span id="votionToastText">Action completed successfully</span>
        </div>
        <button type="button" class="votion-toast-close" onclick="hideToast()">✕</button>
    </div>

    {{-- =========================================================================
        1. EXECUTIVE CONTEXT & TELEMETRY CONTROLS BAR
       ========================================================================= --}}
    <header class="votion-context-bar">
        <div class="votion-context-left">
            <div class="votion-engine-chip">
                <span class="votion-chip-kicker">HOST KERNEL</span>
                <span class="votion-chip-separator">·</span>
                <span class="votion-chip-val font-mono">{{ $metrics['readiness']['os_name'] }} ({{ $metrics['readiness']['kernel_release'] }})</span>
                <span class="votion-chip-separator">·</span>
                <span class="votion-chip-sub">Total RAM: {{ $metrics['system_ram']['total_human'] }}</span>
            </div>
        </div>

        <div class="votion-context-right">
            {{-- Digital Live Clock --}}
            <div class="votion-clock-badge font-mono">
                <span id="votionClockTime" class="votion-clock-time">--:--:--</span>
                <span class="votion-clock-sep">|</span>
                <span id="votionClockDate" class="votion-clock-date">Live</span>
            </div>

            {{-- Live Polling Pill --}}
            <div class="votion-live-pill font-mono" id="livePill">
                <span class="votion-pulse-dot"></span>
                <span id="liveStatusText">LIVE TELEMETRY (3S)</span>
            </div>

            {{-- Controls Group --}}
            <div class="votion-action-group">
                <button type="button" id="toggleLiveBtn" class="votion-btn-secondary" title="Pause or resume live stream">
                    <i class="fa fa-pause" id="toggleLiveIcon" style="margin-right: 4px; font-size: 10px;"></i>
                    <span id="toggleLiveText">Pause</span>
                </button>
                <button type="button" onclick="fetchMetrics(true)" class="votion-btn-secondary" title="Force immediate synchronization">
                    <i class="fa fa-refresh" id="syncIcon" style="margin-right: 4px; font-size: 10px;"></i>
                    <span>Sync</span>
                </button>
                <button type="button" onclick="runBenchmarkTest()" class="votion-btn-primary" id="btnRunTestHeader">
                    <i class="fa fa-bolt" style="margin-right: 4px;"></i>
                    <span>Run Benchmark</span>
                </button>
            </div>
        </div>
    </header>

    {{-- =========================================================================
        2. MASTER "AT A GLANCE" EXECUTIVE INSTRUMENT HUB (4 Bento Cards)
       ========================================================================= --}}
    <section class="votion-bento-hub" aria-label="Executive At A Glance Hub">
        
        {{-- TILE 1: PHYSICAL RAM CONSOLIDATED --}}
        <div class="votion-tile">
            <div class="votion-tile-top">
                <div class="votion-tile-header">
                    <span class="votion-tile-label">Physical RAM Saved</span>
                    <span class="votion-tile-tag font-mono" id="tileSavedPct">{{ $metrics['savings_percentage'] }}% of Host RAM</span>
                </div>

                <div class="votion-tile-value-row">
                    <div class="votion-tile-main">
                        <span class="votion-tile-stat font-mono" id="metricSavedHuman">{{ $metrics['memory_saved_human'] }}</span>
                        <span class="votion-tile-denom font-sans">Net Saved</span>
                    </div>
                    <div class="votion-sparkline-wrap" id="sparkSaved">
                        {{-- SVG Sparkline --}}
                        <svg width="90" height="26" viewBox="0 0 90 26" class="votion-sparkline">
                            <defs>
                                <linearGradient id="sparkGradGreen" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#10B981" stop-opacity="0.35" />
                                    <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,16 18,14 36,12 54,9 72,6 90,4 90,26" fill="url(#sparkGradGreen)" />
                            <polyline fill="none" stroke="#10B981" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,16 18,14 36,12 54,9 72,6 90,4" />
                            <circle cx="90" cy="4" r="2.5" fill="#10B981" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="votion-tile-bottom">
                <div class="votion-gauge">
                    <div class="votion-gauge-fill" id="barSavedPct" style="width: {{ min(100, max(2, $metrics['savings_percentage'] * 4)) }}%; background: #10B981;"></div>
                </div>
                <div class="votion-tile-subtext font-mono">
                    <span>Avoided COW refs:</span>
                    <span class="text-white font-medium" id="metricSharingRef">{{ number_format($metrics['pages_sharing']) }}</span>
                </div>
            </div>
        </div>

        {{-- TILE 2: DEDUPLICATION MULTIPLIER --}}
        <div class="votion-tile">
            <div class="votion-tile-top">
                <div class="votion-tile-header">
                    <span class="votion-tile-label">Deduplication Ratio</span>
                    <span class="votion-tile-tag font-mono">Multiplier</span>
                </div>

                <div class="votion-tile-value-row">
                    <div class="votion-tile-main">
                        <span class="votion-tile-stat font-mono" id="metricRatio">{{ $metrics['sharing_ratio'] }}x</span>
                        <span class="votion-tile-denom font-sans">Page Multiplier</span>
                    </div>
                    <div class="votion-sparkline-wrap" id="sparkRatio">
                        <svg width="90" height="26" viewBox="0 0 90 26" class="votion-sparkline">
                            <defs>
                                <linearGradient id="sparkGradBlue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.35" />
                                    <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,18 18,15 36,14 54,10 72,8 90,5 90,26" fill="url(#sparkGradBlue)" />
                            <polyline fill="none" stroke="#3B82F6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,18 18,15 36,14 54,10 72,8 90,5" />
                            <circle cx="90" cy="5" r="2.5" fill="#3B82F6" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="votion-tile-bottom">
                <div class="votion-gauge">
                    <div class="votion-gauge-fill" id="barRatio" style="width: {{ min(100, $metrics['sharing_ratio'] * 20) }}%; background: #3B82F6;"></div>
                </div>
                <div class="votion-tile-subtext font-mono">
                    <span>Memory Efficiency:</span>
                    <span class="text-white font-medium">{{ $metrics['sharing_ratio'] > 1 ? '+' . number_format(($metrics['sharing_ratio'] - 1) * 100, 0) . '%' : 'Optimal' }}</span>
                </div>
            </div>
        </div>

        {{-- TILE 3: CONSOLIDATED COW BASE PAGES --}}
        <div class="votion-tile">
            <div class="votion-tile-top">
                <div class="votion-tile-header">
                    <span class="votion-tile-label">COW Base Footprint</span>
                    <span class="votion-tile-tag font-mono" id="metricSharedHuman">{{ $metrics['memory_shared_human'] }} base</span>
                </div>

                <div class="votion-tile-value-row">
                    <div class="votion-tile-main">
                        <span class="votion-tile-stat font-mono" id="metricPagesShared">{{ number_format($metrics['pages_shared']) }}</span>
                        <span class="votion-tile-denom font-sans">Unique Pages</span>
                    </div>
                    <div class="votion-sparkline-wrap">
                        <svg width="90" height="26" viewBox="0 0 90 26" class="votion-sparkline">
                            <defs>
                                <linearGradient id="sparkGradPurple" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.35" />
                                    <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,20 18,17 36,15 54,12 72,10 90,6 90,26" fill="url(#sparkGradPurple)" />
                            <polyline fill="none" stroke="#8B5CF6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,20 18,17 36,15 54,12 72,10 90,6" />
                            <circle cx="90" cy="6" r="2.5" fill="#8B5CF6" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="votion-tile-bottom">
                <div class="votion-gauge">
                    <div class="votion-gauge-fill" style="width: 100%; background: #8B5CF6;"></div>
                </div>
                <div class="votion-tile-subtext font-mono">
                    <span>Active Shared COW:</span>
                    <span class="text-white font-medium" id="metricCowPages">{{ number_format($metrics['pages_shared']) }}</span>
                </div>
            </div>
        </div>

        {{-- TILE 4: KERNEL ENGINE & DAEMON STATUS --}}
        <div class="votion-tile">
            <div class="votion-tile-top">
                <div class="votion-tile-header">
                    <span class="votion-tile-label">Kernel Daemon (ksmd)</span>
                    <span class="votion-status-pill {{ $metrics['status'] === 'running' ? 'status-running' : 'status-stopped' }}" id="metricStatus">
                        <span class="votion-status-dot"></span>
                        <span id="metricStatusLabel">{{ strtoupper($metrics['status']) }}</span>
                    </span>
                </div>

                <div class="votion-tile-value-row">
                    <div class="votion-tile-main">
                        <span class="votion-tile-stat font-mono" id="metricScansCount">{{ number_format($metrics['full_scans']) }}</span>
                        <span class="votion-tile-denom font-sans">Full Scans</span>
                    </div>
                    <div class="votion-sparkline-wrap">
                        <svg width="90" height="26" viewBox="0 0 90 26" class="votion-sparkline">
                            <defs>
                                <linearGradient id="sparkGradAmber" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.35" />
                                    <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.0" />
                                </linearGradient>
                            </defs>
                            <polygon points="0,26 0,22 18,19 36,16 54,13 72,9 90,7 90,26" fill="url(#sparkGradAmber)" />
                            <polyline fill="none" stroke="#F59E0B" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="0,22 18,19 36,16 54,13 72,9 90,7" />
                            <circle cx="90" cy="7" r="2.5" fill="#F59E0B" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="votion-tile-bottom">
                <div class="votion-gauge">
                    <div class="votion-gauge-fill" style="width: {{ $metrics['status'] === 'running' ? '100' : '0' }}%; background: #F59E0B;"></div>
                </div>
                <div class="votion-tile-subtext font-mono">
                    <span>Auto-tuner daemon:</span>
                    <span class="text-white font-medium" id="metricDaemonState">{{ $metrics['readiness']['systemd_active'] ? 'Active (systemd)' : 'Manual' }}</span>
                </div>
            </div>
        </div>

    </section>

    {{-- =========================================================================
        3. 1-CLICK OPTIMIZATION PROFILES (Votion Luxury Dark Surface)
       ========================================================================= --}}
    <section class="votion-card" style="margin-bottom: 24px;">
        <div class="votion-card-header">
            <div class="votion-card-header-left">
                <span class="votion-card-title font-sans font-semibold">1-Click Optimization Profiles</span>
                <span class="votion-card-desc">Preset kernel scanning frequencies tailored to your workload density.</span>
            </div>
            <div class="votion-card-header-right">
                <span class="votion-profile-active-tag font-mono" id="currentProfileBadge">
                    ACTIVE: {{ strtoupper($metrics['active_profile']) }}
                </span>
            </div>
        </div>

        <div class="votion-card-body">
            <div class="votion-profile-grid">

                {{-- Profile 1: Ultra Aggressive --}}
                <div class="votion-profile-box {{ $metrics['active_profile'] === 'aggressive' ? 'is-active' : '' }}" id="cardAggressive">
                    <div class="votion-profile-content">
                        <div class="votion-profile-row">
                            <div class="votion-profile-heading">
                                <i class="fa fa-bolt" style="color: #F59E0B;"></i>
                                <span class="votion-profile-name">Ultra Aggressive</span>
                            </div>
                            <span class="votion-pill-badge pill-amber font-mono">Max Savings</span>
                        </div>
                        <p class="votion-profile-info">
                            Aggressively sweeps RAM for maximum deduplication across high-density game server nodes (2,500 pages/10ms). Recovers maximum available memory.
                        </p>
                        <div class="votion-spec-tags font-mono">
                            <span class="votion-spec-tag">pages_to_scan: <strong>2500</strong></span>
                            <span class="votion-spec-tag">sleep: <strong>10ms</strong></span>
                            <span class="votion-spec-tag">smart_scan: <strong>1</strong></span>
                        </div>
                    </div>
                    <div class="votion-profile-actions">
                        <button type="button" id="btnProfileAggressive" class="votion-profile-btn {{ $metrics['active_profile'] === 'aggressive' ? 'btn-active' : '' }}" onclick="applyProfile('aggressive')">
                            {{ $metrics['active_profile'] === 'aggressive' ? '✓ Active Profile' : 'Activate Aggressive' }}
                        </button>
                    </div>
                </div>

                {{-- Profile 2: Balanced (Recommended) --}}
                <div class="votion-profile-box {{ $metrics['active_profile'] === 'balanced' ? 'is-active' : '' }}" id="cardBalanced">
                    <div class="votion-profile-content">
                        <div class="votion-profile-row">
                            <div class="votion-profile-heading">
                                <i class="fa fa-check-circle" style="color: #10B981;"></i>
                                <span class="votion-profile-name">Balanced</span>
                            </div>
                            <span class="votion-pill-badge pill-green font-mono">Recommended</span>
                        </div>
                        <p class="votion-profile-info">
                            Continuous background deduplication with imperceptible CPU overhead (1,000 pages/20ms). Best for production multi-tenant environments.
                        </p>
                        <div class="votion-spec-tags font-mono">
                            <span class="votion-spec-tag">pages_to_scan: <strong>1000</strong></span>
                            <span class="votion-spec-tag">sleep: <strong>20ms</strong></span>
                            <span class="votion-spec-tag">smart_scan: <strong>1</strong></span>
                        </div>
                    </div>
                    <div class="votion-profile-actions">
                        <button type="button" id="btnProfileBalanced" class="votion-profile-btn {{ $metrics['active_profile'] === 'balanced' ? 'btn-active' : '' }}" onclick="applyProfile('balanced')">
                            {{ $metrics['active_profile'] === 'balanced' ? '✓ Active Profile' : 'Activate Balanced' }}
                        </button>
                    </div>
                </div>

                {{-- Profile 3: Eco (Low CPU) --}}
                <div class="votion-profile-box {{ $metrics['active_profile'] === 'eco' ? 'is-active' : '' }}" id="cardEco">
                    <div class="votion-profile-content">
                        <div class="votion-profile-row">
                            <div class="votion-profile-heading">
                                <i class="fa fa-leaf" style="color: #3B82F6;"></i>
                                <span class="votion-profile-name">Eco (Low CPU)</span>
                            </div>
                            <span class="votion-pill-badge pill-blue font-mono">Low CPU</span>
                        </div>
                        <p class="votion-profile-info">
                            Gentle background memory merging (300 pages/50ms) engineered for shared, single-core or budget VPS host nodes.
                        </p>
                        <div class="votion-spec-tags font-mono">
                            <span class="votion-spec-tag">pages_to_scan: <strong>300</strong></span>
                            <span class="votion-spec-tag">sleep: <strong>50ms</strong></span>
                            <span class="votion-spec-tag">smart_scan: <strong>1</strong></span>
                        </div>
                    </div>
                    <div class="votion-profile-actions">
                        <button type="button" id="btnProfileEco" class="votion-profile-btn {{ $metrics['active_profile'] === 'eco' ? 'btn-active' : '' }}" onclick="applyProfile('eco')">
                            {{ $metrics['active_profile'] === 'eco' ? '✓ Active Profile' : 'Activate Eco' }}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    </section>

    {{-- =========================================================================
        4. MAIN TWO-COLUMN WORKBENCH (Instrument Table & Controls)
       ========================================================================= --}}
    <div class="row">
        
        {{-- LEFT COLUMN: Memory Instrument Panel & Live Benchmark --}}
        <div class="col-md-7">

            {{-- Visual Memory Pool Breakdown --}}
            <div class="votion-card" style="margin-bottom: 24px;">
                <div class="votion-card-header">
                    <div class="votion-card-header-left">
                        <span class="votion-card-title font-sans font-semibold">Host Memory Pool Breakdown</span>
                        <span class="votion-card-desc">Segmented physical allocation of kernel and merged pages.</span>
                    </div>
                    <div class="votion-card-header-right">
                        <span class="votion-mono-stat font-mono" id="metricRamTotal">Total Pool: {{ $metrics['system_ram']['total_human'] }}</span>
                    </div>
                </div>

                <div class="votion-card-body">
                    {{-- Proportional Progress Segment Bar --}}
                    <div class="votion-segment-bar" id="memorySegmentBar">
                        <div class="votion-segment seg-green" id="segSaved" title="Net Physical RAM Saved" style="width: {{ max(2, min(40, $metrics['savings_percentage'] * 3)) }}%;"></div>
                        <div class="votion-segment seg-blue" id="segShared" title="Active Shared COW Base" style="width: 14%;"></div>
                        <div class="votion-segment seg-amber" id="segUnshared" title="Unique Scanned Pages" style="width: 22%;"></div>
                        <div class="votion-segment seg-dark" id="segOther" title="System / Guest Allocated" style="width: 62%;"></div>
                    </div>

                    {{-- Votion Telemetry Instrument Table --}}
                    <div class="votion-instrument-table-wrap">
                        <table class="votion-instrument-table">
                            <thead>
                                <tr>
                                    <th>Memory Segment</th>
                                    <th>Volume / Pages</th>
                                    <th>State & Details</th>
                                    <th style="text-align: right;">Metric</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <div class="votion-row-label">
                                            <span class="votion-dot" style="background: #10B981;"></span>
                                            <span class="font-medium text-white">Net Physical RAM Saved</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="font-mono text-white font-semibold" id="tableSavedHuman">{{ $metrics['memory_saved_human'] }}</span>
                                    </td>
                                    <td>
                                        <span class="text-muted" id="tableSharingRef">{{ number_format($metrics['pages_sharing']) }} duplicate references eliminated</span>
                                    </td>
                                    <td style="text-align: right;">
                                        <span class="votion-pill-badge pill-green font-mono" id="tableSavingsPct">{{ $metrics['savings_percentage'] }}% SAVED</span>
                                    </td>
                                </tr>

                                <tr>
                                    <td>
                                        <div class="votion-row-label">
                                            <span class="votion-dot" style="background: #3B82F6;"></span>
                                            <span class="font-medium text-white">Consolidated Shared Base</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="font-mono text-white font-semibold" id="tableSharedHuman">{{ $metrics['memory_shared_human'] }}</span>
                                    </td>
                                    <td>
                                        <span class="text-muted" id="tableSharedCount">{{ number_format($metrics['pages_shared']) }} unique physical Copy-On-Write pages</span>
                                    </td>
                                    <td style="text-align: right;">
                                        <span class="votion-pill-badge pill-blue font-mono">COW BASE</span>
                                    </td>
                                </tr>

                                <tr>
                                    <td>
                                        <div class="votion-row-label">
                                            <span class="votion-dot" style="background: #F59E0B;"></span>
                                            <span class="font-medium text-white">Pages Scanned (Unshared)</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="font-mono text-white font-semibold" id="tableUnsharedCount">{{ number_format($metrics['pages_unshared']) }}</span>
                                    </td>
                                    <td>
                                        <span class="text-muted">Scanned by engine but unique across processes</span>
                                    </td>
                                    <td style="text-align: right;">
                                        <span class="votion-pill-badge pill-amber font-mono">ACTIVE</span>
                                    </td>
                                </tr>

                                <tr>
                                    <td>
                                        <div class="votion-row-label">
                                            <span class="votion-dot" style="background: #8B5CF6;"></span>
                                            <span class="font-medium text-white">Volatile / High-Write</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="font-mono text-white font-semibold" id="tableVolatileCount">{{ number_format($metrics['pages_volatile']) }}</span>
                                    </td>
                                    <td>
                                        <span class="text-muted">Fast-changing memory skipped by smart scan</span>
                                    </td>
                                    <td style="text-align: right;">
                                        <span class="votion-pill-badge pill-purple font-mono">SKIPPED</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {{-- Live In-Memory Benchmark Runner --}}
            <div class="votion-card">
                <div class="votion-card-header">
                    <div class="votion-card-header-left">
                        <span class="votion-card-title font-sans font-semibold">Live In-Memory Deduplication Benchmark</span>
                        <span class="votion-card-desc">Allocate real synthetic memory buffers to test Linux kernel page consolidation.</span>
                    </div>
                    <div class="votion-card-header-right">
                        <span class="votion-pill-badge pill-amber font-mono">SYNTHETIC 32MB</span>
                    </div>
                </div>

                <div class="votion-card-body">
                    <p class="votion-text-subtle" style="margin-bottom: 16px;">
                        Verifies that your host Linux kernel dynamically merges identical memory pages using <code>MADV_MERGEABLE</code>. Runs in a sandboxed worker and outputs sub-millisecond page consolidation metrics.
                    </p>

                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button type="button" id="btnRunTest" class="votion-btn-primary" onclick="runBenchmarkTest()">
                            <i class="fa fa-play" style="margin-right: 6px;"></i>
                            <span>Execute 32 MB Benchmark</span>
                        </button>
                        <span id="testSpinner" style="display: none; color: #10B981; font-size: 12px; font-family: var(--font-mono);">
                            <i class="fa fa-spinner fa-spin"></i> Consolidating test buffers...
                        </span>
                    </div>

                    <div id="testOutputBox" class="votion-terminal-box" style="display: none;"></div>
                </div>
            </div>

        </div>

        {{-- RIGHT COLUMN: Host Readiness & Custom Engine Controls --}}
        <div class="col-md-5">

            {{-- Host Readiness & Container Status --}}
            <div class="votion-card" style="margin-bottom: 24px;">
                <div class="votion-card-header">
                    <div class="votion-card-header-left">
                        <span class="votion-card-title font-sans font-semibold">Host Readiness & Integration</span>
                        <span class="votion-card-desc">Subsystem status across kernel, systemd, and container hooks.</span>
                    </div>
                    <div class="votion-card-header-right">
                        <span class="votion-status-pill {{ $metrics['readiness']['score'] >= 75 ? 'status-running' : 'status-stopped' }}">
                            <span class="votion-status-dot"></span>
                            <span>{{ $metrics['readiness']['score'] }}% READY</span>
                        </span>
                    </div>
                </div>

                <div class="votion-card-body">
                    <div class="votion-checklist">
                        {{-- Item 1 --}}
                        <div class="votion-check-row">
                            <i class="fa {{ $metrics['readiness']['kernel_supported'] ? 'fa-check-circle text-green' : 'fa-times-circle text-red' }} votion-check-icon"></i>
                            <div class="votion-check-info">
                                <div class="votion-check-title">Kernel KSM Subsystem</div>
                                <div class="votion-check-desc">/sys/kernel/mm/ksm kernel interface present & active</div>
                            </div>
                        </div>

                        {{-- Item 2 --}}
                        <div class="votion-check-row">
                            <i class="fa {{ $metrics['readiness']['ksm_running'] ? 'fa-check-circle text-green' : 'fa-times-circle text-red' }} votion-check-icon"></i>
                            <div class="votion-check-info">
                                <div class="votion-check-title">KSM Engine Run State (run = 1)</div>
                                <div class="votion-check-desc">Linux kernel memory merge engine actively running</div>
                            </div>
                        </div>

                        {{-- Item 3 --}}
                        <div class="votion-check-row">
                            <i class="fa {{ $metrics['readiness']['systemd_active'] ? 'fa-check-circle text-green' : 'fa-minus-circle text-amber' }} votion-check-icon"></i>
                            <div class="votion-check-info">
                                <div class="votion-check-title">Adaptive Auto-Tuner Daemon</div>
                                <div class="votion-check-desc">stellar-ksm.service dynamically balances scan rate</div>
                            </div>
                        </div>

                        {{-- Item 4 --}}
                        <div class="votion-check-row">
                            <i class="fa {{ $metrics['readiness']['libksm_installed'] ? 'fa-check-circle text-green' : 'fa-info-circle text-blue' }} votion-check-icon"></i>
                            <div class="votion-check-info">
                                <div class="votion-check-title">Container Preloader (libksm.so)</div>
                                <div class="votion-check-desc">Transparent memory hooks for game servers & containers</div>
                            </div>
                        </div>
                    </div>

                    {{-- 1-Click Server Setup CLI Snippet --}}
                    <div class="votion-snippet-box">
                        <div class="votion-snippet-label font-mono">1-Click Host Server Setup Command:</div>
                        <div class="votion-snippet-row">
                            <code class="votion-snippet-code font-mono" id="cmdSnippet">php artisan ksm:setup</code>
                            <button type="button" class="votion-btn-copy" onclick="copySnippet()" title="Copy command">
                                <i class="fa fa-clone" style="margin-right: 4px;"></i> Copy
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {{-- Custom Parameter Tuning Form --}}
            <div class="votion-card">
                <div class="votion-card-header">
                    <div class="votion-card-header-left">
                        <span class="votion-card-title font-sans font-semibold">Engine Parameters & Control</span>
                        <span class="votion-card-desc">Fine-tune kernel scanning limits and NUMA behavior.</span>
                    </div>
                    <div class="votion-card-header-right">
                        <span class="votion-pill-badge pill-purple font-mono">SYSCTL</span>
                    </div>
                </div>

                <div class="votion-card-body">
                    <form id="ksmParamsForm" onsubmit="saveParameters(event)">
                        {!! csrf_field() !!}

                        {{-- Run State --}}
                        <div class="votion-field-group">
                            <label class="votion-label">Engine Run State</label>
                            <select name="run" id="inputRun" class="votion-select font-sans">
                                <option value="1" {{ $metrics['run'] === 1 ? 'selected' : '' }}>1 - Run (Active Memory Scanning & Deduplication)</option>
                                <option value="0" {{ $metrics['run'] === 0 ? 'selected' : '' }}>0 - Stop (Keep existing merged pages, pause scanning)</option>
                                <option value="2" {{ $metrics['run'] === 2 ? 'selected' : '' }}>2 - Unmerge (Split all shared pages back into unshared)</option>
                            </select>
                        </div>

                        {{-- Pages To Scan --}}
                        <div class="votion-field-group">
                            <div class="votion-field-header">
                                <label class="votion-label">Pages Scanned Per Cycle (pages_to_scan)</label>
                                <span class="votion-range-val font-mono" id="valPagesToScan">{{ $metrics['parameters']['pages_to_scan'] }}</span>
                            </div>
                            <input type="range" name="pages_to_scan" id="inputPagesToScan" min="50" max="5000" step="50" value="{{ $metrics['parameters']['pages_to_scan'] }}" class="votion-range" oninput="document.getElementById('valPagesToScan').innerText = this.value">
                            <span class="votion-help-text">Controls how many memory pages ksmd checks before sleeping. Higher values deduplicate faster.</span>
                        </div>

                        {{-- Sleep Millisecs --}}
                        <div class="votion-field-group">
                            <div class="votion-field-header">
                                <label class="votion-label">Sleep Interval Between Scans (sleep_millisecs)</label>
                                <span class="votion-range-val font-mono" id="valSleep" style="color: #3B82F6;">{{ $metrics['parameters']['sleep_millisecs'] }} ms</span>
                            </div>
                            <input type="range" name="sleep_millisecs" id="inputSleep" min="0" max="200" step="5" value="{{ $metrics['parameters']['sleep_millisecs'] }}" class="votion-range" oninput="document.getElementById('valSleep').innerText = this.value + ' ms'">
                            <span class="votion-help-text">Milliseconds ksmd sleeps between scanning page batches (10–30ms recommended).</span>
                        </div>

                        {{-- Merge Across NUMA Nodes --}}
                        <div class="votion-field-group">
                            <label class="votion-label">NUMA Node Sharing (merge_across_nodes)</label>
                            <select name="merge_across_nodes" id="inputMergeNodes" class="votion-select font-sans">
                                <option value="1" {{ $metrics['parameters']['merge_across_nodes'] ? 'selected' : '' }}>1 - Enabled (Merge across all NUMA nodes for maximum RAM savings)</option>
                                <option value="0" {{ !$metrics['parameters']['merge_across_nodes'] ? 'selected' : '' }}>0 - Disabled (Only merge within same NUMA socket for lowest latency)</option>
                            </select>
                        </div>

                        {{-- Smart Scan (Kernel 6.4+) --}}
                        <div class="votion-field-group" style="margin-bottom: 24px;">
                            <label class="votion-label">Smart Scan (Kernel 6.4+)</label>
                            <select name="smart_scan" id="inputSmartScan" class="votion-select font-sans">
                                <option value="1" {{ $metrics['parameters']['smart_scan'] ? 'selected' : '' }}>1 - Enabled (Skip scanning volatile/unchanging pages)</option>
                                <option value="0" {{ !$metrics['parameters']['smart_scan'] ? 'selected' : '' }}>0 - Disabled (Standard continuous linear scan)</option>
                            </select>
                        </div>

                        <div style="display: flex; justify-content: flex-end;">
                            <button type="submit" class="votion-btn-primary" id="btnSaveParams">
                                <i class="fa fa-save" style="margin-right: 6px;"></i>
                                <span>Save Parameters</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

        </div>

    </div>

</div>

{{-- =========================================================================
    5. STYLES: VOTION CARTA INK & LUXURY DARK THEME SYSTEM
   ========================================================================= --}}
<style>
/* Votion Root Tokens */
.votion-dashboard {
    color: #F3F4F6;
    margin-top: 4px;
}

.text-green { color: #10B981 !important; }
.text-amber { color: #F59E0B !important; }
.text-blue { color: #3B82F6 !important; }
.text-red { color: #EF4444 !important; }
.text-muted { color: #737373 !important; font-size: 11px; }

/* Page Header */
.votion-header-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
}

@media (min-width: 768px) {
    .votion-header-wrap {
        flex-direction: row;
        align-items: flex-end;
        justify-content: space-between;
    }
}

.votion-page-title {
    font-size: 26px;
    font-weight: 500;
    letter-spacing: -0.025em;
    color: #FFFFFF;
    margin: 0 0 4px 0;
    line-height: 1.15;
}

.votion-page-subtitle {
    font-size: 12px;
    color: #8A8A8A;
    margin: 0;
    line-height: 1.4;
}

.votion-breadcrumb {
    font-size: 11px;
    margin: 0;
    padding: 0;
    background: transparent;
    list-style: none;
    display: flex;
    gap: 6px;
    align-items: center;
}

.votion-breadcrumb li + li:before {
    content: "/";
    color: #404040;
    padding-right: 6px;
}

.votion-breadcrumb a {
    color: #737373;
    transition: color 150ms ease;
}

.votion-breadcrumb a:hover {
    color: #FFFFFF;
}

.votion-breadcrumb .active {
    color: #A0A0A0;
}

/* Toast */
.votion-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    padding: 12px 18px;
    background: #181818;
    color: #FFFFFF;
    font-size: 13px;
    font-weight: 500;
    border-radius: 10px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    border: 1px solid #313131;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    animation: votionSlideUp 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes votionSlideUp {
    from { transform: translateY(12px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

.votion-toast-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.votion-toast-close {
    background: none;
    border: none;
    color: #737373;
    font-size: 13px;
    cursor: pointer;
}

.votion-toast-close:hover {
    color: #FFFFFF;
}

/* Context & Controls Bar */
.votion-context-bar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #1F1F1F;
}

@media (min-width: 992px) {
    .votion-context-bar {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }
}

.votion-engine-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #0A0A0A;
    border: 1px solid #222222;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
}

.votion-chip-kicker {
    color: #10B981;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.08em;
}

.votion-chip-separator {
    color: #333333;
}

.votion-chip-val {
    color: #E5E5E5;
    font-size: 11px;
}

.votion-chip-sub {
    color: #737373;
    font-size: 11px;
}

.votion-context-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.votion-clock-badge {
    display: none;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #222222;
    background: #0A0A0A;
    font-size: 11px;
    color: #8A8A8A;
}

@media (min-width: 768px) {
    .votion-clock-badge {
        display: flex;
    }
}

.votion-clock-time {
    color: #FFFFFF;
    font-weight: 600;
}

.votion-clock-sep {
    color: #333333;
}

.votion-live-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.08);
    color: #10B981;
    font-size: 10px;
    letter-spacing: 0.06em;
    font-weight: 600;
}

.votion-pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10B981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
    animation: votionPulse 2s infinite;
}

@keyframes votionPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.85); }
}

.votion-action-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Master Buttons */
.votion-btn-primary {
    background: #FFFFFF;
    color: #000000;
    border: 1px solid #FFFFFF;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    display: inline-flex;
    align-items: center;
    line-height: 1.4;
}

.votion-btn-primary:hover {
    background: #E5E5E5;
    border-color: #E5E5E5;
}

.votion-btn-secondary {
    background: #0D0D0D;
    color: #E5E5E5;
    border: 1px solid #262626;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    display: inline-flex;
    align-items: center;
    line-height: 1.4;
}

.votion-btn-secondary:hover {
    background: #191919;
    border-color: #383838;
    color: #FFFFFF;
}

/* Status Pill */
.votion-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 9999px;
    border: 1px solid transparent;
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 600;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.votion-status-pill.status-running {
    color: #10B981;
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
}

.votion-status-pill.status-stopped {
    color: #EF4444;
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
}

.votion-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 6px currentColor;
}

/* Bento Hub (4-Card Grid) */
.votion-bento-hub {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 16px;
    margin-bottom: 24px;
}

@media (min-width: 640px) {
    .votion-bento-hub {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 1200px) {
    .votion-bento-hub {
        grid-template-columns: repeat(4, 1fr);
    }
}

.votion-tile {
    background: #0A0A0A;
    border: 1px solid #1F1F1F;
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 180ms ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.votion-tile:hover {
    border-color: #383838;
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
}

.votion-tile-top {
    margin-bottom: 14px;
}

.votion-tile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.votion-tile-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8A8A8A;
}

.votion-tile-tag {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 4px;
    background: #141414;
    border: 1px solid #222222;
    color: #A0A0A0;
}

.votion-tile-value-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
}

.votion-tile-main {
    display: flex;
    flex-direction: column;
}

.votion-tile-stat {
    font-family: var(--font-mono, monospace);
    font-size: 32px;
    font-weight: 500;
    color: #FFFFFF;
    line-height: 1;
    letter-spacing: -0.02em;
}

.votion-tile-denom {
    font-size: 11px;
    color: #737373;
    margin-top: 4px;
}

.votion-sparkline-wrap {
    flex-shrink: 0;
}

.votion-sparkline {
    overflow: visible;
}

.votion-gauge {
    height: 4px;
    width: 100%;
    border-radius: 9999px;
    background: #1F1F1F;
    overflow: hidden;
    margin-bottom: 8px;
}

.votion-gauge-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 400ms ease;
}

.votion-tile-subtext {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    color: #737373;
}

/* Master Votion Card */
.votion-card {
    background: #0A0A0A;
    border: 1px solid #1F1F1F;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}

.votion-card-header {
    padding: 16px 20px;
    background: #050505;
    border-bottom: 1px solid #181818;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.votion-card-header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.votion-card-title {
    font-family: var(--font-sans, "Inter", sans-serif);
    font-size: 15px;
    font-weight: 600;
    color: #FFFFFF;
    letter-spacing: -0.01em;
}

.votion-card-desc {
    font-size: 11px;
    color: #737373;
}

.votion-card-body {
    padding: 20px;
}

.votion-mono-stat {
    font-size: 11px;
    color: #A0A0A0;
}

.votion-profile-active-tag {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(59, 130, 246, 0.1);
    color: #3B82F6;
    border: 1px solid rgba(59, 130, 246, 0.3);
    font-weight: 600;
    letter-spacing: 0.05em;
}

/* 1-Click Profile Cards */
.votion-profile-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 16px;
}

@media (min-width: 992px) {
    .votion-profile-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

.votion-profile-box {
    background: #000000;
    border: 1px solid #1F1F1F;
    border-radius: 10px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 195px;
    transition: all 160ms ease;
}

.votion-profile-box:hover {
    border-color: #383838;
}

.votion-profile-box.is-active {
    border-color: #10B981 !important;
    background: rgba(16, 185, 129, 0.03) !important;
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.08);
}

.votion-profile-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    gap: 8px;
}

.votion-profile-heading {
    display: flex;
    align-items: center;
    gap: 8px;
}

.votion-profile-name {
    font-size: 13.5px;
    font-weight: 600;
    color: #FFFFFF;
}

.votion-profile-info {
    font-size: 11.5px;
    color: #8A8A8A;
    line-height: 1.5;
    margin-bottom: 14px;
    min-height: 48px;
}

.votion-spec-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 14px;
}

.votion-spec-tag {
    background: #0D0D0D;
    border: 1px solid #222222;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    color: #737373;
}

.votion-spec-tag strong {
    color: #D4D4D4;
}

.votion-profile-btn {
    width: 100%;
    background: #FFFFFF;
    color: #000000;
    font-weight: 600;
    font-size: 11.5px;
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.votion-profile-btn:hover {
    background: #E5E5E5;
}

.votion-profile-btn.btn-active {
    background: rgba(16, 185, 129, 0.12) !important;
    color: #10B981 !important;
    border-color: rgba(16, 185, 129, 0.3) !important;
}

.votion-profile-btn.btn-active:hover {
    background: rgba(16, 185, 129, 0.2) !important;
}

/* Badges */
.votion-pill-badge {
    font-size: 9px;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.05em;
    font-weight: 700;
    white-space: nowrap;
}

.pill-amber {
    color: #F59E0B;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.pill-green {
    color: #10B981;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.pill-blue {
    color: #3B82F6;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
}

.pill-purple {
    color: #8B5CF6;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.3);
}

/* Segment Bar */
.votion-segment-bar {
    height: 10px;
    background: #141414;
    border-radius: 9999px;
    overflow: hidden;
    display: flex;
    margin-bottom: 20px;
    border: 1px solid #1F1F1F;
}

.votion-segment {
    height: 100%;
    transition: width 400ms ease;
}

.seg-green { background: #10B981; }
.seg-blue { background: #3B82F6; }
.seg-amber { background: #F59E0B; }
.seg-dark { background: #242424; }

/* Instrument Table */
.votion-instrument-table-wrap {
    overflow-x: auto;
}

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
    padding: 0 12px 10px 0;
    border-bottom: 1px solid #1F1F1F;
    text-align: left;
}

.votion-instrument-table td {
    padding: 12px 12px 12px 0;
    border-bottom: 1px solid #161616;
    font-size: 11.5px;
    vertical-align: middle;
}

.votion-instrument-table tr:last-child td {
    border-bottom: none;
}

.votion-row-label {
    display: flex;
    align-items: center;
    gap: 8px;
}

.votion-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
}

/* Checklist */
.votion-checklist {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 20px;
}

.votion-check-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.votion-check-icon {
    font-size: 15px;
    margin-top: 2px;
    flex-shrink: 0;
}

.votion-check-title {
    font-size: 12px;
    font-weight: 600;
    color: #FFFFFF;
}

.votion-check-desc {
    font-size: 11px;
    color: #737373;
    margin-top: 2px;
}

/* Snippet Box */
.votion-snippet-box {
    background: #000000;
    border: 1px solid #1F1F1F;
    border-radius: 8px;
    padding: 12px 14px;
}

.votion-snippet-label {
    font-size: 10px;
    font-weight: 600;
    color: #737373;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.votion-snippet-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.votion-snippet-code {
    flex: 1;
    background: #0A0A0A;
    border: 1px solid #222222;
    padding: 6px 10px;
    border-radius: 5px;
    font-size: 11px;
    color: #FFFFFF;
    user-select: all;
}

.votion-btn-copy {
    background: #141414;
    border: 1px solid #2B2B2B;
    color: #E5E5E5;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 5px;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
}

.votion-btn-copy:hover {
    background: #222222;
    border-color: #404040;
    color: #FFFFFF;
}

/* Terminal Console */
.votion-terminal-box {
    margin-top: 14px;
    padding: 14px;
    border-radius: 8px;
    background: #020202;
    border: 1px solid #1F1F1F;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #10B981;
    line-height: 1.6;
}

/* Form Controls */
.votion-field-group {
    margin-bottom: 18px;
}

.votion-field-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.votion-label {
    font-size: 11px;
    font-weight: 600;
    color: #A0A0A0;
    margin-bottom: 6px;
    display: block;
}

.votion-field-header .votion-label {
    margin-bottom: 0;
}

.votion-range-val {
    font-size: 11px;
    color: #10B981;
    font-weight: 600;
}

.votion-help-text {
    font-size: 10.5px;
    color: #5C5C5C;
    margin-top: 5px;
    display: block;
}

.votion-select {
    width: 100%;
    background: #000000;
    border: 1px solid #1F1F1F;
    border-radius: 6px;
    padding: 8px 12px;
    color: #FFFFFF;
    font-size: 12px;
    outline: none;
    transition: border-color 150ms ease;
}

.votion-select:focus {
    border-color: #404040;
}

.votion-range {
    width: 100%;
    accent-color: #10B981;
    cursor: pointer;
}
</style>

{{-- =========================================================================
    6. SCRIPTS: REAL-TIME TELEMETRY, SPARKLINES, CONTROLS & TOAST
   ========================================================================= --}}
<script>
let livePolling = true;
let pollTimer = null;
let savedHistory = [];
let ratioHistory = [];

// Real-time Clock
function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('votionClockTime');
    const dateEl = document.getElementById('votionClockDate');
    if (timeEl) {
        timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (dateEl) {
        dateEl.innerText = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}
setInterval(updateClock, 1000);
updateClock();

// Votion Floating Toast Notification
function showToast(message) {
    const toast = document.getElementById('votionToast');
    const text = document.getElementById('votionToastText');
    text.innerText = message;
    toast.style.display = 'flex';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(hideToast, 3500);
}

function hideToast() {
    const toast = document.getElementById('votionToast');
    toast.style.display = 'none';
}

// Copy Setup Snippet
function copySnippet() {
    const text = document.getElementById('cmdSnippet').innerText;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied setup command: ' + text);
    });
}

// Toggle Live Polling
document.getElementById('toggleLiveBtn').addEventListener('click', function() {
    livePolling = !livePolling;
    const pill = document.getElementById('livePill');
    const icon = document.getElementById('toggleLiveIcon');
    const text = document.getElementById('toggleLiveText');
    const statusText = document.getElementById('liveStatusText');

    if (livePolling) {
        text.innerText = 'Pause';
        icon.className = 'fa fa-pause';
        pill.style.opacity = '1';
        statusText.innerText = 'LIVE TELEMETRY (3S)';
        showToast('Live telemetry polling resumed');
        schedulePoll();
    } else {
        text.innerText = 'Resume';
        icon.className = 'fa fa-play';
        pill.style.opacity = '0.4';
        statusText.innerText = 'POLLING PAUSED';
        clearTimeout(pollTimer);
        showToast('Live telemetry polling paused');
    }
});

function schedulePoll() {
    if (!livePolling) return;
    pollTimer = setTimeout(fetchMetrics, 3000);
}

// Render dynamic SVG sparkline path
function updateSparkline(svgElementId, dataPoints, strokeColor, gradId) {
    const container = document.getElementById(svgElementId);
    if (!container || dataPoints.length < 2) return;

    const w = 90;
    const h = 26;
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints, min + 0.001);
    const range = max - min || 1;

    const pts = dataPoints.map((v, i) => {
        const x = (i / (dataPoints.length - 1)) * w;
        const y = h - ((v - min) / range) * (h - 6) - 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const lastX = w;
    const lastY = (h - ((dataPoints[dataPoints.length - 1] - min) / range) * (h - 6) - 3).toFixed(1);

    container.innerHTML = `
        <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="votion-sparkline">
            <defs>
                <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.35" />
                    <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0" />
                </linearGradient>
            </defs>
            <polygon points="0,${h} ${pts} ${w},${h}" fill="url(#${gradId})" />
            <polyline fill="none" stroke="${strokeColor}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" points="${pts}" />
            <circle cx="${lastX}" cy="${lastY}" r="2.5" fill="${strokeColor}" />
        </svg>
    `;
}

// Fetch live metrics
function fetchMetrics(manual = false) {
    const syncIcon = document.getElementById('syncIcon');
    if (manual && syncIcon) syncIcon.classList.add('fa-spin');

    fetch('{{ route("admin.ksm.metrics") }}', {
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(r => r.json())
    .then(data => {
        if (manual && syncIcon) syncIcon.classList.remove('fa-spin');
        if (!data || !data.supported) return;

        // Update Bento Tiles
        document.getElementById('metricSavedHuman').innerText = data.memory_saved_human;
        document.getElementById('tileSavedPct').innerText = data.savings_percentage + '% of Host RAM';
        document.getElementById('barSavedPct').style.width = Math.min(100, Math.max(2, data.savings_percentage * 4)) + '%';
        document.getElementById('metricSharingRef').innerText = data.pages_sharing.toLocaleString();

        document.getElementById('metricRatio').innerText = data.sharing_ratio + 'x';
        document.getElementById('barRatio').style.width = Math.min(100, data.sharing_ratio * 20) + '%';

        document.getElementById('metricPagesShared').innerText = data.pages_shared.toLocaleString();
        document.getElementById('metricCowPages').innerText = data.pages_shared.toLocaleString();
        document.getElementById('metricSharedHuman').innerText = data.memory_shared_human + ' base';

        const statusPill = document.getElementById('metricStatus');
        const statusLabel = document.getElementById('metricStatusLabel');
        statusLabel.innerText = data.status.toUpperCase();
        statusPill.className = 'votion-status-pill ' + (data.status === 'running' ? 'status-running' : 'status-stopped');
        document.getElementById('metricScansCount').innerText = data.full_scans.toLocaleString();

        // Update Instrument Table
        document.getElementById('tableSavedHuman').innerText = data.memory_saved_human;
        document.getElementById('tableSavingsPct').innerText = data.savings_percentage + '% SAVED';
        document.getElementById('tableSharingRef').innerText = data.pages_sharing.toLocaleString() + ' duplicate references eliminated';
        document.getElementById('tableSharedHuman').innerText = data.memory_shared_human;
        document.getElementById('tableSharedCount').innerText = data.pages_shared.toLocaleString() + ' unique physical Copy-On-Write pages';
        document.getElementById('tableUnsharedCount').innerText = data.pages_unshared.toLocaleString();
        document.getElementById('tableVolatileCount').innerText = data.pages_volatile.toLocaleString();

        // Update Segment widths
        document.getElementById('segSaved').style.width = Math.max(2, Math.min(40, data.savings_percentage * 3)) + '%';

        // Update Sparklines
        const savedMb = (data.memory_saved_bytes || 0) / (1024 * 1024);
        savedHistory.push(savedMb);
        if (savedHistory.length > 8) savedHistory.shift();
        if (savedHistory.length >= 2) {
            updateSparkline('sparkSaved', savedHistory, '#10B981', 'sparkGradGreen');
        }

        ratioHistory.push(data.sharing_ratio || 1);
        if (ratioHistory.length > 8) ratioHistory.shift();
        if (ratioHistory.length >= 2) {
            updateSparkline('sparkRatio', ratioHistory, '#3B82F6', 'sparkGradBlue');
        }

        if (manual) showToast('Telemetry synchronized');
    })
    .catch(() => {
        if (manual && syncIcon) syncIcon.classList.remove('fa-spin');
    })
    .finally(() => {
        schedulePoll();
    });
}

// 1-Click Profile Switcher
function applyProfile(profileName) {
    const cap = profileName.charAt(0).toUpperCase() + profileName.slice(1);
    const targetBtn = document.getElementById('btnProfile' + cap);
    if (targetBtn) {
        targetBtn.disabled = true;
        targetBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Activating…';
    }

    fetch('{{ route("admin.ksm.profile") }}', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': '{{ csrf_token() }}',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ profile: profileName })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            // Update active profile boxes & buttons
            ['Aggressive', 'Balanced', 'Eco'].forEach(p => {
                const el = document.getElementById('card' + p);
                const btn = document.getElementById('btnProfile' + p);
                if (el) el.classList.remove('is-active');
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Activate ' + p;
                    btn.classList.remove('btn-active');
                }
            });

            const activeBox = document.getElementById('card' + cap);
            const activeBtn = document.getElementById('btnProfile' + cap);
            if (activeBox) activeBox.classList.add('is-active');
            if (activeBtn) {
                activeBtn.disabled = false;
                activeBtn.innerText = '✓ Active Profile';
                activeBtn.classList.add('btn-active');
            }

            document.getElementById('currentProfileBadge').innerText = 'ACTIVE: ' + profileName.toUpperCase();

            // Sync sliders
            if (data.result && data.result.parameters) {
                const params = data.result.parameters;
                if (params.pages_to_scan) {
                    document.getElementById('inputPagesToScan').value = params.pages_to_scan;
                    document.getElementById('valPagesToScan').innerText = params.pages_to_scan;
                }
                if (params.sleep_millisecs !== undefined) {
                    document.getElementById('inputSleep').value = params.sleep_millisecs;
                    document.getElementById('valSleep').innerText = params.sleep_millisecs + ' ms';
                }
            }

            showToast('Optimization profile set to ' + cap);
            fetchMetrics();
        } else {
            if (targetBtn) targetBtn.disabled = false;
            showToast('Failed to apply profile: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(() => {
        if (targetBtn) targetBtn.disabled = false;
        showToast('Error communicating with server.');
    });
}

// Save Custom Parameters
function saveParameters(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveParams');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving…';

    const payload = {
        run: parseInt(document.getElementById('inputRun').value, 10),
        pages_to_scan: parseInt(document.getElementById('inputPagesToScan').value, 10),
        sleep_millisecs: parseInt(document.getElementById('inputSleep').value, 10),
        merge_across_nodes: parseInt(document.getElementById('inputMergeNodes').value, 10),
        smart_scan: parseInt(document.getElementById('inputSmartScan').value, 10),
    };

    fetch('{{ route("admin.ksm.update") }}', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': '{{ csrf_token() }}',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-check"></i> Saved!';
        showToast('Kernel parameters saved successfully');
        setTimeout(() => {
            btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;"></i><span>Save Parameters</span>';
        }, 1800);
        fetchMetrics();
    })
    .catch(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;"></i><span>Save Parameters</span>';
        showToast('Failed to save parameters.');
    });
}

// Execute Benchmark Test
function runBenchmarkTest() {
    const btn = document.getElementById('btnRunTest');
    const headerBtn = document.getElementById('btnRunTestHeader');
    const spinner = document.getElementById('testSpinner');
    const outputBox = document.getElementById('testOutputBox');

    if (btn) btn.disabled = true;
    if (headerBtn) headerBtn.disabled = true;
    spinner.style.display = 'inline-block';
    outputBox.style.display = 'none';

    fetch('{{ route("admin.ksm.test") }}', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': '{{ csrf_token() }}',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ buffer_mb: 32 })
    })
    .then(r => r.json())
    .then(res => {
        if (btn) btn.disabled = false;
        if (headerBtn) headerBtn.disabled = false;
        spinner.style.display = 'none';
        outputBox.style.display = 'block';
        outputBox.innerHTML = `<strong>✓ Benchmark Success (${res.elapsed_ms}ms):</strong> ${res.message}<br><span style="color:#A0A0A0;">Pages Tested: <strong>${res.pages_tested.toLocaleString()}</strong> · Consolidated: <strong>${res.pages_merged.toLocaleString()}</strong> · RAM Reclaimed: <strong>${res.saved_mb} MB</strong></span>`;
        showToast(`Benchmark completed in ${res.elapsed_ms}ms (${res.saved_mb} MB reclaimed)`);
        fetchMetrics();
    })
    .catch(() => {
        if (btn) btn.disabled = false;
        if (headerBtn) headerBtn.disabled = false;
        spinner.style.display = 'none';
        outputBox.style.display = 'block';
        outputBox.style.color = '#EF4444';
        outputBox.innerText = 'Failed to execute synthetic benchmark test.';
        showToast('Benchmark test execution failed.');
    });
}

// Start live polling on load
schedulePoll();
</script>
@endsection