import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

interface AuditLog {
  id: string;
  timestamp: string;
  user_email: string;
  action: string;
  target: string;
  details: string;
  status: string;
}

const PAGE_SIZE = 30;

const actionStyle = (action: string): string => {
  const map: Record<string, string> = {
    LOGIN: 'bg-[#eff6ff] text-[#2563eb]',
    LOGOUT: 'bg-[#f1f5f9] text-[#475569]',
    CREATE_VM: 'bg-[#f0fdf4] text-[#16a34a]',
    DELETE_VM: 'bg-[#fef2f2] text-[#dc2626]',
    CREATE_USER: 'bg-[#f0fdf4] text-[#16a34a]',
    UPDATE_USER: 'bg-[#eff6ff] text-[#2563eb]',
    RESET_PASSWORD: 'bg-[#fffbeb] text-[#b45309]',
    CHANGE_EMAIL: 'bg-[#eff6ff] text-[#2563eb]',
    DELETE_USER: 'bg-[#fef2f2] text-[#dc2626]',
    CREATE_PROXMOX_CONNECTION: 'bg-[#f0fdf4] text-[#16a34a]',
    UPDATE_PROXMOX_CONNECTION: 'bg-[#eff6ff] text-[#2563eb]',
    DELETE_PROXMOX_CONNECTION: 'bg-[#fef2f2] text-[#dc2626]',
    SMTP_TEST: 'bg-[#f5f3ff] text-[#7c3aed]',
    UPDATE_SMTP_CONFIG: 'bg-[#f5f3ff] text-[#7c3aed]',
    UPDATE_MAIL_TEMPLATE: 'bg-[#f5f3ff] text-[#7c3aed]',
  };
  return map[action] || 'bg-[#f1f5f9] text-[#475569]';
};

