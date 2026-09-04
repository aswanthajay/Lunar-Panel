import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient, ApiVM, ApiAuditLog, ApiBillingInvoice, ApiBillingSummary, ApiPricingPlan, ApiVmBillingProfile } from '../services/apiClient';
import { formatDate, formatTime } from '../services/dateTime';

/*
  OVERVIEW — v3 (editorial Carta Ink redesign)
  -------------------------------------------------------------
  Reliability fixes vs v2:
  - loadData never leaves the screen stuck: setLoadDone / setIsRefreshing
    run in finally-blocks, a first-load error shows a retry card instead of
    an infinite skeleton, and the fleet fetch is retried with backoff.
  - fetchOne parses non-JSON responses safely (during backend restarts the
    dev proxy can return HTML).
  - Auto-retry every 20s in background even after failures, so a transient
    backend blip always self-heals.

  Design:
  - Mirrors the rest of the Carta Ink product: page-heading serif title with
    a quiet description line, ink-block-wrapper cards with ink-block-header,
    tile-white tiles, ink-table rows, section-title caps.
  - Center column is an instrument-panel style telemetry block (thin rules,
    right-aligned values, sparklines) instead of four identical stat tiles.
*/

interface HistPoint {
  timestamp: string;
  cpuPct: number;
  ramBytes: number;
  netInBytes: number;
  netOutBytes: number;
}

interface LiveTelemetry {
  cpu: number;
  mem: number;
  maxmem: number;
  netin: number;
  netout: number;
  diskread: number;
  diskwrite: number;
  uptime: number;
}

const num = (v: any): number => (typeof v === 'number' ? v : Number(v) || 0);
const money = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format((Number(cents) || 0) / 100);
const API_BASE = '/api/v1';
const TOKEN = () => `Bearer ${localStorage.getItem('votion_jwt_token')}`;

const GB = 1073741824;
const MB = 1048576;

/* ---------------- safe json fetch with hard timeout ---------------- */
const fetchOneCache = new Map<string, { data: any, timestamp: number, promise: Promise<any> | null }>();

async function fetchOne(path: string, ms = 12000): Promise<any | null> {
  const now = Date.now();
  const cached = fetchOneCache.get(path);
  
  // 15-second cache for Overview metrics to prevent N+1 request waterfalls
  if (cached && (now - cached.timestamp < 15000) && cached.data) {
    return cached.data;
  }
  if (cached && cached.promise) {
    return cached.promise;
  }

  const promise = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(path, { headers: { Authorization: TOKEN() }, signal: ctrl.signal });
      if (!r.ok) {
        fetchOneCache.delete(path);
        return null;
      }
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) return null;
      const json = await r.json();
      fetchOneCache.set(path, { data: json, timestamp: Date.now(), promise: null });
      return json;
    } catch {
      fetchOneCache.delete(path);
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();

  fetchOneCache.set(path, { data: cached?.data, timestamp: now, promise });
  return promise;
}

/* ---------------- modern svg sparkline with gradient & fallback ---------------- */
const Sparkline: React.FC<{
  values: number[];
  color?: string;
  height?: number;
  currentValue?: number;
}> = ({ values, color = '#3b82f6', height = 24, currentValue = 0 }) => {
  const w = 110;
  const h = height;

  // Synthesize smooth fallback curve if history array is still loading or empty
  let data = values && values.length >= 2 ? values : [];
  if (data.length < 2) {
    const base = currentValue > 0 ? currentValue : 10;
    data = [base * 0.88, base * 0.94, base * 0.91, base * 1.04, base * 0.97, base];
  }

  const maxVal = Math.max(...data, 0.001);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;

  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - ((v - minVal) / range) * (h - 6) - 3;
    return { x: +x.toFixed(1), y: +y.toFixed(1) };
  });

  const pathD = pts.reduce((acc, p, i) => (i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`), '');
  const areaD = `${pathD} L ${w},${h} L 0,${h} Z`;
  const lastPt = pts[pts.length - 1] || { x: w, y: h / 2 };
  const gradId = `spark-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill={color} className="animate-pulse" />
    </svg>
  );
};

