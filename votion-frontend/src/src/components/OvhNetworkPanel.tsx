import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { getIpCarrierType } from '../utils/ipUtils';

interface OvhStatus {
  ip: string;
  reverse: string | null;
  ddos: { state: string; mode: 'automatic' | 'permanent' };
  firewall: { enabled: boolean; state: string };
  antiHack?: { blockedSince: string; logs: string; state: string; timeToUnblock: number } | null;
}

interface FirewallRule {
  sequence: number;
  action: 'permit' | 'deny';
  protocol: 'tcp' | 'udp' | 'icmp' | 'ipv4';
  sourcePort?: string;
  destinationPort?: string;
  source?: string;
}

interface GameRule {
  id: number;
  toPort: number;
  protocol: 'tcp' | 'udp';
  gameType: string;
  state: string;
}

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

export const OvhNetworkPanel: React.FC<{ vmid: number; ipAddress?: string }> = ({ vmid, ipAddress }) => {
  const isAdmin = ['admin', 'administrator', 'moderator'].includes(apiClient.getUserRole());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OvhStatus | null>(null);
  
  // rDNS state
  const [rdnsValue, setRdnsValue] = useState('');
  const [rdnsUpdating, setRdnsUpdating] = useState(false);
  
  // DDoS state
  const [ddosUpdating, setDdosUpdating] = useState(false);

  // Firewall state
  const [fwToggling, setFwToggling] = useState(false);
  const [fwRules, setFwRules] = useState<FirewallRule[]>([]);
  const [loadingFwRules, setLoadingFwRules] = useState(false);
  
  // Add FW rule form state
  const [newSeq, setNewSeq] = useState<number>(0);
  const [newAction, setNewAction] = useState<'permit' | 'deny'>('permit');
  const [newProto, setNewProto] = useState<'tcp' | 'udp' | 'icmp' | 'ipv4'>('tcp');
  const [newSrc, setNewSrc] = useState('');
  const [newSrcPort, setNewSrcPort] = useState('');
  const [newDstPort, setNewDstPort] = useState('');
  const [fwRuleSaving, setFwRuleSaving] = useState(false);

  // Game DDoS state
  const [gameRules, setGameRules] = useState<GameRule[]>([]);
  const [loadingGameRules, setLoadingGameRules] = useState(false);
  
  // Add Game rule form state
  const [newGamePort, setNewGamePort] = useState<number>(25565);
  const [newGameProto, setNewGameProto] = useState<'tcp' | 'udp'>('udp');
  const [newGameProfile, setNewGameProfile] = useState('minecraft');
  const [gameRuleSaving, setGameRuleSaving] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'firewall' | 'game'>('general');

  const loadOvhData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getOvhStatus(vmid);
      setStatus(data);
      if (data) {
        setRdnsValue(data.reverse || '');
      }
    } catch (err: any) {
      setError(err.message || 'OVH API details could not be retrieved. Ensure integration keys are valid and VM has a public IP address.');
    } finally {
      setLoading(false);
    }
  };

  const loadFirewallRules = async () => {
    setLoadingFwRules(true);
    try {
      const rules = await apiClient.getOvhFirewallRules(vmid);
      setFwRules(rules || []);
    } catch (err: any) {
      console.error('Failed to load firewall rules:', err);
    } finally {
      setLoadingFwRules(false);
    }
  };

  const loadGameRules = async () => {
    setLoadingGameRules(true);
    try {
      const rules = await apiClient.getOvhGameRules(vmid);
      setGameRules(rules || []);
    } catch (err: any) {
      console.error('Failed to load game DDoS rules:', err);
    } finally {
      setLoadingGameRules(false);
    }
  };

  useEffect(() => {
    if (ipAddress) {
      loadOvhData();
    }
  }, [vmid, ipAddress]);

  useEffect(() => {
    if (activeSubTab === 'firewall' && status?.firewall?.enabled) {
      loadFirewallRules();
    } else if (activeSubTab === 'game') {
      loadGameRules();
    }
  }, [activeSubTab, status?.firewall?.enabled]);

  const handleUpdateRdns = async (e: React.FormEvent) => {
    e.preventDefault();
    setRdnsUpdating(true);
    try {
      const res = await apiClient.setOvhRdns(vmid, rdnsValue);
      if (res.success) {
        await loadOvhData();
      } else {
        alert(res.error || 'Failed to update Reverse DNS');
      }
    } catch (err: any) {
      alert(err.message || 'Network error updating Reverse DNS');
    } finally {
      setRdnsUpdating(false);
    }
  };

  const handleToggleDdos = async () => {
    if (!status) return;
    const targetMode = status.ddos.mode === 'automatic' ? 'permanent' : 'automatic';
    setDdosUpdating(true);
    try {
      const res = await apiClient.setOvhDdos(vmid, targetMode);
      if (res.success) {
        await loadOvhData();
      } else {
        alert(res.error || 'Failed to update DDoS mitigation mode');
      }
    } catch (err: any) {
      alert(err.message || 'Network error updating DDoS mode');
    } finally {
      setDdosUpdating(false);
    }
  };

  const handleToggleFirewall = async () => {
    if (!status) return;
    const nextState = !status.firewall.enabled;
    setFwToggling(true);
    try {
      const res = await apiClient.toggleOvhFirewall(vmid, nextState);
      if (res.success) {
        // Allow OVH API a moment to process the action
        setTimeout(async () => {
          await loadOvhData();
        }, 1500);
      } else {
        alert(res.error || 'Failed to toggle Firewall');
      }
    } catch (err: any) {
      alert(err.message || 'Network error toggling Firewall');
    } finally {
      setFwToggling(false);
    }
  };

  const handleAddFwRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFwRuleSaving(true);
    try {
      const res = await apiClient.addOvhFirewallRule(vmid, {
        sequence: Number(newSeq),
        action: newAction,
        protocol: newProto,
        sourcePort: newSrcPort || undefined,
        destinationPort: newDstPort || undefined,
        source: newSrc || undefined
      });
      if (res.success) {
        setNewSeq(prev => Math.min(99, prev + 1));
        setNewSrc('');
        setNewSrcPort('');
        setNewDstPort('');
        await loadFirewallRules();
      } else {
        alert(res.error || 'Failed to create firewall rule');
      }
    } catch (err: any) {
      alert(err.message || 'Network error creating rule');
    } finally {
      setFwRuleSaving(false);
    }
  };

  const handleDeleteFwRule = async (sequence: number) => {
    if (!confirm(`Are you sure you want to delete Edge Firewall rule at sequence ${sequence}?`)) return;
    try {
      const res = await apiClient.deleteOvhFirewallRule(vmid, sequence);
      if (res.success) {
        await loadFirewallRules();
      } else {
        alert(res.error || 'Failed to delete rule');
      }
    } catch (err: any) {
      alert(err.message || 'Network error deleting rule');
    }
  };

  const handleAddGameRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setGameRuleSaving(true);
    try {
      const res = await apiClient.addOvhGameRule(vmid, {
        port: Number(newGamePort),
        protocol: newGameProto,
        game: newGameProfile
      });
      if (res.success) {
        setNewGamePort(25565);
        await loadGameRules();
      } else {
        alert(res.error || 'Failed to create game DDoS rule');
      }
    } catch (err: any) {
      alert(err.message || 'Network error creating game rule');
    } finally {
      setGameRuleSaving(false);
    }
  };

  const handleDeleteGameRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this Game DDoS port rule?')) return;
    try {
      const res = await apiClient.deleteOvhGameRule(vmid, ruleId);
      if (res.success) {
        await loadGameRules();
      } else {
        alert(res.error || 'Failed to delete game rule');
      }
    } catch (err: any) {
      alert(err.message || 'Network error deleting game rule');
    }
  };

  if (!ipAddress) {
    return (
      <div className="p-5 text-center text-xs text-[var(--theme-text-muted)] bg-[var(--theme-surface-muted)] border border-[var(--theme-border)] rounded-xl font-medium">
        ℹ️ OVH network controls are only available for virtual machines with a public IP address allocated.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-[var(--theme-text-muted)] font-medium bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl shadow-sm">
        Querying Router network settings...
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="p-6 text-xs text-[var(--theme-danger)] bg-[color-mix(in_srgb,var(--theme-danger)_10%,transparent)] border border-[var(--theme-border)] rounded-xl flex flex-col gap-3">
        <p className="font-semibold">⚠️ OVH cloud services integration failed:</p>
        <p>{error || 'An unexpected error occurred retrieving your IP settings.'}</p>
        <button onClick={loadOvhData} className="btn-secondary self-start py-1.5 px-3 border-[var(--theme-border)] text-[var(--theme-danger)] hover:bg-[#fff0ef]">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl shadow-sm overflow-hidden flex flex-col font-sans">
      {/* OVH Sub Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-4">
        {[
          { key: 'general', label: 'General & rDNS' },
          { key: 'firewall', label: 'OVH Edge Firewall' },
          { key: 'game', label: 'Game DDoS Controls' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key as any)}
            className={`px-4 py-3 text-xs font-bold transition-colors border-b-2 -mb-px cursor-pointer ${
              activeSubTab === t.key
                ? 'border-[var(--theme-border)] text-[#2563eb]'
                : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 text-xs flex flex-col gap-5">
        {!isAdmin && (
          <div className="bg-[#f0f9ff] border border-[var(--theme-border)] rounded-lg p-3 text-[11px] text-[#0369a1] font-medium">
            ℹ️ You are viewing OVH Cloud Router Network Settings in <strong>Read-Only Mode</strong>. Only administrators can change reverse DNS, firewall rules, or DDoS settings.
          </div>
        )}
        
        {/* ================= GENERAL TAB ================= */}
        {activeSubTab === 'general' && (
          <div className="flex flex-col gap-6">
            {/* IP info banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[var(--theme-surface-muted)] border border-[var(--theme-border)] rounded-lg">
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] tracking-wider">IPv4 Address</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-sm font-mono font-bold text-[var(--theme-text)]">{status.ip}</p>
                  {(() => {
                    const carrier = getIpCarrierType(status.ip, [], []);
                    return (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${carrier.badgeClass}`}>
                        {carrier.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] tracking-wider">DDoS Mitigation Status</p>
                <p className="mt-0.5"><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#dcfce7] text-[#15803d]">✓ Active (Auto)</span></p>
              </div>
            </div>

            {/* Reverse DNS Section */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-bold text-[var(--theme-text)]">Configure Reverse DNS (PTR Record)</h4>
              <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                Reverse DNS resolves your IP address back to a hostname. This is critical for email delivery, mail server verification, and network monitoring.
              </p>
              {isAdmin ? (
                <form onSubmit={handleUpdateRdns} className="flex gap-2 items-center mt-1">
                  <input
                    type="text"
                    placeholder="e.g. mail.yourdomain.com"
                    value={rdnsValue}
                    onChange={e => setRdnsValue(e.target.value)}
                    className="flex-1 max-w-[320px] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--theme-border)] font-mono"
                  />
                  <button
                    type="submit"
                    disabled={rdnsUpdating}
                    className="btn-primary py-2 px-4 whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    {rdnsUpdating ? 'Updating...' : 'Update rDNS'}
                  </button>
                </form>
              ) : (
                <div className="bg-[var(--theme-surface-muted)] border border-[var(--theme-border)] rounded-lg p-3 font-mono text-[var(--theme-text)] max-w-[320px] font-semibold mt-1">
                  {rdnsValue || 'No PTR / Reverse DNS record configured'}
                </div>
              )}
            </div>

            {/* Anti-DDoS Mitigation Mode */}
            <hr className="border-[var(--theme-border)]" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-xs font-bold text-[var(--theme-text)]">Permanent DDoS Mitigation</h4>
                <p className="text-[11px] text-[var(--theme-text-muted)] mt-1 leading-relaxed">
                  By default, mitigation triggers automatically when an attack is detected. Enabling permanent mitigation keeps the OVH scrubbing center active for your IP at all times, removing trigger latency.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleDdos}
                disabled={ddosUpdating || !isAdmin}
                title={!isAdmin ? "Administrator permissions required" : ""}
                className={`py-2 px-5 font-bold rounded-lg text-xs border transition-all whitespace-nowrap self-start sm:self-auto ${
                  !isAdmin 
                    ? 'bg-[var(--theme-surface-muted)] border-[var(--theme-border)] text-[var(--theme-text-muted)] cursor-not-allowed'
                    : status.ddos.mode === 'permanent'
                      ? 'bg-[#fef2f2] border-[var(--theme-border)] text-[#dc2626] hover:bg-[#fee2e2] cursor-pointer'
                      : 'bg-[var(--theme-bg)] border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] cursor-pointer'
                }`}
              >
                {ddosUpdating ? 'Toggling...' : status.ddos.mode === 'permanent' ? 'Disable Permanent' : 'Enable Permanent'}
              </button>
            </div>
          </div>
        )}

        {/* ================= EDGE FIREWALL TAB ================= */}
        {activeSubTab === 'firewall' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--theme-border)]">
              <div>
                <h4 className="text-xs font-bold text-[var(--theme-text)]">OVH Edge Firewall Control</h4>
                <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5 leading-relaxed">
                  Configure filtering rules directly on OVH's hardware router routers. This blocks unwanted traffic before it reaches your hypervisor switch port.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleFirewall}
                disabled={fwToggling || !isAdmin}
                title={!isAdmin ? "Administrator permissions required" : ""}
                className={`px-5 py-2 rounded-lg text-xs font-bold border transition-all whitespace-nowrap self-start sm:self-auto ${
                  !isAdmin
                    ? 'bg-[var(--theme-surface-muted)] border-[var(--theme-border)] text-[var(--theme-text-muted)] cursor-not-allowed'
                    : status.firewall.enabled
                      ? 'bg-[#fef2f2] border-[var(--theme-border)] text-[#dc2626] hover:bg-[#fee2e2] cursor-pointer'
                      : 'bg-[var(--theme-bg)] border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] cursor-pointer'
                }`}
              >
                {fwToggling ? 'Toggling...' : status.firewall.enabled ? 'Disable Firewall' : 'Enable Firewall'}
              </button>
            </div>

            {!status.firewall.enabled ? (
              <div className="p-8 text-center bg-[var(--theme-surface-muted)] border border-[var(--theme-border)] rounded-xl text-[var(--theme-text-muted)]">
                <p className="font-semibold text-xs text-[var(--theme-text)] mb-1">OVH Edge Firewall is currently OFF</p>
                <p className="text-[11px]">Enable the firewall above to begin adding hardware rules.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                
                {/* Rules List Table */}
                <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-[var(--theme-surface-muted)] border-b border-[var(--theme-border)]">
                    <h5 className="font-bold text-[var(--theme-text)]">Edge Firewall Rules</h5>
                  </div>
                  {loadingFwRules ? (
                    <div className="p-6 text-center text-[var(--theme-text-muted)]">Loading rules...</div>
                  ) : fwRules.length === 0 ? (
                    <div className="p-6 text-center text-[var(--theme-text-muted)]">No custom firewall rules configured.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[var(--theme-surface-muted)] border-b border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Seq</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Action</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Protocol</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Source IP</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Ports (Src / Dst)</th>
                            {isAdmin && <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)] text-right">Options</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dedfdf]">
                          {fwRules.map(rule => (
                            <tr key={rule.sequence} className="hover:bg-[var(--theme-surface-muted)] font-mono">
                              <td className="px-4 py-2.5 font-bold text-[var(--theme-text)]">{rule.sequence}</td>
                              <td className="px-4 py-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${rule.action === 'permit' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef2f2] text-[#dc2626]'}`}>
                                  {rule.action.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 uppercase font-bold text-gray-700">{rule.protocol}</td>
                              <td className="px-4 py-2.5">{rule.source || 'Any IP'}</td>
                              <td className="px-4 py-2.5">
                                {rule.protocol === 'tcp' || rule.protocol === 'udp' 
                                  ? `${rule.sourcePort || 'any'} ➔ ${rule.destinationPort || 'any'}` 
                                  : '—'}
                              </td>
                              {isAdmin && (
                                <td className="px-4 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFwRule(rule.sequence)}
                                    className="text-[#dc2626] font-semibold hover:underline cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Add Rule Form */}
                {isAdmin && (
                <form onSubmit={handleAddFwRule} className="bg-[var(--theme-surface-muted)] border border-[var(--theme-border)] rounded-xl p-5 flex flex-col gap-4">
                  <h5 className="font-bold text-[var(--theme-text)]">Add Edge Firewall Rule</h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-semibold mb-1">Sequence (0-99)</label>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={newSeq}
                        onChange={e => setNewSeq(Number(e.target.value))}
                        className="w-full border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none bg-[var(--theme-bg)] font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Action</label>
                      <select
                        value={newAction}
                        onChange={e => setNewAction(e.target.value as any)}
                        className="w-full border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none bg-[var(--theme-bg)] cursor-pointer"
                      >
                        <option value="permit">PERMIT (Accept)</option>
                        <option value="deny">DENY (Drop)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Protocol</label>
                      <select
                        value={newProto}
                        onChange={e => setNewProto(e.target.value as any)}
                        className="w-full border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none bg-[var(--theme-bg)] cursor-pointer"
                      >
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                        <option value="icmp">ICMP</option>
                        <option value="ipv4">Any IPv4</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Source IP (CIDR)</label>
                      <input
                        type="text"
                        placeholder="e.g. 192.0.2.0/24"
                        value={newSrc}
                        onChange={e => setNewSrc(e.target.value)}
                        className="w-full border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none font-mono bg-[var(--theme-bg)]"
                      />
                    </div>
                  </div>

                  {(newProto === 'tcp' || newProto === 'udp') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold mb-1">Source Port (or range)</label>
                        <input
                          type="text"
                          placeholder="any or e.g. 80"
                          value={newSrcPort}
                          onChange={e => setNewSrcPort(e.target.value)}
                          className="w-full border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none font-mono bg-[var(--theme-bg)]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Destination Port (or range)</label>
                        <input
                          type="text"
                          placeholder="any or e.g. 25565"
                          value={newDstPort}
                          onChange={e => setNewDstPort(e.target.value)}
                          className="w-full border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none font-mono bg-[var(--theme-bg)]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-[var(--theme-border)]">
                    <button
                      type="submit"
                      disabled={fwRuleSaving}
                      className="btn-primary py-2 px-5 cursor-pointer disabled:opacity-50"
                    >
                      {fwRuleSaving ? 'Creating...' : 'Create Rule'}
                    </button>
                  </div>
                </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= GAME DDOS TAB ================= */}
        {activeSubTab === 'game' && (
          <div className="flex flex-col gap-6">
            <div>
              <h4 className="text-xs font-bold text-[var(--theme-text)]">OVH Game Anti-DDoS Port Protection</h4>
              <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5 leading-relaxed">
                If your VM hosts games, configure game-specific packet filtering profiles. This applies expert mitigations tailored to specific protocols (Minecraft Query/Ping, Valve Source Engine query filters, Teamspeak, GTA 5, and Rust).
              </p>
            </div>

            {/* Game Rules List Table */}
            <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-[var(--theme-surface-muted)] border-b border-[var(--theme-border)]">
                <h5 className="font-bold text-[var(--theme-text)]">Active Game DDoS Port Tunnels</h5>
              </div>
              {loadingGameRules ? (
                <div className="p-6 text-center text-[var(--theme-text-muted)]">Loading game rules...</div>
              ) : gameRules.length === 0 ? (
                <div className="p-6 text-center text-[var(--theme-text-muted)]">No game specific port filters enabled.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--theme-surface-muted)] border-b border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Rule ID</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Port</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Protocol</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Game Profile</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Mitigation Status</th>
                        {isAdmin && <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)] text-right">Options</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dedfdf] font-mono">
                      {gameRules.map(rule => (
                        <tr key={rule.id} className="hover:bg-[var(--theme-surface-muted)]">
                          <td className="px-4 py-2.5 text-[var(--theme-text-muted)]">#{rule.id}</td>
                          <td className="px-4 py-2.5 font-bold text-[var(--theme-text)]">{rule.toPort}</td>
                          <td className="px-4 py-2.5 uppercase font-bold">{rule.protocol}</td>
                          <td className="px-4 py-2.5 uppercase text-gray-700 font-semibold">{formatGameProfile(rule.gameType)}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#dcfce7] text-[#15803d]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse"></span>
                              Mitigated
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteGameRule(rule.id)}
                                className="text-[#dc2626] font-semibold hover:underline cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add Game Rule Form */}
            {isAdmin && (
            <form onSubmit={handleAddGameRule} className="bg-[var(--theme-surface-muted)] border border-[var(--theme-border)] rounded-xl p-5 flex flex-col gap-4">
              <h5 className="font-bold text-[var(--theme-text)]">Enable Game DDoS Port Protection</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Game Port</label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={newGamePort}
                    onChange={e => setNewGamePort(Number(e.target.value))}
                    className="w-full border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none bg-[var(--theme-bg)] font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Protocol</label>
                  <select
                    value={newGameProto}
                    onChange={e => setNewGameProto(e.target.value as any)}
                    className="w-full border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none bg-[var(--theme-bg)] cursor-pointer"
                  >
                    <option value="udp">UDP (Recommended for Games)</option>
                    <option value="tcp">TCP</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Game Profile Type</label>
                  <select
                    value={newGameProfile}
                    onChange={e => {
                      const prof = e.target.value;
                      setNewGameProfile(prof);
                      if (prof === 'samp' || prof === 'ark') setNewGamePort(7777);
                      else if (prof === 'mta') setNewGamePort(22003);
                      else if (prof === 'minecraft') setNewGamePort(25565);
                      else if (prof === 'minecraftpocketedition') setNewGamePort(19132);
                      else if (prof === 'rust') setNewGamePort(28015);
                      else if (prof === 'valve') setNewGamePort(27015);
                      else if (prof === 'teamspeak') setNewGamePort(9987);
                      else if (prof === 'arma') setNewGamePort(2302);
                      else if (prof === 'gta5') setNewGamePort(30120);
                    }}
                    className="w-full border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none bg-[var(--theme-bg)] cursor-pointer"
                  >
                    <option value="samp">GTA: SA-MP (San Andreas Multiplayer - 7777)</option>
                    <option value="mta">MTA: SA (Multi Theft Auto - 22003)</option>
                    <option value="minecraft">Minecraft Java Edition (25565)</option>
                    <option value="minecraftpocketedition">Minecraft Bedrock / PE (19132)</option>
                    <option value="rust">Rust Dedicated (28015)</option>
                    <option value="gta5">GTA V / FiveM (30120)</option>
                    <option value="valve">Source Engine (CS2, TF2, GMod - 27015)</option>
                    <option value="teamspeak">TeamSpeak 3 Voice (9987)</option>
                    <option value="ark">ARK Survival Evolved (7777)</option>
                    <option value="arma">Arma 2 / 3 (2302)</option>
                    <option value="other">Other / Standard UDP Query</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[var(--theme-border)]">
                <button
                  type="submit"
                  disabled={gameRuleSaving}
                  className="btn-primary py-2 px-5 cursor-pointer disabled:opacity-50"
                >
                  {gameRuleSaving ? 'Enabling...' : 'Enable Port Protection'}
                </button>
              </div>
            </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
