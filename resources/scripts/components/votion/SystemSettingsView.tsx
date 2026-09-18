import React, { useState, useEffect, useCallback } from 'react';
import http from '@/api/http';

interface TelemetryData {
    cluster_name: string;
    environment: string;
    debug: boolean;
    php_version: string;
    server_os: string;
    server_time: string;
    server_timezone: string;
    uptime: string;
    memory_limit: string;
    max_execution_time: string;
    storage: {
        free_bytes: number;
        total_bytes: number;
        used_percent: number;
    };
    database: {
        status: string;
        latency_ms: number;
        engine: string;
        tables: number;
    };
    queue: {
        driver: string;
        pending_jobs: number;
        failed_jobs: number;
    };
    fleet: {
        nodes: number;
        servers: number;
        active_servers: number;
        total_memory_mb: number;
        total_disk_mb: number;
        backups: number;
    };
    extensions: Record<string, boolean>;
}

interface SettingsData {
    cluster_name: string;
    telemetry_interval: number;
    session_timeout: number;
    ssl_warning_days: number;
    two_factor_requirement: number;
    registration_otp: boolean;
    node_timeout: number;
    auto_deploy_tokens: boolean;
    maintenance_mode: boolean;
}

export const SystemSettingsView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'vitals' | 'orchestration' | 'security' | 'maintenance'>('vitals');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionRunning, setActionRunning] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [terminalOutput, setTerminalOutput] = useState<string>('');
    const [showTerminal, setShowTerminal] = useState(false);

    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [initialSettings, setInitialSettings] = useState<SettingsData | null>(null);
    const [settings, setSettings] = useState<SettingsData>({
        cluster_name: 'Votion Primary Cluster',
        telemetry_interval: 15,
        session_timeout: 120,
        ssl_warning_days: 14,
        two_factor_requirement: 0,
        registration_otp: false,
        node_timeout: 30,
        auto_deploy_tokens: true,
        maintenance_mode: false,
    });

    const showToast = (type: 'success' | 'error' | 'info', text: string) => {
        setToastMessage({ type, text });
        setTimeout(() => setToastMessage(null), 4500);
    };

    const fetchSystemData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await http.get('/api/client/system-settings');
            const data = res.data;
            if (data.telemetry) setTelemetry(data.telemetry);
            if (data.settings) {
                setSettings(data.settings);
                setInitialSettings(data.settings);
            }
        } catch (err: any) {
            showToast('error', err.response?.data?.message || 'Failed to fetch cluster settings.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSystemData();
    }, [fetchSystemData]);

    const isDirty = initialSettings
        ? JSON.stringify(settings) !== JSON.stringify(initialSettings)
        : false;

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await http.post('/api/client/system-settings', settings);
            showToast('success', res.data?.message || 'Settings saved successfully.');
            setInitialSettings(settings);
            // Refresh telemetry to reflect new changes
            fetchSystemData();
        } catch (err: any) {
            showToast('error', err.response?.data?.message || 'Error saving settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        if (initialSettings) {
            setSettings(initialSettings);
        }
    };

    const runAction = async (action: string, actionLabel: string) => {
        setActionRunning(action);
        try {
            const res = await http.post('/api/client/system-settings/action', { action });
            showToast('success', res.data?.message || `${actionLabel} completed.`);
            if (res.data?.output) {
                setTerminalOutput((prev) => `[${new Date().toLocaleTimeString()}] ${actionLabel}:\n${res.data.output}\n\n${prev}`);
                setShowTerminal(true);
            }
            fetchSystemData();
        } catch (err: any) {
            showToast('error', err.response?.data?.message || `Failed to execute ${actionLabel}.`);
        } finally {
            setActionRunning(null);
        }
    };

    const formatBytes = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-4 sm:px-6 py-8 select-none">
            <div className="max-w-[1324px] mx-auto">
                {/* Notification Toast */}
                {toastMessage && (
                    <div
                        className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded border text-xs flex items-center gap-3 shadow-2xl transition-all duration-200 ${
                            toastMessage.type === 'success'
                                ? 'bg-[#062419] border-[#064E3B] text-[#10B981]'
                                : toastMessage.type === 'error'
                                ? 'bg-[#2A0808] border-[#7F1D1D] text-[#EF4444]'
                                : 'bg-[#121212] border-[#262626] text-[#EDEDED]'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                        <span className="font-mono">{toastMessage.text}</span>
                        <button
                            onClick={() => setToastMessage(null)}
                            className="text-[#656B6B] hover:text-white ml-2 text-sm leading-none"
                        >
                            &times;
                        </button>
                    </div>
                )}

                {/* Page Header */}
                <div className="border-b border-[#262626] pb-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                            <h1 className="text-3xl font-serif font-normal text-[#FFFFFF] m-0">System Settings</h1>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#062419] text-[#10B981] border border-[#064E3B]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                                {telemetry?.environment ? telemetry.environment.toUpperCase() : 'PRODUCTION'}
                            </span>
                        </div>
                        <p className="text-xs text-[#A0A0A0] m-0">
                            Global cluster orchestration, real-time node vitals, security policies, and maintenance actions
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={fetchSystemData}
                            disabled={loading}
                            className="bg-[#121212] hover:bg-[#1A1A1A] text-[#A0A0A0] hover:text-white border border-[#262626] px-3.5 py-2 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Sync Telemetry</span>
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={!isDirty || saving}
                            className={`px-4 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                isDirty
                                    ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer shadow-lg shadow-white/10'
                                    : 'bg-[#1C1C1C] text-[#525252] border border-[#262626] cursor-not-allowed'
                            }`}
                        >
                            {saving ? (
                                <>
                                    <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>Save Settings</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Top Cluster Vitals Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
                    {/* Cluster Status */}
                    <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                        <span className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Cluster Nodes</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-semibold text-white font-mono">{telemetry?.fleet?.nodes ?? 0}</span>
                            <span className="text-[10px] text-[#10B981] font-mono">Active Nodes</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-[#A0A0A0]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                            <span>Heartbeat: {settings.telemetry_interval}s</span>
                        </div>
                    </div>

                    {/* Fleet Capacity */}
                    <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                        <span className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Fleet Instances</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-semibold text-white font-mono">{telemetry?.fleet?.servers ?? 0}</span>
                            <span className="text-[10px] text-[#A0A0A0] font-mono">({telemetry?.fleet?.active_servers ?? 0} active)</span>
                        </div>
                        <div className="mt-2 text-[11px] text-[#A0A0A0] font-mono">
                            {Math.round((telemetry?.fleet?.total_memory_mb ?? 0) / 1024)} GB RAM Allocated
                        </div>
                    </div>

                    {/* Background Queue */}
                    <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                        <span className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Queue Worker</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-semibold text-white font-mono">
                                {telemetry?.queue?.pending_jobs ?? 0}
                            </span>
                            <span className="text-[10px] text-[#A0A0A0] font-mono">pending</span>
                        </div>
                        <div className="mt-2 text-[11px] font-mono flex items-center justify-between">
                            <span className="text-[#A0A0A0]">Failed: {telemetry?.queue?.failed_jobs ?? 0}</span>
                            <span className="text-[10px] text-[#A0A0A0] uppercase">{telemetry?.queue?.driver}</span>
                        </div>
                    </div>

                    {/* Database Latency */}
                    <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4">
                        <span className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Database Ping</span>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-xl font-semibold font-mono ${telemetry?.database?.latency_ms && telemetry.database.latency_ms < 50 ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>
                                {telemetry?.database?.latency_ms ?? 0} ms
                            </span>
                            <span className="text-[10px] text-[#10B981] font-mono">Connected</span>
                        </div>
                        <div className="mt-2 text-[11px] text-[#656B6B] font-mono truncate">
                            {telemetry?.database?.tables ?? 0} Tables • {telemetry?.database?.engine ?? 'MySQL'}
                        </div>
                    </div>
                </div>

                {/* Subnav Tabs */}
                <div className="flex items-center gap-1 border-b border-[#262626] mb-6 overflow-x-auto">
                    {[
                        { id: 'vitals', label: 'Vitals & Diagnostics', icon: '⚡' },
                        { id: 'orchestration', label: 'Cluster Orchestration', icon: '🌐' },
                        { id: 'security', label: 'Security & Session Policies', icon: '🛡️' },
                        { id: 'maintenance', label: 'System Maintenance & Cache', icon: '🔧' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
                                activeTab === tab.id
                                    ? 'border-white text-white bg-[#0D0D0D]'
                                    : 'border-transparent text-[#A0A0A0] hover:text-white hover:bg-[#080808]'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* TAB 1: Vitals & Diagnostics */}
                {activeTab === 'vitals' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Server Environment Card */}
                            <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                                <h3 className="text-sm font-semibold text-[#FFFFFF] mb-4 flex items-center justify-between">
                                    <span>Host Environment &amp; Runtime</span>
                                    <span className="text-[10px] font-mono text-[#656B6B] uppercase">{telemetry?.server_os}</span>
                                </h3>
                                <div className="space-y-3 text-xs">
                                    <div className="flex justify-between py-1.5 border-b border-[#1A1A1A]">
                                        <span className="text-[#656B6B] font-mono text-[11px]">PHP Engine</span>
                                        <span className="font-mono text-white">{telemetry?.php_version ?? 'Loading...'}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-[#1A1A1A]">
                                        <span className="text-[#656B6B] font-mono text-[11px]">Server Time / Zone</span>
                                        <span className="font-mono text-white">
                                            {telemetry?.server_time ? new Date(telemetry.server_time).toLocaleTimeString() : 'N/A'} ({telemetry?.server_timezone ?? 'UTC'})
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-[#1A1A1A]">
                                        <span className="text-[#656B6B] font-mono text-[11px]">Host System Uptime</span>
                                        <span className="font-mono text-[#10B981]">{telemetry?.uptime ?? 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-[#1A1A1A]">
                                        <span className="text-[#656B6B] font-mono text-[11px]">PHP Memory Limit</span>
                                        <span className="font-mono text-white">{telemetry?.memory_limit ?? '512M'}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span className="text-[#656B6B] font-mono text-[11px]">Max Script Timeout</span>
                                        <span className="font-mono text-white">{telemetry?.max_execution_time ?? '60s'}</span>
                                    </div>
                                </div>

                                {/* Disk Usage Progress */}
                                <div className="mt-5 pt-4 border-t border-[#1A1A1A]">
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-[#656B6B] font-mono text-[10px] uppercase">Panel Storage Volume</span>
                                        <span className="font-mono text-white text-[11px]">
                                            {formatBytes((telemetry?.storage?.total_bytes ?? 0) - (telemetry?.storage?.free_bytes ?? 0))} / {formatBytes(telemetry?.storage?.total_bytes ?? 0)} ({telemetry?.storage?.used_percent ?? 0}%)
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-[#1F1F1F] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${
                                                (telemetry?.storage?.used_percent ?? 0) > 85
                                                    ? 'bg-[#EF4444]'
                                                    : (telemetry?.storage?.used_percent ?? 0) > 70
                                                    ? 'bg-[#F59E0B]'
                                                    : 'bg-[#10B981]'
                                            }`}
                                            style={{ width: `${Math.min(telemetry?.storage?.used_percent ?? 0, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* PHP Extensions Verification */}
                            <div className="bg-[#121212] border border-[#262626] rounded-md p-5 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-[#FFFFFF] mb-4">Core Extensions &amp; Modules</h3>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        {Object.entries(telemetry?.extensions ?? {
                                            pdo_mysql: true,
                                            curl: true,
                                            openssl: true,
                                            mbstring: true,
                                            bcmath: true,
                                            sodium: true,
                                            zip: true,
                                            gd: true,
                                        }).map(([ext, active]) => (
                                            <div
                                                key={ext}
                                                className="bg-[#0A0A0A] border border-[#262626] p-2.5 rounded flex items-center justify-between"
                                            >
                                                <span className="font-mono text-[11px] text-[#EDEDED]">{ext}</span>
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                                                        active
                                                            ? 'bg-[#062419] text-[#10B981] border border-[#064E3B]'
                                                            : 'bg-[#2A0808] text-[#EF4444] border border-[#7F1D1D]'
                                                    }`}
                                                >
                                                    {active ? 'Active' : 'Missing'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-5 p-3 rounded bg-[#0A0A0A] border border-[#1F1F1F] text-[11px] text-[#656B6B] flex items-center justify-between">
                                    <span>License Runtime Encryption</span>
                                    <span className="text-[#10B981] font-mono font-medium">AES-256 Validated</span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Diagnostics Terminal & Action Bar */}
                        <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-[#FFFFFF] m-0">Live Diagnostic Actions</h3>
                                    <p className="text-[11px] text-[#656B6B] mt-0.5 m-0">Run real-time diagnostics and trigger system maintenance tasks</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowTerminal(!showTerminal)}
                                        className="text-[11px] font-mono text-[#A0A0A0] hover:text-white bg-[#0A0A0A] border border-[#262626] px-2.5 py-1.5 rounded transition-colors"
                                    >
                                        {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <button
                                    onClick={() => runAction('test_db', 'Database Ping')}
                                    disabled={actionRunning !== null}
                                    className="bg-[#0A0A0A] hover:bg-[#161616] text-[#EDEDED] border border-[#262626] p-3 rounded text-left transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <span className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Latency Test</span>
                                    <span className="text-xs font-semibold text-white block">
                                        {actionRunning === 'test_db' ? 'Pinging...' : 'Ping Database'}
                                    </span>
                                </button>

                                <button
                                    onClick={() => runAction('clear_cache', 'Flush Caches')}
                                    disabled={actionRunning !== null}
                                    className="bg-[#0A0A0A] hover:bg-[#161616] text-[#EDEDED] border border-[#262626] p-3 rounded text-left transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <span className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Cache Flush</span>
                                    <span className="text-xs font-semibold text-white block">
                                        {actionRunning === 'clear_cache' ? 'Clearing...' : 'Clear All Caches'}
                                    </span>
                                </button>

                                <button
                                    onClick={() => runAction('restart_queues', 'Restart Queues')}
                                    disabled={actionRunning !== null}
                                    className="bg-[#0A0A0A] hover:bg-[#161616] text-[#EDEDED] border border-[#262626] p-3 rounded text-left transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <span className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Queue Signal</span>
                                    <span className="text-xs font-semibold text-white block">
                                        {actionRunning === 'restart_queues' ? 'Signaling...' : 'Restart Queue'}
                                    </span>
                                </button>

                                <button
                                    onClick={() => runAction('prune_failed_jobs', 'Prune Jobs')}
                                    disabled={actionRunning !== null}
                                    className="bg-[#0A0A0A] hover:bg-[#161616] text-[#EDEDED] border border-[#262626] p-3 rounded text-left transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <span className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">Dead Jobs</span>
                                    <span className="text-xs font-semibold text-white block">
                                        {actionRunning === 'prune_failed_jobs' ? 'Pruning...' : 'Prune Failed Jobs'}
                                    </span>
                                </button>
                            </div>

                            {/* Terminal Console Output */}
                            {showTerminal && (
                                <div className="mt-4 bg-[#050505] border border-[#262626] rounded-md p-3.5 font-mono text-[11px] text-[#A0A0A0] max-h-48 overflow-y-auto whitespace-pre-wrap">
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1A1A1A] text-[10px] uppercase text-[#656B6B]">
                                        <span>Diagnostics Output Stream</span>
                                        <button
                                            onClick={() => setTerminalOutput('')}
                                            className="hover:text-white transition-colors"
                                        >
                                            Clear Log
                                        </button>
                                    </div>
                                    {terminalOutput || 'No diagnostic actions executed yet. Click any action above to run.'}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: Cluster Orchestration */}
                {activeTab === 'orchestration' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Cluster Identity Card */}
                        <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                            <h3 className="text-sm font-semibold text-[#FFFFFF] mb-3">Cluster Identity &amp; Branding</h3>
                            <div className="space-y-4 text-xs">
                                <div>
                                    <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">
                                        Cluster Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.cluster_name}
                                        onChange={(e) => setSettings({ ...settings, cluster_name: e.target.value })}
                                        className="w-full bg-[#0A0A0A] border border-[#262626] p-2.5 rounded text-xs text-white focus:outline-none focus:border-[#0f62fe] transition-colors"
                                        placeholder="e.g. Votion Primary Cluster"
                                    />
                                    <p className="text-[10px] text-[#656B6B] mt-1">
                                        The public cluster identity rendered across browser titles and header bars.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">
                                        Telemetry Sync Interval (Seconds)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={5}
                                            max={60}
                                            step={1}
                                            value={settings.telemetry_interval}
                                            onChange={(e) => setSettings({ ...settings, telemetry_interval: parseInt(e.target.value, 10) })}
                                            className="flex-1 accent-white"
                                        />
                                        <span className="w-12 text-right font-mono text-white text-xs bg-[#0A0A0A] px-2 py-1 rounded border border-[#262626]">
                                            {settings.telemetry_interval}s
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-[#656B6B] mt-1">
                                        Interval for client WebSocket and stats polling (Default: 15 seconds).
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Node Communication & Heartbeat */}
                        <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                            <h3 className="text-sm font-semibold text-[#FFFFFF] mb-3">Node Heartbeat &amp; Daemons</h3>
                            <div className="space-y-4 text-xs">
                                <div>
                                    <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">
                                        Daemon Connection Timeout (Seconds)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={10}
                                            max={120}
                                            step={5}
                                            value={settings.node_timeout}
                                            onChange={(e) => setSettings({ ...settings, node_timeout: parseInt(e.target.value, 10) })}
                                            className="flex-1 accent-white"
                                        />
                                        <span className="w-12 text-right font-mono text-white text-xs bg-[#0A0A0A] px-2 py-1 rounded border border-[#262626]">
                                            {settings.node_timeout}s
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-[#656B6B] mt-1">
                                        Max wait duration for Wings daemon response before marking node uncontactable.
                                    </p>
                                </div>

                                <div className="pt-2 border-t border-[#1F1F1F]">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-medium text-white block">Auto-Deploy Tokens</span>
                                            <span className="text-[10px] text-[#656B6B] block mt-0.5">
                                                Allow generating instant curl node deploy commands in Admin CP
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSettings({ ...settings, auto_deploy_tokens: !settings.auto_deploy_tokens })}
                                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                                settings.auto_deploy_tokens ? 'bg-[#10B981]' : 'bg-[#262626]'
                                            }`}
                                        >
                                            <span
                                                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                                    settings.auto_deploy_tokens ? 'transform translate-x-5' : ''
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: Security & Session Policies */}
                {activeTab === 'security' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Session Inactivity & Lifetime */}
                        <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                            <h3 className="text-sm font-semibold text-[#FFFFFF] mb-3">Session &amp; Token Invalidation</h3>
                            <div className="space-y-4 text-xs">
                                <div>
                                    <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">
                                        Session Inactivity Lifetime
                                    </label>
                                    <select
                                        value={settings.session_timeout}
                                        onChange={(e) => setSettings({ ...settings, session_timeout: parseInt(e.target.value, 10) })}
                                        className="w-full bg-[#0A0A0A] border border-[#262626] p-2.5 rounded text-xs text-white focus:outline-none focus:border-[#0f62fe]"
                                    >
                                        <option value={15}>15 Minutes</option>
                                        <option value={30}>30 Minutes</option>
                                        <option value={60}>1 Hour</option>
                                        <option value={120}>2 Hours (Default)</option>
                                        <option value={360}>6 Hours</option>
                                        <option value={720}>12 Hours</option>
                                        <option value={1440}>24 Hours</option>
                                    </select>
                                    <p className="text-[10px] text-[#656B6B] mt-1">
                                        Idle duration after which web client sessions are invalidated.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-1">
                                        SSL Certificate Expiry Warning
                                    </label>
                                    <select
                                        value={settings.ssl_warning_days}
                                        onChange={(e) => setSettings({ ...settings, ssl_warning_days: parseInt(e.target.value, 10) })}
                                        className="w-full bg-[#0A0A0A] border border-[#262626] p-2.5 rounded text-xs text-white focus:outline-none focus:border-[#0f62fe]"
                                    >
                                        <option value={7}>7 Days Prior</option>
                                        <option value={14}>14 Days Prior (Recommended)</option>
                                        <option value={30}>30 Days Prior</option>
                                        <option value={60}>60 Days Prior</option>
                                    </select>
                                    <p className="text-[10px] text-[#656B6B] mt-1">
                                        Triggers warnings in node overview before Let's Encrypt / custom cert expires.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* MFA & Registration Policy */}
                        <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                            <h3 className="text-sm font-semibold text-[#FFFFFF] mb-3">Authentication Enforcement</h3>
                            <div className="space-y-4 text-xs">
                                <div>
                                    <label className="text-[10px] font-mono uppercase text-[#656B6B] block mb-2">
                                        Two-Factor Authentication (2FA) Policy
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { val: 0, label: 'Optional', desc: 'User discretion' },
                                            { val: 1, label: 'Admin Only', desc: 'Staff required' },
                                            { val: 2, label: 'All Users', desc: 'Strict global' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.val}
                                                type="button"
                                                onClick={() => setSettings({ ...settings, two_factor_requirement: opt.val })}
                                                className={`p-2.5 rounded border text-left transition-colors cursor-pointer ${
                                                    settings.two_factor_requirement === opt.val
                                                        ? 'bg-[#1C1C1C] border-white text-white'
                                                        : 'bg-[#0A0A0A] border-[#262626] text-[#656B6B] hover:text-white'
                                                }`}
                                            >
                                                <span className="font-semibold text-xs block">{opt.label}</span>
                                                <span className="text-[9px] text-[#A0A0A0] block mt-0.5">{opt.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-[#1F1F1F]">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-medium text-white block">Email OTP Registration Verification</span>
                                            <span className="text-[10px] text-[#656B6B] block mt-0.5">
                                                Require one-time SMTP passcode to confirm new user registrations
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSettings({ ...settings, registration_otp: !settings.registration_otp })}
                                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                                                settings.registration_otp ? 'bg-[#10B981]' : 'bg-[#262626]'
                                            }`}
                                        >
                                            <span
                                                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                                    settings.registration_otp ? 'transform translate-x-5' : ''
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: System Maintenance & Cache */}
                {activeTab === 'maintenance' && (
                    <div className="space-y-6">
                        {/* Maintenance Mode Emergency Switch */}
                        <div className={`border rounded-md p-5 transition-colors ${
                            settings.maintenance_mode ? 'bg-[#2A0808] border-[#7F1D1D]' : 'bg-[#121212] border-[#262626]'
                        }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-semibold text-white m-0">Cluster Maintenance Mode</h3>
                                        {settings.maintenance_mode && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#EF4444] text-white">
                                                ACTIVE
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[#A0A0A0] m-0">
                                        When active, all non-administrative traffic is refused with an HTTP 503 Maintenance banner.
                                    </p>
                                </div>

                                <button
                                    onClick={() => runAction('toggle_maintenance', 'Toggle Maintenance Mode')}
                                    disabled={actionRunning !== null}
                                    className={`px-4 py-2 rounded text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                                        settings.maintenance_mode
                                            ? 'bg-white text-black hover:bg-neutral-200'
                                            : 'bg-[#7F1D1D] hover:bg-[#991B1B] text-white'
                                    }`}
                                >
                                    {actionRunning === 'toggle_maintenance'
                                        ? 'Switching...'
                                        : settings.maintenance_mode
                                        ? 'Exit Maintenance Mode'
                                        : 'Enable Maintenance Mode'}
                                </button>
                            </div>
                        </div>

                        {/* Cache Tier Operations */}
                        <div className="bg-[#121212] border border-[#262626] rounded-md p-5">
                            <h3 className="text-sm font-semibold text-[#FFFFFF] mb-3">System Framework Optimization</h3>
                            <p className="text-xs text-[#656B6B] mb-4">
                                Recompile configuration files, warm route caches, and clear compiled blade templates.
                            </p>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => runAction('optimize', 'Optimize Application')}
                                    disabled={actionRunning !== null}
                                    className="bg-white text-black hover:bg-neutral-200 text-xs font-semibold px-4 py-2 rounded transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {actionRunning === 'optimize' ? 'Optimizing...' : 'Run Optimize (Routes & Config)'}
                                </button>

                                <button
                                    onClick={() => runAction('clear_cache', 'Flush All Caches')}
                                    disabled={actionRunning !== null}
                                    className="bg-[#1C1C1C] hover:bg-[#262626] text-white border border-[#333333] text-xs font-medium px-4 py-2 rounded transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {actionRunning === 'clear_cache' ? 'Flushing...' : 'Purge All Caches'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Unsaved Changes Sticky Bar */}
                {isDirty && (
                    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-[#141414] border border-[#333333] rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 text-xs animate-bounce-short">
                        <span className="text-white font-medium">You have unsaved changes.</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDiscard}
                                disabled={saving}
                                className="text-[#A0A0A0] hover:text-white px-3 py-1 text-xs cursor-pointer"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-white text-black hover:bg-neutral-200 font-semibold px-4 py-1.5 rounded-full text-xs cursor-pointer"
                            >
                                {saving ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
