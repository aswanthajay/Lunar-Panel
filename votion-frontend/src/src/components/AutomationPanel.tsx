import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

interface AutomationPanelProps {
  vmid: number;
  showToast: (message: string) => void;
  isAdmin?: boolean;
}

type SubTab = 'rescue' | 'bandwidth' | 'rdns' | 'apps' | 'apikeys' | 'team';

export const AutomationPanel: React.FC<AutomationPanelProps> = ({ vmid, showToast, isAdmin }) => {
  const [subTab, setSubTab] = useState<SubTab>('rescue');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex border-b border-[#dedfdf] text-xs gap-5 font-semibold -mb-2">
        <button onClick={() => setSubTab('rescue')} className={`pb-2 cursor-pointer ${subTab === 'rescue' ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a]' : 'text-[#656b6b]'}`}>Rescue Mode</button>
        <button onClick={() => setSubTab('bandwidth')} className={`pb-2 cursor-pointer ${subTab === 'bandwidth' ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a]' : 'text-[#656b6b]'}`}>Bandwidth & Quota</button>
        <button onClick={() => setSubTab('rdns')} className={`pb-2 cursor-pointer ${subTab === 'rdns' ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a]' : 'text-[#656b6b]'}`}>rDNS / PTR</button>
        <button onClick={() => setSubTab('apps')} className={`pb-2 cursor-pointer ${subTab === 'apps' ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a]' : 'text-[#656b6b]'}`}>App Marketplace</button>
        <button onClick={() => setSubTab('apikeys')} className={`pb-2 cursor-pointer ${subTab === 'apikeys' ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a]' : 'text-[#656b6b]'}`}>API Keys</button>
        <button onClick={() => setSubTab('team')} className={`pb-2 cursor-pointer ${subTab === 'team' ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a]' : 'text-[#656b6b]'}`}>Team Access</button>
      </div>

      <div className="pt-2">
        {subTab === 'rescue' && <RescueSection vmid={vmid} showToast={showToast} />}
        {subTab === 'bandwidth' && <BandwidthSection vmid={vmid} showToast={showToast} isAdmin={isAdmin} />}
        {subTab === 'rdns' && <RdnsSection vmid={vmid} showToast={showToast} />}
        {subTab === 'apps' && <AppsSection vmid={vmid} showToast={showToast} />}
        {subTab === 'apikeys' && <ApiKeysSection showToast={showToast} />}
        {subTab === 'team' && <TeamSection vmid={vmid} showToast={showToast} />}
      </div>
    </div>
  );
};

const cardCls = "border border-[#dedfdf] rounded-lg p-4 bg-[#fbfaf9]";

