import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Cpu, ExternalLink, Filter, HardDrive, HelpCircle, Inbox, Mail, Plus, Search, Send, Server, UserRound, X } from 'lucide-react';
import {
  apiClient,
  type ApiSupportAgent,
  type ApiSupportTicket,
  type ApiTicketReply,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '../services/apiClient';
import { formatDateTime } from '../services/dateTime';

type SupportCenterProps = {
  userRole: 'admin' | 'client';
};

type TicketDetails = {
  ticket: ApiSupportTicket;
  replies: ApiTicketReply[];
};

const statusOptions: Array<{ value: SupportTicketStatus | 'all' | 'active'; label: string }> = [
  { value: 'all', label: 'All tickets' },
  { value: 'active', label: 'Open work' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'replied', label: 'Awaiting client' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const priorityOptions: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];
const categoryOptions = ['Technical assistance', 'Service & billing', 'Account access', 'Network & connectivity', 'Service request', 'Other'];

const displayStatus = (status: string) => status === 'replied' ? 'Awaiting client' : status.replace('-', ' ');
const formatDate = (value?: string) => value ? formatDateTime(value) : '—';
const initials = (value?: string) => (value || 'V').split(/[@.\s_-]/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');

const statusClass = (status: string) => {
  if (status === 'resolved' || status === 'closed') return 'border-[#b7dfcf] bg-[#f1fbf7] text-[#1f6b4c]';
  if (status === 'replied') return 'border-[#c8d8f5] bg-[#f2f6fe] text-[#2456a6]';
  if (status === 'in-progress') return 'border-[#f3d49a] bg-[#fffaf0] text-[#7a4b00]';
  return 'border-[#dedfdf] bg-[#f7f8f8] text-[#4f5757]';
};

const priorityClass = (priority: string) => {
  if (priority === 'urgent') return 'bg-[#fdeceb] text-[#b42318]';
  if (priority === 'high') return 'bg-[#fff1dd] text-[#a04d00]';
  if (priority === 'medium') return 'bg-[#f1f4f8] text-[#40516d]';
  return 'bg-[#f4f5f5] text-[#656b6b]';
};

export const SupportCenter: React.FC<SupportCenterProps> = ({ userRole }) => {
  const isAdmin = userRole === 'admin';
  const [tickets, setTickets] = useState<ApiSupportTicket[]>([]);
  const [details, setDetails] = useState<TicketDetails | null>(null);
  const [agents, setAgents] = useState<ApiSupportAgent[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SupportTicketStatus | 'all' | 'active'>('active');
  const [priority, setPriority] = useState<SupportTicketPriority | 'all'>('all');
  const [assignment, setAssignment] = useState<'all' | 'unassigned' | 'mine'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(categoryOptions[0]);
  const [newPriority, setNewPriority] = useState<SupportTicketPriority>('medium');
  const [vmid, setVmid] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeCount = useMemo(() => tickets.filter(ticket => ['open', 'in-progress', 'replied'].includes(ticket.status)).length, [tickets]);
  const unreadCount = useMemo(() => tickets.filter(ticket => ticket.unread).length, [tickets]);
  const unassignedCount = useMemo(() => tickets.filter(ticket => !ticket.assignedTo).length, [tickets]);

  const loadTickets = async (selectFirst = false) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const requestedStatus = status === 'active' ? undefined : status === 'all' ? undefined : status;
      const requestedAssignment = isAdmin && assignment === 'unassigned' ? 'unassigned' : undefined;
      const rows = await apiClient.getSupportTickets({ search, status: requestedStatus, priority: priority === 'all' ? undefined : priority, assignedTo: requestedAssignment });
      const activeRows = status === 'active' ? rows.filter(ticket => ['open', 'in-progress', 'replied'].includes(ticket.status)) : rows;
      setTickets(activeRows);
      const currentId = details?.ticket.id;
      if (selectFirst || !currentId || !activeRows.some(ticket => ticket.id === currentId)) {
        setDetails(null);
        if (activeRows[0]) void loadTicket(activeRows[0].id);
      }
    } catch (error) {
      setTickets([]);
      setLoadError(error instanceof Error ? error.message : 'Unable to load support tickets.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTicket = async (ticketId: string) => {
    setIsDetailLoading(true);
    setActionError(null);
    try {
      const next = await apiClient.getTicketDetails(ticketId);
      if (!next) throw new Error('The selected ticket is no longer available.');
      setDetails(next);
      await apiClient.markTicketRead(ticketId).catch(() => undefined);
      setTickets(current => current.map(ticket => ticket.id === ticketId ? { ...ticket, unread: false } : ticket));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to load this ticket.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTickets(); }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, status, priority, assignment, userRole]);

  useEffect(() => {
    if (!isAdmin) {
      setAgents([]);
      return;
    }
    void apiClient.getSupportAgents().then(setAgents).catch(() => setAgents([]));
  }, [isAdmin]);

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!details || !reply.trim() || isReplying) return;
    setIsReplying(true);
    setActionError(null);
    try {
      await apiClient.addTicketReply(details.ticket.id, reply.trim());
      setReply('');
      await loadTicket(details.ticket.id);
      await loadTickets();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to post the reply.');
    } finally {
      setIsReplying(false);
    }
  };

  const submitTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const parsedVmid = vmid.trim() ? Number(vmid) : undefined;
      const result = await apiClient.createSupportTicket(subject.trim(), category, newPriority, Number.isInteger(parsedVmid) ? parsedVmid : undefined, message.trim() || undefined);
      const ticketId = result?.data?.ticket?.id as string | undefined;
      setShowComposer(false);
      setSubject('');
      setCategory(categoryOptions[0]);
      setNewPriority('medium');
      setVmid('');
      setMessage('');
      await loadTickets(true);
      if (ticketId) await loadTicket(ticketId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to create the support ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAdminField = async (field: 'status' | 'priority' | 'assignment', value: string) => {
    if (!details) return;
    setActionError(null);
    try {
      if (field === 'status') await apiClient.updateTicketStatus(details.ticket.id, value as SupportTicketStatus);
      if (field === 'priority') await apiClient.updateTicketPriority(details.ticket.id, value as SupportTicketPriority);
      if (field === 'assignment') await apiClient.assignTicket(details.ticket.id, value || null);
      await loadTicket(details.ticket.id);
      await loadTickets();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update the ticket.');
    }
  };

  return (
    <main className="support-center app-content min-w-0 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-5">
        <section className="rounded-xl border border-[#dedfdf] bg-white p-5 shadow-[0_1px_2px_rgba(26,26,26,0.04)] sm:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-[#2563eb]">
                <HelpCircle size={17} strokeWidth={1.8} aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{isAdmin ? 'Service Operations' : 'Customer Care'}</span>
              </div>
              <h1 className="mt-2 font-serif text-2xl font-medium leading-tight tracking-[-0.03em] text-[#1a1a1a]">{isAdmin ? 'Ticket management' : 'Support center'}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#656b6b]">
                {isAdmin
                  ? 'Review workload, assign ownership, maintain clear response history, and close issues with an auditable service record.'
                  : 'Open a request, follow every update in one place, and reply securely without leaving your account workspace.'}
              </p>
            </div>
            <button type="button" onClick={() => { setActionError(null); setShowComposer(true); }} className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold">
              <Plus size={16} aria-hidden="true" />
              {isAdmin ? 'Create ticket' : 'Contact support'}
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:max-w-3xl lg:grid-cols-4">
            {[
              { label: 'Open work', value: activeCount },
              { label: 'Unread updates', value: unreadCount },
              { label: isAdmin ? 'Unassigned' : 'Resolved', value: isAdmin ? unassignedCount : tickets.filter(ticket => ticket.status === 'resolved').length },
              { label: 'Urgent', value: tickets.filter(ticket => ticket.priority === 'urgent').length },
            ].map(item => (
              <div key={item.label} className="rounded-lg border border-[#e7e8e8] bg-[#fbfaf9] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#656b6b]">{item.label}</p>
                <p className="mt-1 text-xl font-semibold text-[#1a1a1a]">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {actionError && <div role="alert" className="rounded-lg border border-[#f0c3bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#b42318]">{actionError}</div>}

        <section className="overflow-hidden rounded-xl border border-[#dedfdf] bg-white shadow-[0_1px_2px_rgba(26,26,26,0.04)]">
          <div className="grid min-h-[620px] grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="border-b border-[#dedfdf] bg-[#fbfaf9] xl:border-b-0 xl:border-r">
              <div className="border-b border-[#dedfdf] p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#656b6b]" size={16} aria-hidden="true" />
                  <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tickets" className="h-10 w-full rounded-lg border border-[#dedfdf] bg-white pl-9 pr-3 text-sm text-[#1a1a1a] outline-none transition-colors placeholder:text-[#8b9292] focus:border-[#1a1a1a]" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="sr-only" htmlFor="support-status">Ticket status</label>
                  <select id="support-status" value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-9 min-w-0 rounded-md border border-[#dedfdf] bg-white px-2 text-xs font-medium text-[#1a1a1a] outline-none focus:border-[#1a1a1a]">
                    {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <label className="sr-only" htmlFor="support-priority">Ticket priority</label>
                  <select id="support-priority" value={priority} onChange={event => setPriority(event.target.value as typeof priority)} className="h-9 min-w-0 rounded-md border border-[#dedfdf] bg-white px-2 text-xs font-medium text-[#1a1a1a] outline-none focus:border-[#1a1a1a]">
                    <option value="all">All priorities</option>
                    {priorityOptions.map(option => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}
                  </select>
                </div>
                {isAdmin && <div className="mt-2 flex items-center gap-2 text-xs text-[#656b6b]"><Filter size={14} aria-hidden="true" /><button type="button" onClick={() => setAssignment(assignment === 'unassigned' ? 'all' : 'unassigned')} className={`rounded-md px-2 py-1 font-semibold ${assignment === 'unassigned' ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#656b6b]'}`}>Unassigned only</button></div>}
              </div>
              <div className="max-h-[520px] overflow-y-auto xl:max-h-[calc(100vh-300px)]">
                {isLoading && <div className="space-y-3 p-4" aria-busy="true">{[0, 1, 2, 3].map(index => <div key={index} className="h-20 animate-pulse rounded-lg bg-[#f0f1f1]" />)}</div>}
                {!isLoading && loadError && <div className="p-6 text-center"><p className="text-sm font-semibold text-[#1a1a1a]">Ticket inbox unavailable</p><p className="mt-2 text-xs leading-5 text-[#656b6b]">{loadError}</p><button type="button" onClick={() => void loadTickets()} className="mt-4 text-xs font-semibold text-[#2563eb]">Try again</button></div>}
                {!isLoading && !loadError && tickets.length === 0 && <div className="p-8 text-center"><Inbox className="mx-auto text-[#9ba1a1]" size={24} aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-[#1a1a1a]">{isAdmin ? 'No tickets need attention' : 'No support tickets yet'}</p><p className="mt-2 text-xs leading-5 text-[#656b6b]">{isAdmin ? 'Adjust the filters or review again later.' : 'Open a ticket whenever you need help with your service.'}</p></div>}
                {!isLoading && !loadError && tickets.map(ticket => (
                  <button type="button" key={ticket.id} onClick={() => void loadTicket(ticket.id)} className={`w-full border-b border-[#e7e8e8] px-4 py-4 text-left transition-colors hover:bg-white ${details?.ticket.id === ticket.id ? 'bg-white shadow-[inset_3px_0_0_#2563eb]' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold text-[#1a1a1a]">{ticket.subject}</span>
                      {ticket.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2563eb]" aria-label="Unread update" />}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${priorityClass(ticket.priority)}`}>{ticket.priority}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusClass(ticket.status)}`}>{displayStatus(ticket.status)}</span>
                      {ticket.vmid && <span className="font-mono text-[10px] text-[#656b6b]">VM-{ticket.vmid}{ticket.linkedVmName ? ` (${ticket.linkedVmName})` : ''}</span>}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[#656b6b]">
                      <span className="truncate">
                        {isAdmin ? (ticket.userName ? `${ticket.userName} · ${ticket.userEmail}` : ticket.userEmail || 'Customer') : ticket.category}
                      </span>
                      <span className="shrink-0">{formatDate(ticket.lastReplyAt || ticket.updatedAt || ticket.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <div className="min-w-0 bg-white">
              {isDetailLoading && <div className="space-y-4 p-6" aria-busy="true"><div className="h-7 w-2/3 animate-pulse rounded bg-[#f0f1f1]" /><div className="h-24 animate-pulse rounded-lg bg-[#f0f1f1]" /><div className="h-24 animate-pulse rounded-lg bg-[#f0f1f1]" /></div>}
              {!isDetailLoading && !details && <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><Inbox size={30} className="text-[#9ba1a1]" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold text-[#1a1a1a]">Select a ticket</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#656b6b]">Choose a request from the inbox to review its service history, current ownership, and all replies.</p></div>}
              {!isDetailLoading && details && <div className="flex min-h-[620px] flex-col">
                <div className="border-b border-[#dedfdf] p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#656b6b]">{details.ticket.ticket_number || details.ticket.id}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${statusClass(details.ticket.status)}`}>
                          {displayStatus(details.ticket.status)}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${priorityClass(details.ticket.priority)}`}>
                          {details.ticket.priority}
                        </span>
                        <span className="rounded-full border border-[#dedfdf] bg-[#fbfaf9] px-2.5 py-0.5 text-[10px] font-medium text-[#656b6b]">
                          {details.ticket.category}
                        </span>
                      </div>
                      <h2 className="mt-3 text-xl font-semibold tracking-[-0.015em] text-[#1a1a1a]">
                        {details.ticket.subject}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#656b6b]">
                        <span>Opened {formatDate(details.ticket.createdAt)}</span>
                        {details.ticket.updatedAt && details.ticket.updatedAt !== details.ticket.createdAt && (
                          <span>Updated {formatDate(details.ticket.updatedAt)}</span>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:w-[440px]">
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#656b6b]">Status</label>
                          <select
                            aria-label="Ticket status"
                            value={details.ticket.status}
                            onChange={event => void updateAdminField('status', event.target.value)}
                            className="h-9 w-full rounded-md border border-[#dedfdf] bg-white px-2 text-xs font-semibold text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                          >
                            {statusOptions.filter(option => option.value !== 'all' && option.value !== 'active').map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#656b6b]">Priority</label>
                          <select
                            aria-label="Ticket priority"
                            value={details.ticket.priority}
                            onChange={event => void updateAdminField('priority', event.target.value)}
                            className="h-9 w-full rounded-md border border-[#dedfdf] bg-white px-2 text-xs font-semibold text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                          >
                            {priorityOptions.map(option => (
                              <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#656b6b]">Assignee</label>
                          <select
                            aria-label="Ticket assignee"
                            value={details.ticket.assignedTo || ''}
                            onChange={event => void updateAdminField('assignment', event.target.value)}
                            className="h-9 w-full rounded-md border border-[#dedfdf] bg-white px-2 text-xs font-semibold text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                          >
                            <option value="">Unassigned</option>
                            {agents.map(agent => (
                              <option key={agent.email} value={agent.email}>{agent.name || agent.email}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Customer Information & Identity Banner */}
                  <div className="mt-4 rounded-xl border border-[#e7e8e8] bg-[#fbfaf9] p-3.5 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-xs font-bold text-white shadow-sm">
                          {initials(details.ticket.userName || details.ticket.userEmail)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[#1a1a1a]">
                              {details.ticket.userName || details.ticket.userEmail?.split('@')[0] || 'Customer'}
                            </span>
                            <span className="rounded bg-[#eef1f6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#475569]">
                              {details.ticket.userRole || 'Client'}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#656b6b]">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#2563eb]">
                              <Mail size={12} aria-hidden="true" />
                              {details.ticket.userEmail}
                            </span>
                            {details.ticket.userPhone && (
                              <>
                                <span className="text-[#c0c4c4]">•</span>
                                <span>{details.ticket.userPhone}</span>
                              </>
                            )}
                            {details.ticket.assignedTo && (
                              <>
                                <span className="text-[#c0c4c4]">•</span>
                                <span>Owner: <strong className="font-medium text-[#1a1a1a]">{details.ticket.assignedAgentName || details.ticket.assignedTo}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {details.ticket.customerServices && details.ticket.customerServices.length > 0 && (
                        <div className="shrink-0 text-left sm:border-l sm:border-[#dedfdf] sm:pl-4 sm:text-right">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#656b6b]">Associated Fleet</span>
                          <span className="font-mono text-xs font-bold text-[#1a1a1a]">
                            {details.ticket.customerServices.length} {details.ticket.customerServices.length === 1 ? 'service' : 'services'} linked
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Associated / Linked Services */}
                    {details.ticket.linkedService ? (
                      <div className="mt-3.5 border-t border-[#dedfdf]/80 pt-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2563eb]">Directly Linked Service</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              details.ticket.linkedService.status === 'running' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f1f5f9] text-[#64748b]'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${details.ticket.linkedService.status === 'running' ? 'bg-[#16a34a]' : 'bg-[#94a3b8]'}`} />
                              {details.ticket.linkedService.status}
                            </span>
                          </div>
                          <a
                            href={`/instances?vmid=${details.ticket.linkedService.vmid}${details.ticket.linkedService.proxmoxConnectionId ? `&connectionId=${details.ticket.linkedService.proxmoxConnectionId}` : ''}${details.ticket.linkedService.node ? `&node=${details.ticket.linkedService.node}` : ''}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563eb] hover:underline"
                          >
                            <span>Manage Instance</span>
                            <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <div className="rounded-lg border border-[#dedfdf] bg-white px-2.5 py-1.5">
                            <span className="block text-[10px] text-[#656b6b]">Instance</span>
                            <span className="block truncate font-semibold text-[#1a1a1a]">VM {details.ticket.linkedService.vmid} · {details.ticket.linkedService.name}</span>
                          </div>
                          <div className="rounded-lg border border-[#dedfdf] bg-white px-2.5 py-1.5">
                            <span className="block text-[10px] text-[#656b6b]">Host & Location</span>
                            <span className="block truncate font-semibold text-[#1a1a1a]">{details.ticket.linkedService.nodeDisplayName || details.ticket.linkedService.node}</span>
                          </div>
                          <div className="rounded-lg border border-[#dedfdf] bg-white px-2.5 py-1.5">
                            <span className="block text-[10px] text-[#656b6b]">IP Address</span>
                            <span className="block truncate font-mono text-[#1a1a1a]">{details.ticket.linkedService.ipAddress || '—'}</span>
                          </div>
                          <div className="rounded-lg border border-[#dedfdf] bg-white px-2.5 py-1.5">
                            <span className="block text-[10px] text-[#656b6b]">Hardware Specs</span>
                            <span className="block truncate text-[#1a1a1a]">{details.ticket.linkedService.cpus || 1} vCPU · {Math.round((details.ticket.linkedService.ramMb || 0) / 1024)} GB · {details.ticket.linkedService.diskGb || 0} GB</span>
                          </div>
                        </div>
                      </div>
                    ) : details.ticket.customerServices && details.ticket.customerServices.length > 0 ? (
                      <div className="mt-3.5 border-t border-[#dedfdf]/80 pt-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656b6b]">
                            Associated Customer Services ({details.ticket.customerServices.length})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {details.ticket.customerServices.map(srv => (
                            <a
                              key={`${srv.proxmoxConnectionId}-${srv.node}-${srv.vmid}`}
                              href={`/instances?vmid=${srv.vmid}${srv.proxmoxConnectionId ? `&connectionId=${srv.proxmoxConnectionId}` : ''}${srv.node ? `&node=${srv.node}` : ''}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-[#dedfdf] bg-white px-2.5 py-1.5 text-xs text-[#1a1a1a] transition-colors hover:border-[#2563eb] hover:bg-[#f8faff]"
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${srv.status === 'running' ? 'bg-[#16a34a]' : 'bg-[#94a3b8]'}`} />
                              <span className="font-semibold">VM {srv.vmid}</span>
                              <span className="text-[#656b6b]">· {srv.name}</span>
                              {srv.ipAddress && <span className="font-mono text-[10px] text-[#656b6b]">({srv.ipAddress})</span>}
                              <span className="text-[10px] text-[#9ca3af]">[{srv.nodeDisplayName || srv.node}]</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-1.5 border-t border-[#dedfdf]/60 pt-2.5 text-xs text-[#656b6b]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#9ca3af]" />
                        <span>No server instances currently linked to this customer account.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto bg-[#fbfaf9] p-5 sm:p-6">
                  {details.replies.length === 0 && <div className="rounded-lg border border-dashed border-[#cfd3d3] bg-white p-4 text-sm text-[#656b6b]">No message has been added to this request yet. Add context below to make the next action clear.</div>}
                  {details.replies.map(item => {
                    const internal = item.senderRole === 'admin';
                    const senderDisplayName = item.senderName || (internal ? 'Support Specialist' : (details.ticket.userName || 'Customer'));
                    return (
                      <article key={item.id} className={`flex gap-3 ${internal ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[88%] gap-3 ${internal ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                            internal
                              ? 'bg-[#1a1a1a] text-white dark:bg-[#2e2e2e] dark:text-white'
                              : 'bg-[#e7edf9] text-[#2456a6] dark:bg-[#172554] dark:text-[#93c5fd]'
                          }`}>
                            {initials(item.senderName || item.senderEmail)}
                          </div>
                          <div className={`support-message-bubble rounded-xl border px-4 py-3 ${
                            internal
                              ? 'support-bubble-admin border-[#1a1a1a] bg-[#1a1a1a] text-white dark:border-[#383838] dark:bg-[#222222] dark:text-white'
                              : 'support-bubble-customer border-[#dedfdf] bg-white text-[#1a1a1a] dark:border-[#262626] dark:bg-[#141414] dark:text-[#ededed]'
                          }`}>
                            <div className={`mb-1 flex flex-wrap items-center gap-x-2 text-[11px] ${
                              internal ? 'text-white/80 dark:text-[#a0a0a0]' : 'text-[#656b6b] dark:text-[#a0a0a0]'
                            }`}>
                              <span className="font-semibold">{senderDisplayName}</span>
                              {item.senderEmail && (
                                <span className={`font-mono text-[10px] ${internal ? 'text-white/60' : 'text-[#656b6b]'}`}>
                                  ({item.senderEmail})
                                </span>
                              )}
                              <span className="opacity-40">•</span>
                              <span className="rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider opacity-90">
                                {internal ? 'Support Agent' : 'Customer'}
                              </span>
                              <span className="opacity-40">•</span>
                              <span>{formatDate(item.timestamp)}</span>
                            </div>
                            <p className={`whitespace-pre-wrap text-sm leading-6 ${internal ? 'text-white' : 'text-[#1a1a1a] dark:text-[#ededed]'}`}>
                              {item.message}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {details.ticket.status !== 'closed' && <form onSubmit={submitReply} className="border-t border-[#dedfdf] bg-white p-4 sm:p-5"><label className="sr-only" htmlFor="ticket-reply">Reply to ticket</label><textarea id="ticket-reply" value={reply} onChange={event => setReply(event.target.value)} rows={3} maxLength={10_000} placeholder={isAdmin ? 'Write a clear update for the customer…' : 'Add a reply or any new information…'} className="w-full resize-y rounded-lg border border-[#dedfdf] p-3 text-sm text-[#1a1a1a] outline-none placeholder:text-[#8b9292] focus:border-[#1a1a1a]" /><div className="mt-3 flex items-center justify-between gap-3"><p className="hidden text-xs text-[#656b6b] sm:block">Replies are saved to the ticket history.</p><button type="submit" disabled={!reply.trim() || isReplying} className="btn-primary ml-auto inline-flex min-h-10 items-center gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"><Send size={15} aria-hidden="true" />{isReplying ? 'Sending…' : 'Send reply'}</button></div></form>}
              </div>}
            </div>
          </div>
        </section>
      </div>

      {showComposer && <div className="ticket-composer-overlay fixed inset-0 z-[1300] flex items-end justify-center bg-[#1a1a1a]/45 p-0 sm:items-center sm:p-5" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="new-ticket-title" className="ticket-composer-dialog w-full max-w-xl rounded-t-xl border border-[#dedfdf] bg-white p-5 shadow-2xl sm:rounded-xl sm:p-6"><div className="ticket-composer-header flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2563eb]">Support request</p><h2 id="new-ticket-title" className="mt-1 text-xl font-semibold text-[#1a1a1a]">Create a ticket</h2></div><button type="button" onClick={() => setShowComposer(false)} className="flex h-10 w-10 items-center justify-center rounded-md text-[#656b6b] hover:bg-[#f1f1f1]" aria-label="Close new ticket form"><X size={18} /></button></div><form onSubmit={submitTicket} className="mt-5 space-y-4"><div><label htmlFor="new-ticket-subject" className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">Subject</label><input id="new-ticket-subject" value={subject} onChange={event => setSubject(event.target.value)} maxLength={255} required placeholder="Describe the outcome you need" className="h-10 w-full rounded-lg border border-[#dedfdf] px-3 text-sm text-[#1a1a1a] outline-none placeholder:text-[#8b9292] focus:border-[#1a1a1a]" /></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="sm:col-span-2"><label htmlFor="new-ticket-category" className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">Category</label><select id="new-ticket-category" value={category} onChange={event => setCategory(event.target.value)} className="h-10 w-full rounded-lg border border-[#dedfdf] bg-white px-3 text-sm text-[#1a1a1a] outline-none focus:border-[#1a1a1a]">{categoryOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></div><div><label htmlFor="new-ticket-priority" className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">Priority</label><select id="new-ticket-priority" value={newPriority} onChange={event => setNewPriority(event.target.value as SupportTicketPriority)} className="h-10 w-full rounded-lg border border-[#dedfdf] bg-white px-3 text-sm text-[#1a1a1a] outline-none focus:border-[#1a1a1a]">{priorityOptions.map(option => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</select></div></div><div><label htmlFor="new-ticket-vmid" className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">Related service <span className="font-normal text-[#656b6b]">(optional)</span></label><input id="new-ticket-vmid" inputMode="numeric" value={vmid} onChange={event => setVmid(event.target.value.replace(/[^0-9]/g, ''))} placeholder="VM ID, if relevant" className="h-10 w-full rounded-lg border border-[#dedfdf] px-3 text-sm text-[#1a1a1a] outline-none placeholder:text-[#8b9292] focus:border-[#1a1a1a]" /></div><div><label htmlFor="new-ticket-message" className="mb-1.5 block text-xs font-semibold text-[#1a1a1a]">Details <span className="font-normal text-[#656b6b]">(optional)</span></label><textarea id="new-ticket-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={10_000} rows={5} placeholder="Include the relevant symptoms, timing, and any steps already taken." className="w-full resize-y rounded-lg border border-[#dedfdf] p-3 text-sm text-[#1a1a1a] outline-none placeholder:text-[#8b9292] focus:border-[#1a1a1a]" /></div><div className="ticket-composer-actions flex justify-end gap-3 border-t border-[#e7e8e8] pt-4"><button type="button" onClick={() => setShowComposer(false)} className="min-h-10 rounded-md border border-[#dedfdf] px-4 text-sm font-semibold text-[#1a1a1a] hover:bg-[#fbfaf9]">Cancel</button><button type="submit" disabled={!subject.trim() || isSubmitting} className="btn-primary min-h-10 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Creating…' : 'Create ticket'}</button></div></form></section></div>}
    </main>
  );
};

export default SupportCenter;
