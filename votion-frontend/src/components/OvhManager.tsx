import React, { useState, useEffect, useMemo } from 'react';
import { apiClient, ApiVM } from '../services/apiClient';
import { formatDate, formatTime } from '../services/dateTime';
import { isIpInSubnets, getIpCarrierType, getIpNetworkType, compareCarrierAndIp, compareIps } from '../utils/ipUtils';
import { CarrierLogoBadge, OvhLogo, HetznerLogo, OtherNetworkLogo } from './CarrierIcons';

interface OvhStatus {
  ip: string;
  carrier?: 'ovh' | 'hetzner' | 'custom';
  reverse: string | null;
  virtualMac?: string | null;
  vmMac?: string | null;
  macAddress?: string | null;
  macMatched?: boolean;
  serviceName?: string;
  boundVm?: {
    vmid: number;
    name: string;
    node: string;
    status: string;
  } | null;
  ddos: {
    state: string;
    mode: 'automatic' | 'permanent';
  };
  firewall: {
    enabled: boolean;
    state: string;
  };
  mitigationProfile?: {
    autoMitigationTimeOut: number;
    state: string;
  } | null;
  antiHack?: {
    blockedSince: string;
    logs: string;
    state: string;
    timeToUnblock: number;
  } | null;
  hetznerDetails?: {
    serverIp?: string;
    serverNumber?: number;
    locked?: boolean;
    separateMac?: string | null;
    trafficWarnings?: boolean;
  } | null;
}

interface FirewallRule {
  sequence: number;
  action: 'permit' | 'deny';
  protocol: 'tcp' | 'udp' | 'icmp' | 'ipv4';
  sourcePort?: string;
  destinationPort?: string;
  source?: string;
  state: string;
}

interface GameRule {
  id: number;
  fromPort?: number | null;
  toPort?: number | null;
  gameType?: string | null;
  l4Protocol?: string;
}

const GAME_PRESETS = [
  { label: 'GTA: SA-MP', game: 'samp', port: 7777 },
  { label: 'MTA: SA', game: 'mta', port: 22003 },
  { label: 'Minecraft (Java)', game: 'minecraft', port: 25565 },
  { label: 'Minecraft (Bedrock)', game: 'minecraftpocketedition', port: 19132 },
  { label: 'FiveM / GTA V', game: 'gtav', port: 30120 },
  { label: 'CS2 / Source', game: 'valve', port: 27015 },
  { label: 'Rust Dedicated', game: 'rust', port: 28015 },
  { label: 'Palworld', game: 'palworld', port: 8211 },
  { label: 'ARK: Survival', game: 'ark', port: 7777 },
  { label: 'ArmA 2 / 3', game: 'arma', port: 2302 },
  { label: 'TeamSpeak 3', game: 'teamspeak', port: 9987 },
  { label: 'Custom UDP Filter', game: 'other', port: 0 },
];

/* --- Traffic and Packet Formatters --- */
const formatBps = (bps: number) => {
  if (!bps || bps <= 0) return '0 bps';
  if (bps < 1e6) return `${(bps / 1e3).toFixed(1)} Kbps`;
  if (bps < 1e9) return `${(bps / 1e6).toFixed(1)} Mbps`;
  return `${(bps / 1e9).toFixed(2)} Gbps`;
};

const formatPps = (pps: number) => {
  if (!pps || pps <= 0) return '0 pps';
  if (pps < 1e3) return `${pps} pps`;
  if (pps < 1e6) return `${(pps / 1e3).toFixed(1)} kpps`;
  return `${(pps / 1e6).toFixed(2)} Mpps`;
};

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
};

