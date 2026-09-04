import React, { useEffect, useState } from 'react';
import { Card, Title, Button, Badge, TextInput } from '@tremor/react';
import { apiClient } from '../services/apiClient';

interface VmFirewallPanelProps {
  vmid: number;
  proxmoxConnectionId?: string | null;
}

export default function VmFirewallPanel({ vmid, proxmoxConnectionId }: VmFirewallPanelProps) {
  const [rules, setRules] = useState<any[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [preset, setPreset] = useState('custom');
  const [action, setAction] = useState('ACCEPT');
  const [proto, setProto] = useState('tcp');
  const [dport, setDport] = useState('');
  const [comment, setComment] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchFirewall = async () => {
    setIsLoading(true);
    try {
      const json = await apiClient.getFirewallRules(vmid, proxmoxConnectionId);
      if (json.success) {
        setRules(json.rules || []);
        setIsEnabled(json.options?.enable === 1 || json.options?.enable === true);
      } else {
        showToast(json.error || 'Could not load firewall rules');
      }
    } catch (e) {
      showToast('Network error loading firewall rules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFirewall();
  }, [vmid, proxmoxConnectionId]);

  const handleToggle = async () => {
    try {
      const json = await apiClient.toggleFirewall(vmid, !isEnabled, proxmoxConnectionId);
      if (json.success) {
        showToast(`Firewall ${!isEnabled ? 'enabled' : 'disabled'} for VM ${vmid}`);
        fetchFirewall();
      } else {
        showToast(json.error || 'Could not change firewall state');
      }
    } catch (e) {
      showToast('Network error toggling firewall');
    }
  };

  const handleDelete = async (pos: number) => {
    try {
      const json = await apiClient.deleteFirewallRule(vmid, pos, proxmoxConnectionId);
      if (json.success) {
        showToast('Firewall rule removed');
        fetchFirewall();
      } else {
        showToast(json.error || 'Could not delete rule');
      }
    } catch (e) {
      showToast('Network error deleting rule');
    }
  };

  const handlePresetChange = (val: string) => {
    setPreset(val);
    if (val === 'web') {
      setProto('tcp');
      setDport('80,443');
      setComment('Allow Web (HTTP/HTTPS)');
      setAction('ACCEPT');
    } else if (val === 'ssh') {
      setProto('tcp');
      setDport('22');
      setComment('Allow SSH');
      setAction('ACCEPT');
    } else {
      setDport('');
      setComment('');
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dport.trim()) {
      showToast('⚠️ Enter destination port(s), e.g. 22 or 80,443');
      return;
    }
    setIsSubmitting(true);
    try {
      const json = await apiClient.addFirewallRule(vmid, {
        action,
        type: 'in',
        proto,
        dport: dport.trim(),
        comment: comment.trim() || undefined,
      }, proxmoxConnectionId);
      if (json.success) {
        showToast('Firewall rule added');
        setPreset('custom');
        setDport('');
        setComment('');
        fetchFirewall();
      } else {
        showToast(json.error || 'Could not add rule');
      }
    } catch (e) {
      showToast('Network error adding rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#656b6b] text-sm flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin"></span>
        Loading firewall policies...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* GLOBAL TOGGLE HEADER */}
      <div className="flex items-center justify-between bg-[#fbfaf9] border border-[#dedfdf] p-4 rounded-xl">
        <div>
          <h3 className="font-bold text-[#1a1a1a]">Network Firewall</h3>
          <p className="text-xs text-[#656b6b] mt-0.5">
            {isEnabled ? 'Inbound traffic is filtered by your rules.' : 'Rules apply to incoming connections. Rules are stored in the panel and pushed to the cluster when a connection exists.'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors border cursor-pointer ${
            isEnabled
              ? 'bg-[#15803d] border-[#16a34a] text-white hover:bg-[#166534]'
              : 'bg-white border-[#dedfdf] text-[#1a1a1a] hover:bg-[#f1f1f1]'
          }`}
        >
          {isEnabled ? '✓ Firewall Enabled' : 'Enable Firewall'}
        </button>
      </div>

      {!isEnabled && (
        <div className="bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] p-4 rounded-xl text-xs flex items-center gap-2">
          <span className="font-bold text-sm">⚠ Warning:</span> Firewall is disabled. All ports are publicly exposed to the internet!
        </div>
      )}

      {/* ADD RULE FORM */}
      <div className="border border-[#dedfdf] bg-white rounded-xl relative p-6 shadow-sm z-50 mb-6">
        <Title className="text-sm font-semibold mb-4">Add Firewall Rule</Title>
        <form onSubmit={handleAddRule} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#656b6b] mb-1">Quick Preset</label>
            <select value={preset} onChange={(e) => handlePresetChange(e.target.value)} className="text-xs h-[36px] w-full border border-[#dedfdf] rounded-md px-3 outline-none focus:border-[#1a1a1a] bg-white">
              <option value="custom">Custom Rule</option>
              <option value="web">Web (80, 443)</option>
              <option value="ssh">SSH (22)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#656b6b] mb-1">Action & Proto</label>
            <div className="flex gap-2 w-full">
              <select value={action} onChange={(e) => setAction(e.target.value)} className="text-xs flex-1 h-[36px] w-full border border-[#dedfdf] rounded-md px-3 outline-none focus:border-[#1a1a1a] bg-white text-black font-semibold">
                <option value="ACCEPT">ACCEPT</option>
                <option value="DROP">DROP</option>
              </select>
              <select value={proto} onChange={(e) => setProto(e.target.value)} className="text-xs flex-1 h-[36px] w-full border border-[#dedfdf] rounded-md px-3 outline-none focus:border-[#1a1a1a] bg-white">
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#656b6b] mb-1">Ports</label>
            <TextInput
              value={dport}
              onChange={(e) => setDport(e.target.value)}
              placeholder="e.g. 22 or 80,443"
              className="text-xs h-[36px] w-full"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#656b6b] mb-1">Comment</label>
            <TextInput
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional description"
              className="text-xs h-[36px] w-full"
            />
          </div>
          <div className="md:col-span-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#1a1a1a] hover:bg-[#333333] border-none text-white font-bold h-[36px] text-xs"
            >
              {isSubmitting ? 'Saving...' : 'Add Rule'}
            </Button>
          </div>
        </form>
      </div>

      {/* ACTIVE RULES TABLE */}
      <div className="border border-[#dedfdf] bg-white rounded-xl overflow-hidden relative z-0 shadow-sm">
        <div className="p-4 border-b border-[#dedfdf]">
          <h2 className="text-sm font-semibold text-[#1a1a1a]">Active Inbound Rules</h2>
        </div>
        <div className="responsive-table-container">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#fbfaf9] border-b border-[#dedfdf] text-[#656b6b]">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Pos</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Action</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Protocol</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Dest Port</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Comment</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Delete</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#656b6b]">No rules configured. By default, everything is allowed.</td>
                </tr>
              ) : rules.map((r, i) => (
                <tr key={i} className="border-b border-[#f1f1f1] hover:bg-[#fbfaf9]">
                  <td className="px-4 py-3 font-mono text-[#656b6b]">{r.pos}</td>
                  <td className="px-4 py-3">
                    <Badge color={r.action === 'ACCEPT' ? 'emerald' : 'red'} className="text-[10px] font-bold tracking-widest uppercase">
                      {r.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono uppercase">{r.proto || 'ALL'}</td>
                  <td className="px-4 py-3 font-mono font-bold">{r.dport || 'ALL'}</td>
                  <td className="px-4 py-3 text-[#656b6b]">{r.comment || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(r.pos)}
                      className="text-[#991b1b] hover:text-[#dc2626] cursor-pointer"
                    >
                      ✕ Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
