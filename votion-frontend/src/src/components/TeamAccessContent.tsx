import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, type ApiTeamAccessMember, type ApiTeamAccessOverview, type ApiTeamAccessScope } from '../services/apiClient';

const scopeDetails: Record<ApiTeamAccessScope, { label: string; description: string }> = {
  readonly: { label: 'Viewer', description: 'View service health, telemetry, exports, backups, and firewall status.' },
  power: { label: 'Operator', description: 'Viewer access plus controlled power actions, backup creation, and approved application deployment.' },
  full: { label: 'Manager', description: 'Operator access plus firewall rule management. Billing, reimage approvals, and team control remain owner-only.' },
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const serviceLabel = (vm: { vmid: number; name: string }) => `${vm.name || 'Service'} · VM-${vm.vmid}`;

export const TeamAccessContent: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [overview, setOverview] = useState<ApiTeamAccessOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [revokingId, setRevokingId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<{ vmid: string; email: string; scope: ApiTeamAccessScope }>({ vmid: '', email: '', scope: 'readonly' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getTeamAccessOverview();
      setOverview(data);
      setForm((current) => ({
        ...current,
        vmid: current.vmid || String(data.vms[0]?.vmid || ''),
      }));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load team access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const membersByVm = useMemo(() => {
    const result = new Map<number, ApiTeamAccessMember[]>();
    overview?.members.forEach((member) => {
      const members = result.get(member.vmid) || [];
      members.push(member);
      result.set(member.vmid, members);
    });
    return result;
  }, [overview]);

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    const vmid = Number(form.vmid);
    if (!Number.isInteger(vmid) || !form.email.trim()) {
      setError('Select a service and enter a team member email address.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.grantTeamAccess({ vmid, email: form.email.trim(), scope: form.scope });
      setNotice(result.message);
      setForm((current) => ({ ...current, email: '' }));
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to add this team member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScopeChange = async (member: ApiTeamAccessMember, scope: ApiTeamAccessScope) => {
    if (member.scope === scope) return;
    setUpdatingId(member.id);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.updateTeamAccess(member.vmid, member.id, scope);
      setNotice(result.message);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update team access.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRevokeMember = async (member: ApiTeamAccessMember) => {
    setRevokingId(member.id);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.revokeTeamAccess(member.vmid, member.id);
      setNotice(result.message);
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Unable to revoke team access.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setRevokingId(invitationId);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.revokeTeamInvitation(invitationId);
      setNotice(result.message);
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Unable to revoke this invitation.');
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <div className={embedded ? 'p-1' : 'app-content p-4 md:p-8'} aria-busy="true">
        <div className="h-10 w-56 rounded bg-[#f1f1f1] animate-pulse" />
        <div className="mt-3 h-5 w-full max-w-xl rounded bg-[#f1f1f1] animate-pulse" />
        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="h-80 rounded-xl border border-[#dedfdf] bg-ink-card animate-pulse" />
          <div className="h-80 rounded-xl border border-[#dedfdf] bg-ink-card animate-pulse" />
        </div>
      </div>
    );
  }

  const activeInvitations = overview?.invitations.filter((invitation) => invitation.isActive) || [];

  return (
    <div className={embedded ? 'team-access-settings' : 'app-content max-w-[1280px] p-4 md:p-8'}>
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#656b6b]">{embedded ? 'Account governance' : 'Client workspace'}</p>
          {embedded ? <h2 className="font-serif text-3xl font-medium tracking-[-0.02em] text-[#1a1a1a]">Team access</h2> : <h1 className="page-heading mb-2">Team access</h1>}
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#656b6b]">Give colleagues only the service access they need. Invitations and every permission change are recorded against your account.</p>
        </div>
        <div className="rounded-lg border border-[#dedfdf] bg-ink-card px-4 py-3 text-xs leading-5 text-[#656b6b]">
          <span className="font-semibold text-[#1a1a1a]">Owner control.</span> You can revoke access immediately at any time.
        </div>
      </header>

      {error && <div role="alert" className="mb-5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">{notice}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <section className="rounded-xl border border-[#dedfdf] bg-ink-card shadow-sm">
          <div className="border-b border-[#dedfdf] px-5 py-5 md:px-6">
            <h2 className="font-serif text-2xl font-medium text-[#1a1a1a]">Add a team member</h2>
            <p className="mt-2 text-sm leading-6 text-[#656b6b]">Existing account holders receive access immediately. New collaborators receive a branded email invitation when SMTP is enabled.</p>
          </div>
          <form onSubmit={handleInvite} className="space-y-5 p-5 md:p-6">
            <div>
              <label htmlFor="team-access-service" className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#1a1a1a]">Service</label>
              <select id="team-access-service" value={form.vmid} onChange={(event) => setForm((current) => ({ ...current, vmid: event.target.value }))} className="w-full rounded-lg border border-[#dedfdf] bg-ink-card px-3 py-2.5 text-sm text-[#1a1a1a] outline-none transition-colors focus:border-[#1a1a1a]" disabled={!overview?.vms.length || submitting}>
                {overview?.vms.length ? overview.vms.map((vm) => <option key={vm.vmid} value={vm.vmid}>{serviceLabel(vm)}</option>) : <option value="">No services available</option>}
              </select>
            </div>
            <div>
              <label htmlFor="team-access-email" className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#1a1a1a]">Team member email</label>
              <input id="team-access-email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="colleague@company.com" className="w-full rounded-lg border border-[#dedfdf] bg-ink-card px-3 py-2.5 text-base text-[#1a1a1a] outline-none transition-colors placeholder:text-[#8b9191] focus:border-[#1a1a1a]" disabled={!overview?.vms.length || submitting} />
            </div>
            <fieldset>
              <legend className="mb-3 block text-xs font-bold uppercase tracking-wide text-[#1a1a1a]">Access level</legend>
              <div className="space-y-2">
                {(Object.keys(scopeDetails) as ApiTeamAccessScope[]).map((scope) => (
                  <label key={scope} className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${form.scope === scope ? 'border-[#1a1a1a] bg-[#f9f8f6]' : 'border-[#dedfdf] hover:border-[#a7aaaa]'}`}>
                    <input type="radio" name="team-access-scope" value={scope} checked={form.scope === scope} onChange={() => setForm((current) => ({ ...current, scope }))} className="mt-1 h-4 w-4 accent-[#1a1a1a]" disabled={submitting} />
                    <span><span className="block text-sm font-semibold text-[#1a1a1a]">{scopeDetails[scope].label}</span><span className="mt-0.5 block text-xs leading-5 text-[#656b6b]">{scopeDetails[scope].description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="btn-primary min-h-11 w-full px-5 disabled:cursor-not-allowed disabled:opacity-60" disabled={!overview?.vms.length || submitting}>{submitting ? 'Adding access…' : 'Grant access'}</button>
          </form>
        </section>

        <section className="rounded-xl border border-[#dedfdf] bg-ink-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#dedfdf] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
            <div><h2 className="font-serif text-2xl font-medium text-[#1a1a1a]">Active access</h2><p className="mt-1 text-sm text-[#656b6b]">Manage every collaborator by service.</p></div>
            <span className="w-fit rounded-full border border-[#dedfdf] px-3 py-1 text-xs font-semibold text-[#656b6b]">{overview?.members.length || 0} active</span>
          </div>
          <div className="divide-y divide-[#dedfdf]">
            {overview?.vms.map((vm) => {
              const members = membersByVm.get(vm.vmid) || [];
              return <div key={vm.vmid} className="p-5 md:p-6">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[#1a1a1a]">{vm.name || 'Service'}</p><p className="font-mono text-[11px] text-[#656b6b]">VM-{vm.vmid}</p></div><span className="text-xs text-[#656b6b]">{members.length} member{members.length === 1 ? '' : 's'}</span></div>
                {members.length === 0 ? <p className="rounded-lg bg-[#f9f8f6] px-3 py-3 text-sm text-[#656b6b]">No delegated access for this service.</p> : <div className="space-y-3">{members.map((member) => <div key={member.id} className="rounded-lg border border-[#dedfdf] p-3 sm:flex sm:items-center sm:gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#1a1a1a]">{member.userName || member.userEmail}</p><p className="truncate text-xs text-[#656b6b]">{member.userEmail}</p></div><div className="mt-3 flex items-center gap-2 sm:mt-0"><select aria-label={`Access level for ${member.userEmail}`} value={member.scope} onChange={(event) => void handleScopeChange(member, event.target.value as ApiTeamAccessScope)} disabled={updatingId === member.id || revokingId === member.id} className="min-h-10 flex-1 rounded-md border border-[#dedfdf] bg-ink-card px-2 text-xs font-semibold text-[#1a1a1a] outline-none focus:border-[#1a1a1a] sm:flex-none">{(Object.keys(scopeDetails) as ApiTeamAccessScope[]).map((scope) => <option key={scope} value={scope}>{scopeDetails[scope].label}</option>)}</select><button type="button" onClick={() => void handleRevokeMember(member)} disabled={updatingId === member.id || revokingId === member.id} className="btn-secondary min-h-10 px-3 text-xs text-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-60">{revokingId === member.id ? 'Revoking…' : 'Revoke'}</button></div></div>)}</div>}
              </div>;
            })}
            {!overview?.vms.length && <div className="p-8 text-center"><h3 className="font-serif text-xl text-[#1a1a1a]">No services available</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#656b6b]">Team access becomes available after a service has been assigned to your account.</p></div>}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-xl border border-[#dedfdf] bg-ink-card shadow-sm">
        <div className="border-b border-[#dedfdf] px-5 py-5 md:px-6"><h2 className="font-serif text-2xl font-medium text-[#1a1a1a]">Pending invitations</h2><p className="mt-1 text-sm text-[#656b6b]">Invitations expire after seven days and activate only when the recipient registers with the invited email address.</p></div>
        {activeInvitations.length === 0 ? <div className="p-6 text-sm text-[#656b6b]">There are no pending team invitations.</div> : <div className="divide-y divide-[#dedfdf]">{activeInvitations.map((invitation) => { const vm = overview?.vms.find((item) => item.vmid === invitation.vmid); return <div key={invitation.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between md:px-6"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#1a1a1a]">{invitation.inviteeEmail}</p><p className="mt-1 text-xs leading-5 text-[#656b6b]">{vm ? serviceLabel(vm) : `VM-${invitation.vmid}`} · {scopeDetails[invitation.scope].label} · Expires {dateFormatter.format(new Date(invitation.expiresAt))}</p></div><button type="button" onClick={() => void handleRevokeInvitation(invitation.id)} disabled={revokingId === invitation.id} className="btn-secondary min-h-10 w-full px-3 text-xs text-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{revokingId === invitation.id ? 'Revoking…' : 'Revoke invitation'}</button></div>; })}</div>}
      </section>
    </div>
  );
};
