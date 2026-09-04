import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { apiClient, ApiVM, ApiVmMetadata, ApiReimageRequest } from '../services/apiClient';
import { VmMetadataPanel } from './VmMetadataPanel';
import { compareIps } from '../utils/ipUtils';

const VncTerminal = lazy(() => import('./VncTerminal').then(module => ({ default: module.VncTerminal })));
const VmMetricsChart = lazy(() => import('./charts/VmMetricsChart'));
const VmFirewallPanel = lazy(() => import('./VmFirewallPanel'));
const VmBackupPanel = lazy(() => import('./VmBackupPanel'));

interface ClientPanelContentProps {
  onOpenModal: (modalName: string) => void;
  filter?: string;
  workspaceConnectionId?: string;
  selectedVmid?: number;
  selectedConnectionId?: string;
  selectedNode?: string;
  onBackToTable?: () => void;
  onSelectVm?: (vmid: number, connectionId?: string | null, node?: string | null) => void;
}

export const ClientPanelContent: React.FC<ClientPanelContentProps> = ({ 
  onOpenModal, 
  filter, 
  workspaceConnectionId, 
  selectedVmid, 
  selectedConnectionId,
  selectedNode,
  onBackToTable,
  onSelectVm,
}) => {
  const effectiveConnectionId = selectedConnectionId || workspaceConnectionId;
  const [clientVMs, setClientVMs] = useState<ApiVM[]>([]);
  const [selectedVm, setSelectedVm] = useState<ApiVM | null>(null);
  const [vmMetadata, setVmMetadata] = useState<ApiVmMetadata | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [vncCommand, setVncCommand] = useState('');
  const [vncOutput, setVncOutput] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'metrics' | 'console' | 'reinstall' | 'ticket' | 'firewall' | 'backups' | 'cloud-init'>('metrics');
  const [viewMode, setViewMode] = useState<'table' | 'details'>(selectedVmid ? 'details' : 'table');
  const [localFilter, setLocalFilter] = useState<string>(filter || '');
  const [cloudInitPassword, setCloudInitPassword] = useState('');
  
  // Table Interactions State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{key: keyof ApiVM; direction: 'asc'|'desc'} | null>(null);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  
  // Refs to avoid stale closures in background polling intervals
  const selectedVmidRef = useRef(selectedVmid);
  selectedVmidRef.current = selectedVmid;

  const selectedConnRef = useRef(selectedConnectionId);
  selectedConnRef.current = selectedConnectionId;

  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;

  const selectedVmRef = useRef(selectedVm);
  selectedVmRef.current = selectedVm;

  useEffect(() => {
    if (selectedVmid) {
      setViewMode('details');
    } else if (!filter || !['vnc', 'metrics', 'firewall', 'backups', 'ticket', 'reinstall'].includes(filter)) {
      if (!selectedVmRef.current) {
        setViewMode('table');
      }
    }
  }, [selectedVmid, filter]);

  const handleBackToTable = () => {
    selectedVmidRef.current = undefined;
    selectedConnRef.current = undefined;
    selectedNodeRef.current = undefined;
    selectedVmRef.current = null;
    setViewMode('table');
    setSelectedVm(null);
    if (onBackToTable) {
      onBackToTable();
    } else {
      const params = new URLSearchParams(window.location.search);
      params.delete('vmid');
      params.delete('connectionId');
      params.delete('node');
      const nextSearch = params.toString();
      window.history.pushState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Allow Escape key to return to instances table when looking at details
  useEffect(() => {
    if (viewMode !== 'details') return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const hasOpenOverlay = document.querySelector('.fixed.z-\\[1000\\], .fixed.z-\\[2000\\], .fixed.z-\\[1500\\], .alert-rules-modal');
        if (!hasOpenOverlay) {
          e.preventDefault();
          handleBackToTable();
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [viewMode]);
  
  const getVmPrefix = (connName?: string | null) => {
    if (!connName) return 'VM';
    return connName.match(/[A-Z]{2}/)?.[0] || 'VM';
  };


  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    owner: true,
    status: true,
    os: true,
    node: true,
    type: true,
    ip: true
  });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const currentUserEmail = localStorage.getItem('votion_user_email') || 'client@votioncloud.org';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };
  // Power Action Loading State Spinner
  const [isPowerLoading, setIsPowerLoading] = useState<string | null>(null);

  // Approval-based OS reimage request state
  const [selectedReinstallOs, setSelectedReinstallOs] = useState('Ubuntu 24.04 LTS');
  const [reimageRequests, setReimageRequests] = useState<ApiReimageRequest[]>([]);
  const [isReimageLoading, setIsReimageLoading] = useState(false);
  const [isReimageSubmitting, setIsReimageSubmitting] = useState(false);
  const [isReimageAcknowledged, setIsReimageAcknowledged] = useState(false);
  const [reimageReason, setReimageReason] = useState('');
  const [showReimageConfirm, setShowReimageConfirm] = useState(false);

  // Support Ticket Form State linked to VMID
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Quota Upgrade');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isTicketSubmitting, setIsTicketSubmitting] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // PROMPT 5.1: Fetch ONLY assigned servers for logged-in client via GET /api/client/vms
  const loadClientVMs = async (isBackground = false) => {
    try {
      const vms = await apiClient.getClientVMs(workspaceConnectionId);
      
      // Prevent unnecessary state updates if VM list has not changed (prevents re-render loops)
      setClientVMs(prev => {
        if (
          prev.length === vms.length &&
          prev.every((p, i) => {
            const n = vms[i];
            return (
              p.vmid === n?.vmid &&
              p.proxmoxConnectionId === n?.proxmoxConnectionId &&
              p.status === n?.status &&
              p.name === n?.name &&
              p.ipAddress === n?.ipAddress &&
              p.cpuUsagePct === n?.cpuUsagePct &&
              p.ramUsageBytes === n?.ramUsageBytes
            );
          })
        ) {
          return prev;
        }
        return vms;
      });
      setLoadError(null);
      
      setSelectedVm(previous => {
        const targetVmid = selectedVmidRef.current || Number(new URLSearchParams(window.location.search).get('vmid')) || undefined;
        const targetConn = selectedConnRef.current || new URLSearchParams(window.location.search).get('connectionId') || effectiveConnectionId;
        const targetNode = selectedNodeRef.current || new URLSearchParams(window.location.search).get('node') || undefined;

        // Priority 1: Keep previously selected VM if it exists (preserve across polls!)
        if (previous) {
          const stillExists = vms.find(vm => {
            if (vm.vmKey && previous.vmKey && vm.vmKey === previous.vmKey) return true;
            if (String(vm.vmid) !== String(previous.vmid)) return false;
            if (previous.proxmoxConnectionId && vm.proxmoxConnectionId && previous.proxmoxConnectionId !== vm.proxmoxConnectionId) {
              return false;
            }
            if (previous.node && vm.node && previous.node !== vm.node) {
              return false;
            }
            return true;
          });
          if (stillExists) {
            const isUnchanged =
              previous.status === stillExists.status &&
              previous.name === stillExists.name &&
              previous.ipAddress === stillExists.ipAddress &&
              previous.cpuUsagePct === stillExists.cpuUsagePct &&
              previous.ramUsageBytes === stillExists.ramUsageBytes &&
              previous.node === stillExists.node &&
              previous.proxmoxConnectionId === stillExists.proxmoxConnectionId;
            return isUnchanged ? previous : stillExists;
          }
          // If fleet slice currently doesn't include it (e.g. location filter), keep existing selection
          return previous;
        }

        // Priority 2: URL Selection (matching BOTH vmid and connectionId/node if available)
        if (targetVmid) {
          const urlVm = vms.find(vm => {
            if (String(vm.vmid) !== String(targetVmid)) return false;
            if (targetConn && vm.proxmoxConnectionId && vm.proxmoxConnectionId !== targetConn) return false;
            if (targetNode && vm.node && vm.node !== targetNode) return false;
            return true;
          }) || (targetConn ? null : vms.find(vm => String(vm.vmid) === String(targetVmid)));
          if (urlVm) return urlVm;
        }

        // Priority 3: If no active selection and no target VM, stay null
        return null;
      });
      // Console traffic always routes through the panel's own WebSocket
      // relay (VncTerminal) — the underlying cluster host is never exposed.

      if (!isBackground) setIsLoading(false);
    } catch (err) {
      if (!isBackground) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load assigned instances.');
        setIsLoading(false);
      }
    }
  };

  // Immediate synchronous VM selection from local in-memory fleet on URL change
  useEffect(() => {
    const targetVmid = selectedVmid || Number(new URLSearchParams(window.location.search).get('vmid')) || undefined;
    if (targetVmid && clientVMs.length > 0) {
      const urlConnectionId = selectedConnectionId || new URLSearchParams(window.location.search).get('connectionId') || effectiveConnectionId;
      const urlNode = selectedNode || new URLSearchParams(window.location.search).get('node') || undefined;

      setSelectedVm(prev => {
        // If current VM already matches targetVmid AND target connection/node, preserve it unconditionally across renders
        if (prev && String(prev.vmid) === String(targetVmid)) {
          const connMatches = !urlConnectionId || prev.proxmoxConnectionId === urlConnectionId;
          const nodeMatches = !urlNode || prev.node === urlNode;
          if (connMatches && nodeMatches) {
            return prev;
          }
        }

        const match = clientVMs.find(vm => {
          if (String(vm.vmid) !== String(targetVmid)) return false;
          if (urlConnectionId && vm.proxmoxConnectionId && vm.proxmoxConnectionId !== urlConnectionId) return false;
          if (urlNode && vm.node && vm.node !== urlNode) return false;
          return true;
        }) || (urlConnectionId ? null : clientVMs.find(vm => String(vm.vmid) === String(targetVmid)));

        if (match) {
          setViewMode('details');
          return match;
        }
        return prev;
      });
    }
  }, [selectedVmid, selectedConnectionId, selectedNode, effectiveConnectionId, clientVMs]);

  useEffect(() => {
    if (clientVMs.length === 0) {
      setIsLoading(true);
    }
    void loadClientVMs(false);
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadClientVMs(true);
    }, 15000);
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void loadClientVMs(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [workspaceConnectionId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedVm) {
      setVmMetadata(null);
      setMetadataError(null);
      return;
    }

    const loadMetadata = async (isBackground = false) => {
      if (!isBackground) {
        setIsMetadataLoading(true);
      }
      setMetadataError(null);
      try {
        const metadata = await apiClient.getVMMetadata(selectedVm.vmid, selectedVm.proxmoxConnectionId, selectedVm.node);
        if (!cancelled) setVmMetadata(metadata);
      } catch (err) {
        if (!cancelled && !isBackground) {
          setVmMetadata(null);
          setMetadataError(err instanceof Error ? err.message : 'Server details are currently unavailable.');
        }
      } finally {
        if (!cancelled && !isBackground) setIsMetadataLoading(false);
      }
    };

    void loadMetadata(false);
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadMetadata(true);
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedVm?.vmid, selectedVm?.proxmoxConnectionId, selectedVm?.node]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedVm) {
      setReimageRequests([]);
      return;
    }

    setIsReimageLoading(true);
    apiClient.getVmReimageRequests(selectedVm.vmid, selectedVm.proxmoxConnectionId)
      .then(requests => {
        if (!cancelled) setReimageRequests(requests);
      })
      .catch(err => {
        if (!cancelled) {
          setReimageRequests([]);
          showToast(err instanceof Error ? err.message : 'Unable to load reimage request status.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsReimageLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedVm?.vmid, selectedVm?.proxmoxConnectionId]);

  useEffect(() => {
    setSelectedReinstallOs(selectedVm?.type === 'lxc' ? 'Alpine Linux 3.19 (LXC)' : 'Ubuntu 24.04 LTS');
    setIsReimageAcknowledged(false);
    setReimageReason('');
    setShowReimageConfirm(false);
  }, [selectedVm?.vmid, selectedVm?.proxmoxConnectionId, selectedVm?.type]);

  // PROMPT 5.3: Sync filter prop from Sidebar to VM Selection and Active Tab
  useEffect(() => {
    if (filter === 'vnc') { setActiveTab('console'); setViewMode('details'); }
    else if (filter === 'metrics') { setActiveTab('metrics'); setViewMode('details'); }
    else if (filter === 'firewall') { setActiveTab('firewall'); setViewMode('details'); }
    else if (filter === 'ticket') { setActiveTab('ticket'); setViewMode('details'); }
    else if (filter === 'reinstall') { setActiveTab('reinstall'); setViewMode('details'); }
    else if (filter === 'backups') { setActiveTab('backups'); setViewMode('details'); }
    else if (!selectedVmid) { setViewMode('table'); }
    else { setViewMode('details'); }
    
    if (filter === 'qemu' || filter === 'lxc') {
      setLocalFilter(filter);
    } else {
      setLocalFilter('');
    }
  }, [filter]);

  let displayVMs = (localFilter === 'qemu' || false) 
    ? clientVMs.filter(v => v.type === localFilter) 
    : localFilter === 'suspended'
    ? clientVMs.filter(v => v.isSuspended)
    : clientVMs;

  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    displayVMs = displayVMs.filter(v => 
      v.name.toLowerCase().includes(q) || 
      String(v.vmid).includes(q) || 
      v.ownerEmail.toLowerCase().includes(q) ||
      (v.ipAddress && v.ipAddress.toLowerCase().includes(q)) ||
      (v.node && v.node.toLowerCase().includes(q))
    );
  }

  // Sorting
  displayVMs = displayVMs.slice().sort((a, b) => {
    if (sortConfig) {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (sortConfig.key === 'ipAddress') {
        const ipDiff = compareIps(a.ipAddress, b.ipAddress);
        return sortConfig.direction === 'asc' ? ipDiff : -ipDiff;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }
      return sortConfig.direction === 'asc' 
        ? String(valA || '').localeCompare(String(valB || '')) 
        : String(valB || '').localeCompare(String(valA || ''));
    }

    if (a.ipAddress && b.ipAddress) {
      const ipDiff = compareIps(a.ipAddress, b.ipAddress);
      if (ipDiff !== 0) return ipDiff;
    }
    return a.vmid - b.vmid;
  });

  // PROMPT 5.2: Client Power Controls with 403 Suspension Check & Loading Spinner
  const handlePowerAction = async (action: 'start' | 'stop' | 'reboot' | 'shutdown') => {
    if (!selectedVm) return;
    if (selectedVm.isSuspended) {
      showToast(`⚠️ HTTP 403: Server is suspended due to expiration. Power actions are disabled until renewal.`);
      return;
    }

    setIsPowerLoading(action);
    try {
      const res = await apiClient.executeClientPowerAction(selectedVm.vmid, action, selectedVm.proxmoxConnectionId);
      setIsPowerLoading(null);
      if (res.success) {
        showToast(res.message || `Server ${action === 'start' ? 'started' : action === 'shutdown' ? 'shutting down' : action === 'reboot' ? 'rebooting' : 'updated'} successfully.`);
        loadClientVMs();
      } else {
        showToast(res.error || `Unable to ${action} server. Please try again.`);
      }
    } catch (err: any) {
      setIsPowerLoading(null);
      showToast(err.message || `Power action ${action} blocked.`);
    }
  };

  // Client OS Reimage Approval Request
  const handleReinstallSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVm || selectedVm.isSuspended || isReimageSubmitting || !isReimageAcknowledged) return;
    setShowReimageConfirm(true);
  };

  const confirmReimageRequest = async () => {
    if (!selectedVm || isReimageSubmitting) return;
    setIsReimageSubmitting(true);
    try {
      const res = await apiClient.createVmReimageRequest(selectedVm.vmid, selectedReinstallOs, reimageReason, selectedVm.proxmoxConnectionId);
      setReimageRequests(prev => [res.data, ...prev.filter(request => request.id !== res.data.id)]);
      setShowReimageConfirm(false);
      setIsReimageAcknowledged(false);
      setReimageReason('');
      showToast(res.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit the reimage request.');
    } finally {
      setIsReimageSubmitting(false);
    }
  };

  const cancelReimageRequest = async (request: ApiReimageRequest) => {
    if (!selectedVm || request.status !== 'pending') return;
    try {
      const res = await apiClient.cancelVmReimageRequest(selectedVm.vmid, request.id, selectedVm.proxmoxConnectionId);
      setReimageRequests(prev => prev.map(item => item.id === request.id ? res.data : item));
      showToast(res.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to cancel the reimage request.');
    }
  };

  // Support Ticket Linked to VMID
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVm || !ticketSubject.trim() || isTicketSubmitting) return;

    setIsTicketSubmitting(true);
    try {
      const res = await apiClient.createSupportTicket(ticketSubject.trim(), ticketCategory, ticketPriority, selectedVm.vmid);
      showToast(res.message || 'Your support ticket has been submitted.');
      setTicketSubject('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open the support ticket.');
    } finally {
      setIsTicketSubmitting(false);
    }
  };

  // Interactive VNC Command Execution
  const handleVncCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vncCommand.trim() || !selectedVm) return;

    const cmd = vncCommand.trim();
    setVncCommand('');
    setVncOutput(prev => [...prev, `root@${selectedVm.name}:~# ${cmd}`]);

    const res = await apiClient.executeVncCommand(selectedVm.vmid, cmd);
    if (res.success && res.output) {
      setVncOutput(prev => [...prev, res.output]);
    }
  };

  const latestReimageRequest = reimageRequests[0];

  if (viewMode === 'table') {
    return (
      <main className="app-content px-12 py-10 flex flex-col" style={{ maxWidth: '1440px', margin: '0 auto', minHeight: 'calc(100vh - 120px)' }}>
        {toastMessage && (
          <div className="theme-toast mb-6 p-3 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-white/60 hover:text-white">✕</button>
          </div>
        )}
        
        <div className="flex justify-between items-end mb-8">
          <h1 className="page-heading">Manage instances</h1>
          <div className="flex gap-8 text-[13px]">
            <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5 text-black" aria-live="polite">
                    <span className={`w-1.5 h-1.5 rounded-full ${loadError ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`}></span>
                    {loadError ? 'Cluster API unavailable' : 'Cluster API Connected'}
                  </div>
              <a href="#" className="text-[#2563eb] hover:underline" onClick={(e) => { e.preventDefault(); loadClientVMs(); }}>Refresh sync</a>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-black" aria-live="polite">
                {isLoading && clientVMs.length === 0 ? (
                  <span className="inline-block h-4 w-24 animate-pulse rounded bg-[#f1f1f1]" aria-label="Loading allocated instance count" />
                ) : (
                  `${clientVMs.length} total allocated`
                )}
              </div>
              <a href="#" className="text-[#2563eb] hover:underline" onClick={(e) => { e.preventDefault(); onOpenModal('support'); }}>Request quota</a>
            </div>
          </div>
        </div>

        <div className="flex border-b border-[#dedfdf] mt-6">
          <div onClick={() => setLocalFilter('')} className={`pb-3 border-b-2 font-semibold text-[13px] px-1 cursor-pointer mr-6 ${!localFilter || localFilter==='' ? 'border-black text-black' : 'border-transparent text-[#656b6b] hover:text-black'}`}>All instances</div>
          <div onClick={() => setLocalFilter('qemu')} className={`pb-3 border-b-2 font-semibold text-[13px] px-1 cursor-pointer mr-6 ${localFilter==='qemu' ? 'border-black text-black' : 'border-transparent text-[#656b6b] hover:text-black'}`}>Cloud Instances</div>
          
          <div onClick={() => setLocalFilter('suspended')} className={`pb-3 border-b-2 font-semibold text-[13px] px-1 cursor-pointer mr-6 ${localFilter==='suspended' ? 'border-black text-black' : 'border-transparent text-[#656b6b] hover:text-black'}`}>Suspended</div>
        </div>

        <div className="flex justify-between items-center mt-6 mb-4">
          <div className="flex gap-2 relative">
            <button type="button" disabled title="Bulk power actions are unavailable in client view" aria-disabled="true" className="border border-[#dedfdf] rounded px-3 py-1.5 text-[13px] font-semibold text-[#8a9090] flex items-center gap-1 cursor-not-allowed opacity-70">Actions</button>
            <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="border border-[#dedfdf] rounded px-3 py-1.5 text-[13px] w-64 placeholder-[#a7aaaa] outline-none focus:border-black" 
              placeholder="Search" 
            />
          </div>
          <div className="flex gap-2 items-center relative">
            <button type="button" disabled title="Use the instance tabs and search field to filter this list" aria-disabled="true" className="border border-[#dedfdf] rounded px-3 py-1.5 text-[13px] font-semibold text-[#8a9090] cursor-not-allowed opacity-70">Filters</button>
            
            <button onClick={() => setColumnsMenuOpen(!columnsMenuOpen)} className="border border-[#dedfdf] rounded px-3 py-1.5 text-[13px] font-semibold text-black flex items-center gap-1 hover:bg-[#fbfaf9] cursor-pointer">Select columns <span className="text-[10px]">▼</span></button>
            {columnsMenuOpen && (
              <div className="absolute top-10 right-32 w-48 bg-white border border-[#dedfdf] rounded shadow-lg z-50 py-2 px-3 flex flex-col gap-2">
                {Object.keys(visibleColumns).map(col => (
                  <label key={col} className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={visibleColumns[col as keyof typeof visibleColumns]} onChange={() => setVisibleColumns(prev => ({...prev, [col]: !prev[col as keyof typeof visibleColumns]}))} />
                    <span className="capitalize">{col}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="w-6"></div>
            
            <button type="button" disabled title="Node management is available to administrators only" aria-disabled="true" className="border border-[#dedfdf] rounded px-3 py-1.5 text-[13px] font-semibold text-[#8a9090] flex items-center gap-1 cursor-not-allowed opacity-70">Manage nodes</button>

            <button onClick={() => onOpenModal('support')} className="bg-[#1a1a1a] text-white rounded px-4 py-1.5 text-[13px] font-bold shadow-sm hover:bg-black transition-colors cursor-pointer">Request Instance</button>
          </div>
        </div>

        <div className="responsive-table-container border-t border-[#dedfdf]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#dedfdf] bg-white">
                <th className="py-3 px-4 w-12"><input type="checkbox" className="w-[18px] h-[18px] rounded border-[#dedfdf] cursor-pointer" /></th>
                {visibleColumns.id && <th className="py-3 px-4 text-[13px] font-medium text-[#1a1a1a] border-r border-[#dedfdf] w-32">Instance ID <span className="inline-flex flex-col text-[7px] leading-[4px] ml-1.5 opacity-50 relative -top-[1px]"><span>▲</span><span>▼</span></span></th>}
                {visibleColumns.name && <th className="py-3 px-6 text-[13px] font-medium text-[#1a1a1a]">Name <span className="inline-flex flex-col text-[7px] leading-[4px] ml-1.5 opacity-50 relative -top-[1px]"><span>▲</span><span>▼</span></span></th>}
                {visibleColumns.owner && <th className="py-3 px-4 text-[13px] font-medium text-[#1a1a1a]">Owner <span className="inline-flex flex-col text-[7px] leading-[4px] ml-1.5 opacity-50 relative -top-[1px]"><span>▲</span><span>▼</span></span></th>}
                {visibleColumns.status && <th className="py-3 px-4 text-[13px] font-medium text-[#1a1a1a]">Status <span className="inline-flex flex-col text-[7px] leading-[4px] ml-1.5 opacity-50 relative -top-[1px]"><span>▲</span><span>▼</span></span></th>}
                {visibleColumns.type && <th className="py-3 px-4 text-[13px] font-medium text-[#1a1a1a]">Type <span className="inline-flex flex-col text-[7px] leading-[4px] ml-1.5 opacity-50 relative -top-[1px]"><span>▲</span><span>▼</span></span></th>}
                {visibleColumns.node && <th className="py-3 px-4 text-[13px] font-medium text-[#1a1a1a]">Host Node <span className="inline-flex flex-col text-[7px] leading-[4px] ml-1.5 opacity-50 relative -top-[1px]"><span>▲</span><span>▼</span></span></th>}
                {visibleColumns.ip && <th className="py-3 px-4 text-[13px] font-medium text-[#1a1a1a] text-right">IP Address <span className="inline-flex flex-col text-[7px] leading-[4px] ml-1.5 opacity-50 relative -top-[1px]"><span>▲</span><span>▼</span></span></th>}
              </tr>
            </thead>
            <tbody>
              {displayVMs.map(vm => (
                <tr key={vm.vmKey} className="border-b border-[#dedfdf] hover:bg-[#fbfaf9] cursor-pointer transition-colors" onClick={() => {
                  setSelectedVm(vm);
                  setViewMode('details');
                  selectedVmidRef.current = vm.vmid;
                  if (vm.proxmoxConnectionId) selectedConnRef.current = vm.proxmoxConnectionId;
                  if (vm.node) selectedNodeRef.current = vm.node;
                  if (onSelectVm) {
                    onSelectVm(vm.vmid, vm.proxmoxConnectionId, vm.node);
                  } else {
                    const params = new URLSearchParams(window.location.search);
                    params.set('vmid', String(vm.vmid));
                    if (vm.proxmoxConnectionId) {
                      params.set('connectionId', vm.proxmoxConnectionId);
                    }
                    if (vm.node) {
                      params.set('node', vm.node);
                    }
                    window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }
                  void apiClient.recordNavigationUsage({ itemKey: `vm:${vm.proxmoxConnectionId || ''}:${vm.node || ''}:${vm.vmid}`, itemType: 'vm', vmid: vm.vmid }).catch(() => undefined);
                }}>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}><input type="checkbox" className="w-[18px] h-[18px] rounded border-[#dedfdf] cursor-pointer" /></td>
                  {visibleColumns.id && <td className="py-3 px-4 text-[13px] text-[#1d4ed8] border-r border-[#dedfdf] font-normal"><span className="underline decoration-1 underline-offset-[3px] hover:text-[#1e3a8a] cursor-pointer">{getVmPrefix(vm.proxmoxConnectionName)}-{vm.vmid}</span></td>}
                  {visibleColumns.name && <td className="py-3 px-6 text-[13px] text-[#1a1a1a] dark:text-white font-semibold">{vm.name}</td>}
                  {visibleColumns.owner && <td className="py-3 px-4 text-[13px] text-[#1a1a1a]">{vm.ownerEmail}</td>}
                  {visibleColumns.status && (
                    <td className="py-3 px-4 text-[13px] text-[#1a1a1a]">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-[5px] h-[5px] rounded-full ${vm.status === 'running' ? 'bg-[#10b981]' : vm.isSuspended ? 'bg-[#ef4444]' : 'bg-[#656b6b]'}`}></span>
                        {vm.status === 'running' ? 'Running' : vm.isSuspended ? 'Suspended' : 'Stopped'}
                      </span>
                    </td>
                  )}
                  {visibleColumns.type && <td className="py-3 px-4 text-[13px] text-[#1a1a1a]">{vm.type === 'lxc' ? 'Container' : 'Cloud Compute'}</td>}
                  {visibleColumns.node && <td className="py-3 px-4 text-[13px] text-[#1a1a1a]">{vm.nodeDisplayName || vm.displayNode || vm.proxmoxConnectionName || (vm.node && !/^(info|cluster)$/i.test(vm.node) ? vm.node : 'stellar-node-01')}</td>}
                  {visibleColumns.ip && (
                    <td className="py-3 px-4 text-[13px] text-[#1a1a1a] dark:text-white text-right font-mono">
                      {vm.ipAddress || 'Pending'}
                    </td>
                  )}
                </tr>
              ))}
              {isLoading && clientVMs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[13px] text-[#656b6b]" aria-busy="true">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-[#a7aaaa]" />
                      Loading assigned instances...
                    </span>
                  </td>
                </tr>
              ) : displayVMs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[13px] text-[#656b6b]">
                    {loadError ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        <span className="font-semibold text-[#8d3028]">Assigned instances could not be loaded</span>
                        <span>{loadError}</span>
                        <button type="button" onClick={() => void loadClientVMs()} className="rounded border border-[#1a1a1a] px-3 py-1.5 text-[11px] font-semibold text-[#1a1a1a] hover:bg-[#f4f5f5]">Retry</button>
                      </span>
                    ) : searchQuery.trim()
                        ? 'No instances match the current search'
                        : 'No assigned instances found'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        
        <div className="mt-auto pt-8 border-t border-[#dedfdf] text-center text-[11px] text-[#656b6b]">
          © Copyright 2026, Stellar Panel, Inc. All rights reserved. <a href="#" className="text-[#2563eb] hover:underline">Terms of service</a> <a href="#" className="text-[#2563eb] hover:underline">Privacy policy</a>
        </div>
      </main>
    );
  }

  return (
    <main className="app-content p-3 sm:p-5 md:p-8">
      {/* Back to Table Button */}
      <div className="mb-5 md:mb-8">
        <button 
          onClick={handleBackToTable}
          className="vm-instance-back-button text-[17px] text-[#2563eb] hover:text-[#1d4ed8] flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span className="text-xl font-light leading-none relative -top-[1px] font-sans">←</span>
          <span className="underline decoration-1 underline-offset-4 font-normal">Manage instances</span>
        </button>
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="theme-toast mb-6 p-3 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/60 hover:text-white">✕</button>
        </div>
      )}

      {/* PROMPT 5.4: SUSPENDED WARNING NOTICE IF SELECTED VM IS SUSPENDED */}
      {selectedVm?.isSuspended && (
        <div className="mb-6 p-4 bg-[#fef2f2] border-2 border-[#fecaca] rounded-xl text-xs text-[#991b1b] flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <div className="font-bold text-sm">Server Suspended — Contact Support / Renew Allocation</div>
              <div className="text-[#b91c1c] mt-0.5">
                Instance {getVmPrefix(selectedVm.proxmoxConnectionName)}-{selectedVm.vmid} expired on <span className="font-mono font-bold">{selectedVm.expiryDate ? new Date(selectedVm.expiryDate).toLocaleDateString() : 'Expired'}</span>. All power actions and VNC console features are locked.
              </div>
            </div>
          </div>
          <button onClick={() => onOpenModal('support')} className="theme-destructive-button btn-primary bg-[#dc2626] hover:bg-[#b91c1c] cursor-pointer">
            Open Billing Ticket
          </button>
        </div>
      )}

      {/* INSTANCE MANAGEMENT PANEL */}
      <section className="vm-instance-shell">
        <div className="vm-instance-card">
          {selectedVm ? (
              <div className="vm-instance-card-body" aria-label="Selected instance details">
              
              {/* PANEL HEADER & POWER CONTROLS */}
              <div className="vm-instance-header">
                <div className="vm-identity-block">
                  <div className="vm-identity-kicker">
                    <span>Instance</span>
                    <span className="vm-identity-separator" aria-hidden="true">/</span>
                    <span className="vm-identity-id">{getVmPrefix(selectedVm.proxmoxConnectionName)}-{selectedVm.vmid}</span>
                  </div>
                  <div className="vm-identity-name-row">
                    <h3 className="vm-identity-name">{selectedVm.name}</h3>
                    <span className={`vm-instance-status vm-instance-status-${selectedVm.status}`}>{selectedVm.status}</span>
                  </div>
                  <dl className="vm-identity-meta">
                    <div>
                      <dt>Operating system</dt>
                      <dd>{selectedVm.os || 'Ubuntu 24.04 LTS'}</dd>
                    </div>
                    <div>
                      <dt>Host Node</dt>
                      <dd className="font-semibold text-[#1a1a1a] dark:text-[#eee]">{selectedVm.nodeDisplayName || selectedVm.displayNode || selectedVm.proxmoxConnectionName || selectedVm.node}</dd>
                    </div>
                    {selectedVm.displayCpuModel && (
                      <div>
                        <dt>Processor</dt>
                        <dd className="font-semibold text-[#0284c7] dark:text-[#38bdf8] font-mono">{selectedVm.displayCpuModel}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Address</dt>
                      <dd className="vm-identity-value-mono">
                        {vmMetadata?.network.primaryIp || vmMetadata?.network.configuredIp || selectedVm.ipAddress || 'Pending'}
                      </dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd className="vm-identity-value-mono">{selectedVm.expiryDate ? new Date(selectedVm.expiryDate).toLocaleDateString() : 'Never'}</dd>
                    </div>
                  </dl>
                </div>

                {/* CLIENT POWER BUTTONS */}
                <div className="vm-power-actions" aria-label="Instance power controls">
                  <span className="vm-power-caption">Power</span>
                  <div className="vm-power-button-group">
                    <button
                      onClick={() => handlePowerAction('start')}
                      disabled={selectedVm.isSuspended || selectedVm.status === 'running' || isPowerLoading !== null}
                      className={`vm-power-action vm-power-action-primary ${selectedVm.isSuspended || selectedVm.status === 'running' || isPowerLoading !== null ? 'is-disabled' : ''}`}
                    >
                      {isPowerLoading === 'start' ? 'Starting...' : 'Start'}
                    </button>
                    <button
                      onClick={() => handlePowerAction('reboot')}
                      disabled={selectedVm.isSuspended || isPowerLoading !== null}
                      className={`vm-power-action ${selectedVm.isSuspended || isPowerLoading !== null ? 'is-disabled' : ''}`}
                    >
                      {isPowerLoading === 'reboot' ? 'Restarting...' : 'Restart'}
                    </button>
                    <button
                      onClick={() => handlePowerAction('stop')}
                      disabled={selectedVm.isSuspended || selectedVm.status === 'stopped' || isPowerLoading !== null}
                      className={`vm-power-action vm-power-action-danger ${selectedVm.isSuspended || selectedVm.status === 'stopped' || isPowerLoading !== null ? 'is-disabled' : ''}`}
                    >
                      {isPowerLoading === 'stop' ? 'Stopping...' : 'Stop'}
                    </button>
                  </div>
                </div>
              </div>

              {/* LIVE RESOURCE USAGE BARS (Selected VM) */}
              {/* Note: Moved to VmMetricsChart.tsx so it updates live via telemetry instead of relying on the static DB snapshot */}

              <VmMetadataPanel metadata={vmMetadata} isLoading={isMetadataLoading} error={metadataError} />

              {/* MANAGEMENT TABS */}
            <div className="vm-management-tabs" role="tablist" aria-label="Instance management tools">
              <button 
                onClick={() => setActiveTab('metrics')} 
                type="button"
                role="tab"
                aria-selected={activeTab === 'metrics'}
                className={`vm-management-tab ${activeTab === 'metrics' ? 'is-active' : ''}`}
              >
                Telemetry & Metrics
              </button>
              <button 
                onClick={() => setActiveTab('console')} 
                type="button"
                role="tab"
                aria-selected={activeTab === 'console'}
                className={`vm-management-tab ${activeTab === 'console' ? 'is-active' : ''}`}
              >
                VNC Web Terminal
              </button>
              <button 
                onClick={() => setActiveTab('reinstall')} 
                type="button"
                role="tab"
                aria-selected={activeTab === 'reinstall'}
                className={`vm-management-tab ${activeTab === 'reinstall' ? 'is-active' : ''}`}
              >
                OS Re-Imaging Request
              </button>
              <button 
                onClick={() => setActiveTab('cloud-init')} 
                type="button"
                role="tab"
                aria-selected={activeTab === 'cloud-init'}
                className={`vm-management-tab ${activeTab === 'cloud-init' ? 'is-active' : ''}`}
              >
                Cloud-Init Configuration
              </button>
              <button 
                onClick={() => setActiveTab('ticket')} 
                type="button"
                role="tab"
                aria-selected={activeTab === 'ticket'}
                className={`vm-management-tab ${activeTab === 'ticket' ? 'is-active' : ''}`}
              >
                Contact Support for {selectedVm.name || `${getVmPrefix(selectedVm.proxmoxConnectionName)}-${selectedVm.vmid}`}
              </button>
              <button 
                onClick={() => setActiveTab('firewall')} 
                type="button"
                role="tab"
                aria-selected={activeTab === 'firewall'}
                className={`vm-management-tab ${activeTab === 'firewall' ? 'is-active' : ''}`}
              >
                Network Firewall
              </button>
              <button 
                onClick={() => setActiveTab('backups')} 
                type="button"
                role="tab"
                aria-selected={activeTab === 'backups'}
                className={`vm-management-tab ${activeTab === 'backups' ? 'is-active' : ''}`}
              >
                Snapshot Backups
              </button>
            </div>

            {/* TAB 1: VNC WEB CONSOLE */}
            {activeTab === 'console' && (
              <div className="flex flex-col gap-3">
                <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] h-[500px] w-full overflow-hidden relative">
                  {selectedVm.isSuspended ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white font-mono text-sm z-10">
                      Console locked due to VM suspension
                    </div>
                  ) : null}
                  {!selectedVm.isSuspended && (
                    <div className="w-full h-full bg-black overflow-hidden relative">
                        <VncTerminal
                          key={`vnc-${selectedVm.proxmoxConnectionId || 'local'}-${selectedVm.vmid}`}
                          vmid={selectedVm.vmid}
                          proxmoxConnectionId={selectedVm.proxmoxConnectionId}
                          node={selectedVm.node && !/^(info|cluster)$/i.test(selectedVm.node) ? selectedVm.node : 'info'}
                          type={selectedVm.type}
                        />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CLIENT OS REIMAGE APPROVAL REQUEST */}
            {activeTab === 'reinstall' && (
              <div className="flex flex-col gap-5 max-w-[620px]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#656b6b]">Approval required</p>
                  <h4 className="mt-1 text-lg font-semibold text-[#1a1a1a]">Request an OS reimage</h4>
                  <p className="mt-1 text-xs leading-5 text-[#656b6b]">
                    Submit a request for administrator review. This only starts an approval workflow; it does not change your server or begin an operation.
                  </p>
                </div>

                {isReimageLoading ? (
                  <div className="h-20 animate-pulse rounded-lg bg-[#f3f4f4]" aria-busy="true" aria-label="Loading reimage request status" />
                ) : latestReimageRequest ? (
                  <div className={`theme-reimage-request-card rounded-lg border p-4 ${latestReimageRequest.status === 'pending' ? 'border-[#f3c56b] bg-[#fffaf0]' : latestReimageRequest.status === 'approved' ? 'border-[#b7dfcf] bg-[#f1fbf7]' : 'border-[#dedfdf] bg-[#fbfaf9]'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="theme-reimage-request-label text-[11px] font-semibold uppercase tracking-[0.12em] text-[#656b6b]">Latest request</p>
                        <p className="theme-reimage-request-id mt-1 font-mono text-xs text-[#1a1a1a]">{latestReimageRequest.id}</p>
                      </div>
                      <span className={`theme-reimage-request-status status-${latestReimageRequest.status} rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold capitalize text-[#1a1a1a]`}>{latestReimageRequest.status}</span>
                    </div>
                    <p className="theme-reimage-request-os mt-3 text-xs text-[#1a1a1a]">{latestReimageRequest.requestedOs}</p>
                    <p className="theme-reimage-request-description mt-1 text-xs leading-5 text-[#656b6b]">
                      {latestReimageRequest.status === 'pending'
                        ? 'An administrator must review this request. No reimage has started.'
                        : latestReimageRequest.status === 'approved'
                          ? 'Approved for a separate operator execution step. Approval does not start a reimage automatically.'
                          : latestReimageRequest.status === 'rejected'
                            ? latestReimageRequest.reviewerNote || 'The administrator rejected this request.'
                            : 'This request was cancelled before review.'}
                    </p>
                    {latestReimageRequest.status === 'pending' && (
                      <button type="button" onClick={() => cancelReimageRequest(latestReimageRequest)} className="mt-3 text-xs font-semibold text-[#b42318] underline underline-offset-2 cursor-pointer">
                        Cancel pending request
                      </button>
                    )}
                  </div>
                ) : null}

                {(!latestReimageRequest || latestReimageRequest.status !== 'pending') && (
                  <form onSubmit={handleReinstallSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1" htmlFor="reimage-os">Target OS image</label>
                      <select
                        id="reimage-os"
                        value={selectedReinstallOs}
                        onChange={(e) => setSelectedReinstallOs(e.target.value)}
                        disabled={selectedVm.isSuspended || isReimageSubmitting}
                        className="w-full p-2.5 border border-[#dedfdf] rounded text-xs outline-none font-semibold"
                      >
                        {selectedVm.type === 'lxc' ? (
                          <>
                            <option value="Alpine Linux 3.19 (LXC)">Alpine Linux 3.19 Minimal</option>
                            <option value="Debian 12 Bookworm">Debian 12 Bookworm</option>
                          </>
                        ) : (
                          <>
                            <option value="Ubuntu 24.04 LTS">Ubuntu 24.04 LTS (Noble Numbat)</option>
                            <option value="Windows Server 2022 Standard">Windows Server 2022 Standard Edition</option>
                            <option value="Debian 12 Bookworm">Debian 12 Bookworm</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" htmlFor="reimage-reason">Reason or operator context <span className="font-normal text-[#656b6b]">(optional)</span></label>
                      <textarea
                        id="reimage-reason"
                        value={reimageReason}
                        onChange={(e) => setReimageReason(e.target.value)}
                        maxLength={1000}
                        rows={3}
                        placeholder="Provide context for the administrator reviewing this request."
                        disabled={selectedVm.isSuspended || isReimageSubmitting}
                        className="w-full resize-y rounded border border-[#dedfdf] p-2.5 text-xs outline-none focus:border-[#1a1a1a]"
                      />
                    </div>
                    <label className="flex items-start gap-2 rounded-lg border border-[#f0c36d] bg-[#fffaf0] p-3 text-xs leading-5 text-[#7a4b00] cursor-pointer">
                      <input type="checkbox" checked={isReimageAcknowledged} onChange={(e) => setIsReimageAcknowledged(e.target.checked)} disabled={selectedVm.isSuspended || isReimageSubmitting} className="mt-1" />
                      <span>I understand that an approved reimage is a destructive operation that may replace the VM disk and permanently remove its data. I will verify backups before any future execution.</span>
                    </label>
                    <button
                      type="submit"
                      disabled={selectedVm.isSuspended || isReimageSubmitting || !isReimageAcknowledged}
                      className={`btn-primary py-2 px-4 text-xs cursor-pointer ${selectedVm.isSuspended || isReimageSubmitting || !isReimageAcknowledged ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {isReimageSubmitting ? 'Submitting request…' : 'Continue to confirmation'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2.5: CLOUD-INIT CONFIGURATION */}
            {activeTab === 'cloud-init' && (
              <div className="flex flex-col gap-5 max-w-[620px]">
                <div>
                  <h4 className="text-lg font-semibold text-[#1a1a1a]">Cloud-Init Configuration</h4>
                  <p className="mt-1 text-xs leading-5 text-[#656b6b]">
                    Inject network configurations and your public SSH keys directly into the virtual machine's hardware profile. 
                    You must configure your SSH keys in your Account Security Settings first.
                  </p>
                </div>

                <div className="rounded-lg border border-[#dedfdf] bg-[#fbfaf9] p-4 flex flex-col gap-4">
                  <p className="text-[13px] text-[#1a1a1a]">
                    <strong>Note:</strong> Configuration parameters are written to the server's initialization drive. 
                    A server restart from the control panel is required to apply the changes.
                  </p>
                  
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await apiClient.injectCloudInitSsh(selectedVm.vmid, selectedVm.proxmoxConnectionId);
                        alert(res.message || 'SSH public keys deployed successfully. Please restart your server to apply changes.');
                      } catch (err: any) {
                        alert(`Error: ${err.message}`);
                      }
                    }}
                    className="btn-primary w-fit text-sm cursor-pointer"
                  >
                    Inject Public SSH Keys
                  </button>

                  <div className="mt-4 pt-4 border-t border-[#dedfdf] flex flex-col gap-3">
                    <h5 className="font-semibold text-sm">Reset OS Password</h5>
                    <p className="text-xs text-[#656b6b]">
                      Update your operating system password. When guest integration services are running, the password will update immediately without requiring a restart.
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <input 
                        type="password" 
                        placeholder="New Password" 
                        value={cloudInitPassword}
                        onChange={(e) => setCloudInitPassword(e.target.value)}
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        spellCheck={false}
                        className="p-2 border border-[#dedfdf] rounded outline-none focus:border-[#1a1a1a] text-sm w-64"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!cloudInitPassword) return alert('Enter a password');
                          try {
                            const res = await apiClient.resetVmPassword(selectedVm.vmid, cloudInitPassword, selectedVm.proxmoxConnectionId);
                            setCloudInitPassword('');
                            alert(res.message + (res.agentResult ? `\n\nAgent status: ${res.agentResult}` : ''));
                          } catch (err: any) {
                            alert(`Error: ${err.message}`);
                          }
                        }}
                        className="btn-secondary text-sm cursor-pointer whitespace-nowrap"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LINKED SUPPORT TICKET FORM */}
            {activeTab === 'ticket' && (
              <form onSubmit={handleTicketSubmit} className="flex flex-col gap-4 max-w-[480px]">
                <p className="text-xs text-[#656b6b]">
                  Open a priority support request linked directly to {selectedVm.name || 'this server'}.
                </p>
                <div>
                  <label className="block text-xs font-semibold mb-1">Ticket Subject</label>
                  <input 
                    type="text" 
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="e.g. Inbound traffic blocked on port 443"
                    className="w-full p-2.5 border border-[#dedfdf] rounded text-xs outline-none focus:border-[#1a1a1a]"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Category</label>
                    <select 
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                      className="w-full p-2 border border-[#dedfdf] rounded text-xs outline-none"
                    >
                      <option value="Quota Upgrade">Quota Upgrade</option>
                      <option value="Network Firewall">Network Firewall</option>
                      <option value="Storage & Disks">Storage & Volumes</option>
                      <option value="General">General Inquiries</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Priority</label>
                    <select 
                      value={ticketPriority}
                      onChange={(e) => setTicketPriority(e.target.value as any)}
                      className="w-full p-2 border border-[#dedfdf] rounded text-xs outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent SLA</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={isTicketSubmitting} className="btn-primary py-2 px-4 text-xs cursor-pointer disabled:opacity-50">
                  {isTicketSubmitting ? 'Submitting request…' : 'Submit support request'}
                </button>
              </form>
            )}

            {/* TAB 4: METRICS & TELEMETRY */}
            {activeTab === 'metrics' && (
              <div className="flex flex-col w-full -mt-2">
                <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-xl bg-[#f3f4f4]" aria-busy="true" />}>
                  <VmMetricsChart vmid={selectedVm.vmid} proxmoxConnectionId={selectedVm.proxmoxConnectionId} />
                </Suspense>
              </div>
            )}

            {/* TAB 5: FIREWALL PANEL */}
            {activeTab === 'firewall' && (
              <div className="flex flex-col w-full -mt-2">
                <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-xl bg-[#f3f4f4]" aria-busy="true" />}>
                  <VmFirewallPanel vmid={selectedVm.vmid} proxmoxConnectionId={selectedVm.proxmoxConnectionId} />
                </Suspense>
              </div>
            )}

            {/* TAB 6: BACKUP PANEL */}
            {activeTab === 'backups' && (
              <div className="flex flex-col w-full mt-2">
                <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-xl bg-[#f3f4f4]" aria-busy="true" />}>
                  <VmBackupPanel vmid={selectedVm.vmid} proxmoxConnectionId={selectedVm.proxmoxConnectionId} />
                </Suspense>
              </div>
            )}

            </div>
          ) : isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#656b6b] p-12 h-full">
              <div className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mb-4" />
              <div className="text-sm font-semibold text-[#1a1a1a]">Connecting to instance…</div>
              <div className="text-xs mt-1 text-center text-[#656b6b]">Fetching live configuration and telemetry from cluster…</div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#656b6b] p-12 h-full">
              <svg className="w-12 h-12 mb-4 text-[#dedfdf]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
              <div className="text-sm font-semibold text-[#1a1a1a]">No Instance Selected</div>
              <div className="text-xs mt-1 text-center max-w-sm">Select an instance from the left sidebar to access power controls, live telemetry, and the web console.</div>
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="app-footer">
        <div>&copy; Copyright 2026, Votion One™ Platform. All rights reserved.</div>
        <div className="footer-links">
          <a href="/legal/terms">Terms of service</a>
          <a href="/legal/privacy">Privacy policy</a>
        </div>
      </footer>

      {showReimageConfirm && selectedVm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a1a1a]/45 p-4" role="presentation">
          <div className="w-full max-w-md rounded-xl border border-[#dedfdf] bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="reimage-confirm-title">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b42318]">Final confirmation</p>
            <h4 id="reimage-confirm-title" className="mt-2 text-lg font-semibold text-[#1a1a1a]">Submit OS reimage request?</h4>
            <p className="mt-3 text-sm leading-6 text-[#656b6b]">
              You are requesting <span className="font-semibold text-[#1a1a1a]">{selectedReinstallOs}</span> for {getVmPrefix(selectedVm.proxmoxConnectionName)}-{selectedVm.vmid}. The request will be recorded and sent to an administrator for review.
            </p>
            <div className="mt-4 rounded-lg border border-[#f0c36d] bg-[#fffaf0] p-3 text-xs leading-5 text-[#7a4b00]">
              This approval step does not change your server or erase data. If approved, a separate operator action is still required before any reimage execution.
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowReimageConfirm(false)} disabled={isReimageSubmitting} className="rounded border border-[#dedfdf] px-4 py-2 text-xs font-semibold text-[#1a1a1a] hover:bg-[#fbfaf9] cursor-pointer disabled:opacity-50">Go back</button>
              <button type="button" onClick={confirmReimageRequest} disabled={isReimageSubmitting} className="rounded bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-white hover:bg-black cursor-pointer disabled:opacity-50">{isReimageSubmitting ? 'Submitting…' : 'Submit request'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