const friendlyAction = (action: string): string => {
  return action
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const formatTimestamp = (ts: string): string => {
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};

const exportCsv = (logs: AuditLog[]) => {
  const header = 'Timestamp,User,Action,Target,Details,Status';
  const rows = logs.map((l) =>
    `"${l.timestamp}","${l.user_email}","${friendlyAction(l.action)}","${l.target.replace(/"/g, '""')}","${(l.details || '').replace(/"/g, '""')}","${l.status}"`
  );
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lunar-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const ClusterAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, byAction: [], byStatus: [], byUser: [] });
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        apiClient.getFilteredAuditLogs({
          action: actionFilter || undefined,
          user_email: emailFilter || undefined,
          status: statusFilter || undefined,
          q: q || undefined,
          limit: PAGE_SIZE,
          offset,
        }),
        apiClient.getAuditLogStats(),
      ]);
      if (logsRes.success) {
        setLogs(logsRes.data || []);
        setTotal(logsRes.total || 0);
      } else {
        showToast(logsRes.error || 'Failed to load audit logs');
      }
      if (statsRes.success) {
        setStats(statsRes.data || {});
      }
    } catch (err) {
      showToast('Error loading audit logs');
    } finally {
      setLoading(false);
    }
  }, [q, actionFilter, statusFilter, emailFilter, offset]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Debounced search
  const [searchVal, setSearchVal] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(searchVal), 300);
    return () => clearTimeout(t);
  }, [searchVal]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(totalPages, Math.floor(offset / PAGE_SIZE) + 1);

  const resetFilters = () => {
    setSearchVal('');
    setQ('');
    setActionFilter('');
    setStatusFilter('');
    setEmailFilter('');
    setOffset(0);
  };

  const statusCounts: Record<string, number> = {};
  (stats.byStatus || []).forEach((s: any) => { statusCounts[s.status] = s.count; });

  return (
    <main className="app-content">
      {/* Toast */}
      {toastMessage && (
        <div className="mb-6 p-3 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/60 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-heading mb-1 font-serif font-medium tracking-[-0.03em]">Cluster Audit Log</h1>
          <p className="text-xs text-[#656b6b]">Immutable record of every administrative action on the platform</p>
        </div>
        <button
          onClick={() => exportCsv(logs)}
          disabled={logs.length === 0}
          className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export CSV
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#dedfdf] rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#656b6b] uppercase tracking-wider mb-1">Total Events</p>
          <p className="text-2xl font-bold text-[#1a1a1a]">{stats.total ?? 0}</p>
        </div>
        <div className="bg-white border border-[#dedfdf] rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#656b6b] uppercase tracking-wider mb-1">Successful</p>
          <p className="text-2xl font-bold text-[#16a34a]">{statusCounts['success'] ?? 0}</p>
        </div>
        <div className="bg-white border border-[#dedfdf] rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#656b6b] uppercase tracking-wider mb-1">Failed</p>
          <p className="text-2xl font-bold text-[#dc2626]">{statusCounts['failed'] ?? statusCounts['error'] ?? 0}</p>
        </div>
        <div className="bg-white border border-[#dedfdf] rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#656b6b] uppercase tracking-wider mb-1">Most Active User</p>
          <p className="text-sm font-semibold text-[#1a1a1a] truncate">{(stats.byUser || [])[0]?.user_email || '—'}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#dedfdf] rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-[10px] font-bold text-[#656b6b] uppercase tracking-wider mb-1">Search</label>
          <input
            type="text"
            value={searchVal}
            onChange={(e) => { setSearchVal(e.target.value); setOffset(0); }}
            placeholder="Search details, targets..."
            className="w-full border border-[#dedfdf] rounded px-3 py-1.5 text-xs outline-none focus:border-[#1a1a1a]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#656b6b] uppercase tracking-wider mb-1">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
            className="w-full border border-[#dedfdf] rounded px-3 py-1.5 text-xs outline-none focus:border-[#1a1a1a] bg-white"
          >
            <option value="">All Actions</option>
            {(stats.byAction || []).map((a: any) => (
              <option key={a.action} value={a.action}>{friendlyAction(a.action)} ({a.count})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#656b6b] uppercase tracking-wider mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
            className="w-full border border-[#dedfdf] rounded px-3 py-1.5 text-xs outline-none focus:border-[#1a1a1a] bg-white"
          >
            <option value="">All Statuses</option>
            {(stats.byStatus || []).map((s: any) => (
              <option key={s.status} value={s.status}>{s.status}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#656b6b] uppercase tracking-wider mb-1">User</label>
          <select
            value={emailFilter}
            onChange={(e) => { setEmailFilter(e.target.value); setOffset(0); }}
            className="w-full border border-[#dedfdf] rounded px-3 py-1.5 text-xs outline-none focus:border-[#1a1a1a] bg-white"
          >
            <option value="">All Users</option>
            {(stats.byUser || []).map((u: any) => (
              <option key={u.user_email} value={u.user_email}>{u.user_email}</option>
            ))}
          </select>
        </div>
        <button
          onClick={resetFilters}
          className="text-[10px] font-semibold text-[#656b6b] hover:text-[#1a1a1a] underline cursor-pointer"
        >
          Reset Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#dedfdf] rounded-xl overflow-hidden shadow-sm">
        <div className="responsive-table-container">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f5f6f6] border-b border-[#dedfdf] text-[#656b6b] uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold tracking-wider">Timestamp</th>
                <th className="px-4 py-3 font-semibold tracking-wider">User</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Action</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Target</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Details</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dedfdf]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#656b6b]">Loading audit events...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#656b6b]">
                    <p className="font-semibold">No audit events found</p>
                    <p className="text-[11px] mt-1">Adjust your filters or check back after the next administrative action.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#f9fafa] transition-colors">
                    <td className="px-4 py-3 text-[#656b6b] whitespace-nowrap font-mono text-[10px]">{formatTimestamp(log.timestamp)}</td>
                    <td className="px-4 py-3 font-medium text-[#1a1a1a] whitespace-nowrap">{log.user_email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${actionStyle(log.action)}`}>
                        {friendlyAction(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#1a1a1a] whitespace-nowrap">{log.target || '—'}</td>
                    <td className="px-4 py-3 text-[#656b6b] max-w-[260px] truncate" title={log.details}>{log.details || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${log.status === 'success' ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#fef2f2] text-[#dc2626]'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="bg-[#fbfaf9] border-t border-[#dedfdf] px-4 py-3 flex items-center justify-between text-xs text-[#656b6b]">
            <span>
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} events
              &nbsp;·&nbsp; Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1.5 border border-[#dedfdf] rounded bg-white hover:bg-[#f1f1f1] font-semibold transition-colors disabled:opacity-40 cursor-pointer"
              >
                ← Previous
              </button>
              <button
                onClick={() => setOffset(Math.min(total - PAGE_SIZE, offset + PAGE_SIZE))}
                disabled={offset + PAGE_SIZE >= total}
                className="px-3 py-1.5 border border-[#dedfdf] rounded bg-white hover:bg-[#f1f1f1] font-semibold transition-colors disabled:opacity-40 cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