// ---------------- Rescue Mode ----------------
const RescueSection: React.FC<{ vmid: number; showToast: (m: string) => void }> = ({ vmid, showToast }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [ready, setReady] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    apiClient.checkRescue(vmid)
      .then(r => setReady(r))
      .catch(() => setReady(null))
      .finally(() => setChecking(false));
  }, [vmid]);

  const runAction = async (action: 'enter' | 'exit') => {
    setLoading(action);
    try {
      const res = action === 'enter' ? await apiClient.enterRescueMode(vmid) : await apiClient.exitRescueMode(vmid);
      if (res.success) {
        showToast(res.message || (action === 'enter' ? 'Rescue mode activated.' : 'Rescue mode deactivated.'));
        setReady(null); setChecking(true);
        apiClient.checkRescue(vmid).then(r => setReady(r)).finally(() => setChecking(false));
      } else {
        showToast(res.error || `Rescue ${action} failed.`);
      }
    } catch (err: any) {
      showToast(err.message || `Rescue ${action} blocked.`);
    } finally {
      setLoading(null);
    }
  };

  const blocked = !checking && ready && !ready.available;
  const disabled = loading !== null || blocked;

  return (
    <div className="flex flex-col gap-3 max-w-[560px]">
      <p className="text-xs text-[#656b6b]">
        Rescue mode reboots this instance from a live recovery ISO so you can repair the filesystem, reset lost credentials, or troubleshoot boot issues through the VNC console. Your data is untouched.
      </p>
      {blocked && (
        <div className="p-3 bg-[#fffbeb] border border-[#fde68a] rounded text-xs text-[#92400e]">
          <div className="font-bold mb-1">Rescue mode unavailable</div>
          <div className="text-[#a16207]">{ready?.message || 'No rescue ISO found on any cluster storage.'}</div>
        </div>
      )}
      {!checking && ready?.available && (
        <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded text-xs text-[#166534]">
          <div className="font-bold mb-1">Ready — {ready?.isoCount} ISO image(s) available</div>
          <code className="font-mono break-all text-[11px]">{(ready.isos || []).join(', ')}</code>
        </div>
      )}
      <div className={cardCls}>
        <div className="text-[13px] font-bold text-[#1a1a1a] mb-1.5">Recovery ISO</div>
        <div className="text-xs text-[#656b6b] mb-3">
          {checking
            ? 'Checking storage for a bootable recovery image...'
            : blocked
              ? 'A bootable recovery image must be uploaded to the cluster storage before rescue mode can be used.'
              : 'Recovery environment with disk tools, chroot support, and network utilities preinstalled.'}
        </div>
        <div className="flex gap-2">
          <button onClick={() => runAction('enter')} disabled={disabled} title={blocked ? 'Upload a rescue ISO to cluster storage first' : ''} className="btn-primary py-1.5 px-3 text-xs cursor-pointer disabled:opacity-50">
            {loading === 'enter' ? 'Activating...' : 'Enter Rescue Mode'}
          </button>
          <button onClick={() => runAction('exit')} disabled={disabled} className="border border-[#dedfdf] rounded py-1.5 px-3 text-xs cursor-pointer disabled:opacity-50 hover:bg-white">
            {loading === 'exit' ? 'Exiting...' : 'Exit Rescue Mode'}
          </button>
        </div>
      </div>
      <div className="text-[11px] text-[#656b6b]">
        After entering rescue mode, wait ~1 minute then open the <span className="font-semibold">VNC Web Terminal</span> tab to work inside the recovery shell. Exiting restores normal boot from your disk.
      </div>
    </div>
  );
};

