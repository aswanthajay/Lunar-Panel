@extends('layouts.admin')

@section('title')
    Kernel Samepage Merging (KSM)
@endsection

@section('content-header')
    <div>
        <h1>Kernel Samepage Merging (KSM)</h1>
        <small>Real-time memory deduplication, container memory consolidation, and kernel tuning.</small>
    </div>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Kernel Memory (KSM)</li>
    </ol>
@endsection

@section('content')
<div class="ksm-container">

    {{-- Top Telemetry Bar --}}
    <div class="lunar-bento-container" style="margin-bottom: 20px;">
        <div class="lunar-bento-header">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="lunar-bento-header-title">Kernel Memory Telemetry</span>
                <span style="color: #333333; font-size: 11px; user-select: none;">/</span>
                <span class="font-mono" style="font-size: 11px; color: #737373;">Host Engine: {{ $metrics['readiness']['os_name'] }} ({{ $metrics['readiness']['kernel_release'] }})</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                {{-- Live polling indicator --}}
                <div style="display: flex; align-items: center; gap: 6px;" id="liveIndicator">
                    <span class="ksm-pulse-dot" style="background-color: #10B981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);"></span>
                    <span class="font-mono" style="font-size: 10px; color: #8A8A8A; text-transform: uppercase; letter-spacing: 0.08em;">
                        LIVE TELEMETRY (3S)
                    </span>
                </div>
                <button type="button" id="toggleLiveBtn" class="ksm-btn-secondary" style="padding: 2px 8px; font-size: 10px;">
                    Pause
                </button>
            </div>
        </div>

        {{-- Bento Grid Stats --}}
        <div class="lunar-bento-grid" style="grid-template-columns: repeat(4, 1fr);">
            {{-- Cell 1: Total RAM Saved --}}
            <div class="lunar-bento-cell">
                <div>
                    <span class="lunar-bento-label">Physical RAM Saved</span>
                    <div class="lunar-bento-value">
                        <span id="metricSavedHuman">{{ $metrics['memory_saved_human'] }}</span>
                        <span class="lunar-bento-subtext" id="metricSavedPct">/ {{ $metrics['savings_percentage'] }}% of Host RAM</span>
                    </div>
                </div>
                <div class="lunar-bento-bar">
                    <div class="lunar-bento-bar-fill" id="barSavedPct" style="width: {{ min(100, max(2, $metrics['savings_percentage'] * 4)) }}%; background: linear-gradient(90deg, #059669, #10B981);"></div>
                </div>
            </div>

            {{-- Cell 2: Deduplication Ratio --}}
            <div class="lunar-bento-cell">
                <div>
                    <span class="lunar-bento-label">Deduplication Ratio</span>
                    <div class="lunar-bento-value">
                        <span id="metricRatio">{{ $metrics['sharing_ratio'] }}x</span>
                        <span class="lunar-bento-subtext">/ Memory Multiplier</span>
                    </div>
                </div>
                <div class="lunar-bento-bar">
                    <div class="lunar-bento-bar-fill" id="barRatio" style="width: {{ min(100, $metrics['sharing_ratio'] * 20) }}%; background: #3B82F6;"></div>
                </div>
            </div>

            {{-- Cell 3: Shared Pages --}}
            <div class="lunar-bento-cell">
                <div>
                    <span class="lunar-bento-label">Consolidated Base Pages</span>
                    <div class="lunar-bento-value">
                        <span id="metricPagesShared">{{ number_format($metrics['pages_shared']) }}</span>
                        <span class="lunar-bento-subtext" id="metricSharedHuman">/ {{ $metrics['memory_shared_human'] }} base</span>
                    </div>
                </div>
                <div class="lunar-bento-bar">
                    <div class="lunar-bento-bar-fill" style="width: 100%; background: #6366F1;"></div>
                </div>
            </div>

            {{-- Cell 4: Engine Status --}}
            <div class="lunar-bento-cell">
                <div>
                    <span class="lunar-bento-label">Kernel Daemon (ksmd)</span>
                    <div class="lunar-bento-value" style="display: flex; align-items: baseline; gap: 6px;">
                        <span id="metricStatus" class="ksm-badge {{ $metrics['status'] === 'running' ? 'ksm-badge-green' : 'ksm-badge-red' }}">
                            {{ strtoupper($metrics['status']) }}
                        </span>
                        <span class="lunar-bento-subtext font-mono" id="metricScans">/ {{ number_format($metrics['full_scans']) }} scans</span>
                    </div>
                </div>
                <div class="lunar-bento-bar">
                    <div class="lunar-bento-bar-fill" style="width: {{ $metrics['status'] === 'running' ? '100' : '0' }}%; background: #F59E0B;"></div>
                </div>
            </div>
        </div>
    </div>

    {{-- Main 2-Column Section --}}
    <div class="row">
        {{-- Left Column: Visual Breakdown & Profiles --}}
        <div class="col-md-7">

            {{-- Visual Memory Breakdown --}}
            <div class="ksm-panel">
                <div class="ksm-panel-header">
                    <div class="ksm-panel-title">
                        <i class="fa fa-pie-chart" style="color: #10B981; margin-right: 6px;"></i>
                        Host Memory Pool Breakdown
                    </div>
                    <div class="font-mono text-xs" style="color: #A0A0A0;" id="metricRamTotal">
                        Total Host RAM: {{ $metrics['system_ram']['total_human'] }}
                    </div>
                </div>

                <div class="ksm-panel-body">
                    {{-- Proportional Progress Segment Bar --}}
                    <div class="ksm-segment-bar" id="memorySegmentBar">
                        <div class="ksm-segment ksm-seg-green" id="segSaved" title="Memory Saved" style="width: {{ max(1, min(40, $metrics['savings_percentage'] * 3)) }}%;"></div>
                        <div class="ksm-segment ksm-seg-blue" id="segShared" title="Active Shared Pages" style="width: 15%;"></div>
                        <div class="ksm-segment ksm-seg-amber" id="segUnshared" title="Unshared Scanned Pages" style="width: 25%;"></div>
                        <div class="ksm-segment ksm-seg-dark" id="segOther" title="System Used / Other" style="width: 60%;"></div>
                    </div>

                    {{-- Legend Grid --}}
                    <div class="ksm-legend-grid">
                        <div class="ksm-legend-item">
                            <span class="ksm-legend-dot" style="background: #10B981;"></span>
                            <div>
                                <div class="ksm-legend-label">Net Physical RAM Saved</div>
                                <div class="ksm-legend-value font-mono" id="legendSaved">{{ $metrics['memory_saved_human'] }}</div>
                                <div class="ksm-legend-sub" id="legendSharingRef">{{ number_format($metrics['pages_sharing']) }} duplicate references avoided</div>
                            </div>
                        </div>

                        <div class="ksm-legend-item">
                            <span class="ksm-legend-dot" style="background: #3B82F6;"></span>
                            <div>
                                <div class="ksm-legend-label">Shared Base Pages</div>
                                <div class="ksm-legend-value font-mono" id="legendShared">{{ $metrics['memory_shared_human'] }}</div>
                                <div class="ksm-legend-sub" id="legendSharedCount">{{ number_format($metrics['pages_shared']) }} unique COW pages</div>
                            </div>
                        </div>

                        <div class="ksm-legend-item">
                            <span class="ksm-legend-dot" style="background: #F59E0B;"></span>
                            <div>
                                <div class="ksm-legend-label">Pages Checked (Unshared)</div>
                                <div class="ksm-legend-value font-mono" id="legendUnshared">{{ number_format($metrics['pages_unshared']) }} pages</div>
                                <div class="ksm-legend-sub">Scanned but unique across processes</div>
                            </div>
                        </div>

                        <div class="ksm-legend-item">
                            <span class="ksm-legend-dot" style="background: #8B5CF6;"></span>
                            <div>
                                <div class="ksm-legend-label">Volatile / Fast-Changing</div>
                                <div class="ksm-legend-value font-mono" id="legendVolatile">{{ number_format($metrics['pages_volatile']) }} pages</div>
                                <div class="ksm-legend-sub">High-frequency write pages skipped</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {{-- 1-Click Tuning Profiles --}}
            <div class="ksm-panel" style="margin-top: 20px;">
                <div class="ksm-panel-header">
                    <div class="ksm-panel-title">
                        <i class="fa fa-sliders" style="color: #3B82F6; margin-right: 6px;"></i>
                        1-Click Optimization Profiles
                    </div>
                    <span class="font-mono text-xs ksm-badge ksm-badge-blue" id="currentProfileBadge">
                        PROFILE: {{ strtoupper($metrics['active_profile']) }}
                    </span>
                </div>

                <div class="ksm-panel-body">
                    <div class="ksm-profile-grid">
                        {{-- Profile 1: Ultra Aggressive --}}
                        <div class="ksm-profile-card {{ $metrics['active_profile'] === 'aggressive' ? 'ksm-profile-active' : '' }}" id="cardAggressive">
                            <div class="ksm-profile-header">
                                <div class="ksm-profile-title">
                                    <i class="fa fa-bolt text-amber"></i> Ultra Aggressive
                                </div>
                                <span class="ksm-profile-pill">Max Savings</span>
                            </div>
                            <p class="ksm-profile-desc">
                                Aggressively consolidates RAM for high-density game server nodes (2,500 pages/10ms). Recovers maximum available memory.
                            </p>
                            <div class="font-mono text-xs" style="color: #737373; margin-bottom: 12px;">
                                pages_to_scan: 2500 &bull; sleep: 10ms
                            </div>
                            <button type="button" class="ksm-btn-primary" onclick="applyProfile('aggressive')" style="width: 100%;">
                                Activate Aggressive
                            </button>
                        </div>

                        {{-- Profile 2: Balanced (Recommended) --}}
                        <div class="ksm-profile-card {{ $metrics['active_profile'] === 'balanced' ? 'ksm-profile-active' : '' }}" id="cardBalanced">
                            <div class="ksm-profile-header">
                                <div class="ksm-profile-title">
                                    <i class="fa fa-check-circle text-green"></i> Balanced
                                </div>
                                <span class="ksm-profile-pill" style="border-color: rgba(16, 185, 129, 0.4); color: #10B981;">Recommended</span>
                            </div>
                            <p class="ksm-profile-desc">
                                Optimal continuous background deduplication with imperceptible CPU overhead (1,000 pages/20ms). Best for production fleets.
                            </p>
                            <div class="font-mono text-xs" style="color: #737373; margin-bottom: 12px;">
                                pages_to_scan: 1000 &bull; sleep: 20ms
                            </div>
                            <button type="button" class="ksm-btn-primary" onclick="applyProfile('balanced')" style="width: 100%;">
                                Activate Balanced
                            </button>
                        </div>

                        {{-- Profile 3: Eco (Low CPU) --}}
                        <div class="ksm-profile-card {{ $metrics['active_profile'] === 'eco' ? 'ksm-profile-active' : '' }}" id="cardEco">
                            <div class="ksm-profile-header">
                                <div class="ksm-profile-title">
                                    <i class="fa fa-leaf" style="color: #10B981;"></i> Eco (Low CPU)
                                </div>
                                <span class="ksm-profile-pill">Low CPU</span>
                            </div>
                            <p class="ksm-profile-desc">
                                Gentle background memory merging (300 pages/50ms) designed for single-core or shared budget VPS nodes.
                            </p>
                            <div class="font-mono text-xs" style="color: #737373; margin-bottom: 12px;">
                                pages_to_scan: 300 &bull; sleep: 50ms
                            </div>
                            <button type="button" class="ksm-btn-primary" onclick="applyProfile('eco')" style="width: 100%;">
                                Activate Eco
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {{-- Live In-Memory Benchmark Test --}}
            <div class="ksm-panel" style="margin-top: 20px;">
                <div class="ksm-panel-header">
                    <div class="ksm-panel-title">
                        <i class="fa fa-tachometer" style="color: #F59E0B; margin-right: 6px;"></i>
                        Live Memory Deduplication Benchmark
                    </div>
                </div>
                <div class="ksm-panel-body">
                    <p style="color: #A0A0A0; font-size: 12px; margin-bottom: 16px;">
                        Trigger a real-time synthetic test on your host system: allocates 32 MB of identical memory blocks, marks them with <code>MADV_MERGEABLE</code>, and verifies that the Linux kernel consolidates duplicate pages into shared Copy-On-Write pages.
                    </p>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button type="button" id="btnRunTest" class="ksm-btn-secondary" onclick="runBenchmarkTest()">
                            <i class="fa fa-play" style="margin-right: 4px;"></i> Run 32 MB Deduplication Benchmark
                        </button>
                        <span id="testSpinner" style="display: none; color: #10B981; font-size: 12px;">
                            <i class="fa fa-spinner fa-spin"></i> Testing kernel memory merge...
                        </span>
                    </div>
                    <div id="testOutputBox" style="display: none; margin-top: 14px; padding: 12px; border-radius: 6px; background: #050505; border: 1px solid #1F1F1F; font-family: var(--font-mono); font-size: 11px; color: #10B981;">
                    </div>
                </div>
            </div>

        </div>

        {{-- Right Column: Host Readiness & Custom Tuning --}}
        <div class="col-md-5">

            {{-- Host Readiness & Container Status --}}
            <div class="ksm-panel">
                <div class="ksm-panel-header">
                    <div class="ksm-panel-title">
                        <i class="fa fa-shield" style="color: #10B981; margin-right: 6px;"></i>
                        Host Readiness & Integration Status
                    </div>
                    <span class="ksm-badge {{ $metrics['readiness']['score'] >= 75 ? 'ksm-badge-green' : 'ksm-badge-amber' }}">
                        {{ $metrics['readiness']['score'] }}% READY
                    </span>
                </div>
                <div class="ksm-panel-body">
                    <div class="ksm-check-list">
                        <div class="ksm-check-item">
                            <i class="fa {{ $metrics['readiness']['kernel_supported'] ? 'fa-check text-green' : 'fa-times text-red' }}"></i>
                            <div class="ksm-check-text">
                                <div class="ksm-check-title">Kernel KSM Subsystem</div>
                                <div class="ksm-check-desc">/sys/kernel/mm/ksm interface compiled & present</div>
                            </div>
                        </div>

                        <div class="ksm-check-item">
                            <i class="fa {{ $metrics['readiness']['ksm_running'] ? 'fa-check text-green' : 'fa-times text-red' }}"></i>
                            <div class="ksm-check-text">
                                <div class="ksm-check-title">KSM Engine Active (/sys/kernel/mm/ksm/run = 1)</div>
                                <div class="ksm-check-desc">Host kernel actively deduplicating memory pages</div>
                            </div>
                        </div>

                        <div class="ksm-check-item">
                            <i class="fa {{ $metrics['readiness']['systemd_active'] ? 'fa-check text-green' : 'fa-minus text-amber' }}"></i>
                            <div class="ksm-check-text">
                                <div class="ksm-check-title">Adaptive Auto-Tuner Daemon</div>
                                <div class="ksm-check-desc">stellar-ksm.service dynamically tunes scan rate</div>
                            </div>
                        </div>

                        <div class="ksm-check-item">
                            <i class="fa {{ $metrics['readiness']['libksm_installed'] ? 'fa-check text-green' : 'fa-info-circle text-amber' }}"></i>
                            <div class="ksm-check-text">
                                <div class="ksm-check-title">Container Memory Preloader (libksm.so)</div>
                                <div class="ksm-check-desc">Transparent MADV_MERGEABLE memory hooking for servers</div>
                            </div>
                        </div>
                    </div>

                    {{-- Quick Setup Snippet --}}
                    <div style="margin-top: 16px; padding: 12px; background: #050505; border: 1px solid #1F1F1F; border-radius: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <span class="font-mono text-xs" style="color: #A0A0A0; font-weight: 600;">1-Click Host Server Setup Command:</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <code style="flex: 1; user-select: all; font-size: 11px; padding: 6px 10px; background: #000000; border: 1px solid #242424; color: #FFFFFF;" id="cmdSnippet">php artisan ksm:setup</code>
                            <button type="button" class="ksm-btn-secondary" onclick="copySnippet()" style="padding: 5px 10px; font-size: 11px;">
                                <i class="fa fa-clone"></i> Copy
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {{-- Custom Parameter Tuning Form --}}
            <div class="ksm-panel" style="margin-top: 20px;">
                <div class="ksm-panel-header">
                    <div class="ksm-panel-title">
                        <i class="fa fa-cogs" style="color: #6366F1; margin-right: 6px;"></i>
                        Engine Parameters & Control
                    </div>
                </div>
                <div class="ksm-panel-body">
                    <form id="ksmParamsForm" onsubmit="saveParameters(event)">
                        {!! csrf_field() !!}

                        {{-- Run State --}}
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label class="ksm-label">KSM Engine Run State</label>
                            <select name="run" id="inputRun" class="ksm-select">
                                <option value="1" {{ $metrics['run'] === 1 ? 'selected' : '' }}>1 - Run (Active Memory Scanning & Deduplication)</option>
                                <option value="0" {{ $metrics['run'] === 0 ? 'selected' : '' }}>0 - Stop (Keep existing merged pages, pause scanning)</option>
                                <option value="2" {{ $metrics['run'] === 2 ? 'selected' : '' }}>2 - Unmerge (Split all shared pages back into unshared)</option>
                            </select>
                        </div>

                        {{-- Pages To Scan --}}
                        <div class="form-group" style="margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <label class="ksm-label" style="margin-bottom: 0;">Pages Scanned Per Cycle (pages_to_scan)</label>
                                <span class="font-mono text-xs" style="color: #10B981;" id="valPagesToScan">{{ $metrics['parameters']['pages_to_scan'] }}</span>
                            </div>
                            <input type="range" name="pages_to_scan" id="inputPagesToScan" min="50" max="5000" step="50" value="{{ $metrics['parameters']['pages_to_scan'] }}" class="ksm-range" oninput="document.getElementById('valPagesToScan').innerText = this.value">
                            <span class="ksm-help">Higher values consolidate memory faster at slightly higher CPU usage.</span>
                        </div>

                        {{-- Sleep Millisecs --}}
                        <div class="form-group" style="margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <label class="ksm-label" style="margin-bottom: 0;">Sleep Interval Between Scans (sleep_millisecs)</label>
                                <span class="font-mono text-xs" style="color: #3B82F6;" id="valSleep">{{ $metrics['parameters']['sleep_millisecs'] }} ms</span>
                            </div>
                            <input type="range" name="sleep_millisecs" id="inputSleep" min="0" max="200" step="5" value="{{ $metrics['parameters']['sleep_millisecs'] }}" class="ksm-range" oninput="document.getElementById('valSleep').innerText = this.value + ' ms'">
                            <span class="ksm-help">Milliseconds ksmd sleeps between scanning page batches (10–30ms recommended).</span>
                        </div>

                        {{-- Merge Across NUMA Nodes --}}
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label class="ksm-label">NUMA Node Sharing (merge_across_nodes)</label>
                            <select name="merge_across_nodes" id="inputMergeNodes" class="ksm-select">
                                <option value="1" {{ $metrics['parameters']['merge_across_nodes'] ? 'selected' : '' }}>1 - Enabled (Merge across all NUMA nodes for max savings)</option>
                                <option value="0" {{ !$metrics['parameters']['merge_across_nodes'] ? 'selected' : '' }}>0 - Disabled (Only merge within same NUMA socket for lowest latency)</option>
                            </select>
                        </div>

                        {{-- Smart Scan (Kernel 6.4+) --}}
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="ksm-label">Smart Scan (Kernel 6.4+)</label>
                            <select name="smart_scan" id="inputSmartScan" class="ksm-select">
                                <option value="1" {{ $metrics['parameters']['smart_scan'] ? 'selected' : '' }}>1 - Enabled (Skip scanning volatile/unchanging pages)</option>
                                <option value="0" {{ !$metrics['parameters']['smart_scan'] ? 'selected' : '' }}>0 - Disabled (Standard scan)</option>
                            </select>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 8px;">
                            <button type="submit" class="ksm-btn-primary" id="btnSaveParams">
                                <i class="fa fa-save" style="margin-right: 4px;"></i> Save Parameters
                            </button>
                        </div>
                    </form>
                </div>
            </div>

        </div>
    </div>
