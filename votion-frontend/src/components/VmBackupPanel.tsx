import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

interface Snapshot {
  id?: number;
  name: string;
  description?: string;
  snaptime?: number;
  vmstate?: boolean;
  created_at?: string;
  description_text?: string;
}

interface VmBackupPanelProps {
  vmid: number;
  proxmoxConnectionId?: string | null;
}

export default function VmBackupPanel({ vmid, proxmoxConnectionId }: VmBackupPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getVmSnapshots(vmid, proxmoxConnectionId);
      setSnapshots(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, [vmid, proxmoxConnectionId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim() || `snap-${new Date().toISOString().slice(0, 16)}`;
    setCreating(true);
    try {
      const res = await apiClient.createVmSnapshot(vmid, name, newDescription.trim(), proxmoxConnectionId);
      if (res.success) {
        showToast(`Snapshot "${name}" created`);
        setShowCreate(false);
        setNewName('');
        setNewDescription('');
        await loadSnapshots();
      } else {
        showToast(res.error || 'Failed to create snapshot');
      }
    } catch {
      showToast('Failed to create snapshot');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (snap: Snapshot) => {
    try {
      const res = await apiClient.deleteVmSnapshot(vmid, snap.name, proxmoxConnectionId);
      if (res.success) {
        showToast(`Snapshot "${snap.name}" deleted`);
        await loadSnapshots();
      } else {
        showToast(res.error || 'Failed to delete snapshot');
      }
    } catch {
      showToast('Failed to delete snapshot');
    }
  };

  const label = (snap: Snapshot) =>
    typeof snap.snaptime === 'number'
      ? new Date(snap.snaptime * 1000).toLocaleString()
      : (snap.created_at ? new Date(snap.created_at).toLocaleString() : 'Unknown');

  return (
    <div className="flex flex-col gap-4 bg-white border border-[#dedfdf] rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#1a1a1a]">Snapshot Backups — VM {vmid}</h2>
          <p className="text-xs text-[#656b6b] mt-0.5">
            {snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'} stored on the host for VM {vmid}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary py-1.5 px-3 text-xs cursor-pointer"
        >
          {showCreate ? 'Cancel' : '+ New Snapshot'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 border border-[#dedfdf] rounded-lg p-4 bg-[#f9fafa]">
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Snapshot Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. pre-update-2026-08-19"
              className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a] font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Description (optional)</label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe why this snapshot was taken"
              className="w-full bg-white border border-[#dedfdf] rounded p-2 text-xs text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="btn-primary py-1.5 px-4 text-xs disabled:opacity-50 cursor-pointer"
            >
              {creating ? 'Creating...' : 'Create Snapshot'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-[#656b6b] font-mono text-xs border border-dashed border-[#dedfdf] rounded">
          Loading snapshots for VM {vmid}...
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 bg-[#f9fafa] border border-dashed border-[#dedfdf] rounded-lg text-center">
          <svg className="w-12 h-12 text-[#dedfdf] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p className="text-sm text-[#656b6b] max-w-md">
            No snapshots exist for VM {vmid} yet. Click <strong>New Snapshot</strong> to take one.
          </p>
        </div>
      ) : (
        <div className="responsive-table-container">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f5f6f6] border-b border-[#dedfdf] text-[#656b6b] uppercase">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Description</th>
                <th className="px-4 py-2.5 font-semibold">Taken</th>
                <th className="px-4 py-2.5 font-semibold">VM State</th>
                <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dedfdf]">
              {snapshots.map((snap) => (
                <tr key={snap.name} className="hover:bg-[#f9fafa] transition-colors">
                  <td className="px-4 py-2.5 font-mono font-medium text-[#1a1a1a]">{snap.name}</td>
                  <td className="px-4 py-2.5 text-[#656b6b]">{snap.description || snap.description_text || '—'}</td>
                  <td className="px-4 py-2.5 text-[#656b6b]">{label(snap)}</td>
                  <td className="px-4 py-2.5">
                    {snap.vmstate ? (
                      <span className="bg-[#f1f1f1] text-[#656b6b] px-2 py-0.5 rounded text-[10px] font-semibold">saved</span>
                    ) : (
                      <span className="bg-[#f1f1f1] text-[#656b6b] px-2 py-0.5 rounded text-[10px] font-semibold">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(snap)}
                      className="text-[#dc2626] hover:text-[#b91c1c] font-semibold px-2 py-1 rounded bg-[#fef2f2] hover:bg-[#fecaca] transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
