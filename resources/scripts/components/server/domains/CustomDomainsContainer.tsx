import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import getServerDomains from '@/api/server/domains/getServerDomains';
import createServerDomain from '@/api/server/domains/createServerDomain';
import verifyServerDomainDns from '@/api/server/domains/verifyServerDomainDns';
import provisionServerDomainSsl from '@/api/server/domains/provisionServerDomainSsl';
import deleteServerDomain from '@/api/server/domains/deleteServerDomain';
import { ServerCustomDomain, DnsDiagnostics } from '@/api/server/domains/types';
import Spinner from '@/components/elements/Spinner';
import { CardListSkeleton } from '@/components/elements/CardListSkeleton';

export default () => {
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server?.uuid || '';
    const allocations = server?.allocations || [];
    const nodeFqdn = server?.node || '';

    const [domains, setDomains] = useState<ServerCustomDomain[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedDnsDomain, setSelectedDnsDomain] = useState<ServerCustomDomain | null>(null);
    const [dnsDiagnostics, setDnsDiagnostics] = useState<DnsDiagnostics | null>(null);
    const [viewNginxDomain, setViewNginxDomain] = useState<ServerCustomDomain | null>(null);
    const [deleteTargetDomain, setDeleteTargetDomain] = useState<ServerCustomDomain | null>(null);

    // Form inputs
    const primaryAlloc = allocations.find((a) => a.isDefault) || allocations[0];
    const [formDomain, setFormDomain] = useState('');
    const [formAllocationId, setFormAllocationId] = useState<number>(primaryAlloc ? primaryAlloc.id : 0);
    const [formProtocol, setFormProtocol] = useState<'http' | 'game_srv'>('http');
    const [formSslEnabled, setFormSslEnabled] = useState(true);
    const [formNotes, setFormNotes] = useState('');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const loadDomains = async () => {
        if (!uuid) return;
        try {
            setError(null);
            const data = await getServerDomains(uuid);
            setDomains(data);
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || err?.message || 'Failed to load custom domains.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDomains();
    }, [uuid]);

    useEffect(() => {
        if (primaryAlloc && !formAllocationId) {
            setFormAllocationId(primaryAlloc.id);
        }
    }, [primaryAlloc]);

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleCreateDomain = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uuid || !formDomain) return;

        setError(null);
        setSuccessMessage(null);
        setActionLoading('create');

        try {
            const cleanDomain = formDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            const res = await createServerDomain(uuid, {
                allocation_id: Number(formAllocationId),
                domain: cleanDomain,
                protocol: formProtocol,
                target_type: formProtocol === 'http' ? 'web' : 'game',
                ssl_enabled: formProtocol === 'http' ? formSslEnabled : false,
                notes: formNotes,
            });

            setDomains((prev) => [res.data, ...prev]);
            setIsAddModalOpen(false);
            setFormDomain('');
            setFormNotes('');
            setSuccessMessage(`Custom domain "${cleanDomain}" created and Nginx reverse proxy configured successfully.`);
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create custom domain.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleVerifyDns = async (domain: ServerCustomDomain) => {
        if (!uuid) return;
        setActionLoading(`verify-${domain.id}`);
        setError(null);

        try {
            const res = await verifyServerDomainDns(uuid, domain.id);
            setDomains((prev) => prev.map((d) => (d.id === domain.id ? res.data : d)));
            setSelectedDnsDomain(res.data);
            setDnsDiagnostics(res.diagnostics);
            if (res.diagnostics?.verified) {
                setSuccessMessage(`DNS verified! "${domain.domain}" resolves to this server.`);
            }
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || 'Failed to test DNS resolution.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleProvisionSsl = async (domain: ServerCustomDomain) => {
        if (!uuid) return;
        setActionLoading(`ssl-${domain.id}`);
        setError(null);

        try {
            const res = await provisionServerDomainSsl(uuid, domain.id);
            setDomains((prev) => prev.map((d) => (d.id === domain.id ? res.data : d)));
            if (res.success) {
                setSuccessMessage(`SSL Certificate activated successfully for ${domain.domain}.`);
            } else {
                setError(res.result?.error || 'SSL could not be provisioned automatically. Verify that your DNS A record points to this server IP.');
            }
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || 'Failed to provision SSL certificate.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteDomain = async () => {
        if (!uuid || !deleteTargetDomain) return;
        setActionLoading(`delete-${deleteTargetDomain.id}`);
        setError(null);

        try {
            await deleteServerDomain(uuid, deleteTargetDomain.id);
            setDomains((prev) => prev.filter((d) => d.id !== deleteTargetDomain.id));
            setSuccessMessage(`Custom domain "${deleteTargetDomain.domain}" and Nginx config deleted.`);
            setDeleteTargetDomain(null);
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || 'Failed to delete custom domain.');
        } finally {
            setActionLoading(null);
        }
    };

    const selectedAlloc = allocations.find((a) => a.id === formAllocationId) || primaryAlloc;
    const webDomainsCount = domains.filter((d) => d.protocol === 'http').length;
    const gameDomainsCount = domains.filter((d) => d.protocol === 'game_srv').length;
    const sslActiveCount = domains.filter((d) => d.ssl_status === 'active').length;

    return (
        <div className="w-full text-[#EDEDED] select-none pb-12">
            {/* Top Notifications */}
            {error && (
                <div className="mb-4 bg-[#1F0A0A] border border-[rgba(239,68,68,0.3)] text-[#F87171] px-4 py-3 rounded-md text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                    <button onClick={() => setError(null)} className="text-[#A0A0A0] hover:text-[#FFFFFF] text-sm">&times;</button>
                </div>
            )}

            {successMessage && (
                <div className="mb-4 bg-[#0A1F14] border border-[rgba(16,185,129,0.3)] text-[#10B981] px-4 py-3 rounded-md text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{successMessage}</span>
                    </div>
                    <button onClick={() => setSuccessMessage(null)} className="text-[#A0A0A0] hover:text-[#FFFFFF] text-sm">&times;</button>
                </div>
            )}

            {/* Header section */}
            <div className="bg-[#000000] border border-[#1F1F1F] rounded-lg p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-lg text-[#FFFFFF] font-normal m-0" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.015em' }}>
                                Custom Domains & Nginx Proxy
                            </h1>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#111111] border border-[#242424] text-[#A0A0A0]">
                                Automated Engine
                            </span>
                        </div>
                        <p className="text-xs text-[#8A8A8A] mt-1 m-0">
                            Connect your branded domains to your game server or web services. Automated Nginx reverse proxying with SSL and real-time DNS verification.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] text-xs font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Custom Domain
                    </button>
                </div>

                {/* Telemetry Bento Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#141414]">
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-md p-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#6B7280] font-sans font-semibold block">Active Domains</span>
                        <div className="text-xl font-mono font-semibold text-[#FFFFFF] mt-1">{domains.length}</div>
                        <span className="text-[10px] font-mono text-[#737373] mt-0.5 block">Configured on instance</span>
                    </div>

                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-md p-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#6B7280] font-sans font-semibold block">Web Reverse Proxies</span>
                        <div className="text-xl font-mono font-semibold text-[#60A5FA] mt-1">{webDomainsCount}</div>
                        <span className="text-[10px] font-mono text-[#737373] mt-0.5 block">HTTP/HTTPS ports</span>
                    </div>

                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-md p-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#6B7280] font-sans font-semibold block">Game Port Links</span>
                        <div className="text-xl font-mono font-semibold text-[#34D399] mt-1">{gameDomainsCount}</div>
                        <span className="text-[10px] font-mono text-[#737373] mt-0.5 block">SRV & direct records</span>
                    </div>

                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-md p-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#6B7280] font-sans font-semibold block">SSL / TLS Secured</span>
                        <div className="text-xl font-mono font-semibold text-[#10B981] mt-1">{sslActiveCount}</div>
                        <span className="text-[10px] font-mono text-[#737373] mt-0.5 block">Automated certificates</span>
                    </div>
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <CardListSkeleton count={3} height={90} />
            ) : domains.length === 0 ? (
                <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#141416] border border-[#27272a] text-[#A0A0A0] flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-medium text-[#FFFFFF] m-0" style={{ fontFamily: 'var(--font-display)' }}>No Custom Domains Configured</h3>
                    <p className="text-xs text-[#737373] max-w-md mx-auto mt-1 mb-5">
                        Connect a domain (like <code>play.example.com</code> or <code>dynmap.example.com</code>) to your server allocation. Nginx will automatically handle web proxying, and game servers get SRV linking so players can join without typing a port.
                    </p>
                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] text-xs font-semibold transition-all duration-150 cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Your First Domain
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {domains.map((domain) => {
                        const targetPort = domain.allocation?.port || '—';
                        const targetIp = domain.allocation?.ip_alias || domain.allocation?.ip || '0.0.0.0';
                        const isWeb = domain.protocol === 'http';
                        const isActionBusy = actionLoading?.includes(String(domain.id));

                        return (
                            <div
                                key={domain.id}
                                className="bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#2C2C2C] rounded-lg p-4 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                {/* LEFT: Domain Info */}
                                <div className="flex items-start md:items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-md bg-[#111111] border border-[#242424] flex items-center justify-center text-[#A0A0A0] shrink-0 mt-0.5 md:mt-0">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="2" y1="12" x2="22" y2="12" />
                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                        </svg>
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <a
                                                href={isWeb ? `http://${domain.domain}` : undefined}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm font-semibold text-[#FFFFFF] hover:text-[#38BDF8] font-mono transition-colors duration-150"
                                            >
                                                {domain.domain}
                                            </a>

                                            {/* Service Mode Tag */}
                                            <span
                                                className={`text-[9px] uppercase font-mono font-medium px-2 py-0.5 rounded border ${
                                                    isWeb
                                                        ? 'bg-[#0B1929] border-[#1D3A5F] text-[#60A5FA]'
                                                        : 'bg-[#0B231A] border-[#134E3A] text-[#34D399]'
                                                }`}
                                            >
                                                {isWeb ? 'Web Proxy' : 'Game SRV Port'}
                                            </span>

                                            {/* Nginx Status */}
                                            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#111111] border border-[#242424] text-[#A0A0A0]">
                                                <span className={`w-1.5 h-1.5 rounded-full ${domain.nginx_status === 'configured' ? 'bg-[#10B981]' : domain.nginx_status === 'error' ? 'bg-[#EF4444]' : 'bg-[#F59E0B]'}`} />
                                                Nginx: {domain.nginx_status}
                                            </span>

                                            {/* SSL Status */}
                                            {isWeb && (
                                                <span
                                                    className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                                                        domain.ssl_status === 'active'
                                                            ? 'bg-[#0A1F14] border-[#10B981]/30 text-[#10B981]'
                                                            : domain.ssl_status === 'pending'
                                                            ? 'bg-[#1F190A] border-[#F59E0B]/30 text-[#F59E0B]'
                                                            : 'bg-[#141416] border-[#27272a] text-[#737373]'
                                                    }`}
                                                >
                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                    </svg>
                                                    {domain.ssl_status === 'active' ? 'SSL Active' : domain.ssl_status === 'pending' ? 'SSL Pending' : 'HTTP'}
                                                </span>
                                            )}

                                            {/* DNS Status */}
                                            <span
                                                className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                                                    domain.dns_status === 'verified'
                                                        ? 'bg-[#0A1F14] border-[#10B981]/30 text-[#10B981]'
                                                        : 'bg-[#1F190A] border-[#F59E0B]/30 text-[#F59E0B]'
                                                }`}
                                            >
                                                DNS: {domain.dns_status}
                                            </span>
                                        </div>

                                        {/* Target meta info */}
                                        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#8A8A8A]">
                                            <span>Target: <span className="text-[#EDEDED]">{targetIp}:{targetPort}</span></span>
                                            <span className="text-[#444444]">/</span>
                                            <span>Node: {nodeFqdn || 'Cluster'}</span>
                                            {domain.notes && (
                                                <>
                                                    <span className="text-[#444444]">/</span>
                                                    <span className="italic truncate max-w-[200px]">{domain.notes}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT: Actions Bar */}
                                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                    {/* DNS Setup Guide button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedDnsDomain(domain);
                                            handleVerifyDns(domain);
                                        }}
                                        disabled={isActionBusy}
                                        title="View DNS records to configure"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#141416] hover:bg-[#1E1E22] border border-[#27272A] text-[#D4D4D4] hover:text-[#FFFFFF] text-[11px] font-medium transition-all duration-150 cursor-pointer"
                                    >
                                        <svg className="w-3.5 h-3.5 text-[#A0A0A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                        </svg>
                                        DNS Guide
                                    </button>

                                    {/* Test DNS button */}
                                    <button
                                        type="button"
                                        onClick={() => handleVerifyDns(domain)}
                                        disabled={isActionBusy}
                                        title="Check if domain resolves to this server"
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#141416] hover:bg-[#1E1E22] border border-[#27272A] text-[#A0A0A0] hover:text-[#FFFFFF] text-[11px] transition-all duration-150 cursor-pointer"
                                    >
                                        {actionLoading === `verify-${domain.id}` ? (
                                            <Spinner size="small" />
                                        ) : (
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="23 4 23 10 17 10" />
                                                <polyline points="1 20 1 14 7 14" />
                                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                            </svg>
                                        )}
                                        Test DNS
                                    </button>

                                    {/* Issue SSL Button (Web only) */}
                                    {isWeb && domain.ssl_status !== 'active' && (
                                        <button
                                            type="button"
                                            onClick={() => handleProvisionSsl(domain)}
                                            disabled={isActionBusy}
                                            title="Issue free Let's Encrypt SSL certificate"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0A1F14] hover:bg-[#0D2E1D] border border-[#10B981]/40 text-[#10B981] text-[11px] font-medium transition-all duration-150 cursor-pointer"
                                        >
                                            {actionLoading === `ssl-${domain.id}` ? (
                                                <Spinner size="small" />
                                            ) : (
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                            )}
                                            Issue SSL
                                        </button>
                                    )}

                                    {/* View Nginx Conf button */}
                                    <button
                                        type="button"
                                        onClick={() => setViewNginxDomain(domain)}
                                        title="View generated Nginx configuration"
                                        className="p-1.5 rounded bg-[#141416] hover:bg-[#1E1E22] border border-[#27272A] text-[#A0A0A0] hover:text-[#FFFFFF] transition-all duration-150 cursor-pointer"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="16 18 22 12 16 6" />
                                            <polyline points="8 6 2 12 8 18" />
                                        </svg>
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTargetDomain(domain)}
                                        title="Delete custom domain"
                                        className="p-1.5 rounded bg-[#1F0A0A] hover:bg-[#321010] border border-[#EF4444]/30 text-[#EF4444] hover:text-[#F87171] transition-all duration-150 cursor-pointer"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: Add Custom Domain */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 bg-[#050505] border-b border-[#141414] flex items-center justify-between">
                            <h3 className="text-sm font-medium text-[#FFFFFF] m-0" style={{ fontFamily: 'var(--font-display)' }}>
                                Add Custom Domain & Nginx Proxy
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-[#737373] hover:text-[#FFFFFF] text-lg font-mono leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleCreateDomain} className="p-6 space-y-4">
                            {/* Domain Name */}
                            <div>
                                <label className="text-[11px] font-mono text-[#A0A0A0] uppercase block mb-1.5">
                                    Domain Name <span className="text-[#EF4444]">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. mc.example.com or dynmap.mydomain.com"
                                    value={formDomain}
                                    onChange={(e) => setFormDomain(e.target.value)}
                                    className="w-full bg-[#000000] border border-[#242424] focus:border-[#FFFFFF] rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none transition-colors"
                                />
                                <p className="text-[10px] text-[#737373] mt-1">
                                    Do not include <code>http://</code> or trailing slashes. Enter your root domain or subdomain.
                                </p>
                            </div>

                            {/* Service Type Selection */}
                            <div>
                                <label className="text-[11px] font-mono text-[#A0A0A0] uppercase block mb-1.5">
                                    Service Type / Protocol <span className="text-[#EF4444]">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormProtocol('http')}
                                        className={`p-3 rounded border text-left transition-all ${
                                            formProtocol === 'http'
                                                ? 'bg-[#111111] border-[#FFFFFF] text-[#FFFFFF]'
                                                : 'bg-[#000000] border-[#242424] text-[#8A8A8A] hover:border-[#383838]'
                                        }`}
                                    >
                                        <div className="font-semibold text-xs text-[#FFFFFF] flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-[#60A5FA]" />
                                            Web Service (HTTP/S)
                                        </div>
                                        <p className="text-[10px] text-[#737373] mt-1 mb-0">
                                            Dynmap, BlueMap, APIs, webhooks, voice web client. Automated Nginx reverse proxy + SSL.
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormProtocol('game_srv')}
                                        className={`p-3 rounded border text-left transition-all ${
                                            formProtocol === 'game_srv'
                                                ? 'bg-[#111111] border-[#FFFFFF] text-[#FFFFFF]'
                                                : 'bg-[#000000] border-[#242424] text-[#8A8A8A] hover:border-[#383838]'
                                        }`}
                                    >
                                        <div className="font-semibold text-xs text-[#FFFFFF] flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                                            Game Port (SRV)
                                        </div>
                                        <p className="text-[10px] text-[#737373] mt-1 mb-0">
                                            Minecraft, TeamSpeak, Rust. Joins without entering port via RFC standard SRV DNS records.
                                        </p>
                                    </button>
                                </div>
                            </div>

                            {/* Target Allocation Selector */}
                            <div>
                                <label className="text-[11px] font-mono text-[#A0A0A0] uppercase block mb-1.5">
                                    Target Port / Allocation <span className="text-[#EF4444]">*</span>
                                </label>
                                <select
                                    value={formAllocationId}
                                    onChange={(e) => setFormAllocationId(Number(e.target.value))}
                                    className="w-full bg-[#000000] border border-[#242424] focus:border-[#FFFFFF] rounded px-3 py-2 text-xs font-mono text-[#FFFFFF] outline-none transition-colors"
                                >
                                    {allocations.map((alloc) => (
                                        <option key={alloc.id} value={alloc.id}>
                                            Port {alloc.port} ({alloc.alias || alloc.ip}) {alloc.isDefault ? '— Primary Port' : ''} {alloc.notes ? `[${alloc.notes}]` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-[#737373] mt-1">
                                    Requests to this custom domain will route directly to this port on your container.
                                </p>
                            </div>

                            {/* SSL Checkbox for Web */}
                            {formProtocol === 'http' && (
                                <div className="bg-[#000000] border border-[#1F1F1F] p-3 rounded flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-medium text-[#FFFFFF]">Automated SSL / HTTPS</div>
                                        <div className="text-[10px] text-[#737373]">Provision free Let's Encrypt certificate once DNS is verified</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={formSslEnabled}
                                        onChange={(e) => setFormSslEnabled(e.target.checked)}
                                        className="w-4 h-4 accent-[#FFFFFF] cursor-pointer"
                                    />
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="text-[11px] font-mono text-[#A0A0A0] uppercase block mb-1.5">
                                    Notes (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Production web map"
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    className="w-full bg-[#000000] border border-[#242424] focus:border-[#FFFFFF] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="pt-3 border-t border-[#141414] flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 rounded bg-[#141416] hover:bg-[#1E1E22] text-[#A0A0A0] hover:text-[#FFFFFF] text-xs font-medium transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading === 'create'}
                                    className="px-4 py-2 rounded bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] text-xs font-semibold transition-all flex items-center gap-2"
                                >
                                    {actionLoading === 'create' ? <Spinner size="small" /> : null}
                                    Create & Configure Nginx
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: DNS Setup Guide */}
            {selectedDnsDomain && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg max-w-xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 bg-[#050505] border-b border-[#141414] flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-[#FFFFFF] m-0" style={{ fontFamily: 'var(--font-display)' }}>
                                    DNS Setup Guide for {selectedDnsDomain.domain}
                                </h3>
                                <span className="text-[10px] font-mono text-[#8A8A8A]">
                                    Configure these records in Cloudflare, Namecheap, GoDaddy, or Route53
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedDnsDomain(null);
                                    setDnsDiagnostics(null);
                                }}
                                className="text-[#737373] hover:text-[#FFFFFF] text-lg font-mono leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            {/* Live Verification Banner */}
                            {dnsDiagnostics && (
                                <div
                                    className={`p-3 rounded border text-xs font-mono flex items-center justify-between ${
                                        dnsDiagnostics.verified
                                            ? 'bg-[#0A1F14] border-[#10B981]/30 text-[#10B981]'
                                            : 'bg-[#1F190A] border-[#F59E0B]/30 text-[#F59E0B]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${dnsDiagnostics.verified ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
                                        <span>
                                            {dnsDiagnostics.verified
                                                ? 'DNS records verified and resolving to your node!'
                                                : 'DNS record pending or propagating (allow 2-10 mins)'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-[#A0A0A0]">
                                        Resolved: {dnsDiagnostics.resolved_ips?.join(', ') || 'None'}
                                    </span>
                                </div>
                            )}

                            {/* RECORD 1: A / CNAME RECORD */}
                            <div className="bg-[#000000] border border-[#1F1F1F] rounded-md p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 rounded bg-[#1A1A1A] border border-[#2B2B2B] text-[10px] font-mono text-[#60A5FA]">
                                            Record 1: CNAME / A Record
                                        </span>
                                        <span>Host IP Routing</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                                    <div className="bg-[#0A0A0A] p-2 rounded border border-[#171717]">
                                        <span className="text-[#737373] text-[9px] uppercase block">Type</span>
                                        <span className="text-[#EDEDED]">CNAME or A</span>
                                    </div>
                                    <div className="bg-[#0A0A0A] p-2 rounded border border-[#171717]">
                                        <span className="text-[#737373] text-[9px] uppercase block">Name / Host</span>
                                        <span className="text-[#EDEDED] truncate block">{selectedDnsDomain.domain.split('.')[0]}</span>
                                    </div>
                                    <div className="bg-[#0A0A0A] p-2 rounded border border-[#171717]">
                                        <span className="text-[#737373] text-[9px] uppercase block">Target / Value</span>
                                        <span className="text-[#10B981] truncate block">{nodeFqdn || selectedDnsDomain.allocation?.ip}</span>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(nodeFqdn || selectedDnsDomain.allocation?.ip || '', 'target')}
                                        className="text-[11px] text-[#A0A0A0] hover:text-[#FFFFFF] flex items-center gap-1 cursor-pointer"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                        {copiedKey === 'target' ? 'Copied!' : 'Copy Target Value'}
                                    </button>
                                </div>
                            </div>

                            {/* RECORD 2: SRV RECORD (If game port) */}
                            {selectedDnsDomain.protocol === 'game_srv' && (
                                <div className="bg-[#000000] border border-[#1F1F1F] rounded-md p-3.5 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.5 rounded bg-[#1A1A1A] border border-[#2B2B2B] text-[10px] font-mono text-[#34D399]">
                                                Record 2: SRV Record
                                            </span>
                                            <span>Minecraft & Game Port Link</span>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-[#8A8A8A] m-0">
                                        Allows players to join <strong>{selectedDnsDomain.domain}</strong> in their client without typing port <code>:{selectedDnsDomain.allocation?.port}</code>.
                                    </p>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                                        <div className="bg-[#0A0A0A] p-2 rounded border border-[#171717]">
                                            <span className="text-[#737373] text-[9px] uppercase block">Service</span>
                                            <span className="text-[#EDEDED]">_minecraft</span>
                                        </div>
                                        <div className="bg-[#0A0A0A] p-2 rounded border border-[#171717]">
                                            <span className="text-[#737373] text-[9px] uppercase block">Protocol</span>
                                            <span className="text-[#EDEDED]">_tcp</span>
                                        </div>
                                        <div className="bg-[#0A0A0A] p-2 rounded border border-[#171717]">
                                            <span className="text-[#737373] text-[9px] uppercase block">Port</span>
                                            <span className="text-[#10B981]">{selectedDnsDomain.allocation?.port}</span>
                                        </div>
                                        <div className="bg-[#0A0A0A] p-2 rounded border border-[#171717]">
                                            <span className="text-[#737373] text-[9px] uppercase block">Target</span>
                                            <span className="text-[#EDEDED] truncate block">{selectedDnsDomain.domain}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-[10px] text-[#737373] font-mono">Priority: 0 | Weight: 5</span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(`_minecraft._tcp.${selectedDnsDomain.domain} IN SRV 0 5 ${selectedDnsDomain.allocation?.port} ${selectedDnsDomain.domain}.`, 'srv')}
                                            className="text-[11px] text-[#A0A0A0] hover:text-[#FFFFFF] flex items-center gap-1 cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                            {copiedKey === 'srv' ? 'Copied!' : 'Copy Bind String'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 flex items-center justify-between border-t border-[#141414]">
                                <button
                                    type="button"
                                    onClick={() => handleVerifyDns(selectedDnsDomain)}
                                    disabled={actionLoading === `verify-${selectedDnsDomain.id}`}
                                    className="px-3 py-1.5 rounded bg-[#141416] hover:bg-[#1E1E22] text-[#EDEDED] text-xs font-medium flex items-center gap-2"
                                >
                                    {actionLoading === `verify-${selectedDnsDomain.id}` ? <Spinner size="small" /> : null}
                                    Re-check Live DNS
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedDnsDomain(null);
                                        setDnsDiagnostics(null);
                                    }}
                                    className="px-4 py-1.5 rounded bg-[#FFFFFF] text-[#000000] text-xs font-semibold"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: View Nginx Conf */}
            {viewNginxDomain && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg max-w-2xl w-full overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 bg-[#050505] border-b border-[#141414] flex items-center justify-between">
                            <h3 className="text-sm font-medium text-[#FFFFFF] m-0" style={{ fontFamily: 'var(--font-display)' }}>
                                Generated Nginx Configuration
                            </h3>
                            <button
                                type="button"
                                onClick={() => setViewNginxDomain(null)}
                                className="text-[#737373] hover:text-[#FFFFFF] text-lg font-mono leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-6 space-y-3">
                            <div className="text-[11px] font-mono text-[#737373]">
                                File: <code className="text-[#10B981]">{viewNginxDomain.nginx_config_path || `lunar_${viewNginxDomain.id}_${viewNginxDomain.domain}.conf`}</code>
                            </div>

                            <pre className="bg-[#000000] border border-[#1F1F1F] p-4 rounded text-[11px] font-mono text-[#D4D4D4] overflow-x-auto max-h-[50vh] leading-relaxed">
{`# Automated Reverse Proxy Configuration
# Domain: ${viewNginxDomain.domain} -> ${viewNginxDomain.allocation?.ip}:${viewNginxDomain.allocation?.port}

server {
    listen 80;
    listen [::]:80;
    server_name ${viewNginxDomain.domain};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files $uri =404;
    }

    location / {
        proxy_pass http://${viewNginxDomain.allocation?.ip === '0.0.0.0' ? (nodeFqdn || '127.0.0.1') : viewNginxDomain.allocation?.ip}:${viewNginxDomain.allocation?.port};
        proxy_http_version 1.1;

        # WebSocket Forwarding
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard Forwarding Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}`}
                            </pre>

                            <div className="flex items-center justify-between pt-2">
                                <span className="text-[10px] text-[#737373]">Atomic write & syntax-tested via <code>nginx -t</code></span>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(viewNginxDomain.nginx_config_path || '', 'confpath')}
                                    className="px-3 py-1.5 rounded bg-[#141416] hover:bg-[#1E1E22] text-[#D4D4D4] text-xs font-mono"
                                >
                                    {copiedKey === 'confpath' ? 'Copied Path!' : 'Copy Config Path'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Delete Confirmation */}
            {deleteTargetDomain && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#1F0A0A] border border-[rgba(239,68,68,0.3)] text-[#EF4444] flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-[#FFFFFF] m-0">Remove Custom Domain?</h4>
                                <p className="text-xs text-[#737373] mt-0.5 m-0">
                                    This will unlink <code className="text-[#FFFFFF]">{deleteTargetDomain.domain}</code> and delete its Nginx reverse proxy configuration.
                                </p>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteTargetDomain(null)}
                                className="px-4 py-2 rounded bg-[#141416] text-[#A0A0A0] hover:text-[#FFFFFF] text-xs font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteDomain}
                                disabled={actionLoading === `delete-${deleteTargetDomain.id}`}
                                className="px-4 py-2 rounded bg-[#EF4444] hover:bg-[#DC2626] text-[#FFFFFF] text-xs font-semibold flex items-center gap-2"
                            >
                                {actionLoading === `delete-${deleteTargetDomain.id}` ? <Spinner size="small" /> : null}
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};