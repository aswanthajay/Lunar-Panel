import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiReimageExecution, ApiReimageRequest } from '../services/apiClient';
import { formatDateTime } from '../services/dateTime';

const stateLabels: Record<string, string> = {
  created: 'Created',
  preflight_passed: 'Preflight passed',
  awaiting_confirmation: 'Awaiting confirmation',
  queued: 'Queued',
  processing: 'Processing',
  verifying: 'Verifying',
  awaiting_cutover_confirmation: 'Awaiting cutover confirmation',
  cutover_processing: 'Cutover processing',
  completed: 'Completed',
  failed: 'Failed',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
};

const stateTone: Record<string, string> = {
  created: 'bg-[#f4f5f5] text-[#656b6b]',
  preflight_passed: 'bg-[#e8f2ef] text-[#176b52]',
  awaiting_confirmation: 'bg-[#fff5df] text-[#8b5e00]',
  queued: 'bg-[#eaf0f8] text-[#315d8f]',
  processing: 'bg-[#eaf0f8] text-[#315d8f]',
  verifying: 'bg-[#eaf0f8] text-[#315d8f]',
  awaiting_cutover_confirmation: 'bg-[#fff5df] text-[#8b5e00]',
  cutover_processing: 'bg-[#fbe9e7] text-[#a23d35]',
  completed: 'bg-[#e8f2ef] text-[#176b52]',
  failed: 'bg-[#fbe9e7] text-[#a23d35]',
  blocked: 'bg-[#fbe9e7] text-[#a23d35]',
  cancelled: 'bg-[#f4f5f5] text-[#656b6b]',
};

const formatDate = (value?: string) => value ? formatDateTime(value) : '—';

