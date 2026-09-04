/**
 * Admin VM Fleet — full Proxmox-backed fleet management for admins.
 *
 * Single-source component: summary strip, node inventory, fleet table with
 * filters/search, per-row lifecycle (start|stop|reboot|shutdown), suspend,
 * unassign, edit-specs modal, and the 3-step "Assign Server" wizard.
 *
 * Direct fetch calls against /api/v1/admin/* (mounted at both /api/admin and
 * /api/v1/admin by the Express server) — avoids touching the monolithic
 * apiClient class. Theme-aware (dark uses the app's semantic palette via the
 * dark-mode CSS overrides; light is the default).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { getIpCarrierType, isIpInSubnets, compareCarrierAndIp, compareIps, getCarrierPriority } from '../utils/ipUtils';
import { CarrierLogoBadge } from './CarrierIcons';

// ---------------------------------------------------------------------------
// Types (aligned with server/adminVmFleet.ts + db/database.ts)
// ---------------------------------------------------------------------------
interface FleetVM {
  vmKey: string;
  vmid: number;
  proxmoxConnectionId: string | null;
  proxmoxConnectionName: string;
  name: string;
  type: 'qemu' | 'lxc' | string;
  node: string;
  nodeDisplayName?: string;
  displayNode?: string | null;
  displayCpuModel?: string | null;
  ownerEmail: string;
  status: string;
  cpus: number;
  memory: number;      // bytes
  maxmem: number;      // bytes
  disk: number;        // bytes
  maxdisk: number;     // bytes
  uptime: number;      // seconds
  ipAddress: string | null;
  os: string;
  expiryDate: string | null;
  isSuspended: boolean;
  live?: {
    status: string;
    cpuPct: number;
    memUsedMb: number;
    memTotalMb: number;
    memPct: number;
    diskUsedGb: number; // actually a percent (0-100) of maxdisk
    uptimeSeconds: number;
    netInBytes: number;
    netOutBytes: number;
    node: string;
    type: string;
  } | null;
}

interface WizardNode {
  node: string;   // real proxmox node id, or 'auto' (connection fallback)
  name: string;   // display label
}

interface WizardAccount {
  id: number;
  email: string;
  name: string | null;
  role: string | null;
  phone: string | null;
  supportTier: string | null;
}

interface ClusterSummary {
  totalVms: number;
  totalNodes: number;
  totalCpus: number;
  totalRamGb: number;
  totalDiskGb: number;
  byStatus: Record<string, number>;
  unassigned: number;
}

interface NodeCapacity {
  name: string;
  node: string;
  cpuCores: number;
  ramTotalGb: number;
  vms: number;
}

interface NodeMetric {
  node: string;
  name: string;
  status: string;
  cpuUsagePct: number;
  cpuCores: number;
  ramUsedGb: number;
  ramTotalGb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  uptimeSeconds: number;
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function secondsToUptime(sec: number): string {
  if (!sec || sec < 1) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function expiryLabel(expiryDate: string | null, isSuspended: boolean): { text: string; tone: 'ok' | 'warn' | 'bad' | 'muted' } {
  if (isSuspended) return { text: 'Suspended', tone: 'bad' };
  if (!expiryDate) return { text: '—', tone: 'muted' };
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: 'Expired', tone: 'bad' };
  if (days <= 7) return { text: `${days}d left`, tone: 'warn' };
  if (days > 365) return { text: 'Long-term', tone: 'ok' };
  return { text: `${days}d left`, tone: 'ok' };
}

const toneColor: Record<string, string> = {
  ok: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
  muted: '#a7aaaa',
};

function StatusPill({ status, isSuspended }: { status: string; isSuspended?: boolean }) {
  const s = isSuspended ? 'suspended' : (status || 'unknown').toLowerCase();
  const color = s === 'running' ? '#34d399' : s === 'stopped' ? '#f87171' : s === 'suspended' ? '#fbbf24' : '#a7aaaa';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ borderColor: 'color-mix(in srgb, ' + color + ' 45%, transparent)', color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: s === 'running' ? '0 0 6px ' + color : 'none' }} />
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

const moduleSecLabel: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a7aaaa', fontWeight: 500,
};

function BarTrack({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1 w-full rounded-full" style={{ backgroundColor: '#313131' }}>
      <div className="h-1 rounded-full" style={{ width: pct + '%', backgroundColor: color, transition: 'width .4s ease' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Allocation breakdown chart — placed below the summary strip
// ---------------------------------------------------------------------------
const AllocationBreakdown: React.FC<{
  rows: { name: string; node: string; cpuAllocated: number; cpuTotal: number; ramAllocatedGb: number; ramTotalGb: number; vms: number }[];
  totalCpus: number;
  totalRamGb: number;
}> = ({ rows }) => {
  const hasRows = rows.length > 0;
  const totals = hasRows
    ? rows.reduce((acc, r) => ({ cpu: acc.cpu + r.cpuAllocated, ram: acc.ram + r.ramAllocatedGb, vms: acc.vms + r.vms }), { cpu: 0, ram: 0, vms: 0 })
    : { cpu: 0, ram: 0, vms: 0 };

  return (
    <div className="mb-5 rounded-md border" style={{ backgroundColor: '#0a0a0a', borderColor: '#313131' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: '#313131' }}>
        <div style={moduleSecLabel}>Allocation Breakdown — CPU & RAM across the cluster</div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#5b8def' }} /><span className="text-[#a7aaaa]">Allocated</span></span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#313131', border: '1px solid #4a4a4a' }} /><span className="text-[#a7aaaa]">Free</span></span>
        </div>
      </div>
      {!hasRows ? (
        <div className="px-4 py-6 text-sm text-[#71717a]">No servers placed on nodes yet — allocation will appear here once the first server is assigned.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: '#313131' }}>
                <th className="px-4 py-2.5" style={moduleSecLabel}>Node</th>
                <th className="px-4 py-2.5" style={moduleSecLabel}>Servers</th>
                <th className="px-4 py-2.5" style={moduleSecLabel}>CPU Cores</th>
                <th className="px-4 py-2.5" style={moduleSecLabel}>RAM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const cpuPct = Math.round((r.cpuAllocated / Math.max(r.cpuTotal, 1)) * 100);
                const ramPct = Math.round((r.ramAllocatedGb / Math.max(r.ramTotalGb, 1)) * 100);
                return (
                  <tr key={r.node} className="border-b transition-colors last:border-0" style={{ borderColor: '#313131' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#e8e8e8]">{r.name}</div>
                      {r.node !== 'auto' && <div className="font-mono text-[10px] text-[#71717a]">{r.node}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#a7aaaa]">{r.vms}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[12px] text-[#e8e8e8]">{r.cpuAllocated}/{r.cpuTotal}</span>
                        <span className="text-[10px] text-[#71717a]">cores</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-44 rounded-full" style={{ backgroundColor: '#313131' }}>
                        <div className="h-1.5 rounded-full" style={{ width: Math.min(100, cpuPct) + '%', backgroundColor: '#5b8def' }} />
                      </div>
                      <div className="mt-0.5 text-[10px] font-mono text-[#71717a]">{cpuPct}% used{r.cpuTotal > r.cpuAllocated ? ` · ${r.cpuTotal - r.cpuAllocated} free` : ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[12px] text-[#e8e8e8]">{r.ramAllocatedGb}/{r.ramTotalGb}</span>
                        <span className="text-[10px] text-[#71717a]">GB</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-44 rounded-full" style={{ backgroundColor: '#313131' }}>
                        <div className="h-1.5 rounded-full" style={{ width: Math.min(100, ramPct) + '%', backgroundColor: '#34d399' }} />
                      </div>
                      <div className="mt-0.5 text-[10px] font-mono text-[#71717a]">{ramPct}% used{r.ramTotalGb > r.ramAllocatedGb ? ` · ${r.ramTotalGb - r.ramAllocatedGb} GB free` : ''}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-[#1c1c1c]" style={{ borderColor: '#313131' }}>
                <td className="px-4 py-3 text-[11px] font-semibold uppercase text-[#a7aaaa]" style={{ letterSpacing: '0.14em' }}>Cluster total</td>
                <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#e8e8e8]">{totals.vms}</td>
                <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#e8e8e8]">{totals.cpu} of {Math.max(1, ...rows.map(r => r.cpuTotal))} cores</td>
                <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#e8e8e8]">{totals.ram} of {Math.max(1, ...rows.map(r => r.ramTotalGb))} GB</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const AdminVMFleet: React.FC = () => {
  const [vms, setVms] = useState<FleetVM[]>([]);
  const [summary, setSummary] = useState<ClusterSummary | null>(null);
  const [nodes, setNodes] = useState<NodeMetric[]>([]);
  const [capacity, setCapacity] = useState<NodeCapacity[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [nodeFilter, setNodeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [carrierFilter, setCarrierFilter] = useState<'all' | 'ovh' | 'hetzner' | 'custom'>('all');
  const [sortMode, setSortMode] = useState<'carrier' | 'vmid' | 'name' | 'ip' | 'status'>('carrier');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'bad' | 'info' } | null>(null);
  const [ovhIps, setOvhIps] = useState<string[]>([]);
  const [hetznerIps, setHetznerIps] = useState<string[]>([]);

  // Modals
  const [editVM, setEditVM] = useState<FleetVM | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignVM, setAssignVM] = useState<FleetVM | null>(null);
  const [nodesOpen, setNodesOpen] = useState(true);

  const toastTimer = useRef<number | null>(null);
  const flash = (text: string, tone: 'ok' | 'bad' | 'info' = 'info') => {
    setToast({ text, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  const authToken = () => localStorage.getItem('votion_jwt_token') || '';

  // ---------------------------------------------------------------------------
  // Allocation aggregation (allocated CPU cores + RAM GB per VM across fleet)
  // ---------------------------------------------------------------------------
  const allocationByNode = useMemo(() => {
    const byNode = new Map<string, { cpu: number; ramGb: number; vms: number; name: string }>();
    for (const v of vms) {
      const key = v.node && v.node !== '—' ? v.node : 'auto';
      const entry = byNode.get(key) || { cpu: 0, ramGb: 0, vms: 0, name: v.node === '—' ? 'Unplaced' : v.node };
      entry.cpu += v.cpus || 0;
      entry.ramGb += Math.round((v.maxmem || 0) / 1073741824);
      entry.vms += 1;
      byNode.set(key, entry);
    }
    return Array.from(byNode.entries()).map(([node, e]) => ({ ...e, node }));
  }, [vms]);

  // Merge live capacity (from summary.nodeCapacity) onto allocated amounts.
  const capacityByNode = useMemo(() => {
    const cap = new Map<string, { name: string; cpu: number; ramGb: number }>();
    for (const c of capacity) cap.set(c.node, { name: c.name, cpu: c.cpuCores, ramGb: c.ramTotalGb });
    return allocationByNode.map(a => {
      const c = cap.get(a.node);
      return {
        name: c?.name || a.name,
        node: a.node,
        cpuAllocated: a.cpu,
        cpuTotal: c ? Math.max(c.cpu, a.cpu) : a.cpu,
        ramAllocatedGb: a.ramGb,
        ramTotalGb: c ? Math.max(c.ramGb, a.ramGb) : a.ramGb,
        vms: a.vms,
      };
    });
  }, [allocationByNode, capacity]);

  const apiHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken()}`,
  });

  const base = '/api/v1/admin';

  const fetchFleet = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      const [vmsRes, sumRes, nodesRes] = await Promise.all([
        fetch(`${base}/vms`, { headers: apiHeaders() }),
        fetch(`${base}/summary`, { headers: apiHeaders() }),
        fetch(`${base}/nodes`, { headers: apiHeaders() }),
      ]);
      if (vmsRes.ok) {
        const j = await vmsRes.json();
        // Normalize: /vms returns Proxmox-backed rows with ownerEmail camelCase fields
        const rows: FleetVM[] = (j.data || []).map((v: any) => ({
          vmKey: v.vmKey ?? `${v.proxmoxConnectionId ?? 'legacy-local'}:${v.node ?? 'unknown'}:${v.vmid}`,
          vmid: v.vmid,
          proxmoxConnectionId: v.proxmoxConnectionId ?? v.proxmox_connection_id ?? null,
          proxmoxConnectionName: v.proxmoxConnectionName ?? v.proxmox_connection_name ?? 'Unassigned location',
          name: v.name ?? v.vm_name ?? `vm-${v.vmid}`,
          type: v.type || 'qemu',
          node: v.node || '—',
          ownerEmail: v.ownerEmail ?? v.owner_email ?? 'unassigned@votioncloud.org',
          status: v.status || 'unknown',
          cpus: v.cpus ?? v.cpu_cores ?? 0,
          memory: v.memory ?? 0,
          maxmem: v.maxmem ?? 0,
          disk: v.disk ?? 0,
          maxdisk: v.maxdisk ?? 0,
          uptime: v.uptime ?? 0,
          ipAddress: v.ipAddress ?? v.ip_address ?? null,
          os: v.os ?? v.os_type ?? '—',
          expiryDate: (v.expiryDate || v.expiry_date) ? String(v.expiryDate || v.expiry_date) : null,
          isSuspended: !!v.isSuspended,
          live: v.live || null,
        }));
        setVms(rows);
      } else {
        if (!isBackground) flash('Failed to load fleet (auth expired?)', 'bad');
      }
      if (sumRes.ok) { const j = await sumRes.json(); const d = j.data || {}; setSummary(d); setCapacity(d.nodeCapacity || []); }
      if (nodesRes.ok) {
        const j = await nodesRes.json();
        const mapped = (j.data || []).map((n: any) => ({
          ...n,
          diskUsedGb: n.storageUsageGb !== undefined ? n.storageUsageGb : (n.diskUsedGb || 0),
          diskTotalGb: n.storageTotalGb !== undefined ? n.storageTotalGb : (n.diskTotalGb || 0),
        }));
        setNodes(mapped);
      }

      // Fetch OVH and Hetzner carrier subnets for IP badge decoration
      void apiClient.getAdminOvhIps().then(setOvhIps).catch(() => {});
      void apiClient.getAdminHetznerIps().then(h => {
        const l = [...(h.ips || []).map((x: any) => `${x.ip}/32`), ...(h.subnets || []).map((x: any) => `${x.ip}/${x.mask}`)];
        setHetznerIps(l);
      }).catch(() => {});
    } catch (e: any) {
      if (!isBackground) flash('Network error loading fleet', 'bad');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFleet(false); }, []);

  // Auto-refresh live data silently every 30s without resetting the UI
  useEffect(() => {
    const t = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void fetchFleet(true);
    }, 30000);
    return () => window.clearInterval(t);
  }, []);

  const sortVms = (list: FleetVM[]) => {
    return list.slice().sort((a, b) => {
      if (sortMode === 'carrier') {
        const carrierA = getIpCarrierType(a.ipAddress, ovhIps, hetznerIps).carrier;
        const carrierB = getIpCarrierType(b.ipAddress, ovhIps, hetznerIps).carrier;
        const carrierDiff = getCarrierPriority(carrierA) - getCarrierPriority(carrierB);
        if (carrierDiff !== 0) return carrierDiff;
        if (a.ipAddress && b.ipAddress) {
          const ipDiff = compareIps(a.ipAddress, b.ipAddress);
          if (ipDiff !== 0) return ipDiff;
        }
        return a.vmid - b.vmid;
      }
      if (sortMode === 'ip') {
        return compareIps(a.ipAddress, b.ipAddress);
      }
      if (sortMode === 'vmid') {
        return a.vmid - b.vmid;
      }
      if (sortMode === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortMode === 'status') {
        return (a.status || '').localeCompare(b.status || '');
      }
      return 0;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vms.filter(v => {
      if (statusFilter !== 'all' && (v.isSuspended ? 'suspended' : v.status.toLowerCase()) !== statusFilter) return false;
      if (nodeFilter !== 'all' && v.node !== nodeFilter) return false;
      if (locationFilter !== 'all' && v.proxmoxConnectionId !== locationFilter) return false;
      if (carrierFilter !== 'all') {
        const vmCarrier = getIpCarrierType(v.ipAddress, ovhIps, hetznerIps).carrier;
        if (carrierFilter !== vmCarrier) return false;
      }
      if (q) {
        const hay = `${v.vmid} ${v.vmKey} ${v.proxmoxConnectionName} ${v.name} ${v.ownerEmail} ${v.os} ${v.ipAddress ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vms, search, statusFilter, nodeFilter, locationFilter, carrierFilter, ovhIps, hetznerIps]);

  const locationsList = useMemo(() => {
    const locations = new Map<string, string>();
    vms.forEach(v => { if (v.proxmoxConnectionId) locations.set(v.proxmoxConnectionId, v.proxmoxConnectionName); });
    return Array.from(locations.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [vms]);

  React.useEffect(() => { if (locationFilter === 'all' && locationsList.length > 0) setLocationFilter(locationsList[0][0]); }, [locationsList, locationFilter]);

  const assignedRows = useMemo(() => {
    const rows = filtered.filter(vm => !/^unassigned@/i.test(vm.ownerEmail || ''));
    return sortVms(rows);
  }, [filtered, sortMode, ovhIps, hetznerIps]);

  const unassignedRows = useMemo(() => {
    const rows = filtered.filter(vm => /^unassigned@/i.test(vm.ownerEmail || ''));
    return sortVms(rows);
  }, [filtered, sortMode, ovhIps, hetznerIps]);

  const nodesList = useMemo(() => {
    const ids = Array.from(new Set(vms.map(v => v.node).filter(n => n && n !== '—')));
    return ids;
  }, [vms]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const runAction = async (vm: FleetVM, action: 'start' | 'stop' | 'reboot' | 'shutdown') => {
    setActioning(a => ({ ...a, [vm.vmKey]: action }));
    try {
      const res = await fetch(`${base}/vms/${vm.vmid}/action`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ action, proxmoxConnectionId: vm.proxmoxConnectionId }),
      });
      const j = await res.json();
      if (res.ok) {
        flash(`${vm.proxmoxConnectionName} · VMID ${vm.vmid} — ${action} issued. ${j.message}`, 'ok');
        await fetchFleet();
      } else {
        flash(`${vm.proxmoxConnectionName} · VMID ${vm.vmid} — ${action} failed: ${j.error || 'Unknown error'}`, 'bad');
      }
    } catch (e: any) {
      flash(`VMID ${vm.vmid} — ${action} failed`, 'bad');
    } finally {
      setActioning(a => { const n = { ...a }; delete n[vm.vmKey]; return n; });
    }
  };

  const runSuspend = async (vmid: number, suspend: boolean) => {
    try {
      const res = await fetch(`${base}/vms/${vmid}/suspend`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ suspend }),
      });
      const j = await res.json();
      if (res.ok) flash(j.message || `VMID ${vmid} ${suspend ? 'suspended' : 'unsuspended'}`, 'ok');
      else flash(`Suspend failed: ${j.error}`, 'bad');
      await fetchFleet();
    } catch (e: any) {
      flash('Suspend failed', 'bad');
    }
  };

  const runUnassign = async (vm: FleetVM) => {
    if (!window.confirm(`Unassign VMID ${vm.vmid} from ${vm.proxmoxConnectionName}? The client loses access to this server.`)) return;
    try {
      const res = await fetch(`${base}/vms/${vm.vmid}/unassign?proxmoxConnectionId=${encodeURIComponent(vm.proxmoxConnectionId || '')}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      const j = await res.json();
      if (res.ok) flash(`${vm.proxmoxConnectionName} · VMID ${vm.vmid} unassigned — now in the free pool`, 'ok');
      else flash(`Unassign failed: ${j.error}`, 'bad');
      await fetchFleet();
    } catch (e: any) {
      flash('Unassign failed', 'bad');
    }
  };

  const bulkAction = async (action: 'start' | 'stop') => {
    if (selected.size === 0) { flash('Select servers first', 'info'); return; }
    const selectedVms = vms.filter(vm => selected.has(vm.vmKey));
    flash(`Issuing ${action} on ${selectedVms.length} server${selectedVms.length > 1 ? 's' : ''}…`, 'info');
    for (const vm of selectedVms) await runAction(vm, action);
    setSelected(new Set());
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const secLabel: React.CSSProperties = {
    fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a7aaaa', fontWeight: 500,
  };

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 w-full bg-[#0a0a0a] font-sans text-[#e8e8e8] overflow-y-auto">
      <div className="px-5 pb-10 pt-6 max-w-[1400px] mx-auto w-full">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2" style={secLabel}>Control Panel · Administration</div>
          <h1 className="mt-1 font-serif text-2xl font-medium leading-tight tracking-[-0.03em] text-[#e8e8e8]">VM Fleet</h1>
          <p className="text-sm text-[#a7aaaa] mt-1">Every server across the cluster — power, specs, assignment, expiry.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: '#313131', color: 'var(--theme-text)', backgroundColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#151515')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={() => { setNodesOpen(!nodesOpen); }}>
            <svg width="14" height="14" viewBox="0 0 22 22" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            {nodesOpen ? 'Hide' : 'Show'} Nodes
          </button>
          <button
            className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: '#5b8def' }}
            onClick={() => setAssignOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 22 22" fill="currentColor"><path d="M12 2H2v6h10V2zm8 0h-6v6h6V2zM12 12H2v6h10v-6zm8 0h-6v6h6v-6z" fillRule="evenodd"/></svg>
            Assign Server
          </button>
        </div>
      </div>


        {/* Location Tabs */}
        {locationsList.length > 0 && (
          <div className="mb-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: '#313131' }}>
            {locationsList.map(([id, name]) => (
              <button
                key={id}
                onClick={() => setLocationFilter(id)}
                className="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap"
                style={{
                  borderColor: locationFilter === id ? '#5b8def' : 'transparent',
                  color: locationFilter === id ? 'var(--theme-text)' : '#a7aaaa'
                }}>
                {name}
              </button>
            ))}
          </div>
        )}
      {/* Toast */}
      {toast && (
        <div className="fixed right-5 top-20 z-[80] max-w-sm rounded-md border px-4 py-3 text-sm shadow-xl animate-in fade-in slide-in-from-top-2"
          style={{
            backgroundColor: '#151515',
            borderColor: toast.tone === 'ok' ? '#34d399' : toast.tone === 'bad' ? '#f87171' : '#4a4a4a',
            color: toast.tone === 'bad' ? '#f87171' : 'var(--theme-text)',
          }}>
          {toast.text}
        </div>
      )}

      {/* Summary strip */}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Total Servers', value: summary.totalVms },
              { label: 'Running', value: summary.byStatus?.running ?? 0, accent: '#34d399' },
              { label: 'Stopped', value: summary.byStatus?.stopped ?? 0, accent: '#f87171' },
              { label: 'Suspended', value: summary.byStatus?.suspended ?? 0, accent: '#fbbf24' },
              { label: 'Cluster Nodes', value: summary.totalNodes },
              { label: 'Unassigned', value: summary.unassigned },
            ].map(card => (
              <div key={card.label} className="rounded-md border p-4" style={{ backgroundColor: '#0a0a0a', borderColor: '#313131' }}>
                <div style={secLabel}>{card.label}</div>
                <div className="mt-1 text-2xl font-semibold" style={{ color: card.accent || 'var(--theme-text)' }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Allocation breakdown — total CPU & RAM across nodes */}
          <AllocationBreakdown rows={capacityByNode} totalCpus={summary.totalCpus} totalRamGb={summary.totalRamGb} />
        </>
      )}

      {/* Node inventory (collapsible) */}
      {nodesOpen && (
        <div className="mb-5 rounded-md border" style={{ backgroundColor: '#0a0a0a', borderColor: '#313131' }}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: '#313131' }}>
            <div style={secLabel}>Node Inventory — Live from Engine</div>
            <div className="text-xs text-[#71717a]">{nodes.length} node{nodes.length === 1 ? '' : 's'} connected</div>
          </div>
          {nodes.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[#71717a]">No live node metrics available. Cluster connections may be offline.</div>
          ) : (
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {nodes.map(n => (
                <div key={n.node} className="rounded-md border p-4" style={{ borderColor: '#4a4a4a', backgroundColor: '#151515' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: n.status === 'online' ? '#34d399' : '#f87171' }} />
                      <span className="text-sm font-medium text-[#e8e8e8]">{n.name}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#71717a]">{secondsToUptime(n.uptimeSeconds)} up</span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-[#a7aaaa]">
                        <span>CPU</span><span className="font-mono">{n.cpuUsagePct}% · {n.cpuCores} cores</span>
                      </div>
                      <BarTrack value={n.cpuUsagePct} max={100} color="#5b8def" />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-[#a7aaaa]">
                        <span>RAM</span><span className="font-mono">{n.ramUsedGb}/{n.ramTotalGb} GB</span>
                      </div>
                      <BarTrack value={n.ramUsedGb} max={n.ramTotalGb || 1} color="#34d399" />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-[#a7aaaa]">
                        <span>Disk</span><span className="font-mono">{n.diskUsedGb}/{n.diskTotalGb} GB</span>
                      </div>
                      <BarTrack value={n.diskUsedGb} max={n.diskTotalGb || 1} color="#fbbf24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fleet table */}
      <div className="rounded-md border" style={{ backgroundColor: '#0a0a0a', borderColor: '#313131' }}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: '#313131' }}>
          <div className="relative min-w-[240px] flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" width="14" height="14" viewBox="0 0 22 22" fill="currentColor">
              <path d="M16.6 15.18 20.4 19a1 1 0 0 1-1.4 1.4l-3.8-3.82a7 7 0 1 1 1.4-1.4ZM9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"/>
            </svg>
            <input
              className="w-full rounded-md border py-2 pl-9 pr-3 text-sm outline-none"
              style={{ backgroundColor: '#151515', borderColor: '#313131', color: 'var(--theme-text)' }}
              placeholder="Search by VMID, name, client, OS…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-md border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: '#151515', borderColor: '#313131', color: 'var(--theme-text)' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All status</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            className="rounded-md border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: '#151515', borderColor: '#313131', color: 'var(--theme-text)' }}
            value={nodeFilter}
            onChange={e => setNodeFilter(e.target.value)}>
            <option value="all">All nodes</option>
            {nodesList.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select
            className="rounded-md border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: '#151515', borderColor: '#313131', color: 'var(--theme-text)' }}
            value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value as any)}
            title="Carrier Filter"
          >
            <option value="all">All Networks</option>
            <option value="ovh">OVHcloud</option>
            <option value="hetzner">Hetzner</option>
            <option value="custom">Other (Non-OVH)</option>
          </select>
          <select
            className="rounded-md border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: '#151515', borderColor: '#313131', color: 'var(--theme-text)' }}
            value={sortMode}
            onChange={e => setSortMode(e.target.value as any)}
            title="Sort By"
          >
            <option value="carrier">Sort: Carrier (OVH → Hetzner → Other)</option>
            <option value="ip">Sort: IP Address</option>
            <option value="vmid">Sort: VMID</option>
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-[#71717a] sm:inline">{filtered.length}/{vms.length} servers</span>
            {selected.size > 0 && (
              <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
                style={{ borderColor: '#5b8def', color: '#5b8def' }}>
                {selected.size} selected
              </span>
            )}
            <button className="rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: '#313131', color: 'var(--theme-text)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#151515')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              onClick={() => bulkAction('start')}>▶ Start</button>
            <button className="rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: '#313131', color: 'var(--theme-text)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#151515')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              onClick={() => bulkAction('stop')}>■ Stop</button>
            <button className="rounded-md px-3 py-2 text-sm font-medium"
              style={{ backgroundColor: '#5b8def', color: '#ffffff' }}
              onClick={() => fetchFleet(false)}>↻ Refresh</button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading && vms.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-[#71717a]">Loading fleet…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-[#71717a]">
              No servers match your filters.
            </div>
          ) : (
                        <div className="space-y-8">
              
              
              {/* ASSIGNED SERVERS */}
              <div className="ink-block-wrapper shadow-sm mb-8 border border-[#313131]">
                <div className="ink-block-header flex items-center justify-between bg-[var(--theme-surface-muted)]">
                  <div>
                    <h3 className="text-base font-bold text-[var(--theme-text)]">Assigned Servers</h3>
                    <p className="text-xs text-[#a7aaaa] mt-1">Servers currently allocated to a client workspace.</p>
                  </div>
                  <span className="text-xs font-bold text-[var(--theme-text)] bg-[var(--theme-surface-raised)] border border-[#313131] px-2.5 py-1.5 rounded shadow-sm flex items-center">
                    {assignedRows.length} Active
                  </span>
                </div>
                <div className="responsive-table-container">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#313131] bg-[#151515]">
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider w-10"></th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">VMID</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">Name & OS</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">Client</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">Specs</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">Load</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#0a0a0a]">
                      {assignedRows.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-8 text-[#a7aaaa]">No assigned servers.</td></tr>
                      ) : assignedRows.map(v => {
                        const memGb = Math.round((v.maxmem || 8 * 1073741824) / 1073741824);
                        const diskGb = Math.round((v.maxdisk || 64 * 1073741824) / 1073741824);
                        const busy = !!actioning[v.vmKey];
                        const live = v.live;
                        const memPct = live?.memPct ?? (v.memory ? Math.round((v.memory / Math.max(v.maxmem, 1)) * 100) : 0);
                        const cpuPct = live?.cpuPct ?? 0;
                        const selectedRow = selected.has(v.vmKey);
                        return (
                          <tr key={v.vmKey} className="border-b border-[#313131] transition-colors hover:bg-[var(--theme-surface-raised)] group">
                            <td className="px-4 py-4">
                              <input type="checkbox" checked={selectedRow} onChange={() => { const s = new Set(selected); if (s.has(v.vmKey)) s.delete(v.vmKey); else s.add(v.vmKey); setSelected(s); }} className="accent-[var(--theme-accent)] w-4 h-4 rounded cursor-pointer" />
                            </td>
                            <td className="px-4 py-4 font-mono text-[12px] font-semibold text-[#a7aaaa]">{v.vmid}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-[var(--theme-text)]">{v.name}</span>
                                <span className="text-[11px] font-medium text-[#a7aaaa] flex items-center gap-1.5 flex-wrap">
                                  <span>{v.displayNode || v.nodeDisplayName || v.proxmoxConnectionName} • {v.os !== '—' ? v.os : (v.type === 'lxc' ? 'Container' : 'Virtual Machine')}</span>
                                  {v.ipAddress && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono text-[#d4d4d8]">{v.ipAddress}</span>
                                      {(() => {
                                        const ipType = getIpCarrierType(v.ipAddress, ovhIps, hetznerIps);
                                        return (
                                          <CarrierLogoBadge carrier={ipType.carrier} size={15} />
                                        );
                                      })()}
                                    </>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-[13px] font-medium text-[var(--theme-text)]">{v.ownerEmail}</td>
                            <td className="px-4 py-4"><StatusPill status={v.status} isSuspended={v.isSuspended} /></td>
                            <td className="px-4 py-4">
                              <div className="flex items-baseline gap-1.5 font-mono text-[12px] text-[var(--theme-text)] whitespace-nowrap font-semibold">
                                <span>{v.cpus}C</span><span className="text-[#313131]">|</span>
                                <span>{memGb}G</span><span className="text-[#313131]">|</span>
                                <span>{diskGb}G</span>
                              </div>
                              <div className="text-[11px] text-[#a7aaaa] mt-1 font-medium">{v.type === 'lxc' ? 'LXC' : 'QEMU'} • {v.node}</div>
                            </td>
                            <td className="px-4 py-4">
                              {live ? (
                                <div className="flex flex-col gap-1.5 w-28">
                                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-[#a7aaaa]"><div className="h-1.5 flex-1 bg-[var(--theme-surface-raised)] rounded-full overflow-hidden"><div className="h-full bg-[var(--theme-accent)]" style={{ width: `${cpuPct}%` }} /></div>{cpuPct}%</div>
                                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-[#a7aaaa]"><div className="h-1.5 flex-1 bg-[var(--theme-surface-raised)] rounded-full overflow-hidden"><div className="h-full bg-[var(--theme-success)]" style={{ width: `${memPct}%` }} /></div>{memPct}%</div>
                                </div>
                              ) : <span className="text-[11px] font-medium text-[#a7aaaa]">Offline</span>}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2.5 transition-opacity">
                                {live && (
                                  <a href={`/admin/vnc/${v.vmid}?proxmoxConnectionId=${encodeURIComponent(v.proxmoxConnectionId || '')}`} target="_blank" rel="noreferrer" className="btn-secondary py-1 px-3 text-[11px] whitespace-nowrap shadow-sm">VNC</a>
                                )}
                                <button className="btn-secondary py-1 px-3 text-[11px] whitespace-nowrap shadow-sm" onClick={() => setEditVM(v)}>Edit</button>
                                <button className="btn-secondary py-1 px-3 text-[11px] whitespace-nowrap shadow-sm text-[var(--theme-danger)] !border-[var(--theme-danger)]/50 hover:!bg-[var(--theme-danger)]/10" onClick={() => runUnassign(v)}>Unassign</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* UNASSIGNED SERVERS (FREE POOL) */}
              <div className="ink-block-wrapper shadow-sm mb-6 border border-[#313131]">
                <div className="ink-block-header flex items-center justify-between bg-[var(--theme-surface-muted)]">
                  <div>
                    <h3 className="text-base font-bold text-[var(--theme-text)]">Unassigned Servers (Free Pool)</h3>
                    <p className="text-xs text-[#a7aaaa] mt-1">Servers waiting to be assigned to new clients.</p>
                  </div>
                  <span className="text-xs font-bold text-[var(--theme-text)] bg-[var(--theme-surface-raised)] border border-[#313131] px-2.5 py-1.5 rounded shadow-sm flex items-center">
                    {unassignedRows.length} Free
                  </span>
                </div>
                <div className="responsive-table-container">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#313131] bg-[#151515]">
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider w-10"></th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">VMID</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">Name & OS</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">Specs</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider">Load</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-[#a7aaaa] uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#0a0a0a]">
                      {unassignedRows.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-8 text-[#a7aaaa]">No servers in the free pool.</td></tr>
                      ) : unassignedRows.map(v => {
                        const memGb = Math.round((v.maxmem || 8 * 1073741824) / 1073741824);
                        const diskGb = Math.round((v.maxdisk || 64 * 1073741824) / 1073741824);
                        const busy = !!actioning[v.vmKey];
                        const live = v.live;
                        const memPct = live?.memPct ?? (v.memory ? Math.round((v.memory / Math.max(v.maxmem, 1)) * 100) : 0);
                        const cpuPct = live?.cpuPct ?? 0;
                        const selectedRow = selected.has(v.vmKey);
                        return (
                          <tr key={v.vmKey} className="border-b border-[#313131] transition-colors hover:bg-[var(--theme-surface-raised)] group">
                            <td className="px-4 py-4">
                              <input type="checkbox" checked={selectedRow} onChange={() => { const s = new Set(selected); if (s.has(v.vmKey)) s.delete(v.vmKey); else s.add(v.vmKey); setSelected(s); }} className="accent-[var(--theme-accent)] w-4 h-4 rounded cursor-pointer" />
                            </td>
                            <td className="px-4 py-4 font-mono text-[12px] font-semibold text-[#a7aaaa]">{v.vmid}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-[var(--theme-text)]">{v.name}</span>
                                <span className="text-[11px] font-medium text-[#a7aaaa]">
                                  {v.displayNode || v.nodeDisplayName || v.proxmoxConnectionName} • {v.os !== '—' ? v.os : (v.type === 'lxc' ? 'Container' : 'Virtual Machine')}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4"><StatusPill status={v.status} isSuspended={v.isSuspended} /></td>
                            <td className="px-4 py-4">
                              <div className="flex items-baseline gap-1.5 font-mono text-[12px] text-[var(--theme-text)] whitespace-nowrap font-semibold">
                                <span>{v.cpus}C</span><span className="text-[#313131]">|</span>
                                <span>{memGb}G</span><span className="text-[#313131]">|</span>
                                <span>{diskGb}G</span>
                              </div>
                              <div className="text-[11px] text-[#a7aaaa] mt-1 font-medium">{v.type === 'lxc' ? 'LXC' : 'QEMU'} • {v.node}</div>
                            </td>
                            <td className="px-4 py-4">
                              {live ? (
                                <div className="flex flex-col gap-1.5 w-28">
                                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-[#a7aaaa]"><div className="h-1.5 flex-1 bg-[var(--theme-surface-raised)] rounded-full overflow-hidden"><div className="h-full bg-[var(--theme-accent)]" style={{ width: `${cpuPct}%` }} /></div>{cpuPct}%</div>
                                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-[#a7aaaa]"><div className="h-1.5 flex-1 bg-[var(--theme-surface-raised)] rounded-full overflow-hidden"><div className="h-full bg-[var(--theme-success)]" style={{ width: `${memPct}%` }} /></div>{memPct}%</div>
                                </div>
                              ) : <span className="text-[11px] font-medium text-[#a7aaaa]">Offline</span>}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2.5 transition-opacity">
                                {live && (
                                  <a href={`/admin/vnc/${v.vmid}?proxmoxConnectionId=${encodeURIComponent(v.proxmoxConnectionId || '')}`} target="_blank" rel="noreferrer" className="btn-secondary py-1 px-3 text-[11px] whitespace-nowrap shadow-sm">VNC</a>
                                )}
                                <button className="btn-secondary py-1 px-3 text-[11px] whitespace-nowrap shadow-sm" onClick={() => setEditVM(v)}>Edit</button>
                                <button className="btn-primary py-1 px-4 text-[11px] whitespace-nowrap shadow-md" onClick={() => setAssignVM(v)}>Assign Server</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          )}
        </div>
        <div className="border-t px-4 py-2.5 text-[11px] text-[#71717a]" style={{ borderColor: '#313131' }}>
          Power actions execute on the live engine and sync the panel record. “Free” returns a server to the unassigned pool — it does not destroy data.
        </div>
      </div>

      {/* Edit VM modal */}
      {editVM && <EditVMModal vm={editVM} ovhIps={ovhIps} hetznerIps={hetznerIps} onClose={() => setEditVM(null)} onSaved={async () => { setEditVM(null); await fetchFleet(); flash('Server updated', 'ok'); }} apiHeaders={apiHeaders} base={base} flash={flash} />}

      
      {/* Assign existing VM modal */}
      {assignVM && <AssignModal
        vm={assignVM}
        onClose={() => setAssignVM(null)}
        apiHeaders={apiHeaders}
        base={base}
        onAssigned={() => { setAssignVM(null); fetchFleet(); }}
        flash={flash} />}
{/* Assign wizard */}
      {assignOpen && <ProvisionWizard
        onClose={() => setAssignOpen(false)}
        apiHeaders={apiHeaders}
        base={base}
        onAssigned={() => { setAssignOpen(false); fetchFleet(); }}
        flash={flash} />}
    </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ActionButton (shared power button)
// ---------------------------------------------------------------------------
const ActionButton: React.FC<{
  label: string; onClick: () => void; disabled?: boolean; loading?: boolean;
  tone: 'danger' | 'success' | 'neutral'; onHoverIn: string;
}> = ({ label, onClick, disabled, loading, tone, onHoverIn }) => {
  const color = tone === 'danger' ? '#f87171' : tone === 'success' ? '#34d399' : 'var(--theme-text)';
  return (
    <button
      className="rounded border px-2 py-1 text-[11px] font-medium disabled:opacity-40"
      style={{ borderColor: '#313131', color }}
      disabled={disabled}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = onHoverIn)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      onClick={onClick}>
      {loading ? '…' : label}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Edit VM Modal
// ---------------------------------------------------------------------------
const EditVMModal: React.FC<{
  vm: FleetVM;
  ovhIps?: string[];
  hetznerIps?: string[];
  onClose: () => void;
  onSaved: () => void;
  apiHeaders: () => Record<string, string>;
  base: string;
  flash: (text: string, tone: 'ok' | 'bad' | 'info') => void;
}> = ({ vm, ovhIps = [], hetznerIps = [], onClose, onSaved, apiHeaders, base, flash }) => {
  const [name, setName] = useState(vm.name);
  const [os, setOs] = useState(vm.os === '—' ? 'Ubuntu 24.04 LTS' : vm.os);
  const [ipAddress, setIpAddress] = useState(vm.ipAddress || '');
  const [displayCpuModel, setDisplayCpuModel] = useState(vm.displayCpuModel || '');
  const [displayNode, setDisplayNode] = useState(vm.displayNode || '');
  const [cpus, setCpus] = useState(String(vm.cpus || 2));
  const [memoryGb, setMemoryGb] = useState(String(Math.round((vm.maxmem || 8 * 1073741824) / 1073741824)));
  const [diskGb, setDiskGb] = useState(String(Math.round((vm.maxdisk || 64 * 1073741824) / 1073741824)));
  const [expiryDays, setExpiryDays] = useState('30');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { flash('Server name is required', 'bad'); return; }
    const cpusN = Number(cpus);
    const memN = Number(memoryGb);
    const diskN = Number(diskGb);
    if (!cpusN || cpusN < 1 || cpusN > 256) { flash('CPU cores must be 1–256', 'bad'); return; }
    if (!memN || memN < 1) { flash('RAM must be at least 1 GB', 'bad'); return; }
    if (!diskN || diskN < 5) { flash('Disk must be at least 5 GB', 'bad'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${base}/vms/${vm.vmid}/update`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          proxmoxConnectionId: vm.proxmoxConnectionId,
          name: name.trim(),
          os: os.trim(),
          ipAddress: ipAddress.trim(),
          displayCpuModel: displayCpuModel.trim() || null,
          displayNode: displayNode.trim() || null,
          cpus: cpusN,
          memoryGb: memN,
          diskGb: diskN,
          expiryDays: Number(expiryDays) || undefined,
        }),
      });
      const j = await res.json();
      if (res.ok) onSaved();
      else flash(`Update failed: ${j.error}`, 'bad');
    } catch (e: any) {
      flash('Update failed', 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Edit Server — VMID ${vm.vmid}`} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Server name"><input style={modalInputCls} value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Operating system"><input style={modalInputCls} value={os} onChange={e => setOs(e.target.value)} /></Field>
        <Field label="IP address (optional)">
          <input style={modalInputCls} value={ipAddress} onChange={e => setIpAddress(e.target.value)} placeholder="e.g. 192.0.2.10" />
          {ipAddress.trim() && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px]">
              {(() => {
                const ipType = getIpCarrierType(ipAddress.trim(), ovhIps, hetznerIps);
                return (
                  <>
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] border ${ipType.badgeClass}`}>
                      {ipType.label}
                    </span>
                    <span className="text-[#a7aaaa] text-[10.5px]">
                      {ipType.isOvh ? 'OVH Hardware Anti-DDoS & vMAC ready' : ipType.isHetzner ? 'Hetzner Robot (vMAC & PTR supported)' : 'External Network Carrier'}
                    </span>
                  </>
                );
              })()}
            </div>
          )}
        </Field>
        <Field label="Expiry extension (days)"><input type="number" style={modalInputCls} value={expiryDays} onChange={e => setExpiryDays(e.target.value)} placeholder="30" /></Field>
        <Field label="CPU cores"><input type="number" style={modalInputCls} value={cpus} onChange={e => setCpus(e.target.value)} /></Field>
        <Field label="RAM (GB)"><input type="number" style={modalInputCls} value={memoryGb} onChange={e => setMemoryGb(e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <Field label="Disk (GB)"><input type="number" style={modalInputCls} value={diskGb} onChange={e => setDiskGb(e.target.value)} /></Field>
        </div>

        <div className="sm:col-span-2 border-t border-[#313131] pt-3 mt-1">
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
            <span className="block text-[11px] font-medium uppercase text-[#a7aaaa] tracking-[0.14em]">Display Processor / CPU Model</span>
            <div className="flex gap-1.5 flex-wrap">
              {['AMD Ryzen 5 7600X', 'AMD Ryzen 7 7700X', 'AMD Ryzen 9 7950X', 'AMD EPYC 9654'].map(preset => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setDisplayCpuModel(preset)}
                  className="px-2 py-0.5 text-[10px] font-mono rounded border border-[#313131] bg-[#222] text-[#38bdf8] hover:bg-[#333] transition-colors cursor-pointer"
                >
                  {preset.replace('AMD ', '')}
                </button>
              ))}
            </div>
          </div>
          <input 
            style={modalInputCls} 
            value={displayCpuModel} 
            onChange={e => setDisplayCpuModel(e.target.value)} 
            placeholder="e.g. AMD Ryzen 5 7600X (Customer sees this instead of host hardware)" 
          />
          <p className="text-[10px] text-[#71717a] mt-1">Custom CPU model presented to the client across the panel, hardware metadata, and PDF reports.</p>
        </div>

        <div className="sm:col-span-2">
          <Field label="Display Node / Cluster Name">
            <input 
              style={modalInputCls} 
              value={displayNode} 
              onChange={e => setDisplayNode(e.target.value)} 
              placeholder="e.g. SG-Ryzen5-Compute (Overrides host node name for this specific VM)" 
            />
          </Field>
          <p className="text-[10px] text-[#71717a] mt-1">Virtual node alias displayed to the client under Host Node.</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <ModalButton secondary onClick={onClose} label="Cancel" />
        <ModalButton primary onClick={save} disabled={saving} label={saving ? 'Saving…' : 'Save changes'} />
      </div>
    </ModalShell>
  );
};

const modalInputCls: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#151515',
  borderColor: '#313131',
  color: 'var(--theme-text)',
  borderRadius: 6,
  borderWidth: 1,
  borderStyle: 'solid',
  padding: '8px 10px',
  fontSize: 13,
  outline: 'none',
};

// ---------------------------------------------------------------------------
// Assign Wizard (3 steps)
// ---------------------------------------------------------------------------
const PRESETS = [
  { name: 'Starter', cpus: 1, memoryGb: 1, diskGb: 20 },
  { name: 'Standard', cpus: 2, memoryGb: 4, diskGb: 50 },
  { name: 'Pro', cpus: 4, memoryGb: 8, diskGb: 100 },
];

const OS_OPTIONS = ['Ubuntu 24.04 LTS', 'Debian 12', 'AlmaLinux 9', 'Windows Server 2022', 'CentOS Stream 9', 'Rocky Linux 9', 'Fedora 40', 'Alpine Linux 3.19'];

const ProvisionWizard: React.FC<{
  onClose: () => void;
  apiHeaders: () => Record<string, string>;
  base: string;
  onAssigned: () => void;
  flash: (text: string, tone: 'ok' | 'bad' | 'info') => void;
}> = ({ onClose, apiHeaders, base, onAssigned, flash }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [nodes, setNodes] = useState<WizardNode[]>([]);
  const [accounts, setAccounts] = useState<WizardAccount[]>([]);
  const [nextFreeVmid, setNextFreeVmid] = useState(100);
  const [nodeIdx, setNodeIdx] = useState(0);
  const [vmid, setVmid] = useState('');
  const [vmType, setVmType] = useState<'qemu' | 'lxc'>('qemu');
  const [autoVmid, setAutoVmid] = useState(true);

  // Step 2
  const [name, setName] = useState('');
  const [os, setOs] = useState('Ubuntu 24.04 LTS');
  const [cpus, setCpus] = useState(2);
  const [memoryGb, setMemoryGb] = useState(4);
  const [diskGb, setDiskGb] = useState(50);

  // Step 3
  const [client, setClient] = useState('');
  const [clientOpen, setClientOpen] = useState(false);
  const [expiryDays, setExpiryDays] = useState('30');
  const [searchClient, setSearchClient] = useState('');

  const clientRef = useRef<HTMLDivElement>(null);

  const effectiveVmid = autoVmid ? nextFreeVmid : (Number(vmid) || nextFreeVmid);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${base}/vms/options`, { headers: apiHeaders() });
        const j = await res.json();
        if (res.ok && j.data) {
          setNodes(j.data.nodes || []);
          setAccounts(j.data.accounts || []);
          setNextFreeVmid(j.data.nextFreeVmid || 100);
        } else flash('Could not load assignment options', 'bad');
      } catch (e: any) {
        flash('Network error loading options', 'bad');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setClientOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyPreset = (p: typeof PRESETS[number]) => {
    setCpus(p.cpus); setMemoryGb(p.memoryGb); setDiskGb(p.diskGb);
  };

  const selectedAccount = useMemo(() => accounts.find(a => a.email === client), [accounts, client]);

  const filteredAccounts = useMemo(() => {
    const q = searchClient.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(a => `${a.email} ${a.name || ''}`.toLowerCase().includes(q));
  }, [accounts, searchClient]);

  const next = () => {
    if (step === 1) {
      if (nodes.length === 0) { flash('No nodes available', 'bad'); return; }
      setStep(2);
    } else if (step === 2) {
      if (!name.trim()) { flash('Server name is required', 'bad'); return; }
      setStep(3);
    }
  };

  const submit = async () => {
    if (!selectedAccount) { flash('Select a client to receive the server', 'bad'); return; }
    if (!Number(expiryDays) || Number(expiryDays) < 1) { flash('Expiry must be at least 1 day', 'bad'); return; }
    setSubmitting(true);
    try {
      const chosenNode = nodes[nodeIdx];
      const res = await fetch('/api/v1/admin/vms/provision', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          vmid: effectiveVmid,
          name: name.trim(),
          type: vmType,
          node: chosenNode.node,
          targetEmail: selectedAccount.email,
          cpus, memoryGb, diskGb,
          expiryDays: Number(expiryDays),
          os,
        }),
      });
      const j = await res.json();
      if (res.ok) {
        flash(`VMID ${effectiveVmid} assigned to ${selectedAccount.email}`, 'ok');
        onAssigned();
      } else {
        flash(`Assignment failed: ${j.error || 'Unknown error'}`, 'bad');
      }
    } catch (e: any) {
      flash('Assignment failed', 'bad');
    } finally {
      setSubmitting(false);
    }
  };

  const secLabel: React.CSSProperties = {
    fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a7aaaa', fontWeight: 500,
  };

  const stepDots = (
    <div className="mb-5 flex items-center gap-2">
      {[1, 2, 3].map(n => (
        <React.Fragment key={n}>
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium"
              style={{
                borderColor: n <= step ? '#5b8def' : '#313131',
                backgroundColor: n < step ? '#5b8def' : 'transparent',
                color: n < step ? '#ffffff' : '#a7aaaa',
              }}>
              {n < step ? '✓' : n}
            </span>
            <span className="text-[11px]" style={{ color: n === step ? 'var(--theme-text)' : '#a7aaaa' }}>
              {n === 1 ? 'Target' : n === 2 ? 'Specs' : 'Client'}
            </span>
          </div>
          {n < 3 && <span className="h-px w-8" style={{ backgroundColor: '#313131' }} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <ModalShell title="Assign Server" subtitle="Three steps — pick a target, configure specs, choose the client." onClose={onClose} wide>
      {stepDots}

      {loading ? (
        <div className="py-10 text-center text-sm text-[#71717a]">Loading assignment options…</div>
      ) : (
        <>
          {/* STEP 1 — TARGET */}
          {step === 1 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Field label="Compute node">
                  <select
                    style={modalSelectCls}
                    value={nodeIdx}
                    onChange={e => setNodeIdx(Number(e.target.value))}>
                    {nodes.map((n, i) => (
                      <option key={n.node} value={i}>{n.name} {n.node !== 'auto' ? `(${n.node})` : ''}</option>
                    ))}
                  </select>
                </Field>
                <p className="mt-2 text-[11px] text-[#71717a]">The server is created on the selected engine node. {nodes.length === 1 ? 'One node is connected.' : `${nodes.length} nodes available.`}</p>
              </div>
              <div>
                <Field label={`VMID — next free is ${nextFreeVmid}`}>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded border px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap"
                      style={{ borderColor: autoVmid ? '#5b8def' : '#313131', color: autoVmid ? '#5b8def' : '#a7aaaa' }}
                      onClick={() => setAutoVmid(true)}>Auto ({nextFreeVmid})</button>
                    <button
                      className="rounded border px-2.5 py-1.5 text-[11px] font-medium"
                      style={{ borderColor: autoVmid ? '#313131' : '#5b8def', color: autoVmid ? '#a7aaaa' : '#5b8def' }}
                      onClick={() => setAutoVmid(false)}>Manual</button>
                    <input
                      style={modalInputCls}
                      disabled={autoVmid}
                      placeholder={String(nextFreeVmid)}
                      value={vmid}
                      onChange={e => setVmid(e.target.value)}
                    />
                  </div>
                </Field>
              </div>
              <div>
                <Field label="Server type">
                  <div className="flex items-center gap-2">
                    {(['qemu', 'lxc'] as const).map(t => (
                      <button key={t}
                        className="rounded border px-3 py-1.5 text-[12px] font-medium"
                        style={{
                          borderColor: vmType === t ? '#5b8def' : '#313131',
                          backgroundColor: vmType === t ? 'rgba(91,141,239,0.12)' : 'transparent',
                          color: vmType === t ? '#5b8def' : '#a7aaaa',
                        }}
                        onClick={() => setVmType(t)}>
                        {t === 'qemu' ? 'QEMU — Full VM' : 'LXC — Container'}
                      </button>
                    ))}
                  </div>
                </Field>
                <p className="mt-2 text-[11px] text-[#71717a]">QEMU runs a full OS (Windows/Linux ISO). LXC containers share the kernel and boot instantly.</p>
              </div>
              <div className="rounded-md border p-4" style={{ borderColor: '#4a4a4a', backgroundColor: '#151515' }}>
                <div style={secLabel}>Review — target</div>
                <dl className="mt-3 space-y-1.5 text-[13px]">
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">Node</dt><dd className="font-medium text-[#e8e8e8]">{nodes[nodeIdx]?.name}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">VMID</dt><dd className="font-mono text-[#e8e8e8]">{effectiveVmid}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">Type</dt><dd className="font-medium text-[#e8e8e8]">{vmType === 'qemu' ? 'Full virtual machine' : 'Container'}</dd></div>
                </dl>
              </div>
            </div>
          )}

          {/* STEP 2 — SPECS */}
          {step === 2 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <Field label="Presets">
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map(p => (
                      <button key={p.name}
                        className="rounded-md border px-4 py-2 text-[13px] font-medium transition-colors"
                        style={{
                          borderColor: cpus === p.cpus && memoryGb === p.memoryGb && diskGb === p.diskGb ? '#5b8def' : '#313131',
                          backgroundColor: cpus === p.cpus && memoryGb === p.memoryGb && diskGb === p.diskGb ? 'rgba(91,141,239,0.12)' : 'transparent',
                          color: cpus === p.cpus && memoryGb === p.memoryGb && diskGb === p.diskGb ? '#5b8def' : 'var(--theme-text)',
                        }}
                        onClick={() => applyPreset(p)}>
                        {p.name} <span className="font-mono text-[11px] opacity-60">{p.cpus}C · {p.memoryGb}G · {p.diskGb}G</span>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Server name">
                  <input style={modalInputCls} placeholder="e.g. prod-api-01" value={name} onChange={e => setName(e.target.value)} />
                </Field>
              </div>
              <div>
                <Field label="Operating system">
                  <select style={modalSelectCls} value={os} onChange={e => setOs(e.target.value)}>
                    {OS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="CPU cores"><input type="number" style={modalInputCls} value={cpus} onChange={e => setCpus(Math.max(1, Number(e.target.value) || 1))} /></Field>
                <Field label="RAM (GB)"><input type="number" style={modalInputCls} value={memoryGb} onChange={e => setMemoryGb(Math.max(1, Number(e.target.value) || 1))} /></Field>
                <Field label="Disk (GB)"><input type="number" style={modalInputCls} value={diskGb} onChange={e => setDiskGb(Math.max(5, Number(e.target.value) || 5))} /></Field>
              </div>
            </div>
          )}

          {/* STEP 3 — CLIENT */}
          {step === 3 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="relative" ref={clientRef}>
                <Field label="Client account">
                  <input
                    style={modalInputCls}
                    placeholder="Search by email or name…"
                    value={clientOpen ? searchClient : client}
                    onFocus={() => { setClientOpen(true); setSearchClient(client); }}
                    onChange={e => { setClientOpen(true); setSearchClient(e.target.value); setClient(''); }}
                  />
                  {clientOpen && (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border"
                      style={{ backgroundColor: '#151515', borderColor: '#313131' }}>
                      {filteredAccounts.length === 0 && (
                        <li className="px-3 py-2 text-[12px] text-[#71717a]">No accounts match.</li>
                      )}
                      {filteredAccounts.map(a => (
                        <li key={a.id}
                          className="cursor-pointer px-3 py-2 text-[13px] hover:bg-[#262626]"
                          onClick={() => { setClient(a.email); setClientOpen(false); }}>
                          <span className="font-medium text-[#e8e8e8]">{a.email}</span>
                          <span className="ml-2 text-[11px] text-[#71717a]">{a.name || '—'} · {a.role || 'client'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Field>
                {selectedAccount && (
                  <div className="mt-3 rounded-md border p-3 text-[12px]" style={{ borderColor: '#4a4a4a', backgroundColor: '#151515' }}>
                    <span className="text-[#a7aaaa]">Selected: </span>
                    <span className="font-medium text-[#e8e8e8]">{selectedAccount.email}</span>
                    {selectedAccount.name && <span className="text-[#a7aaaa]"> — {selectedAccount.name}</span>}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-[#71717a]">{accounts.length} client account{accounts.length === 1 ? '' : 's'} exist in the panel.</p>
              </div>
              <div>
                <Field label="Billing cycle (days)">
                  <div className="flex items-center gap-2">
                    {[7, 30, 90, 365].map(d => (
                      <button key={d}
                        className="rounded border px-3 py-1.5 text-[12px] font-medium"
                        style={{
                          borderColor: expiryDays === String(d) ? '#5b8def' : '#313131',
                          backgroundColor: expiryDays === String(d) ? 'rgba(91,141,239,0.12)' : 'transparent',
                          color: expiryDays === String(d) ? '#5b8def' : '#a7aaaa',
                        }}
                        onClick={() => setExpiryDays(String(d))}>
                        {d === 365 ? '1 year' : `${d}d`}
                      </button>
                    ))}
                    <input style={modalInputCls} placeholder="Custom" value={expiryDays}
                      onChange={e => setExpiryDays(e.target.value)} />
                  </div>
                </Field>
              </div>
              <div className="lg:col-span-2 rounded-md border p-4" style={{ borderColor: '#4a4a4a', backgroundColor: '#151515' }}>
                <div style={secLabel}>Assignment review</div>
                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">VMID</dt><dd className="font-mono text-[#e8e8e8]">{effectiveVmid}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">Name</dt><dd className="text-[#e8e8e8]">{name || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">Type</dt><dd className="text-[#e8e8e8]">{vmType === 'qemu' ? 'QEMU VM' : 'LXC Container'}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">OS</dt><dd className="text-[#e8e8e8]">{os}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">CPU</dt><dd className="font-mono text-[#e8e8e8]">{cpus} core{cpus === 1 ? '' : 's'}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">RAM</dt><dd className="font-mono text-[#e8e8e8]">{memoryGb} GB</dd></div>
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">Disk</dt><dd className="font-mono text-[#e8e8e8]">{diskGb} GB</dd></div>
                  <div className="flex justify-between"><dt className="text-[#a7aaaa]">Expiry</dt><dd className="font-mono text-[#e8e8e8]">{expiryDays} day{Number(expiryDays) === 1 ? '' : 's'}</dd></div>
                  <div className="flex justify-between sm:col-span-2"><dt className="text-[#a7aaaa]">Client</dt><dd className="font-medium text-[#e8e8e8]">{client || '— none selected —'}</dd></div>
                </dl>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: '#313131' }}>
            <button
              className="rounded-md border px-4 py-2 text-[13px] font-medium"
              style={{ borderColor: '#313131', color: 'var(--theme-text)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#151515')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              onClick={() => (step > 1 ? setStep(step - 1) : onClose())}>
              {step > 1 ? 'Back' : 'Cancel'}
            </button>
            {step < 3 ? (
              <button
                className="rounded-md px-5 py-2 text-[13px] font-medium text-white"
                style={{ backgroundColor: '#5b8def' }}
                onClick={next}>
                Continue
              </button>
            ) : (
              <button
                className="rounded-md px-5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#5b8def' }}
                disabled={submitting}
                onClick={submit}>
                {submitting ? 'Assigning…' : `Assign VMID ${effectiveVmid}`}
              </button>
            )}
          </div>
        </>
      )}
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Modal shell + field helpers (shared)
// ---------------------------------------------------------------------------
const ModalShell: React.FC<{
  title: string; subtitle?: string; onClose: () => void; wide?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, wide, children }) => (
  <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="my-8 w-full rounded-lg border"
      style={{
        backgroundColor: '#0a0a0a',
        borderColor: '#313131',
        maxWidth: wide ? 860 : 560,
        boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
      }}
      onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between border-b px-5 py-4" style={{ borderColor: '#313131' }}>
        <div>
          <h2 className="text-[15px] font-semibold text-[#e8e8e8]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-[#71717a]">{subtitle}</p>}
        </div>
        <button className="rounded-md p-1 text-[#71717a] hover:text-[#e8e8e8]" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 22 22" fill="currentColor"><path d="M6.3 4.9a1 1 0 0 0-1.4 1.4L9.6 11 4.9 15.7a1 1 0 1 0 1.4 1.4L11 12.4l4.7 4.7a1 1 0 0 0 1.4-1.4L12.4 11l4.7-4.7a1 1 0 1 0-1.4-1.4L11 9.6 6.3 4.9Z"/></svg>
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-[11px] font-medium uppercase" style={{ letterSpacing: '0.14em', color: '#a7aaaa' }}>{label}</span>
    {children}
  </label>
);

const ModalButton: React.FC<{
  label: string; onClick: () => void; primary?: boolean; secondary?: boolean; disabled?: boolean;
}> = ({ label, onClick, primary, secondary, disabled }) => {
  const style: React.CSSProperties = primary
    ? { backgroundColor: '#5b8def', color: '#ffffff' }
    : { borderColor: '#313131', color: 'var(--theme-text)', backgroundColor: 'transparent' };
  return (
    <button
      className="rounded-md border px-4 py-2 text-[13px] font-medium disabled:opacity-50"
      style={style}
      disabled={disabled}
      onMouseEnter={e => secondary && (e.currentTarget.style.backgroundColor = '#151515')}
      onMouseLeave={e => secondary && (e.currentTarget.style.backgroundColor = 'transparent')}
      onClick={onClick}>
      {label}
    </button>
  );
};

const modalSelectCls: React.CSSProperties = {
  ...modalInputCls,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 22 22'%3E%3Cpath fill='%23a7aaaa' d='M11 14 5 8h12l-6 6Z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 30,
};



const AssignModal: React.FC<{
  vm: FleetVM;
  onClose: () => void;
  apiHeaders: () => Record<string, string>;
  base: string;
  onAssigned: () => void;
  flash: (text: string, tone: 'ok' | 'bad' | 'info') => void;
}> = ({ vm, onClose, apiHeaders, base, onAssigned, flash }) => {
  const [client, setClient] = useState('');
  const [expiryMode, setExpiryMode] = useState<'duration' | 'custom' | 'never'>('duration');
  const [expiryDays, setExpiryDays] = useState('30');
  
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  
  const [submitting, setSubmitting] = useState(false);
  
  const submit = async () => {
    if (!client.includes('@')) { flash('Enter a valid client email', 'bad'); return; }
    
    let finalExpiryDate: number | undefined;
    let neverExpire = false;
    
    if (expiryMode === 'never') {
      neverExpire = true;
    } else if (expiryMode === 'custom') {
      finalExpiryDate = new Date(customDate).getTime();
    } else {
      finalExpiryDate = Date.now() + (Number(expiryDays) * 24 * 60 * 60 * 1000);
    }
    
    setSubmitting(true);
    try {
      const res = await fetch(`${base}/vms/assign`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          vmid: vm.vmid,
          targetEmail: client.trim(),
          expiryDate: finalExpiryDate,
          neverExpire,
          proxmoxConnectionId: vm.proxmoxConnectionId
        })
      });
      const j = await res.json();
      if (res.ok) {
        flash(`VMID ${vm.vmid} successfully assigned to ${client}`, 'ok');
        onAssigned();
      } else {
        flash(`Assignment failed: ${j.error}`, 'bad');
      }
    } catch (e: any) {
      flash('Assignment failed', 'bad');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0a0a0a] border border-[#313131] rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#313131] bg-[#151515] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--theme-text)]">Assign Server: VMID {vm.vmid}</h2>
            <p className="text-sm font-medium text-[#a7aaaa] mt-1">Node: {vm.node} | Specs: {vm.cpus}C / {Math.round((vm.maxmem || 8*1024*1024*1024)/1024/1024/1024)}GB</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#a7aaaa] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface-raised)] rounded-md transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#a7aaaa] uppercase tracking-widest">Client Email Address</label>
            <input 
              className="w-full p-3 bg-[var(--theme-surface-muted)] border border-[#313131] rounded-lg text-[var(--theme-text)] text-sm focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)] outline-none transition-all placeholder-[#a7aaaa]/50 font-medium" 
              placeholder="client@example.com" 
              value={client} 
              onChange={e => setClient(e.target.value)} 
            />
          </div>
          
          <div className="space-y-4">
            <label className="block text-xs font-bold text-[#a7aaaa] uppercase tracking-widest">Expiry Configuration</label>
            
            <div className="flex bg-[#151515] border border-[#313131] rounded-lg overflow-hidden p-1 gap-1">
              <button 
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${expiryMode === 'duration' ? 'bg-[var(--theme-surface-raised)] text-[var(--theme-accent)] shadow-sm' : 'text-[#a7aaaa] hover:text-[var(--theme-text)]'}`}
                onClick={() => setExpiryMode('duration')}
              >
                Duration
              </button>
              <button 
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${expiryMode === 'custom' ? 'bg-[var(--theme-surface-raised)] text-[var(--theme-accent)] shadow-sm' : 'text-[#a7aaaa] hover:text-[var(--theme-text)]'}`}
                onClick={() => setExpiryMode('custom')}
              >
                Custom Date
              </button>
              <button 
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${expiryMode === 'never' ? 'bg-[var(--theme-surface-raised)] text-[var(--theme-accent)] shadow-sm' : 'text-[#a7aaaa] hover:text-[var(--theme-text)]'}`}
                onClick={() => setExpiryMode('never')}
              >
                Never Expire
              </button>
            </div>

            {expiryMode === 'duration' && (
              <div className="flex flex-wrap items-center gap-3 animate-in slide-in-from-top-1 fade-in duration-200">
                {[7, 30, 90, 365].map(d => (
                  <button key={d}
                    className="rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all shadow-sm"
                    style={{
                      borderColor: expiryDays === String(d) ? 'var(--theme-accent)' : '#313131',
                      backgroundColor: expiryDays === String(d) ? 'color-mix(in srgb, var(--theme-accent) 15%, transparent)' : '#151515',
                      color: expiryDays === String(d) ? 'var(--theme-accent)' : '#a7aaaa',
                    }}
                    onClick={() => setExpiryDays(String(d))}>
                    {d === 365 ? '1 Year' : `${d} Days`}
                  </button>
                ))}
                <input 
                  className="flex-1 p-3 bg-[var(--theme-surface-muted)] border border-[#313131] rounded-lg text-[var(--theme-text)] text-sm focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)] outline-none transition-all placeholder-[#a7aaaa]/50 font-medium min-w-[100px]" 
                  placeholder="Custom Days" 
                  type="number"
                  min="1"
                  value={expiryDays} 
                  onChange={e => setExpiryDays(e.target.value)} 
                />
              </div>
            )}

            {expiryMode === 'custom' && (
              <div className="animate-in slide-in-from-top-1 fade-in duration-200">
                <input 
                  type="date"
                  className="w-full p-3 bg-[var(--theme-surface-muted)] border border-[#313131] rounded-lg text-[var(--theme-text)] text-sm focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)] outline-none transition-all font-medium" 
                  value={customDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setCustomDate(e.target.value)} 
                />
              </div>
            )}

            {expiryMode === 'never' && (
              <div className="p-4 bg-[color-mix(in_srgb,var(--theme-success)_10%,transparent)] border border-[var(--theme-success)]/30 rounded-lg animate-in slide-in-from-top-1 fade-in duration-200">
                <div className="flex items-center gap-3 text-[var(--theme-success)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                  <span className="text-sm font-semibold">This server will remain active indefinitely until manually unassigned.</span>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-[#151515] border-t border-[#313131] flex items-center justify-between">
          <button className="btn-secondary px-5 py-2.5 shadow-sm font-semibold" onClick={onClose}>Cancel</button>
          <button className="btn-primary px-6 py-2.5 shadow-md font-bold text-sm disabled:opacity-50" disabled={submitting} onClick={submit}>
            {submitting ? 'Assigning...' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
};