// ---------------- Bandwidth & Quota ----------------
const BandwidthSection: React.FC<{ vmid: number; showToast: (m: string) => void; isAdmin?: boolean }> = ({ vmid, showToast, isAdmin }) => {
  const [bw, setBw] = useState<any>(null);
  const [quota, setQuota] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [newQuota, setNewQuota] = useState('');

  const load = async () => {
    try {
      const [bwRes, qRes] = await Promise.all([apiClient.getBandwidth(vmid), apiClient.getQuota(vmid)]);
      setBw(bwRes.data || bwRes);
      setQuota(qRes.data || qRes);
    } catch { /* silently keep prior data */ }
  };

  useEffect(() => { load(); }, [vmid]);

  const applyQuota = async () => {
    const gb = Number(newQuota);
    if (!gb || gb < 1) { showToast('Quota must be at least 1 GB.'); return; }
    try {
      const res = await apiClient.setQuota(vmid, gb);
      if (res.success) {
        showToast(`Bandwidth quota set to ${gb} GB/month.`);
        setEditing(false);
        load();
      } else showToast(res.error || 'Failed to update quota.');
    } catch (err: any) { showToast(err.message || 'Quota update failed.'); }
  };

  const used = Number(bw?.bandwidthUsedGb ?? 0);
  const limit = Number(bw?.bandwidthQuotaGb ?? quota?.bandwidthQuotaGb ?? 0);
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';

  return (
    <div className="flex flex-col gap-3 max-w-[560px]">
      <p className="text-xs text-[#656b6b]">Live bandwidth consumption for the current billing month. When usage crosses 80% and 100% of the quota, alerts are generated automatically.</p>
      <div className={cardCls}>
        <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest mb-2">
          <span className="text-[#888]">Monthly bandwidth</span>
          <span className="text-[#1a1a1a] font-mono">{used.toFixed(1)} / {limit ? limit.toFixed(0) : '—'} GB</span>
        </div>
        <div className="h-[6px] w-full bg-[#f0f0f0] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }}></div>
        </div>
        <div className="text-[11px] text-[#656b6b] mt-2">{pct.toFixed(1)}% consumed this month</div>
      </div>
      {isAdmin && (
        <div className={cardCls}>
          <div className="text-[13px] font-bold text-[#1a1a1a] mb-2">Monthly quota (admin)</div>
          {editing ? (
            <div className="flex gap-2 items-center">
              <input type="number" min={1} value={newQuota} onChange={e => setNewQuota(e.target.value)} placeholder="GB / month" className="w-36 p-1.5 border border-[#dedfdf] rounded text-xs outline-none" />
              <button onClick={applyQuota} className="btn-primary py-1.5 px-3 text-xs cursor-pointer">Save</button>
              <button onClick={() => setEditing(false)} className="border border-[#dedfdf] rounded py-1.5 px-3 text-xs cursor-pointer hover:bg-white">Cancel</button>
            </div>
          ) : (
            <button onClick={() => { setNewQuota(String(quota?.bandwidthQuotaGb ?? limit ?? '')); setEditing(true); }} className="border border-[#dedfdf] rounded py-1.5 px-3 text-xs cursor-pointer hover:bg-white">
              {quota?.bandwidthQuotaGb ? `Change quota (currently ${quota.bandwidthQuotaGb} GB)` : 'Set bandwidth quota'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------- rDNS / PTR ----------------
const statusBadge = (status: string) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('completed')) return { bg: 'bg-[#f0fdf4] text-[#166534]', label: 'Active' };
  if (s.includes('failed')) return { bg: 'bg-[#fef2f2] text-[#991b1b]', label: 'Failed' };
  if (s.includes('skipped')) return { bg: 'bg-[#f3f4f6] text-[#6b7280]', label: 'Skipped' };
  return { bg: 'bg-[#fffbeb] text-[#92400e]', label: 'Pending' };
};

const RdnsSection: React.FC<{ vmid: number; showToast: (m: string) => void }> = ({ vmid, showToast }) => {
  const [ip, setIp] = useState('');
  const [ptr, setPtr] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = async () => {
    try {
      const res = await apiClient.getRdnsRequests(vmid);
      setHistory((res.data || []).reverse());
    } catch { /* empty */ }
  };

  useEffect(() => { loadHistory(); }, [vmid]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.requestRdns(vmid, ip.trim(), ptr.trim());
      if (res.success) {
        showToast(res.message || `rDNS record submitted and queued for activation.`);
        setIp(''); setPtr('');
        loadHistory();
      } else showToast(res.error || 'rDNS request failed.');
    } catch (err: any) { showToast(err.message || 'rDNS request blocked.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-3 max-w-[640px]">
      <p className="text-xs text-[#656b6b]">Set the reverse DNS (PTR) record for this instance's IP. Records are queued and activated automatically by the panel within a minute.</p>
      <div className="p-3 bg-[#eff6ff] border border-[#bfdbfe] rounded text-xs text-[#1e40af]">
        rDNS activation requires a DNS provider (e.g. Cloudflare) to be configured by your administrator in <span className="font-semibold">System Settings → rDNS Provider</span>. Until then, submitted requests stay in <span className="font-semibold">Pending</span> status.
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">IP Address</label>
            <input type="text" required value={ip} onChange={e => setIp(e.target.value)} placeholder="103.x.x.x" className="w-full p-2 border border-[#dedfdf] rounded text-xs outline-none font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Hostname (PTR)</label>
            <input type="text" required value={ptr} onChange={e => setPtr(e.target.value)} placeholder="mail.example.com" className="w-full p-2 border border-[#dedfdf] rounded text-xs outline-none font-mono" />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary py-2 px-4 text-xs cursor-pointer self-start disabled:opacity-50">{loading ? 'Submitting...' : 'Set rDNS Record'}</button>
      </form>
      <div className={cardCls}>
        <div className="text-[13px] font-bold text-[#1a1a1a] mb-2">Request history</div>
        {history.length === 0 ? (
          <div className="text-xs text-[#656b6b]">No rDNS requests for this instance yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {history.map((h: any) => {
              const b = statusBadge(h.status);
              return (
                <div key={h.id} className="flex items-center justify-between gap-2 border border-[#dedfdf] rounded px-3 py-2 text-xs">
                  <div className="flex flex-col">
                    <span className="font-mono">{h.ip || h.ip_address}</span>
                    <span className="font-mono text-[#888] text-[11px]">→ {h.ptr || h.hostname}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${b.bg}`}>{b.label}</span>
                    <span className="text-[10px] text-[#888]">{h.requested_at ? new Date(h.requested_at).toLocaleString() : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------- App Marketplace ----------------
const AppsSection: React.FC<{ vmid: number; showToast: (m: string) => void }> = ({ vmid, showToast }) => {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await apiClient.getAppCatalogWithTemplates(vmid);
      const data = res.data || {};
      setCatalog(data.catalog || []);
      setInstances(data.instances || []);
    } catch { /* empty state below */ }
  };

  useEffect(() => { load(); }, []);

  const deploy = async (appId: string) => {
    setLoading(appId);
    try {
      const res = await apiClient.deployApp(appId, vmid);
      if (res.success) {
        showToast(res.message || `App deployed on Instance ${vmid}.`);
        load();
      } else showToast(res.error || 'Deployment failed.');
    } catch (err: any) { showToast(err.message || 'Deployment blocked.'); }
    finally { setLoading(null); }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[#656b6b]">Deploy companion workloads with one click. Each app is cloned from a verified template and attached to Instance {vmid}. Deployment takes a few seconds.</p>
      {catalog.length === 0 ? (
        <div className={cardCls + " text-xs text-[#656b6b]"}>No catalog entries configured yet. Add apps to the app catalog in Settings to enable one-click deployment.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {catalog.map((app: any) => {
            const unavailable = app.templateAvailable === false;
            return (
              <div key={app.id} className={cardCls}>
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-bold text-[#1a1a1a]">{app.name}</div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${app.popular ? 'bg-[#eff6ff] text-[#2563eb]' : 'bg-[#f3f4f6] text-[#656b6b]'}`}>{app.category || 'App'}</span>
                </div>
                <div className="text-[11px] text-[#656b6b] mt-1">{app.description || 'Verified template for instant deployment.'}</div>
                {unavailable ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#f3f4f6] text-[#6b7280]">Coming Soon</span>
                    <span className="text-[10px] text-[#6b7280]">Template not yet provisioned on this cluster.</span>
                  </div>
                ) : (
                  <button onClick={() => deploy(app.id)} disabled={loading === app.id} className="mt-2 border border-[#1a1a1a] rounded py-1.5 px-3 text-xs font-semibold cursor-pointer hover:bg-[#1a1a1a] hover:text-white transition-colors disabled:opacity-50">
                    {loading === app.id ? 'Deploying...' : 'Deploy'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {instances.length > 0 && (
        <div className="text-[11px] text-[#656b6b]">Deployed: {instances.map((i: any) => i.name || i.app_id).join(', ')}</div>
      )}
    </div>
  );
};

// ---------------- API Keys ----------------
const ApiKeysSection: React.FC<{ showToast: (m: string) => void }> = ({ showToast }) => {
  const [keys, setKeys] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'power' | 'full'>('read');
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await apiClient.getUserApiKeys();
      setKeys(res.data || []);
    } catch { /* empty */ }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) { showToast('Give the key a name first.'); return; }
    try {
      const res = await apiClient.createApiKey(name.trim(), scope);
      if (res.success) {
        showToast(res.message);
        setNewKey(res.data?.key || null);
        load();
        setName('');
      } else showToast(res.error || 'Failed to create API key.');
    } catch (err: any) { showToast(err.message || 'Key creation blocked.'); }
  };

  const revoke = async (id: number) => {
    try {
      const res = await apiClient.deleteApiKey(id);
      if (res.success) { showToast('API key revoked.'); load(); }
      else showToast(res.error || 'Failed to revoke.');
    } catch { showToast('Revocation failed.'); }
  };

  return (
    <div className="flex flex-col gap-3 max-w-[640px]">
      <p className="text-xs text-[#656b6b]">API keys authenticate programmatic access to the panel API (power actions, telemetry, backups). Full keys are shown only once — save them immediately.</p>
      <div className="flex gap-2 items-center">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Key name (e.g. CI pipeline)" className="w-48 p-2 border border-[#dedfdf] rounded text-xs outline-none" />
        <select value={scope} onChange={e => setScope(e.target.value as any)} className="p-2 border border-[#dedfdf] rounded text-xs outline-none bg-white">
          <option value="read">Read-only</option>
          <option value="power">Power + Telemetry</option>
          <option value="full">Full control</option>
        </select>
        <button onClick={create} className="btn-primary py-2 px-4 text-xs cursor-pointer">Generate Key</button>
      </div>
      {newKey && (
        <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded text-xs text-[#166534]">
          <div className="font-bold mb-1">New API key — save it now:</div>
          <code className="font-mono break-all">{newKey}</code>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {keys.length === 0 && <div className="text-xs text-[#656b6b]">No API keys yet.</div>}
        {keys.map((k: any) => (
          <div key={k.id} className="flex items-center justify-between border border-[#dedfdf] rounded px-3 py-2 text-xs">
            <div>
              <span className="font-semibold text-[#1a1a1a]">{k.name}</span>
              <span className="ml-2 px-1.5 py-0.5 rounded bg-[#f3f4f6] text-[#656b6b] font-bold uppercase text-[10px]">{k.scope}</span>
              <div className="font-mono text-[#888] text-[11px] mt-0.5">{k.key_prefix || k.prefix || '••••••••'}••••••••</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={async () => { const txt = k.key || ''; if (!txt) { showToast('Full key is only shown once at creation time.'); return; } try { await navigator.clipboard.writeText(txt); showToast('API key copied to clipboard.'); } catch { showToast('Copy not supported in this browser.'); } }} className="text-[#2563eb] font-semibold hover:underline cursor-pointer">Copy</button>
              <button onClick={() => revoke(k.id)} className="text-[#dc2626] font-semibold hover:underline cursor-pointer">Revoke</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------- Team Access ----------------
const TeamSection: React.FC<{ vmid: number; showToast: (m: string) => void }> = ({ vmid, showToast }) => {
  const [subs, setSubs] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [scope, setScope] = useState<'readonly' | 'power' | 'full'>('readonly');

  const load = async () => {
    try {
      const res = await apiClient.getSubUsers(vmid);
      setSubs(res.data || []);
    } catch { /* empty */ }
  };

  useEffect(() => { load(); }, [vmid]);

  const add = async () => {
    const trimmed = email.trim();
    if (!trimmed) { showToast('Enter the team member email first.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { showToast('Please enter a valid email address.'); return; }
    try {
      const res = await apiClient.addSubUser(vmid, trimmed, scope);
      if (res.success) { showToast(res.message); setEmail(''); load(); }
      else showToast(res.error || 'Failed to add team member.');
    } catch (err: any) { showToast(err.message || 'Add blocked.'); }
  };

  const updateScope = async (id: number, s: 'readonly' | 'power' | 'full') => {
    try {
      const res = await apiClient.updateSubUser(vmid, id, s);
      if (res.success) showToast(`Access updated to ${s}.`);
      load();
    } catch { showToast('Update failed.'); }
  };

  const remove = async (id: number) => {
    try {
      const res = await apiClient.removeSubUser(vmid, id);
      if (res.success) showToast('Team access revoked.');
      load();
    } catch { showToast('Removal failed.'); }
  };

  return (
    <div className="flex flex-col gap-3 max-w-[640px]">
      <p className="text-xs text-[#656b6b]">Delegate access to this instance to other accounts without sharing your password. The team member must already have a Stellar Panel account (invite them via User Management first). Scopes: Read-only (view metrics), Power (metrics + power actions), Full (everything except account changes).</p>
      <div className="flex gap-2 items-center">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@example.com" className="w-56 p-2 border border-[#dedfdf] rounded text-xs outline-none" />
        <select value={scope} onChange={e => setScope(e.target.value as any)} className="p-2 border border-[#dedfdf] rounded text-xs outline-none bg-white">
          <option value="readonly">Read-only</option>
          <option value="power">Power + Telemetry</option>
          <option value="full">Full control</option>
        </select>
        <button onClick={add} className="btn-primary py-2 px-4 text-xs cursor-pointer">Grant Access</button>
      </div>
      <div className="flex flex-col gap-2">
        {subs.length === 0 && <div className="text-xs text-[#656b6b]">No delegated access yet.</div>}
        {subs.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between border border-[#dedfdf] rounded px-3 py-2 text-xs">
            <div>
              <span className="font-semibold text-[#1a1a1a]">{s.email}</span>
              <span className="ml-2 px-1.5 py-0.5 rounded bg-[#f3f4f6] text-[#656b6b] font-bold uppercase text-[10px]">{s.scope}</span>
            </div>
            <div className="flex gap-3 items-center">
              <select value={s.scope} onChange={e => updateScope(s.id, e.target.value as any)} className="p-1 border border-[#dedfdf] rounded text-[11px] outline-none bg-white">
                <option value="readonly">Read-only</option>
                <option value="power">Power</option>
                <option value="full">Full</option>
              </select>
              <button onClick={() => remove(s.id)} className="text-[#dc2626] font-semibold hover:underline cursor-pointer">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
