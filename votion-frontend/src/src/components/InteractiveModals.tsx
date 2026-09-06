import React, { useState, useEffect } from 'react';
import { apiClient, ApiPricingPlan, ApiSupportTicket, ApiTicketReply, ApiSupportAgent, SupportTicketPriority, SupportTicketStatus } from '../services/apiClient';

const formatPlanPrice = (plan: ApiPricingPlan) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: plan.currency,
  maximumFractionDigits: 2,
}).format(plan.monthlyPriceCents / 100);

const formatCapacity = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

interface InteractiveModalsProps {
  activeModal: string | null;
  onClose: () => void;
  userRole: 'admin' | 'client';
}

export const InteractiveModals: React.FC<InteractiveModalsProps> = ({ activeModal, onClose, userRole }) => {
  const [modalData, setModalData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalRetry, setModalRetry] = useState(0);
  
  // Support Center Specific State
  const [ticketsList, setTicketsList] = useState<ApiSupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ApiSupportTicket | null>(null);
  const [ticketReplies, setTicketReplies] = useState<ApiTicketReply[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'details'>('list');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState('all');
  const [ticketAssignmentFilter, setTicketAssignmentFilter] = useState('all');
  const [supportAgents, setSupportAgents] = useState<ApiSupportAgent[]>([]);
  const [isUpdatingTicketMeta, setIsUpdatingTicketMeta] = useState(false);
  const [upgradePlanId, setUpgradePlanId] = useState<string | null>(null);

  // New Ticket Form State
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Quota Upgrade');
  const [ticketPriority, setTicketPriority] = useState<SupportTicketPriority>('medium');
  const [ticketInitialMessage, setTicketInitialMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (!activeModal) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [activeModal, onClose]);

  const loadTickets = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const tickets = await apiClient.getSupportTickets();
      setTicketsList(tickets);
      if (userRole === 'admin') {
        const agents = await apiClient.getSupportAgents().catch(() => []);
        setSupportAgents(agents);
      }
    } catch (err) {
      setTicketsList([]);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to load support tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeModal) {
      setModalData(null);
      setModalError(null);
      setSelectedTicket(null);
      setUpgradePlanId(null);
      setViewMode('list');
      setErrorMessage(null);
      return;
    }

    const fetchModalData = async () => {
      setLoading(true);
      setModalError(null);
      try {
        if (activeModal === 'downloads') {
          const res = await apiClient.getDownloads();
          setModalData(res);
        } else if (activeModal === 'dataroom') {
          const res = await apiClient.getDataRoom();
          setModalData(res);
        } else if (activeModal === 'pricing' || activeModal === 'upgrade') {
          const res = await apiClient.getPricing();
          setModalData(res);
        } else if (activeModal === 'release-notes') {
          const res = await apiClient.getReleaseNotes();
          setModalData(res);
        } else if (activeModal === 'terms') {
          const res = await apiClient.getTerms();
          setModalData(res);
        } else if (activeModal === 'inbox' || activeModal === 'support' || activeModal === 'help') {
          await loadTickets();
        }
      } catch (err) {
        setModalError(err instanceof Error ? err.message : 'Unable to load this menu right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchModalData();
  }, [activeModal, userRole, modalRetry]);

  if (!activeModal) return null;

  // Inspect Ticket Details & Thread
  const handleSelectTicket = async (ticket: ApiSupportTicket) => {
    setSelectedTicket(ticket);
    setLoading(true);
    setErrorMessage(null);
    try {
      const details = await apiClient.getTicketDetails(ticket.id);
      if (details) {
        await apiClient.markTicketRead(ticket.id).catch(() => undefined);
        setTicketsList(previous => previous.map(item => item.id === ticket.id ? { ...item, unread: false } : item));
        setTicketReplies(details.replies);
        setViewMode('details');
      } else {
        throw new Error('Unable to load this support ticket.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to load this support ticket.');
    } finally {
      setLoading(false);
    }
  };

  // Submit New Support Ticket
  const handleSupportTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim()) {
      setErrorMessage('Ticket subject is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.createSupportTicket(ticketSubject.trim(), ticketCategory, ticketPriority, undefined, ticketInitialMessage.trim() || undefined);
      showToast(res.message || 'Support ticket created successfully.');
      setTicketSubject('');
      setTicketInitialMessage('');
      setViewMode('list');
      await loadTickets();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to create the support ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send Reply Message to Ticket
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) {
      setErrorMessage('Reply message cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.addTicketReply(selectedTicket.id, replyMessage.trim());
      if (!res.data) throw new Error('The reply was not returned by the server.');
      setTicketReplies(previous => [...previous, res.data]);
      setSelectedTicket(previous => previous ? { ...previous, status: userRole === 'admin' ? 'replied' : 'open', unread: false } : previous);
      setReplyMessage('');
      showToast('Reply posted to support thread');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to post the reply.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Ticket Status
  const handleUpdateStatus = async (status: SupportTicketStatus) => {
    if (!selectedTicket) return;
    setIsUpdatingStatus(true);
    setErrorMessage(null);
    try {
      await apiClient.updateTicketStatus(selectedTicket.id, status);
      setSelectedTicket(previous => previous ? { ...previous, status } : previous);
      setTicketsList(previous => previous.map(item => item.id === selectedTicket.id ? { ...item, status } : item));
      showToast(`Ticket status updated to ${status}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to update ticket status.');
    } finally {
      setIsUpdatingStatus(false);
    }
    };

  const handleUpdatePriority = async (priority: SupportTicketPriority) => {
    if (!selectedTicket || userRole !== 'admin') return;
    setIsUpdatingTicketMeta(true);
    setErrorMessage(null);
    try {
      await apiClient.updateTicketPriority(selectedTicket.id, priority);
      setSelectedTicket(previous => previous ? { ...previous, priority } : previous);
      setTicketsList(previous => previous.map(item => item.id === selectedTicket.id ? { ...item, priority } : item));
      showToast(`Priority updated to ${priority}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to update ticket priority.');
    } finally {
      setIsUpdatingTicketMeta(false);
    }
  };

  const handleAssignTicket = async (assigneeEmail: string | null) => {
    if (!selectedTicket || userRole !== 'admin') return;
    setIsUpdatingTicketMeta(true);
    setErrorMessage(null);
    try {
      await apiClient.assignTicket(selectedTicket.id, assigneeEmail);
      setSelectedTicket(previous => previous ? { ...previous, assignedTo: assigneeEmail } : previous);
      setTicketsList(previous => previous.map(item => item.id === selectedTicket.id ? { ...item, assignedTo: assigneeEmail } : item));
      showToast(assigneeEmail ? `Assigned to ${assigneeEmail}` : 'Ticket moved to the unassigned queue');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to update ticket assignment.');
    } finally {
      setIsUpdatingTicketMeta(false);
    }
  };

  const filteredTickets = ticketsList.filter(ticket => {
    const query = ticketSearch.trim().toLowerCase();
    const matchesSearch = !query || [ticket.id, ticket.subject, ticket.category, ticket.userEmail || ''].some(value => value.toLowerCase().includes(query));
    const matchesStatus = ticketStatusFilter === 'all' || ticket.status === ticketStatusFilter;
    const matchesPriority = ticketPriorityFilter === 'all' || ticket.priority === ticketPriorityFilter;
    const matchesAssignment = ticketAssignmentFilter === 'all' || (ticketAssignmentFilter === 'unassigned' ? !ticket.assignedTo : ticket.assignedTo === ticketAssignmentFilter);
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignment;
  });

  const openTicketCount = ticketsList.filter(ticket => ['open', 'in-progress', 'replied'].includes(ticket.status)).length;
  const unreadTicketCount = ticketsList.filter(ticket => ticket.unread).length;
  const pricingPlans = Array.isArray(modalData)
    ? (modalData as ApiPricingPlan[]).filter(plan => plan.isActive)
    : [];

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6 cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      
      {/* Toast Notification inside Modal */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 p-3 bg-[#1a1a1a] text-white text-xs font-semibold rounded-lg shadow-2xl flex items-center gap-2 border border-[#333333] z-[1100]">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div 
        className="w-full max-w-[660px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl overflow-hidden p-6 flex flex-col gap-4 text-xs cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#dedfdf] pb-3">
          <h3 className="text-base font-bold text-[#1a1a1a] capitalize flex items-center gap-2">
            <span>{activeModal.replace('-', ' ')}</span>
            {(activeModal === 'inbox' || activeModal === 'support' || activeModal === 'help') && viewMode !== 'list' && (
              <button onClick={() => setViewMode('list')} className="text-xs text-[#2563eb] hover:underline font-normal">
                ← Back to tickets list
              </button>
            )}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-[#656b6b] hover:text-[#1a1a1a] font-bold text-sm cursor-pointer">
            ✕
          </button>
        </div>

        {errorMessage && (
          <div role="alert" className="border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#991b1b]">
            {errorMessage}
          </div>
        )}

        {modalError ? (
          <div className="modal-data-error" role="alert">
            <div>
              <p className="modal-data-error-title">Unable to load {activeModal === 'downloads' ? 'downloads' : 'upgrade plans'}</p>
              <p className="modal-data-error-detail">{modalError}</p>
            </div>
            <button type="button" className="btn-secondary modal-data-retry" onClick={() => setModalRetry(value => value + 1)}>Retry</button>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-[#656b6b] font-mono">
            Fetching dynamic API data from Express server...
          </div>
        ) : (
          <>
            {/* SUPPORT CENTER MODAL */}
            {(activeModal === 'inbox' || activeModal === 'support' || activeModal === 'help') && (
              <div className="flex flex-col gap-4">
                
                {/* TICKET QUEUE / CLIENT INBOX */}
                {viewMode === 'list' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[#1a1a1a]">{activeModal === 'inbox' ? 'Your support conversations' : userRole === 'admin' ? 'Support operations queue' : 'Direct support with Votion engineers'}</p>
                        <p className="mt-1 text-[#656b6b]">{activeModal === 'inbox' ? 'Review replies, respond to open conversations, and keep your requests moving.' : userRole === 'admin' ? 'Prioritize, assign, resolve, and reply to every customer conversation from one queue.' : 'Open a request and continue the conversation from this inbox.'}</p>
                      </div>
                      <button type="button" onClick={() => setViewMode('create')} className="btn-primary shrink-0 py-1.5 px-3 text-xs cursor-pointer">New ticket</button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-[#dedfdf] bg-[#fbfaf9] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.12em] text-[#656b6b]">Total</div><div className="mt-1 text-base font-bold text-[#1a1a1a]">{ticketsList.length}</div></div>
                      <div className="rounded-lg border border-[#dedfdf] bg-[#fbfaf9] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.12em] text-[#656b6b]">Open</div><div className="mt-1 text-base font-bold text-[#1a1a1a]">{openTicketCount}</div></div>
                      <div className="rounded-lg border border-[#dedfdf] bg-[#fbfaf9] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.12em] text-[#656b6b]">Needs attention</div><div className="mt-1 text-base font-bold text-[#1a1a1a]">{unreadTicketCount}</div></div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
                      <input type="search" value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} placeholder="Search ticket, subject, customer…" className="w-full rounded-lg border border-[#dedfdf] bg-ink-card px-3 py-2 text-xs outline-none focus:border-[#2563eb]" />
                      <select value={ticketStatusFilter} onChange={(e) => setTicketStatusFilter(e.target.value)} className="rounded-lg border border-[#dedfdf] bg-ink-card px-3 py-2 text-xs outline-none"><option value="all">All statuses</option><option value="open">Open</option><option value="in-progress">In progress</option><option value="replied">Replied</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
                      <select value={ticketPriorityFilter} onChange={(e) => setTicketPriorityFilter(e.target.value)} className="rounded-lg border border-[#dedfdf] bg-ink-card px-3 py-2 text-xs outline-none"><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
                      {userRole === 'admin' ? <select value={ticketAssignmentFilter} onChange={(e) => setTicketAssignmentFilter(e.target.value)} className="rounded-lg border border-[#dedfdf] bg-ink-card px-3 py-2 text-xs outline-none"><option value="all">All assignees</option><option value="unassigned">Unassigned</option>{supportAgents.map(agent => <option key={agent.email} value={agent.email}>{agent.name || agent.email}</option>)}</select> : <div className="hidden md:block" />}
                    </div>

                    <div className="divide-y divide-[#dedfdf] overflow-hidden rounded-lg border border-[#dedfdf] max-h-[390px] overflow-y-auto">
                      {loading ? <div className="space-y-3 p-5" aria-busy="true"><div className="h-4 w-2/3 animate-pulse rounded bg-[#f1f1f1]" /><div className="h-4 w-full animate-pulse rounded bg-[#f1f1f1]" /><div className="h-4 w-4/5 animate-pulse rounded bg-[#f1f1f1]" /></div> : filteredTickets.length === 0 ? <div className="p-8 text-center"><p className="font-semibold text-[#1a1a1a]">{ticketsList.length === 0 ? 'No support conversations yet' : 'No tickets match these filters'}</p><p className="mt-1 text-[#656b6b]">{ticketsList.length === 0 ? 'Create a ticket to start a documented support thread.' : 'Adjust the filters or search term to see more results.'}</p></div> : filteredTickets.map(ticket => (
                        <button type="button" key={ticket.id} onClick={() => handleSelectTicket(ticket)} className={`flex w-full items-start justify-between gap-3 p-3.5 text-left transition-colors hover:bg-[#fbfaf9] ${ticket.unread ? 'bg-[#f7fbff]' : ''}`}>
                          <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-mono text-[10px] font-bold text-[#656b6b]">{ticket.ticket_number || ticket.id}</span>{ticket.unread && <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" aria-label="Unread" />}<span className="truncate font-semibold text-[#1a1a1a]">{ticket.subject}</span></span><span className="mt-1 block truncate text-[11px] text-[#656b6b]">{userRole === 'admin' ? (ticket.userName ? `${ticket.userName} · ${ticket.userEmail}` : ticket.userEmail) : ticket.category}{ticket.vmid ? ` · VM ${ticket.vmid}${ticket.linkedVmName ? ` (${ticket.linkedVmName})` : ''}` : ''} · {ticket.replyCount || 0} repl{ticket.replyCount === 1 ? 'y' : 'ies'}</span></span>
                          <span className="flex shrink-0 flex-col items-end gap-1"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${ticket.priority === 'urgent' ? 'bg-[#fef2f2] text-[#dc2626]' : ticket.priority === 'high' ? 'bg-[#fff7ed] text-[#c2410c]' : 'bg-[#f1f1f1] text-[#656b6b]'}`}>{ticket.priority}</span><span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${ticket.status === 'open' ? 'bg-[#fef3c7] text-[#b45309]' : ticket.status === 'in-progress' ? 'bg-[#dbeafe] text-[#1d4ed8]' : ticket.status === 'replied' ? 'bg-[#e0e7ff] text-[#4338ca]' : 'bg-[#dcfce7] text-[#15803d]'}`}>{ticket.status}</span></span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* CREATE NEW TICKET */}
                {viewMode === 'create' && (
                  <form onSubmit={handleSupportTicketSubmit} className="flex flex-col gap-3">
                    <div><p className="font-semibold text-[#1a1a1a]">Open a support ticket</p><p className="mt-1 text-[#656b6b]">Give the operations team enough context to resolve the request without back-and-forth.</p></div>
                    <div><label className="mb-1 block font-semibold">Subject</label><input type="text" value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} placeholder="Describe the request in one line" className="w-full rounded-lg border border-[#dedfdf] bg-ink-card p-2.5 outline-none focus:border-[#2563eb]" required maxLength={255} /></div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><div><label className="mb-1 block font-semibold">Category</label><select value={ticketCategory} onChange={(e) => setTicketCategory(e.target.value)} className="w-full rounded-lg border border-[#dedfdf] bg-ink-card p-2.5 outline-none"><option value="Quota Upgrade">Quota upgrade</option><option value="Network Firewall">Network & firewall</option><option value="Storage & ZFS">Storage & ZFS</option><option value="Billing">Billing</option><option value="General">General inquiry</option></select></div><div><label className="mb-1 block font-semibold">Priority</label><select value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value as SupportTicketPriority)} className="w-full rounded-lg border border-[#dedfdf] bg-ink-card p-2.5 outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div></div>
                    <div><label className="mb-1 block font-semibold">Message</label><textarea value={ticketInitialMessage} onChange={(e) => setTicketInitialMessage(e.target.value)} placeholder="Include relevant instance IDs, symptoms, and the outcome you need." className="min-h-28 w-full resize-y rounded-lg border border-[#dedfdf] bg-ink-card p-2.5 outline-none focus:border-[#2563eb]" required maxLength={5000} /></div>
                    <div className="flex justify-end gap-2 border-t border-[#dedfdf] pt-3"><button type="button" onClick={() => setViewMode('list')} className="btn-secondary">Cancel</button><button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-50">{isSubmitting ? 'Creating ticket…' : 'Create ticket'}</button></div>
                  </form>
                )}

                {/* TICKET DETAILS & THREAD */}
                {viewMode === 'details' && selectedTicket && (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-[#dedfdf] bg-[#fbfaf9] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[#1a1a1a]">{selectedTicket.ticket_number || selectedTicket.id} — {selectedTicket.subject}</div>
                          <div className="mt-1 text-[11px] text-[#656b6b]">
                            <span>Category: {selectedTicket.category}</span>
                            {selectedTicket.userEmail && <span> · Customer: <strong className="text-[#1a1a1a]">{selectedTicket.userName ? `${selectedTicket.userName} (${selectedTicket.userEmail})` : selectedTicket.userEmail}</strong></span>}
                            {selectedTicket.vmid && <span> · Linked VM: <strong>VM {selectedTicket.vmid}</strong></span>}
                          </div>
                        </div>
                        <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${selectedTicket.status === 'open' ? 'bg-[#fef3c7] text-[#b45309]' : selectedTicket.status === 'in-progress' ? 'bg-[#dbeafe] text-[#1d4ed8]' : selectedTicket.status === 'replied' ? 'bg-[#e0e7ff] text-[#4338ca]' : 'bg-[#dcfce7] text-[#15803d]'}`}>{selectedTicket.status}</span>
                      </div>
                      {selectedTicket.linkedService && (
                        <div className="mt-2.5 rounded border border-[#dedfdf] bg-white p-2 text-xs flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#1a1a1a]">Linked Service: VM {selectedTicket.linkedService.vmid} · {selectedTicket.linkedService.name} ({selectedTicket.linkedService.nodeDisplayName || selectedTicket.linkedService.node})</span>
                          {selectedTicket.linkedService.ipAddress && <span className="font-mono text-[11px] text-[#2563eb]">{selectedTicket.linkedService.ipAddress}</span>}
                        </div>
                      )}
                      {userRole === 'admin' && <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2"><label className="text-[11px] font-semibold text-[#656b6b]">Status<select value={selectedTicket.status} onChange={(e) => handleUpdateStatus(e.target.value as SupportTicketStatus)} disabled={isUpdatingStatus} className="mt-1 w-full rounded-lg border border-[#dedfdf] bg-ink-card p-2 text-xs font-semibold"><option value="open">Open</option><option value="in-progress">In progress</option><option value="replied">Replied</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label className="text-[11px] font-semibold text-[#656b6b]">Priority<select value={selectedTicket.priority} onChange={(e) => handleUpdatePriority(e.target.value as SupportTicketPriority)} disabled={isUpdatingTicketMeta} className="mt-1 w-full rounded-lg border border-[#dedfdf] bg-ink-card p-2 text-xs font-semibold"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="text-[11px] font-semibold text-[#656b6b] md:col-span-2">Assignee<select value={selectedTicket.assignedTo || ''} onChange={(e) => handleAssignTicket(e.target.value || null)} disabled={isUpdatingTicketMeta} className="mt-1 w-full rounded-lg border border-[#dedfdf] bg-ink-card p-2 text-xs font-semibold"><option value="">Unassigned</option>{supportAgents.map(agent => <option key={agent.email} value={agent.email}>{agent.name || agent.email}</option>)}</select></label></div>}
                    </div>
                    <div className="flex max-h-[300px] flex-col gap-3 overflow-y-auto rounded-lg border border-[#dedfdf] bg-ink-card p-3" aria-live="polite">{ticketReplies.length === 0 ? <p className="p-3 text-center text-xs text-[#656b6b]">No replies yet. Send the first message to continue this conversation.</p> : ticketReplies.map(reply => <div key={reply.id} className={`max-w-[88%] rounded-lg border p-3 text-xs ${reply.senderRole === 'admin' ? 'self-start border-[#dedfdf] bg-[#f1f1f1] text-[#1a1a1a]' : 'self-end border-[#1a1a1a] bg-[#1a1a1a] text-white'}`}><div className="mb-1 flex items-center justify-between gap-4 border-b border-current/20 pb-1 text-[10px] opacity-75"><span className="font-semibold">{reply.senderName || (reply.senderRole === 'admin' ? 'Support Specialist' : reply.senderEmail)}</span><time dateTime={reply.timestamp}>{new Date(reply.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div><p className="whitespace-pre-wrap leading-relaxed">{reply.message}</p></div>)}</div>
                    <form onSubmit={handleSendReply} className="flex flex-col gap-2"><textarea value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} placeholder={selectedTicket.status === 'closed' ? 'This ticket is closed. Reopen it from the admin queue before replying.' : 'Write a reply…'} disabled={selectedTicket.status === 'closed'} className="min-h-20 w-full resize-y rounded-lg border border-[#dedfdf] bg-ink-card p-2.5 outline-none focus:border-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60" required maxLength={5000} /><div className="flex items-center justify-between gap-2"><span className="text-[10px] text-[#656b6b]">Replies are recorded in the ticket timeline.</span><button type="submit" disabled={isSubmitting || selectedTicket.status === 'closed'} className="btn-primary px-4 py-2 disabled:opacity-50">{isSubmitting ? 'Sending…' : 'Send reply'}</button></div></form>
                  </div>
                )}

              </div>
            )}

            {/* DOWNLOADS MODAL */}
            {activeModal === 'downloads' && (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="font-semibold text-[#1a1a1a]">System images and drivers</p>
                  <p className="mt-1 text-[#656b6b]">Official files published for Votion-managed instances.</p>
                </div>
                {Array.isArray(modalData) && modalData.length > 0 ? (
                  <div className="divide-y divide-[#dedfdf] overflow-hidden rounded-lg border border-[#dedfdf]">
                    {modalData.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 p-3 transition-colors hover:bg-[#fbfaf9]">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-[#1a1a1a]">{item.name}</div>
                          <div className="text-[11px] text-[#656b6b]">{item.version ? `v${item.version}` : 'Current release'}{item.size ? ` · ${item.size}` : ''}</div>
                        </div>
                        {item.url ? <a href={item.url} download className="btn-secondary shrink-0 cursor-pointer px-3 py-1 text-[11px]">Download</a> : <span className="text-[11px] text-[#656b6b]">Link unavailable</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="modal-empty-state">
                    <p className="font-semibold text-[#1a1a1a]">No downloads are published yet</p>
                    <p className="mt-1 text-[#656b6b]">When system images or drivers are available, they will appear here.</p>
                  </div>
                )}
              </div>
            )}

            {/* DATAROOM MODAL */}
            {activeModal === 'dataroom' && (
              <div className="flex flex-col gap-3">
                <p className="text-[#656b6b]">Verified compliance certificates and ZFS security documentation.</p>
                <div className="divide-y divide-[#dedfdf] border border-[#dedfdf] rounded-lg overflow-hidden">
                  {Array.isArray(modalData) && modalData.map((doc: any) => (
                    <div key={doc.id} className="p-3 flex items-center justify-between hover:bg-[#fbfaf9]">
                      <div>
                        <div className="font-semibold text-[#1a1a1a]">{doc.title}</div>
                        <div className="text-[11px] text-[#656b6b]">Updated: {doc.updatedAt} | Category: {doc.category}</div>
                      </div>
                      <span className="bg-[#dcfce7] text-[#15803d] px-2.5 py-1 rounded text-[11px] font-semibold">
                        ✓ {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRICING & UPGRADE MODAL */}
            {(activeModal === 'pricing' || activeModal === 'upgrade') && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-semibold text-[#1a1a1a]">Available service plans</p>
                  <p className="mt-1 text-[#656b6b]">Plans, currencies, and capacity are maintained in the pricing catalog. Select a plan to send its exact configuration to the operations team for availability and billing review.</p>
                </div>
                {pricingPlans.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {pricingPlans.map(plan => (
                      <article key={plan.id} className="flex min-h-[248px] flex-col justify-between rounded-xl border border-[#dedfdf] bg-ink-card p-4">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 text-sm font-bold text-[#1a1a1a]">{plan.name}</div>
                            <span className="shrink-0 rounded border border-[#dedfdf] px-1.5 py-0.5 text-[10px] font-semibold text-[#656b6b]">{plan.currency}</span>
                          </div>
                          <div className="mt-3 text-xl font-extrabold tracking-[-0.02em] text-[#1a1a1a]">{formatPlanPrice(plan)}<span className="ml-1 text-[11px] font-semibold text-[#656b6b]">/ month</span></div>
                          <ul className="mt-4 space-y-1.5 text-[11px] leading-5 text-[#656b6b]">
                            <li>{formatCapacity(plan.vcpuLimit)} vCPU{plan.vcpuLimit === 1 ? '' : 's'}</li>
                            <li>{formatCapacity(plan.ramGb)} GB RAM</li>
                            <li>{formatCapacity(plan.diskGb)} GB storage</li>
                            <li>{plan.bandwidthGb === null ? 'Unlimited transfer' : `${formatCapacity(plan.bandwidthGb)} GB transfer / month`}</li>
                          </ul>
                        </div>
                        <button type="button" disabled={isSubmitting} onClick={async () => {
                          setIsSubmitting(true);
                          setUpgradePlanId(plan.id);
                          setErrorMessage(null);
                          try {
                            const res = await apiClient.requestUpgrade(plan);
                            showToast(res.message || `Upgrade request for ${plan.name} submitted.`);
                          } catch (err) {
                            setErrorMessage(err instanceof Error ? err.message : 'Unable to submit the upgrade request.');
                          } finally {
                            setUpgradePlanId(null);
                            setIsSubmitting(false);
                          }
                        }} className="btn-primary mt-5 w-full cursor-pointer py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50">
                          {isSubmitting && upgradePlanId === plan.id ? 'Submitting…' : 'Request this plan'}
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="modal-empty-state">
                    <p className="font-semibold text-[#1a1a1a]">No active service plans are published</p>
                    <p className="mt-1 text-[#656b6b]">A Votion administrator can publish plans from Billing Operations. For custom capacity, open a support request.</p>
                  </div>
                )}
              </div>
            )}

            {/* RELEASE NOTES MODAL */}
            {activeModal === 'release-notes' && (
              <div className="flex flex-col gap-3">
                {Array.isArray(modalData) && modalData.map((note: any, idx: number) => (
                  <div key={idx} className="p-4 border border-[#dedfdf] rounded-lg bg-[#fbfaf9]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-[#1a1a1a]">{note.version} — {note.title}</span>
                      <span className="text-[11px] text-[#656b6b] font-mono">{note.date}</span>
                    </div>
                    <ul className="list-disc list-inside text-[#656b6b] space-y-1 text-xs">
                      {note.highlights.map((h: string, i: number) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* TERMS MODAL */}
            {activeModal === 'terms' && (
              <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto p-2 border border-[#dedfdf] rounded-lg">
                <h4 className="font-bold text-sm text-[#1a1a1a]">{modalData?.title || 'Terms of Service'}</h4>
                {modalData?.sections?.map((sec: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="font-semibold text-[#1a1a1a]">{sec.heading}</div>
                    <p className="text-[#656b6b] leading-relaxed">{sec.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* REFER A FRIEND MODAL */}
            {activeModal === 'refer' && (
              <div className="flex flex-col gap-3 text-center p-4">
                <h4 className="font-bold text-sm text-[#1a1a1a]">Refer Cloud Infrastructure Engineers</h4>
                <p className="text-[#656b6b]">Earn $50 cloud credits for every new cluster node onboarded under your referral link.</p>
                <div className="p-3 bg-[#f1f1f1] border border-[#dedfdf] rounded font-mono text-xs text-[#1a1a1a] select-all">
                  {`https://votioncloud.org/ref/${(localStorage.getItem('votion_user_email') || '').split('@')[0] || 'user'}`}
                </div>
                <button onClick={async () => {
                  const refUrl = `https://votioncloud.org/ref/${(localStorage.getItem('votion_user_email') || '').split('@')[0] || 'user'}`;
                  try {
                    await navigator.clipboard.writeText(refUrl);
                    showToast('Referral link copied to clipboard ✓');
                  } catch {
                    showToast('Copy failed — please select and copy the link manually');
                  }
                }} className="btn-primary py-2 w-full mt-2 cursor-pointer">
                  Copy Referral Link
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};
