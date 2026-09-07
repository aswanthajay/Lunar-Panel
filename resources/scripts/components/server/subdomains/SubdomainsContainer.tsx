import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import getSubdomains from '@/api/server/subdomains/getSubdomains';
import createSubdomain from '@/api/server/subdomains/createSubdomain';
import deleteSubdomain from '@/api/server/subdomains/deleteSubdomain';
import { ServerSubdomain, AvailableDomain, SubdomainAllocation } from '@/api/server/subdomains/types';
import Spinner from '@/components/elements/Spinner';
import { CardListSkeleton } from '@/components/elements/CardListSkeleton';
import ConfirmationModal from '@/components/elements/ConfirmationModal';

export default () => {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.uuid || '';

    const [subdomains, setSubdomains] = useState<ServerSubdomain[]>([]);
    const [availableDomains, setAvailableDomains] = useState<AvailableDomain[]>([]);
    const [allocations, setAllocations] = useState<SubdomainAllocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Form inputs
    const [formPrefix, setFormPrefix] = useState('');
    const [selectedDomainId, setSelectedDomainId] = useState<number | ''>('');
    const [selectedAllocationId, setSelectedAllocationId] = useState<number | ''>('');

    // Modal & feedback state
    const [deleteTarget, setDeleteTarget] = useState<ServerSubdomain | null>(null);
    const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

    const loadSubdomains = async () => {
        if (!uuid) return;
        try {
            setError(null);
            const data = await getSubdomains(uuid);
            setSubdomains(data.subdomains || []);
            setAvailableDomains(data.available_domains || []);
            setAllocations(data.allocations || []);

            // Auto-select first domain if none selected
            if (data.available_domains?.length > 0 && !selectedDomainId) {
                setSelectedDomainId(data.available_domains[0].id);
            }

            // Auto-select primary/first allocation if none selected
            if (data.allocations?.length > 0 && !selectedAllocationId) {
                setSelectedAllocationId(data.allocations[0].id);
            }
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || err?.message || 'Failed to load subdomains.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubdomains();
    }, [uuid]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedDomain(text);
        setTimeout(() => setCopiedDomain(null), 2000);
    };

    const handleCreateSubdomain = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uuid || !formPrefix || !selectedDomainId || !selectedAllocationId) return;

        const cleanPrefix = formPrefix.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!cleanPrefix) {
            setError('Please enter a valid subdomain prefix (letters, numbers, hyphens).');
            return;
        }

        setError(null);
        setSuccessMessage(null);
        setActionLoading('create');

        try {
            const res = await createSubdomain(uuid, {
                subdomain: cleanPrefix,
                subdomain_domain_id: Number(selectedDomainId),
                allocation_id: Number(selectedAllocationId),
            });

            setSubdomains((prev) => [res.data, ...prev]);
            setFormPrefix('');
            setSuccessMessage(res.message || `Subdomain ${res.data.full_subdomain} provisioned successfully on Cloudflare!`);
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create subdomain.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!uuid || !deleteTarget) return;

        setError(null);
        setSuccessMessage(null);
        const targetId = deleteTarget.id;
        const targetName = deleteTarget.full_subdomain;
        setActionLoading(`delete-${targetId}`);

        try {
            await deleteSubdomain(uuid, targetId);
            setSubdomains((prev) => prev.filter((s) => s.id !== targetId));
            setDeleteTarget(null);
            setSuccessMessage(`Subdomain ${targetName} and its Cloudflare DNS records were deleted.`);
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || err?.message || 'Failed to delete subdomain.');
        } finally {
            setActionLoading(null);
        }
    };

    const activeSelectedDomain = availableDomains.find((d) => d.id === Number(selectedDomainId));
    const previewFqdn = formPrefix.trim() ? `${formPrefix.trim().toLowerCase()}.${activeSelectedDomain?.domain || 'domain.com'}` : null;

    if (loading) {
        return (
            <div className="my-10">
                <CardListSkeleton />
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-display, inherit)' }}>
                        Subdomain Hub
                    </h1>
                    <p className="text-xs md:text-sm text-[#8E8E93] mt-1">
                        Map memorable zero-port domain addresses to your server via Cloudflare Anycast Edge DNS.
                    </p>
                </div>
            </div>

            {/* Flash Alerts */}
            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 text-sm text-red-200">{error}</div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {successMessage && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div className="flex-1 text-sm text-emerald-200">{successMessage}</div>
                    <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-300">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Top Bento Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
                <div className="p-4 rounded-xl bg-[#080808] border border-[#1F1F1F] flex flex-col justify-between">
                    <div className="text-[11px] uppercase tracking-wider text-[#737373] font-medium">Active Subdomains</div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-display, inherit)' }}>
                            {subdomains.length}
                        </span>
                        <span className="text-xs text-[#525252]">configured</span>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-[#080808] border border-[#1F1F1F] flex flex-col justify-between">
                    <div className="text-[11px] uppercase tracking-wider text-[#737373] font-medium">Primary Address</div>
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-white truncate max-w-[200px]" title={subdomains[0]?.full_subdomain || 'None'}>
                            {subdomains[0]?.full_subdomain || 'None active'}
                        </span>
                        {subdomains[0] && (
                            <button
                                onClick={() => handleCopy(subdomains[0].full_subdomain)}
                                className="px-2 py-1 text-[11px] font-medium rounded-md bg-[#161616] text-[#A3A3A3] hover:text-white hover:bg-[#222222] transition-colors"
                            >
                                {copiedDomain === subdomains[0].full_subdomain ? 'Copied!' : 'Copy'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-[#080808] border border-[#1F1F1F] flex flex-col justify-between">
                    <div className="text-[11px] uppercase tracking-wider text-[#737373] font-medium">Cloudflare Edge</div>
                    <div className="mt-2 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-sm font-medium text-emerald-400">Synchronized & Active</span>
                    </div>
                </div>
            </div>

            {/* Quick Provisioning Bar */}
            <div className="mb-8 p-5 md:p-6 rounded-2xl bg-[#080808] border border-[#1F1F1F] shadow-2xl">
                <div className="mb-4">
                    <h2 className="text-base font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-display, inherit)' }}>
                        Create Subdomain
                    </h2>
                    <p className="text-xs text-[#737373] mt-0.5">
                        Choose your prefix, pick an available root domain, and bind it to your game server port.
                    </p>
                </div>

                {availableDomains.length === 0 ? (
                    <div className="py-6 px-4 rounded-xl bg-[#0E0E0E] border border-[#1F1F1F] text-center text-xs text-[#737373]">
                        No root domains are currently configured or enabled on the system. Please ask an administrator to add domains in the Admin CP.
                    </div>
                ) : (
                    <form onSubmit={handleCreateSubdomain} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-end">
                            {/* Prefix + Domain Selector */}
                            <div className="md:col-span-6">
                                <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5">
                                    Subdomain Prefix & Apex Domain
                                </label>
                                <div className="flex items-center rounded-xl bg-[#0E0E0E] border border-[#262626] focus-within:border-[#404040] transition-colors overflow-hidden">
                                    <input
                                        type="text"
                                        value={formPrefix}
                                        onChange={(e) => setFormPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                                        placeholder="play"
                                        maxLength={32}
                                        required
                                        className="w-1/2 md:w-5/12 px-3.5 py-2.5 bg-transparent text-sm text-white placeholder-[#525252] focus:outline-none font-mono"
                                    />
                                    <span className="text-[#525252] text-sm select-none">.</span>
                                    <select
                                        value={selectedDomainId}
                                        onChange={(e) => setSelectedDomainId(Number(e.target.value))}
                                        className="w-1/2 md:w-7/12 px-3 py-2.5 bg-transparent text-sm text-white focus:outline-none cursor-pointer"
                                    >
                                        {availableDomains.map((d) => (
                                            <option key={d.id} value={d.id} className="bg-[#141414] text-white">
                                                {d.domain}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Target Allocation Selector */}
                            <div className="md:col-span-4">
                                <label className="block text-xs font-medium text-[#A3A3A3] mb-1.5">
                                    Server Allocation (IP & Port)
                                </label>
                                <select
                                    value={selectedAllocationId}
                                    onChange={(e) => setSelectedAllocationId(Number(e.target.value))}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] text-sm text-white focus:outline-none focus:border-[#404040] cursor-pointer transition-colors"
                                >
                                    {allocations.map((a) => (
                                        <option key={a.id} value={a.id} className="bg-[#141414] text-white">
                                            {a.ip_alias ? `${a.ip_alias}:${a.port}` : `${a.ip}:${a.port}`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Submit Button */}
                            <div className="md:col-span-2">
                                <button
                                    type="submit"
                                    disabled={actionLoading === 'create' || !formPrefix.trim()}
                                    className="w-full h-[42px] px-4 rounded-xl bg-white text-black font-semibold text-xs md:text-sm hover:bg-[#E5E5E5] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                                >
                                    {actionLoading === 'create' ? (
                                        <>
                                            <Spinner size="small" />
                                            <span>Deploying...</span>
                                        </>
                                    ) : (
                                        <span>Create Subdomain</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Live Address Preview */}
                        {previewFqdn && (
                            <div className="flex items-center gap-2 text-xs text-[#737373] pt-1">
                                <span>Players connect to:</span>
                                <code className="px-2 py-0.5 rounded-md bg-[#141414] text-emerald-400 font-mono text-xs border border-[#262626]">
                                    {previewFqdn}
                                </code>
                                <span className="text-[11px] text-[#525252]">(No port needed)</span>
                            </div>
                        )}
                    </form>
                )}
            </div>

            {/* Subdomains Fleet List */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1 mb-2">
                    <h3 className="text-sm font-medium text-[#A3A3A3] uppercase tracking-wider text-[11px]">
                        Configured Subdomains ({subdomains.length})
                    </h3>
                </div>

                {subdomains.length === 0 ? (
                    <div className="p-8 md:p-12 rounded-2xl bg-[#080808] border border-[#1F1F1F] text-center flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#141414] border border-[#262626] flex items-center justify-center text-[#737373] mb-4">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                                <line x1="2" y1="12" x2="22" y2="12" strokeWidth="1.5" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeWidth="1.5" />
                            </svg>
                        </div>
                        <h4 className="text-base font-medium text-white mb-1" style={{ fontFamily: 'var(--font-display, inherit)' }}>
                            No Subdomains Configured
                        </h4>
                        <p className="text-xs md:text-sm text-[#737373] max-w-md">
                            Create a custom address above so players can join directly using a memorable name like <span className="text-[#A3A3A3]">play.yourdomain.gg</span> without memorizing port numbers.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {subdomains.map((subdomain) => {
                            const isDeleting = actionLoading === `delete-${subdomain.id}`;
                            const isCopied = copiedDomain === subdomain.full_subdomain;

                            return (
                                <div
                                    key={subdomain.id}
                                    className="p-4 md:p-5 rounded-2xl bg-[#080808] border border-[#1F1F1F] hover:border-[#2D2D2D] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                                >
                                    {/* Left: Domain Info */}
                                    <div className="flex items-start md:items-center gap-3.5 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-[#121212] border border-[#262626] flex items-center justify-center text-emerald-400 shrink-0">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                                                <line x1="2" y1="12" x2="22" y2="12" strokeWidth="1.5" />
                                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeWidth="1.5" />
                                            </svg>
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-base font-semibold text-white tracking-tight font-mono">
                                                    {subdomain.full_subdomain}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                    Cloudflare Edge
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-[#737373] mt-1 flex-wrap">
                                                <span>
                                                    Target:{' '}
                                                    <code className="text-[#D4D4D4] font-mono">
                                                        {subdomain.target_ip}:{subdomain.target_port}
                                                    </code>
                                                </span>
                                                <span className="text-[#404040]">•</span>
                                                <span className="uppercase text-[10px] tracking-wider text-[#A3A3A3]">
                                                    {subdomain.record_type === 'srv' ? 'SRV' : subdomain.record_type === 'a' ? 'A Record' : 'SRV + A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                        <button
                                            onClick={() => handleCopy(subdomain.full_subdomain)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${
                                                isCopied
                                                    ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30'
                                                    : 'bg-[#121212] text-[#D4D4D4] border-[#262626] hover:bg-[#1E1E1E] hover:text-white'
                                            }`}
                                        >
                                            {isCopied ? (
                                                <>
                                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span>Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3.5 h-3.5 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={1.8} />
                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth={1.8} />
                                                    </svg>
                                                    <span>Copy Host</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => setDeleteTarget(subdomain)}
                                            disabled={isDeleting}
                                            className="p-2 rounded-xl text-[#737373] hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-500/20 transition-colors disabled:opacity-50"
                                            title="Delete Subdomain"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Confirmation Modal for Delete */}
            {deleteTarget && (
                <ConfirmationModal
                    visible={true}
                    title="Delete Subdomain?"
                    buttonText="Delete Subdomain"
                    onConfirmed={handleConfirmDelete}
                    showSpinnerOverlay={actionLoading === `delete-${deleteTarget.id}`}
                >
                    <p>
                        Are you sure you want to delete <strong className="text-white font-mono">{deleteTarget.full_subdomain}</strong>?
                    </p>
                    <p className="mt-2 text-xs text-[#8E8E93]">
                        This will immediately remove the DNS records from Cloudflare Anycast edge. Players will no longer be able to connect using this address.
                    </p>
                </ConfirmationModal>
            )}
        </div>
    );
};