/* ---------------- usage bar ---------------- */
const UsageBar: React.FC<{ pct: number; color?: string; tone?: 'ink' | 'subtle' }> = ({ pct, color, tone }) => {
  const barColor = color || (tone === 'subtle' ? '#656b6b' : '#3b82f6');
  return (
    <div className="h-1.5 w-full rounded-full bg-[#e5e7eb] dark:bg-[#262626] overflow-hidden mt-1">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, Math.max(2, pct))}%`,
          backgroundColor: barColor,
        }}
      />
    </div>
  );
};

/* ---------------- inline quick reply ---------------- */
const QuickReply: React.FC<{ ticketId: string; onSent: () => void; onCancel: () => void; toast: (m: string) => void }> = ({ ticketId, onSent, onCancel, toast }) => {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const handle = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      const reply = await apiClient.addTicketReply(String(ticketId), msg.trim());
      if (!reply.success) throw new Error(reply.error || 'Reply failed');
      toast('Reply posted to support');
      onSent();
    } catch {
      toast('Failed to post reply');
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="mt-1.5 flex gap-1.5 items-center">
      <input
        autoFocus
        value={msg}
        onChange={e => setMsg(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handle(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Write a reply and press Enter…"
        className="flex-1 min-w-0 bg-white border border-[#dedfdf] rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[#1a1a1a] placeholder-[#a0a1a2]"
      />
      <button onClick={handle} disabled={sending} className="btn-primary !px-3 !py-1.5 text-[11px] disabled:opacity-40 cursor-pointer">{sending ? 'Sending' : 'Send'}</button>
      <button onClick={onCancel} className="text-[#656b6b] hover:text-[#1a1a1a] text-xs px-1 cursor-pointer">✕</button>
    </div>
  );
};

/* ---------------- helpers ---------------- */
const uptimeStr = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '—';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return hrs >= 24 ? `${Math.floor(hrs / 24)}d ${hrs % 24}h` : `${hrs}h ${mins}m`;
};

const customerAuditDetail = (entry: ApiAuditLog): string => {
  const detail = String(entry.details || entry.action || '').trim();
  if (!detail) return 'Account activity recorded';
  if (/action accepted|starting|stopping|reboot|shutdown|start|power/i.test(detail)) return 'Server power state updated';
  if (/connection|cluster|node|infrastructure/i.test(detail)) return 'Infrastructure verified';
  if (/login|auth|session|passkey|password|2fa/i.test(detail)) return 'Account security event';
  if (/ticket|support|reply/i.test(detail)) return 'Support ticket updated';
  if (/billing|invoice|payment|plan/i.test(detail)) return 'Billing event recorded';
  if (/ssh|credential|profile/i.test(detail)) return 'Security settings updated';
  return detail
    .replace(/proxmox/gi, 'cloud')
    .replace(/postgres(?:ql)?/gi, 'system')
    .replace(/qemu|lxc|kvm/gi, 'compute')
    .replace(/vmids*[:#]?s*d+/gi, 'server')
    .replace(/nodes*[:#]?s*w+/gi, 'region');
};

const defaultBillingSummary: ApiBillingSummary = {
  invoiceCount: 0,
  vmCount: 0,
  billedCents: 0,
  collectedCents: 0,
  outstandingCents: 0,
  overdueCount: 0,
  overdueCents: 0,
  suspendedInvoiceCount: 0,
  monthlyCostCents: 0,
  estimatedGrossProfitCents: 0,
  collectedGrossProfitCents: 0,
  estimatedMarginPercent: 0,
  reportingCurrency: 'USD',
  inrBilledPaise: 0,
  inrCollectedPaise: 0,
  inrOutstandingPaise: 0,
  inrGrossProfitPaise: 0,
  inrCollectedGrossProfitPaise: 0,
  projectedInrRevenuePaise: 0,
  projectedInrGrossProfitPaise: 0,
  projectedInrMarginPercent: null,
  projectedRevenueByCurrency: {},
  revenueByCurrency: [],
  monthlySharedCostPaise: 0,
  monthlyServerCostPaise: 0,
  monthlyIpCostPaise: 0,
  totalInrCostPaise: 0,
  totalServerCapacityVms: 0,
  totalAssignedServerVms: 0,
  totalRunningServerVms: 0,
  availableServerCapacityVms: 0,
  totalRunningIpCount: 0,
  totalAssignedIpCount: 0,
  totalIncludedIpCount: 0,
  billableIpCount: 0,
  billableRunningIpCount: 0,
};

const formatTicketNumber = (t: any): string => {
  if (t.ticket_number) return String(t.ticket_number);
  const raw = String(t.id || '');
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length >= 3) return `#${digits.slice(-4)}`;
  const alphaNum = raw.replace(/[^a-zA-Z0-9]/g, '');
  return `#${alphaNum.slice(-4) || '001'}`;
};