export const OperatorReimagePanel: React.FC = () => {
  const [requests, setRequests] = useState<ApiReimageRequest[]>([]);
  const [executions, setExecutions] = useState<ApiReimageExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<ApiReimageExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [executionEnabled, setExecutionEnabled] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [approved, history] = await Promise.all([
        apiClient.getOperatorApprovedReimageRequests(),
        apiClient.getOperatorReimageExecutions(),
      ]);
      setRequests(approved);
      setExecutions(history);
      setSelectedExecution(current => current ? history.find(item => item.id === current.id) || current : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the operator console.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const executionByRequest = useMemo(() => new Map(executions.map(execution => [execution.requestId, execution])), [executions]);

  const createExecution = async (request: ApiReimageRequest) => {
    setBusyKey(`create:${request.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.createOperatorReimageExecution(request.id);
      setExecutionEnabled(result.executionEnabled);
      setSelectedExecution(result.execution);
      setNotice(result.message);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create the execution record.');
    } finally {
      setBusyKey(null);
    }
  };

  const runPreflight = async (execution: ApiReimageExecution) => {
    setBusyKey(`preflight:${execution.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.preflightOperatorReimageExecution(execution.id);
      setExecutionEnabled(result.executionEnabled);
      setSelectedExecution(result.execution);
      setNotice(result.message);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Read-only preflight failed.');
    } finally {
      setBusyKey(null);
    }
  };

  const cancelExecution = async (execution: ApiReimageExecution) => {
    if (!window.confirm('Cancel this operator execution before any Proxmox mutation?')) return;
    setBusyKey(`cancel:${execution.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.cancelOperatorReimageExecution(execution.id);
      setSelectedExecution(result.execution);
      setNotice(result.message);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to cancel the execution.');
    } finally {
      setBusyKey(null);
    }
  };

  const confirmExecution = async (execution: ApiReimageExecution) => {
    if (!execution.planHash || !execution.imageProfileVersion) return;
    const phrase = window.prompt(`Type EXECUTE VM-${execution.vmid} REIMAGE to confirm this exact plan.`) || '';
    if (phrase !== `EXECUTE VM-${execution.vmid} REIMAGE`) return;
    setBusyKey(`confirm:${execution.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.confirmOperatorReimageExecution(execution.id, {
        planHash: execution.planHash,
        confirmationPhrase: phrase,
        expectedVmid: execution.vmid,
        expectedImageProfileVersion: execution.imageProfileVersion,
      });
      setExecutionEnabled(result.executionEnabled);
      setSelectedExecution(result.execution);
      setNotice(result.message);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to confirm the execution.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <main className="app-content min-w-0 bg-white px-6 py-6 md:px-8" aria-labelledby="operator-console-title">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-6 flex flex-col gap-4 border-b border-[#dedfdf] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b5e00]">Controlled operations</p>
            <h1 id="operator-console-title" className="text-[26px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">Operator reimage console</h1>
            <p className="mt-2 max-w-[720px] text-[14px] leading-6 text-[#656b6b]">Prepare approved OS reimage requests through a read-only preflight and an immutable execution plan. This console does not execute Proxmox operations unless the server policy explicitly enables the separate worker.</p>
          </div>
          <button type="button" onClick={refresh} disabled={loading} className="inline-flex h-9 items-center justify-center rounded border border-[#c9cccc] px-3 text-[13px] font-medium text-[#1a1a1a] transition hover:bg-[#f4f5f5] disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh queue'}</button>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded border border-[#dedfdf] bg-[#fbfbfb] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a9090]">Approved requests</p><p className="mt-2 text-2xl font-semibold text-[#1a1a1a]">{requests.length}</p></div>
          <div className="rounded border border-[#dedfdf] bg-[#fbfbfb] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a9090]">My execution records</p><p className="mt-2 text-2xl font-semibold text-[#1a1a1a]">{executions.length}</p></div>
          <div className="rounded border border-[#dedfdf] bg-[#fbfbfb] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a9090]">Mutation policy</p><p className="mt-2 text-[14px] font-semibold text-[#a23d35]">{executionEnabled ? 'Enabled by server policy' : 'Disabled by default'}</p></div>
        </div>

        {error && <div className="mb-4 rounded border border-[#e4b5b0] bg-[#fff7f6] px-4 py-3 text-[13px] leading-5 text-[#8d3028]" role="alert">{error}</div>}
        {notice && <div className="mb-4 rounded border border-[#b7d8ca] bg-[#f4fbf7] px-4 py-3 text-[13px] leading-5 text-[#176b52]" role="status">{notice}</div>}

        <section className="rounded border border-[#dedfdf] bg-white" aria-labelledby="approved-requests-title">
          <div className="flex items-center justify-between border-b border-[#dedfdf] px-5 py-4"><div><h2 id="approved-requests-title" className="text-[15px] font-semibold text-[#1a1a1a]">Approved requests</h2><p className="mt-1 text-[12px] text-[#8a9090]">Only requests already approved by an administrator appear here.</p></div></div>
          {loading ? <div className="space-y-3 p-5" aria-busy="true"><div className="h-16 animate-pulse rounded bg-[#f4f5f5]" /><div className="h-16 animate-pulse rounded bg-[#f4f5f5]" /></div> : requests.length === 0 ? <div className="px-5 py-10 text-center"><p className="text-[14px] font-medium text-[#1a1a1a]">No approved requests are ready for operator preparation.</p><p className="mt-1 text-[13px] text-[#656b6b]">Creating an approved request execution record never contacts Proxmox.</p></div> : <div className="divide-y divide-[#ededed]">{requests.map(request => {
            const execution = executionByRequest.get(request.id);
            return <div key={request.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[14px] font-semibold text-[#1a1a1a]">VM-{request.vmid} {request.vmName ? `· ${request.vmName}` : ''}</p><span className="rounded bg-[#e8f2ef] px-2 py-0.5 text-[11px] font-semibold text-[#176b52]">Approved</span></div><p className="mt-1 text-[12px] text-[#656b6b]">{request.vmType?.toUpperCase() || 'VM'} · {request.requestedOs} · requested by {request.requesterEmail}</p><p className="mt-1 text-[11px] text-[#8a9090]">Approved {formatDate(request.reviewedAt)}</p></div>
              <div className="flex flex-wrap items-center gap-2">{execution ? <><span className={`rounded px-2.5 py-1 text-[11px] font-semibold ${stateTone[execution.state] || stateTone.created}`}>{stateLabels[execution.state] || execution.state}</span><button type="button" onClick={() => setSelectedExecution(execution)} className="h-8 rounded border border-[#c9cccc] px-3 text-[12px] font-medium text-[#1a1a1a] hover:bg-[#f4f5f5]">View plan</button></> : <button type="button" onClick={() => createExecution(request)} disabled={busyKey !== null} className="h-8 rounded bg-[#1a1a1a] px-3 text-[12px] font-semibold text-white hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50">{busyKey === `create:${request.id}` ? 'Preparing…' : 'Prepare execution'}</button>}</div>
            </div>;
          })}</div>}
        </section>

        <section className="mt-6 rounded border border-[#dedfdf] bg-white" aria-labelledby="execution-history-title">
          <div className="border-b border-[#dedfdf] px-5 py-4"><h2 id="execution-history-title" className="text-[15px] font-semibold text-[#1a1a1a]">Execution history</h2><p className="mt-1 text-[12px] text-[#8a9090]">All state changes are persisted separately from the approval record.</p></div>
          {executions.length === 0 ? <div className="px-5 py-8 text-center text-[13px] text-[#656b6b]">No execution records have been created.</div> : <div className="divide-y divide-[#ededed]">{executions.map(execution => <div key={execution.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[13px] font-semibold text-[#1a1a1a]">VM-{execution.vmid} · {execution.requestedOs || 'OS reimage'}</p><p className="mt-1 text-[11px] text-[#8a9090]">{execution.id} · updated {formatDate(execution.updatedAt)}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded px-2.5 py-1 text-[11px] font-semibold ${stateTone[execution.state] || stateTone.created}`}>{stateLabels[execution.state] || execution.state}</span><button type="button" onClick={() => setSelectedExecution(execution)} className="h-8 rounded border border-[#c9cccc] px-3 text-[12px] font-medium text-[#1a1a1a] hover:bg-[#f4f5f5]">View details</button></div></div>)}</div>}
        </section>
      </div>

      {selectedExecution && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="execution-plan-title"><div className="max-h-[90vh] w-full max-w-[680px] overflow-y-auto rounded border border-[#dedfdf] bg-white shadow-xl"><div className="flex items-start justify-between border-b border-[#dedfdf] px-5 py-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b5e00]">Execution record</p><h2 id="execution-plan-title" className="mt-1 text-[17px] font-semibold text-[#1a1a1a]">VM-{selectedExecution.vmid} · {selectedExecution.requestedOs || 'OS reimage'}</h2></div><button type="button" onClick={() => setSelectedExecution(null)} className="text-xl leading-none text-[#656b6b] hover:text-[#1a1a1a]" aria-label="Close execution details">×</button></div><div className="space-y-4 px-5 py-5"><div className="rounded border border-[#e4b5b0] bg-[#fff7f6] px-4 py-3 text-[12px] leading-5 text-[#8d3028]"><strong>Safety boundary:</strong> this workflow does not erase disks or invoke Proxmox automatically. Confirmation is blocked while server execution policy is disabled.</div><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-[11px] uppercase tracking-[0.1em] text-[#8a9090]">State</p><p className="mt-1 text-[13px] font-semibold text-[#1a1a1a]">{stateLabels[selectedExecution.state] || selectedExecution.state}</p></div><div><p className="text-[11px] uppercase tracking-[0.1em] text-[#8a9090]">Image profile</p><p className="mt-1 text-[13px] font-semibold text-[#1a1a1a]">{selectedExecution.imageProfileVersion || 'Not configured'}</p></div><div><p className="text-[11px] uppercase tracking-[0.1em] text-[#8a9090]">Plan hash</p><p className="mt-1 break-all font-mono text-[11px] text-[#656b6b]">{selectedExecution.planHash || 'Not available'}</p></div><div><p className="text-[11px] uppercase tracking-[0.1em] text-[#8a9090]">Backup reference</p><p className="mt-1 text-[13px] font-semibold text-[#1a1a1a]">{selectedExecution.backupReference || 'Required before preflight'}</p></div></div>{selectedExecution.errorMessage && <div className="rounded border border-[#e4b5b0] bg-[#fff7f6] px-4 py-3 text-[12px] text-[#8d3028]"><strong>{selectedExecution.errorCode || 'Execution blocked'}:</strong> {selectedExecution.errorMessage}</div>}<div className="flex flex-wrap justify-end gap-2 border-t border-[#ededed] pt-4">{['created', 'preflight_passed'].includes(selectedExecution.state) && <button type="button" onClick={() => runPreflight(selectedExecution)} disabled={busyKey !== null} className="h-9 rounded border border-[#1a1a1a] px-3 text-[12px] font-semibold text-[#1a1a1a] hover:bg-[#f4f5f5] disabled:opacity-50">{busyKey === `preflight:${selectedExecution.id}` ? 'Checking…' : 'Run read-only preflight'}</button>}{selectedExecution.state === 'awaiting_confirmation' && <button type="button" onClick={() => confirmExecution(selectedExecution)} disabled={busyKey !== null || !executionEnabled} className="h-9 rounded bg-[#a23d35] px-3 text-[12px] font-semibold text-white hover:bg-[#8d3028] disabled:cursor-not-allowed disabled:opacity-50">Confirm execution</button>}{['created', 'preflight_passed', 'awaiting_confirmation', 'queued'].includes(selectedExecution.state) && <button type="button" onClick={() => cancelExecution(selectedExecution)} disabled={busyKey !== null} className="h-9 rounded border border-[#c9cccc] px-3 text-[12px] font-semibold text-[#656b6b] hover:bg-[#f4f5f5] disabled:opacity-50">Cancel safely</button>}</div></div></div></div>}
    </main>
  );
};

export default OperatorReimagePanel;
