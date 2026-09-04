/*
  AUTOMATED TASK SCHEDULING — "Schedule" overlay for the instance list.
  Manages nightly restarts, scheduled backups (snapshots) and power windows.
  Theme-aware: Carta Ink tokens in dark, hard hex equivalents in light.
*/
import React from 'react';

export const COMMON_TZ = ['UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'Europe/London'];
export const DAY_OPTIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const TASK_TYPE_COLORS: Record<string, string> = {
  power_start: '#15803d',
  power_stop: '#b91c1c',
  reboot: '#1d4ed8',
  snapshot: '#7c3aed',
};
export const TASK_TYPE_LABELS: Record<string, string> = {
  power_start: 'Power on',
  power_stop: 'Power off',
  reboot: 'Restart',
  snapshot: 'Snapshot',
};

interface ScheduleOverlayProps {
  open: boolean;
  onClose: () => void;
  dark: boolean;
  dk: (d: string, l: string) => string;
  schedules: any[];
  schedulesLoading: boolean;
  formOpen: boolean;
  editing: any;
  onNewForm: () => void;
  onEditForm: (s: any) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onRunNow: (id: string) => void;
  runNowLoading: string | null;
  formName: string; setFormName: (v: string) => void;
  formTaskType: string; setFormTaskType: (v: string) => void;
  formVmids: (string | number)[]; toggleFormVmSelection: (id: string | number) => void;
  formDays: string[]; toggleFormDay: (d: string) => void;
  formTime: string; setFormTime: (v: string) => void;
  formTz: string; setFormTz: (v: string) => void;
  formSubmitting: boolean;
  onSubmitForm: () => void;
  clientVMs: any[];
}

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const ScheduleOverlay: React.FC<ScheduleOverlayProps> = (p) => {
  // Fallback: detect dark from the document theme so the overlay is never
  // rendered in the wrong palette even if the parent prop is out of sync.
  const dark = p.dark ?? document.documentElement.getAttribute('data-theme') === 'dark';
  const dk = p.dk ?? ((d: string, l: string) => (dark ? d : l));
  const { onClose } = p;
  // Shared shell tokens
  const paper = dk('#ffffff', '#151515');
  const surface = dk('#f9fafb', '#1c1c1c');
  const border = dk('#dedfdf', '#313131');
  const borderStrong = dk('#1a1a1a', '#4a4a4a');
  const textPrimary = dk('#1a1a1a', '#e8e8e8');
  const textSubtle = dk('#656b6b', '#a7aaaa');
  const textMuted = dk('#a7aaaa', '#7a7a7a');
  const hoverBg = dk('#fbfaf9', '#212121');
  const inputBg = dk('#ffffff', '#141414');
  const inkBtn = dk('#1a1a1a', '#e8e8e8');
  const inkBtnText = dk('#ffffff', '#151515');
  const headerBg = dk('#ffffff', '#151515');

  const inputCls = `w-full border rounded px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-[#5b8def] transition-shadow`;
  const inputStyle: React.CSSProperties = {
    borderColor: border,
    backgroundColor: inputBg,
    color: textPrimary,
  };
  const selectCls = `${inputCls} appearance-none bg-[length:12px] bg-no-repeat bg-[right_8px_center]`;

  if (!p.open) return null;

  // ---------------- Form ----------------
  if (p.formOpen) {
    return (
      <div className="fixed inset-0 z-[2200] flex items-start justify-center overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.55)', paddingTop: '56px', paddingBottom: '48px' }}>
        <div className="relative w-full max-w-2xl mx-4" style={{ backgroundColor: paper, border: `1px solid ${border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${border}`, backgroundColor: headerBg }}>
            <div>
              <div className="text-[15px] font-semibold" style={{ color: textPrimary }}>{p.editing ? 'Edit schedule' : 'New schedule'}</div>
              <div className="text-[11px] mt-0.5" style={{ color: textSubtle }}>Power windows, nightly restarts and snapshots run against the live cluster.</div>
            </div>
            <button onClick={p.onClose} className="text-[13px] px-2 py-1 rounded hover:bg-opacity-80 cursor-pointer" style={{ color: textSubtle, backgroundColor: hoverBg }}>✕</button>
          </div>

          <div className="px-6 py-5 flex flex-col gap-4">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: textSubtle }}>Name</label>
              <input className={inputCls} style={inputStyle} placeholder="e.g. Nightly restart — production" value={p.formName} onChange={e => p.setFormName(e.target.value)} maxLength={80} />
            </div>

            {/* Task type + timezone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: textSubtle }}>Action</label>
                <select className={selectCls} style={inputStyle} value={p.formTaskType} onChange={e => p.setFormTaskType(e.target.value)}>
                  <option value="power_start">Power on</option>
                  <option value="power_stop">Power off</option>
                  <option value="reboot">Restart</option>
                  <option value="snapshot">Snapshot (backup)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: textSubtle }}>Timezone</label>
                <select className={selectCls} style={inputStyle} value={p.formTz} onChange={e => p.setFormTz(e.target.value)}>
                  {COMMON_TZ.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            {/* Time */}
            <div className="max-w-[180px]">
              <label className="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: textSubtle }}>Time (24h)</label>
              <input type="time" className={inputCls} style={inputStyle} value={p.formTime} onChange={e => p.setFormTime(e.target.value)} />
            </div>

            {/* Days */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: textSubtle }}>Repeat on</label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_OPTIONS.map(day => {
                  const sel = p.formDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => p.toggleFormDay(day)}
                      className="px-3 py-1.5 text-[12px] font-semibold rounded border cursor-pointer transition-colors"
                      style={{
                        borderColor: sel ? borderStrong : border,
                        backgroundColor: sel ? inkBtn : 'transparent',
                        color: sel ? inkBtnText : textPrimary,
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VMs */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: textSubtle }}>Target instances <span style={{ color: textMuted }}>({p.formVmids.length} selected)</span></label>
              <div className="border rounded max-h-44 overflow-y-auto" style={{ borderColor: border, backgroundColor: surface }}>
                {p.clientVMs.length === 0 && (
                  <div className="px-3 py-4 text-center text-[12px]" style={{ color: textSubtle }}>No instances allocated yet.</div>
                )}
                {p.clientVMs.map((vm: any) => {
                  const sel = p.formVmids.some(v => String(v) === String(vm.vmid));
                  return (
                    <label key={vm.vmid} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-opacity-80" style={{ backgroundColor: sel ? hoverBg : 'transparent', borderBottom: `1px solid ${border}` }}>
                      <input type="checkbox" checked={sel} onChange={() => p.toggleFormVmSelection(vm.vmid)} className="w-[15px] h-[15px] cursor-pointer" />
                      <span className="text-[13px] font-medium" style={{ color: textPrimary }}>{vm.name || `VM-${vm.vmid}`}</span>
                      <span className="text-[11px]" style={{ color: textMuted }}>VM-{vm.vmid} · {vm.status === 'running' ? 'running' : vm.isSuspended ? 'suspended' : 'stopped'}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: `1px solid ${border}`, backgroundColor: headerBg }}>
            <button onClick={p.onClose} className="px-4 py-1.5 text-[13px] font-semibold rounded border cursor-pointer hover:bg-opacity-80" style={{ borderColor: border, color: textPrimary }}>Cancel</button>
            <button
              onClick={p.onSubmitForm}
              disabled={p.formSubmitting}
              className="px-5 py-1.5 text-[13px] font-bold rounded cursor-pointer disabled:opacity-50 transition-colors"
              style={{ backgroundColor: inkBtn, color: inkBtnText }}
            >
              {p.formSubmitting ? 'Saving…' : p.editing ? 'Save changes' : 'Create schedule'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- List ----------------
  return (
    <div className="fixed inset-0 z-[2200] flex items-start justify-center overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.55)', paddingTop: '56px', paddingBottom: '48px' }}>
      <div className="relative w-full max-w-3xl mx-4" style={{ backgroundColor: paper, border: `1px solid ${border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${border}`, backgroundColor: headerBg }}>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: textPrimary }}>Task schedules</div>
            <div className="text-[11px] mt-0.5" style={{ color: textSubtle }}>Automate power windows, nightly restarts and snapshots for your instances.</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={p.onNewForm} className="px-4 py-1.5 text-[13px] font-bold rounded cursor-pointer transition-colors" style={{ backgroundColor: inkBtn, color: inkBtnText }}>+ New schedule</button>
            <button onClick={p.onClose} className="text-[13px] px-2 py-1 rounded cursor-pointer" style={{ color: textSubtle, backgroundColor: hoverBg }}>✕</button>
          </div>
        </div>

        <div className="px-6 py-4">
          {p.schedulesLoading && p.schedules.length === 0 ? (
            <div className="py-10 text-center text-[13px]" style={{ color: textSubtle }}>Loading schedules…</div>
          ) : p.schedules.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-[13px] font-medium" style={{ color: textPrimary }}>No schedules yet</div>
              <div className="text-[12px] mt-1 mb-4" style={{ color: textSubtle }}>Create a schedule to automate recurring tasks — e.g. restart every night at 03:00, or snapshot before weekend maintenance.</div>
              <button onClick={p.onNewForm} className="px-4 py-1.5 text-[13px] font-semibold rounded border cursor-pointer hover:bg-opacity-80" style={{ borderColor: borderStrong, color: textPrimary }}>+ New schedule</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {p.schedules.map((s: any) => {
                const color = TASK_TYPE_COLORS[s.taskType] || '#656b6b';
                const label = TASK_TYPE_LABELS[s.taskType] || s.taskType;
                const names = (s.targetIds || []).map((id: any) => {
                  const vm = p.clientVMs.find((v: any) => String(v.vmid) === String(id));
                  return vm ? (vm.name || `VM-${vm.vmid}`) : `VM-${id}`;
                }).join(', ');
                return (
                  <div key={s.id} className="border rounded p-3.5" style={{ borderColor: border, backgroundColor: surface }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>{s.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: color + '22', color: color }}>{label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${s.enabled ? '' : ''}`} style={{ backgroundColor: s.enabled ? '#16a34a22' : '#656b6b22', color: s.enabled ? '#16a34a' : textMuted }}>{s.enabled ? 'Active' : 'Paused'}</span>
                        </div>
                        <div className="text-[11px] mt-1" style={{ color: textMuted }}>
                          Every {s.days && s.days.length ? s.days.join(', ') : '—'} at {s.time || '—'} · {s.timezone || 'UTC'}
                        </div>
                        <div className="text-[11px] mt-0.5 truncate" style={{ color: textSubtle }} title={names}>Targets: {names || '—'}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Enabled toggle */}
                        <button
                          onClick={() => p.onToggleEnabled(s.id, !s.enabled)}
                          className="relative w-9 h-5 rounded-full transition-colors"
                          style={{ backgroundColor: s.enabled ? '#16a34a' : border }}
                          title={s.enabled ? 'Pause schedule' : 'Enable schedule'}
                        >
                          <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ left: s.enabled ? '18px' : '2px' }} />
                        </button>
                        <button onClick={() => p.onRunNow(s.id)} disabled={p.runNowLoading === s.id} className="px-2.5 py-1 text-[11px] font-semibold rounded border cursor-pointer disabled:opacity-50" style={{ borderColor: borderStrong, color: textPrimary }}>{p.runNowLoading === s.id ? 'Firing…' : 'Run now'}</button>
                        <button onClick={() => p.onEditForm(s)} className="px-2.5 py-1 text-[11px] font-semibold rounded border cursor-pointer" style={{ borderColor: border, color: textSubtle }}>Edit</button>
                        <button onClick={() => p.onDelete(s.id)} className="px-2.5 py-1 text-[11px] font-semibold rounded border cursor-pointer" style={{ borderColor: '#f8717155', color: '#f87171' }}>Delete</button>
                      </div>
                    </div>
                    <div className="flex gap-6 mt-2 text-[10px]" style={{ color: textMuted }}>
                      <span>Next run: {fmt(s.nextRun)}</span>
                      <span>Last run: {s.lastRun ? `${fmt(s.lastRun)} — ${s.lastStatus || 'OK'}` : 'Never'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
