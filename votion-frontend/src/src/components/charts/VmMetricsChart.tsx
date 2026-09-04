import React, { useEffect, useState, useRef } from 'react';
import { Title, AreaChart, DonutChart, ProgressBar, Grid, Metric, Text, Flex, CustomTooltipProps } from '@tremor/react';
import { API_ORIGIN, apiClient } from '../../services/apiClient';

interface VmMetricsChartProps {
  vmid: number;
  proxmoxConnectionId?: string | null;
}

interface LiveTelemetry {
  timestamp: string;
  cpu: number;
  cpus: number;
  mem: number;
  maxmem: number;
  netin: number;
  netout: number;
  diskread: number;
  diskwrite: number;
  uptime: number;
}

function TrendTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="telemetry-tooltip" role="status">
      <div className="telemetry-tooltip-time">{label}</div>
      <div className="telemetry-tooltip-values">
        {payload.map((entry) => (
          <div className="telemetry-tooltip-row" key={entry.name}>
            <span className="telemetry-tooltip-label">
              <i className="telemetry-tooltip-dot" style={{ backgroundColor: entry.color || '#71717a' }} />
              {entry.name}
            </span>
            <strong>{Array.isArray(entry.value) ? entry.value.join(', ') : entry.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VmMetricsChart({ vmid, proxmoxConnectionId }: VmMetricsChartProps) {
  const [dbHistory, setDbHistory] = useState<any[]>([]);
  const [aggregations, setAggregations] = useState<any>(null);
  const [currentLive, setCurrentLive] = useState<LiveTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'empty' | 'unavailable'>('loading');

  const [liveData, setLiveData] = useState<any[]>([]);
  const [chartMode, setChartMode] = useState<'live' | '24h'>('live');


    const lastChangeRef = useRef({
    netin: { val: -1, time: 0 },
    netout: { val: -1, time: 0 },
    diskread: { val: -1, time: 0 },
    diskwrite: { val: -1, time: 0 }
  });
  
  const currentSpeedsRef = useRef({
    netInMbps: 0,
    netOutMbps: 0,
    diskReadMBps: 0,
    diskWriteMBps: 0
  });

  const [speeds, setSpeeds] = useState<{ netInMbps: number; netOutMbps: number; diskReadMBps: number; diskWriteMBps: number }>({
    netInMbps: 0,
    netOutMbps: 0,
    diskReadMBps: 0,
    diskWriteMBps: 0
  });

  const fetchAggregations = async () => {
    try {
      const json = await apiClient.getVMMetrics(vmid, proxmoxConnectionId);
      const history = Array.isArray(json.history) ? json.history : Array.isArray(json.data) ? json.data : [];
      setAggregations(json.aggregations || null);
      setDbHistory(history);
      setHistoryState(history.length > 0 ? 'ready' : 'empty');
    } catch {
      setAggregations(null);
      setDbHistory([]);
      setHistoryState('unavailable');
    }
  };

  const fetchLiveTelemetry = async () => {
    try {
      const json = await apiClient.getVMTelemetry(vmid, proxmoxConnectionId);

      if (json.success && json.telemetry) {
        const current = json.telemetry as LiveTelemetry;
        const now = new Date(current.timestamp).getTime();

                        const lc = lastChangeRef.current;
        const cs = currentSpeedsRef.current;

        const nowMs = Date.now();
        const calcSpeed = (currentVal: number, key: 'netin' | 'netout' | 'diskread' | 'diskwrite', multiplier: number) => {
          // Initialize baseline or handle counter wrap/reboot
          if (lc[key].val === -1 || lc[key].time === 0 || currentVal < lc[key].val) {
            lc[key] = { val: currentVal, time: nowMs };
            return 0;
          }
          // Zero delta means no traffic in this interval
          if (currentVal === lc[key].val) {
            lc[key].time = nowMs;
            return 0;
          }
          // Calculate rate when positive delta exists
          const timeDiffSec = (nowMs - lc[key].time) / 1000;
          if (timeDiffSec < 0.25) {
            return cs[key === 'netin' ? 'netInMbps' : key === 'netout' ? 'netOutMbps' : key === 'diskread' ? 'diskReadMBps' : 'diskWriteMBps'];
          }
          if (timeDiffSec > 30) {
            lc[key] = { val: currentVal, time: nowMs };
            return 0;
          }
          const delta = currentVal - lc[key].val;
          const speed = (delta * multiplier) / timeDiffSec;
          lc[key] = { val: currentVal, time: nowMs };
          return Math.max(0, speed);
        };

        const newNetIn = calcSpeed(current.netin, 'netin', 8 / 1000000);
        if (newNetIn !== null) cs.netInMbps = newNetIn;

        const newNetOut = calcSpeed(current.netout, 'netout', 8 / 1000000);
        if (newNetOut !== null) cs.netOutMbps = newNetOut;

        const newDiskRead = calcSpeed(current.diskread, 'diskread', 1 / 1048576);
        if (newDiskRead !== null) cs.diskReadMBps = newDiskRead;

        const newDiskWrite = calcSpeed(current.diskwrite, 'diskwrite', 1 / 1048576);
        if (newDiskWrite !== null) cs.diskWriteMBps = newDiskWrite;

        const newSpeeds = { ...cs };
        setSpeeds(newSpeeds);

        setLiveData(prev => {
          const newPoint = {
            time: new Date(current.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            'CPU (%)': Number((current.cpu * 100).toFixed(1)),
            'Net In (Mbps)': Number(newSpeeds.netInMbps.toFixed(2)),
            'Net Out (Mbps)': Number(newSpeeds.netOutMbps.toFixed(2)),
            'Disk R (MB/s)': Number(newSpeeds.diskReadMBps.toFixed(2)),
            'Disk W (MB/s)': Number(newSpeeds.diskWriteMBps.toFixed(2)),
          };
          const next = [...prev, newPoint];
          if (next.length > 60) return next.slice(next.length - 60);
          return next;
        });

        setCurrentLive(current);
        setIsLoading(false);
      } else {
        throw new Error('Telemetry not available');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Error fetching telemetry');
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    setCurrentLive(null);
    setLiveData([]);
    setDbHistory([]);
    setHistoryState('loading');
    setAggregations(null);
        lastChangeRef.current = {
      netin: { val: -1, time: 0 },
      netout: { val: -1, time: 0 },
      diskread: { val: -1, time: 0 },
      diskwrite: { val: -1, time: 0 }
    };
    currentSpeedsRef.current = { netInMbps: 0, netOutMbps: 0, diskReadMBps: 0, diskWriteMBps: 0 };
    
    fetchAggregations();
    fetchLiveTelemetry();

    const liveInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchLiveTelemetry();
    }, 1000);
    const aggInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchAggregations();
    }, 15000); // Refresh history DB every 15s

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchLiveTelemetry();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(liveInterval);
      clearInterval(aggInterval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [vmid, proxmoxConnectionId]);

  if (isLoading && !currentLive) {
    return (
      <div className="mt-6 border-t border-[#e0e1e1] pt-12 h-[300px] flex items-center justify-center">
        <span className="text-[#1a1a1a] font-mono text-[11px] uppercase tracking-widest flex items-center gap-3">
          <span className="w-1.5 h-1.5 bg-[#1a1a1a] animate-ping"></span>
          Establishing Telemetry Link...
        </span>
      </div>
    );
  }

  if (!currentLive) {
    return (
      <div className="mt-6 border-t border-[#e0e1e1] pt-10 pb-6 flex flex-col items-center justify-center text-center">
        <div className="text-sm font-semibold text-[#1a1a1a]">Telemetry unavailable</div>
        <div className="mt-1 max-w-md text-xs text-[#656b6b]">{loadError || 'No live telemetry was returned for this instance.'}</div>
        <button
          type="button"
          onClick={() => { setIsLoading(true); setLoadError(null); fetchLiveTelemetry(); fetchAggregations(); }}
          className="mt-4 border border-[#1a1a1a] px-3 py-1.5 text-[11px] font-semibold text-[#1a1a1a] hover:bg-[#f1f1f1] transition-colors"
        >
          Retry telemetry
        </button>
      </div>
    );
  }

  // Bucketed history rows include counter deltas and the measured interval used to calculate rates.
  const chartData = (dbHistory || []).map((d) => {
    const intervalSeconds = Number(d.sampleIntervalSeconds);
    const hasMeasuredInterval = Number.isFinite(intervalSeconds) && intervalSeconds > 0;
    const toRate = (bytes: unknown, multiplier: number) => hasMeasuredInterval
      ? Number(((Number(bytes) || 0) * multiplier / intervalSeconds).toFixed(2))
      : null;

    return {
      time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'CPU (%)': Number(d.cpuPct),
      'Net In (Mbps)': toRate(d.netInBytes, 8 / 1000000),
      'Net Out (Mbps)': toRate(d.netOutBytes, 8 / 1000000),
      'Disk R (MB/s)': toRate(d.diskReadBytes, 1 / 1048576),
      'Disk W (MB/s)': toRate(d.diskWriteBytes, 1 / 1048576),
    };
  });

  const memUsedGb = currentLive.mem / 1073741824;
  const memTotalGb = currentLive.maxmem / 1073741824;
  const memFreeGb = memTotalGb - memUsedGb;

    const totalBandwidthGb = (currentLive.netin + currentLive.netout) / 1073741824;
  const transferTotalBytes = Math.max(0, currentLive.netin) + Math.max(0, currentLive.netout);
  const inboundTransferPct = transferTotalBytes > 0 ? (Math.max(0, currentLive.netin) / transferTotalBytes) * 100 : 0;
  const outboundTransferPct = transferTotalBytes > 0 ? (Math.max(0, currentLive.netout) / transferTotalBytes) * 100 : 0;

  const cpuPct = currentLive.cpu * 100;

  const memPct = memTotalGb > 0 ? (memUsedGb / memTotalGb) * 100 : 0;

  const agg = aggregations || {};
  const cpuDelta = agg.cpu?.deltaPct;
  const memDelta = agg.mem?.deltaPct;
  const netInDelta = agg.netIn?.deltaPct;

  const activeChartData = chartMode === 'live' ? liveData : chartData;
  const isChartReady = chartMode === 'live' ? liveData.length > 0 : historyState === 'ready';
  const timeLabel = chartMode === 'live' ? 'LIVE (60s)' : '24H';


  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* TAILWIND JIT TRIGGER - Forces Vite/Tailwind to compile Tremor colors without a server restart */}
      <div className="hidden bg-zinc-500 text-zinc-500 fill-zinc-500 stroke-zinc-500 bg-stone-500 text-stone-500 fill-stone-500 stroke-stone-500 bg-neutral-500 text-neutral-500 fill-neutral-500 stroke-neutral-500 bg-red-500 text-red-500 fill-red-500 stroke-red-500 bg-yellow-500 text-yellow-500 fill-yellow-500 stroke-yellow-500 bg-emerald-500 text-emerald-500 fill-emerald-500 stroke-emerald-500 bg-blue-500 text-blue-500 fill-blue-500 stroke-blue-500 bg-slate-500 text-slate-500 fill-slate-500 stroke-slate-500 text-zinc-100 text-zinc-200 text-zinc-300 text-stone-100 text-stone-200 text-stone-300 fill-zinc-100 fill-zinc-200 fill-zinc-300 fill-stone-100 fill-stone-200 fill-stone-300 fill-slate-100 fill-slate-200 fill-slate-300 text-slate-100 text-slate-200 text-slate-300"></div>

      {/* LIVE RESOURCE USAGE BARS */}
      <div className="vm-usage-grid border border-[#2b2b2b] p-4 rounded bg-[#111111] grid grid-cols-2 gap-8 text-[#fff] shadow-inner -mt-4 mb-2">
        {/* CPU */}
        <div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1.5">
            <span className="text-[#888]">CPU ({currentLive.cpus} Cores)</span>
            <span className="text-[#e2e2e2] font-mono">{cpuPct.toFixed(1)}%</span>
          </div>
          <div className="h-[2px] w-full bg-[#333]">
            <div className={`h-full transition-all duration-500 ${cpuPct > 85 ? 'bg-[#ef4444]' : 'bg-[#fff]'}`} style={{ width: `${Math.min(cpuPct, 100)}%` }}></div>
          </div>
        </div>
        {/* RAM */}
        <div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1.5">
            <span className="text-[#888]">RAM ({memTotalGb.toFixed(1)} GB)</span>
            <span className="text-[#e2e2e2] font-mono">
              {memUsedGb.toFixed(1)} GB
            </span>
          </div>
          <div className="h-[2px] w-full bg-[#333]">
            <div className={`h-full transition-all duration-500 ${memPct > 85 ? 'bg-[#ef4444]' : 'bg-[#fff]'}`} style={{ width: `${Math.min(memPct, 100)}%` }}></div>
          </div>
        </div>
      </div>

      
      <div className="flex items-end justify-between gap-2 border-b border-[#1a1a1a] pb-2">
        <div className="flex items-center gap-4">
          <h3 className="text-[#1a1a1a] font-bold text-sm tracking-wide uppercase">Guest VM Telemetry</h3>
          <div className="flex items-center rounded overflow-hidden border border-[#dedfdf] text-[10px] font-bold uppercase tracking-widest bg-[#f8f9fa]">
            <button 
              onClick={() => setChartMode('live')} 
              className={`px-3 py-1 transition-colors ${chartMode === 'live' ? 'bg-[#1a1a1a] text-white' : 'text-[#656b6b] hover:text-[#1a1a1a]'}`}
            >
              Live
            </button>
            <button 
              onClick={() => setChartMode('24h')} 
              className={`px-3 py-1 transition-colors ${chartMode === '24h' ? 'bg-[#1a1a1a] text-white' : 'text-[#656b6b] hover:text-[#1a1a1a]'}`}
            >
              24H History
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => apiClient.downloadVmTelemetryExport(vmid, 'csv', '1h')}
              className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#dedfdf] bg-white text-[#1a1a1a] rounded hover:bg-[#f1f1f1] transition-colors cursor-pointer whitespace-nowrap"
              title="Export last hour"
            >CSV 1h</button>
            <button
              onClick={() => apiClient.downloadVmTelemetryExport(vmid, 'csv', '24h')}
              className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#dedfdf] bg-white text-[#1a1a1a] rounded hover:bg-[#f1f1f1] transition-colors cursor-pointer whitespace-nowrap"
              title="Export last 24 hours"
            >CSV 24h</button>
            <button
              onClick={() => apiClient.downloadVmTelemetryExport(vmid, 'csv', '7d')}
              className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#dedfdf] bg-white text-[#1a1a1a] rounded hover:bg-[#f1f1f1] transition-colors cursor-pointer whitespace-nowrap"
              title="Export last 7 days"
            >CSV 7d</button>
            <button
              onClick={() => apiClient.downloadVmTelemetryExport(vmid, 'json', '24h')}
              className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#1a1a1a] bg-[#1a1a1a] text-white rounded hover:bg-[#333] transition-colors cursor-pointer whitespace-nowrap"
              title="Export last 24 hours as JSON"
            >JSON</button>
            <button
              onClick={() => {
                const token = localStorage.getItem('votion_jwt_token');
                const query = new URLSearchParams({ hours: '24', vmid: String(vmid) });
                if (token) query.set('token', token);
                window.open(`${API_ORIGIN}/api/v1/telemetry/report?${query.toString()}`, '_blank');
              }}
              className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#10b981] bg-[#10b981] text-white rounded hover:bg-[#059669] transition-colors cursor-pointer whitespace-nowrap"
              title="Generate a detailed PDF report — this VM is featured in its own section"
            >PDF Report</button>
          </div>
          <div className="flex items-center gap-2 text-[#1a1a1a] text-[10px] uppercase tracking-widest font-bold">
            <span className="w-1.5 h-1.5 bg-[#ef4444] animate-pulse"></span>
            <span className="hidden sm:inline">Live</span>
          </div>
        </div>
      </div>

      <Grid numItemsSm={2} numItemsMd={2} numItemsLg={4} className="gap-4 sm:gap-6 border-b border-[#f0f0f0] pb-6">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#888] font-bold text-[10px] uppercase tracking-widest">CPU Compute</span>
            {typeof cpuDelta === 'number' && (
              <span className={`text-[10px] font-mono font-bold ${cpuDelta > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>{cpuDelta > 0 ? '↑' : '↓'} {Math.abs(cpuDelta).toFixed(1)}%</span>
            )}
          </div>
          <span className="text-2xl font-bold text-[#1a1a1a] tracking-tight">{cpuPct.toFixed(1)}%</span>
          {(typeof agg.cpu?.average === 'number' || typeof agg.cpu?.peak === 'number') && (
            <div className="flex items-center gap-3 mt-2 text-[10px] font-bold font-mono uppercase tracking-widest text-[#888]">
              <span>AVG {Number(agg.cpu?.average ?? 0).toFixed(1)}%</span>
              <span>PEAK {Number(agg.cpu?.peak ?? 0).toFixed(1)}%</span>
            </div>
          )}
          <div className="h-[2px] w-full bg-[#f0f0f0] mt-3">
            <div className={`h-full transition-all duration-500 ${cpuPct > 80 ? 'bg-[#ef4444]' : 'bg-[#1a1a1a]'}`} style={{ width: `${Math.min(cpuPct, 100)}%` }}></div>
          </div>
        </div>

        <div className="flex flex-col border-l border-[#f0f0f0] pl-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#888] font-bold text-[10px] uppercase tracking-widest">Memory Usage</span>
            {typeof memDelta === 'number' && (
              <span className={`text-[10px] font-mono font-bold ${memDelta > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>{memDelta > 0 ? '↑' : '↓'} {Math.abs(memDelta).toFixed(1)}%</span>
            )}
          </div>
          <div className="text-2xl font-bold text-[#1a1a1a] tracking-tight">{memUsedGb.toFixed(1)} <span className="text-[12px] font-medium text-[#a0a1a2]">/ {memTotalGb.toFixed(0)} GB</span></div>
          {typeof agg.mem?.peakGb === 'number' && agg.mem.peakGb > 0 && (
            <span className="mt-2 text-[10px] font-bold font-mono uppercase tracking-widest text-[#888]">PEAK {agg.mem.peakGb.toFixed(1)} GB</span>
          )}
          <div className="h-[2px] w-full bg-[#f0f0f0] mt-3">
            <div className={`h-full transition-all duration-500 ${memPct > 80 ? 'bg-[#ef4444]' : 'bg-[#1a1a1a]'}`} style={{ width: `${Math.min(memPct, 100)}%` }}></div>
          </div>
        </div>

        <div className="flex flex-col border-l border-[#f0f0f0] pl-6 relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#888] font-bold text-[10px] uppercase tracking-widest">Network I/O</span>
            {typeof netInDelta === 'number' && (
              <span className={`text-[10px] font-mono font-bold ${netInDelta > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>{netInDelta > 0 ? '↑' : '↓'} {Math.abs(netInDelta).toFixed(1)}%</span>
            )}
          </div>
          <div className="text-2xl font-bold text-[#1a1a1a] tracking-tight">{Math.max(speeds.netInMbps, speeds.netOutMbps).toFixed(1)} <span className="text-[12px] font-medium text-[#a0a1a2]">Mbps</span></div>
          <div className="flex items-center gap-3 mt-3 text-[10px] font-bold font-mono uppercase tracking-widest text-[#888]">
            <span>↓ {speeds.netInMbps.toFixed(1)} IN</span>
            <span>↑ {speeds.netOutMbps.toFixed(1)} OUT</span>
          </div>
        </div>

        <div className="flex flex-col border-l border-[#f0f0f0] pl-6">
          <span className="text-[#888] font-bold text-[10px] uppercase tracking-widest mb-1">Disk I/O</span>
          <div className="text-2xl font-bold text-[#1a1a1a] tracking-tight">{Math.max(speeds.diskReadMBps, speeds.diskWriteMBps).toFixed(1)} <span className="text-[12px] font-medium text-[#a0a1a2]">MB/s</span></div>
          <div className="flex items-center gap-3 mt-3 text-[10px] font-bold font-mono uppercase tracking-widest text-[#888]">
            <span>R {speeds.diskReadMBps.toFixed(1)} MB/s</span>
            <span>W {speeds.diskWriteMBps.toFixed(1)} MB/s</span>
          </div>
        </div>
      </Grid>

      {/* 24h transfer summary strip */}
      {(agg.netIn?.totalGb > 0 || agg.netOut?.totalGb > 0 || agg.diskRead?.totalGb > 0 || agg.diskWrite?.totalGb > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#dedfdf] border border-[#dedfdf] rounded-md overflow-hidden">
          <SummaryCell label="24h Inbound" value={`${Number(agg.netIn?.totalGb || 0).toFixed(2)} GB`} tone="green" />
          <SummaryCell label="24h Outbound" value={`${Number(agg.netOut?.totalGb || 0).toFixed(2)} GB`} tone="blue" />
          <SummaryCell label="24h Disk Read" value={`${Number(agg.diskRead?.totalGb || 0).toFixed(2)} GB`} tone="neutral" />
          <SummaryCell label="24h Disk Write" value={`${Number(agg.diskWrite?.totalGb || 0).toFixed(2)} GB`} tone="neutral" />
        </div>
      )}

      <Grid numItemsSm={1} numItemsMd={2} numItemsLg={4} className="gap-6 sm:gap-8 pb-6 border-b border-[#f0f0f0]">
        <div className="telemetry-memory-distribution col-span-1 flex flex-col justify-center">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] mb-6">Memory Distribution</h4>
          <div className="flex-1 flex flex-col items-center justify-center">
            <DonutChart
              data={[
                { name: 'Used RAM', value: Number(memUsedGb.toFixed(2)) },
                { name: 'Free RAM', value: Number(memFreeGb.toFixed(2)) }
              ]}
              category="value"
              index="name"
              colors={['blue', 'slate']}
              valueFormatter={(val) => Number(val).toFixed(1) + ' GB'}
              showTooltip={false}
              className="h-32"
            />
            <div className="telemetry-memory-legend" aria-label="Memory distribution values">
              <div className="telemetry-memory-legend-item">
                <span className="telemetry-memory-legend-label">
                  <i className="telemetry-memory-legend-swatch telemetry-memory-legend-used" />
                  Used RAM
                </span>
                <strong>{memUsedGb.toFixed(1)} GB</strong>
              </div>
              <div className="telemetry-memory-legend-item">
                <span className="telemetry-memory-legend-label">
                  <i className="telemetry-memory-legend-swatch telemetry-memory-legend-free" />
                  Free RAM
                </span>
                <strong>{Math.max(memFreeGb, 0).toFixed(1)} GB</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="telemetry-trends-span col-span-1 md:col-span-2">
          <div className="telemetry-trend-grid">
            <div className="telemetry-chart-card">
              <div className="telemetry-chart-heading">
                <h4>Network traffic</h4>
                <span>{timeLabel} · Mbps</span>
              </div>
              <div className="telemetry-chart-legend" aria-label="Network traffic legend">
                <span><i className="telemetry-legend-dot telemetry-legend-net-in" />Net in</span>
                <span><i className="telemetry-legend-dot telemetry-legend-net-out" />Net out</span>
              </div>
                            {isChartReady ? <AreaChart
                className="telemetry-trend-area-chart"
                data={activeChartData}
                showXAxis={chartMode === '24h'}
                index="time"
                categories={['Net In (Mbps)', 'Net Out (Mbps)']}
                colors={['emerald', 'blue']}
                valueFormatter={(number) => number.toFixed(1) + ' Mbps'}
                showAnimation={false}
                showYAxis={false}
                showLegend={false}
                showGridLines={true}
                customTooltip={TrendTooltip}
              /> : <HistoricalTelemetryState state={historyState} />}

            </div>

            <div className="telemetry-chart-card">
              <div className="telemetry-chart-heading">
                <h4>Disk I/O rates</h4>
                <span>{timeLabel} · MB/s</span>
              </div>
              <div className="telemetry-chart-legend" aria-label="Disk I/O legend">
                <span><i className="telemetry-legend-dot telemetry-legend-disk-read" />Disk read</span>
                <span><i className="telemetry-legend-dot telemetry-legend-disk-write" />Disk write</span>
              </div>
                            {isChartReady ? <AreaChart
                className="telemetry-trend-area-chart"
                data={activeChartData}
                showXAxis={chartMode === '24h'}
                index="time"
                categories={['Disk R (MB/s)', 'Disk W (MB/s)']}
                colors={['yellow', 'zinc']}
                valueFormatter={(number) => number.toFixed(1) + ' MB/s'}
                showAnimation={false}
                showLegend={false}
                showGridLines={true}
                customTooltip={TrendTooltip}
                yAxisWidth={76}
              /> : <HistoricalTelemetryState state={historyState} />}

            </div>
          </div>
        </div>

        <div className="col-span-1 flex flex-col justify-center pl-4 border-l border-[#f0f0f0] max-md:border-l-0 max-md:pl-0">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] mb-4">Total Bandwidth Transfer</h4>

          <div className="flex flex-col gap-5">
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#888] mb-1">
                <span className="uppercase tracking-widest">Total Inbound</span>
                <span className="text-[#1a1a1a] font-mono">{(currentLive.netin / 1073741824).toFixed(2)} GB</span>
              </div>
              <div className="h-[2px] w-full bg-[#f0f0f0]">
                                <div className="h-full bg-[#10b981] transition-[width] duration-300" style={{ width: `${inboundTransferPct}%` }}></div>

              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#888] mb-1">
                <span className="uppercase tracking-widest">Total Outbound</span>
                <span className="text-[#1a1a1a] font-mono">{(currentLive.netout / 1073741824).toFixed(2)} GB</span>
              </div>
              <div className="h-[2px] w-full bg-[#f0f0f0]">
                                <div className="h-full bg-[#3b82f6] transition-[width] duration-300" style={{ width: `${outboundTransferPct}%` }}></div>

              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tighter text-[#1a1a1a]">{totalBandwidthGb.toFixed(2)}</span>
              <span className="text-[#888] text-[10px] font-bold uppercase tracking-widest">GB Total Volume</span>
            </div>
          </div>
        </div>
      </Grid>

            <div className="telemetry-cpu-history flex flex-col mb-4">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] mb-2">CPU Compute {timeLabel === '24H' ? 'History (24h)' : 'Live'}</h4>
        {isChartReady ? <AreaChart
          className="h-48 mt-4"
          data={activeChartData}
          showXAxis={chartMode === '24h'}
          index="time"
          categories={['CPU (%)']}
          colors={['zinc']}
          valueFormatter={(number) => number.toFixed(1) + '%'}
          showAnimation={false}
          showLegend={false}
          yAxisWidth={56}
        /> : <HistoricalTelemetryState state={historyState} className="mt-4 h-48" />}
      </div>

    </div>
  );
}

function HistoricalTelemetryState({ state, className = '' }: { state: 'loading' | 'empty' | 'unavailable' | 'ready'; className?: string }) {
  const message = state === 'loading'
    ? 'Loading recorded telemetry…'
    : state === 'empty'
      ? 'No recorded telemetry samples are available yet.'
      : 'Recorded telemetry is currently unavailable.';

  return <div className={`flex min-h-32 items-center justify-center border border-dashed border-[#dedfdf] px-4 text-center text-[11px] text-[#656b6b] ${className}`}>{message}</div>;
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'green' | 'blue' }) {

  const accent = tone === 'green' ? 'text-[#16a34a]' : tone === 'blue' ? 'text-[#2563eb]' : 'text-[#1a1a1a]';
  return (
    <div className="bg-white px-3 py-2.5 flex flex-col justify-center">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#656b6b]">{label}</span>
      <span className={`text-sm font-semibold font-mono tracking-tight mt-0.5 ${accent}`}>{value}</span>
    </div>
  );
}
