import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import QRCode from 'qrcode.react';
import http from '@/api/http';
import { rawDataToServerObject, Server } from '@/api/server/getServer';
import { useStoreState } from '@/state/hooks';

export interface ClientRenewalRecord {
    id: number;
    server_id: number;
    user_id: number;
    amount: number;
    upi_id: string;
    payer_name: string | null;
    payment_note?: string | null;
    utr_number: string;
    screenshot_path: string;
    status: 'pending' | 'approved' | 'rejected';
    grace_period_granted: boolean;
    grace_period_expires_at: string | null;
    is_suspicious: boolean;
    suspicious_reason: string | null;
    rejection_reason: string | null;
    created_at: string;
    server?: {
        id: number;
        uuid: string;
        uuidShort: string;
        name: string;
        expires_at: string | null;
        status: string | null;
    };
}

interface UpiConfig {
    upi_id: string;
    payee_name: string;
}

const formatInr = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount || 0);
};

const formatDateDisplay = (dateString?: string | null) => {
    if (!dateString) return 'Never (Permanent)';
    try {
        const clean = dateString.includes('T') ? dateString.split('T')[0] : dateString;
        const [yyyy, mm, dd] = clean.split('-');
        if (yyyy && mm && dd) {
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            return d.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        }
        return dateString;
    } catch {
        return dateString;
    }
};

const getDiffDays = (dateString?: string | null): number | null => {
    if (!dateString) return null;
    try {
        const clean = dateString.includes('T') ? dateString.split('T')[0] : dateString;
        const [yyyy, mm, dd] = clean.split('-');
        const target = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
        return null;
    }
};

