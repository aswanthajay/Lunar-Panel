import React, { useState, useEffect, useMemo, useRef } from 'react';
import { formatDistanceToNowStrict, format } from 'date-fns';
import {
    Ticket,
    getTickets,
    getTicket,
    createTicket,
    replyTicket,
    updateTicketStatus,
    deleteTicket,
} from '@/api/tickets';
import getServers from '@/api/getServers';
import { Server } from '@/api/server/getServer';
import { useUserRole } from '@/plugins/useUserRole';
import Spinner from '@/components/elements/Spinner';
import { bytesToString } from '@/lib/formatters';

export const SupportCenterView: React.FC = () => {
    const { isAdmin, rootAdmin } = useUserRole();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isThreadLoading, setIsThreadLoading] = useState(false);
    const [servers, setServers] = useState<Server[]>([]);

    // Filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal & Reply states
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [replyAttachment, setReplyAttachment] = useState<File | null>(null);
    const [replyAttachmentPreview, setReplyAttachmentPreview] = useState<string | null>(null);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [replyAsStaff, setReplyAsStaff] = useState(isAdmin);
    const replyFileInputRef = useRef<HTMLInputElement>(null);

    // Lightbox for image attachments
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // New Ticket Form
    const [newTitle, setNewTitle] = useState('');
    const [newDept, setNewDept] = useState('Technical Support');
    const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
    const [newServerId, setNewServerId] = useState<string>('');
    const [newMessage, setNewMessage] = useState('');
    const [newAttachment, setNewAttachment] = useState<File | null>(null);
    const [newAttachmentPreview, setNewAttachmentPreview] = useState<string | null>(null);
    const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const newFileInputRef = useRef<HTMLInputElement>(null);

    // Fetch Servers for dropdown
    useEffect(() => {
        getServers({})
            .then((res) => setServers(res.items))
            .catch(() => setServers([]));
    }, []);

    // Fetch Tickets
    const loadTickets = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await getTickets({
                status: statusFilter,
                department: deptFilter,
                priority: priorityFilter,
                search: searchQuery,
                admin: isAdmin,
            });
            setTickets(data);
            if (data.length > 0) {
                if (selectedTicket) {
                    const match = data.find((t) => t.id === selectedTicket.id);
                    if (match) {
                        loadThread(match.id);
                    } else {
                        loadThread(data[0].id);
                    }
                } else {
                    loadThread(data[0].id);
                }
            } else {
                setSelectedTicket(null);
            }
        } catch (e) {
            console.error('Failed to load tickets', e);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, [statusFilter, deptFilter, priorityFilter, searchQuery, isAdmin]);

    // Fetch individual thread
    const loadThread = async (id: number) => {
        setIsThreadLoading(true);
        try {
            const ticket = await getTicket(id);
            setSelectedTicket(ticket);
        } catch (e) {
            console.error('Failed to load thread', e);
        } finally {
            setIsThreadLoading(false);
        }
    };

    // Calculate metrics
    const metrics = useMemo(() => {
        const total = tickets.length;
        const open = tickets.filter((t) => t.status === 'open').length;
        const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
        const answered = tickets.filter((t) => t.status === 'answered').length;
        const closed = tickets.filter((t) => t.status === 'closed').length;
        return { total, open, inProgress, answered, closed };
    }, [tickets]);

    // File validation helper (Max 5MB)
    const validateFile = (file: File): string | null => {
        const maxBytes = 5 * 1024 * 1024; // 5MB
        if (file.size > maxBytes) {
            return `File "${file.name}" (${bytesToString(file.size)}) exceeds the 5MB limit. Please choose a file under 5MB.`;
        }
        return null;
    };

    // Handle New Ticket File Selection
    const handleNewFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const error = validateFile(file);
        if (error) {
            setFormError(error);
            e.target.value = '';
            return;
        }

        setFormError(null);
        setNewAttachment(file);

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => setNewAttachmentPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setNewAttachmentPreview(null);
        }
    };

    const clearNewAttachment = () => {
        setNewAttachment(null);
        setNewAttachmentPreview(null);
        if (newFileInputRef.current) newFileInputRef.current.value = '';
    };

    // Handle Reply File Selection
    const handleReplyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const error = validateFile(file);
        if (error) {
            alert(error);
            e.target.value = '';
            return;
        }

        setReplyAttachment(file);

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => setReplyAttachmentPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setReplyAttachmentPreview(null);
        }
    };

    const clearReplyAttachment = () => {
        setReplyAttachment(null);
        setReplyAttachmentPreview(null);
        if (replyFileInputRef.current) replyFileInputRef.current.value = '';
    };

    // Handle Create Ticket
    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !newMessage.trim()) {
            setFormError('Please provide both a subject title and message details.');
            return;
        }

        setIsCreatingTicket(true);
        setFormError(null);

        try {
            let finalMessage = newMessage.trim();
            if (includeDiagnostics && newServerId) {
                const srv = servers.find((s) => String(s.internalId) === newServerId || s.uuid === newServerId);
                if (srv) {
                    finalMessage += `\n\n---\n**System Diagnostics Snapshot:**\n- Server: ${srv.name} (${srv.id})\n- Node: ${srv.node || 'Cluster Daemon'}\n- Quota: ${srv.limits.memory}MB RAM / ${srv.limits.cpu}% CPU / ${srv.limits.disk}MB Disk`;
                }
            }

            const created = await createTicket({
                title: newTitle.trim(),
                department: newDept,
                priority: newPriority,
                message: finalMessage,
                server_id: newServerId ? Number(newServerId) : null,
                attachment: newAttachment,
            });

            setIsNewModalOpen(false);
            setNewTitle('');
            setNewMessage('');
            setNewServerId('');
            clearNewAttachment();
            await loadTickets();
            loadThread(created.id);
        } catch (err: any) {
            const msg =
                err.response?.data?.message ||
                err.response?.data?.error ||
                (err.response?.data?.errors
                    ? Object.values(err.response.data.errors)
                          .reduce((acc: any[], v: any) => acc.concat(v), [])
                          .join(' ')
                    : null) ||
                'Failed to submit ticket. Please try again.';
            setFormError(msg);
        } finally {
            setIsCreatingTicket(false);
        }
    };

    // Handle Reply
    const handleSendReply = async () => {
        if (!selectedTicket || (!replyText.trim() && !replyAttachment) || isSubmittingReply) return;
        setIsSubmittingReply(true);

        try {
            const msgToSend = replyText.trim() || '(Attachment uploaded)';
            const res = await replyTicket(
                selectedTicket.id,
                msgToSend,
                Boolean(replyAsStaff && rootAdmin),
                replyAttachment
            );
            setReplyText('');
            clearReplyAttachment();
            setSelectedTicket((prev) => {
                if (!prev) return null;
                const existing = prev.messages || [];
                return {
                    ...prev,
                    ...res.ticket,
                    messages: [...existing, res.message],
                };
            });
            loadTickets(true);
        } catch (e: any) {
            console.error('Failed to post reply', e);
            alert(e.response?.data?.message || 'Failed to submit response.');
        } finally {
            setIsSubmittingReply(false);
        }
    };

    // Handle Status Change
    const handleStatusChange = async (newStatus: string) => {
        if (!selectedTicket) return;
        try {
            const updated = await updateTicketStatus(selectedTicket.id, newStatus);
            setSelectedTicket((prev) => (prev ? { ...prev, status: updated.status } : null));
            loadTickets(true);
        } catch (e) {
            console.error('Failed to update status', e);
        }
    };

    // Handle Delete
    const handleDeleteTicket = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this ticket permanently?')) return;
        try {
            await deleteTicket(id);
            if (selectedTicket?.id === id) {
                setSelectedTicket(null);
            }
            loadTickets();
        } catch (e) {
            console.error('Failed to delete ticket', e);
        }
    };

    // Fast Canned Responses
    const insertCannedResponse = (text: string) => {
        setReplyText((prev) => (prev ? `${prev}\n\n${text}` : text));
    };

    // Status Pill Helper
    // Status Pill Helper
    const renderStatusPill = (status: string) => {
        switch (status) {
            case 'open':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#051F14] text-[#10B981] border border-[#10B981]/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                        Open
                    </span>
                );
            case 'in_progress':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#1C1405] text-[#F59E0B] border border-[#F59E0B]/40">
                        In Progress
                    </span>
                );
            case 'answered':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#051C24] text-[#06B6D4] border border-[#06B6D4]/40">
                        Answered
                    </span>
                );
            case 'closed':
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#0A0A0A] text-[#737373] border border-[#1F1F1F]">
                        Closed
                    </span>
                );
        }
    };

    // Priority Pill Helper
    const renderPriorityPill = (priority: string) => {
        switch (priority) {
            case 'critical':
                return (
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-[#1F080A] text-[#EF4444] border border-[#EF4444]/40 font-bold">
                        Critical
                    </span>
                );
            case 'high':
                return (
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-[#1C1405] text-[#F59E0B] border border-[#F59E0B]/40">
                        High
                    </span>
                );
            case 'medium':
                return (
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-[#0A0A0A] text-[#D4D4D4] border border-[#1F1F1F]">
                        Medium
                    </span>
                );
            case 'low':
            default:
                return (
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-[#0A0A0A] text-[#737373] border border-[#1F1F1F]">
                        Low
                    </span>
                );
        }
    };

    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-6 py-8 select-none">
            <div className="max-w-[1400px] mx-auto space-y-6">
                {/* 1. Header with Title and Create Action */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#141414] pb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#FFFFFF] tracking-tight m-0">
                                Support Operations
                            </h1>
                            {isAdmin && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#051F14] text-[#10B981] border border-[#10B981]/40 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                                    Admin Dispatch Mode
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-[#8A8A8A] font-sans mt-1.5 m-0 leading-relaxed">
                            Dedicated infrastructure engineering, port allocations, Anti-DDoS telemetry, and technical assistance.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => loadTickets()}
                            className="px-3 py-2 rounded-md bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838] text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>↻</span>
                            <span>Refresh</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsNewModalOpen(true)}
                            className="px-4 py-2 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] font-semibold text-xs cursor-pointer border-none shadow-sm transition-all"
                        >
                            + Open Support Ticket
                        </button>
                    </div>
                </div>

                {/* 2. Connected Metric Counters Bento */}
                <div className="grid grid-cols-2 sm:grid-cols-4 bg-[#000000] border border-[#1F1F1F] rounded-lg overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#141414]">
                    <div className="p-4 sm:p-5">
                        <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                            Total Tickets
                        </span>
                        <div className="text-2xl font-mono font-medium text-[#FFFFFF] mt-1">{metrics.total}</div>
                        <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                            All recorded incidents
                        </span>
                    </div>

                    <div className="p-4 sm:p-5">
                        <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                            Open Queue
                        </span>
                        <div className="text-2xl font-mono font-medium text-[#10B981] mt-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                            {metrics.open}
                        </div>
                        <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                            Awaiting staff reply
                        </span>
                    </div>

                    <div className="p-4 sm:p-5">
                        <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                            In Progress
                        </span>
                        <div className="text-2xl font-mono font-medium text-[#F59E0B] mt-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                            {metrics.inProgress}
                        </div>
                        <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                            Under investigation
                        </span>
                    </div>

                    <div className="p-4 sm:p-5">
                        <span className="text-[10px] font-semibold font-sans uppercase tracking-[0.1em] text-[#6B7280] block">
                            Answered
                        </span>
                        <div className="text-2xl font-mono font-medium text-[#06B6D4] mt-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#06B6D4]" />
                            {metrics.answered}
                        </div>
                        <span className="text-[10px] font-mono text-[#525252] mt-1 block">
                            Client response needed
                        </span>
                    </div>
                </div>

                {/* 3. Filter Bar */}
                <div className="bg-[#000000] border border-[#1F1F1F] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1 bg-[#0A0A0A] p-1 rounded-md border border-[#1F1F1F]">
                        {['all', 'open', 'in_progress', 'answered', 'closed'].map((st) => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1 text-xs font-mono uppercase tracking-wider rounded transition-colors cursor-pointer border-none ${
                                    statusFilter === st
                                        ? 'bg-[#FFFFFF] text-[#000000] font-semibold shadow-sm'
                                        : 'bg-transparent text-[#737373] hover:text-[#FFFFFF]'
                                }`}
                            >
                                {st.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] text-xs text-[#D4D4D4] rounded-md px-3 py-1.5 font-sans outline-none cursor-pointer transition-colors"
                        >
                            <option value="all">All Departments</option>
                            <option value="Technical Support">Technical Support</option>
                            <option value="Network & Anti-DDoS">Network & Anti-DDoS</option>
                            <option value="Hardware & Allocations">Hardware & Allocations</option>
                            <option value="Infrastructure & Storage">Infrastructure & Storage</option>
                            <option value="Billing">Billing</option>
                        </select>

                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] text-xs text-[#D4D4D4] rounded-md px-3 py-1.5 font-sans outline-none cursor-pointer transition-colors"
                        >
                            <option value="all">All Priorities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search tickets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] text-xs text-[#FFFFFF] placeholder-[#525252] rounded-md pl-8 pr-3 py-1.5 font-mono outline-none w-48 transition-colors"
                            />
                            <span className="absolute left-2.5 top-1.5 text-xs text-[#525252]">🔍</span>
                        </div>
                    </div>
                </div>

                {/* 4. Master-Detail Split Workspace */}
                {isLoading ? (
                    <div className="bg-[#000000] border border-[#1F1F1F] rounded-lg p-16 text-center">
                        <Spinner centered size="large" />
                        <p className="text-xs text-[#737373] mt-4 font-mono">Syncing tickets with infrastructure database...</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="bg-[#000000] border border-[#1F1F1F] rounded-lg p-16 text-center">
                        <div className="w-12 h-12 rounded-full bg-[#050505] border border-[#1F1F1F] flex items-center justify-center mx-auto text-lg mb-3">
                            🎫
                        </div>
                        <h3 className="text-base font-serif font-normal text-[#FFFFFF] m-0">No Support Tickets Found</h3>
                        <p className="text-xs text-[#737373] mt-1.5 max-w-sm mx-auto">
                            There are currently no tickets matching your active filter criteria. Submit a new ticket to open an incident request.
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsNewModalOpen(true)}
                            className="mt-4 px-4 py-2 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] font-semibold text-xs cursor-pointer border-none shadow-sm"
                        >
                            + Open Support Ticket
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Left Column: Tickets Queue (4 cols) */}
                        <div className="lg:col-span-4 bg-[#000000] border border-[#1F1F1F] rounded-lg overflow-hidden divide-y divide-[#141414]">
                            <div className="bg-[#050505] px-4 py-3 border-b border-[#141414] flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Ticket Queue</span>
                                <span className="text-[10px] font-mono text-[#525252]">{tickets.length} items</span>
                            </div>

                            <div className="max-h-[720px] overflow-y-auto divide-y divide-[#141414]">
                                {tickets.map((t) => {
                                    const isSelected = selectedTicket?.id === t.id;
                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => loadThread(t.id)}
                                            className={`p-4 cursor-pointer transition-colors relative ${
                                                isSelected
                                                    ? 'bg-[#080808] border-l-2 border-l-[#FFFFFF]'
                                                    : 'hover:bg-[#050505]'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs font-bold text-[#FFFFFF]">{t.ticket_id}</span>
                                                    {renderPriorityPill(t.priority)}
                                                </div>
                                                {renderStatusPill(t.status)}
                                            </div>

                                            <h4 className="text-xs font-serif font-normal text-[#FFFFFF] truncate m-0 mb-1">
                                                {t.title}
                                            </h4>

                                            <p className="text-[11px] text-[#737373] line-clamp-1 m-0 mb-2 font-sans">
                                                {t.messages && t.messages[0] ? t.messages[0].message : t.department}
                                            </p>

                                            <div className="flex items-center justify-between text-[10px] font-mono text-[#525252]">
                                            <div className="flex items-center gap-1 truncate max-w-[180px]">
                                                {t.server ? (
                                                    <span className="flex items-center gap-1 text-[#A0A0A0] truncate">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
                                                            <rect x="2" y="3" width="20" height="14" rx="2" />
                                                            <path d="M8 21h8M12 17v4" />
                                                        </svg>
                                                        <span className="truncate">{t.server.name}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[#525252]">{t.department}</span>
                                                )}
                                            </div>
                                                <span>{formatDistanceToNowStrict(new Date(t.updated_at), { addSuffix: true })}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Column: Interactive Thread & Actions (8 cols) */}
                        <div className="lg:col-span-8 bg-[#000000] border border-[#1F1F1F] rounded-lg overflow-hidden flex flex-col min-h-[640px]">
                            {isThreadLoading && !selectedTicket ? (
                                <div className="p-16 text-center my-auto">
                                    <Spinner centered />
                                </div>
                            ) : selectedTicket ? (
                                <>
                                    {/* Thread Header */}
                                    <div className="bg-[#050505] p-5 border-b border-[#141414]">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-xs font-bold text-[#10B981]">{selectedTicket.ticket_id}</span>
                                                    <span className="text-xs text-[#525252]">&bull;</span>
                                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#000000] border border-[#1F1F1F] text-[#A0A0A0]">
                                                        {selectedTicket.department}
                                                    </span>
                                                    {renderPriorityPill(selectedTicket.priority)}
                                                    {renderStatusPill(selectedTicket.status)}
                                                </div>
                                                <h2 className="text-lg font-serif font-normal text-[#FFFFFF] m-0 tracking-tight">
                                                    {selectedTicket.title}
                                                </h2>
                                            </div>

                                            {/* Status Transition Controls */}
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={selectedTicket.status}
                                                    onChange={(e) => handleStatusChange(e.target.value)}
                                                    className="bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] text-xs text-[#FFFFFF] font-mono rounded-md px-3 py-1.5 outline-none cursor-pointer transition-colors"
                                                >
                                                    <option value="open">Status: Open</option>
                                                    <option value="in_progress">Status: In Progress</option>
                                                    <option value="answered">Status: Answered</option>
                                                    <option value="closed">Status: Closed</option>
                                                </select>

                                                {(isAdmin || rootAdmin) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteTicket(selectedTicket.id)}
                                                        title="Delete Ticket"
                                                        className="w-8 h-8 rounded-md bg-[#000000] hover:bg-[#1A0A0C] text-[#737373] hover:text-[#EF4444] border border-[#1F1F1F] hover:border-[#EF4444]/40 flex items-center justify-center transition-colors cursor-pointer text-xs"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6l-1 14H6L5 6" />
                                                            <path d="M10 11v6M14 11v6" />
                                                            <path d="M9 6V4h6v2" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Metadata Footer Strip */}
                                        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-[#141414] text-[11px] font-mono text-[#737373]">
                                            <span>Author: <strong className="text-[#FFFFFF]">{selectedTicket.user?.username || 'Client'}</strong></span>
                                            {selectedTicket.server && (
                                                <span className="flex items-center gap-1.5">Target Server:&nbsp;
                                                    <strong className="text-[#10B981] flex items-center gap-1">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                                                            <rect x="2" y="3" width="20" height="14" rx="2" />
                                                            <path d="M8 21h8M12 17v4" />
                                                        </svg>
                                                        {selectedTicket.server.name}
                                                    </strong>
                                                </span>
                                            )}
                                            <span>Opened: {format(new Date(selectedTicket.created_at), 'MMM do, yyyy h:mma')}</span>
                                        </div>
                                    </div>

                                    {/* Conversation Messages */}
                                    <div className="flex-1 p-5 space-y-4 max-h-[520px] overflow-y-auto">
                                        {(selectedTicket.messages || []).map((msg) => {
                                            const isStaff = msg.is_staff;
                                            const hasAttachment = Boolean(msg.attachment_path);
                                            const isImageAttachment = msg.attachment_type === 'image';

                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`rounded-lg p-4 transition-all ${
                                                        isStaff
                                                            ? 'bg-[#080808] border border-[#1F1F1F]'
                                                            : 'bg-[#050505] border border-[#141414]'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2.5">
                                                            <div
                                                                className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-mono font-bold select-none ${
                                                                    isStaff
                                                                        ? 'bg-[#051F14] text-[#10B981] border border-[#10B981]/40'
                                                                        : 'bg-[#000000] text-[#FFFFFF] border border-[#1F1F1F]'
                                                                }`}
                                                            >
                                                                {isStaff ? 'ST' : msg.user?.username ? msg.user.username.slice(0, 2).toUpperCase() : 'CL'}
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-semibold text-[#FFFFFF]">
                                                                    {isStaff ? (msg.user?.username || 'Staff Responder') : (msg.user?.username || 'Client')}
                                                                </span>
                                                                {isStaff ? (
                                                                    <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-[#051F14] text-[#10B981] border border-[#10B981]/40">
                                                                        STAFF RESPONDER
                                                                    </span>
                                                                ) : (
                                                                    <span className="ml-2 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-[#0A0A0A] text-[#737373] border border-[#1F1F1F]">
                                                                        CLIENT AUTHOR
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <span className="text-[10px] font-mono text-[#525252]">
                                                            {formatDistanceToNowStrict(new Date(msg.created_at), { addSuffix: true })}
                                                        </span>
                                                    </div>

                                                    <div className="text-xs text-[#D4D4D4] leading-relaxed whitespace-pre-wrap font-sans pl-9">
                                                        {msg.message}
                                                    </div>

                                                    {/* Render Attachment if present */}
                                                    {hasAttachment && msg.attachment_path && (
                                                        <div className="mt-3 pl-9">
                                                            {isImageAttachment ? (
                                                                <div className="space-y-1.5">
                                                                    <div
                                                                        onClick={() => setPreviewImage(msg.attachment_path!)}
                                                                        className="relative inline-block rounded-md border border-[#1F1F1F] overflow-hidden bg-[#000000] cursor-zoom-in max-w-sm group"
                                                                    >
                                                                        <img
                                                                            src={msg.attachment_path}
                                                                            alt={msg.attachment_name || 'Screenshot'}
                                                                            className="max-h-56 max-w-full object-contain transition-transform group-hover:scale-[1.02]"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-mono text-white">
                                                                            🔍 Click to expand
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-[11px] font-mono text-[#737373]">
                                                                        <span>🖼 {msg.attachment_name || 'screenshot.png'}</span>
                                                                        {msg.attachment_size && <span>({bytesToString(msg.attachment_size)})</span>}
                                                                        <a
                                                                            href={msg.attachment_path}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="text-[#10B981] hover:underline"
                                                                        >
                                                                            Download &rarr;
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="inline-flex items-center gap-3 p-2.5 rounded-md bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#383838] transition-colors">
                                                                    <div className="w-8 h-8 rounded bg-[#000000] border border-[#1F1F1F] flex items-center justify-center text-base">
                                                                        📄
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs font-mono font-medium text-[#FFFFFF]">
                                                                            {msg.attachment_name || 'attachment.txt'}
                                                                        </div>
                                                                        <div className="text-[10px] font-mono text-[#525252]">
                                                                            {msg.attachment_size ? bytesToString(msg.attachment_size) : 'File'} &bull; Text / Log Data
                                                                        </div>
                                                                    </div>
                                                                    <a
                                                                        href={msg.attachment_path}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        download={msg.attachment_name || undefined}
                                                                        className="ml-2 px-2.5 py-1 rounded-md bg-[#000000] hover:bg-[#141414] text-xs font-mono text-[#10B981] no-underline border border-[#1F1F1F] transition-colors"
                                                                    >
                                                                        View / Download
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Fast Canned Responses */}
                                    <div className="bg-[#050505] px-5 py-2.5 border-t border-[#141414] flex items-center gap-2 overflow-x-auto">
                                        <span className="text-[10px] font-mono text-[#737373] shrink-0">Quick Templates:</span>
                                        {[
                                            'Attached latest server logs for inspection.',
                                            'Issue confirmed resolved. Thank you!',
                                            'Container restarted and verified operational.',
                                            'Running network latency traceroute now.',
                                        ].map((canned, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => insertCannedResponse(canned)}
                                                className="shrink-0 text-[11px] font-sans px-2.5 py-1 rounded-md bg-[#000000] hover:bg-[#0A0A0A] text-[#8A8A8A] hover:text-[#FFFFFF] border border-[#1F1F1F] transition-colors cursor-pointer"
                                            >
                                                {canned}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Reply Composer Box */}
                                    <div className="bg-[#000000] p-5 border-t border-[#141414] space-y-3">
                                        <textarea
                                            rows={3}
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Write your response... (Markdown supported)"
                                            className="w-full bg-[#050505] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] rounded-md p-3 text-xs text-[#FFFFFF] placeholder-[#525252] font-sans outline-none resize-none transition-colors"
                                        />

                                        {/* Reply Attachment Preview Chip */}
                                        {replyAttachment && (
                                            <div className="flex items-center gap-3 p-2 bg-[#050505] border border-[#1F1F1F] rounded-md max-w-md">
                                                {replyAttachmentPreview ? (
                                                    <img
                                                        src={replyAttachmentPreview}
                                                        alt="preview"
                                                        className="w-10 h-10 object-cover rounded border border-[#1F1F1F]"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded bg-[#000000] border border-[#1F1F1F] flex items-center justify-center text-[#525252]">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                            <polyline points="14 2 14 8 20 8" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-mono text-[#FFFFFF] truncate m-0">{replyAttachment.name}</p>
                                                    <p className="text-[10px] font-mono text-[#525252] m-0">{bytesToString(replyAttachment.size)}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={clearReplyAttachment}
                                                    className="text-xs text-[#737373] hover:text-[#EF4444] p-1 cursor-pointer bg-transparent border-none"
                                                    title="Remove attachment"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                {/* File Attachment Trigger Button */}
                                                <input
                                                    ref={replyFileInputRef}
                                                    type="file"
                                                    accept="image/*,.txt,.log,.json,.yml,.yaml,.cfg,.conf,.properties,.md,.csv"
                                                    onChange={handleReplyFileChange}
                                                    className="hidden"
                                                    id="reply-file-upload"
                                                />
                                                <label
                                                    htmlFor="reply-file-upload"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] text-xs font-mono cursor-pointer transition-colors"
                                                >
                                                    <span>📎</span>
                                                    <span>Attach Screenshot / Log (&lt;5MB)</span>
                                                </label>

                                                {(isAdmin || rootAdmin) && (
                                                    <label className="flex items-center gap-2 text-xs font-mono text-[#10B981] cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={replyAsStaff}
                                                            onChange={(e) => setReplyAsStaff(e.target.checked)}
                                                            className="rounded border-[#1F1F1F] bg-[#000000] text-[#10B981]"
                                                        />
                                                        Reply with Staff Badge
                                                    </label>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {selectedTicket.status !== 'closed' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStatusChange('closed')}
                                                        className="px-3.5 py-1.5 rounded-md bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] text-xs font-sans cursor-pointer transition-colors"
                                                    >
                                                        Mark as Closed
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={handleSendReply}
                                                    disabled={(!replyText.trim() && !replyAttachment) || isSubmittingReply}
                                                    className="px-4 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none shadow-sm transition-all"
                                                >
                                                    {isSubmittingReply ? 'Sending...' : 'Send Reply'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="p-16 text-center my-auto">
                                    <p className="text-xs text-[#525252] font-mono">Select a ticket from the queue to view conversation history.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Create Ticket Modal */}
            {isNewModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
                        <div className="flex items-center justify-between border-b border-[#141414] pb-3">
                            <h2 className="text-lg font-serif font-normal text-[#FFFFFF] m-0 tracking-tight">Open Support Ticket</h2>
                            <button
                                type="button"
                                onClick={() => setIsNewModalOpen(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-md bg-[#000000] hover:bg-[#141414] text-[#737373] hover:text-[#FFFFFF] border border-[#1F1F1F] cursor-pointer transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {formError && (
                            <div className="p-3 rounded-md bg-[#1F080A] border border-[#EF4444]/40 text-xs text-[#EF4444] font-mono">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleCreateTicket} className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-1.5">
                                    Subject / Issue Summary
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Additional Port Allocation & Layer 7 Anti-DDoS Binding"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] rounded-md px-3 py-2 text-xs text-[#FFFFFF] placeholder-[#525252] font-sans outline-none transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-1.5">
                                        Department
                                    </label>
                                    <select
                                        value={newDept}
                                        onChange={(e) => setNewDept(e.target.value)}
                                        className="w-full bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] rounded-md px-3 py-2 text-xs text-[#FFFFFF] font-sans outline-none cursor-pointer transition-colors"
                                    >
                                        <option value="Technical Support">Technical Support</option>
                                        <option value="Network & Anti-DDoS">Network & Anti-DDoS</option>
                                        <option value="Hardware & Allocations">Hardware & Allocations</option>
                                        <option value="Infrastructure & Storage">Infrastructure & Storage</option>
                                        <option value="Billing">Billing & Commercial</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-1.5">
                                        Priority
                                    </label>
                                    <select
                                        value={newPriority}
                                        onChange={(e: any) => setNewPriority(e.target.value)}
                                        className="w-full bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] rounded-md px-3 py-2 text-xs text-[#FFFFFF] font-sans outline-none cursor-pointer transition-colors"
                                    >
                                        <option value="low">Low (General Inquiry)</option>
                                        <option value="medium">Medium (Standard Request)</option>
                                        <option value="high">High (Service Degradation)</option>
                                        <option value="critical">Critical (Service Outage)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-1.5">
                                    Linked Game Server (Optional)
                                </label>
                                <select
                                    value={newServerId}
                                    onChange={(e) => setNewServerId(e.target.value)}
                                    className="w-full bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] rounded-md px-3 py-2 text-xs text-[#FFFFFF] font-sans outline-none cursor-pointer transition-colors"
                                >
                                    <option value="">No specific server / Account level</option>
                                    {servers.map((srv) => (
                                        <option key={srv.uuid} value={String(srv.internalId)}>
                                            {srv.name} ({srv.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-1.5">
                                    Description & Incident Details
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Provide detailed information regarding your inquiry, steps to reproduce, or requested allocation parameters..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    className="w-full bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] focus:border-[#FFFFFF] rounded-md px-3 py-2 text-xs text-[#FFFFFF] placeholder-[#525252] font-sans outline-none resize-none transition-colors"
                                />
                            </div>

                            {/* Attachment Section (Max 5MB) */}
                            <div>
                                <label className="block text-xs font-mono uppercase tracking-wider text-[#A0A0A0] mb-1.5">
                                    Attachment (Screenshot or Text/Log under 5MB)
                                </label>
                                <input
                                    ref={newFileInputRef}
                                    type="file"
                                    accept="image/*,.txt,.log,.json,.yml,.yaml,.cfg,.conf,.properties,.md,.csv"
                                    onChange={handleNewFileChange}
                                    className="hidden"
                                    id="modal-file-upload"
                                />

                                {!newAttachment ? (
                                    <label
                                        htmlFor="modal-file-upload"
                                        className="flex flex-col items-center justify-center p-4 border border-dashed border-[#1F1F1F] hover:border-[#383838] rounded-md bg-[#000000] cursor-pointer transition-colors text-center group"
                                    >
                                        <span className="text-base mb-1 text-[#737373] group-hover:text-[#FFFFFF]">📎</span>
                                        <span className="text-xs font-sans text-[#A0A0A0] group-hover:text-[#FFFFFF]">
                                            Click to attach screenshot, error log, or configuration file
                                        </span>
                                        <span className="text-[10px] font-mono text-[#525252] mt-0.5">
                                            Images, .log, .txt, .json, .yml (Max 5MB)
                                        </span>
                                    </label>
                                ) : (
                                    <div className="flex items-center gap-3 p-3 bg-[#000000] border border-[#1F1F1F] rounded-md">
                                        {newAttachmentPreview ? (
                                            <img
                                                src={newAttachmentPreview}
                                                alt="preview"
                                                className="w-12 h-12 object-cover rounded border border-[#1F1F1F]"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded bg-[#0A0A0A] border border-[#1F1F1F] flex items-center justify-center text-lg">
                                                📄
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-mono text-[#FFFFFF] truncate m-0 font-medium">{newAttachment.name}</p>
                                            <p className="text-[10px] font-mono text-[#525252] m-0">{bytesToString(newAttachment.size)} &bull; Ready to upload</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={clearNewAttachment}
                                            className="text-xs text-[#737373] hover:text-[#EF4444] p-1.5 cursor-pointer bg-transparent border-none"
                                            title="Remove attachment"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>

                            {newServerId && (
                                <label className="flex items-center gap-2 text-xs font-mono text-[#A0A0A0] cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={includeDiagnostics}
                                        onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                                        className="rounded border-[#1F1F1F] bg-[#000000]"
                                    />
                                    Include container specs & node diagnostics snapshot
                                </label>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#141414]">
                                <button
                                    type="button"
                                    onClick={() => setIsNewModalOpen(false)}
                                    className="px-4 py-2 rounded-md bg-[#000000] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] text-xs font-semibold cursor-pointer border border-[#1F1F1F] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingTicket}
                                    className="px-4 py-2 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] font-semibold text-xs disabled:opacity-40 cursor-pointer border-none shadow-sm transition-all"
                                >
                                    {isCreatingTicket ? 'Submitting...' : 'Create Ticket'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 6. Image Lightbox Modal */}
            {previewImage && (
                <div
                    onClick={() => setPreviewImage(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <img
                            src={previewImage}
                            alt="Expanded View"
                            className="max-w-full max-h-[85vh] rounded-md border border-[#1F1F1F] object-contain shadow-2xl"
                        />
                        <button
                            type="button"
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#000000] border border-[#1F1F1F] text-white flex items-center justify-center text-xs cursor-pointer shadow-lg hover:bg-[#141414] transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
