import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { useToast } from './ToastContext';

interface AlertRule {
  id: number;
  name: string;
  target: 'cluster' | 'node' | 'vm';
  vmid?: number;
  nodeName?: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  cooldownMinutes: number;
  enabled: boolean;
}

interface AlertRulesModalProps {
  onClose: () => void;
}

const EMPTY_FORM = {
  name: '',
  target: 'cluster' as 'cluster' | 'node' | 'vm',
  vmid: '' as string | number,
  nodeName: '',
  metric: 'cpu_pct',
  operator: '>',
  threshold: '85' as string | number,
  severity: 'warning' as 'info' | 'warning' | 'critical',
  cooldownMinutes: 10,
  enabled: true,
};

interface VmEntry {
  vmid: number;
  name: string;
  type: string;
}

export const AlertRulesModal: React.FC<AlertRulesModalProps> = ({ onClose }) => {
  const { showToast } = useToast();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [vms, setVms] = useState<VmEntry[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    try {
      const res = await apiClient.getAlertRules();
      if (res?.success) setRules(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    load();
    // Load VM list so VM-scoped rules can pick a target
    apiClient.getClientVMs().then((vms: any) => {
      if (Array.isArray(vms)) {
        setVms(vms.map((v: any) => ({ vmid: v.vmid, name: v.name, type: v.type || 'qemu' })));
      }
    }).catch(() => {});
    apiClient.getAdminNodes().then((adminNodes: any[]) => {
      if (Array.isArray(adminNodes)) {
        setNodes(adminNodes.map(node => String(node.nodeName || node.node || '')).filter(Boolean));
      }
    }).catch(() => {});
  }, []);

  const notify = (msg: string) => {
    showToast(msg);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const threshold = Number(form.threshold);
    const maxThreshold = form.metric === 'node_availability' ? 1 : 100;
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > maxThreshold) {
      notify(form.metric === 'node_availability' ? 'Availability threshold must be 0 or 1.' : 'Please enter a threshold between 0 and 100.');
      return;
    }
    try {
      const payload: any = {
        name: form.name || `${form.metric} ${form.operator} ${form.threshold}`,
        target: form.target,
        metric: form.metric,
        operator: form.operator,
        threshold,
        severity: form.severity,
        cooldownMinutes: Number(form.cooldownMinutes) || 10,
        enabled: form.enabled,
      };
      if (form.target === 'vm') {
        payload.vmid = Number(form.vmid);
        if (!payload.vmid) {
          notify('Please select a VM for this VM-scoped rule.');
          return;
        }
      }
      if (form.target === 'node') {
        payload.nodeName = form.nodeName || undefined;
        if (!payload.nodeName) {
          notify('Please select a node or choose the all-nodes option.');
          return;
        }
      }
      const res = editing !== null ? await apiClient.updateAlertRule(editing, payload) : await apiClient.createAlertRule(payload);
      if (res?.success) {
        notify(editing ? 'Alert rule updated.' : 'Alert rule created. The engine evaluates rules every 15 seconds.');
        setEditing(null);
        setForm(EMPTY_FORM);
        await load();
      } else {
        notify(res?.error || 'Failed to save rule.');
      }
    } catch {
      notify('Failed to save rule.');
    }
  };

  const toggleEnabled = async (rule: AlertRule) => {
    const res = await apiClient.updateAlertRule(rule.id, { enabled: !rule.enabled });
    if (res?.success) {
      notify(rule.enabled ? `Rule "${rule.name}" disabled.` : `Rule "${rule.name}" enabled.`);
      await load();
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete alert rule "${name}"?`)) return;
    const res = await apiClient.deleteAlertRule(id);
    if (res?.success) {
      notify('Alert rule deleted.');
      await load();
    } else {
      notify(res?.error || 'Failed to delete rule.');
    }
  };

  const startEdit = (rule: AlertRule) => {
    setEditing(rule.id);
    setForm({
      name: rule.name || '',
      target: rule.target as 'cluster' | 'node' | 'vm',
      vmid: rule.vmid ?? '',
      nodeName: rule.nodeName ?? '',
      metric: rule.metric,
      operator: rule.operator,
      threshold: String(rule.threshold),
      severity: (rule.severity || 'warning') as 'info' | 'warning' | 'critical',
      cooldownMinutes: rule.cooldownMinutes,
      enabled: rule.enabled,
    });
  };

  const metricLabel = (m: string) => ({
    cpu_pct: 'CPU %',
    mem_pct: 'Memory %',
    cpu: 'Cluster CPU %',
    mem: 'Cluster Memory %',
    node_availability: 'Availability',
    node_cpu_pct: 'Node CPU %',
    node_mem_pct: 'Node memory %',
    node_storage_pct: 'Node storage %',
  }[m] || m);

  const vmName = (vmid?: number) => vms.find(v => v.vmid === vmid)?.name || `VMID ${vmid ?? '-'}`;

  return (
    <div 
      className="alert-rules-modal fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-2xl bg-white border border-[#dedfdf] rounded-xl shadow-2xl flex flex-col max-h-[90vh] my-8 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#dedfdf] px-6 py-4 shrink-0">
          <div>
            <h3 className="text-base font-bold text-[#1a1a1a]">Alert Rules</h3>
            <p className="text-xs text-[#656b6b] mt-0.5">Rules are evaluated every 15s against live telemetry. Node availability and resource breaches create notifications without changing VM state.</p>
          </div>
          <button onClick={onClose} className="text-[#1a1a1a]/60 hover:text-[#1a1a1a] font-bold cursor-pointer text-lg">✕</button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          {/* Existing rules */}
          {loading ? (
            <div className="text-xs text-[#a7aaaa] font-mono py-4">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="text-xs text-[#a7aaaa] font-mono py-4">No alert rules yet. Create one below.</div>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {rules.map(rule => (
                <div key={rule.id} className={`border border-[#dedfdf] rounded-lg p-3 flex items-center gap-3 ${rule.enabled ? 'bg-white' : 'bg-[#fbfaf9] opacity-65'}`}>
                  <button
                    onClick={() => toggleEnabled(rule)}
                    className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${rule.enabled ? 'bg-[#16a34a]' : 'bg-[#dedfdf]'}`}
                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${rule.enabled ? 'left-4' : 'left-0.5'}`}></span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#1a1a1a]">{rule.name}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                        rule.severity === 'critical' ? 'text-[#dc2626] bg-[#fef2f2] border-[#fecaca]' :
                        rule.severity === 'info' ? 'text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]' :
                        'text-[#b45309] bg-[#fffbeb] border-[#fde68a]'
                      }`}>{rule.severity}</span>
                      <span className="text-[10px] text-[#a7aaaa]">{rule.target === 'vm' ? `VM: ${vmName(rule.vmid)}` : rule.target === 'node' ? `Node: ${rule.nodeName || 'All nodes'}` : 'Cluster-wide'}</span>
                    </div>
                    <p className="text-[11px] text-[#656b6b] mt-0.5">
                      {metricLabel(rule.metric)} {rule.operator} {rule.metric === 'node_availability' ? (Number(rule.threshold) >= 0.5 ? 'online' : 'offline') : `${rule.threshold}%`} · cooldown {rule.cooldownMinutes}m
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(rule)} className="px-2 py-1 text-[11px] font-bold border border-[#dedfdf] rounded hover:bg-[#f1f1f1] cursor-pointer">Edit</button>
                    <button onClick={() => handleDelete(rule.id, rule.name)} className="px-2 py-1 text-[11px] font-bold border border-[#fecaca] text-[#dc2626] rounded hover:bg-[#fef2f2] cursor-pointer">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rule editor form */}
          <form onSubmit={handleSubmit} className="border border-[#1a1a1a] rounded-lg p-4 flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">
              {editing ? 'Edit Rule' : 'Create New Rule'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1 text-[#1a1a1a]">Rule Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Cluster CPU critical"
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none font-medium text-[#1a1a1a] bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#1a1a1a]">Scope</label>
                <select
                  value={form.target}
                  onChange={(e) => {
                    const target = e.target.value as 'cluster' | 'node' | 'vm';
                    setForm({ ...form, target, metric: target === 'node' ? 'node_availability' : 'cpu_pct', vmid: '', nodeName: '' });
                  }}
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none font-medium text-[#1a1a1a] bg-white"
                >
                  <option value="cluster">Cluster (all nodes)</option>
                  <option value="node">Specific node</option>
                  <option value="vm">Specific VM</option>
                </select>
              </div>
              {form.target === 'node' && (
                <div>
                  <label className="block font-semibold mb-1 text-[#1a1a1a]">Target node</label>
                  <select
                    value={form.nodeName}
                    onChange={(e) => setForm({ ...form, nodeName: e.target.value })}
                    className="w-full p-2 border border-[#dedfdf] rounded outline-none font-medium text-[#1a1a1a] bg-white"
                  >
                    <option value="">Select node scope...</option>
                    <option value="*">All nodes</option>
                    {nodes.map(node => <option key={node} value={node}>{node}</option>)}
                  </select>
                </div>
              )}
              {form.target === 'vm' && (
                <div>
                  <label className="block font-semibold mb-1 text-[#1a1a1a]">Target VM</label>
                  <select
                    value={form.vmid}
                    onChange={(e) => setForm({ ...form, vmid: e.target.value })}
                    className="w-full p-2 border border-[#dedfdf] rounded outline-none font-medium text-[#1a1a1a] bg-white"
                  >
                    <option value="">Select VM...</option>
                    {vms.map((v: VmEntry) => (
                      <option key={v.vmid} value={v.vmid}>{v.name} ({v.type === 'qemu' ? 'VM' : 'CT'} {v.vmid})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block font-semibold mb-1 text-[#1a1a1a]">Metric</label>
                <select
                  value={form.metric}
                  onChange={(e) => setForm({ ...form, metric: e.target.value })}
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none font-medium text-[#1a1a1a] bg-white"
                >
                  {form.target === 'node' ? <>
                    <option value="node_availability">Availability (online/offline)</option>
                    <option value="node_cpu_pct">CPU % (utilization)</option>
                    <option value="node_mem_pct">Memory % (utilization)</option>
                    <option value="node_storage_pct">Storage % (utilization)</option>
                  </> : <>
                    <option value="cpu_pct">CPU % (utilization)</option>
                    <option value="mem_pct">Memory % (utilization)</option>
                    <option value="cpu">Cluster CPU %</option>
                    <option value="mem">Cluster Memory %</option>
                  </>}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="w-1/3">
                  <label className="block font-semibold mb-1 text-[#1a1a1a]">Operator</label>
                  <select
                    value={form.operator}
                    onChange={(e) => setForm({ ...form, operator: e.target.value })}
                    className="w-full p-2 border border-[#dedfdf] rounded outline-none font-medium text-[#1a1a1a] bg-white"
                  >
                    <option value=">">greater than</option>
                    <option value=">=">≥ or equal</option>
                    <option value="<">less than</option>
                    <option value="<=">≤ or equal</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block font-semibold mb-1 text-[#1a1a1a]">{form.metric === 'node_availability' ? 'Threshold (1 = online, 0 = offline)' : 'Threshold (%)'}</label>
                  <input
                    type="number"
                    min="0"
                    max={form.metric === 'node_availability' ? '1' : '100'}
                    step={form.metric === 'node_availability' ? '1' : '0.1'}
                    value={form.threshold}
                    onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                    className="w-full p-2 border border-[#dedfdf] rounded outline-none font-mono font-medium text-[#1a1a1a] bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#1a1a1a]">Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as 'info' | 'warning' | 'critical' })}
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none font-medium text-[#1a1a1a] bg-white"
                >
                  <option value="info">Info (blue)</option>
                  <option value="warning">Warning (amber)</option>
                  <option value="critical">Critical (red)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#1a1a1a]">Cooldown (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={form.cooldownMinutes}
                  onChange={(e) => setForm({ ...form, cooldownMinutes: Number(e.target.value) })}
                  className="w-full p-2 border border-[#dedfdf] rounded outline-none font-mono font-medium text-[#1a1a1a] bg-white"
                  title="Suppress repeat notifications for this rule within this window"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#1a1a1a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-4 h-4 accent-[#2563eb]"
                />
                Enabled
              </label>
              <div className="flex items-center gap-2">
                {editing && (
                  <button type="button" onClick={() => { setEditing(null); setForm(EMPTY_FORM); }} className="btn-secondary text-xs cursor-pointer">
                    Cancel Edit
                  </button>
                )}
                <button type="submit" className="btn-primary text-xs cursor-pointer">
                  {editing ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
