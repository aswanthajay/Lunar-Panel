import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import http from '@/api/http';
import useMinecraftTickStats from '@/plugins/useMinecraftTickStats';

interface SparkReport {
    id: string;
    url: string;
    label?: string;
    mode?: string;
    created_at?: string;
}

interface SparkStatusResponse {
    installed: boolean;
    plugin_file: string | null;
    directory: string;
    reports: SparkReport[];
    tick_stats: any;
}

export default function SparkProfilerContainer() {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.id || '';
    const isMinecraft = Boolean(server?.isMinecraft);
    const tickStats = useMinecraftTickStats();
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [installed, setInstalled] = useState<boolean>(() => {
        try {
            return localStorage.getItem(`spark_active_${uuid}`) === 'true';
        } catch {
            return false;
        }
    });
    const [pluginFile, setPluginFile] = useState<string | null>(null);
    const [pluginDir, setPluginDir] = useState('/plugins');
    const [reports, setReports] = useState<SparkReport[]>([]);

    // Installation state
    const [installing, setInstalling] = useState(false);
    const [installDir, setInstallDir] = useState<'/plugins' | '/mods'>('/plugins');
    const [installNotice, setInstallNotice] = useState<string | null>(null);

    // Profiler Sampler Controls
    const [samplerMode, setSamplerMode] = useState<'cpu' | 'alloc'>('cpu');
    const [duration, setDuration] = useState<number>(60);
    const [threadFilter, setThreadFilter] = useState<'server' | 'all'>('server');
    const [onlyTicksOver, setOnlyTicksOver] = useState<number>(0);

    // Profiler Running state
    const [isSampling, setIsSampling] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const countdownTimerRef = useRef<any>(null);
    const [profilerActionLoading, setProfilerActionLoading] = useState(false);

    // Embedded Viewer state
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    // Manual Report Add state
    const [manualUrl, setManualUrl] = useState('');
    const [manualLabel, setManualLabel] = useState('');
    const [savingManual, setSavingManual] = useState(false);

    // Notification toast
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

    const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
        setToast({ text, type });
        setTimeout(() => {
            setToast((prev) => (prev?.text === text ? null : prev));
        }, 4000);
    };

    const isSparkActive = installed || reports.length > 0 || isSampling || Boolean(tickStats.lastReportUrl);

    useEffect(() => {
        if (isSparkActive && uuid) {
            try {
                localStorage.setItem(`spark_active_${uuid}`, 'true');
            } catch {}
        }
    }, [isSparkActive, uuid]);

    // Load initial Spark status & report history
    const loadStatus = useCallback(async () => {
        if (!uuid || !isMinecraft) return;
        try {
            const { data } = await http.get<SparkStatusResponse>(`/api/client/servers/${uuid}/minecraft/spark/status`);
            if (data.installed || (data.reports && data.reports.length > 0)) {
                setInstalled(true);
            }
            setPluginFile(data.plugin_file);
            setPluginDir(data.directory || '/plugins');
            setReports(data.reports || []);
            setInstallDir(data.directory === '/mods' ? '/mods' : '/plugins');
        } catch (err: any) {
            console.error('Failed to load Spark status:', err);
        } finally {
            setLoading(false);
        }
    }, [uuid, isMinecraft]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    // Check if a URL was passed in query params (e.g. from console banner)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const qUrl = params.get('url');
        if (qUrl && /^https?:\/\/spark\.lucko\.me\/[a-zA-Z0-9_-]+/i.test(qUrl)) {
            setViewerUrl(qUrl);
        }
    }, [location.search]);

    // Listen for newly auto-detected report URL from console
    useEffect(() => {
        if (tickStats.lastReportUrl) {
            setViewerUrl(tickStats.lastReportUrl);
            setIsSampling(false);
            setCountdown(null);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            loadStatus();
        }
    }, [tickStats.lastReportUrl, loadStatus]);

    // Clean up countdown timer on unmount
    useEffect(() => {
        return () => {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, []);

    // 1-Click Install Spark
    const handleInstall = async () => {
        if (!uuid) return;
        setInstalling(true);
        setInstallNotice(null);
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/spark/install`, {
                directory: installDir,
            });
            showToast(data.message || 'Spark installed successfully! Please restart the server.', 'success');
            setInstallNotice(data.message || 'Spark installed! Restart the server to activate.');
            await loadStatus();
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.message || 'Failed to install Spark.';
            showToast(msg, 'error');
            setInstallNotice(msg);
        } finally {
            setInstalling(false);
        }
    };

    // Start Profiler Sampler
    const handleStartProfiler = async () => {
        if (!uuid) return;
        setProfilerActionLoading(true);
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/spark/profiler`, {
                action: 'start',
                mode: samplerMode,
                timeout: duration,
                thread: threadFilter,
                only_ticks_over: onlyTicksOver,
            });

            setIsSampling(true);
            setInstalled(true);
            setPluginFile((prev) => prev || 'Spark Active');
            showToast(`Sampler started in ${samplerMode.toUpperCase()} mode. Recording ticks...`, 'success');

            if (duration > 0) {
                setCountdown(duration);
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = setInterval(() => {
                    setCountdown((prev) => {
                        if (prev === null || prev <= 1) {
                            clearInterval(countdownTimerRef.current);
                            setIsSampling(false);
                            return null;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to start profiler sampler.';
            showToast(msg, 'error');
        } finally {
            setProfilerActionLoading(false);
        }
    };

    // Stop Profiler Sampler
    const handleStopProfiler = async () => {
        if (!uuid) return;
        setProfilerActionLoading(true);
        try {
            await http.post(`/api/client/servers/${uuid}/minecraft/spark/profiler`, { action: 'stop' });
            setIsSampling(false);
            setCountdown(null);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            showToast('Stopping sampler. Awaiting generated report link...', 'info');
        } catch (err: any) {
            showToast(err?.response?.data?.error || 'Failed to stop profiler.', 'error');
        } finally {
            setProfilerActionLoading(false);
        }
    };

    // Cancel Profiler Sampler
    const handleCancelProfiler = async () => {
        if (!uuid) return;
        setProfilerActionLoading(true);
        try {
            await http.post(`/api/client/servers/${uuid}/minecraft/spark/profiler`, { action: 'cancel' });
            setIsSampling(false);
            setCountdown(null);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            showToast('Profiler sampling cancelled.', 'info');
        } catch (err: any) {
            showToast(err?.response?.data?.error || 'Failed to cancel profiler.', 'error');
        } finally {
            setProfilerActionLoading(false);
        }
    };

    // Run Quick Command (/spark health, /spark tps, etc.)
    const handleQuickCommand = async (type: string, title: string) => {
        if (!uuid) return;
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/spark/command`, { type });
            setInstalled(true);
            setPluginFile((prev) => prev || 'Spark Active');
            showToast(data.message || `Executed /${type}`, 'success');
        } catch (err: any) {
            showToast(err?.response?.data?.error || `Failed to execute command.`, 'error');
        }
    };

    // Add Manual Report
    const handleAddManualReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualUrl.trim() || !uuid) return;
        setSavingManual(true);
        try {
            const { data } = await http.post(`/api/client/servers/${uuid}/minecraft/spark/reports`, {
                url: manualUrl.trim(),
                label: manualLabel.trim() || 'Manual Entry',
                mode: 'saved',
            });
            setReports(data.reports || []);
            setViewerUrl(manualUrl.trim());
            setManualUrl('');
            setManualLabel('');
            showToast('Report saved to history!', 'success');
        } catch (err: any) {
            showToast(err?.response?.data?.error || 'Invalid report URL.', 'error');
        } finally {
            setSavingManual(false);
        }
    };

    // Delete Report
    const handleDeleteReport = async (reportId: string) => {
        if (!uuid) return;
        try {
            const { data } = await http.delete(`/api/client/servers/${uuid}/minecraft/spark/reports/${reportId}`);
            setReports(data.reports || []);
            if (viewerUrl?.includes(reportId)) {
                setViewerUrl(null);
            }
            showToast('Report removed from history.', 'info');
        } catch (err: any) {
            showToast(err?.response?.data?.error || 'Failed to delete report.', 'error');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedUrl(text);
        setTimeout(() => setCopiedUrl(null), 2000);
        showToast('Report link copied to clipboard!', 'success');
    };

    if (!isMinecraft) {
        return (
            <ServerContentBlock title={'Spark Profiler'}>
                <div className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] p-6 text-center">
                    <p className="text-sm text-[#A0A0A0]">Spark Profiler is only available for Minecraft servers.</p>
                </div>
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title={'Spark Profiler'}>
            {/* Toast Notification */}
            {toast && (
                <div
                    className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg border text-xs font-mono shadow-2xl flex items-center gap-2 transition-all ${
                        toast.type === 'success'
                            ? 'bg-[#062419] border-[#064E3B] text-[#10B981]'
                            : toast.type === 'error'
                            ? 'bg-[#290B0E] border-[#7F1D1D] text-[#EF4444]'
                            : 'bg-[#141414] border-[#2A2A2A] text-[#FFFFFF]'
                    }`}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#141414]">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-base font-medium text-white tracking-wide">Spark Performance Profiler</h1>
                            <p className="text-xs text-[#737373]">
                                Real-time TPS/MSPT engine analytics, CPU thread sampling, memory allocation tracing, and interactive flame graphs.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono">
                    {/* Installed Status Badge */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#1F1F1F] bg-[#050505] text-xs">
                        <span
                            className={`w-2 h-2 rounded-full ${isSparkActive ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`}
                        />
                        <span className="text-[11px] text-[#A0A0A0]">
                            {isSparkActive ? (pluginFile || 'Spark Active') : 'Spark Not Installed'}
                        </span>
                    </div>

                    {/* Live TPS / MSPT Badge */}
                    <button
                        type="button"
                        onClick={tickStats.sample}
                        className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#1F1F1F] bg-[#050505] hover:border-[#333333] transition-colors text-xs cursor-pointer"
                        title="Click to refresh live tick rate"
                    >
                        <span className="text-[10px] uppercase tracking-wider text-[#6B7280]">TPS</span>
                        <span
                            className={`font-semibold tabular-nums ${
                                tickStats.tps === null
                                    ? 'text-[#737373]'
                                    : tickStats.tps >= 19.0
                                    ? 'text-[#10B981]'
                                    : tickStats.tps >= 16.0
                                    ? 'text-[#F59E0B]'
                                    : 'text-[#EF4444]'
                            }`}
                        >
                            {tickStats.tps !== null ? tickStats.tps.toFixed(1) : '—'}
                        </span>
                        {tickStats.mspt !== null && (
                            <>
                                <span className="text-[#333333]">/</span>
                                <span className="text-[10px] uppercase tracking-wider text-[#6B7280]">MSPT</span>
                                <span
                                    className={`font-semibold tabular-nums ${
                                        tickStats.mspt <= 35
                                            ? 'text-[#10B981]'
                                            : tickStats.mspt <= 50
                                            ? 'text-[#F59E0B]'
                                            : 'text-[#EF4444]'
                                    }`}
                                >
                                    {tickStats.mspt.toFixed(1)}ms
                                </span>
                            </>
                        )}
                        <span className="text-[#525252] text-[10px] hover:text-white">↻</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex justify-center">
                    <Spinner size={'large'} />
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {/* Uninstalled Banner with 1-Click Install */}
                    {!isSparkActive && (
                        <div className="p-5 rounded-lg border border-[#3A2203] bg-[#140D04] text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <h2 className="text-sm font-semibold text-white">Spark is not installed on this server</h2>
                                    <p className="text-[#D97706] mt-0.5">
                                        Spark is a lightweight, zero-overhead performance profiler for Bukkit, Spigot, Paper, Purpur, Fabric, and Forge.
                                    </p>
                                    {installNotice && (
                                        <p className="text-[#34D399] mt-2 font-mono text-[11px]">{installNotice}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 font-mono shrink-0">
                                <select
                                    value={installDir}
                                    onChange={(e) => setInstallDir(e.target.value as any)}
                                    className="bg-[#000000] border border-[#2B1B04] text-white text-xs rounded px-2.5 py-1.5 outline-none"
                                >
                                    <option value="/plugins">/plugins (Paper / Spigot / Purpur)</option>
                                    <option value="/mods">/mods (Fabric / Forge / NeoForge)</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={handleInstall}
                                    disabled={installing}
                                    className="px-4 py-1.5 rounded bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 font-sans text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                                    style={{ color: '#000000' }}
                                >
                                    {installing ? <Spinner size="small" /> : <span style={{ color: '#000000', fontWeight: 700 }}>⚡ 1-Click Install Spark</span>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Main Profiler Controller & Quick Diagnostics Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* ── Left 2 Columns: Profiler Sampler Controls ── */}
                        <div className="lg:col-span-2 rounded-lg border border-[#1F1F1F] bg-[#050505] p-5 flex flex-col justify-between gap-5">
                            <div>
                                <div className="flex items-center justify-between pb-3 border-b border-[#141414]">
                                    <div>
                                        <h3 className="text-xs uppercase tracking-wider font-semibold text-white">
                                            Sampler Controller
                                        </h3>
                                        <p className="text-[11px] text-[#737373]">
                                            Record engine execution timings and inspect lag sources with flame graphs.
                                        </p>
                                    </div>

                                    {isSampling && (
                                        <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#062419] border border-[#064E3B] text-[#10B981] font-mono text-xs animate-pulse">
                                            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                                            <span>Sampling Active ({countdown !== null ? `${countdown}s` : 'Manual'})</span>
                                        </div>
                                    )}
                                </div>

                                {/* Sampler Mode Toggle (CPU vs Alloc) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                    <div
                                        onClick={() => setSamplerMode('cpu')}
                                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                                            samplerMode === 'cpu'
                                                ? 'bg-[#101010] border-[#3B82F6]'
                                                : 'bg-[#0A0A0A] border-[#1F1F1F] hover:border-[#2A2A2A]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-white">CPU Engine Sampler</span>
                                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${samplerMode === 'cpu' ? 'bg-[#1E3A8A] text-[#60A5FA]' : 'bg-[#1F1F1F] text-[#737373]'}`}>
                                                standard
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[#737373] leading-relaxed">
                                            Profiles server tick delays, sluggish plugins, redstone, entity AI, and world generation.
                                        </p>
                                    </div>

                                    <div
                                        onClick={() => setSamplerMode('alloc')}
                                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                                            samplerMode === 'alloc'
                                                ? 'bg-[#101010] border-[#A855F7]'
                                                : 'bg-[#0A0A0A] border-[#1F1F1F] hover:border-[#2A2A2A]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-white">Memory Allocation Sampler</span>
                                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${samplerMode === 'alloc' ? 'bg-[#3B0764] text-[#C084FC]' : 'bg-[#1F1F1F] text-[#737373]'}`}>
                                                --alloc
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[#737373] leading-relaxed">
                                            Tracks heap memory allocations to locate memory leaks and GC pause triggers.
                                        </p>
                                    </div>
                                </div>

                                {/* Sampling Options */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 font-mono text-xs">
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider text-[#6B7280] mb-1.5 font-sans font-semibold">
                                            Sampling Duration
                                        </label>
                                        <select
                                            value={duration}
                                            onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                                            disabled={isSampling}
                                            className="w-full bg-[#000000] border border-[#1F1F1F] rounded px-3 py-2 text-white outline-none focus:border-[#383838]"
                                        >
                                            <option value={30}>30 Seconds (Quick check)</option>
                                            <option value={60}>60 Seconds (Recommended)</option>
                                            <option value={120}>2 Minutes (Detailed)</option>
                                            <option value={300}>5 Minutes (Deep trace)</option>
                                            <option value={0}>Manual (Run until stopped)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider text-[#6B7280] mb-1.5 font-sans font-semibold">
                                            Thread Target
                                        </label>
                                        <select
                                            value={threadFilter}
                                            onChange={(e) => setThreadFilter(e.target.value as any)}
                                            disabled={isSampling}
                                            className="w-full bg-[#000000] border border-[#1F1F1F] rounded px-3 py-2 text-white outline-none focus:border-[#383838]"
                                        >
                                            <option value="server">Server Thread (Game loop)</option>
                                            <option value="all">All Threads (*) (Async plugins)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider text-[#6B7280] mb-1.5 font-sans font-semibold">
                                            Lag Spike Filter
                                        </label>
                                        <select
                                            value={onlyTicksOver}
                                            onChange={(e) => setOnlyTicksOver(parseInt(e.target.value, 10))}
                                            disabled={isSampling}
                                            className="w-full bg-[#000000] border border-[#1F1F1F] rounded px-3 py-2 text-white outline-none focus:border-[#383838]"
                                        >
                                            <option value={0}>None (Record all ticks)</option>
                                            <option value={50}>Only ticks &gt; 50ms (Lag only)</option>
                                            <option value={100}>Only ticks &gt; 100ms (Heavy lag)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons Toolbar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#141414]">
                                <div className="text-[11px] text-[#737373] font-mono">
                                    Command preview:{' '}
                                    <code className="text-[#34D399] bg-[#000000] px-1.5 py-0.5 rounded border border-[#1F1F1F]">
                                        /spark profiler start{samplerMode === 'alloc' ? ' --alloc' : ''}{duration > 0 ? ` --timeout ${duration}` : ''}{threadFilter === 'all' ? ' --thread *' : ''}{onlyTicksOver > 0 ? ` --only-ticks-over ${onlyTicksOver}` : ''}
                                    </code>
                                </div>

                                <div className="flex items-center gap-2">
                                    {!isSampling ? (
                                        <button
                                            type="button"
                                            onClick={handleStartProfiler}
                                            disabled={profilerActionLoading}
                                            className="px-4 py-2 rounded bg-[#FFFFFF] hover:bg-[#E5E7EB] disabled:opacity-50 font-sans text-xs transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                                            style={{ color: '#000000' }}
                                        >
                                            {profilerActionLoading ? <Spinner size="small" /> : (
                                                <>
                                                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                                                    <span style={{ color: '#000000', fontWeight: 700 }}>Start Profiler</span>
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleStopProfiler}
                                                disabled={profilerActionLoading}
                                                className="px-4 py-2 rounded bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 font-sans text-xs transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                                                style={{ color: '#000000' }}
                                            >
                                                {profilerActionLoading ? <Spinner size="small" /> : <span style={{ color: '#000000', fontWeight: 700 }}>Stop &amp; Generate Report</span>}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCancelProfiler}
                                                disabled={profilerActionLoading}
                                                className="px-3 py-2 rounded bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#A0A0A0] hover:text-white font-sans text-xs transition-colors cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Right Column: Quick Engine Diagnostics ── */}
                        <div className="rounded-lg border border-[#1F1F1F] bg-[#050505] p-5 flex flex-col justify-between gap-4">
                            <div>
                                <h3 className="text-xs uppercase tracking-wider font-semibold text-white pb-3 border-b border-[#141414]">
                                    Diagnostic Quick Actions
                                </h3>
                                <p className="text-[11px] text-[#737373] mt-2 mb-4 leading-relaxed">
                                    Instant commands to analyze JVM memory, tick rates, and network performance without running a full profile.
                                </p>

                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleQuickCommand('health', 'Health Overview')}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] text-white text-xs font-mono transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#3B82F6]">♥</span>
                                            <span>Engine Health & Memory</span>
                                        </div>
                                        <span className="text-[#525252] text-[11px]">/spark health</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleQuickCommand('tps', 'TPS Multi-window')}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] text-white text-xs font-mono transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#10B981]">⚡</span>
                                            <span>Tick Rate Multi-Window</span>
                                        </div>
                                        <span className="text-[#525252] text-[11px]">/spark tps</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleQuickCommand('heapsummary', 'Heap Summary')}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] text-white text-xs font-mono transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#A855F7]">⬡</span>
                                            <span>JVM Heap Inspection</span>
                                        </div>
                                        <span className="text-[#525252] text-[11px]">/spark heapsummary</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleQuickCommand('gc', 'GC Pauses')}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] text-white text-xs font-mono transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#F59E0B]">♻</span>
                                            <span>Garbage Collection (GC)</span>
                                        </div>
                                        <span className="text-[#525252] text-[11px]">/spark gc</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleQuickCommand('ping', 'Player Latencies')}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] text-white text-xs font-mono transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#06B6D4]">📶</span>
                                            <span>Player Latency Table</span>
                                        </div>
                                        <span className="text-[#525252] text-[11px]">/spark ping</span>
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 rounded bg-[#000000] border border-[#141414] text-[11px] text-[#737373]">
                                Tip: Diagnostics output will stream in real time into your{' '}
                                <a href={`/server/${uuid}`} className="text-white hover:underline">
                                    Console window
                                </a>
                                .
                            </div>
                        </div>
                    </div>

                    {/* ── Embedded Interactive Spark Profiler Viewer (iframe) ── */}
                    {viewerUrl && (
                        <div
                            className={`rounded-lg border border-[#1F1F1F] bg-[#000000] overflow-hidden flex flex-col transition-all ${
                                isViewerFullscreen
                                    ? 'fixed inset-0 z-50 rounded-none border-0'
                                    : 'shadow-2xl'
                            }`}
                        >
                            {/* Viewer Header Toolbar */}
                            <div className="px-4 py-2.5 bg-[#050505] border-b border-[#1F1F1F] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                                    <span className="text-white font-medium font-sans">Embedded Flame Graph Viewer:</span>
                                    <span className="text-[#10B981] truncate">{viewerUrl}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(viewerUrl)}
                                        className="px-2.5 py-1 rounded bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-white border border-[#1F1F1F] hover:border-[#383838] transition-colors cursor-pointer"
                                        title="Copy link"
                                    >
                                        {copiedUrl === viewerUrl ? '✓ Copied' : 'Copy Link'}
                                    </button>

                                    <a
                                        href={viewerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1 rounded bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-white border border-[#1F1F1F] hover:border-[#383838] transition-colors flex items-center gap-1"
                                    >
                                        <span>Open External</span>
                                        <span>↗</span>
                                    </a>

                                    <button
                                        type="button"
                                        onClick={() => setIsViewerFullscreen(!isViewerFullscreen)}
                                        className="px-2.5 py-1 rounded bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-white border border-[#1F1F1F] hover:border-[#383838] transition-colors cursor-pointer"
                                    >
                                        {isViewerFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setViewerUrl(null)}
                                        className="px-2.5 py-1 rounded bg-[#1F0A0A] hover:bg-[#290B0E] text-[#EF4444] border border-[#3A1414] hover:border-[#7F1D1D] transition-colors cursor-pointer"
                                        title="Close viewer"
                                    >
                                        Close ✕
                                    </button>
                                </div>
                            </div>

                            {/* Viewer Iframe */}
                            <div className="w-full flex-1 min-h-[700px] bg-[#111111]">
                                <iframe
                                    src={viewerUrl}
                                    title="Spark Profile Viewer"
                                    className="w-full h-full min-h-[700px] border-0"
                                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Saved Reports History ── */}
                    <div className="rounded-lg border border-[#1F1F1F] bg-[#050505] p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#141414]">
                            <div>
                                <h3 className="text-xs uppercase tracking-wider font-semibold text-white">
                                    Profile Reports History
                                </h3>
                                <p className="text-[11px] text-[#737373]">
                                    Past generated profile links stored for this server (retained for 30 days).
                                </p>
                            </div>

                            {/* Quick Add Existing URL */}
                            <form onSubmit={handleAddManualReport} className="flex items-center gap-2 font-mono text-xs">
                                <input
                                    type="text"
                                    placeholder="https://spark.lucko.me/..."
                                    value={manualUrl}
                                    onChange={(e) => setManualUrl(e.target.value)}
                                    className="bg-[#000000] border border-[#1F1F1F] rounded px-2.5 py-1 text-white outline-none focus:border-[#383838] w-48 sm:w-64 placeholder-[#525252]"
                                />
                                <button
                                    type="submit"
                                    disabled={savingManual || !manualUrl.trim()}
                                    className="px-3 py-1 rounded bg-[#1F1F1F] hover:bg-[#2A2A2A] disabled:opacity-50 text-white font-sans text-xs transition-colors cursor-pointer"
                                >
                                    {savingManual ? <Spinner size="small" /> : '+ Save'}
                                </button>
                            </form>
                        </div>

                        {reports.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-xs text-[#737373]">
                                    No saved reports yet. Start a profile sampler above to generate your first flame graph.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto mt-3">
                                <table className="w-full text-left font-mono text-xs">
                                    <thead>
                                        <tr className="border-b border-[#141414] text-[#6B7280] text-[10px] uppercase tracking-wider">
                                            <th className="py-2.5 px-3">Report ID / Label</th>
                                            <th className="py-2.5 px-3">Mode</th>
                                            <th className="py-2.5 px-3">Created</th>
                                            <th className="py-2.5 px-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#141414]">
                                        {reports.map((report) => (
                                            <tr key={report.id} className="hover:bg-[#0A0A0A] transition-colors group">
                                                <td className="py-3 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[#FFFFFF] font-medium font-sans">
                                                            {report.label || report.id}
                                                        </span>
                                                        <span className="text-[#525252] text-[10px]">#{report.id}</span>
                                                    </div>
                                                    <div className="text-[11px] text-[#737373] truncate max-w-sm">
                                                        {report.url}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                                                            report.mode === 'alloc'
                                                                ? 'bg-[#3B0764] text-[#C084FC]'
                                                                : 'bg-[#062419] text-[#10B981]'
                                                        }`}
                                                    >
                                                        {report.mode || 'CPU'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-[#737373] text-[11px]">
                                                    {report.created_at
                                                        ? new Date(report.created_at).toLocaleDateString(undefined, {
                                                              month: 'short',
                                                              day: 'numeric',
                                                              hour: '2-digit',
                                                              minute: '2-digit',
                                                          })
                                                        : 'Recent'}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewerUrl(report.url)}
                                                            className="px-2.5 py-1 rounded bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 text-xs font-sans font-medium transition-colors cursor-pointer"
                                                        >
                                                            View in Panel →
                                                        </button>

                                                        <a
                                                            href={report.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 rounded text-[#737373] hover:text-white transition-colors"
                                                            title="Open on spark.lucko.me"
                                                        >
                                                            ↗
                                                        </a>

                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(report.url)}
                                                            className="p-1 rounded text-[#737373] hover:text-white transition-colors cursor-pointer"
                                                            title="Copy Link"
                                                        >
                                                            📋
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteReport(report.id)}
                                                            className="p-1 rounded text-[#737373] hover:text-[#EF4444] transition-colors cursor-pointer"
                                                            title="Delete report"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </ServerContentBlock>
    );
}