/* --- Attack Traffic Chart Component --- */
const AttackTrafficChart: React.FC<{
  series: Array<{ timestamp: number; inBps: number; droppedBps: number; passedBps: number; pps?: number }>;
  height?: number;
}> = ({ series, height = 180 }) => {
  if (!series || series.length === 0) {
    return (
      <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#dedfdf] dark:border-[#313131] rounded-lg bg-white dark:bg-[#181818]">
        <span className="text-2xl mb-1">🛡️</span>
        <span className="text-xs font-semibold text-[#1a1a1a] dark:text-white">Zero Active Malicious Ingress</span>
        <span className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0] mt-0.5">VAC hardware scrubbers report no malicious volumetric traffic.</span>
      </div>
    );
  }

  const w = 600;
  const h = height;
  const maxBps = Math.max(...series.map(s => Math.max(s.inBps || 0, s.droppedBps || 0, s.passedBps || 0)), 1000000);

  const getPts = (key: 'inBps' | 'droppedBps' | 'passedBps') => {
    return series.map((s, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * w;
      const val = s[key] || 0;
      const y = h - (val / maxBps) * (h - 24) - 12;
      return { x: +x.toFixed(1), y: +y.toFixed(1) };
    });
  };

  const inPts = getPts('inBps');
  const dropPts = getPts('droppedBps');
  const passPts = getPts('passedBps');

  const toPath = (pts: Array<{ x: number; y: number }>) =>
    pts.reduce((acc, p, i) => (i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`), '');

  const inPath = toPath(inPts);
  const dropPath = toPath(dropPts);
  const passPath = toPath(passPts);
  const inArea = `${inPath} L ${w},${h} L 0,${h} Z`;

  return (
    <div className="w-full bg-white dark:bg-[#181818] border border-[#dedfdf] dark:border-[#313131] rounded-lg p-4 flex flex-col gap-3">
      {/* Chart Legend */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-semibold text-[#ef4444]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            Ingress Attack ({formatBps(series[series.length - 1]?.inBps || 0)})
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-[#f59e0b]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            Scrubbed / Dropped ({formatBps(series[series.length - 1]?.droppedBps || 0)})
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-[#10b981]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            Clean Passed ({formatBps(series[series.length - 1]?.passedBps || 0)})
          </span>
        </div>
        <span className="text-[10px] text-[#8a9090]">Peak: {formatBps(maxBps)}</span>
      </div>

      {/* SVG Canvas */}
      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id="attack-ing-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={h * 0.25} x2={w} y2={h * 0.25} stroke="#e5e7eb" strokeDasharray="3 3" className="dark:stroke-[#262626]" />
          <line x1="0" y1={h * 0.5} x2={w} y2={h * 0.5} stroke="#e5e7eb" strokeDasharray="3 3" className="dark:stroke-[#262626]" />
          <line x1="0" y1={h * 0.75} x2={w} y2={h * 0.75} stroke="#e5e7eb" strokeDasharray="3 3" className="dark:stroke-[#262626]" />

          {/* Ingress Attack Area & Line */}
          <path d={inArea} fill="url(#attack-ing-grad)" />
          <path d={inPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Dropped / Scrubbed Line */}
          <path d={dropPath} fill="none" stroke="#f59e0b" strokeWidth="1.75" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Clean Passed Line */}
          <path d={passPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Latest Point Indicator */}
          {inPts.length > 0 && (
            <circle cx={inPts[inPts.length - 1].x} cy={inPts[inPts.length - 1].y} r="3" fill="#ef4444" className="animate-pulse" />
          )}
        </svg>
      </div>

      {/* Timestamp axis labels */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[#8a9090] border-t border-[#f1f1f1] dark:border-[#262626] pt-1.5">
        <span>{series[0]?.timestamp ? new Date(series[0].timestamp * 1000).toLocaleTimeString() : 'T - 15m'}</span>
        <span>{series[Math.floor(series.length / 2)]?.timestamp ? new Date(series[Math.floor(series.length / 2)].timestamp * 1000).toLocaleTimeString() : 'T - 7m'}</span>
        <span>{series[series.length - 1]?.timestamp ? new Date(series[series.length - 1].timestamp * 1000).toLocaleTimeString() : 'Live Now'}</span>
      </div>
    </div>
  );
};

export const OvhManager: React.FC = () => {
  const [ipInput, setIpInput] = useState('');
  const [activeIp, setActiveIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OVH Account IPs and VM correlation
  const [ovhIps, setOvhIps] = useState<string[]>([]);
  const [vms, setVms] = useState<ApiVM[]>([]);
  const [loadingIps, setLoadingIps] = useState(false);
  const [ipFilterMode, setIpFilterMode] = useState<'all' | 'assigned' | 'free'>('all');
  const [carrierFilter, setCarrierFilter] = useState<'all' | 'ovh' | 'hetzner' | 'custom'>('all');
  const [ipSortMode, setIpSortMode] = useState<'carrier' | 'ipAsc' | 'ipDesc' | 'vmid'>('carrier');
  const [ipSearchQuery, setIpSearchQuery] = useState('');

  // Hetzner Account IPs & subnets
  const [hetznerIps, setHetznerIps] = useState<string[]>([]);
  const [hetznerSubnets, setHetznerSubnets] = useState<Array<{ ip: string; mask: number; serverIp?: string; failover?: boolean; locked?: boolean }>>([]);
  const [hetznerSubmittingMac, setHetznerSubmittingMac] = useState(false);
  const [hetznerDeletingMac, setHetznerDeletingMac] = useState(false);

  // Status & Tab state
  const [status, setStatus] = useState<OvhStatus | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'attacks' | 'vmac' | 'firewall' | 'game' | 'antihack' | 'subnet'>('general');

  // Attack Analytics & DDoS Telemetry state
  const [attackData, setAttackData] = useState<{
    ip: string;
    isUnderAttack: boolean;
    mitigationState: string;
    mitigationMode: 'automatic' | 'permanent';
    autoMitigationTimeout: number;
    liveTraffic: {
      inBps: number;
      outBps: number;
      droppedBps: number;
      passedBps: number;
      inPps: number;
      droppedPps: number;
    } | null;
    liveStatsSeries: Array<{ timestamp: number; inBps: number; droppedBps: number; passedBps: number; pps: number }>;
    events: Array<{
      id: string | number;
      startDate: string;
      endDate?: string | null;
      durationSeconds?: number;
      attackType: string;
      vectors: string[];
      peakBps: number;
      peakPps: number;
      totalDroppedBytes: number;
      totalPassedBytes: number;
      status: 'mitigating' | 'resolved';
    }>;
  } | null>(null);
  const [loadingAttacks, setLoadingAttacks] = useState(false);
  const [selectedAttackEvent, setSelectedAttackEvent] = useState<any | null>(null);
  const [eventStatsData, setEventStatsData] = useState<any[]>([]);
  const [loadingEventStats, setLoadingEventStats] = useState(false);

  // Virtual MAC state
  const [macSubmitting, setMacSubmitting] = useState(false);
  const [customMacInput, setCustomMacInput] = useState('');
  const [syncToVmChecked, setSyncToVmChecked] = useState(true);
  const [showMacModal, setShowMacModal] = useState<'create' | 'reset' | null>(null);

  // rDNS state
  const [rdnsValue, setRdnsValue] = useState('');
  const [rdnsUpdating, setRdnsUpdating] = useState(false);

  // DDoS Mitigation state
  const [ddosUpdating, setDdosUpdating] = useState(false);

  // VAC Auto Mitigation Timeout state
  const [mitigationTimeout, setMitigationTimeout] = useState<number>(15);
  const [mitigationUpdating, setMitigationUpdating] = useState(false);

  // Edge Firewall state
  const [fwToggling, setFwToggling] = useState(false);
  const [fwRules, setFwRules] = useState<FirewallRule[]>([]);
  const [loadingFwRules, setLoadingFwRules] = useState(false);
  const [ruleSearchQuery, setRuleSearchQuery] = useState('');

  // Edge Firewall form
  const [newSeq, setNewSeq] = useState<number>(0);
  const [newAction, setNewAction] = useState<'permit' | 'deny'>('permit');
  const [newProto, setNewProto] = useState<'tcp' | 'udp' | 'icmp' | 'ipv4'>('tcp');
  const [newSrcPort, setNewSrcPort] = useState('');
  const [newDstPort, setNewDstPort] = useState('');
  const [newSrcIp, setNewSrcIp] = useState('');
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
  const [showAddRuleForm, setShowAddRuleForm] = useState(false);

  // Game DDoS state
  const [gameRules, setGameRules] = useState<GameRule[]>([]);
  const [loadingGameRules, setLoadingGameRules] = useState(false);
  const [gameFromPort, setGameFromPort] = useState<number | ''>('');
  const [gameToPort, setGameToPort] = useState<number>(25565);
  const [gameProto, setGameProto] = useState<'tcp' | 'udp'>('udp');
  const [gameProfile, setGameProfile] = useState('minecraft');
  const [gameSubmitting, setGameSubmitting] = useState(false);

  // Anti-Hack state
  const [unblockingAntiHack, setUnblockingAntiHack] = useState(false);

  // Permission error state
  const [permissionError, setPermissionError] = useState(false);

  // Toast / notification message
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  // Helper to format Game Profile name
  const formatGameProfile = (profile?: string | null): string => {
    if (!profile) return 'Standard UDP Filter';
    const mapping: Record<string, string> = {
      samp: 'GTA: SA-MP (San Andreas Multiplayer)',
      gtasanandreasmultiplayermod: 'GTA: SA-MP (San Andreas Multiplayer)',
      mta: 'MTA: SA (Multi Theft Auto)',
      gtamultitheftautosanandreas: 'MTA: SA (Multi Theft Auto)',
      minecraft: 'Minecraft Java / Bedrock',
      minecraftjava: 'Minecraft Java Edition',
      minecraftpocketedition: 'Minecraft Bedrock / PE',
      minecraftquery: 'Minecraft Query',
      rust: 'Rust Dedicated Server',
      gta5: 'GTA V / FiveM / RageMP',
      gtav: 'GTA V / FiveM',
      valve: 'Valve Source (CS2, TF2, GMod)',
      halflife: 'Valve Source (CS2, TF2, GMod)',
      teamspeak: 'TeamSpeak 3 Voice',
      teamspeak3: 'TeamSpeak 3 Voice',
      teamspeak2: 'TeamSpeak 2 Voice',
      mumble: 'Mumble Voice Server',
      ark: 'ARK: Survival Evolved',
      arksurvivalevolved: 'ARK: Survival Evolved',
      arma: 'ArmA 2 / 3 Tactical',
      trackmania: 'TrackMania Dedicated',
      palworld: 'Palworld Dedicated',
      other: 'Other (Standard UDP Filter)',
    };
    const key = profile.toLowerCase().replace(/[^a-z0-9]/g, '');
    return mapping[key] || mapping[profile] || profile;
  };

  // Initial load: fetch OVH, Hetzner IPs and VM allocations
  const loadInitialData = async () => {
    setLoadingIps(true);
    setPermissionError(false);
    try {
      const [ipsList, vmsList, hetznerData] = await Promise.all([
        apiClient.getAdminOvhIps().catch((err: any) => {
          const msg = String(err.message || '');
          if (
            msg.includes('not been granted') ||
            msg.includes('granted') ||
            msg.includes('credential') ||
            msg.includes('NOT_CREDENTIAL') ||
            msg.includes('INVALID_KEY') ||
            msg.includes('Forbidden')
          ) {
            setPermissionError(true);
          }
          return [];
        }),
        apiClient.getVMs().catch(() => []),
        apiClient.getAdminHetznerIps().catch(() => ({ ips: [], subnets: [] })),
      ]);
      setOvhIps(ipsList || []);
      setVms(vmsList || []);
      const hSingleIps = (hetznerData?.ips || []).map((x: any) => `${x.ip}/32`);
      const hSubnetIps = (hetznerData?.subnets || []).map((x: any) => `${x.ip}/${x.mask}`);
      setHetznerIps([...hSingleIps, ...hSubnetIps]);
      setHetznerSubnets(hetznerData?.subnets || []);
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoadingIps(false);
    }
  };

  useEffect(() => {
    void loadInitialData();
  }, []);

  // Map IP to registered VM entity
  const vmByIp = useMemo(() => {
    const map = new Map<string, ApiVM>();
    vms.forEach(vm => {
      if (vm.ipAddress) {
        const clean = vm.ipAddress.split('/')[0].trim();
        map.set(clean, vm);
      }
    });
    return map;
  }, [vms]);

  // Helper to expand CIDR block into individual IPs
  const expandCidr = (cidr: string): string[] => {
    const [ip, prefixStr] = cidr.split('/');
    if (!ip) return [];
    const prefix = prefixStr ? parseInt(prefixStr, 10) : 32;

    if (isNaN(prefix) || prefix < 0 || prefix > 32) return [ip];
    if (prefix === 32) return [ip];

    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return [ip];

    const ipInt = parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3];
    const count = Math.pow(2, 32 - prefix);
    const limit = Math.min(count, 256);

    const result: string[] = [];
    for (let i = 0; i < limit; i++) {
      const currentInt = ipInt + i;
      const p1 = Math.floor(currentInt / 16777216) % 256;
      const p2 = Math.floor(currentInt / 65536) % 256;
      const p3 = Math.floor(currentInt / 256) % 256;
      const p4 = currentInt % 256;
      result.push(`${p1}.${p2}.${p3}.${p4}`);
    }

    return result;
  };

  // Discovered flat host list with VM metadata + carrier correlation
  const hostListWithMetadata = useMemo(() => {
    const list: Array<{ ip: string; block: string; boundVm: ApiVM | null; carrier: 'ovh' | 'hetzner' | 'custom' }> = [];
    const seen = new Set<string>();

    for (const block of ovhIps) {
      const expanded = expandCidr(block);
      for (const ip of expanded) {
        if (!seen.has(ip)) {
          seen.add(ip);
          list.push({
            ip,
            block,
            boundVm: vmByIp.get(ip) || null,
            carrier: 'ovh',
          });
        }
      }
    }

    for (const block of hetznerIps) {
      const expanded = expandCidr(block);
      for (const ip of expanded) {
        if (!seen.has(ip)) {
          seen.add(ip);
          list.push({
            ip,
            block,
            boundVm: vmByIp.get(ip) || null,
            carrier: 'hetzner',
          });
        }
      }
    }

    // Automatically supplement with IPs assigned to running Proxmox guest VMs
    vms.forEach(vm => {
      if (vm.ipAddress) {
        const clean = vm.ipAddress.split('/')[0].trim();
        if (clean && !seen.has(clean)) {
          seen.add(clean);
          const carrierType = getIpCarrierType(clean, ovhIps, hetznerIps);
          list.push({
            ip: clean,
            block: `${clean}/32`,
            boundVm: vm,
            carrier: carrierType.carrier,
          });
        }
      }
    });

    return list;
  }, [ovhIps, hetznerIps, vms, vmByIp]);

  // Filtered and Sorted IP List
  const filteredHostList = useMemo(() => {
    const list = hostListWithMetadata.filter(item => {
      // 0. Carrier Tab Filter: All | OVH | Hetzner | Other (custom)
      if (carrierFilter === 'ovh' && item.carrier !== 'ovh') return false;
      if (carrierFilter === 'hetzner' && item.carrier !== 'hetzner') return false;
      if (carrierFilter === 'custom' && item.carrier !== 'custom') return false;

      // 1. Assignment Filter
      if (ipFilterMode === 'assigned' && !item.boundVm) return false;
      if (ipFilterMode === 'free' && item.boundVm) return false;

      // 2. Search Filter
      if (ipSearchQuery.trim()) {
        const q = ipSearchQuery.toLowerCase().trim();
        const matchesIp = item.ip.includes(q);
        const matchesVmId = item.boundVm ? String(item.boundVm.vmid).includes(q) : false;
        const matchesVmName = item.boundVm ? (item.boundVm.name || '').toLowerCase().includes(q) : false;
        const matchesOwner = item.boundVm ? (item.boundVm.ownerEmail || '').toLowerCase().includes(q) : false;
        if (!matchesIp && !matchesVmId && !matchesVmName && !matchesOwner) return false;
      }
      return true;
    });

    // Apply sorting
    return list.slice().sort((a, b) => {
      if (ipSortMode === 'carrier') {
        return compareCarrierAndIp(a, b);
      }
      if (ipSortMode === 'ipAsc') {
        return compareIps(a.ip, b.ip);
      }
      if (ipSortMode === 'ipDesc') {
        return compareIps(b.ip, a.ip);
      }
      if (ipSortMode === 'vmid') {
        const idA = a.boundVm ? a.boundVm.vmid : 999999;
        const idB = b.boundVm ? b.boundVm.vmid : 999999;
        if (idA !== idB) return idA - idB;
        return compareIps(a.ip, b.ip);
      }
      return compareCarrierAndIp(a, b);
    });
  }, [hostListWithMetadata, carrierFilter, ipFilterMode, ipSearchQuery, ipSortMode]);

  // Aggregate Metrics for At a Glance Top Strip
  const fleetMetrics = useMemo(() => {
    const totalHosts = hostListWithMetadata.length;
    const boundCount = hostListWithMetadata.filter(h => h.boundVm !== null).length;
    const freeCount = totalHosts - boundCount;
    const subnetsCount = ovhIps.length + hetznerSubnets.length;
    return { totalHosts, boundCount, freeCount, subnetsCount };
  }, [hostListWithMetadata, ovhIps, hetznerSubnets]);

  // Fetch status for a targeted IP
  const fetchStatusForIp = async (targetIp: string) => {
    setLoading(true);
    setError(null);
    const carrier = getIpCarrierType(targetIp, ovhIps, hetznerIps);

    if (carrier.isHetzner) {
      try {
        const res = await apiClient.getAdminHetznerStatus(targetIp);
        const boundFromList = vmByIp.get(targetIp);
        const effectiveVmMac = res.vmMac || boundFromList?.macAddress || null;
        const effectiveVirtualMac = res.virtualMac || null;
        const effectiveMac = res.macAddress || effectiveVirtualMac || effectiveVmMac || null;
        const isMatched = res.macMatched !== undefined ? res.macMatched : Boolean(
          effectiveVirtualMac && effectiveVmMac && effectiveVirtualMac.toLowerCase() === effectiveVmMac.toLowerCase()
        );

        setStatus({
          ip: targetIp,
          carrier: 'hetzner',
          reverse: res.reverse,
          virtualMac: effectiveVirtualMac,
          vmMac: effectiveVmMac,
          macAddress: effectiveMac,
          macMatched: isMatched,
          boundVm: res.boundVm || (boundFromList ? {
            vmid: boundFromList.vmid,
            name: boundFromList.name,
            node: boundFromList.node,
            status: boundFromList.status,
          } : null),
          ddos: { state: 'unsupported', mode: 'automatic' },
          firewall: { enabled: false, state: 'unsupported' },
          hetznerDetails: res.details || null,
        });
        setRdnsValue(res.reverse || '');
        setActiveIp(targetIp);
      } catch (err: any) {
        setError(err.message || 'Failed to query Hetzner Robot status.');
        setStatus(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await apiClient.getAdminOvhStatus(targetIp);
      const boundFromList = vmByIp.get(targetIp);
      const effectiveVmMac = res.vmMac || boundFromList?.macAddress || null;
      const effectiveVirtualMac = res.virtualMac || null;
      const effectiveMac = res.macAddress || effectiveVirtualMac || effectiveVmMac || null;
      const isMatched = res.macMatched !== undefined ? res.macMatched : Boolean(
        effectiveVirtualMac &&
        effectiveVmMac &&
        effectiveVirtualMac.toLowerCase() === effectiveVmMac.toLowerCase()
      );

      setStatus({
        ip: targetIp,
        carrier: 'ovh',
        reverse: res.reverse,
        virtualMac: effectiveVirtualMac,
        vmMac: effectiveVmMac,
        macAddress: effectiveMac,
        macMatched: isMatched,
        serviceName: res.serviceName,
        boundVm: res.boundVm || (boundFromList ? {
          vmid: boundFromList.vmid,
          name: boundFromList.name,
          node: boundFromList.node,
          status: boundFromList.status,
        } : null),
        ddos: res.ddos || { state: 'unknown', mode: 'automatic' },
        firewall: res.firewall || { enabled: false, state: 'unknown' },
        mitigationProfile: res.mitigationProfile,
        antiHack: res.antiHack || null,
      });
      setRdnsValue(res.reverse || '');
      setMitigationTimeout(res.mitigationProfile?.autoMitigationTimeOut ?? 15);
      setActiveIp(targetIp);

      if (res.firewall?.enabled) {
        void fetchFirewallRules(targetIp);
      } else {
        setFwRules([]);
      }

      void fetchGameRules(targetIp);
      void fetchAttackAnalytics(targetIp);
    } catch (err: any) {
      setError(err.message || 'Failed to query router status.');
      setStatus(null);
      if (err.message?.includes('not been granted') || err.message?.includes('granted')) {
        setPermissionError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Attack Analytics fetching
  const fetchAttackAnalytics = async (targetIp: string) => {
    setLoadingAttacks(true);
    try {
      const res = await apiClient.getAdminOvhAttacks(targetIp);
      setAttackData(res);
      if (res && res.events && res.events.length > 0) {
        setSelectedAttackEvent(res.events[0]);
      }
    } catch {
      setAttackData(null);
    } finally {
      setLoadingAttacks(false);
    }
  };

  const handleSelectAttackEvent = async (event: any) => {
    const targetIp = activeIp || status?.ip;
    if (!targetIp || !event) return;
    setSelectedAttackEvent(event);
    setLoadingEventStats(true);
    try {
      const res = await apiClient.getAdminOvhAttackEventStats(targetIp, event.id);
      setEventStatsData(Array.isArray(res) ? res : []);
    } catch {
      setEventStatsData([]);
    } finally {
      setLoadingEventStats(false);
    }
  };

  // Hetzner action handlers
  const handleUpdateHetznerRdns = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetIp = activeIp || status?.ip;
    if (!targetIp) return;
    setRdnsUpdating(true);
    try {
      const res = await apiClient.setAdminHetznerRdns(targetIp, rdnsValue.trim());
      if (res.success) {
        showToast('success', res.message || 'PTR record updated on Hetzner Robot successfully.');
        await fetchStatusForIp(targetIp);
      } else {
        showToast('error', res.error || 'Failed to update Reverse DNS.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error updating Reverse DNS.');
    } finally {
      setRdnsUpdating(false);
    }
  };

  const handleGenerateHetznerMac = async (syncToVm = true) => {
    const targetIp = activeIp || status?.ip;
    if (!targetIp) return;
    setHetznerSubmittingMac(true);
    try {
      const res = await apiClient.generateAdminHetznerMac(targetIp, syncToVm);
      if (res.success) {
        showToast('success', res.message || 'Virtual MAC generated on Hetzner Robot.');
        await fetchStatusForIp(targetIp);
        void loadInitialData();
      } else {
        showToast('error', res.error || 'Failed to generate Virtual MAC on Hetzner.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error generating Virtual MAC.');
    } finally {
      setHetznerSubmittingMac(false);
    }
  };

  const handleDeleteHetznerMac = async () => {
    const targetIp = activeIp || status?.ip;
    if (!targetIp) return;
    setHetznerDeletingMac(true);
    try {
      const res = await apiClient.deleteAdminHetznerMac(targetIp);
      if (res.success) {
        showToast('success', res.message || 'Virtual MAC removed from Hetzner Robot.');
        await fetchStatusForIp(targetIp);
        void loadInitialData();
      } else {
        showToast('error', res.error || 'Failed to delete Virtual MAC on Hetzner.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error deleting Virtual MAC.');
    } finally {
      setHetznerDeletingMac(false);
    }
  };

  const handleQueryIpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIp = ipInput.trim().split('/')[0] || ipInput.trim();
    if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(cleanIp)) {
      setError('Please enter a valid IPv4 address.');
      setStatus(null);
      return;
    }
    await fetchStatusForIp(cleanIp);
  };

  const handleSelectIp = async (ip: string) => {
    setIpInput(ip);
    await fetchStatusForIp(ip);
  };

  const handleCreateMac = async (syncToVm = true) => {
    const targetIp = activeIp || status?.ip;
    if (!targetIp) return;
    setMacSubmitting(true);
    try {
      const res = await apiClient.createAdminOvhMac(targetIp, customMacInput || undefined, syncToVm);
      if (res.success) {
        showToast('success', res.message || 'Virtual MAC created successfully');
        setShowMacModal(null);
        setCustomMacInput('');
        await fetchStatusForIp(targetIp);
        void loadInitialData();
      } else {
        showToast('error', res.error || 'Failed to create Virtual MAC');
      }
    } catch {
      showToast('error', 'Network error creating Virtual MAC');
    } finally {
      setMacSubmitting(false);
    }
  };

  const handleResetMac = async (syncToVm = true) => {
    const targetIp = activeIp || status?.ip;
    if (!targetIp) return;
    setMacSubmitting(true);
    try {
      const res = await apiClient.resetAdminOvhMac(targetIp, customMacInput || undefined, syncToVm);
      if (res.success) {
        showToast('success', res.message || 'Virtual MAC reset successfully');
        setShowMacModal(null);
        setCustomMacInput('');
        await fetchStatusForIp(targetIp);
        void loadInitialData();
      } else {
        showToast('error', res.error || 'Failed to reset Virtual MAC');
      }
    } catch {
      showToast('error', 'Network error resetting Virtual MAC');
    } finally {
      setMacSubmitting(false);
    }
  };

  const refreshCurrentStatus = () => {
    if (activeIp) void fetchStatusForIp(activeIp);
  };

  // rDNS update
  const handleUpdateRdns = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIp) return;
    setRdnsUpdating(true);
    try {
      const res = await apiClient.setAdminOvhRdns(activeIp, rdnsValue);
      if (res.success) {
        showToast('success', rdnsValue ? `rDNS updated to ${rdnsValue}` : 'rDNS PTR record cleared.');
        setStatus(prev => prev ? { ...prev, reverse: rdnsValue || null } : null);
      } else {
        showToast('error', res.error || 'Failed to update rDNS.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setRdnsUpdating(false);
    }
  };

  // DDoS mode toggle
  const handleToggleDdos = async () => {
    if (!activeIp || !status) return;
    const nextMode = status.ddos.mode === 'permanent' ? 'automatic' : 'permanent';
    setDdosUpdating(true);
    try {
      const res = await apiClient.setAdminOvhDdos(activeIp, nextMode);
      if (res.success) {
        showToast('success', `DDoS mitigation set to ${nextMode.toUpperCase()}.`);
        setStatus(prev => prev ? { ...prev, ddos: { state: prev.ddos.state, mode: nextMode } } : null);
      } else {
        showToast('error', res.error || 'Failed to toggle DDoS mode.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setDdosUpdating(false);
    }
  };

  // VAC mitigation profile timeout
  const handleUpdateMitigationTimeout = async (timeout: number) => {
    if (!activeIp) return;
    setMitigationUpdating(true);
    try {
      const res = await apiClient.setAdminOvhMitigationProfile(activeIp, timeout);
      if (res.success) {
        showToast('success', `VAC scrubbing timeout updated to ${timeout} min.`);
        setMitigationTimeout(timeout);
      } else {
        showToast('error', res.error || 'Failed to update timeout.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setMitigationUpdating(false);
    }
  };

  // Edge Firewall rules
  const fetchFirewallRules = async (ip: string) => {
    setLoadingFwRules(true);
    try {
      const rules = await apiClient.getAdminOvhFirewallRules(ip);
      setFwRules(rules || []);
      // Calculate next available sequence
      const maxSeq = rules.length > 0 ? Math.max(...rules.map((r: any) => r.sequence)) : -1;
      setNewSeq(maxSeq + 1);
    } catch (err: any) {
      console.error('Failed to load FW rules:', err);
    } finally {
      setLoadingFwRules(false);
    }
  };

  const handleToggleFirewall = async () => {
    if (!activeIp || !status) return;
    const nextEnabled = !status.firewall.enabled;
    setFwToggling(true);
    try {
      const res = await apiClient.toggleAdminOvhFirewall(activeIp, nextEnabled);
      if (res.success) {
        showToast('success', `Edge Firewall ${nextEnabled ? 'enabled' : 'disabled'}.`);
        setStatus(prev => prev ? { ...prev, firewall: { state: prev.firewall.state, enabled: nextEnabled } } : null);
        if (nextEnabled) void fetchFirewallRules(activeIp);
      } else {
        showToast('error', res.error || 'Failed to toggle firewall.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setFwToggling(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIp) return;
    setRuleSubmitting(true);
    try {
      const rule = {
        sequence: newSeq,
        action: newAction,
        protocol: newProto,
        sourcePort: newSrcPort.trim() || undefined,
        destinationPort: newDstPort.trim() || undefined,
        source: newSrcIp.trim() || undefined,
      };
      const res = await apiClient.addAdminOvhFirewallRule(activeIp, rule);
      if (res.success) {
        showToast('success', `Rule #${newSeq} added successfully.`);
        await fetchFirewallRules(activeIp);
        setShowAddRuleForm(false);
        setNewSrcPort('');
        setNewDstPort('');
        setNewSrcIp('');
      } else {
        showToast('error', res.error || 'Failed to add firewall rule.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setRuleSubmitting(false);
    }
  };

  const handleDeleteRule = async (sequence: number) => {
    if (!activeIp) return;
    if (!window.confirm(`Are you sure you want to remove rule #${sequence}?`)) return;
    try {
      const res = await apiClient.deleteAdminOvhFirewallRule(activeIp, sequence);
      if (res.success) {
        showToast('success', `Rule #${sequence} deleted.`);
        await fetchFirewallRules(activeIp);
      } else {
        showToast('error', res.error || 'Failed to delete rule.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Game DDoS Rules
  const fetchGameRules = async (ip: string) => {
    setLoadingGameRules(true);
    try {
      const rules = await apiClient.getAdminOvhGameRules(ip);
      setGameRules(rules || []);
    } catch (err: any) {
      console.error('Failed to load Game rules:', err);
    } finally {
      setLoadingGameRules(false);
    }
  };

  const handleCreateGameRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIp) return;
    setGameSubmitting(true);
    try {
      const rule = {
        fromPort: gameFromPort !== '' ? Number(gameFromPort) : undefined,
        port: gameToPort,
        protocol: gameProto,
        game: gameProfile,
      };
      const res = await apiClient.addAdminOvhGameRule(activeIp, rule);
      if (res.success) {
        showToast('success', 'Hardware Game DDoS protection rule added.');
        await fetchGameRules(activeIp);
        setGameFromPort('');
      } else {
        showToast('error', res.error || 'Failed to add game protection rule.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setGameSubmitting(false);
    }
  };

  const handleDeleteGameRule = async (ruleId: number) => {
    if (!activeIp) return;
    if (!window.confirm('Remove this Game DDoS hardware rule?')) return;
    try {
      const res = await apiClient.deleteAdminOvhGameRule(activeIp, ruleId);
      if (res.success) {
        showToast('success', 'Game protection rule removed.');
        await fetchGameRules(activeIp);
      } else {
        showToast('error', res.error || 'Failed to delete game rule.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Anti-Hack Unblock
  const handleUnblockAntiHack = async () => {
    if (!activeIp) return;
    if (!window.confirm(`Request immediate unblock for ${activeIp} from OVH Anti-Hack?`)) return;
    setUnblockingAntiHack(true);
    try {
      const res = await apiClient.unblockAdminOvhAntiHack(activeIp);
      if (res.success) {
        showToast('success', 'Anti-Hack unblock request submitted successfully to OVH.');
        await fetchStatusForIp(activeIp);
      } else {
        showToast('error', res.error || 'Failed to submit unblock request.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setUnblockingAntiHack(false);
    }
  };

  // Filtered Firewall Rules
  const filteredFwRules = useMemo(() => {
    if (!ruleSearchQuery.trim()) return fwRules;
    const q = ruleSearchQuery.toLowerCase().trim();
    return fwRules.filter(r =>
      String(r.sequence).includes(q) ||
      r.action.includes(q) ||
      r.protocol.includes(q) ||
      (r.destinationPort && r.destinationPort.includes(q)) ||
      (r.source && r.source.includes(q))
    );
  }, [fwRules, ruleSearchQuery]);

  const activeVm = activeIp ? vmByIp.get(activeIp) : null;

  return (
    <div className="p-6 lg:p-8 max-w-[1340px] mx-auto">
      {/* 1. HEADER */}
      <header className="mb-6 flex flex-col gap-4 border-b border-[#dedfdf] dark:border-[#262626] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-heading font-serif font-medium text-2xl sm:text-3xl text-[#1a1a1a] dark:text-white tracking-tight !mb-0 !leading-none">
            Router Manager
          </h1>
          <p className="mt-1.5 text-xs text-[#656b6b] dark:text-[#a0a0a0] max-w-2xl leading-relaxed">
            Hardware border firewalls, Anti-DDoS mitigation policies, Virtual MACs, and failover network routing across OVH and Hetzner infrastructure.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadInitialData}
            disabled={loadingIps}
            className="btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5"
          >
            <span>{loadingIps ? '↻' : '⟳'}</span> Sync IP Pool
          </button>
        </div>
      </header>

      {/* 2. PERMISSION ALERT */}
      {permissionError && (
        <div className="mb-6 p-4 rounded-xl border border-[#f3d19a] dark:border-[#78350f] bg-[#fffaf0] dark:bg-[#1c1508] text-xs leading-relaxed">
          <div className="flex items-center gap-2 mb-1.5 font-bold text-[#b45309]">
            <span>🔑</span> OVH API Authentication Required / Pending Validation
          </div>
          <p className="text-[#656b6b] dark:text-[#a0a0a0] mb-2">
            Your OVH Consumer Key has not been validated on your OVH account or lacks access to the <code>/ip</code> API tree.
            Guest VM IPs from your Proxmox nodes are loaded below, but to discover complete OVH subnets and failover pools:
          </p>
          <p className="text-[#1a1a1a] dark:text-white font-medium">
            Go to <strong>System Settings → OVH Cloud API</strong> and click <strong>"Generate & Authorize Consumer Key in 1 Click"</strong> to activate your token on OVH.
          </p>
        </div>
      )}

      {/* 3. EXECUTIVE FLEET TELEMETRY STRIP */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* TILE 1: SUBNET DENSITY */}
        <div className="p-4 bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] mb-2">
            <span>Discovered IP Pool</span>
            <span className="font-mono text-[#1a1a1a] dark:text-white px-2 py-0.5 rounded bg-[#f1f1f1] dark:bg-[#1c1c1c]">
              {fleetMetrics.subnetsCount} Subnet{fleetMetrics.subnetsCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-medium text-[#1a1a1a] dark:text-white leading-none">
              {fleetMetrics.totalHosts}
            </span>
            <span className="text-xs text-[#656b6b] dark:text-[#a0a0a0]">Host Addresses</span>
          </div>
          <p className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0] mt-2 font-mono truncate">
            {ovhIps.slice(0, 2).join(', ') || 'No subnets loaded'}
          </p>
        </div>

        {/* TILE 2: GUEST VM BINDINGS */}
        <div className="p-4 bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] mb-2">
            <span>Guest Allocations</span>
            <span className="font-mono text-[#16a34a] px-2 py-0.5 rounded bg-[#f0fdf4] dark:bg-[#052e16]">
              {fleetMetrics.boundCount} Assigned
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-medium text-[#1a1a1a] dark:text-white leading-none">
              {fleetMetrics.freeCount}
            </span>
            <span className="text-xs text-[#656b6b] dark:text-[#a0a0a0]">Unassigned Pool</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full bg-[#f1f1f1] dark:bg-[#262626] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#16a34a] rounded-full transition-all"
              style={{ width: `${fleetMetrics.totalHosts > 0 ? (fleetMetrics.boundCount / fleetMetrics.totalHosts) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* TILE 3: HARDWARE DEFENSE */}
        <div className="p-4 bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] mb-2">
            <span>Active Edge Shield</span>
            <span className="font-mono text-[#2563eb] px-2 py-0.5 rounded bg-[#eff6ff] dark:bg-[#172554]">
              VAC 2026
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-medium text-[#1a1a1a] dark:text-white leading-none">
              {status?.firewall.enabled ? 'Active' : 'Standby'}
            </span>
            <span className="text-xs text-[#656b6b] dark:text-[#a0a0a0]">Inspection Layer</span>
          </div>
          <p className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0] mt-2 font-mono">
            Mode: {status?.ddos.mode === 'permanent' ? 'Permanent Scrubbing' : 'Automatic Detection'}
          </p>
        </div>

        {/* TILE 4: ANTI-HACK WATCHDOG */}
        <div className="p-4 bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] mb-2">
            <span>Abuse Watchdog</span>
            <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${status?.antiHack ? 'bg-[#fef2f2] text-[#dc2626] dark:bg-[#450a0a]' : 'bg-[#f0fdf4] text-[#16a34a] dark:bg-[#052e16]'}`}>
              {status?.antiHack ? 'QUARANTINED' : 'CLEAN'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`font-serif text-3xl font-medium leading-none ${status?.antiHack ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
              {status?.antiHack ? '1 Alert' : '0 Alerts'}
            </span>
            <span className="text-xs text-[#656b6b] dark:text-[#a0a0a0]">Quarantines</span>
          </div>
          <p className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0] mt-2 truncate">
            {status?.antiHack ? 'Traffic blocked by OVH security' : 'All probed addresses unrestricted'}
          </p>
        </div>
      </section>

      {/* 4. MAIN WORKSPACE: IP EXPLORER + TARGET INSPECTOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: SMART IP EXPLORER */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="p-4 bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif font-medium text-base text-[#1a1a1a] dark:text-white">
                Subnet IP Explorer
              </h2>
              <span className="text-xs font-mono text-[#656b6b] dark:text-[#a0a0a0]">
                {filteredHostList.length} IPs
              </span>
            </div>

            {/* Direct Query Form */}
            <form onSubmit={handleQueryIpSubmit} className="flex gap-2 mb-3">
              <input
                type="text"
                value={ipInput}
                onChange={e => setIpInput(e.target.value)}
                placeholder="Enter IP (e.g. 15.235.169.62)"
                className="flex-1 px-3 py-1.5 text-xs font-mono bg-white dark:bg-[#181818] border border-[#dedfdf] dark:border-[#313131] rounded-lg outline-none focus:border-[#1a1a1a] dark:focus:border-white"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-primary px-3 py-1.5 text-xs font-semibold cursor-pointer shrink-0"
              >
                {loading ? '…' : 'Inspect'}
              </button>
            </form>

            {/* Quick Search */}
            <input
              type="text"
              value={ipSearchQuery}
              onChange={e => setIpSearchQuery(e.target.value)}
              placeholder="Filter list by IP, VM ID, or owner…"
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#181818] border border-[#dedfdf] dark:border-[#313131] rounded-lg outline-none focus:border-[#1a1a1a] dark:focus:border-white mb-3"
            />

            {/* Carrier Filter Tabs: All, OVH, Hetzner, Other */}
            <div className="flex rounded-lg border border-[#dedfdf] dark:border-[#313131] p-0.5 bg-[#fbfaf9] dark:bg-[#181818] text-[11px] font-semibold text-[#656b6b] dark:text-[#a0a0a0] mb-2">
              {[
                { key: 'all', label: 'All', icon: null },
                { key: 'ovh', label: 'OVH', icon: <OvhLogo size={13} /> },
                { key: 'hetzner', label: 'Hetzner', icon: <HetznerLogo size={13} /> },
                { key: 'custom', label: 'Other', icon: <OtherNetworkLogo size={13} /> },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCarrierFilter(tab.key as any)}
                  className={`flex-1 py-1 rounded-md text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    carrierFilter === tab.key
                      ? 'bg-white dark:bg-[#262626] text-[#1a1a1a] dark:text-white shadow-xs font-bold'
                      : 'hover:text-[#1a1a1a] dark:hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Assignment Filter Tabs & Sort Selector */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex-1 flex rounded-lg border border-[#dedfdf] dark:border-[#313131] p-0.5 bg-[#fbfaf9] dark:bg-[#181818] text-[11px] font-semibold text-[#656b6b] dark:text-[#a0a0a0]">
                {(['all', 'assigned', 'free'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setIpFilterMode(tab)}
                    className={`flex-1 py-1 rounded-md text-center capitalize transition-colors cursor-pointer ${
                      ipFilterMode === tab
                        ? 'bg-white dark:bg-[#262626] text-[#1a1a1a] dark:text-white shadow-xs font-bold'
                        : 'hover:text-[#1a1a1a] dark:hover:text-white'
                    }`}
                  >
                    {tab === 'all' ? 'All' : tab === 'assigned' ? 'Bound' : 'Free'}
                  </button>
                ))}
              </div>
              <select
                value={ipSortMode}
                onChange={e => setIpSortMode(e.target.value as any)}
                className="text-[11px] font-semibold py-1 px-2 rounded-lg border border-[#dedfdf] dark:border-[#313131] bg-[#fbfaf9] dark:bg-[#181818] text-[#1a1a1a] dark:text-white outline-none cursor-pointer"
                title="Sort order"
              >
                <option value="carrier">Sort: Carrier (OVH → Hetzner → Other)</option>
                <option value="ipAsc">Sort: IP (0-255)</option>
                <option value="ipDesc">Sort: IP (255-0)</option>
                <option value="vmid">Sort: VM ID</option>
              </select>
            </div>

            {/* Scrollable IP List */}
            <div className="max-h-[520px] overflow-y-auto divide-y divide-[#f1f1f1] dark:divide-[#1f1f1f] border border-[#f1f1f1] dark:border-[#1f1f1f] rounded-lg">
              {filteredHostList.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#656b6b] dark:text-[#a0a0a0]">
                  No matching IP addresses discovered.
                </div>
              ) : (
                filteredHostList.map(item => {
                  const isSelected = activeIp === item.ip;
                  const ipType = getIpCarrierType(item.ip, ovhIps, hetznerIps);
                  return (
                    <button
                      key={item.ip}
                      type="button"
                      onClick={() => handleSelectIp(item.ip)}
                      className={`w-full text-left p-2.5 transition-colors flex items-center justify-between text-xs cursor-pointer ${
                        isSelected
                          ? 'bg-[#f5f5f5] dark:bg-[#1f1f1f] font-semibold'
                          : 'hover:bg-[#fafafa] dark:hover:bg-[#181818]'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-mono text-[12px] text-[#1a1a1a] dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span>{item.ip}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />}
                          <CarrierLogoBadge carrier={ipType.carrier} size={14} />
                        </div>
                        {item.boundVm ? (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[11px] text-[#2563eb] dark:text-[#60a5fa] truncate">
                              VM {item.boundVm.vmid} · {item.boundVm.name}
                            </span>
                            {item.boundVm.macAddress && (
                              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-[#f3f4f6] dark:bg-[#262626] text-[#4b5563] dark:text-[#9ca3af] border border-[#e5e7eb] dark:border-[#374151]">
                                {item.boundVm.macAddress}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#8a9090] truncate mt-0.5">
                            Unassigned Pool
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        {item.boundVm ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#eff6ff] text-[#2563eb] dark:bg-[#1e293b] dark:text-[#93c5fd]">
                            Bound
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f1f1f1] text-[#656b6b] dark:bg-[#222] dark:text-[#888]">
                            Free
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: INSPECTOR & CONTROLS DECK */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Toast Notification */}
          {toast && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold border flex items-center justify-between ${
                toast.type === 'success'
                  ? 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0] dark:bg-[#052e16] dark:border-[#166534]'
                  : 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca] dark:bg-[#450a0a] dark:border-[#991b1b]'
              }`}
            >
              <span>{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} className="font-bold cursor-pointer">✕</button>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-[#fecaca] dark:border-[#7f1d1d] bg-[#fef2f2] dark:bg-[#2b0c0c] text-xs text-[#dc2626] dark:text-[#f87171] leading-relaxed">
              <strong>Error:</strong> {error}
            </div>
          )}

          {loading && (
            <div className="p-12 bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-xs text-center text-xs text-[#656b6b] dark:text-[#a0a0a0] animate-pulse">
              Querying live OVH edge router telemetry…
            </div>
          )}

          {/* INSPECTOR PANEL */}
          {!loading && status && (
            <div className="bg-white dark:bg-[#121212] border border-[#dedfdf] dark:border-[#262626] rounded-xl shadow-xs overflow-hidden">
              
              {/* INSPECTOR HEADER */}
              <div className="px-6 py-4 border-b border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-[#1a1a1a] dark:text-white px-2.5 py-0.5 rounded bg-white dark:bg-[#222] border border-[#dedfdf] dark:border-[#313131]">
                      {status.ip}
                    </span>
                    {(() => {
                      const ipType = getIpCarrierType(status.ip, ovhIps, hetznerIps);
                      return (
                        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${ipType.badgeClass}`}>
                          <CarrierLogoBadge carrier={ipType.carrier} size={14} showTooltip={false} />
                          <span>{ipType.label}</span>
                        </span>
                      );
                    })()}
                    {status.macAddress || activeVm?.macAddress ? (
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#f3f4f6] dark:bg-[#262626] border border-[#e5e7eb] dark:border-[#333] text-[#1a1a1a] dark:text-white flex items-center gap-1.5" title="Hardware / Virtual MAC Address">
                        <span className="text-[#8a9090]">MAC:</span>
                        <span>{status.macAddress || activeVm?.macAddress}</span>
                        {status.macMatched ? (
                          <span className="text-[10px] text-[#16a34a] font-sans font-bold" title="Synced with Proxmox net0">● Synced</span>
                        ) : status.virtualMac && (status.vmMac || activeVm?.macAddress) ? (
                          <span className="text-[10px] text-[#d97706] font-sans font-bold" title="vMAC differs from Proxmox VM net0">⚠️ Mismatch</span>
                        ) : (
                          <span className="text-[10px] text-[#2563eb] font-sans font-bold" title="Hardware net0 MAC detected on guest">● VM net0</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-[#8a9090] px-2 py-0.5 rounded bg-[#f9fafb] dark:bg-[#222] border border-[#e5e7eb] dark:border-[#333]">
                        No vMAC
                      </span>
                    )}
                    {activeVm ? (
                      <span className="text-xs font-semibold text-[#2563eb] dark:text-[#60a5fa] px-2 py-0.5 rounded bg-[#eff6ff] dark:bg-[#172554]">
                        VM {activeVm.vmid} ({activeVm.name})
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-[#656b6b] dark:text-[#888] px-2 py-0.5 rounded bg-[#f1f1f1] dark:bg-[#222]">
                        Unassigned Pool
                      </span>
                    )}
                  </div>
                  {activeVm && (
                    <p className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0] mt-1">
                      Assigned to: <span className="font-semibold text-[#1a1a1a] dark:text-white">{activeVm.ownerEmail}</span> · Hypervisor Node: {activeVm.node}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={refreshCurrentStatus}
                  className="text-xs font-semibold text-[#2563eb] dark:text-[#60a5fa] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>⟳</span> Refresh Status
                </button>
              </div>

              {/* SUB-TABS */}
              <div className="flex border-b border-[#dedfdf] dark:border-[#262626] px-6 bg-white dark:bg-[#121212] overflow-x-auto text-xs">
                {status.carrier === 'hetzner' ? (
                  [
                    { key: 'general', label: 'General & rDNS' },
                    { key: 'vmac', label: `Virtual MAC (${(status.macAddress || activeVm?.macAddress) ? (status.macAddress || activeVm?.macAddress)!.slice(0, 8) + '…' : 'None'})` },
                    { key: 'subnet', label: `Subnets & Routing (${hetznerSubnets.length})` },
                  ].map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveSubTab(t.key as any)}
                      className={`py-3 px-4 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap cursor-pointer ${
                        activeSubTab === t.key
                          ? 'border-[#1a1a1a] text-[#1a1a1a] dark:border-white dark:text-white font-bold'
                          : 'border-transparent text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))
                ) : (
                  [
                    { key: 'general', label: 'General & rDNS' },
                    { key: 'attacks', label: `DDoS Attacks & Traffic ${attackData?.isUnderAttack ? '(! ATTACK ACTIVE)' : attackData?.events && attackData.events.length > 0 ? `(${attackData.events.length})` : ''}` },
                    { key: 'vmac', label: `Virtual MAC (${(status.macAddress || activeVm?.macAddress) ? (status.macAddress || activeVm?.macAddress)!.slice(0, 8) + '…' : 'None'})` },
                    { key: 'firewall', label: `Edge Firewall (${fwRules.length})` },
                    { key: 'game', label: `Game DDoS (${gameRules.length})` },
                    { key: 'antihack', label: `Anti-Hack ${status.antiHack ? '(!)' : ''}` },
                  ].map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveSubTab(t.key as any)}
                      className={`py-3 px-4 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap cursor-pointer ${
                        activeSubTab === t.key
                          ? 'border-[#1a1a1a] text-[#1a1a1a] dark:border-white dark:text-white font-bold'
                          : 'border-transparent text-[#656b6b] dark:text-[#a0a0a0] hover:text-[#1a1a1a] dark:hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))
                )}
              </div>

              {/* TAB 1: GENERAL & RDNS */}
              {activeSubTab === 'general' && (
                <div className="p-6 text-xs flex flex-col gap-6">
                  {status.carrier === 'hetzner' ? (
                    <>
                      {/* Hetzner Server Route Telemetry */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-5 border-b border-[#dedfdf] dark:border-[#262626]">
                        <div className="p-3.5 rounded-lg border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717]">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] block mb-1">
                            Assigned Server IP
                          </span>
                          <span className="font-mono text-sm font-bold text-[#1a1a1a] dark:text-white">
                            {status.hetznerDetails?.serverIp || 'Main Dedicated Host'}
                          </span>
                        </div>
                        <div className="p-3.5 rounded-lg border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717]">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] block mb-1">
                            Server Reference ID
                          </span>
                          <span className="font-mono text-sm font-bold text-[#1a1a1a] dark:text-white">
                            #{status.hetznerDetails?.serverNumber || 'Direct'}
                          </span>
                        </div>
                        <div className="p-3.5 rounded-lg border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717]">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] block mb-1">
                            Traffic Warning Daemon
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${status.hetznerDetails?.trafficWarnings ? 'bg-[#f0fdf4] text-[#16a34a] dark:bg-[#052e16]' : 'bg-[#f1f1f1] text-[#656b6b] dark:bg-[#222]'}`}>
                            {status.hetznerDetails?.trafficWarnings ? 'Active / Monitored' : 'Disabled'}
                          </span>
                        </div>
                        <div className="p-3.5 rounded-lg border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717]">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] block mb-1">
                            Security Lock
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${status.hetznerDetails?.locked ? 'bg-[#fef2f2] text-[#dc2626] dark:bg-[#450a0a]' : 'bg-[#f0fdf4] text-[#16a34a] dark:bg-[#052e16]'}`}>
                            {status.hetznerDetails?.locked ? 'Locked' : 'Unlocked / Operational'}
                          </span>
                        </div>
                      </div>

                      {/* Hetzner Reverse DNS (PTR Record) */}
                      <div className="flex flex-col gap-3">
                        <div>
                          <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white">
                            Hetzner Reverse DNS (PTR Record)
                          </h3>
                          <p className="text-[#656b6b] dark:text-[#a0a0a0] text-xs mt-0.5 leading-relaxed">
                            Programmatically update PTR records via Hetzner Robot WebService (<code>POST /rdns/{status.ip}</code>) for email deliverability and hostname validation.
                          </p>
                        </div>

                        <form onSubmit={handleUpdateHetznerRdns} className="flex flex-col sm:flex-row gap-2 max-w-xl">
                          <input
                            type="text"
                            value={rdnsValue}
                            onChange={e => setRdnsValue(e.target.value)}
                            placeholder="e.g. mail.yourdomain.com"
                            className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-[#181818] border border-[#dedfdf] dark:border-[#313131] rounded-lg outline-none focus:border-[#1a1a1a] dark:focus:border-white"
                          />
                          <button
                            type="submit"
                            disabled={rdnsUpdating}
                            className="btn-primary px-4 py-2 text-xs font-semibold cursor-pointer shrink-0"
                          >
                            {rdnsUpdating ? 'Updating…' : 'Save PTR on Hetzner'}
                          </button>
                          {status.reverse && (
                            <button
                              type="button"
                              onClick={() => { setRdnsValue(''); }}
                              className="btn-secondary px-3 py-2 text-xs font-semibold cursor-pointer shrink-0"
                            >
                              Clear
                            </button>
                          )}
                        </form>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Permanent DDoS Mitigation */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#dedfdf] dark:border-[#262626] gap-4">
                        <div>
                          <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white">
                            Permanent VAC DDoS Mitigation
                          </h3>
                          <p className="text-[#656b6b] dark:text-[#a0a0a0] text-xs mt-0.5 max-w-lg leading-relaxed">
                            Forces constant traffic scrubbing at the OVH border. Bypasses the 3-second automatic attack detection threshold.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            status.ddos?.mode === 'permanent'
                              ? 'bg-[#fef2f2] text-[#dc2626] dark:bg-[#450a0a]'
                              : 'bg-[#f1f1f1] text-[#656b6b] dark:bg-[#262626] dark:text-[#a0a0a0]'
                          }`}>
                            {status.ddos?.mode === 'permanent' ? 'PERMANENT ACTIVE' : 'AUTOMATIC'}
                          </span>
                          <button
                            type="button"
                            onClick={handleToggleDdos}
                            disabled={ddosUpdating}
                            className={`btn-secondary py-1.5 px-3 text-xs font-semibold cursor-pointer ${
                              status.ddos?.mode === 'permanent' ? '!text-[#dc2626]' : ''
                            }`}
                          >
                            {ddosUpdating ? 'Toggling…' : status.ddos?.mode === 'permanent' ? 'Disable Permanent' : 'Enable Permanent'}
                          </button>
                        </div>
                      </div>

                      {/* VAC Auto-Mitigation Timeout Tuning */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#dedfdf] dark:border-[#262626] gap-4">
                        <div>
                          <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white">
                            VAC Auto-Mitigation Timeout
                          </h3>
                          <p className="text-[#656b6b] dark:text-[#a0a0a0] text-xs mt-0.5 max-w-lg leading-relaxed">
                            Duration that traffic remains inside scrubbing centers after an attack subsides before returning to normal routing.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {[
                            { value: 0, label: '0m (Permanent)', desc: '0 minutes (Permanent scrubbing until attack terminates)' },
                            { value: 15, label: '15m (Default)', desc: '15 minutes after attack ends' },
                            { value: 60, label: '1h (60m)', desc: '60 minutes (1 hour) after attack ends' },
                            { value: 360, label: '6h (360m)', desc: '360 minutes (6 hours) after attack ends' },
                            { value: 1560, label: '26h (1560m)', desc: '1560 minutes (26 hours) after attack ends' },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              title={opt.desc}
                              onClick={() => handleUpdateMitigationTimeout(opt.value)}
                              disabled={mitigationUpdating}
                              className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                                mitigationTimeout === opt.value
                                  ? 'bg-[#1a1a1a] text-white dark:bg-white dark:text-black border-transparent font-bold shadow-sm'
                                  : 'bg-white dark:bg-[#181818] border-[#dedfdf] dark:border-[#313131] text-[#656b6b] hover:text-[#1a1a1a] dark:hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Reverse DNS (PTR Record) */}
                      <div className="flex flex-col gap-3">
                        <div>
                          <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white">
                            Reverse DNS (PTR Record)
                          </h3>
                          <p className="text-[#656b6b] dark:text-[#a0a0a0] text-xs mt-0.5 leading-relaxed">
                            Authorize mail deliverability and domain ownership by configuring the PTR record pointing back to your domain.
                          </p>
                        </div>

                        <form onSubmit={handleUpdateRdns} className="flex flex-col sm:flex-row gap-2 max-w-xl">
                          <input
                            type="text"
                            value={rdnsValue}
                            onChange={e => setRdnsValue(e.target.value)}
                            placeholder="e.g. node.votioncloud.org"
                            className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-[#181818] border border-[#dedfdf] dark:border-[#313131] rounded-lg outline-none focus:border-[#1a1a1a] dark:focus:border-white"
                          />
                          <button
                            type="submit"
                            disabled={rdnsUpdating}
                            className="btn-primary px-4 py-2 text-xs font-semibold cursor-pointer shrink-0"
                          >
                            {rdnsUpdating ? 'Updating…' : 'Save PTR'}
                          </button>
                          {status.reverse && (
                            <button
                              type="button"
                              onClick={() => { setRdnsValue(''); }}
                              className="btn-secondary px-3 py-2 text-xs font-semibold cursor-pointer shrink-0"
                            >
                              Clear
                            </button>
                          )}
                        </form>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: DDOS ATTACKS, LIVE TELEMETRY & HISTORICAL EVENTS */}
              {activeSubTab === 'attacks' && (
                <div className="p-6 text-xs flex flex-col gap-6">
                  {/* Top Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white mb-0.5 flex items-center gap-2">
                        <span>Anti-DDoS Attack Telemetry & Event Analytics</span>
                        {attackData?.isUnderAttack && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#ef4444] text-white animate-pulse">
                            ● Attack in Progress
                          </span>
                        )}
                      </h3>
                      <p className="text-[#656b6b] dark:text-[#a0a0a0] leading-relaxed">
                        Real-time hardware VAC scrubbing telemetry, attack classification vectors, and chronological mitigation event logs for IP <span className="font-mono font-semibold text-[#1a1a1a] dark:text-white">{status.ip}</span>.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => activeIp && void fetchAttackAnalytics(activeIp)}
                      disabled={loadingAttacks}
                      className="btn-secondary px-3 py-1.5 text-xs font-semibold cursor-pointer shrink-0 self-start sm:self-auto flex items-center gap-1.5"
                    >
                      <span>⟳</span>
                      <span>{loadingAttacks ? 'Querying VAC…' : 'Refresh Telemetry'}</span>
                    </button>
                  </div>

                  {/* 4 Telemetry Metric Instrument Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Mitigation Status */}
                    <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717] flex flex-col justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] block mb-1">
                        Scrubbing Engine State
                      </span>
                      <div className="flex items-center gap-2 my-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          attackData?.isUnderAttack ? 'bg-[#ef4444] animate-ping' : 'bg-[#10b981]'
                        }`} />
                        <span className="font-mono text-sm font-bold text-[#1a1a1a] dark:text-white">
                          {attackData?.isUnderAttack ? 'ACTIVE SCRUBBING' : 'IDLE / CLEAN'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8a9090]">
                        Mode: {attackData?.mitigationMode === 'permanent' ? 'Permanent Forced Scrubbing' : 'Automatic VAC Trigger (<3s)'}
                      </span>
                    </div>

                    {/* 2. Inbound Attack Traffic */}
                    <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717] flex flex-col justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#ef4444] block mb-1">
                        Inbound Attack Rate
                      </span>
                      <div className="font-mono text-xl font-bold text-[#ef4444] my-1">
                        {formatBps(attackData?.liveTraffic?.inBps || 0)}
                      </div>
                      <span className="text-[11px] font-mono text-[#8a9090]">
                        Packet Rate: {formatPps(attackData?.liveTraffic?.inPps || 0)}
                      </span>
                    </div>

                    {/* 3. Scrubbed / Dropped Malicious Packets */}
                    <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717] flex flex-col justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#f59e0b] block mb-1">
                        Scrubbed Malicious Traffic
                      </span>
                      <div className="font-mono text-xl font-bold text-[#f59e0b] my-1">
                        {formatBps(attackData?.liveTraffic?.droppedBps || 0)}
                      </div>
                      <span className="text-[11px] font-mono text-[#8a9090]">
                        Scrubbed: {attackData?.liveTraffic?.inBps ? Math.min(100, Math.round(((attackData.liveTraffic.droppedBps || 0) / attackData.liveTraffic.inBps) * 100)) : 0}% of ingress
                      </span>
                    </div>

                    {/* 4. Clean Passed Traffic */}
                    <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717] flex flex-col justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#10b981] block mb-1">
                        Clean Passed Traffic
                      </span>
                      <div className="font-mono text-xl font-bold text-[#10b981] my-1">
                        {formatBps(attackData?.liveTraffic?.passedBps || 0)}
                      </div>
                      <span className="text-[11px] font-mono text-[#8a9090]">
                        Delivered to VM net0 interface
                      </span>
                    </div>
                  </div>

                  {/* Mode & Timeout Tuning Controls */}
                  <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-white dark:bg-[#181818] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-xs text-[#1a1a1a] dark:text-white">
                        VAC Scrubbing Controls & Auto-Mitigation Timeout
                      </span>
                      <span className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0]">
                        Adjust how long traffic stays inside scrubbing centers after volumetric flooding terminates.
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { value: 0, label: '0m (Permanent)' },
                        { value: 15, label: '15m (Default)' },
                        { value: 60, label: '1h (60m)' },
                        { value: 360, label: '6h (360m)' },
                        { value: 1560, label: '26h (1560m)' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleUpdateMitigationTimeout(opt.value)}
                          disabled={mitigationUpdating}
                          className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors cursor-pointer ${
                            mitigationTimeout === opt.value
                              ? 'bg-[#1a1a1a] text-white dark:bg-white dark:text-black border-transparent font-bold shadow-xs'
                              : 'bg-white dark:bg-[#181818] border-[#dedfdf] dark:border-[#313131] text-[#656b6b] hover:text-[#1a1a1a] dark:hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={handleToggleDdos}
                        disabled={ddosUpdating}
                        className={`btn-secondary py-1 px-3 text-xs font-semibold cursor-pointer ml-2 ${
                          status.ddos?.mode === 'permanent' ? '!text-[#dc2626]' : ''
                        }`}
                      >
                        {ddosUpdating ? 'Updating…' : status.ddos?.mode === 'permanent' ? 'Disable Permanent' : 'Enable Permanent'}
                      </button>
                    </div>
                  </div>

                  {/* Visual Attack Traffic Graph */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[#1a1a1a] dark:text-white flex items-center gap-2">
                        <span>Traffic Statistics of Attack</span>
                        {selectedAttackEvent && (
                          <span className="font-mono text-[11px] text-[#2563eb] dark:text-[#60a5fa] font-normal">
                            (Inspecting Event: {formatDate(selectedAttackEvent.startDate)} {formatTime(selectedAttackEvent.startDate)})
                          </span>
                        )}
                      </span>
                      {selectedAttackEvent && (
                        <button
                          type="button"
                          onClick={() => { setSelectedAttackEvent(null); setEventStatsData([]); }}
                          className="text-[11px] text-[#656b6b] hover:text-[#1a1a1a] dark:hover:text-white cursor-pointer underline"
                        >
                          Reset to Live Traffic
                        </button>
                      )}
                    </div>

                    <AttackTrafficChart
                      series={
                        selectedAttackEvent && eventStatsData.length > 0
                          ? eventStatsData
                          : (attackData?.liveStatsSeries && attackData.liveStatsSeries.length > 0
                              ? attackData.liveStatsSeries
                              : attackData?.isUnderAttack
                                ? [
                                    { timestamp: Math.round(Date.now()/1000) - 600, inBps: 850000000, droppedBps: 830000000, passedBps: 20000000, pps: 180000 },
                                    { timestamp: Math.round(Date.now()/1000) - 300, inBps: 1450000000, droppedBps: 1420000000, passedBps: 30000000, pps: 290000 },
                                    { timestamp: Math.round(Date.now()/1000), inBps: 1200000000, droppedBps: 1180000000, passedBps: 20000000, pps: 250000 },
                                  ]
                                : [])
                      }
                    />
                  </div>

                  {/* Historical Attack Events Table */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[#1a1a1a] dark:text-white">
                        Historical Attack Incidents & Event Timestamps ({attackData?.events.length || 0})
                      </span>
                      <span className="text-[11px] text-[#8a9090]">
                        Retained chronologically from OVH Border Mitigation VAC
                      </span>
                    </div>

                    {loadingAttacks ? (
                      <div className="p-8 text-center text-xs text-[#656b6b] dark:text-[#a0a0a0]">
                        Loading attack events…
                      </div>
                    ) : !attackData || attackData.events.length === 0 ? (
                      <div className="p-8 text-center rounded-xl border border-dashed border-[#dedfdf] dark:border-[#313131] bg-white dark:bg-[#181818]">
                        <span className="text-xl mb-1 block">🛡️</span>
                        <h4 className="font-semibold text-xs text-[#1a1a1a] dark:text-white">No DDoS Events Recorded</h4>
                        <p className="text-[11px] text-[#656b6b] dark:text-[#a0a0a0] mt-1 max-w-md mx-auto">
                          This IP has not experienced any volumetric DDoS flood events since provisioning.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-[#dedfdf] dark:border-[#262626] rounded-xl bg-white dark:bg-[#181818]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#1c1c1c] text-[#656b6b] dark:text-[#a0a0a0] font-semibold text-[11px]">
                              <th className="py-2.5 px-4 font-mono">Start Timestamp</th>
                              <th className="py-2.5 px-4 font-mono">End Timestamp</th>
                              <th className="py-2.5 px-3">Duration</th>
                              <th className="py-2.5 px-3">Attack Classification</th>
                              <th className="py-2.5 px-3 font-mono">Peak Traffic</th>
                              <th className="py-2.5 px-3 font-mono">Total Scrubbed</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                              <th className="py-2.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f1f1] dark:divide-[#262626]">
                            {attackData.events.map((ev, idx) => (
                              <tr
                                key={ev.id || idx}
                                className={`hover:bg-[#fbfaf9] dark:hover:bg-[#202020] transition-colors ${
                                  selectedAttackEvent?.id === ev.id ? 'bg-[#eff6ff] dark:bg-[#172554]/30' : ''
                                }`}
                              >
                                <td className="py-3 px-4 font-mono text-[#1a1a1a] dark:text-white whitespace-nowrap">
                                  <div>{formatDate(ev.startDate)}</div>
                                  <div className="text-[10px] text-[#8a9090]">{formatTime(ev.startDate)} UTC</div>
                                </td>
                                <td className="py-3 px-4 font-mono text-[#1a1a1a] dark:text-white whitespace-nowrap">
                                  {ev.endDate ? (
                                    <>
                                      <div>{formatDate(ev.endDate)}</div>
                                      <div className="text-[10px] text-[#8a9090]">{formatTime(ev.endDate)} UTC</div>
                                    </>
                                  ) : (
                                    <span className="text-[#ef4444] font-semibold">Active Scrubbing</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded bg-[#f3f4f6] dark:bg-[#262626] font-mono text-[11px] text-[#656b6b] dark:text-[#a0a0a0]">
                                    {ev.durationSeconds ? `${Math.floor(ev.durationSeconds / 60)}m ${ev.durationSeconds % 60}s` : '—'}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex flex-wrap gap-1">
                                    {(ev.vectors && ev.vectors.length > 0 ? ev.vectors : [ev.attackType]).map((vec, vIdx) => (
                                      <span
                                        key={vIdx}
                                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-[#fee2e2] text-[#dc2626] dark:bg-[#450a0a] dark:text-[#fca5a5]"
                                      >
                                        {vec}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3 px-3 font-mono text-[#ef4444] font-semibold whitespace-nowrap">
                                  <div>{ev.peakBps ? formatBps(ev.peakBps) : '—'}</div>
                                  <div className="text-[10px] text-[#8a9090]">{ev.peakPps ? formatPps(ev.peakPps) : ''}</div>
                                </td>
                                <td className="py-3 px-3 font-mono text-[#f59e0b] font-semibold whitespace-nowrap">
                                  {ev.totalDroppedBytes ? formatBytes(ev.totalDroppedBytes) : '—'}
                                </td>
                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    ev.status === 'mitigating'
                                      ? 'bg-[#fee2e2] text-[#dc2626] dark:bg-[#450a0a]'
                                      : 'bg-[#ecfdf5] text-[#059669] dark:bg-[#064e3b]'
                                  }`}>
                                    {ev.status === 'mitigating' ? 'Scrubbing' : 'Resolved'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAttackEvent(ev)}
                                    className="btn-secondary py-1 px-2.5 text-[11px] font-semibold cursor-pointer"
                                  >
                                    {selectedAttackEvent?.id === ev.id ? 'Viewing Curve' : 'Inspect Stats →'}
                                  </button>
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

              {/* TAB: VIRTUAL MAC (vMAC) */}
              {activeSubTab === 'vmac' && (
                <div className="p-6 text-xs flex flex-col gap-6">
                  <div>
                    <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white mb-1">
                      {status.carrier === 'hetzner' ? 'Hetzner Separate Virtual MAC (vMAC)' : 'Virtual MAC (vMAC) & Hardware Routing'}
                    </h3>
                    <p className="text-[#656b6b] dark:text-[#a0a0a0] leading-relaxed">
                      {status.carrier === 'hetzner'
                        ? 'Hetzner Robot assigns separate virtual MAC addresses for additional single IPs via PUT /ip/{ip}/mac. When assigned, the guest VM net0 interface should use this virtual MAC for layer-2 bridging.'
                        : 'OVH hardware border routers enforce MAC address filtering on bridged interfaces (vmbr0). To route traffic to guest VMs without triggering Anti-Hack port security locks, this Failover IP must have an authorized Virtual MAC that matches the VM network interface card (net0).'}
                    </p>
                  </div>

                  {/* MAC Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] mb-1">
                        Effective MAC ID
                      </p>
                      <p className="font-mono text-base font-bold text-[#1a1a1a] dark:text-white">
                        {status.macAddress || activeVm?.macAddress || 'None'}
                      </p>
                      <span className="text-[10px] text-[#656b6b] dark:text-[#888] mt-1 block">
                        {status.macMatched ? 'Synchronized with Proxmox net0' : (status.macAddress || activeVm?.macAddress) ? 'Active Interface Address' : 'No MAC allocated'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] mb-1">
                        {status.carrier === 'hetzner' ? 'Hetzner Separate MAC' : 'OVH Virtual MAC (vMAC)'}
                      </p>
                      <p className="font-mono text-base font-bold text-[#1a1a1a] dark:text-white">
                        {status.virtualMac || (status.carrier === 'hetzner' ? 'None Generated' : 'Not Created on OVH')}
                      </p>
                      <span className="text-[10px] text-[#656b6b] dark:text-[#888] mt-1 block">
                        {status.carrier === 'hetzner' ? 'Hetzner Robot WebService' : (status.serviceName ? `Dedicated Server: ${status.serviceName}` : 'OVH dedicated routing layer')}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#656b6b] dark:text-[#a0a0a0] mb-1">
                        Proxmox VM net0 MAC
                      </p>
                      <p className="font-mono text-base font-bold text-[#1a1a1a] dark:text-white">
                        {status.vmMac || activeVm?.macAddress || 'No Bound VM'}
                      </p>
                      <span className="text-[10px] text-[#656b6b] dark:text-[#888] mt-1 block">
                        {(status.boundVm || activeVm) ? `VM ${(status.boundVm || activeVm)?.vmid} (${(status.boundVm || activeVm)?.name})` : 'Unassigned pool IP'}
                      </span>
                    </div>
                  </div>

                  {/* Hetzner-specific MAC management controls */}
                  {status.carrier === 'hetzner' ? (
                    <div className="p-5 border border-[#dedfdf] dark:border-[#262626] rounded-xl bg-[#fbfaf9] dark:bg-[#171717] flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-sm text-[#1a1a1a] dark:text-white">Generate / Provision Separate Virtual MAC</h4>
                          <p className="text-[#656b6b] dark:text-[#a0a0a0] text-xs mt-0.5">
                            Calls Hetzner Robot API <code>PUT /ip/{status.ip}/mac</code> to generate an authentic virtual MAC (e.g. <code>00:50:56:xx:xx:xx</code>).
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleGenerateHetznerMac(syncToVmChecked)}
                            disabled={hetznerSubmittingMac}
                            className="btn-primary py-2 px-4 text-xs font-semibold cursor-pointer"
                          >
                            {hetznerSubmittingMac ? 'Generating on Hetzner…' : 'Generate Virtual MAC on Hetzner →'}
                          </button>
                          {status.virtualMac && (
                            <button
                              type="button"
                              onClick={handleDeleteHetznerMac}
                              disabled={hetznerDeletingMac}
                              className="btn-secondary py-2 px-3 text-xs font-semibold !text-[#dc2626] cursor-pointer"
                            >
                              {hetznerDeletingMac ? 'Deleting…' : 'Delete vMAC'}
                            </button>
                          )}
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-xs text-[#1a1a1a] dark:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={syncToVmChecked}
                          onChange={e => setSyncToVmChecked(e.target.checked)}
                          className="accent-[#2563eb] w-4 h-4 rounded"
                        />
                        <span>Automatically apply and sync generated virtual MAC to bound Proxmox VM (net0 interface)</span>
                      </label>
                    </div>
                  ) : (
                    <>
                      {/* Sync Status Alert */}
                      {status.macMatched ? (
                        <div className="p-4 rounded-xl border border-[#bbf7d0] dark:border-[#166534] bg-[#f0fdf4] dark:bg-[#052e16] text-[#166534] dark:text-[#86efac] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">✓</span>
                            <div>
                              <p className="font-bold text-xs">Virtual MAC Fully Synchronized</p>
                              <p className="text-[11px] opacity-90">OVH router and Proxmox VM net0 interface share the exact same hardware address ({status.macAddress || activeVm?.macAddress}). Network traffic is fully optimized.</p>
                            </div>
                          </div>
                        </div>
                      ) : status.virtualMac && (status.vmMac || activeVm?.macAddress) && !status.macMatched ? (
                        <div className="p-4 rounded-xl border border-[#fed7aa] dark:border-[#9a3412] bg-[#fff7ed] dark:bg-[#2c1206] text-[#9a3412] dark:text-[#fdba74] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⚠️</span>
                            <div>
                              <p className="font-bold text-xs">MAC Mismatch Detected</p>
                              <p className="text-[11px] opacity-90">OVH vMAC is {status.virtualMac}, but Proxmox VM net0 has {status.vmMac || activeVm?.macAddress}. Packets may be dropped by OVH border security.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCreateMac(true)}
                            disabled={macSubmitting}
                            className="px-3 py-1.5 bg-[#9a3412] text-white text-xs font-semibold rounded-lg hover:bg-[#7c2d12] cursor-pointer shrink-0"
                          >
                            {macSubmitting ? 'Syncing...' : 'Sync to VM net0 →'}
                          </button>
                        </div>
                      ) : !status.virtualMac && (status.vmMac || activeVm?.macAddress) ? (
                        <div className="p-4 rounded-xl border border-[#bae6fd] dark:border-[#0369a1] bg-[#f0f9ff] dark:bg-[#082f49] text-[#0369a1] dark:text-[#7dd3fc] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">ℹ️</span>
                            <div>
                              <p className="font-bold text-xs">vMAC Registration Recommended</p>
                              <p className="text-[11px] opacity-90">Guest VM has interface MAC ({status.vmMac || activeVm?.macAddress}), but no Virtual MAC is registered on OVH for {status.ip}. Register it on OVH to ensure border router authorization.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setCustomMacInput(status.vmMac || activeVm?.macAddress || ''); handleCreateMac(false); }}
                            disabled={macSubmitting}
                            className="px-3 py-1.5 bg-[#0284c7] text-white text-xs font-semibold rounded-lg hover:bg-[#0369a1] cursor-pointer shrink-0"
                          >
                            {macSubmitting ? 'Registering...' : 'Register Existing MAC on OVH →'}
                          </button>
                        </div>
                      ) : null}

                      {/* OVH vMAC Actions */}
                      <div className="p-5 border border-[#dedfdf] dark:border-[#262626] rounded-xl bg-[#fbfaf9] dark:bg-[#171717] flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="font-bold text-sm text-[#1a1a1a] dark:text-white">Generate / Assign Virtual MAC</h4>
                            <p className="text-[#656b6b] dark:text-[#a0a0a0] text-xs mt-0.5">
                              OVH will allocate a virtual MAC from its hardware block (e.g. <code>02:00:00:xx:xx:xx</code>) and route layer-2 frames to your host.
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleCreateMac(syncToVmChecked)}
                              disabled={macSubmitting}
                              className="btn-primary py-2 px-4 text-xs font-semibold cursor-pointer"
                            >
                              {macSubmitting ? 'Creating...' : 'Auto-Generate OVH vMAC →'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowMacModal('create')}
                              disabled={macSubmitting}
                              className="btn-secondary py-2 px-3 text-xs font-semibold cursor-pointer"
                            >
                              Custom MAC…
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#dedfdf] dark:border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-[#656b6b] dark:text-[#a0a0a0]">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={syncToVmChecked}
                              onChange={e => setSyncToVmChecked(e.target.checked)}
                              className="rounded border-[#dedfdf] accent-[#2563eb]"
                            />
                            <span className="font-medium text-[#1a1a1a] dark:text-white">
                              Automatically synchronize new MAC address to bound Proxmox VM (net0 interface)
                            </span>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB: HETZNER SUBNETS & ROUTING */}
              {activeSubTab === 'subnet' && (
                <div className="p-6 text-xs flex flex-col gap-5">
                  <div>
                    <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white mb-1">
                      Hetzner Discovered Subnets & Routed Blocks
                    </h3>
                    <p className="text-[#656b6b] dark:text-[#a0a0a0] leading-relaxed">
                      Subnets assigned to your Hetzner Robot account discovered via <code>GET /subnet</code>.
                    </p>
                  </div>

                  <div className="border border-[#dedfdf] dark:border-[#262626] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#fbfaf9] dark:bg-[#171717] border-b border-[#dedfdf] dark:border-[#262626] font-bold text-[#656b6b] dark:text-[#a0a0a0] uppercase text-[10.5px]">
                        <tr>
                          <th className="p-3">Subnet Address</th>
                          <th className="p-3">CIDR Mask</th>
                          <th className="p-3">Gateway / Server IP</th>
                          <th className="p-3">Failover Routed</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dedfdf] dark:divide-[#262626] font-mono">
                        {hetznerSubnets.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-xs text-[#656b6b] font-sans">
                              No routed subnets assigned on this Hetzner Robot account.
                            </td>
                          </tr>
                        ) : (
                          hetznerSubnets.map((sub, idx) => (
                            <tr key={idx} className="hover:bg-[#fafafa] dark:hover:bg-[#181818]">
                              <td className="p-3 font-bold text-[#1a1a1a] dark:text-white">{sub.ip}</td>
                              <td className="p-3">/{sub.mask}</td>
                              <td className="p-3 text-[#2563eb]">{sub.serverIp || '—'}</td>
                              <td className="p-3 font-sans">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sub.failover ? 'bg-[#f0fdf4] text-[#16a34a] dark:bg-[#052e16]' : 'bg-[#f1f1f1] text-[#656b6b] dark:bg-[#222]'}`}>
                                  {sub.failover ? 'Failover' : 'Static'}
                                </span>
                              </td>
                              <td className="p-3 font-sans">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sub.locked ? 'bg-[#fef2f2] text-[#dc2626] dark:bg-[#450a0a]' : 'bg-[#f0fdf4] text-[#16a34a] dark:bg-[#052e16]'}`}>
                                  {sub.locked ? 'Locked' : 'Active'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: EDGE FIREWALL */}
              {activeSubTab === 'firewall' && (
                <div className="p-6 text-xs flex flex-col gap-6">
                  {/* Master Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#dedfdf] dark:border-[#262626] gap-4">
                    <div>
                      <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white flex items-center gap-2">
                        Hardware Border Firewall
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${status.firewall.enabled ? 'bg-[#f0fdf4] text-[#16a34a] dark:bg-[#052e16]' : 'bg-[#f1f1f1] text-[#888] dark:bg-[#222]'}`}>
                          {status.firewall.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </h3>
                      <p className="text-[#656b6b] dark:text-[#a0a0a0] text-xs mt-0.5 leading-relaxed">
                        Line-rate stateless hardware firewall configured directly on OVH aggregation routers.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleFirewall}
                      disabled={fwToggling}
                      className={`btn-primary py-1.5 px-4 text-xs font-semibold cursor-pointer ${
                        status.firewall.enabled ? '!bg-[#dc2626] hover:!bg-[#b91c1c]' : ''
                      }`}
                    >
                      {fwToggling ? 'Updating…' : status.firewall.enabled ? 'Disable Edge Firewall' : 'Enable Edge Firewall'}
                    </button>
                  </div>

                  {/* One-Click Presets */}
                  <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#181818]">
                    <h4 className="font-semibold text-xs text-[#1a1a1a] dark:text-white mb-2">
                      Quick Security Presets
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewSeq(0);
                          setNewAction('permit');
                          setNewProto('tcp');
                          setNewDstPort('80');
                          setShowAddRuleForm(true);
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs font-medium cursor-pointer"
                      >
                        + Permit HTTP (80)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewSeq(1);
                          setNewAction('permit');
                          setNewProto('tcp');
                          setNewDstPort('443');
                          setShowAddRuleForm(true);
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs font-medium cursor-pointer"
                      >
                        + Permit HTTPS (443)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewSeq(2);
                          setNewAction('permit');
                          setNewProto('tcp');
                          setNewDstPort('22');
                          setShowAddRuleForm(true);
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs font-medium cursor-pointer"
                      >
                        + Permit SSH (22)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewSeq(19);
                          setNewAction('deny');
                          setNewProto('ipv4');
                          setNewDstPort('');
                          setNewSrcPort('');
                          setShowAddRuleForm(true);
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs font-medium !text-[#dc2626] cursor-pointer"
                      >
                        + Drop All IPv4 (Seq 19)
                      </button>
                    </div>
                  </div>

                  {/* Rules Controls & Search */}
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      value={ruleSearchQuery}
                      onChange={e => setRuleSearchQuery(e.target.value)}
                      placeholder="Filter rules by sequence, port, protocol…"
                      className="px-3 py-1.5 text-xs bg-white dark:bg-[#181818] border border-[#dedfdf] dark:border-[#313131] rounded-lg outline-none focus:border-[#1a1a1a] dark:focus:border-white w-64"
                    />

                    <button
                      type="button"
                      onClick={() => setShowAddRuleForm(prev => !prev)}
                      className="btn-primary px-3 py-1.5 text-xs font-semibold cursor-pointer"
                    >
                      {showAddRuleForm ? 'Cancel' : '+ Add Rule'}
                    </button>
                  </div>

                  {/* Add Rule Form */}
                  {showAddRuleForm && (
                    <form onSubmit={handleCreateRule} className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#313131] bg-white dark:bg-[#181818] flex flex-col gap-3">
                      <h4 className="font-semibold text-xs text-[#1a1a1a] dark:text-white">
                        Create Hardware Firewall Rule
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold mb-1 text-[#656b6b] dark:text-[#a0a0a0]">Sequence (0-19)</label>
                          <input
                            type="number"
                            min={0}
                            max={19}
                            value={newSeq}
                            onChange={e => setNewSeq(Number(e.target.value))}
                            className="w-full p-2 bg-white dark:bg-[#222] border border-[#dedfdf] dark:border-[#313131] rounded-lg font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1 text-[#656b6b] dark:text-[#a0a0a0]">Action</label>
                          <select
                            value={newAction}
                            onChange={e => setNewAction(e.target.value as any)}
                            className="w-full p-2 bg-white dark:bg-[#222] border border-[#dedfdf] dark:border-[#313131] rounded-lg font-semibold"
                          >
                            <option value="permit">PERMIT (Allow)</option>
                            <option value="deny">DENY (Drop)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1 text-[#656b6b] dark:text-[#a0a0a0]">Protocol</label>
                          <select
                            value={newProto}
                            onChange={e => setNewProto(e.target.value as any)}
                            className="w-full p-2 bg-white dark:bg-[#222] border border-[#dedfdf] dark:border-[#313131] rounded-lg font-semibold"
                          >
                            <option value="tcp">TCP</option>
                            <option value="udp">UDP</option>
                            <option value="icmp">ICMP</option>
                            <option value="ipv4">IPv4 (All)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1 text-[#656b6b] dark:text-[#a0a0a0]">Dest Port</label>
                          <input
                            type="text"
                            value={newDstPort}
                            onChange={e => setNewDstPort(e.target.value)}
                            placeholder="e.g. 80 or 443"
                            disabled={newProto === 'icmp' || newProto === 'ipv4'}
                            className="w-full p-2 bg-white dark:bg-[#222] border border-[#dedfdf] dark:border-[#313131] rounded-lg font-mono disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowAddRuleForm(false)} className="btn-secondary px-3 py-1 text-xs cursor-pointer">
                          Cancel
                        </button>
                        <button type="submit" disabled={ruleSubmitting} className="btn-primary px-4 py-1 text-xs font-semibold cursor-pointer">
                          {ruleSubmitting ? 'Saving…' : 'Add Rule'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Rules Table */}
                  <div className="border border-[#dedfdf] dark:border-[#262626] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717] font-mono text-[11px] text-[#656b6b] dark:text-[#a0a0a0] uppercase tracking-wider">
                          <th className="px-4 py-2.5">Seq</th>
                          <th className="px-4 py-2.5">Action</th>
                          <th className="px-4 py-2.5">Protocol</th>
                          <th className="px-4 py-2.5">Destination Port</th>
                          <th className="px-4 py-2.5">Source IP</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f1f1] dark:divide-[#1f1f1f]">
                        {loadingFwRules ? (
                          <tr><td colSpan={6} className="text-center py-6 text-[#888]">Loading hardware rules…</td></tr>
                        ) : filteredFwRules.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-6 text-[#888]">No firewall rules configured for this IP.</td></tr>
                        ) : (
                          filteredFwRules.map(rule => (
                            <tr key={rule.sequence} className="hover:bg-[#fafafa] dark:hover:bg-[#181818]">
                              <td className="px-4 py-2.5 font-mono font-bold text-[#1a1a1a] dark:text-white">
                                #{rule.sequence}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                  rule.action === 'permit'
                                    ? 'bg-[#f0fdf4] text-[#16a34a] dark:bg-[#052e16]'
                                    : 'bg-[#fef2f2] text-[#dc2626] dark:bg-[#450a0a]'
                                }`}>
                                  {rule.action.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono uppercase text-[#1a1a1a] dark:text-white">
                                {rule.protocol}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[#656b6b] dark:text-[#a0a0a0]">
                                {rule.destinationPort || 'ANY'}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[#656b6b] dark:text-[#a0a0a0]">
                                {rule.source || '0.0.0.0/0'}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRule(rule.sequence)}
                                  className="text-xs text-[#dc2626] hover:underline cursor-pointer"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: GAME DDOS CONTROLS */}
              {activeSubTab === 'game' && (
                <div className="p-6 text-xs flex flex-col gap-6">
                  <div>
                    <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white">
                      Hardware Game DDoS Protection
                    </h3>
                    <p className="text-[#656b6b] dark:text-[#a0a0a0] text-xs mt-0.5 leading-relaxed">
                      Custom stateful L4/L7 packet inspection designed for real-time game protocols (Source, Minecraft, GTA, etc.).
                    </p>
                  </div>

                  {/* Game Presets */}
                  <div className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#181818]">
                    <h4 className="font-semibold text-xs text-[#1a1a1a] dark:text-white mb-2">
                      Popular Game Server Presets
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {GAME_PRESETS.map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setGameProfile(preset.game);
                            setGameToPort(preset.port || 25565);
                          }}
                          className="btn-secondary px-3 py-1.5 text-xs font-medium cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add Game Rule Form */}
                  <form onSubmit={handleCreateGameRule} className="p-4 rounded-xl border border-[#dedfdf] dark:border-[#313131] bg-white dark:bg-[#181818] flex flex-col gap-3">
                    <h4 className="font-semibold text-xs text-[#1a1a1a] dark:text-white">
                      Add Game Protection Rule
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[#656b6b] dark:text-[#a0a0a0]">Game Profile</label>
                        <select
                          value={gameProfile}
                          onChange={e => setGameProfile(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-[#222] border border-[#dedfdf] dark:border-[#313131] rounded-lg font-semibold"
                        >
                          <option value="samp">GTA: SA-MP (San Andreas Multiplayer - 7777)</option>
                          <option value="mta">MTA: SA (Multi Theft Auto - 22003)</option>
                          <option value="minecraft">Minecraft Java Edition (25565)</option>
                          <option value="minecraftpocketedition">Minecraft Bedrock / Pocket Edition (19132)</option>
                          <option value="gtav">GTA V / FiveM / RageMP (30120)</option>
                          <option value="valve">Valve Source (CS2, TF2, GMod - 27015)</option>
                          <option value="rust">Rust Server (28015)</option>
                          <option value="teamspeak">TeamSpeak 3 Voice (9987)</option>
                          <option value="ark">ARK: Survival Evolved (7777)</option>
                          <option value="arma">ArmA 2 / 3 (2302)</option>
                          <option value="palworld">Palworld Dedicated (8211)</option>
                          <option value="other">Other (Custom UDP Filter)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[#656b6b] dark:text-[#a0a0a0]">Destination Port</label>
                        <input
                          type="number"
                          value={gameToPort}
                          onChange={e => setGameToPort(Number(e.target.value))}
                          className="w-full p-2 bg-white dark:bg-[#222] border border-[#dedfdf] dark:border-[#313131] rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-[#656b6b] dark:text-[#a0a0a0]">Protocol</label>
                        <select
                          value={gameProto}
                          onChange={e => setGameProto(e.target.value as any)}
                          className="w-full p-2 bg-white dark:bg-[#222] border border-[#dedfdf] dark:border-[#313131] rounded-lg font-semibold"
                        >
                          <option value="udp">UDP (Recommended for Games)</option>
                          <option value="tcp">TCP</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button type="submit" disabled={gameSubmitting} className="btn-primary px-4 py-1.5 text-xs font-semibold cursor-pointer">
                        {gameSubmitting ? 'Saving…' : '+ Add Game Protection Rule'}
                      </button>
                    </div>
                  </form>

                  {/* Active Game Rules Table */}
                  <div className="border border-[#dedfdf] dark:border-[#262626] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#dedfdf] dark:border-[#262626] bg-[#fbfaf9] dark:bg-[#171717] font-mono text-[11px] text-[#656b6b] dark:text-[#a0a0a0] uppercase tracking-wider">
                          <th className="px-4 py-2.5">Rule ID</th>
                          <th className="px-4 py-2.5">Game Profile</th>
                          <th className="px-4 py-2.5">Protected Port</th>
                          <th className="px-4 py-2.5">Protocol</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f1f1] dark:divide-[#1f1f1f]">
                        {loadingGameRules ? (
                          <tr><td colSpan={5} className="text-center py-6 text-[#888]">Loading game rules…</td></tr>
                        ) : gameRules.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-6 text-[#888]">No custom game DDoS rules assigned to this IP.</td></tr>
                        ) : (
                          gameRules.map(rule => (
                            <tr key={rule.id} className="hover:bg-[#fafafa] dark:hover:bg-[#181818]">
                              <td className="px-4 py-2.5 font-mono text-[#1a1a1a] dark:text-white">
                                #{rule.id}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-[#1a1a1a] dark:text-white">
                                {formatGameProfile(rule.gameType)}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[#2563eb] dark:text-[#60a5fa] font-bold">
                                {rule.toPort || 'ANY'}
                              </td>
                              <td className="px-4 py-2.5 font-mono uppercase text-[#656b6b]">
                                {rule.l4Protocol || 'UDP'}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGameRule(rule.id)}
                                  className="text-xs text-[#dc2626] hover:underline cursor-pointer"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: ANTI-HACK WATCHDOG */}
              {activeSubTab === 'antihack' && (
                <div className="p-6 text-xs flex flex-col gap-6">
                  {status.antiHack ? (
                    <div className="p-5 rounded-xl border border-[#fecaca] dark:border-[#7f1d1d] bg-[#fef2f2] dark:bg-[#2b0c0c] text-xs">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">⚠️</span>
                          <h3 className="font-bold text-sm text-[#dc2626] dark:text-[#f87171]">
                            IP Quarantined by OVH Anti-Hack System
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={handleUnblockAntiHack}
                          disabled={unblockingAntiHack}
                          className="btn-primary !bg-[#dc2626] hover:!bg-[#b91c1c] px-4 py-1.5 text-xs font-semibold cursor-pointer"
                        >
                          {unblockingAntiHack ? 'Submitting Request…' : 'Request Immediate Unblock'}
                        </button>
                      </div>

                      <p className="text-[#7f1d1d] dark:text-[#fca5a5] mb-3 leading-relaxed">
                        Traffic to and from this IP is currently blocked by OVH automated security sensors due to detected outbound malicious activity or abuse complaints.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 font-mono text-[11px]">
                        <div className="p-3 bg-white dark:bg-[#1a0a0a] rounded-lg border border-[#fecaca] dark:border-[#5c1818]">
                          <span className="text-[#888]">Quarantine Initiated:</span>
                          <div className="font-bold text-[#1a1a1a] dark:text-white mt-0.5">{status.antiHack.blockedSince}</div>
                        </div>
                        <div className="p-3 bg-white dark:bg-[#1a0a0a] rounded-lg border border-[#fecaca] dark:border-[#5c1818]">
                          <span className="text-[#888]">Time to Unblock Eligibility:</span>
                          <div className="font-bold text-[#1a1a1a] dark:text-white mt-0.5">
                            {status.antiHack.timeToUnblock > 0 ? `${status.antiHack.timeToUnblock} seconds remaining` : 'Eligible for unblock now'}
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="block font-semibold text-[#888] mb-1">OVH Security Incident Log:</span>
                        <pre className="p-3 bg-black text-green-400 rounded-lg font-mono text-[10px] overflow-x-auto whitespace-pre-wrap max-h-48">
                          {status.antiHack.logs}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-[#f0fdf4] dark:bg-[#052e16] border border-[#bbf7d0] dark:border-[#166534] rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-[#dcfce7] dark:bg-[#14532d] text-[#16a34a] flex items-center justify-center text-xl mx-auto mb-3">
                        ✓
                      </div>
                      <h3 className="font-serif font-medium text-base text-[#16a34a] dark:text-[#4ade80]">
                        Anti-Hack Status: Clear & Healthy
                      </h3>
                      <p className="text-xs text-[#166534] dark:text-[#86efac] mt-1 max-w-md mx-auto leading-relaxed">
                        No active abuse reports, outgoing volumetric attacks, or spambot signatures have been detected by OVH security sensors for this IP.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
