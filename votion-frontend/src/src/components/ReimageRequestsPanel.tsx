import React, { useEffect, useState } from 'react';
import { apiClient, ApiReimageRequest } from '../services/apiClient';

type ReviewDecision = 'approved' | 'rejected';
type QueueFilter = 'all' | ApiReimageRequest['status'];

const statusClass: Record<ApiReimageRequest['status'], string> = {
  pending: 'border-[#f0c36d] bg-[#fffaf0] text-[#7a4b00]',
  approved: 'border-[#b7dfcf] bg-[#f1fbf7] text-[#146c4a]',
  completed: 'border-[#bfd7f1] bg-[#f4f8fd] text-[#245b91]',
  rejected: 'border-[#f0c6c2] bg-[#fff5f4] text-[#8f1d14]',
  cancelled: 'border-[#dedfdf] bg-[#f7f7f6] text-[#656b6b]',
};

export const ReimageRequestsPanel: React.FC = () => {
  const [requests, setRequests] = useState<ApiReimageRequest[]>([]);
  const [filter, setFilter] = useState<QueueFilter>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ request: ApiReimageRequest; decision: ReviewDecision } | null>(null);
  const [reviewerNote, setReviewerNote] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [completionTarget, setCompletionTarget] = useState<ApiReimageRequest | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getAdminReimageRequests(filter === 'all' ? undefined : filter);
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the reimage approval queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [filter]);

  const openReview = (request: ApiReimageRequest, decision: ReviewDecision) => {
    setReviewerNote('');
    setReviewTarget({ request, decision });
  };

  const openCompletion = (request: ApiReimageRequest) => {
    setCompletionTarget(request);
    setCompletionNote('');
  };

  const submitCompletion = async () => {
    if (!completionTarget || isCompleting) return;
    setIsCompleting(true);
    try {
      const result = await apiClient.completeAdminReimageRequest(completionTarget.id, completionNote);
      setRequests(prev => prev.map(request => request.id === result.data.id ? result.data : request));
      setCompletionTarget(null);
      setCompletionNote('');
      setNotice(result.message);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to complete the reimage request.');
    } finally {
      setIsCompleting(false);
    }
  };

  const submitReview = async () => {
    if (!reviewTarget || isReviewing) return;
    setIsReviewing(true);
    try {
      const result = await apiClient.reviewAdminReimageRequest(reviewTarget.request.id, reviewTarget.decision, reviewerNote);
      setRequests(prev => prev.map(request => request.id === result.data.id ? result.data : request));
      setReviewTarget(null);
      setReviewerNote('');
      setNotice(result.message);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to review the reimage request.');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <main className="app-content p-3 sm:p-5 md:p-8 max-w-[1400px] mx-auto min-h-[calc(100vh-120px)]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#656b6b]">Operations governance</p>
          <h1 className="mt-1 text-3xl font-normal text-[#1a1a1a]">OS reimage requests</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#656b6b]">
            Review client requests, perform approved OS changes manually in Proxmox, then record completion here. This workflow never performs automated reimaging.
          </p>
        </div>
        <button type="button" onClick={() => void loadRequests()} className="rounded border border-[#dedfdf] px-3 py-2 text-xs font-semibold text-[#1a1a1a] hover:bg-[#fbfaf9] cursor-pointer">
          Refresh queue
        </button>
      </div>

      {notice && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-[#b7dfcf] bg-[#f1fbf7] p-3 text-xs font-semibold text-[#146c4a]" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="ml-4 text-[#146c4a] cursor-pointer" aria-label="Dismiss notification">×</button>
        </div>
      )}

      <section className="rounded-xl border border-[#dedfdf] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dedfdf] p-4">
          <div>
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Approval queue</h2>
            <p className="mt-1 text-xs text-[#656b6b]">Requests are retained with requester, reviewer, and timestamp audit data.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#1a1a1a]">
            Status
            <select value={filter} onChange={event => setFilter(event.target.value as QueueFilter)} className="rounded border border-[#dedfdf] bg-white px-2.5 py-2 text-xs font-normal outline-none focus:border-[#1a1a1a]">
              <option value="pending">Pending</option>
              <option value="all">All requests</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5" aria-busy="true">
            <div className="h-16 animate-pulse rounded-lg bg-[#f3f4f4]" />
            <div className="h-16 animate-pulse rounded-lg bg-[#f3f4f4]" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-[#8f1d14]">
            <p>{error}</p>
            <button type="button" onClick={() => void loadRequests()} className="mt-3 font-semibold underline underline-offset-2 cursor-pointer">Try again</button>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#1a1a1a]">No {filter === 'all' ? '' : filter} reimage requests</p>
            <p className="mt-1 text-xs text-[#656b6b]">The approval queue is clear for the selected status.</p>
          </div>
        ) : (
          <div className="responsive-table-container">
            <table className="w-full min-w-[840px] text-left text-xs">
              <thead className="border-b border-[#dedfdf] bg-[#fbfaf9] text-[11px] uppercase tracking-[0.08em] text-[#656b6b]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Request</th>
                  <th className="px-4 py-3 font-semibold">Instance</th>
                  <th className="px-4 py-3 font-semibold">Requester</th>
                  <th className="px-4 py-3 font-semibold">Requested image</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request.id} className="border-b border-[#dedfdf] last:border-b-0">
                    <td className="px-4 py-4 align-top">
                      <div className="font-mono text-[11px] text-[#1a1a1a]">{request.id}</div>
                      <div className="mt-1 text-[#656b6b]">{new Date(request.createdAt).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-[#1a1a1a]">VM-{request.vmid} · {request.vmName || 'Unnamed instance'}</div>
                      <div className="mt-1 uppercase text-[#656b6b]">{request.vmType || 'VM'}</div>
                    </td>
                    <td className="px-4 py-4 align-top text-[#1a1a1a]">{request.requesterEmail}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-[#1a1a1a]">{request.requestedOs}</div>
                      {request.requesterNote && <div className="mt-1 max-w-[220px] leading-5 text-[#656b6b]">{request.requesterNote}</div>}
                    </td>
                    <td className="px-4 py-4 align-top"><span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold capitalize ${statusClass[request.status]}`}>{request.status}</span></td>
                    <td className="px-4 py-4 text-right align-top">
                      {request.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openReview(request, 'rejected')} className="rounded border border-[#f0c6c2] px-2.5 py-1.5 font-semibold text-[#8f1d14] hover:bg-[#fff5f4] cursor-pointer">Reject</button>
                          <button type="button" onClick={() => openReview(request, 'approved')} className="rounded bg-[#1a1a1a] px-2.5 py-1.5 font-semibold text-white hover:bg-black cursor-pointer">Approve</button>
                        </div>
                      ) : request.status === 'approved' ? (
                        <button type="button" onClick={() => openCompletion(request)} className="rounded bg-[#1a1a1a] px-2.5 py-1.5 font-semibold text-white hover:bg-black cursor-pointer">Mark completed</button>
                      ) : request.status === 'completed' ? (
                        <div className="max-w-[220px] text-left text-[#656b6b]">
                          <span className="font-semibold text-[#245b91]">Manual change recorded</span>
                          {request.completionNote && <p className="mt-1 leading-5">{request.completionNote}</p>}
                        </div>
                      ) : (
                        <span className="text-[#656b6b]">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {completionTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a1a1a]/45 p-4" role="presentation">
          <div className="w-full max-w-md rounded-xl border border-[#dedfdf] bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="complete-reimage-title">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#656b6b]">Manual completion</p>
            <h2 id="complete-reimage-title" className="mt-2 text-lg font-semibold text-[#1a1a1a]">Record OS change completed?</h2>
            <p className="mt-3 text-sm leading-6 text-[#656b6b]">Confirm that an administrator manually changed the OS for <span className="font-semibold text-[#1a1a1a]">VM-{completionTarget.vmid}</span> in Proxmox.</p>
            <div className="mt-4 rounded-lg border border-[#bfd7f1] bg-[#f4f8fd] p-3 text-xs leading-5 text-[#245b91]">This updates the panel record and audit trail only. It does not contact Proxmox or perform an automated reimage.</div>
            <label className="mt-4 block text-xs font-semibold text-[#1a1a1a]" htmlFor="completion-note">Completion note <span className="font-normal text-[#656b6b]">(optional)</span></label>
            <textarea id="completion-note" value={completionNote} onChange={event => setCompletionNote(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full resize-y rounded border border-[#dedfdf] p-2.5 text-xs outline-none focus:border-[#1a1a1a]" placeholder="Record the manual change, image version, and verification details." />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCompletionTarget(null)} disabled={isCompleting} className="rounded border border-[#dedfdf] px-4 py-2 text-xs font-semibold text-[#1a1a1a] hover:bg-[#fbfaf9] cursor-pointer disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void submitCompletion()} disabled={isCompleting} className="rounded bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-white hover:bg-black cursor-pointer disabled:opacity-50">{isCompleting ? 'Saving…' : 'Mark completed'}</button>
            </div>
          </div>
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a1a1a]/45 p-4" role="presentation">
          <div className="w-full max-w-md rounded-xl border border-[#dedfdf] bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="review-reimage-title">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#656b6b]">Administrator review</p>
            <h2 id="review-reimage-title" className="mt-2 text-lg font-semibold text-[#1a1a1a]">{reviewTarget.decision === 'approved' ? 'Approve' : 'Reject'} request?</h2>
            <p className="mt-3 text-sm leading-6 text-[#656b6b]">
              {reviewTarget.request.id} requests <span className="font-semibold text-[#1a1a1a]">{reviewTarget.request.requestedOs}</span> for VM-{reviewTarget.request.vmid}.
            </p>
            <div className="mt-4 rounded-lg border border-[#f0c36d] bg-[#fffaf0] p-3 text-xs leading-5 text-[#7a4b00]">
              {reviewTarget.decision === 'approved'
                ? 'Approval records authorization for a separate operator step. It does not contact Proxmox, alter the VM, or start a reimage.'
                : 'Rejection records the decision. No Proxmox operation will be performed.'}
            </div>
            <label className="mt-4 block text-xs font-semibold text-[#1a1a1a]" htmlFor="reviewer-note">Reviewer note <span className="font-normal text-[#656b6b]">(optional)</span></label>
            <textarea id="reviewer-note" value={reviewerNote} onChange={event => setReviewerNote(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full resize-y rounded border border-[#dedfdf] p-2.5 text-xs outline-none focus:border-[#1a1a1a]" placeholder="Record the rationale or next-step context." />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setReviewTarget(null)} disabled={isReviewing} className="rounded border border-[#dedfdf] px-4 py-2 text-xs font-semibold text-[#1a1a1a] hover:bg-[#fbfaf9] cursor-pointer disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void submitReview()} disabled={isReviewing} className={`rounded px-4 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 ${reviewTarget.decision === 'approved' ? 'bg-[#1a1a1a] hover:bg-black' : 'bg-[#8f1d14] hover:bg-[#75160f]'}`}>
                {isReviewing ? 'Saving…' : reviewTarget.decision === 'approved' ? 'Approve request' : 'Reject request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default ReimageRequestsPanel;
