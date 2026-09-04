import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ChartData,
    ChartOptions,
    Filler,
    LinearScale,
    CategoryScale,
    LineElement,
    PointElement,
    Tooltip,
    Legend,
} from 'chart.js';
import { bytesToString } from '@/lib/formatters';

// Register Chart.js components
ChartJS.register(LineElement, PointElement, Filler, LinearScale, CategoryScale, Tooltip, Legend);

type TimeWindow = 30 | 60 | 120 | 300;
type ViewMode = 'grid' | 'master';
type FocusedMetric = 'cpu' | 'memory' | 'network' | null;

export default () => {
    const status = ServerContext.useStoreState((state) => state.status.value);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);

    // Interactive Controls State
    const [timeWindow, setTimeWindow] = useState<TimeWindow>(60);
    const [isPaused, setIsPaused] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [focusedMetric, setFocusedMetric] = useState<FocusedMetric>(null);

    // Master Timeline Series Toggles
    const [showCpu, setShowCpu] = useState(true);
    const [showMemory, setShowMemory] = useState(true);
    const [showNetIn, setShowNetIn] = useState(true);
    const [showNetOut, setShowNetOut] = useState(true);

    // Live Data Buffers
    const [cpuData, setCpuData] = useState<number[]>(() => Array(60).fill(0));
    const [memData, setMemData] = useState<number[]>(() => Array(60).fill(0));
    const [netTxData, setNetTxData] = useState<number[]>(() => Array(60).fill(0));
    const [netRxData, setNetRxData] = useState<number[]>(() => Array(60).fill(0));

    // Live Readouts
    const [currentCpu, setCurrentCpu] = useState<number>(0);
    const [currentMem, setCurrentMem] = useState<number>(0);
    const [currentRx, setCurrentRx] = useState<number>(0);
    const [currentTx, setCurrentTx] = useState<number>(0);
    const [totalRx, setTotalRx] = useState<number>(0);
    const [totalTx, setTotalTx] = useState<number>(0);

    const previousNet = useRef<{ tx: number; rx: number }>({ tx: -1, rx: -1 });

    // Handle buffer resize when timeWindow changes
    useEffect(() => {
        setCpuData((prev) => {
            if (prev.length === timeWindow) return prev;
            if (prev.length < timeWindow) {
                return Array(timeWindow - prev.length).fill(0).concat(prev);
            }
            return prev.slice(prev.length - timeWindow);
        });
        setMemData((prev) => {
            if (prev.length === timeWindow) return prev;
            if (prev.length < timeWindow) {
                return Array(timeWindow - prev.length).fill(0).concat(prev);
            }
            return prev.slice(prev.length - timeWindow);
        });
        setNetTxData((prev) => {
            if (prev.length === timeWindow) return prev;
            if (prev.length < timeWindow) {
                return Array(timeWindow - prev.length).fill(0).concat(prev);
            }
            return prev.slice(prev.length - timeWindow);
        });
        setNetRxData((prev) => {
            if (prev.length === timeWindow) return prev;
            if (prev.length < timeWindow) {
                return Array(timeWindow - prev.length).fill(0).concat(prev);
            }
            return prev.slice(prev.length - timeWindow);
        });
    }, [timeWindow]);

    // Reset data when offline
    useEffect(() => {
        if (status === 'offline') {
            handleReset();
        }
    }, [status]);

    const handleReset = () => {
        setCpuData(Array(timeWindow).fill(0));
        setMemData(Array(timeWindow).fill(0));
        setNetTxData(Array(timeWindow).fill(0));
        setNetRxData(Array(timeWindow).fill(0));
        setCurrentCpu(0);
        setCurrentMem(0);
        setCurrentRx(0);
        setCurrentTx(0);
        previousNet.current = { tx: -1, rx: -1 };
    };

    // Ingest WebSocket Stats Event
    useWebsocketEvent(SocketEvent.STATS, (raw: string) => {
        let stats: any = {};
        try {
            stats = JSON.parse(raw);
        } catch {
            return;
        }

        const cpuVal = Number(Number(stats.cpu_absolute || 0).toFixed(2));
        const memMb = Math.floor((stats.memory_bytes || 0) / 1024 / 1024);

        const currentTxBytes = stats.network?.tx_bytes || 0;
        const currentRxBytes = stats.network?.rx_bytes || 0;

        let deltaTx = 0;
        let deltaRx = 0;

        if (previousNet.current.tx >= 0 && previousNet.current.rx >= 0) {
            deltaTx = Math.max(0, currentTxBytes - previousNet.current.tx);
            deltaRx = Math.max(0, currentRxBytes - previousNet.current.rx);
        }

        previousNet.current = { tx: currentTxBytes, rx: currentRxBytes };

        setCurrentCpu(cpuVal);
        setCurrentMem(memMb);
        setCurrentRx(deltaRx);
        setCurrentTx(deltaTx);
        setTotalRx(currentRxBytes);
        setTotalTx(currentTxBytes);

        // If not paused, append to buffers
        if (!isPaused) {
            setCpuData((prev) => prev.slice(1).concat(cpuVal));
            setMemData((prev) => prev.slice(1).concat(memMb));
            setNetTxData((prev) => prev.slice(1).concat(deltaTx));
            setNetRxData((prev) => prev.slice(1).concat(deltaRx));
        }
    });

    // Statistical Computations
    const cpuStats = useMemo(() => {
        const active = cpuData.filter((v) => v > 0);
        return {
            min: active.length ? Math.min(...active).toFixed(1) : '0.0',
            max: Math.max(...cpuData).toFixed(1),
            avg: cpuData.length ? (cpuData.reduce((a, b) => a + b, 0) / cpuData.length).toFixed(1) : '0.0',
        };
    }, [cpuData]);

    const memStats = useMemo(() => {
        const active = memData.filter((v) => v > 0);
        return {
            min: active.length ? Math.min(...active) : 0,
            max: Math.max(...memData),
            avg: memData.length ? Math.round(memData.reduce((a, b) => a + b, 0) / memData.length) : 0,
        };
    }, [memData]);

    const netStats = useMemo(() => {
        return {
            peakRx: Math.max(...netRxData),
            peakTx: Math.max(...netTxData),
        };
    }, [netRxData, netTxData]);

    // X-Axis Relative Time Labels
    const labels = useMemo(() => {
        return Array(timeWindow)
            .fill(0)
            .map((_, i) => {
                const diff = timeWindow - 1 - i;
                return diff === 0 ? 'now' : `-${diff}s`;
            });
    }, [timeWindow]);

    // Reusable Gradient Helper
    const createGradient = (ctx: CanvasRenderingContext2D, colorTop: string, colorBottom = 'rgba(0,0,0,0)') => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 160);
        gradient.addColorStop(0, colorTop);
        gradient.addColorStop(1, colorBottom);
        return gradient;
    };

    // Shared Base Chart Options
    const baseChartOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: true,
                backgroundColor: 'rgba(5, 5, 5, 0.95)',
                titleColor: '#FFFFFF',
                bodyColor: '#A0A0A0',
                borderColor: '#1F1F1F',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 6,
                titleFont: { family: 'monospace', size: 11 },
                bodyFont: { family: 'monospace', size: 11 },
                displayColors: true,
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
            },
        },
        scales: {
            x: {
                display: false,
                grid: { display: false },
            },
            y: {
                min: 0,
                grid: {
                    display: true,
                    color: '#141414',
                },
                ticks: {
                    color: '#525252',
                    font: { family: 'monospace', size: 10 },
                    maxTicksLimit: 4,
                    precision: 0,
                },
            },
        },
        elements: {
            point: {
                radius: 0,
                hoverRadius: 4,
                hoverBorderWidth: 2,
            },
            line: {
                tension: 0.35,
                borderWidth: 2,
            },
        },
    };

    // CPU Chart Configuration
    const cpuChartData: ChartData<'line'> = {
        labels,
        datasets: [
            {
                label: 'CPU Load',
                data: cpuData,
                borderColor: '#10B981',
                backgroundColor: (context: any) => {
                    const ctx = context.chart?.ctx;
                    return ctx ? createGradient(ctx, 'rgba(16, 185, 129, 0.30)') : 'rgba(16, 185, 129, 0.15)';
                },
                fill: true,
                pointHoverBackgroundColor: '#10B981',
                pointHoverBorderColor: '#FFFFFF',
            },
        ],
    };

    const cpuMaxVal = limits.cpu > 0 ? Math.max(limits.cpu, Math.ceil(Number(cpuStats.max) / 25) * 25) : 100;
    const cpuStep = limits.cpu > 0 ? (limits.cpu <= 100 ? 50 : limits.cpu / 2) : 50;

    const cpuChartOptions: any = {
        ...baseChartOptions,
        scales: {
            ...baseChartOptions.scales,
            y: {
                ...baseChartOptions.scales?.y,
                min: 0,
                max: cpuMaxVal,
                ticks: {
                    ...baseChartOptions.scales?.y?.ticks,
                    stepSize: cpuStep,
                    precision: 0,
                    callback: (val: any) => `${Math.round(Number(val))}%`,
                },
            },
        },
        plugins: {
            ...baseChartOptions.plugins,
            tooltip: {
                ...baseChartOptions.plugins?.tooltip,
                callbacks: {
                    label: (ctx: any) => ` CPU: ${ctx.parsed.y.toFixed(2)}%`,
                },
            },
        },
    };

    // Memory Chart Configuration
    const memChartData: ChartData<'line'> = {
        labels,
        datasets: [
            {
                label: 'Memory',
                data: memData,
                borderColor: '#06B6D4',
                backgroundColor: (context: any) => {
                    const ctx = context.chart?.ctx;
                    return ctx ? createGradient(ctx, 'rgba(6, 182, 212, 0.30)') : 'rgba(6, 182, 212, 0.15)';
                },
                fill: true,
                pointHoverBackgroundColor: '#06B6D4',
                pointHoverBorderColor: '#FFFFFF',
            },
        ],
    };

    const memLimit = limits.memory;
    const memMaxVal = memLimit > 0 ? Math.max(memLimit, Math.ceil(memStats.max / 256) * 256) : Math.max(1024, Math.ceil(memStats.max / 512) * 512);
    let memStep = memLimit > 0 ? (memLimit <= 1024 ? memLimit / 2 : memLimit / 2) : 512;
    if (memLimit >= 4096) memStep = memLimit / 4;

    const memChartOptions: any = {
        ...baseChartOptions,
        scales: {
            ...baseChartOptions.scales,
            y: {
                ...baseChartOptions.scales?.y,
                min: 0,
                max: memMaxVal,
                ticks: {
                    ...baseChartOptions.scales?.y?.ticks,
                    stepSize: memStep,
                    precision: 0,
                    callback: (val: any) => {
                        const num = Number(val);
                        if (num === 0) return '0 MiB';
                        if (num >= 1024 && num % 1024 === 0) {
                            return `${num / 1024} GiB`;
                        }
                        return `${Math.round(num)} MiB`;
                    },
                },
            },
        },
        plugins: {
            ...baseChartOptions.plugins,
            tooltip: {
                ...baseChartOptions.plugins?.tooltip,
                callbacks: {
                    label: (ctx: any) => ` RAM: ${ctx.parsed.y} MiB`,
                },
            },
        },
    };

    // Network Chart Configuration (Dual Stream)
    const netChartData: ChartData<'line'> = {
        labels,
        datasets: [
            {
                label: 'Inbound (RX)',
                data: netRxData,
                borderColor: '#F59E0B',
                backgroundColor: (context: any) => {
                    const ctx = context.chart?.ctx;
                    return ctx ? createGradient(ctx, 'rgba(245, 158, 11, 0.20)') : 'rgba(245, 158, 11, 0.10)';
                },
                fill: true,
                pointHoverBackgroundColor: '#F59E0B',
                pointHoverBorderColor: '#FFFFFF',
            },
            {
                label: 'Outbound (TX)',
                data: netTxData,
                borderColor: '#8B5CF6',
                backgroundColor: (context: any) => {
                    const ctx = context.chart?.ctx;
                    return ctx ? createGradient(ctx, 'rgba(139, 92, 246, 0.20)') : 'rgba(139, 92, 246, 0.10)';
                },
                fill: true,
                pointHoverBackgroundColor: '#8B5CF6',
                pointHoverBorderColor: '#FFFFFF',
            },
        ],
    };

    const netChartOptions: any = {
        ...baseChartOptions,
        scales: {
            ...baseChartOptions.scales,
            y: {
                ...baseChartOptions.scales?.y,
                suggestedMax: 10240,
                ticks: {
                    ...baseChartOptions.scales?.y?.ticks,
                    maxTicksLimit: 4,
                    precision: 0,
                    callback: (val: any) => bytesToString(Math.round(Number(val))),
                },
            },
        },
        plugins: {
            ...baseChartOptions.plugins,
            tooltip: {
                ...baseChartOptions.plugins?.tooltip,
                callbacks: {
                    label: (ctx: any) => ` ${ctx.dataset.label}: ${bytesToString(ctx.parsed.y)}/s`,
                },
            },
        },
    };

    // Unified Master Timeline Configuration
    const masterChartData: ChartData<'line'> = {
        labels,
        datasets: [
            ...(showCpu ? [{
                label: 'CPU (%)',
                data: cpuData,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.10)',
                yAxisID: 'yCpu',
                fill: false,
                borderWidth: 2,
            }] : []),
            ...(showMemory ? [{
                label: 'RAM (MiB)',
                data: memData,
                borderColor: '#06B6D4',
                backgroundColor: 'rgba(6, 182, 212, 0.10)',
                yAxisID: 'yMem',
                fill: false,
                borderWidth: 2,
            }] : []),
            ...(showNetIn ? [{
                label: 'Net In (B/s)',
                data: netRxData,
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.10)',
                yAxisID: 'yNet',
                fill: false,
                borderWidth: 2,
            }] : []),
            ...(showNetOut ? [{
                label: 'Net Out (B/s)',
                data: netTxData,
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.10)',
                yAxisID: 'yNet',
                fill: false,
                borderWidth: 2,
            }] : []),
        ],
    };

    const masterChartOptions: any = {
        ...baseChartOptions,
        scales: {
            x: {
                display: true,
                grid: { color: '#141414' },
                ticks: { color: '#525252', font: { family: 'monospace', size: 9 }, maxTicksLimit: 8 },
            },
            yCpu: {
                type: 'linear',
                display: showCpu,
                position: 'left',
                min: 0,
                suggestedMax: limits.cpu > 0 ? limits.cpu : 100,
                grid: { color: '#141414' },
                ticks: { color: '#10B981', font: { family: 'monospace', size: 9 }, maxTicksLimit: 4, precision: 0, callback: (v: any) => `${Math.round(Number(v))}%` },
            },
            yMem: {
                type: 'linear',
                display: showMemory,
                position: 'right',
                min: 0,
                suggestedMax: limits.memory > 0 ? limits.memory : 1024,
                grid: { display: false },
                ticks: { color: '#06B6D4', font: { family: 'monospace', size: 9 }, maxTicksLimit: 4, precision: 0, callback: (v: any) => { const n = Number(v); return n >= 1024 && n % 1024 === 0 ? `${n / 1024}G` : `${Math.round(n)}M`; } },
            },
            yNet: {
                type: 'linear',
                display: showNetIn || showNetOut,
                position: 'right',
                min: 0,
                grid: { display: false },
                ticks: { color: '#F59E0B', font: { family: 'monospace', size: 9 }, maxTicksLimit: 4, precision: 0, callback: (v: any) => bytesToString(Math.round(Number(v))) },
            },
        },
    };

    return (
        <div className="w-full font-sans select-none space-y-4">
            {/* Top Toolbar Strip */}
            <div className="bg-[#000000] border border-[#1F1F1F] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="font-serif text-base font-normal text-[#FFFFFF] m-0 tracking-tight">
                        Performance Telemetry
                    </h2>

                    {/* Live Status Badge */}
                    <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
                            isPaused
                                ? 'bg-[#1C1405] text-[#F59E0B] border-[#F59E0B]/40'
                                : 'bg-[#051F14] text-[#10B981] border-[#10B981]/40'
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-[#F59E0B]' : 'bg-[#10B981] animate-pulse'}`} />
                        <span>{isPaused ? 'STREAM PAUSED' : 'LIVE 1s'}</span>
                    </div>

                    {/* Pause / Resume Button */}
                    <button
                        type="button"
                        onClick={() => setIsPaused(!isPaused)}
                        className="px-2.5 py-1 rounded-md bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] text-[11px] font-mono text-[#A0A0A0] hover:text-[#FFFFFF] transition-colors cursor-pointer flex items-center gap-1.5"
                        title={isPaused ? 'Resume live chart stream' : 'Pause stream to freeze and inspect history'}
                    >
                        {isPaused ? (
                            <>
                                <svg className="w-3 h-3 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
                                    <polygon points="5 3 19 10 5 17 5 3" />
                                </svg>
                                <span>Resume</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-3 h-3 text-[#F59E0B]" fill="currentColor" viewBox="0 0 20 20">
                                    <rect x="5" y="4" width="3" height="12" />
                                    <rect x="12" y="4" width="3" height="12" />
                                </svg>
                                <span>Pause</span>
                            </>
                        )}
                    </button>

                    {/* Clear / Reset Buffer */}
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-2.5 py-1 rounded-md bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] text-[11px] font-mono text-[#A0A0A0] hover:text-[#FFFFFF] transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Clear historical buffer"
                    >
                        <svg className="w-3 h-3 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Reset</span>
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {/* Time Window Selector */}
                    <div className="flex items-center bg-[#0A0A0A] border border-[#1F1F1F] rounded-md p-1 text-xs gap-1">
                        {([30, 60, 120, 300] as const).map((secs) => (
                            <button
                                key={secs}
                                type="button"
                                onClick={() => setTimeWindow(secs)}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer border-none ${
                                    timeWindow === secs
                                        ? 'bg-[#FFFFFF] text-[#000000] font-semibold shadow-sm'
                                        : 'bg-transparent text-[#737373] hover:text-[#FFFFFF]'
                                }`}
                            >
                                {secs < 60 ? `${secs}s` : `${secs / 60}m`}
                            </button>
                        ))}
                    </div>

                    {/* View Mode Toggle: Grid vs Master */}
                    <div className="flex items-center bg-[#0A0A0A] border border-[#1F1F1F] rounded-md p-1 text-xs gap-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border-none flex items-center gap-1.5 ${
                                viewMode === 'grid'
                                    ? 'bg-[#FFFFFF] text-[#000000] font-semibold shadow-sm'
                                    : 'bg-transparent text-[#737373] hover:text-[#FFFFFF]'
                            }`}
                            title="3-Card Telemetry Grid"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            <span>Grid</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('master')}
                            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border-none flex items-center gap-1.5 ${
                                viewMode === 'master'
                                    ? 'bg-[#FFFFFF] text-[#000000] font-semibold shadow-sm'
                                    : 'bg-transparent text-[#737373] hover:text-[#FFFFFF]'
                            }`}
                            title="Unified Master Timeline"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                            <span>Timeline</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* View Mode A: 3-Column Modern Telemetry Grid */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* 1. CPU LOAD CARD */}
                    <div className="bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] rounded-lg p-5 flex flex-col justify-between transition-all duration-150">
                        <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        CPU Core Load
                                    </span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-2xl font-mono font-medium text-[#FFFFFF]">
                                            {currentCpu}%
                                        </span>
                                        <span className="text-xs font-mono text-[#737373]">
                                            / {limits.cpu > 0 ? `${limits.cpu}%` : 'Unlimited'}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setFocusedMetric('cpu')}
                                    className="text-[#737373] hover:text-[#FFFFFF] bg-transparent border-none p-1 cursor-pointer transition-colors"
                                    title="Expand CPU Load"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                </button>
                            </div>

                            {/* Stat Badges */}
                            <div className="flex items-center gap-2 text-[10px] font-mono text-[#737373] mb-3">
                                <span>MIN: <strong className="text-[#A0A0A0]">{cpuStats.min}%</strong></span>
                                <span>&bull;</span>
                                <span>AVG: <strong className="text-[#A0A0A0]">{cpuStats.avg}%</strong></span>
                                <span>&bull;</span>
                                <span>PEAK: <strong className="text-[#10B981]">{cpuStats.max}%</strong></span>
                            </div>
                        </div>

                        {/* Line Chart */}
                        <div className="h-28 w-full">
                            <Line data={cpuChartData} options={cpuChartOptions} />
                        </div>
                    </div>

                    {/* 2. MEMORY UTILIZATION CARD */}
                    <div className="bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] rounded-lg p-5 flex flex-col justify-between transition-all duration-150">
                        <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Memory Utilization
                                    </span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-2xl font-mono font-medium text-[#FFFFFF]">
                                            {currentMem} <span className="text-xs font-normal text-[#737373]">MiB</span>
                                        </span>
                                        <span className="text-xs font-mono text-[#737373]">
                                            / {limits.memory > 0 ? `${limits.memory} MiB` : 'Unlimited'}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setFocusedMetric('memory')}
                                    className="text-[#737373] hover:text-[#FFFFFF] bg-transparent border-none p-1 cursor-pointer transition-colors"
                                    title="Expand Memory Utilization"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                </button>
                            </div>

                            {/* Stat Badges */}
                            <div className="flex items-center gap-2 text-[10px] font-mono text-[#737373] mb-3">
                                <span>MIN: <strong className="text-[#A0A0A0]">{memStats.min} MiB</strong></span>
                                <span>&bull;</span>
                                <span>AVG: <strong className="text-[#A0A0A0]">{memStats.avg} MiB</strong></span>
                                <span>&bull;</span>
                                <span>PEAK: <strong className="text-[#06B6D4]">{memStats.max} MiB</strong></span>
                            </div>
                        </div>

                        {/* Line Chart */}
                        <div className="h-28 w-full">
                            <Line data={memChartData} options={memChartOptions} />
                        </div>
                    </div>

                    {/* 3. NETWORK I/O CARD */}
                    <div className="bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] rounded-lg p-5 flex flex-col justify-between transition-all duration-150">
                        <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                    <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                                        Network Throughput
                                    </span>
                                    <div className="flex items-baseline gap-3 mt-1">
                                        <span className="text-base font-mono text-[#F59E0B] font-medium">
                                            ↓ {bytesToString(currentRx)}/s
                                        </span>
                                        <span className="text-base font-mono text-[#8B5CF6] font-medium">
                                            ↑ {bytesToString(currentTx)}/s
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setFocusedMetric('network')}
                                    className="text-[#737373] hover:text-[#FFFFFF] bg-transparent border-none p-1 cursor-pointer transition-colors"
                                    title="Expand Network Throughput"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                </button>
                            </div>

                            {/* Stat Badges */}
                            <div className="flex items-center gap-2 text-[10px] font-mono text-[#737373] mb-3">
                                <span>TOTAL IN: <strong className="text-[#A0A0A0]">{bytesToString(totalRx)}</strong></span>
                                <span>&bull;</span>
                                <span>TOTAL OUT: <strong className="text-[#A0A0A0]">{bytesToString(totalTx)}</strong></span>
                            </div>
                        </div>

                        {/* Line Chart */}
                        <div className="h-28 w-full">
                            <Line data={netChartData} options={netChartOptions} />
                        </div>
                    </div>
                </div>
            ) : (
                /* View Mode B: Unified Master Timeline */
                <div className="bg-[#000000] border border-[#1F1F1F] rounded-lg p-5">
                    {/* Master Series Toggles */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#141414] pb-3 mb-4">
                        <div className="text-xs font-serif text-[#FFFFFF]">Synchronized Master Telemetry</div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowCpu(!showCpu)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                                    showCpu
                                        ? 'bg-[#051F14] text-[#10B981] border-[#10B981]/40'
                                        : 'bg-transparent text-[#737373] border-[#1F1F1F]'
                                }`}
                            >
                                ● CPU (%)
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowMemory(!showMemory)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                                    showMemory
                                        ? 'bg-[#051C24] text-[#06B6D4] border-[#06B6D4]/40'
                                        : 'bg-transparent text-[#737373] border-[#1F1F1F]'
                                }`}
                            >
                                ● Memory (MiB)
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowNetIn(!showNetIn)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                                    showNetIn
                                        ? 'bg-[#1C1405] text-[#F59E0B] border-[#F59E0B]/40'
                                        : 'bg-transparent text-[#737373] border-[#1F1F1F]'
                                }`}
                            >
                                ● Net In (RX)
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowNetOut(!showNetOut)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                                    showNetOut
                                        ? 'bg-[#140D24] text-[#8B5CF6] border-[#8B5CF6]/40'
                                        : 'bg-transparent text-[#737373] border-[#1F1F1F]'
                                }`}
                            >
                                ● Net Out (TX)
                            </button>
                        </div>
                    </div>

                    <div className="h-64 w-full">
                        <Line data={masterChartData} options={masterChartOptions} />
                    </div>
                </div>
            )}

            {/* Focused Metric Modal */}
            {focusedMetric && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg max-w-3xl w-full p-6 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-[#141414] pb-3 mb-4">
                            <div>
                                <h3 className="font-serif text-lg font-normal text-[#FFFFFF] m-0 tracking-tight">
                                    {focusedMetric === 'cpu' && 'CPU Core Load (High Resolution)'}
                                    {focusedMetric === 'memory' && 'Memory Pool (High Resolution)'}
                                    {focusedMetric === 'network' && 'Network Throughput (High Resolution)'}
                                </h3>
                                <p className="text-xs text-[#737373] mt-1 m-0 font-sans">
                                    Live streaming buffer: {timeWindow}s window &bull; 1s polling interval
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setFocusedMetric(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-md bg-[#050505] hover:bg-[#141414] text-[#737373] hover:text-[#FFFFFF] border border-[#1F1F1F] cursor-pointer transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="h-72 w-full mb-4">
                            {focusedMetric === 'cpu' && <Line data={cpuChartData} options={cpuChartOptions} />}
                            {focusedMetric === 'memory' && <Line data={memChartData} options={memChartOptions} />}
                            {focusedMetric === 'network' && <Line data={netChartData} options={netChartOptions} />}
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setFocusedMetric(null)}
                                className="px-4 py-2 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] font-semibold text-xs transition-colors cursor-pointer border-none shadow-sm"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