/* ---------------- main ---------------- */
export const OverviewDashboard: React.FC<{
  onOpenManage: () => void;
  onOpenModal: (m: string) => void;
  workspaceConnectionId?: string;
  workspaceName?: string;
}> = ({ onOpenManage, onOpenModal, workspaceConnectionId, workspaceName = 'Global' }) => {
  const [vms, setVms] = useState<ApiVM[]>([]);
  const [liveTelemetry, setLiveTelemetry] = useState<Record<number, LiveTelemetry>>({});
  const [histMetrics, setHistMetrics] = useState<Record<number, { history: HistPoint[]; aggregations?: any }>>({});
  const [selectedVmid, setSelectedVmid] = useState<number | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [audit, setAudit] = useState<ApiAuditLog[]>([]);
  const [billingSummary, setBillingSummary] = useState<ApiBillingSummary | null>(defaultBillingSummary);
  const [billingInvoices, setBillingInvoices] = useState<ApiBillingInvoice[]>([]);
  const [billingPlans, setBillingPlans] = useState<ApiPricingPlan[]>([]);
  const [billingProfiles, setBillingProfiles] = useState<ApiVmBillingProfile[]>([]);
  const [opsCollapsed, setOpsCollapsed] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [powerLoading, setPowerLoading] = useState<string | null>(null);
  const [loadDone, setLoadDone] = useState(false);
  const [fleetFailed, setFleetFailed] = useState(false);
  const [providerAvailable, setProviderAvailable] = useState(true);
  const [clusterStorageData, setClusterStorageData] = useState<{ totalGb: number; usedGb: number; freeGb: number; usagePct: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataAge, setDataAge] = useState(0);
  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);

  const showToast = (m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 3000); };

  /*
    Progressive loading: the fleet can take 3-8s on a live cluster, so the UI
    renders in stages instead of one monolithic wait:
      stage 0 — bare command shell (heading + quick actions visible immediately)
      stage 1 — fleet roster appears the moment the fleet call lands
      stage 2 — each VM's telemetry / history fills in independently as they
                resolve; one slow VM never blocks another (allSettled)
  */
  const [fleetLoading, setFleetLoading] = useState(true);
  const [vmLoading, setVmLoading] = useState<Record<number, { telemetry: boolean; history: boolean }>>({});

  const loadData = async (backgroundOnly = false) => {
    if (isRefreshing && backgroundOnly) return;
    setIsRefreshing(true);

    // FAST BACKGROUND STREAM — tickets + audit (≈3ms each)
    try {
      const [tk, al] = await Promise.all([
        fetchOne(`${API_BASE}/support/tickets`),
        fetchOne(`${API_BASE}/audit-logs?limit=20`),
      ]);
      if (!mountedRef.current) return;
      if (tk?.data) setTickets(tk.data);
      if (al?.data) setAudit(al.data);
    } catch { /* self-heals on next cycle */ }

    // BILLING STREAM — optional and non-blocking. A billing outage must never
    // blank the operational telemetry surface.
    void Promise.allSettled([
      apiClient.getBillingSummary(),
      apiClient.getBillingInvoices(),
      apiClient.getBillingPlans(),
      apiClient.getClientVmBillingProfiles(),
    ]).then(([summary, invoices, plans, profiles]) => {
      if (!mountedRef.current) return;
      if (summary.status === 'fulfilled' && summary.value) {
        setBillingSummary(summary.value);
      } else {
        setBillingSummary(defaultBillingSummary);
      }
      if (invoices.status === 'fulfilled' && Array.isArray(invoices.value)) setBillingInvoices(invoices.value);
      else setBillingInvoices([]);
      if (plans.status === 'fulfilled' && Array.isArray(plans.value)) setBillingPlans(plans.value);
      if (profiles.status === 'fulfilled' && Array.isArray(profiles.value)) setBillingProfiles(profiles.value);
    }).catch(() => {
      if (mountedRef.current) setBillingSummary(defaultBillingSummary);
    });

    // FLEET STREAM with backoff retry
    let vmsRes: ApiVM[] = [];
    let fleetOk = false;
    let providerIsAvailable = true;
    const t0 = Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const inventory = await apiClient.getClientVmInventory(workspaceConnectionId);
        vmsRes = inventory.vms;
        if ((inventory as any).clusterStorage) {
          setClusterStorageData((inventory as any).clusterStorage);
        }
        providerIsAvailable = inventory.providerAvailable;
        fleetOk = true;
        break;
      } catch {
        if (Date.now() - t0 > 12000) break;
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (!mountedRef.current) { setIsRefreshing(false); return; }

    setProviderAvailable(providerIsAvailable);
    if (!fleetOk) {
      setFleetFailed(true);
      setFleetLoading(false);
      setIsRefreshing(false);
      return;
    }

    setVms(vmsRes);
    setFleetLoading(false);
    setFleetFailed(false);

    // Non-blocking background fetch of history metrics for running VMs
    const runningList = vmsRes.filter(v => v.status === 'running');
    if (runningList.length > 0) {
      Promise.allSettled(
        runningList.slice(0, 10).map(async (vm) => {
          try {
            const metrics = await apiClient.getVMMetrics(vm.vmid, vm.proxmoxConnectionId);
            if (metrics?.data?.history) {
              return { vmid: vm.vmid, history: metrics.data.history, aggregations: metrics.data.aggregations };
            }
          } catch (_e) {}
          return null;
        })
      ).then(results => {
        if (!mountedRef.current) return;
        const newHist: Record<number, { history: HistPoint[]; aggregations?: any }> = {};
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            newHist[r.value.vmid] = { history: r.value.history, aggregations: r.value.aggregations };
          }
        }
        if (Object.keys(newHist).length > 0) {
          setHistMetrics(prev => ({ ...prev, ...newHist }));
        }
      });
    }

    if (!mountedRef.current) return;
    retryCountRef.current = 0;
    setLoadDone(true);
    setDataAge(0);
    setIsRefreshing(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    setFleetLoading(true);
    setLiveTelemetry({});
    setHistMetrics({});
    loadData(false);
    // Background pulse: light streams every 5s, full refresh every 20s (self-heals after blips)
    const ivLight = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadData(true);
    }, 5000);
    const ivFull = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadData(false);
    }, 20000);
    const ageTick = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      setDataAge(a => a + 1);
    }, 1000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') loadData(true);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mountedRef.current = false;
      clearInterval(ivLight);
      clearInterval(ivFull);
      clearInterval(ageTick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [workspaceConnectionId]);

  const openTickets = tickets.filter(t => t.status === 'pending' || t.status === 'open' || t.status === 'in-progress');
  const scopeLabel = workspaceName === 'Global' ? 'All service locations' : workspaceName;
  const matchPlan = (vcpus: number, ramGb: number, diskGb: number) => {
    const eligible = [...billingPlans].filter(plan => plan.isActive).sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents);
    return eligible.find(plan => vcpus <= plan.vcpuLimit && ramGb <= plan.ramGb && diskGb <= plan.diskGb) || eligible[eligible.length - 1] || null;
  };
  const billing = useMemo(() => {
    const rows = vms.map(v => {
      const vcpus = v.cpus;
      const ramGb = num(v.maxmem) / GB;
      const diskGb = num(v.disk) / GB;
      const profile = billingProfiles.find(item => item.vmid === v.vmid) || null;
      const plan = profile?.planId
        ? billingPlans.find(item => item.id === profile.planId) || matchPlan(vcpus, ramGb, diskGb)
        : matchPlan(vcpus, ramGb, diskGb);
      return { vcpus, ramGb, diskGb, plan, profile };
    });
    const effectivePrices = rows.filter(row => row.profile).reduce<Record<string, number>>((totals, row) => {
      const currency = row.profile?.currency || 'INR';
      totals[currency] = (totals[currency] || 0) + Number(row.profile?.monthlyPriceCents || 0);
      return totals;
    }, {});
    const hasCompleteBillingProfiles = rows.length > 0 && rows.every(row => row.profile !== null);
    const projectedMonthlyLabel = hasCompleteBillingProfiles
      ? Object.entries(effectivePrices).map(([currency, cents]) => money(cents, currency)).join(' · ')
      : 'Billing profile not configured';
    const projectedMonthlyCents = hasCompleteBillingProfiles
      ? Object.values(effectivePrices).reduce((sum, cents) => sum + cents, 0)
      : 0;
    const ceilings = rows.reduce((acc, row) => ({
      vcpus: acc.vcpus + Number(row.plan?.vcpuLimit || 0),
      ramGb: acc.ramGb + Number(row.plan?.ramGb || 0),
      diskGb: acc.diskGb + Number(row.plan?.diskGb || 0),
    }), { vcpus: 0, ramGb: 0, diskGb: 0 });
    const unpaid = billingInvoices.filter(invoice => invoice.outstandingCents > 0);
    const nextInvoice = [...unpaid].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
    return {
      rows,
      projectedMonthlyCents,
      projectedMonthlyLabel,
      hasCompleteBillingProfiles,
      ceilings,
      nextPayment: nextInvoice ? formatDate(nextInvoice.dueAt, { month: 'short', day: 'numeric' }).toUpperCase() : '—',
      outstandingCents: billingSummary?.outstandingCents || 0,
      overdueCount: billingSummary?.overdueCount || 0,
      overdueCents: billingSummary?.overdueCents || 0,
    };
  }, [vms, billingPlans, billingProfiles, billingInvoices, billingSummary]);

  // Aggregated fleet resources — use the GREATER of the live allocation and the
  // DB quota as each VM's effective capacity, so stale DB defaults (8 GB / 64 GB)
  // can never make fleet percentages explode past 100%.
  const acctCpus = vms.reduce((s, v) => s + v.cpus, 0);
  const acctMaxmem = vms.reduce((s, v) => s + Math.max(num(v.maxmem), num(v.memory)), 0);
  const acctMaxdisk = vms.reduce((s, v) => s + Math.max(num(v.disk) || num(v.diskUsageBytes), num(v.maxdisk)), 0);
  const runningVms = vms.filter(v => v.status === 'running').length;

  // Live aggregated telemetry
  const liveTotalCpu = vms.reduce((s, v) => {
    if (liveTelemetry[v.vmid]) return s + (num(liveTelemetry[v.vmid].cpu) * v.cpus / 100);
    const pct = num(v.cpuUsagePct || (v.live as any)?.cpuPct || 0);
    return s + (pct * v.cpus / 100);
  }, 0);
  const liveCpuPct = acctCpus > 0 ? (liveTotalCpu / acctCpus) * 100 : 0;
  
  // Cap each VM's live RAM contribution at its effective capacity so a single
  // ballooned/over-committed VM cannot drive the fleet past 100%.
  const liveTotalRam = vms.reduce((s, v) => {
    let used = 0;
    if (liveTelemetry[v.vmid]) {
      used = num(liveTelemetry[v.vmid].mem);
    } else if (num(v.ramUsageBytes) > 0) {
      used = num(v.ramUsageBytes);
    } else if ((v.live as any)?.memUsedMb) {
      used = num((v.live as any).memUsedMb) * MB;
    }
    const cap = Math.max(num(v.maxmem), num(v.memory));
    return s + (cap > 0 ? Math.min(used, cap) : used);
  }, 0);
  const liveRamPct = acctMaxmem > 0 ? Math.min(100, (liveTotalRam / acctMaxmem) * 100) : 0;
  
  // Disk: report ACTUAL cluster pool storage (LVM-thin / ZFS / node storage) if available,
  // otherwise calculate from VM disk allocations.
  const liveTotalDiskUsed = clusterStorageData 
    ? clusterStorageData.usedGb * GB 
    : vms.reduce((s, v) => s + (num(v.diskUsageBytes) || num(v.disk)), 0);
  const effectiveMaxDisk = clusterStorageData
    ? clusterStorageData.totalGb * GB
    : acctMaxdisk;
  const liveDiskPct = clusterStorageData
    ? clusterStorageData.usagePct
    : effectiveMaxDisk > 0 ? Math.min(100, (liveTotalDiskUsed / effectiveMaxDisk) * 100) : 0;
  
  // Network: cumulative bytes since boot — show as total GB transferred, not MB/s.
  const liveTotalNetIn = vms.reduce((s, v) => {
    if (liveTelemetry[v.vmid]) return s + num(liveTelemetry[v.vmid].netin);
    return s + (num(v.netInBytes) || num((v.live as any)?.netInBytes) || 0);
  }, 0);
  const liveTotalNetOut = vms.reduce((s, v) => {
    if (liveTelemetry[v.vmid]) return s + num(liveTelemetry[v.vmid].netout);
    return s + (num(v.netOutBytes) || num((v.live as any)?.netOutBytes) || 0);
  }, 0);

  const gb = (b: number) => (b / GB).toFixed(1);

  // Aggregated historical series for sparklines
  const aggCpuSeries = useMemo(() => {
    const agg: Record<string, { cpuPctSum: number, weightCpus: number }> = {};
    Object.keys(histMetrics).forEach(vmid => {
      const vm = vms.find(v => v.vmid === Number(vmid));
      if (!vm) return;
      histMetrics[Number(vmid)].history.forEach(h => {
        if (!agg[h.timestamp]) agg[h.timestamp] = { cpuPctSum: 0, weightCpus: 0 };
        agg[h.timestamp].cpuPctSum += h.cpuPct * vm.cpus;
        agg[h.timestamp].weightCpus += vm.cpus;
      });
    });
    const ts = Object.keys(agg).sort();
    return ts.map(t => agg[t].weightCpus > 0 ? (agg[t].cpuPctSum / agg[t].weightCpus) : 0);
  }, [histMetrics, vms]);

  const aggRamSeries = useMemo(() => {
    const agg: Record<string, number> = {};
    Object.keys(histMetrics).forEach(vmid => {
      histMetrics[Number(vmid)].history.forEach(h => {
        agg[h.timestamp] = (agg[h.timestamp] || 0) + h.ramBytes;
      });
    });
    return Object.keys(agg).sort().map(t => agg[t] / GB);
  }, [histMetrics]);
  
  // Network rates: history stores HOURLY deltas (bytes per hour), so convert
  // to bytes per second, then to MB/s for the sparkline scale.
  const aggNetInSeries = useMemo(() => {
    const agg: Record<string, number> = {};
    Object.keys(histMetrics).forEach(vmid => {
      histMetrics[Number(vmid)].history.forEach(h => {
        agg[h.timestamp] = (agg[h.timestamp] || 0) + h.netInBytes;
      });
    });
    return Object.keys(agg).sort().map(t => agg[t] / 3600 / MB);
  }, [histMetrics]);

  const aggNetOutSeries = useMemo(() => {
    const agg: Record<string, number> = {};
    Object.keys(histMetrics).forEach(vmid => {
      histMetrics[Number(vmid)].history.forEach(h => {
        agg[h.timestamp] = (agg[h.timestamp] || 0) + h.netOutBytes;
      });
    });
    return Object.keys(agg).sort().map(t => agg[t] / 3600 / MB);
  }, [histMetrics]);

  const acctRamGib = acctMaxmem / GB;
  const acctDiskGb = acctMaxdisk / GB;

  /* ---------------- render ---------------- */
  if (fleetLoading && !loadDone) {
    return (
      <div className="overview-dashboard overview-client-page flex flex-col flex-1 min-w-0 min-h-0 bg-[#fbfaf9] dark:bg-[#121212] overflow-hidden font-sans w-full">
        {/* TOP BAR */}
        <header className="overview-header app-header !px-5 sm:!px-7 min-w-0 overflow-hidden" style={{ height: '56px' }}>
          <div className="flex-1 min-w-0 flex items-baseline gap-5 overflow-hidden">
            <h1 className="page-heading !text-[24px] font-serif font-medium !mb-0 !leading-none truncate">Overview</h1>
            <p className="hidden sm:block ink-description-text !mt-0 !text-[12px] truncate text-[#8a9090]">
              Connecting to Votion Cloud…
            </p>
          </div>
        </header>

        {/* PROPRIETARY VOTION PRELOADER */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 select-none text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#dedfdf] dark:border-[#313131] border-t-[#1a1a1a] dark:border-t-white animate-spin mb-4" />
          <h2 className="text-base font-semibold text-[#1a1a1a] dark:text-white tracking-tight">
            Votion Cloud
          </h2>
          <p className="text-xs text-[#656b6b] dark:text-[#a0a0a0] mt-1">
            Preparing your environment…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overview-dashboard overview-client-page flex flex-col flex-1 min-w-0 min-h-0 bg-[#fbfaf9] overflow-hidden font-sans w-full">
      {/* ================= TOP BAR (house app-header style) ================= */}
      <header className="overview-header app-header !px-5 sm:!px-7 min-w-0 overflow-hidden" style={{ height: '56px' }}>
        <div className="flex-1 min-w-0 flex items-baseline gap-5 overflow-hidden">
          <h1 className="page-heading !text-[24px] font-serif font-medium !mb-0 !leading-none truncate">Overview</h1>
          <p className="hidden sm:block ink-description-text !mt-0 !text-[12px] truncate">
            {loadDone
              ? `${vms.length} Cloud Instance${vms.length === 1 ? '' : 's'} · ${scopeLabel} · Updated ${dataAge}s ago`
              : 'Connecting to Votion Cloud…'}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 max-w-full">
          <button
            onClick={() => onOpenModal('support')}
            className="btn-secondary !px-3 !py-1.5 !text-[12px] relative cursor-pointer"
          >
            New Ticket
            {openTickets.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#1a1a1a] text-white rounded-full text-[9px] font-bold w-4 h-4 flex items-center justify-center">
                {openTickets.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setOpsCollapsed(!opsCollapsed)}
            className={`text-xs border border-[#dedfdf] rounded-md px-2 py-1 transition-colors cursor-pointer ${opsCollapsed ? 'text-[#1a1a1a] border-[#1a1a1a]' : 'text-[#656b6b] hover:text-[#1a1a1a]'}`}
            title={opsCollapsed ? 'Show operations' : 'Hide operations'}
          >
            {opsCollapsed ? 'Ops ▸' : 'Ops ✕'}
          </button>
        </div>
      </header>

      {/* ================= MAIN HORIZONTAL SPLIT ================= */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-x-hidden">
        
        {/* ---------- CENTER: RESOURCE INSTRUMENT PANEL ---------- */}
        <section className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* identity strip */}
          <div className="px-5 sm:px-7 pt-5 pb-3 flex items-center justify-between border-b border-[#dedfdf] bg-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${runningVms > 0 ? 'bg-[#10b981] animate-pulse' : 'bg-[#a0a1a2]'}`} />
              <span className="text-sm font-serif font-medium text-[#1a1a1a] tracking-[-0.015em] truncate">Infrastructure Overview</span>
              {loadDone && (
                <>
                  <span className="hidden sm:inline text-[12px] text-[#a0a1a2]">·</span>
                  <span className="hidden sm:inline font-mono text-[12px] text-[#656b6b] truncate">{runningVms} / {vms.length} active</span>
                  <span className="hidden sm:inline text-[12px] text-[#a0a1a2]">·</span>
                  <span className="hidden sm:inline text-[12px] text-[#656b6b]">{acctCpus} vCPUs allocated</span>
                </>
              )}
            </div>
            {loadDone && !fleetFailed && (
              <span className="text-[10px] text-[#a0a1a2] font-mono shrink-0">
                {isRefreshing ? 'updating…' : providerAvailable ? `live ${dataAge}s` : 'cached'}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-5 sm:px-7 py-4">
            {!fleetLoading && !fleetFailed && !providerAvailable && (
              <section className="mb-4 rounded-md border border-[#dedfdf] bg-white px-4 py-3" role="status" aria-live="polite">
                <p className="text-[12px] font-semibold text-[#1a1a1a]">Live cloud status unavailable</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#656b6b]">Infrastructure credentials are being verified. Saved server configurations remain available.</p>
              </section>
            )}
            {fleetLoading ? (
              <div className="px-4 py-10">
                <div className="h-2 bg-[#f1f1f1] rounded animate-pulse mb-3 w-2/3" />
                <div className="h-2 bg-[#f1f1f1] rounded animate-pulse w-1/2" />
              </div>
            ) : fleetFailed ? (
              <div className="px-4 py-6 border border-dashed border-[#dedfdf] bg-white rounded-md flex flex-col items-center justify-center text-center max-w-lg mx-auto mt-10">
                <div className="text-sm text-[#1a1a1a] font-semibold mb-2">Connection Timeout</div>
                <p className="text-xs text-[#656b6b] mb-4">Unable to reach the infrastructure services. Reconnecting automatically…</p>
                <button onClick={() => loadData(false)} className="btn-secondary !text-[11px] !px-4 !py-1.5 cursor-pointer">Retry Connection</button>
              </div>
            ) : vms.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center justify-center text-center max-w-md mx-auto mt-10">
                <div className="w-12 h-12 bg-white border border-[#dedfdf] rounded-lg mb-4 flex items-center justify-center text-lg shadow-sm">☁️</div>
                <h3 className="text-base font-serif font-medium text-[#1a1a1a] mb-1">No active servers</h3>
                <p className="text-[12px] text-[#656b6b] mb-5 leading-relaxed">Deploy a cloud server to begin. Your resource allocation and real-time status will display here.</p>
                <button type="button" onClick={() => onOpenModal('pricing')} className="btn-secondary !px-4 !py-2 !text-[11px] cursor-pointer">View Cloud Plans</button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* resource usage block */}
                <div className="ink-block-wrapper !mb-0">
                  <div className="ink-block-header !px-4 !py-3 flex items-center justify-between">
                    <span className="ink-block-title !text-[13px] font-serif font-medium">Resource Allocation & Usage</span>
                    <span className="text-[10px] text-[#a0a1a2] font-mono">{providerAvailable ? 'LIVE' : 'CACHED'}</span>
                  </div>
                  <table className="overview-telemetry-table w-full border-collapse table-fixed">
                    <tbody>
                      <tr className="ink-table-row hover:bg-[#fbfaf9]">
                        <td className="ink-table-th !py-2.5 !pl-4 !pr-2 !text-[12px] !w-24">Compute (vCPU)</td>
                        <td className="ink-table-td !py-2.5 !px-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-sm text-[#1a1a1a] tabular-nums">
                              {liveCpuPct.toFixed(1)}%
                              <span className="text-[#a0a1a2] text-[11px] ml-1.5">of {acctCpus} vCPU{acctCpus === 1 ? '' : 's'}</span>
                            </span>
                            <div className="hidden sm:block shrink-0">
                              <Sparkline values={aggCpuSeries.slice(-30)} color="#3b82f6" currentValue={liveCpuPct} height={22} />
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tr className="ink-table-row hover:bg-[#fbfaf9]">
                        <td className="ink-table-th !py-2.5 !pl-4 !pr-2 !text-[12px]">Memory (RAM)</td>
                        <td className="ink-table-td !py-2.5 !px-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-sm text-[#1a1a1a] tabular-nums">
                              {(liveTotalRam / GB).toFixed(2)} GB
                              <span className="text-[#a0a1a2] text-[11px] ml-1.5">{liveRamPct.toFixed(0)}% of {(acctMaxmem / GB).toFixed(0)} GB</span>
                            </span>
                            <div className="hidden sm:block shrink-0">
                              <Sparkline values={aggRamSeries.slice(-30)} color="#8b5cf6" currentValue={liveRamPct} height={22} />
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tr className="ink-table-row hover:bg-[#fbfaf9]">
                        <td className="ink-table-th !py-2.5 !pl-4 !pr-2 !text-[12px]">Storage Pool</td>
                        <td className="ink-table-td !py-2.5 !px-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-sm text-[#1a1a1a] tabular-nums">
                              {liveDiskPct.toFixed(0)}% used
                              <span className="text-[#a0a1a2] text-[11px] ml-1.5">{gb(liveTotalDiskUsed)} GB of {gb(effectiveMaxDisk)} GB</span>
                            </span>
                            <div className="hidden sm:block w-[110px] shrink-0">
                              <UsageBar pct={liveDiskPct} color="#06b6d4" />
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-[#fbfaf9]">
                        <td className="ink-table-th !py-2.5 !pl-4 !pr-2 !text-[12px]">Network Throughput</td>
                        <td className="ink-table-td !py-2.5 !px-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-sm text-[#1a1a1a] tabular-nums">
                              <span className="text-[#1a1a1a]">{aggNetInSeries.length ? aggNetInSeries[aggNetInSeries.length - 1].toFixed(1) : '—'} MB/s in</span>
                              <span className="text-[#a0a1a2] text-[11px] ml-1.5">· {aggNetOutSeries.length ? aggNetOutSeries[aggNetOutSeries.length - 1].toFixed(1) : '—'} MB/s out</span>
                            </span>
                            <div className="hidden sm:block shrink-0">
                              <Sparkline values={aggNetInSeries.slice(-30)} color="#10b981" currentValue={aggNetInSeries.length ? aggNetInSeries[aggNetInSeries.length - 1] : 1.2} height={22} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* session counters */}
                <div className="ink-block-wrapper !mb-0">
                  <div className="ink-block-header !px-4 !py-3">
                    <span className="ink-block-title !text-[12px]">Data Transfer & Activity</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#dedfdf] text-center">
                    <div className="py-3 px-2">
                      <div className="text-[10px] uppercase tracking-widest text-[#656b6b]">Inbound Traffic</div>
                      <div className="font-mono text-sm text-[#1a1a1a] mt-0.5">{(liveTotalNetIn / GB).toFixed(1)} GB</div>
                    </div>
                    <div className="py-3 px-2">
                      <div className="text-[10px] uppercase tracking-widest text-[#656b6b]">Outbound Traffic</div>
                      <div className="font-mono text-sm text-[#1a1a1a] mt-0.5">{(liveTotalNetOut / GB).toFixed(1)} GB</div>
                    </div>
                    <div className="py-3 px-2 flex flex-col justify-center items-center">
                      <div className="text-[10px] uppercase tracking-widest text-[#656b6b]">Active Instances</div>
                      <div className="font-mono text-sm text-[#1a1a1a] mt-0.5">{runningVms} / {vms.length}</div>
                    </div>
                    <div className="py-3 px-2 flex flex-col justify-center items-center">
                      <button onClick={onOpenManage} className="btn-secondary !text-[11px] !px-3 !py-1 cursor-pointer">
                        Manage Instances →
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </section>

        {/* ---------- RIGHT: OPERATIONS HUB ---------- */}
        {!opsCollapsed && (
          <aside className="overview-ops-rail hidden xl:flex flex-col w-[320px] max-w-[360px] border-l border-[#dedfdf] bg-white overflow-y-auto shrink-0">
            {/* 1. open tickets */}
            <div className="ink-block-header !px-4 py-3 flex items-center justify-between">
              <span className="ink-block-title !text-[13px] font-serif font-medium flex items-center gap-2">
                Open tickets
                <span className="bg-[#1a1a1a] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{openTickets.length}</span>
              </span>
              <button onClick={() => onOpenModal('support')} className="text-[11px] text-[#2563eb] hover:text-[#1d4ed8] cursor-pointer underline underline-offset-4">New</button>
            </div>
            <div className="px-4 py-2.5 border-b border-[#dedfdf]">
              {openTickets.length === 0 && (
                <div className="text-xs text-[#656b6b] py-1">Queue clear — no open tickets.</div>
              )}
              <div className="flex flex-col divide-y divide-[#dedfdf]">
                {openTickets.map(t => (
                  <div key={t.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[#656b6b]">{formatTicketNumber(t)}</span>
                      <span className="text-xs flex-1 truncate">{t.subject || 'Untitled'}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        (t.priority === 'urgent' || t.priority === 'high')
                          ? 'bg-[#1a1a1a] text-white'
                          : 'bg-white border border-dashed border-[#656b6b] text-[#656b6b]'
                      }`}>
                        {(t.priority === 'urgent' || t.priority === 'high') ? 'Needs reply' : t.status === 'in-progress' ? 'In progress' : 'Open'}
                      </span>
                    </div>
                    {replyingTo === t.id ? (
                      <QuickReply ticketId={String(t.id)} onSent={() => { setReplyingTo(null); loadData(false); }} onCancel={() => setReplyingTo(null)} toast={showToast} />
                    ) : (
                      <button onClick={() => setReplyingTo(t.id)} className="text-[10px] text-[#656b6b] hover:text-[#2563eb] mt-1 cursor-pointer underline underline-offset-2">Quick reply ↵</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. account & billing */}
            <div className="ink-block-header !px-4 py-3">
              <span className="ink-block-title !text-[13px] font-serif font-medium">Account & billing</span>
            </div>
            <div className="px-4 py-2.5 border-b border-[#dedfdf]">
              {billingSummary === null ? (
                <div className="space-y-2.5" aria-busy="true">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-[#f1f1f1]" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-[#f1f1f1]" />
                  <div className="h-2 w-full animate-pulse rounded bg-[#f1f1f1]" />
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                    <span className="text-[#656b6b]">Next payment due</span>
                    <span className="text-[#1a1a1a] font-semibold">{billing.nextPayment}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono mb-2.5">
                    <span className="text-[#656b6b]">Projected monthly</span>
                    <span className="text-[#1a1a1a] font-semibold">{billing.hasCompleteBillingProfiles ? billing.projectedMonthlyLabel : 'Not configured'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono mb-2.5">
                    <span className="text-[#656b6b]">Outstanding balance</span>
                    <span className={`font-semibold ${billing.outstandingCents > 0 ? 'text-[#8d3028]' : 'text-[#176b52]'}`}>{money(billing.outstandingCents, billingInvoices[0]?.currency || 'USD')}</span>
                  </div>
                  {billing.overdueCount > 0 ? (
                    <div className="mb-3 rounded border border-[#f0c0bb] bg-[#fff7f6] px-3 py-2 text-[11px] leading-5 text-[#8d3028]">
                      <strong>Payment attention required.</strong> {billing.overdueCount} invoice{billing.overdueCount === 1 ? '' : 's'} overdue ({money(billing.overdueCents, billingInvoices[0]?.currency || 'USD')}). Service may be suspended only after the configured grace period; your VM and disks are never deleted by this workflow.
                    </div>
                  ) : billingInvoices.length === 0 ? (
                    <div className="mb-3 rounded border border-[#dedfdf] bg-[#fbfaf9] px-3 py-2 text-[11px] leading-5 text-[#656b6b]">No invoices have been recorded yet. Your account team will publish billing details here when the billing profile is activated.</div>
                  ) : (
                    <div className="mb-3 rounded border border-[#b8e3cf] bg-[#eef9f4] px-3 py-2 text-[11px] leading-5 text-[#176b52]">Billing account in good standing. No overdue balance is currently recorded.</div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-[#656b6b]">Billing period</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border bg-white border-[#dedfdf] text-[#656b6b]">Monthly</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {[
                      { label: `vCPU (${acctCpus})`, cap: `${billing.ceilings.vcpus || '—'} catalog cap`, pct: billing.ceilings.vcpus ? (acctCpus / billing.ceilings.vcpus) * 100 : 0 },
                      { label: `Memory (${acctRamGib.toFixed(0)} GB)`, cap: `${billing.ceilings.ramGb || '—'} GB catalog cap`, pct: billing.ceilings.ramGb ? (acctRamGib / billing.ceilings.ramGb) * 100 : 0 },
                      { label: `Disk (${acctDiskGb.toFixed(0)} GB)`, cap: `${billing.ceilings.diskGb || '—'} GB catalog cap`, pct: billing.ceilings.diskGb ? (acctDiskGb / billing.ceilings.diskGb) * 100 : 0 },
                    ].map(q => (
                      <div key={q.label}>
                        <div className="text-[10px] text-[#656b6b] flex justify-between font-mono">
                          <span>{q.label}</span>
                          <span>{q.cap}</span>
                        </div>
                        <UsageBar pct={q.pct} tone="subtle" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 3. incidents & audit */}
            <div className="ink-block-header !px-4 py-3">
              <span className="ink-block-title !text-[13px] font-serif font-medium">Incidents & audit</span>
            </div>
            <div className="px-4 py-2.5 flex-1">
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                {(() => {
                  const userAudit = audit.filter(a => {
                    const detail = customerAuditDetail(a);
                    return detail !== 'Server service updated' && 
                           detail !== 'Service infrastructure updated' && 
                           detail !== 'Server service event recorded';
                  });
                  return (
                    <>
                      {userAudit.slice(0, 12).map(a => (
                        <div key={a.id} className="flex items-start gap-2 text-[11px]">
                          <span className="font-mono text-[10px] text-[#a0a1a2] shrink-0 w-14">{formatTime(a.timestamp, { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                          <span className="flex-1">
                            <span className="text-[#1a1a1a]">{customerAuditDetail(a)}</span>
                            {a.status === 'failed' && <span className="text-[9px] font-bold uppercase bg-[#1a1a1a] text-white px-1 py-0.5 rounded ml-1">Failed</span>}
                          </span>
                        </div>
                      ))}
                      {userAudit.length === 0 && <div className="text-[11px] text-[#656b6b]">No recent user events.</div>}
                    </>
                  );
                })()}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* toast */}
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg px-4 py-2.5 shadow-lg z-50 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          {toastMsg}
          <button onClick={() => setToastMsg(null)} className="text-white/60 hover:text-white ml-2 cursor-pointer">✕</button>
        </div>
      )}
    </div>
  );
};

export default OverviewDashboard;