export const ClientBillingView: React.FC = () => {
    const history = useHistory();
    const location = useLocation();
    const currentUser = useStoreState((state) => state.user.data);
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedServer, setSelectedServer] = useState<Server | null>(null);
    const [renewing, setRenewing] = useState(false);
    const [notice, setNotice] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

    // Dynamic UPI Config from Admin Settings
    const [upiConfig, setUpiConfig] = useState<UpiConfig>({
        upi_id: 'votion@upi',
        payee_name: 'Votion Game Infrastructure',
    });

    // Form inputs for renewal payment
    const [payerName, setPayerName] = useState('');
    const [utrNumber, setUtrNumber] = useState('');
    const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [copiedUpi, setCopiedUpi] = useState(false);
    const [copiedNote, setCopiedNote] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Submitted payment records from backend
    const [payments, setPayments] = useState<ClientRenewalRecord[]>([]);

    // Fetch UPI Gateway Config
    const fetchUpiConfig = () => {
        http.get('/api/client/billing/config')
            .then(({ data }) => {
                if (data && data.data) {
                    setUpiConfig(data.data);
                }
            })
            .catch(() => {});
    };

    // Fetch client payment submissions
    const fetchPayments = () => {
        http.get('/api/client/billing/payments')
            .then(({ data }) => {
                if (data && data.data) {
                    setPayments(data.data);
                }
            })
            .catch(() => {});
    };

    // Fetch servers from API
    const fetchServers = () => {
        setLoading(true);
        http.get('/api/client')
            .then(({ data }) => {
                if (data && data.data) {
                    const loadedServers: Server[] = data.data.map(rawDataToServerObject);
                    setServers(loadedServers);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchServers();
        fetchUpiConfig();
        fetchPayments();
    }, []);

    // Auto-dismiss toast
    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 6000);
        return () => clearTimeout(timer);
    }, [notice]);

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
            setFormError('Only JPEG, PNG, or WebP screenshot images are supported.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setFormError('Screenshot image must be under 10MB.');
            return;
        }

        setFormError(null);
        setScreenshotFile(file);

        const reader = new FileReader();
        reader.onloadend = () => {
            setScreenshotPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Dynamic renewal amount & individual note containing username
    const currentRenewalAmount = selectedServer ? (selectedServer.billingAmount || 499) : 499;

    const individualNote = useMemo(() => {
        if (!selectedServer) return '';
        const rawUser = currentUser?.username || 'user';
        const safeUser = rawUser.replace(/[^a-zA-Z0-9_-]/g, '') || 'client';
        const safeServer = (selectedServer.name || 'srv').replace(/[^a-zA-Z0-9_-]/g, '') || 'game';
        return `Renewal-${safeUser}-${safeServer}`.slice(0, 48);
    }, [currentUser?.username, selectedServer?.name]);

    const { upiUri, phonepeUri, paytmUri, gpayUri } = useMemo(() => {
        if (!selectedServer) {
            return { upiUri: '', phonepeUri: '', paytmUri: '', gpayUri: '' };
        }
        const params = new URLSearchParams({
            pa: upiConfig.upi_id,
            pn: upiConfig.payee_name,
            am: String(currentRenewalAmount),
            cu: 'INR',
            tn: individualNote,
        });
        const qs = params.toString();

        return {
            upiUri: `upi://pay?${qs}`,
            phonepeUri: `phonepe://pay?${qs}`,
            paytmUri: `paytmmp://pay?${qs}`,
            gpayUri: `tez://upi/pay?${qs}`,
        };
    }, [selectedServer, upiConfig, currentRenewalAmount, individualNote]);

    // Open dedicated full-screen checkout page
    const handleOpenCheckout = (server: Server, pushHistory = true) => {
        setSelectedServer(server);
        setPayerName('');
        setUtrNumber('');
        setScreenshotFile(null);
        setScreenshotPreview(null);
        setFormError(null);
        setCopiedUpi(false);
        setCopiedNote(false);
        if (pushHistory) {
            history.push(`/billing?renew=${server.uuid}`);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Return back to billing overview
    const handleBackToBilling = () => {
        setSelectedServer(null);
        setFormError(null);
        history.push('/billing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Synchronize URL query parameter with checkout state
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const renewUuid = params.get('renew');
        if (renewUuid && servers.length > 0 && !selectedServer) {
            const found = servers.find((s) => s.uuid === renewUuid || s.id === renewUuid || String(s.internalId) === renewUuid || s.uuid.startsWith(renewUuid));
            if (found) {
                handleOpenCheckout(found, false);
            }
        } else if (!renewUuid && selectedServer) {
            setSelectedServer(null);
        }
    }, [location.search, servers]);

    // Copy Merchant UPI ID
    const handleCopyUpi = () => {
        navigator.clipboard.writeText(upiConfig.upi_id);
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2500);
    };

    // Copy Individual Payment Note
    const handleCopyNote = () => {
        if (!individualNote) return;
        navigator.clipboard.writeText(individualNote);
        setCopiedNote(true);
        setTimeout(() => setCopiedNote(false), 2500);
    };

    // Handle Renewal Payment Submission
    const handleConfirmRenewal = () => {
        if (!selectedServer) return;

        // Front-end sanity check
        if (!payerName.trim() || payerName.trim().length < 2) {
            setFormError('Please enter your full payer name as shown on your UPI app.');
            return;
        }

        const cleanUtr = utrNumber.trim();
        if (!cleanUtr) {
            setFormError('Please enter the 12-digit UPI Reference / UTR Number.');
            return;
        }

        if (!/^\d{12}$/.test(cleanUtr)) {
            setFormError('Invalid UTR format: The UTR / Ref number must be exactly 12 numeric digits.');
            return;
        }

        if (!screenshotFile) {
            setFormError('Please upload your payment screenshot receipt.');
            return;
        }

        setRenewing(true);
        setFormError(null);

        const renewalAmount = selectedServer.billingAmount || 499;
        const formData = new FormData();
        formData.append('amount', String(renewalAmount));
        formData.append('utr_number', cleanUtr);
        formData.append('payer_name', payerName.trim());
        formData.append('payment_note', individualNote);
        formData.append('screenshot', screenshotFile);

        http.post(`/api/client/billing/renew/${selectedServer.uuid}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
            .then(({ data }) => {
                if (data.grace_period_granted) {
                    setNotice({
                        text: `⚡ 12-Hour Grace Period Activated! Server "${selectedServer.name}" is turned ON while admin validates your payment.`,
                        type: 'success',
                    });
                } else if (data.is_suspicious) {
                    setNotice({
                        text: `⚠️ Notice: ${data.message}`,
                        type: 'warning',
                    });
                } else {
                    setNotice({
                        text: `Payment submitted! Renewal for "${selectedServer.name}" is queued for admin verification.`,
                        type: 'success',
                    });
                }

                setSelectedServer(null);
                history.push('/billing');
                fetchServers();
                fetchPayments();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            })
            .catch((err) => {
                const msg = err.response?.data?.message || err.response?.data?.errors?.screenshot?.[0] || err.response?.data?.errors?.utr_number?.[0] || 'Payment submission failed. Please check your inputs and try again.';
                setFormError(msg);
            })
            .finally(() => {
                setRenewing(false);
            });
    };

    const handlePrintReceipt = (payment: ClientRenewalRecord) => {
        const win = window.open('', '_blank', 'width=650,height=750');
        if (!win) return;

        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - RENEW-${payment.id}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; max-width: 580px; margin: auto; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
                    .title { font-size: 24px; font-weight: 700; margin: 0; }
                    .table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                    .table th, .table td { border-bottom: 1px solid #ddd; padding: 12px 8px; text-align: left; }
                    .total { font-size: 20px; font-weight: 800; text-align: right; margin-top: 20px; color: #059669; }
                    .btn { display: block; margin-top: 30px; padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer; text-align: center; }
                    @media print { .btn { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h2 style="margin:0;">Votion Game Infrastructure</h2>
                        <p style="margin:4px 0 0; color:#666; font-size:12px;">UPI Payment Reference</p>
                    </div>
                    <div style="text-align: right;">
                        <h1 class="title">RENEWAL RECEIPT</h1>
                        <p style="margin:4px 0 0; font-family:monospace;">UTR: ${payment.utr_number}</p>
                    </div>
                </div>
                <p><strong>Server:</strong> ${payment.server?.name || 'Game Server'}</p>
                <p><strong>Payer:</strong> ${payment.payer_name || 'Customer'}</p>
                ${payment.payment_note ? `<p><strong>Payment Note:</strong> <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px;font-family:monospace;">${payment.payment_note}</code></p>` : ''}
                <p><strong>Date:</strong> ${new Date(payment.created_at).toLocaleString()}</p>
                <p><strong>Status:</strong> ${payment.status.toUpperCase()}</p>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Gateway</th>
                            <th style="text-align:right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Game Server Renewal (30 Days)</td>
                            <td>UPI / GPay (${payment.upi_id})</td>
                            <td style="text-align:right;">${formatInr(payment.amount)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="total">Total Paid: ${formatInr(payment.amount)}</div>

                <button class="btn" onclick="window.print()">Print or Save PDF Receipt</button>
            </body>
            </html>
        `);
        win.document.close();
    };

    // Dedicated Full-Screen Payment Section (Page)
    if (selectedServer) {
        return (
            <div className="client-renewal-checkout-page max-w-6xl mx-auto space-y-6 pb-16 font-sans select-none text-[#F3F4F6]">
                {/* Notification Toast */}
                {notice && (
                    <div
                        role="status"
                        aria-live="polite"
                        className={`flex items-center justify-between px-4 py-3 rounded-lg border text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 ${
                            notice.type === 'success'
                                ? 'border-emerald-500/40 bg-emerald-950/70 text-emerald-200'
                                : notice.type === 'warning'
                                ? 'border-amber-500/40 bg-amber-950/70 text-amber-200'
                                : 'border-red-500/40 bg-red-950/70 text-red-200'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${notice.type === 'success' ? 'bg-emerald-400' : notice.type === 'warning' ? 'bg-amber-400' : 'bg-red-400'} animate-pulse`} aria-hidden="true" />
                            <span>{notice.text}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setNotice(null)}
                            className="text-inherit opacity-70 hover:opacity-100 bg-transparent border-none cursor-pointer text-xs ml-4"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Top Breadcrumb & Navigation */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1F1F1F]">
                    <div className="flex items-center gap-2 text-xs font-mono text-[#71717A]">
                        <button
                            type="button"
                            onClick={handleBackToBilling}
                            className="text-[#9A9AA2] hover:text-[#FFFFFF] bg-transparent border-none p-0 cursor-pointer flex items-center gap-1.5 transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 font-mono"
                        >
                            <span className="text-sm">←</span>
                            <span>Billing & Renewals</span>
                        </button>
                        <span>/</span>
                        <span className="text-[#EDEDED]">UPI Checkout</span>
                        <span>/</span>
                        <span className="text-emerald-400 font-semibold truncate max-w-xs">{selectedServer.name}</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleBackToBilling}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0E0E11] hover:bg-[#16161A] text-xs font-medium text-[#9A9AA2] hover:text-[#FFFFFF] border border-[#242424] hover:border-[#383838] transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                        <span>← Back to Billing</span>
                    </button>
                </div>

                {/* Page Title & Context */}
                <div className="pt-2">
                    <div className="flex items-center gap-2.5 mb-2">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider bg-emerald-950/50 text-emerald-400 border border-emerald-500/30">
                            Secure Checkout
                        </span>
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider bg-zinc-900 text-zinc-400 border border-zinc-800">
                            Server #{selectedServer.id || selectedServer.uuid.slice(0, 8)}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-serif font-normal text-[#FFFFFF] m-0 tracking-tight">
                        Renew Server: {selectedServer.name}
                    </h1>
                    <p className="text-xs sm:text-sm text-[#8A8A8A] mt-2 max-w-3xl m-0 font-sans leading-relaxed">
                        Complete your monthly game server extension via Google Pay, PhonePe, Paytm, or BHIM. Your renewal note is individualized to your account to automate verification and activate 12-hour grace period protection.
                    </p>
                </div>

                {/* Server Quick Status Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 rounded-xl bg-[#0A0A0A] border border-[#1F1F1F]">
                    <div>
                        <span className="text-[10px] font-mono uppercase text-[#71717A] block">Target Server</span>
                        <span className="text-sm font-semibold text-white truncate block mt-0.5">{selectedServer.name}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-mono uppercase text-[#71717A] block">Current Expiry</span>
                        <span className="text-sm font-mono text-zinc-300 block mt-0.5">{formatDateDisplay(selectedServer.expiresAt)}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-mono uppercase text-[#71717A] block">Extension Term</span>
                        <span className="text-sm font-mono text-emerald-400 font-semibold block mt-0.5">+30 Days Added</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-mono uppercase text-[#71717A] block">Renewal Fee</span>
                        <span className="text-base font-bold text-amber-400 font-mono block mt-0.5">{formatInr(currentRenewalAmount)}</span>
                    </div>
                </div>

                {/* Two-Column Checkout Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: QR Code, Payment Instructions, Reference Note & Mobile Pay */}
                    <div className="lg:col-span-5 space-y-4">
                        {/* Payment Verification Notice Banner */}
                        <div className="bg-[#0f0c05] border border-amber-500/30 rounded-xl p-4 text-xs text-amber-200/90 leading-relaxed shadow-sm">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                <div className="space-y-1.5">
                                    <div className="text-amber-300 font-semibold text-xs tracking-wide">
                                        Payment Notice: Scan QR or Use Mobile Pay
                                    </div>
                                    <p className="m-0 text-amber-100/80 leading-relaxed text-xs">
                                        Please complete payment by scanning the QR code below in your UPI app or by tapping <strong className="text-white font-medium">Mobile Quick Pay</strong>. Avoid manual transfers using only the raw UPI ID.
                                    </p>
                                    <ul className="m-0 p-0 pl-4 list-disc space-y-1 text-amber-200/70 text-[11px] pt-1">
                                        <li>
                                            Scanning automatically locks in your exact fee (<strong>₹{currentRenewalAmount}</strong>) and your account reference note (<code className="bg-black/60 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-[11px]">{individualNote}</code>).
                                        </li>
                                        <li>
                                            Transfers sent without this reference note cannot be automatically reconciled and may delay server renewal.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* High-Resolution Dynamic UPI QR Code Card */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-6 flex flex-col items-center text-center space-y-4 shadow-xl">
                            <div className="bg-white p-3.5 rounded-2xl shadow-2xl border border-zinc-200 flex flex-col items-center justify-center">
                                <QRCode
                                    value={upiUri}
                                    size={200}
                                    level="M"
                                    renderAs="svg"
                                />
                                <span className="text-[10px] text-zinc-600 font-medium mt-2 tracking-wider uppercase block">
                                    Scan to Pay via UPI
                                </span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-[#FFFFFF] block">
                                    Google Pay • PhonePe • Paytm • BHIM • Cred
                                </span>
                                <span className="text-xs text-[#71717A] block font-mono">
                                    Amount: <strong className="text-white font-bold">{formatInr(currentRenewalAmount)}</strong> (Fixed Monthly)
                                </span>
                            </div>
                        </div>

                        {/* Individual Payment Note Card */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-4 space-y-2">
                            <span className="text-[10px] text-[#71717A] block font-mono uppercase tracking-wider">
                                Payment Reference Note
                            </span>
                            <div className="flex items-center justify-between gap-2 bg-[#000000] border border-[#262626] rounded-lg p-3">
                                <span className="text-sm font-mono font-bold text-emerald-400 truncate">
                                    {individualNote}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCopyNote}
                                    className="px-3 py-1.5 rounded bg-[#18181B] hover:bg-[#27272A] text-xs text-[#EDEDED] hover:text-[#FFFFFF] cursor-pointer border border-[#2B2B32] transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 shrink-0 font-medium"
                                >
                                    {copiedNote ? '✓ Copied!' : 'Copy Note'}
                                </button>
                            </div>
                            <span className="text-[11px] text-[#71717A] block">
                                Embedded in the QR code and unique to your account (<strong className="text-zinc-300">{currentUser?.username || 'Client'}</strong>). Used for automated verification.
                            </span>
                        </div>

                        {/* Dedicated Mobile Quick Pay Card */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                    </svg>
                                    <div>
                                        <h3 className="text-sm font-serif font-normal text-white m-0">Mobile Quick Pay</h3>
                                        <span className="text-[11px] text-[#71717A] block">
                                            Open checkout directly in your installed UPI app
                                        </span>
                                    </div>
                                </div>
                                <span className="text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 font-mono px-2 py-0.5 rounded font-medium">
                                    Direct App
                                </span>
                            </div>

                            {/* Primary Universal Link */}
                            <a
                                href={upiUri}
                                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs shadow-md transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98] text-center no-underline cursor-pointer"
                            >
                                <span>Pay via Installed UPI App (GPay / PhonePe / Paytm / BHIM)</span>
                            </a>

                            {/* Direct App Buttons */}
                            <div className="grid grid-cols-3 gap-2.5 pt-1">
                                <a
                                    href={gpayUri}
                                    className="py-2 px-3 rounded-lg bg-[#141418] hover:bg-[#1E1E24] text-[#EDEDED] hover:text-white border border-[#27272F] text-xs font-medium text-center no-underline transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <span>Google Pay</span>
                                </a>
                                <a
                                    href={phonepeUri}
                                    className="py-2 px-3 rounded-lg bg-[#141418] hover:bg-[#1E1E24] text-[#EDEDED] hover:text-white border border-[#27272F] text-xs font-medium text-center no-underline transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <span>PhonePe</span>
                                </a>
                                <a
                                    href={paytmUri}
                                    className="py-2 px-3 rounded-lg bg-[#141418] hover:bg-[#1E1E24] text-[#EDEDED] hover:text-white border border-[#27272F] text-xs font-medium text-center no-underline transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <span>Paytm</span>
                                </a>
                            </div>
                        </div>

                        {/* Merchant UPI ID Reference */}
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <span className="text-[10px] text-[#71717A] block font-mono">UPI ID (Reference Only):</span>
                                    <span className="text-xs font-mono font-semibold text-[#FFFFFF] truncate block">
                                        {upiConfig.upi_id}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopyUpi}
                                    className="px-2.5 py-1 rounded bg-[#1C1C20] hover:bg-[#27272A] text-[10px] text-[#EDEDED] hover:text-[#FFFFFF] cursor-pointer border border-[#2B2B32] transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 shrink-0 font-medium"
                                >
                                    {copiedUpi ? '✓ Copied' : 'Copy ID'}
                                </button>
                            </div>
                            <div className="flex items-center justify-between mt-2 text-[10px] text-[#71717A]">
                                <span>Payee: <strong className="text-[#D4D4D8] font-medium">{upiConfig.payee_name}</strong></span>
                                <span className="text-amber-400/80 font-medium text-[10px]">Scanning QR is recommended</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Payment Proof Submission Form */}
                    <div className="lg:col-span-7">
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-6 sm:p-7 space-y-5 shadow-xl">
                            <div className="border-b border-[#1F1F1F] pb-4">
                                <h2 className="text-xl font-serif font-normal text-[#FFFFFF] m-0">
                                    Submit Payment Proof
                                </h2>
                                <p className="text-xs text-[#8A8A8A] mt-1 m-0 font-sans leading-relaxed">
                                    After transferring <strong>{formatInr(currentRenewalAmount)}</strong>, enter your UPI details and upload receipt proof below.
                                </p>
                            </div>

                            {formError && (
                                <div className="bg-red-950/60 border border-red-500/40 text-red-200 text-xs p-3 rounded-lg flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>{formError}</span>
                                </div>
                            )}

                            <div className="space-y-4 text-xs">
                                <div>
                                    <label className="block text-xs font-medium text-[#D4D4D8] mb-1.5">
                                        Payer Name on UPI / Bank <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Rahul Sharma"
                                        value={payerName}
                                        onChange={(e) => setPayerName(e.target.value)}
                                        className="w-full bg-[#000000] border border-[#262626] rounded-lg px-3.5 py-2.5 text-xs text-[#FFFFFF] outline-none transition-colors focus:border-white focus:ring-1 focus:ring-white placeholder-[#52525B]"
                                    />
                                    <span className="text-[10px] text-[#71717A] block mt-1">
                                        Must match the name shown on your Google Pay / PhonePe / bank receipt.
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-medium text-[#D4D4D8]">
                                            12-Digit UPI Reference / UTR Number <span className="text-red-400">*</span>
                                        </label>
                                        <span className={`text-[10px] font-mono ${utrNumber.length === 12 ? 'text-emerald-400 font-bold' : 'text-[#71717A]'}`}>
                                            {utrNumber.length} / 12 digits
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={12}
                                        placeholder="e.g. 424109834521"
                                        value={utrNumber}
                                        onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, ''))}
                                        className="w-full bg-[#000000] border border-[#262626] rounded-lg px-3.5 py-2.5 text-xs text-[#FFFFFF] font-mono tracking-wider outline-none transition-colors focus:border-white focus:ring-1 focus:ring-white placeholder-[#52525B]"
                                    />
                                    <span className="text-[10px] text-[#71717A] block mt-1 font-mono">
                                        12 numeric digits from your payment receipt (UTR, UPI Ref No., or Txn ID).
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-[#D4D4D8] mb-1.5">
                                        Upload Payment Receipt Screenshot <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />

                                    {screenshotPreview ? (
                                        <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[#000000] border border-[#262626]">
                                            <img
                                                src={screenshotPreview}
                                                alt="Receipt Preview"
                                                className="w-16 h-16 object-cover rounded-lg border border-[#2B2B32]"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs text-[#FFFFFF] font-medium truncate block">
                                                    {screenshotFile?.name}
                                                </span>
                                                <span className="text-[11px] text-[#71717A] font-mono block mt-0.5">
                                                    {screenshotFile ? (screenshotFile.size / 1024).toFixed(1) + ' KB' : ''} • Image Verified
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setScreenshotFile(null);
                                                    setScreenshotPreview(null);
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                className="px-3 py-1.5 rounded-md bg-[#18181B] hover:bg-[#27272A] text-xs text-red-400 border border-[#27272A] cursor-pointer transition-colors font-medium"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full py-7 px-4 border border-dashed border-[#2B2B32] hover:border-[#52525B] rounded-xl text-center cursor-pointer bg-[#000000] hover:bg-[#070709] transition-colors block"
                                        >
                                            <svg className="w-6 h-6 text-zinc-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="block text-xs font-medium text-[#EDEDED]">
                                                Click or drag payment receipt screenshot to upload
                                            </span>
                                            <span className="text-[10px] text-[#71717A] mt-1 block font-mono">
                                                Supported formats: JPG, PNG, or WebP (max 10MB)
                                            </span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-[#1F1F1F] flex flex-col sm:flex-row items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={handleBackToBilling}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-transparent hover:bg-[#18181B] text-[#9A9AA2] hover:text-[#FFFFFF] text-xs font-medium cursor-pointer border border-[#262626] transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 text-center"
                                >
                                    Cancel & Return
                                </button>

                                <button
                                    type="button"
                                    onClick={handleConfirmRenewal}
                                    disabled={renewing}
                                    className="w-full sm:w-auto px-7 py-3 rounded-lg bg-[#FFFFFF] hover:bg-[#EDEDED] active:bg-[#D4D4D8] text-[#000000] text-xs font-bold cursor-pointer border-none flex items-center justify-center gap-2 shadow-xl transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98] disabled:opacity-50"
                                >
                                    {renewing ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            <span>Submitting & Verifying...</span>
                                        </>
                                    ) : (
                                        `Confirm & Submit Payment (${formatInr(currentRenewalAmount)})`
                                    )}
                                </button>
                            </div>

                            <div className="pt-2 text-[11px] text-[#71717A] flex items-center gap-2 font-sans border-t border-[#1F1F1F]/60">
                                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span>Protected by automated verification. Suspended servers receive an automatic 12-hour grace period upon submission.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="client-billing-page max-w-6xl mx-auto space-y-6 pb-12 font-sans select-none text-[#F3F4F6]">
            {/* Notification Toast */}
            {notice && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 ${
                        notice.type === 'success'
                            ? 'border-emerald-500/40 bg-emerald-950/70 text-emerald-200'
                            : notice.type === 'warning'
                            ? 'border-amber-500/40 bg-amber-950/70 text-amber-200'
                            : 'border-red-500/40 bg-red-950/70 text-red-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${notice.type === 'success' ? 'bg-emerald-400' : notice.type === 'warning' ? 'bg-amber-400' : 'bg-red-400'} animate-pulse`} aria-hidden="true" />
                        <span>{notice.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setNotice(null)}
                        className="text-inherit opacity-70 hover:opacity-100 bg-transparent border-none cursor-pointer text-xs ml-4"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="border-b border-[#242424] pb-5">
                <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider bg-emerald-950/50 text-emerald-400 border border-emerald-500/30">
                        Subscriptions
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider bg-zinc-900 text-zinc-400 border border-zinc-800">
                        UPI Gateway
                    </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-serif font-normal tracking-tight text-[#FFFFFF] mt-2 mb-0">
                    Billing & Renewals
                </h1>
                <p className="text-xs text-[#8A8A8A] mt-1.5 max-w-2xl m-0 leading-relaxed">
                    View active game servers, expiry schedules, and renewal amounts in INR (₹). Renew directly using Google Pay or any UPI app with our 12-hour grace period for suspended servers.
                </p>
            </div>

            {/* Active Servers Grid / Table */}
            <section className="bg-[#0A0A0A] border border-[#242424] rounded-xl overflow-hidden shadow-xl" aria-label="Game Server Renewals">
                <div className="p-4 sm:p-5 border-b border-[#242424] flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-[#FFFFFF] m-0">Your Game Servers</h2>
                        <p className="text-xs text-[#71717a] mt-0.5 m-0">
                            Fixed monthly renewal fee is in Indian Rupees (₹).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            fetchServers();
                            fetchPayments();
                        }}
                        className="px-2.5 py-1 rounded bg-[#18181b] hover:bg-[#27272a] text-xs text-[#EDEDED] border border-[#27272a] cursor-pointer transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95"
                    >
                        Refresh
                    </button>
                </div>

                <div className="overflow-x-auto table-overscroll-contain">
                    <table className="w-full text-left border-collapse" role="table">
                        <thead className="bg-[#050505] text-[10px] uppercase font-mono tracking-wider text-[#71717a] border-b border-[#242424]">
                            <tr>
                                <th scope="col" className="py-3 px-4 font-semibold">Server Name</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Status</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Expiry Date</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Days Remaining</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Monthly Renewal (INR)</th>
                                <th scope="col" className="py-3 px-4 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1C1C1F] text-xs font-mono">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-[#71717a]">
                                        Loading servers...
                                    </td>
                                </tr>
                            ) : servers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-[#71717a]">
                                        No active servers found in your account.
                                    </td>
                                </tr>
                            ) : (
                                servers.map((server) => {
                                    const diffDays = getDiffDays(server.expiresAt);
                                    const isSuspended = server.status === 'suspended';
                                    const renewalPrice = server.billingAmount || 499;

                                    return (
                                        <tr key={server.id} className="hover:bg-[#121214] transition-colors">
                                            <td className="py-3.5 px-4">
                                                <span className="text-[#FFFFFF] font-semibold block">{server.name}</span>
                                                <span className="text-[10px] text-[#71717a] font-mono">
                                                    ID: {server.id}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {isSuspended ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/50 text-red-400 border border-red-500/30">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                                        Suspended
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/50 text-emerald-400 border border-emerald-500/30">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap text-[#EDEDED]">
                                                {formatDateDisplay(server.expiresAt)}
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {diffDays !== null ? (
                                                    diffDays > 5 ? (
                                                        <span className="text-emerald-400 font-semibold">{diffDays} days left</span>
                                                    ) : diffDays > 0 ? (
                                                        <span className="text-amber-400 font-semibold">{diffDays} days left (Expiring soon)</span>
                                                    ) : diffDays === 0 ? (
                                                        <span className="text-red-400 font-semibold">Expires Today</span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/40 text-red-400 border border-red-500/30">
                                                            Expired ({Math.abs(diffDays)}d ago)
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-[#71717a]">Permanent</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span className="text-base font-bold text-[#FFFFFF]">
                                                    {formatInr(renewalPrice)}
                                                </span>
                                                <span className="text-[10px] text-[#71717a] block">/ month</span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenCheckout(server)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#EDEDED] text-[#000000] text-xs font-semibold transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 cursor-pointer border-none"
                                                >
                                                    Renew with UPI
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Submitted Payments & Verification Status */}
            <section className="bg-[#0A0A0A] border border-[#242424] rounded-xl p-5 shadow-xl">
                <div className="pb-4 border-b border-[#242424] flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-[#FFFFFF] m-0">Recent Renewal Submissions</h2>
                        <p className="text-xs text-[#71717a] mt-0.5 m-0">
                            Track the admin verification status of your UPI renewals.
                        </p>
                    </div>
                </div>

                <div className="divide-y divide-[#18181b] mt-3">
                    {payments.length === 0 ? (
                        <p className="py-6 text-center text-xs text-[#71717a] m-0">
                            No renewal payments submitted yet.
                        </p>
                    ) : (
                        payments.map((p) => (
                            <div key={p.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold text-[#FFFFFF]">
                                            {p.server?.name || 'Game Server'}
                                        </span>
                                        {p.status === 'approved' && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                                                Approved (+30 Days)
                                            </span>
                                        )}
                                        {p.status === 'pending' && !p.is_suspicious && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/60 text-amber-400 border border-amber-500/30">
                                                Pending Admin Review
                                            </span>
                                        )}
                                        {p.status === 'pending' && p.is_suspicious && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-rose-950/70 text-rose-400 border border-rose-500/40" title={p.suspicious_reason || ''}>
                                                Flagged for Verification
                                            </span>
                                        )}
                                        {p.status === 'rejected' && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-red-950/70 text-red-400 border border-red-500/40">
                                                Rejected
                                            </span>
                                        )}
                                        {p.grace_period_granted && p.status === 'pending' && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-400 border border-cyan-500/30 animate-pulse">
                                                ⚡ 12h Grace Active
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-[#A0A0A0] mt-1 space-x-3 font-mono">
                                        <span>UTR: <strong>{p.utr_number}</strong></span>
                                        <span>Payer: {p.payer_name || 'N/A'}</span>
                                        {p.payment_note && <span>Note: <strong className="text-emerald-400">{p.payment_note}</strong></span>}
                                        <span>{new Date(p.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    {p.rejection_reason && (
                                        <p className="text-[11px] text-red-400 mt-1 m-0">
                                            Rejection Reason: {p.rejection_reason}
                                        </p>
                                    )}
                                    {p.is_suspicious && p.suspicious_reason && (
                                        <p className="text-[11px] text-amber-400 mt-1 m-0">
                                            Flag reason: {p.suspicious_reason}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-sm font-bold text-[#FFFFFF]">
                                        {formatInr(p.amount)}
                                    </span>
                                    {p.screenshot_path && (
                                        <a
                                            href={p.screenshot_path}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1 rounded text-xs text-[#EDEDED] hover:text-[#FFFFFF] bg-[#141416] hover:bg-[#1f1f23] border border-[#27272a] no-underline transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95"
                                        >
                                            View Receipt
                                        </a>
                                    )}
                                    {p.status === 'approved' && (
                                        <button
                                            type="button"
                                            onClick={() => handlePrintReceipt(p)}
                                            className="px-2.5 py-1 rounded text-xs text-[#EDEDED] hover:text-[#FFFFFF] bg-[#141416] hover:bg-[#1f1f23] border border-[#27272a] cursor-pointer transition-all duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95"
                                        >
                                            Invoice PDF
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

export default ClientBillingView;
