import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiClient } from '../services/apiClient';

interface TelemetryRow {
  time: string;
  cpu: number;
  peakCpu: number;
  ramPct: number;
  netInMbps: number;
  netOutMbps: number;
  diskReadMBps: number;
  diskWriteMBps: number;
}

export const TelemetryChart: React.FC = () => {
  const [chartData, setChartData] = useState<TelemetryRow[]>([]);
  const [reportHours, setReportHours] = useState<number>(24);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<{
    avgCpuPct: number;
    peakCpuPct: number;
    avgRamGb: number;
    totalNetInGb: number;
    totalNetOutGb: number;
    activeVms: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  const loadTelemetry = useCallback(async () => {
    try {
      const raw: any = await apiClient.getTelemetryHistory();
      const live: TelemetryRow[] = (raw?.data || []).map((row: any) => ({
        time: new Date(row.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cpu: Number(row.cpu),
        peakCpu: Number(row.peakCpu),
        ramPct: Number(row.ramPct),
        netInMbps: Number(row.netInMbps),
        netOutMbps: Number(row.netOutMbps),
        diskReadMBps: Number(row.diskReadMBps),
        diskWriteMBps: Number(row.diskWriteMBps),
      }));
      setChartData(live);
      setHasData((raw?.data || []).length > 0);
      if (raw?.summary) setSummary(raw.summary);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTelemetry();
    const interval = setInterval(loadTelemetry, 10000);
    return () => clearInterval(interval);
  }, [loadTelemetry]);

  if (isLoading) {
    return (
      <div className="w-full h-28 mt-2 flex items-center justify-center text-[11px] text-[#a7aaaa] font-mono">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#1a1a1a] animate-ping" />
          Establishing telemetry link...
        </span>
      </div>
    );
  }

  if (!hasData || chartData.length === 0) {
    return (
      <div className="w-full mt-2 flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => apiClient.downloadTelemetryExport('csv', '24h')}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#dedfdf] bg-white text-[#1a1a1a] rounded hover:bg-[#f1f1f1] transition-colors cursor-pointer whitespace-nowrap"
          >CSV 24h</button>
          <button
            onClick={() => apiClient.downloadTelemetryExport('json', '24h')}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#1a1a1a] bg-[#1a1a1a] text-white rounded hover:bg-[#333] transition-colors cursor-pointer whitespace-nowrap"
          >JSON</button>
        </div>
        <div className="w-full h-28 flex flex-col items-center justify-center gap-2">
          <span className="text-[11px] text-[#a7aaaa] font-mono">Collecting live telemetry samples (polling every 15s)...</span>
          <span className="text-[10px] text-[#656b6b]">Chart will render automatically as PostgreSQL fills the telemetry store.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-2">
      {/* KPI summary strip + export controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 flex-1 gap-px bg-[#dedfdf] border border-[#dedfdf] rounded-md overflow-hidden">
            <KpiCell label="Avg CPU" value={`${summary.avgCpuPct}%`} tone="neutral" />
            <KpiCell label="Peak CPU" value={`${summary.peakCpuPct}%`} tone={summary.peakCpuPct > 80 ? 'danger' : 'neutral'} />
            <KpiCell label="Avg RAM" value={`${summary.avgRamGb} GB`} tone="blue" />
            <KpiCell label="Net In 24h" value={`${summary.totalNetInGb} GB`} tone="green" />
            <KpiCell label="Net Out 24h" value={`${summary.totalNetOutGb} GB`} tone="blue" />
          </div>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => apiClient.downloadTelemetryExport('csv', '1h')}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#dedfdf] bg-white text-[#1a1a1a] rounded hover:bg-[#f1f1f1] transition-colors cursor-pointer whitespace-nowrap"
            title="Export last hour"
          >CSV 1h</button>
          <button
            onClick={() => apiClient.downloadTelemetryExport('csv', '24h')}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#dedfdf] bg-white text-[#1a1a1a] rounded hover:bg-[#f1f1f1] transition-colors cursor-pointer whitespace-nowrap"
            title="Export last 24 hours"
          >CSV 24h</button>
          <button
            onClick={() => apiClient.downloadTelemetryExport('csv', '7d')}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#dedfdf] bg-white text-[#1a1a1a] rounded hover:bg-[#f1f1f1] transition-colors cursor-pointer whitespace-nowrap"
            title="Export last 7 days"
          >CSV 7d</button>
          <button
            onClick={() => apiClient.downloadTelemetryExport('json', '24h')}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#1a1a1a] bg-[#1a1a1a] text-white rounded hover:bg-[#333] transition-colors cursor-pointer whitespace-nowrap"
            title="Export last 24 hours as JSON"
          >JSON</button>
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#dedfdf]">
            <input
              type="range"
              min={1}
              max={720}
              step={1}
              value={reportHours}
              onChange={(e) => setReportHours(parseInt(e.target.value, 10))}
              className="w-20 h-1 accent-[#2563eb]"
              title="Report window in hours (max 1 month)"
            />
            <span className="text-[10px] font-mono text-[#656b6b] w-16 whitespace-nowrap">{reportHours}h = {(reportHours / 24).toFixed(1)}d</span>
            <button
              disabled={isGenerating}
              onClick={async () => {
                setIsGenerating(true);
                try {
                  await apiClient.downloadTelemetryReport(reportHours);
                } finally {
                  setIsGenerating(false);
                }
              }}
              className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-[#10b981] bg-[#10b981] text-white rounded hover:bg-[#059669] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              title={`Generate a detailed PDF report covering the last ${reportHours} hours (up to 1 month)`}
            >{isGenerating ? 'Generating...' : 'PDF Report'}</button>
          </div>
        </div>
      </div>

      <div className="w-full h-40 mt-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={160}>
          <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1a1a1a" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#1a1a1a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="netInGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="netOutGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dedfdf', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
              formatter={(value: any, name: string) => [
                `${value}${name === 'netInMbps' || name === 'netOutMbps' ? ' Mbps' : '%'}`,
                name === 'cpu' ? 'CPU' : name === 'ramPct' ? 'RAM' : name === 'netInMbps' ? 'Network In' : 'Network Out',
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} iconSize={8} />
            <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#1a1a1a" strokeWidth={1.5} fillOpacity={1} fill="url(#cpuGradient)" dot={false} />
            <Area type="monotone" dataKey="ramPct" name="RAM %" stroke="#2563eb" strokeWidth={1.5} fillOpacity={1} fill="url(#ramGradient)" dot={false} />
            <Area type="monotone" dataKey="netInMbps" name="Net In Mbps" stroke="#10b981" strokeWidth={1.25} fillOpacity={1} fill="url(#netInGradient)" dot={false} />
            <Area type="monotone" dataKey="netOutMbps" name="Net Out Mbps" stroke="#f59e0b" strokeWidth={1.25} fillOpacity={1} fill="url(#netOutGradient)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

function KpiCell({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'blue' | 'green' | 'danger' }) {
  const accent =
    tone === 'danger' ? 'text-[#dc2626]' : tone === 'blue' ? 'text-[#2563eb]' : tone === 'green' ? 'text-[#16a34a]' : 'text-[#1a1a1a]';
  return (
    <div className="bg-white px-3 py-2.5 flex flex-col justify-center">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#656b6b]">{label}</span>
      <span className={`text-sm font-semibold font-mono tracking-tight mt-0.5 ${accent}`}>{value}</span>
    </div>
  );
}