</div>

{{-- Custom Styles for Signature Dark Editorial KSM Dashboard --}}
<style>
.ksm-container {
    font-family: var(--font-sans);
    color: var(--s-text-1);
}

.ksm-panel {
    background: #0A0A0A;
    border: 1px solid #1F1F1F;
    border-radius: 12px;
    overflow: hidden;
}

.ksm-panel-header {
    padding: 14px 18px;
    background: #050505;
    border-bottom: 1px solid #141414;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.ksm-panel-title {
    font-size: 13px;
    font-weight: 600;
    color: #FFFFFF;
    display: flex;
    align-items: center;
}

.ksm-panel-body {
    padding: 18px;
}

.ksm-pulse-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: ksmPulse 2s infinite;
}

@keyframes ksmPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
}

.ksm-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    font-family: var(--font-mono);
}

.ksm-badge-green {
    background: rgba(16, 185, 129, 0.15);
    color: #10B981;
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.ksm-badge-red {
    background: rgba(239, 68, 68, 0.15);
    color: #EF4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.ksm-badge-amber {
    background: rgba(245, 158, 11, 0.15);
    color: #F59E0B;
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.ksm-badge-blue {
    background: rgba(59, 130, 246, 0.15);
    color: #3B82F6;
    border: 1px solid rgba(59, 130, 246, 0.3);
}

/* Segmented Bar */
.ksm-segment-bar {
    height: 14px;
    background: #141414;
    border-radius: 7px;
    overflow: hidden;
    display: flex;
    margin-bottom: 18px;
    border: 1px solid #1F1F1F;
}

.ksm-segment {
    height: 100%;
    transition: width 400ms ease;
}

.ksm-seg-green { background: #10B981; }
.ksm-seg-blue { background: #3B82F6; }
.ksm-seg-amber { background: #F59E0B; }
.ksm-seg-dark { background: #262626; }

/* Legend */
.ksm-legend-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
}

.ksm-legend-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.ksm-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-top: 4px;
    flex-shrink: 0;
}

.ksm-legend-label {
    font-size: 11px;
    color: #A0A0A0;
}

.ksm-legend-value {
    font-size: 13px;
    font-weight: 600;
    color: #FFFFFF;
}

.ksm-legend-sub {
    font-size: 10px;
    color: #666666;
}

/* Profile Grid */
.ksm-profile-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}

.ksm-profile-card {
    background: #000000;
    border: 1px solid #1F1F1F;
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-col: column;
    justify-content: space-between;
    transition: border-color 150ms ease, background 150ms ease;
}

.ksm-profile-card:hover {
    border-color: #383838;
}

.ksm-profile-active {
    border-color: #10B981 !important;
    background: rgba(16, 185, 129, 0.04) !important;
}

.ksm-profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.ksm-profile-title {
    font-size: 12px;
    font-weight: 600;
    color: #FFFFFF;
}

.ksm-profile-pill {
    font-size: 9px;
    font-family: var(--font-mono);
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid #333333;
    color: #A0A0A0;
}

.ksm-profile-desc {
    font-size: 11px;
    color: #A0A0A0;
    line-height: 1.4;
    margin-bottom: 8px;
    min-height: 48px;
}

/* Check list */
.ksm-check-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ksm-check-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.ksm-check-item i {
    margin-top: 3px;
    font-size: 13px;
}

.ksm-check-title {
    font-size: 12px;
    font-weight: 500;
    color: #FFFFFF;
}

.ksm-check-desc {
    font-size: 11px;
    color: #737373;
}

/* Controls */
.ksm-label {
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: #A0A0A0;
    margin-bottom: 6px;
}

.ksm-help {
    display: block;
    font-size: 10px;
    color: #666666;
    margin-top: 4px;
}

.ksm-select {
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

.ksm-select:focus {
    border-color: #404040;
}

.ksm-range {
    width: 100%;
    accent-color: #10B981;
    cursor: pointer;
}

.ksm-btn-primary {
    background: #FFFFFF;
    color: #000000;
    font-weight: 600;
    font-size: 11px;
    padding: 7px 14px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: background 150ms ease;
}

.ksm-btn-primary:hover {
    background: #E5E5E5;
}

.ksm-btn-secondary {
    background: #111111;
    border: 1px solid #262626;
    color: #FFFFFF;
    font-size: 12px;
    padding: 7px 14px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
}

.ksm-btn-secondary:hover {
    background: #1A1A1A;
    border-color: #404040;
}
</style>

{{-- Real-time Telemetry Script & Interactive Handlers --}}
<script>
let livePolling = true;
let pollTimer = null;

// Copy setup snippet
function copySnippet() {
    const text = document.getElementById('cmdSnippet').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied setup command to clipboard: ' + text);
    });
}

// Toggle live polling
document.getElementById('toggleLiveBtn').addEventListener('click', function() {
    livePolling = !livePolling;
    if (livePolling) {
        this.innerText = 'Pause';
        document.getElementById('liveIndicator').style.opacity = '1';
        schedulePoll();
    } else {
        this.innerText = 'Resume';
        document.getElementById('liveIndicator').style.opacity = '0.4';
        clearTimeout(pollTimer);
    }
});

function schedulePoll() {
    if (!livePolling) return;
    pollTimer = setTimeout(fetchMetrics, 3000);
}

// Fetch live metrics from JSON endpoint
function fetchMetrics() {
    fetch('{{ route("admin.ksm.metrics") }}', {
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(r => r.json())
    .then(data => {
        if (!data || !data.supported) return;

        // Update Bento stats
        document.getElementById('metricSavedHuman').innerText = data.memory_saved_human;
        document.getElementById('metricSavedPct').innerText = '/ ' + data.savings_percentage + '% of Host RAM';
        document.getElementById('barSavedPct').style.width = Math.min(100, Math.max(2, data.savings_percentage * 4)) + '%';

        document.getElementById('metricRatio').innerText = data.sharing_ratio + 'x';
        document.getElementById('barRatio').style.width = Math.min(100, data.sharing_ratio * 20) + '%';

        document.getElementById('metricPagesShared').innerText = data.pages_shared.toLocaleString();
        document.getElementById('metricSharedHuman').innerText = '/ ' + data.memory_shared_human + ' base';

        const statusEl = document.getElementById('metricStatus');
        statusEl.innerText = data.status.toUpperCase();
        statusEl.className = 'ksm-badge ' + (data.status === 'running' ? 'ksm-badge-green' : 'ksm-badge-red');
        document.getElementById('metricScans').innerText = '/ ' + data.full_scans.toLocaleString() + ' scans';

        // Update Legend
        document.getElementById('legendSaved').innerText = data.memory_saved_human;
        document.getElementById('legendSharingRef').innerText = data.pages_sharing.toLocaleString() + ' duplicate references avoided';
        document.getElementById('legendShared').innerText = data.memory_shared_human;
        document.getElementById('legendSharedCount').innerText = data.pages_shared.toLocaleString() + ' unique COW pages';
        document.getElementById('legendUnshared').innerText = data.pages_unshared.toLocaleString() + ' pages';
        document.getElementById('legendVolatile').innerText = data.pages_volatile.toLocaleString() + ' pages';

        // Update segment widths
        document.getElementById('segSaved').style.width = Math.max(1, Math.min(40, data.savings_percentage * 3)) + '%';
    })
    .catch(() => {})
    .finally(() => {
        schedulePoll();
    });
}

// Apply Profile
function applyProfile(profileName) {
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
            // Update active profile UI cards
            ['Aggressive', 'Balanced', 'Eco'].forEach(p => {
                const el = document.getElementById('card' + p);
                if (el) el.classList.remove('ksm-profile-active');
            });
            const cap = profileName.charAt(0).toUpperCase() + profileName.slice(1);
            const activeCard = document.getElementById('card' + cap);
            if (activeCard) activeCard.classList.add('ksm-profile-active');

            document.getElementById('currentProfileBadge').innerText = 'PROFILE: ' + profileName.toUpperCase();

            // Sync form inputs
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

            fetchMetrics();
        }
    });
}

// Save Custom Parameters
function saveParameters(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveParams');
    btn.disabled = true;
    btn.innerText = 'Saving...';

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
        setTimeout(() => {
            btn.innerHTML = '<i class="fa fa-save"></i> Save Parameters';
        }, 1800);
        fetchMetrics();
    })
    .catch(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-save"></i> Save Parameters';
    });
}

// Run Benchmark Test
function runBenchmarkTest() {
    const btn = document.getElementById('btnRunTest');
    const spinner = document.getElementById('testSpinner');
    const outputBox = document.getElementById('testOutputBox');

    btn.disabled = true;
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
        btn.disabled = false;
        spinner.style.display = 'none';
        outputBox.style.display = 'block';
        outputBox.innerHTML = `<strong>✓ Benchmark Success (${res.elapsed_ms}ms):</strong> ${res.message}<br><span style="color:#A0A0A0;">Pages Tested: ${res.pages_tested.toLocaleString()} &bull; Pages Consolidated: ${res.pages_merged.toLocaleString()} &bull; RAM Reclaimed: ${res.saved_mb} MB</span>`;
        fetchMetrics();
    })
    .catch(err => {
        btn.disabled = false;
        spinner.style.display = 'none';
        outputBox.style.display = 'block';
        outputBox.style.color = '#EF4444';
        outputBox.innerText = 'Failed to execute benchmark test.';
    });
}

// Start live polling on load
schedulePoll();
</script>
@endsection
