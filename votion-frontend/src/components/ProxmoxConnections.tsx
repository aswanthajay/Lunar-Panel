import React, { useState, useEffect } from 'react';
import { apiClient, ApiProxmoxConnection, ApiProxmoxConnectionOverview } from '../services/apiClient';

const formatConnectionTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Not recorded';

const connectionStatusLabel = (status?: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'connected' || normalized === 'online' || normalized === 'healthy') return 'Healthy';
  if (normalized === 'unauthorized') return 'Auth failed';
  if (normalized === 'error' || normalized === 'offline') return 'Unreachable';
  return 'Needs test';
};

const connectionStatusTone = (status?: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'connected' || normalized === 'online' || normalized === 'healthy') return 'connection-status-healthy';
  if (normalized === 'unauthorized') return 'connection-status-warning';
  if (normalized === 'error' || normalized === 'offline') return 'connection-status-error';
  return 'connection-status-neutral';
};

export const ProxmoxConnections: React.FC = () => {
  const [connections, setConnections] = useState<ApiProxmoxConnectionOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNodeDisplayName, setNewNodeDisplayName] = useState('');
  const [newHostIp, setNewHostIp] = useState('');
  const [newPort, setNewPort] = useState(8006);
  const [newTokenId, setNewTokenId] = useState('');
  const [newTokenSecret, setNewTokenSecret] = useState('');
  const [newSslFingerprint, setNewSslFingerprint] = useState('');
  const [isFetchingNewFingerprint, setIsFetchingNewFingerprint] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Edit Connection State
  const [editTarget, setEditTarget] = useState<ApiProxmoxConnection | null>(null);
  const [editName, setEditName] = useState('');
  const [editNodeDisplayName, setEditNodeDisplayName] = useState('');
  const [editHostIp, setEditHostIp] = useState('');
  const [editPort, setEditPort] = useState(8006);
  const [editTokenId, setEditTokenId] = useState('');
  const [editTokenSecret, setEditTokenSecret] = useState('');
  const [editSslFingerprint, setEditSslFingerprint] = useState('');
  const [isFetchingEditFingerprint, setIsFetchingEditFingerprint] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadConnections = async () => {
    setLoading(true);
    setOverviewError(null);
    let lastError: unknown;

    for (const delayMs of [0, 500, 1500]) {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        const data = await apiClient.getProxmoxConnectionOverview();
        setConnections(data);
        setLoading(false);
        return;
      } catch (error) {
        lastError = error;
        if (!localStorage.getItem('votion_jwt_token')) {
          setLoading(false);
          break;
        }
      }
    }

    const detail = lastError instanceof Error ? lastError.message : 'The connection inventory is temporarily unavailable.';
    setOverviewError(detail);
    setConnections([]);
    setLoading(false);
  };

  useEffect(() => {
    loadConnections();
  }, []);



  const openEditModal = (conn: ApiProxmoxConnection) => {
    setEditTarget(conn);
    setEditName(conn.name);
    setEditNodeDisplayName(conn.node_display_name || '');
    setEditHostIp(conn.host_ip);
    setEditPort(conn.port);
    setEditTokenId(conn.token_id || '');
    // Token secret is masked server-side; leave blank to keep the existing secret
    setEditTokenSecret('');
    setEditSslFingerprint(conn.ssl_fingerprint || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setIsEditing(true);
    try {
      const res = await apiClient.updateProxmoxConnection(editTarget.id, {
        name: editName,
        node_display_name: editNodeDisplayName.trim() || null,
        host_ip: editHostIp,
        port: editPort,
        token_id: editTokenId,
        token_secret: editTokenSecret,
        ssl_fingerprint: editSslFingerprint,
      });
      if (res.success) {
        showToast('Connection updated successfully');
        setEditTarget(null);
        loadConnections();
      } else {
        showToast(res.error || 'Failed to update connection');
      }
    } catch (err) {
      showToast('Error updating connection');
    } finally {
      setIsEditing(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingConnectionId(id);
    try {
      const result = await apiClient.testStoredProxmoxConnection(id);
      showToast(result.message || 'Connection test passed.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Connection test failed.');
    } finally {
      setTestingConnectionId(null);
      await loadConnections();
    }
  };

  const handleFetchFingerprint = async (mode: 'new' | 'edit') => {
    const host = mode === 'new' ? newHostIp : editHostIp;
    const port = mode === 'new' ? newPort : editPort;
    if (!host.trim()) {
      showToast('Enter the Proxmox host before retrieving its certificate fingerprint.');
      return;
    }

    const setLoading = mode === 'new' ? setIsFetchingNewFingerprint : setIsFetchingEditFingerprint;
    const setFingerprint = mode === 'new' ? setNewSslFingerprint : setEditSslFingerprint;
    setLoading(true);
    try {
      const result = await apiClient.fetchProxmoxFingerprint({ host_ip: host, port });
      if (!result.success || !result.fingerprint) {
        showToast(result.error || 'Unable to retrieve the server certificate fingerprint.');
        return;
      }
      setFingerprint(result.fingerprint);
      showToast('Certificate fingerprint retrieved. Review it before saving the connection.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to retrieve the server certificate fingerprint.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiClient.deleteProxmoxConnection(id);
      if (res.success) {
        showToast('Connection deleted');
        loadConnections();
      } else {
        showToast(res.error || 'Failed to delete connection');
      }
    } catch (err) {
      showToast('Error deleting connection');
    }
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    showToast('Testing connection to the cluster engine...');
    try {
      // Real connectivity test against the cluster engine (not a simulated delay)
      const testResult = await apiClient.testProxmoxConnection({
        host_ip: newHostIp,
        port: newPort,
        token_id: newTokenId,
        token_secret: newTokenSecret,
        ssl_fingerprint: newSslFingerprint,
      });
      if (!testResult?.success || !testResult?.reachable) {
        showToast(`⚠️ ${testResult?.error || testResult?.reason || 'Connection test failed — check host, port, and API token'}`);
        setIsTesting(false);
        return;
      }
      showToast(testResult?.message || 'Cluster engine reachable.');
      const payload = {
        name: newName,
        node_display_name: newNodeDisplayName.trim() || null,
        host_ip: newHostIp,
        port: newPort,
        token_id: newTokenId,
        token_secret: newTokenSecret,
        ssl_fingerprint: newSslFingerprint,
      };
      const res = await apiClient.addProxmoxConnection(payload);
      if (res.success) {
        showToast('Connection Verified & Saved Successfully!');
        setShowAddModal(false);
        setNewName('');
        setNewNodeDisplayName('');
        setNewHostIp('');
        setNewPort(8006);
        setNewTokenId('');
        setNewTokenSecret('');
        setNewSslFingerprint('');
        loadConnections();
      } else {
        showToast(res.error || 'Connection verification failed');
      }
    } catch (err) {
      showToast('Error testing or saving connection');
    } finally {
      setIsTesting(false);
    }
  };

  const healthyCount = connections.filter(connection => connectionStatusLabel(connection.status) === 'Healthy').length;
  const totalVmCount = connections.reduce((total, connection) => total + connection.vmCount, 0);
  const runningVmCount = connections.reduce((total, connection) => total + connection.runningVmCount, 0);
  const observedNodeCount = connections.reduce((total, connection) => total + connection.nodeCount, 0);

  if (loading) {
    return <div className="p-8 text-white">Loading connection health...</div>;
  }

  return (
    <main className="app-content">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="mb-6 p-3 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/60 hover:text-white">✕</button>
        </div>
      )}

      <div className="connection-manager-header flex items-start justify-between gap-5 mb-8">
        <div>
          <p className="connection-manager-eyebrow">Infrastructure control plane</p>
          <h1 className="page-heading mb-1">Cluster Connection Manager</h1>
          <p className="text-xs text-[#656b6b]">Monitor connectivity and inventory across every Proxmox environment.</p>
        </div>
        <div className="connection-manager-actions flex items-center gap-2">
          <button type="button" onClick={loadConnections} disabled={loading} className="btn-secondary cursor-pointer" title="Refresh connection health">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary cursor-pointer flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
            Add Connection
          </button>
        </div>
      </div>

      {overviewError && (
        <div className="connection-overview-error mb-6" role="alert">
          <div>
            <strong>Connection inventory unavailable</strong>
            <p>{overviewError}</p>
          </div>
          <button type="button" className="btn-secondary" onClick={loadConnections}>Retry</button>
        </div>
      )}

      <div className="connection-overview-summary grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <div className="connection-summary-card"><span>Connections</span><strong>{connections.length}</strong><small>{healthyCount} healthy</small></div>
        <div className="connection-summary-card"><span>Observed nodes</span><strong>{observedNodeCount}</strong><small>From synchronized inventory</small></div>
        <div className="connection-summary-card"><span>Total VMs</span><strong>{totalVmCount}</strong><small>{runningVmCount} running</small></div>
        <div className="connection-summary-card"><span>Inventory scope</span><strong>Read-only</strong><small>Health checks do not mutate VMs</small></div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {connections.map((conn) => (
          <article key={conn.id} className="connection-overview-card group">
            <div className="connection-card-header">
              <div className="connection-identity">
                <div className="connection-icon" aria-hidden="true">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                </div>
                <div className="min-w-0">
                  <h3>{conn.name}</h3>
                  <p>{conn.host_ip}:{conn.port}</p>
                  {conn.node_display_name && (
                    <span className="inline-block mt-1 text-[11px] font-medium bg-[#1e293b] text-[#38bdf8] px-2 py-0.5 rounded border border-[#334155]">
                      Host Node: {conn.node_display_name}
                    </span>
                  )}
                </div>
              </div>
              <span className={`connection-status ${connectionStatusTone(conn.status)}`}><span aria-hidden="true"></span>{connectionStatusLabel(conn.status)}</span>
            </div>

            <div className="connection-inventory-grid">
              <div><span>VMs</span><strong>{conn.vmCount}</strong></div>
              <div><span>Running</span><strong>{conn.runningVmCount}</strong></div>
              <div><span>Nodes</span><strong>{conn.nodeCount}</strong></div>
            </div>

            <dl className="connection-meta-list">
              <div><dt>Last connection test</dt><dd>{formatConnectionTime(conn.last_tested)}</dd></div>
              <div><dt>Latest inventory record</dt><dd>{formatConnectionTime(conn.lastInventoryAt)}</dd></div>
              <div><dt>API token</dt><dd title={conn.token_id}>{conn.token_id}</dd></div>
            </dl>

            <div className="connection-card-actions">
              <button type="button" onClick={() => handleTestConnection(conn.id)} disabled={testingConnectionId !== null} className="btn-secondary" title="Test this stored Proxmox connection">
                {testingConnectionId === conn.id ? 'Testing…' : 'Test connection'}
              </button>
              <button type="button" onClick={() => openEditModal(conn)} className="connection-icon-action" title="Edit connection" aria-label={`Edit ${conn.name}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" onClick={() => setDeleteTarget(conn.id)} className="connection-icon-action connection-icon-action-danger" title="Delete connection" aria-label={`Delete ${conn.name}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-2-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
              </button>
            </div>
          </article>
        ))}

        {connections.length === 0 && !overviewError && (
          <div className="connection-empty-state col-span-full">
            <svg className="text-[#656b6b] mb-4" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
            <h3>No Proxmox connections configured</h3>
            <p>Add the first cluster to begin tracking connectivity, nodes, and VM inventory from one admin workspace.</p>
            <button type="button" className="btn-primary mt-4" onClick={() => setShowAddModal(true)}>Add first connection</button>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal (replaces browser confirm()) */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1001] flex items-center justify-center p-6">
          <div className="w-full max-w-[380px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <h3 className="text-base font-bold text-[#dc2626]">Delete Cluster Connection?</h3>
            <p className="text-xs text-[#656b6b]">This permanently removes the connection record from the panel. VMs already running on the cluster are not affected.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 py-2 cursor-pointer">Cancel</button>
              <button onClick={async () => {
                const id = deleteTarget;
                setDeleteTarget(null);
                await handleDelete(id);
              }} className="theme-destructive-button btn-primary bg-[#dc2626] hover:bg-[#b91c1c] flex-1 py-2 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="w-full max-w-[460px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#1a1a1a] mb-1">Add Cluster Connection</h3>
            <p className="text-xs text-[#656b6b] mb-6">Enter API credentials to securely link a cluster.</p>

            <form onSubmit={handleTestAndSave} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Cluster / Connection Name</label>
                <input 
                  type="text" 
                  autoComplete="off"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Singapore SG1"
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Host Node Display Name / Alias (Optional)</label>
                <input 
                  type="text" 
                  autoComplete="off"
                  value={newNodeDisplayName}
                  onChange={(e) => setNewNodeDisplayName(e.target.value)}
                  placeholder="e.g. Singapore SG1 or SG-Node-01 (overrides Proxmox-VE in tables)"
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                />
                <p className="mt-1 text-[11px] text-[#656b6b]">Custom name displayed under "Host Node" in the client and instance tables instead of the raw physical hostname.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Host IP / FQDN</label>
                  <input 
                    type="text" 
                    autoComplete="off"
                    value={newHostIp}
                    onChange={(e) => setNewHostIp(e.target.value)}
                    placeholder="10.0.10.1"
                    className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Port</label>
                  <input 
                  type="number" 
                  autoComplete="off"
                  value={newPort}
                    onChange={(e) => setNewPort(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[#dedfdf] pt-4 mt-2">
                <div className="col-span-2">
                  <p className="text-[10px] text-[#656b6b] mb-2">VNC functionality relies on API Tokens with Privilege Separation Disabled.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">API Token ID</label>
                <input 
                  type="text" 
                  autoComplete="off"
                  value={newTokenId}
                  onChange={(e) => setNewTokenId(e.target.value)}
                  placeholder="root@pam!votion_token"
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">API Token Secret</label>
                <input 
                  type="password" 
                  autoComplete="new-password"
                  value={newTokenSecret}
                  onChange={(e) => setNewTokenSecret(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                  required
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="block text-xs font-semibold text-[#1a1a1a]">SSL Fingerprint</label>
                  <button
                    type="button"
                    onClick={() => void handleFetchFingerprint('new')}
                    disabled={isFetchingNewFingerprint || !newHostIp.trim()}
                    className="text-[11px] font-semibold text-[#2563eb] transition-colors hover:text-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                    title="Read the SHA-256 certificate fingerprint from this host and port"
                  >
                    {isFetchingNewFingerprint ? 'Retrieving…' : 'Fetch fingerprint'}
                  </button>
                </div>
                <p id="new-fingerprint-help" className="text-[11px] text-[#656b6b] mb-1">Required for self-signed PVE certificates. Fetch reads the presented SHA-256 certificate only; review it before saving.</p>
                <input 
                  type="text" 
                  autoComplete="off"
                  value={newSslFingerprint}
                  onChange={(e) => setNewSslFingerprint(e.target.value)}
                  placeholder="SHA256:7B:44:91..."
                  aria-describedby="new-fingerprint-help"
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                />
              </div>
              
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#dedfdf]">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  disabled={isTesting}
                  className="flex-1 py-2 text-[11px] text-[#656b6b] hover:text-[#1a1a1a] font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isTesting}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {isTesting ? 'Verifying...' : 'Test & Save Connection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    
      {/* Edit Connection Modal */}
      {editTarget !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1002] flex items-center justify-center p-6">
          <div className="w-full max-w-[460px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#1a1a1a] mb-1">Edit Cluster Connection</h3>
            <p className="text-xs text-[#656b6b] mb-6">Update the details for <span className="font-semibold text-[#1a1a1a]">{editTarget.name}</span>. Leave sensitive fields blank to keep the existing values.</p>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Cluster / Connection Name</label>
                <input
                    type="text"
                    autoComplete="off"
                    value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Host Node Display Name / Alias (Optional)</label>
                <input 
                  type="text" 
                  autoComplete="off"
                  value={editNodeDisplayName}
                  onChange={(e) => setEditNodeDisplayName(e.target.value)}
                  placeholder="e.g. Singapore SG1 or SG-Node-01 (overrides Proxmox-VE in tables)"
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                />
                <p className="mt-1 text-[11px] text-[#656b6b]">Custom name displayed under "Host Node" in the client and instance tables instead of the raw physical hostname.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Host IP / FQDN</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={editHostIp}
                    onChange={(e) => setEditHostIp(e.target.value)}
                    className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Port</label>
                  <input
                    type="number"
                    autoComplete="off"
                    value={editPort}
                    onChange={(e) => setEditPort(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">API Token ID</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={editTokenId}
                  onChange={(e) => setEditTokenId(e.target.value)}
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">API Token Secret (leave blank to keep)</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={editTokenSecret}
                  onChange={(e) => setEditTokenSecret(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="block text-xs font-semibold text-[#1a1a1a]">SSL Fingerprint</label>
                  <button
                    type="button"
                    onClick={() => void handleFetchFingerprint('edit')}
                    disabled={isFetchingEditFingerprint || !editHostIp.trim()}
                    className="text-[11px] font-semibold text-[#2563eb] transition-colors hover:text-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                    title="Read the SHA-256 certificate fingerprint from this host and port"
                  >
                    {isFetchingEditFingerprint ? 'Retrieving…' : 'Fetch fingerprint'}
                  </button>
                </div>
                <p id="edit-fingerprint-help" className="text-[11px] text-[#656b6b] mb-1">Fetch reads the presented SHA-256 certificate only. Review the value before saving these connection changes.</p>
                <input
                  type="text"
                  autoComplete="off"
                  value={editSslFingerprint}
                  onChange={(e) => setEditSslFingerprint(e.target.value)}
                  aria-describedby="edit-fingerprint-help"
                  className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
                />
              </div>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#dedfdf]">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  disabled={isEditing}
                  className="flex-1 py-2 text-[11px] text-[#656b6b] hover:text-[#1a1a1a] font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {isEditing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

</main>
  );
};
