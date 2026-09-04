import React, { useEffect, useMemo, useState } from 'react';
import { Redirect } from 'react-router-dom';
import { useUserRole } from '@/plugins/useUserRole';
import { FinanceOperationsVisual } from './FinanceOperationsVisual';
import http from '@/api/http';
import { TableSkeleton } from '@/components/elements/TableSkeleton';

export type BillingCurrency = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface GameServerPlan {
    id: string;
    name: string;
    game: string;
    currency: BillingCurrency;
    monthlyPriceCents: number; // Stored in paise for INR (100 paise = 1 INR)
    ramGb: number;
    cpuPercent: number;
    diskGb: number;
    allocations: number;
    backups: number;
    databases: number;
    isActive: boolean;
}

export interface GameServerInvoice {
    id: string;
    serverId: string;
    serverName: string;
    game: string;
    clientUsername: string;
    clientEmail: string;
    planId: string;
    planName: string;
    nodeName: string;
    ramGb: number;
    billingCycle: 'monthly' | 'quarterly' | 'annually';
    subtotalCents: number;
    totalCents: number; // in paise
    paidCents: number;
    outstandingCents: number;
    currency: BillingCurrency;
    status: 'paid' | 'open' | 'overdue' | 'cancelled';
    issuedAt: string;
    dueAt: string;
    expiresAt?: string; // Format: YYYY-MM-DD
    renewalPriceInr?: number; // Renewal amount in INR ₹
    paidAt?: string;
    isSuspended?: boolean;
}

export interface NodeCostBasis {
    id: string;
    name: string;
    nodeName: string;
    type: 'hardware' | 'network' | 'security' | 'licensing';
    monthlyCostCents: number;
    ramCapacityGb: number;
    currency: BillingCurrency;
    isActive: boolean;
}

export interface GamePanelPolicy {
    autoSuspendEnabled: boolean;
    gracePeriodDays: number;
    warningNoticeDays: number;
    autoUnsuspendOnPay: boolean;
    autoPurgeDays: number;
    currency: BillingCurrency;
}

export interface AdminRenewalPayment {
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
    admin_notes: string | null;
    rejection_reason: string | null;
    reviewed_by: number | null;
    reviewed_at: string | null;
    created_at: string;
    user?: {
        id: number;
        username: string;
        email: string;
    };
    server?: {
        id: number;
        uuid: string;
        uuidShort: string;
        name: string;
        expires_at: string | null;
        status: string | null;
        grace_period_expires_at: string | null;
        billing_amount: number | null;
    };
    reviewer?: {
        id: number;
        username: string;
        email: string;
    };
}

const DEFAULT_PLANS: GameServerPlan[] = [
    {
        id: 'plan_mc_starter',
        name: 'Minecraft Starter (Paper/Purpur)',
        game: 'Minecraft',
        currency: 'INR',
        monthlyPriceCents: 49900, // ₹499
        ramGb: 4,
        cpuPercent: 200,
        diskGb: 25,
        allocations: 1,
        backups: 2,
        databases: 1,
        isActive: true,
    },
    {
        id: 'plan_mc_perf',
        name: 'Minecraft Performance (Ryzen 9)',
        game: 'Minecraft',
        currency: 'INR',
        monthlyPriceCents: 89900, // ₹899
        ramGb: 8,
        cpuPercent: 350,
        diskGb: 50,
        allocations: 2,
        backups: 4,
        databases: 2,
        isActive: true,
    },
    {
        id: 'plan_rust_dedicated',
        name: 'Rust High-Frequency Tier',
        game: 'Rust',
        currency: 'INR',
        monthlyPriceCents: 189900, // ₹1,899
        ramGb: 16,
        cpuPercent: 400,
        diskGb: 80,
        allocations: 3,
        backups: 3,
        databases: 1,
        isActive: true,
    },
    {
        id: 'plan_pal_coop',
        name: 'Palworld / ARK Survival Dedicated',
        game: 'Palworld',
        currency: 'INR',
        monthlyPriceCents: 149900, // ₹1,499
        ramGb: 12,
        cpuPercent: 300,
        diskGb: 60,
        allocations: 1,
        backups: 3,
        databases: 1,
        isActive: true,
    },
    {
        id: 'plan_cs2_tick',
        name: 'CS2 High-Tickrate Match Tier',
        game: 'Counter-Strike 2',
        currency: 'INR',
        monthlyPriceCents: 79900, // ₹799
        ramGb: 6,
        cpuPercent: 250,
        diskGb: 30,
        allocations: 1,
        backups: 2,
        databases: 1,
        isActive: true,
    },
    {
        id: 'plan_bot_micro',
        name: 'Discord Bot & Node.js Micro',
        game: 'Discord Bot',
        currency: 'INR',
        monthlyPriceCents: 19900, // ₹199
        ramGb: 1,
        cpuPercent: 50,
        diskGb: 5,
        allocations: 1,
        backups: 1,
        databases: 1,
        isActive: true,
    },
];

const DEFAULT_COSTS: NodeCostBasis[] = [
    {
        id: 'cost_node_01',
        name: 'US-East Node 01 (Ryzen 9 7950X, 128GB DDR5, 2x 2TB NVMe)',
        nodeName: 'US-East 01',
        type: 'hardware',
        monthlyCostCents: 999900, // ₹9,999
        ramCapacityGb: 128,
        currency: 'INR',
        isActive: true,
    },
    {
        id: 'cost_node_02',
        name: 'EU-Central Node 02 (Ryzen 7 5800X, 64GB DDR4, 1TB NVMe)',
        nodeName: 'EU-Central 02',
        type: 'hardware',
        monthlyCostCents: 549900, // ₹5,499
        ramCapacityGb: 64,
        currency: 'INR',
        isActive: true,
    },
    {
        id: 'cost_net_ip',
        name: 'Dedicated Game IPv4 Subnet (/28 - 16 Allocations)',
        nodeName: 'Global Network',
        type: 'network',
        monthlyCostCents: 249900, // ₹2,499
        ramCapacityGb: 0,
        currency: 'INR',
        isActive: true,
    },
    {
        id: 'cost_ddos_layer',
        name: 'Anti-DDoS Game Mitigation & Traffic Filtering Layer',
        nodeName: 'Global Edge',
        type: 'security',
        monthlyCostCents: 199900, // ₹1,999
        ramCapacityGb: 0,
        currency: 'INR',
        isActive: true,
    },
];

const now = new Date();
const formatDate = (daysOffset: number) => {
    const d = new Date(now.getTime() + daysOffset * 86400000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const DEFAULT_INVOICES: GameServerInvoice[] = [
    // 3 Admin Servers
    {
        id: 'INV-ADM-101',
        serverId: '1',
        serverName: 'Lunar Minecraft Server',
        game: 'Minecraft',
        clientUsername: 'lunaradmin',
        clientEmail: 'admin@lunar.local',
        planId: 'plan_mc_perf',
        planName: 'Minecraft Performance (8GB)',
        nodeName: 'Lunar Local Node',
        ramGb: 8,
        billingCycle: 'monthly',
        subtotalCents: 89900,
        totalCents: 89900,
        paidCents: 89900,
        outstandingCents: 0,
        currency: 'INR',
        status: 'paid',
        issuedAt: formatDate(-20),
        dueAt: formatDate(41),
        expiresAt: formatDate(41),
        renewalPriceInr: 899,
        paidAt: formatDate(-20),
        isSuspended: false,
    },
    {
        id: 'INV-ADM-102',
        serverId: '2',
        serverName: 'Bungeecord Network Proxy',
        game: 'Minecraft',
        clientUsername: 'lunaradmin',
        clientEmail: 'admin@lunar.local',
        planId: 'plan_mc_starter',
        planName: 'Bungeecord Edge Proxy (1GB)',
        nodeName: 'Lunar Local Node',
        ramGb: 1,
        billingCycle: 'monthly',
        subtotalCents: 49900,
        totalCents: 49900,
        paidCents: 49900,
        outstandingCents: 0,
        currency: 'INR',
        status: 'paid',
        issuedAt: formatDate(-30),
        dueAt: formatDate(58),
        expiresAt: formatDate(58),
        renewalPriceInr: 499,
        paidAt: formatDate(-30),
        isSuspended: false,
    },
    {
        id: 'INV-ADM-103',
        serverId: '3',
        serverName: 'CS2 Match Arena 128T',
        game: 'Counter-Strike 2',
        clientUsername: 'lunaradmin',
        clientEmail: 'admin@lunar.local',
        planId: 'plan_cs2_tick',
        planName: 'CS2 High-Tickrate Match Tier (4GB)',
        nodeName: 'Lunar Local Node',
        ramGb: 4,
        billingCycle: 'monthly',
        subtotalCents: 79900,
        totalCents: 79900,
        paidCents: 79900,
        outstandingCents: 0,
        currency: 'INR',
        status: 'paid',
        issuedAt: formatDate(-15),
        dueAt: formatDate(77),
        expiresAt: formatDate(77),
        renewalPriceInr: 799,
        paidAt: formatDate(-15),
        isSuspended: false,
    },

    // 5 Customer Servers
    {
        id: 'INV-CUST-201',
        serverId: '4',
        serverName: 'Survival SMP Season 4',
        game: 'Minecraft',
        clientUsername: 'alexcraft',
        clientEmail: 'alex.craft@gmail.com',
        planId: 'plan_mc_perf',
        planName: 'Minecraft Performance (8GB)',
        nodeName: 'Lunar Local Node',
        ramGb: 8,
        billingCycle: 'monthly',
        subtotalCents: 89900,
        totalCents: 89900,
        paidCents: 0,
        outstandingCents: 89900,
        currency: 'INR',
        status: 'open',
        issuedAt: formatDate(-8),
        dueAt: formatDate(22),
        expiresAt: formatDate(22),
        renewalPriceInr: 899,
        isSuspended: false,
    },
    {
        id: 'INV-CUST-202',
        serverId: '5',
        serverName: 'Forge Modded Origins',
        game: 'Minecraft',
        clientUsername: 'alexcraft',
        clientEmail: 'alex.craft@gmail.com',
        planId: 'plan_pal_coop',
        planName: 'Heavy Modpack Tier (12GB)',
        nodeName: 'Lunar Local Node',
        ramGb: 12,
        billingCycle: 'monthly',
        subtotalCents: 149900,
        totalCents: 149900,
        paidCents: 0,
        outstandingCents: 149900,
        currency: 'INR',
        status: 'open',
        issuedAt: formatDate(-27),
        dueAt: formatDate(3),
        expiresAt: formatDate(3),
        renewalPriceInr: 1499,
        isSuspended: false,
    },
    {
        id: 'INV-CUST-203',
        serverId: '6',
        serverName: 'Rust 2x Vanilla Weekly',
        game: 'Rust',
        clientUsername: 'rustlord',
        clientEmail: 'rustlord@protonmail.com',
        planId: 'plan_rust_dedicated',
        planName: 'Rust High-Frequency Tier (16GB)',
        nodeName: 'Lunar Local Node',
        ramGb: 16,
        billingCycle: 'monthly',
        subtotalCents: 189900,
        totalCents: 189900,
        paidCents: 0,
        outstandingCents: 189900,
        currency: 'INR',
        status: 'open',
        issuedAt: formatDate(-12),
        dueAt: formatDate(18),
        expiresAt: formatDate(18),
        renewalPriceInr: 1899,
        isSuspended: false,
    },
    {
        id: 'INV-CUST-204',
        serverId: '7',
        serverName: 'Ark Survival Island Dedicated',
        game: 'Ark: Survival Evolved',
        clientUsername: 'rustlord',
        clientEmail: 'rustlord@protonmail.com',
        planId: 'plan_pal_coop',
        planName: 'Ark Dedicated Survival (12GB)',
        nodeName: 'Lunar Local Node',
        ramGb: 12,
        billingCycle: 'monthly',
        subtotalCents: 149900,
        totalCents: 149900,
        paidCents: 0,
        outstandingCents: 149900,
        currency: 'INR',
        status: 'overdue',
        issuedAt: formatDate(-32),
        dueAt: formatDate(-2),
        expiresAt: formatDate(-2),
        renewalPriceInr: 1499,
        isSuspended: true,
    },
    {
        id: 'INV-CUST-205',
        serverId: '8',
        serverName: 'Vanilla Minecraft Hardcore',
        game: 'Minecraft',
        clientUsername: 'alexcraft',
        clientEmail: 'alex.craft@gmail.com',
        planId: 'plan_mc_starter',
        planName: 'Minecraft Vanilla (4GB)',
        nodeName: 'Lunar Local Node',
        ramGb: 4,
        billingCycle: 'monthly',
        subtotalCents: 49900,
        totalCents: 49900,
        paidCents: 0,
        outstandingCents: 49900,
        currency: 'INR',
        status: 'overdue',
        issuedAt: formatDate(-35),
        dueAt: formatDate(-5),
        expiresAt: formatDate(-5),
        renewalPriceInr: 499,
        isSuspended: true,
    },
];

const DEFAULT_POLICY: GamePanelPolicy = {
    autoSuspendEnabled: true,
    gracePeriodDays: 3,
    warningNoticeDays: 2,
    autoUnsuspendOnPay: true,
    autoPurgeDays: 30,
    currency: 'INR',
};

const formatCurrency = (cents: number, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency === 'INR' ? 'INR' : currency,
        maximumFractionDigits: 0,
    }).format((Number(cents) || 0) / 100);
};

const formatDateDisplay = (dateString?: string | null) => {
    if (!dateString) return '—';
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

/**
 * Responsive Expiry Date Picker Component
 * PC: Interactive desktop calendar picker
 * Phone: Manual format input (YYYY-MM-DD)
 */
export const ResponsiveExpiryDatePicker: React.FC<{
    value: string; // YYYY-MM-DD
    onChange: (dateStr: string) => void;
    label?: string;
    helperText?: string;
    min?: string;
}> = ({ value, onChange, label = 'Server Expiry Date', helperText, min }) => {
    const [mode, setMode] = useState<'calendar' | 'manual'>('calendar');
    const [manualText, setManualText] = useState(value);

    useEffect(() => {
        setManualText(value);
    }, [value]);

    const handlePreset = (days: number) => {
        if (days === 0) {
            onChange('');
            setManualText('');
        } else {
            const d = new Date();
            d.setDate(d.getDate() + days);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            onChange(dateStr);
            setManualText(dateStr);
        }
    };

    const diffInfo = useMemo(() => {
        if (!value) return null;
        try {
            const clean = value.includes('T') ? value.split('T')[0] : value;
            const [yyyy, mm, dd] = clean.split('-');
            const target = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const dateStr = target.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
            return { diffDays, dateStr };
        } catch {
            return null;
        }
    }, [value]);

    return (
        <div className="space-y-2 bg-[#050505] p-3 rounded-lg border border-[#27272a]">
            <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#EDEDED] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{label}</span>
                </label>
                <div className="flex items-center gap-1 bg-[#121214] p-0.5 rounded border border-[#242424]">
                    <button
                        type="button"
                        onClick={() => setMode('calendar')}
                        className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors border-none cursor-pointer ${
                            mode === 'calendar' ? 'bg-[#27272a] text-[#FFFFFF]' : 'bg-transparent text-[#71717a] hover:text-[#FFFFFF]'
                        }`}
                        title="Desktop Calendar Picker"
                    >
                        📅 PC Calendar
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('manual')}
                        className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors border-none cursor-pointer ${
                            mode === 'manual' ? 'bg-[#27272a] text-[#FFFFFF]' : 'bg-transparent text-[#71717a] hover:text-[#FFFFFF]'
                        }`}
                        title="Phone Manual Date Format"
                    >
                        📱 Phone Format
                    </button>
                </div>
            </div>

            {mode === 'calendar' ? (
                <div>
                    <input
                        type="date"
                        min={min || new Date().toISOString().split('T')[0]}
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            setManualText(e.target.value);
                        }}
                        className="w-full bg-[#121214] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] font-mono outline-none focus:border-amber-400/60 cursor-pointer"
                        aria-label="Server Expiry Date Calendar"
                    />
                    <span className="block text-[10px] text-[#71717a] mt-1 font-mono">
                        Click the calendar on PC to choose the expiration date.
                    </span>
                </div>
            ) : (
                <div>
                    <input
                        type="text"
                        placeholder="YYYY-MM-DD (e.g. 2026-10-03)"
                        pattern="\d{4}-\d{2}-\d{2}"
                        inputMode="numeric"
                        value={manualText}
                        onChange={(e) => {
                            const val = e.target.value;
                            setManualText(val);
                            if (/^\d{4}-\d{2}-\d{2}$/.test(val) || val === '') {
                                onChange(val);
                            }
                        }}
                        className="w-full bg-[#121214] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] font-mono outline-none focus:border-amber-400/60"
                        aria-label="Server Expiry Date Manual Format"
                    />
                    <span className="block text-[10px] text-[#71717a] mt-1 font-mono">
                        Phone keypad format: enter <code>YYYY-MM-DD</code> directly.
                    </span>
                </div>
            )}

            {/* Quick Presets */}
            <div className="pt-1">
                <span className="text-[10px] text-[#71717a] block mb-1 font-mono uppercase tracking-wider">Quick Extension Presets:</span>
                <div className="flex flex-wrap gap-1">
                    <button
                        type="button"
                        onClick={() => handlePreset(7)}
                        className="px-2 py-0.5 rounded bg-[#18181b] hover:bg-[#27272a] text-[11px] text-[#EDEDED] border border-[#27272a] cursor-pointer"
                    >
                        +7 Days
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePreset(30)}
                        className="px-2 py-0.5 rounded bg-[#18181b] hover:bg-[#27272a] text-[11px] text-[#EDEDED] border border-[#27272a] cursor-pointer"
                    >
                        +30 Days (1 Mo)
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePreset(90)}
                        className="px-2 py-0.5 rounded bg-[#18181b] hover:bg-[#27272a] text-[11px] text-[#EDEDED] border border-[#27272a] cursor-pointer"
                    >
                        +90 Days (3 Mo)
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePreset(365)}
                        className="px-2 py-0.5 rounded bg-[#18181b] hover:bg-[#27272a] text-[11px] text-[#EDEDED] border border-[#27272a] cursor-pointer"
                    >
                        +1 Year
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePreset(0)}
                        className="px-2 py-0.5 rounded bg-amber-950/30 hover:bg-amber-950/50 text-[11px] text-amber-400 border border-amber-500/30 cursor-pointer"
                    >
                        Clear (No Expiry)
                    </button>
                </div>
            </div>

            {/* Dynamic Status / Feedback */}
            {diffInfo && (
                <div
                    className={`p-2 rounded text-xs font-mono flex items-center gap-2 mt-2 ${
                        diffInfo.diffDays > 3
                            ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                            : diffInfo.diffDays >= 0
                            ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                            : 'bg-red-950/40 text-red-300 border border-red-500/30'
                    }`}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                    <span>
                        {diffInfo.diffDays > 0
                            ? `Server will automatically suspend on ${diffInfo.dateStr} (in ${diffInfo.diffDays} days).`
                            : diffInfo.diffDays === 0
                            ? `Server expires today (${diffInfo.dateStr}) and will suspend immediately.`
                            : `Server expired ${Math.abs(diffInfo.diffDays)} days ago on ${diffInfo.dateStr} (suspended).`}
                    </span>
                </div>
            )}
        </div>
    );
};

export const BillingOperationsView: React.FC = () => {
    const { isAdmin } = useUserRole();

    // 1. Local / Persistent State (Default to INR)
    const [plans, setPlans] = useState<GameServerPlan[]>(() => {
        try {
            const saved = localStorage.getItem('lunar_gp_plans_inr_v1');
            return saved ? JSON.parse(saved) : DEFAULT_PLANS;
        } catch {
            return DEFAULT_PLANS;
        }
    });

    const [costs, setCosts] = useState<NodeCostBasis[]>(() => {
        try {
            const saved = localStorage.getItem('lunar_gp_costs_inr_v1');
            return saved ? JSON.parse(saved) : DEFAULT_COSTS;
        } catch {
            return DEFAULT_COSTS;
        }
    });

    const [invoices, setInvoices] = useState<GameServerInvoice[]>(() => {
        try {
            const saved = localStorage.getItem('lunar_gp_invoices_inr_v2');
            return saved ? JSON.parse(saved) : DEFAULT_INVOICES;
        } catch {
            return DEFAULT_INVOICES;
        }
    });

    const [policy, setPolicy] = useState<GamePanelPolicy>(() => {
        try {
            const saved = localStorage.getItem('lunar_gp_policy_inr_v1');
            return saved ? JSON.parse(saved) : DEFAULT_POLICY;
        } catch {
            return DEFAULT_POLICY;
        }
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [invoiceFilter, setInvoiceFilter] = useState<string>('all');
    const [notice, setNotice] = useState<string | null>(null);

    // Modals
    const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
    const [isPlanFormOpen, setIsPlanFormOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<GameServerPlan | null>(null);

    // Expiry Date & Renewal Amount Edit Modal
    const [editingExpiryInvoice, setEditingExpiryInvoice] = useState<GameServerInvoice | null>(null);
    const [targetExpiryDate, setTargetExpiryDate] = useState<string>('');
    const [targetRenewalAmountInr, setTargetRenewalAmountInr] = useState<number>(899);
    const [unsuspendOnExpiryUpdate, setUnsuspendOnExpiryUpdate] = useState<boolean>(true);

    // New Subscription Modal state
    const [newSubscriptionExpiry, setNewSubscriptionExpiry] = useState<string>(formatDate(30));
    const [newSubscriptionAmountInr, setNewSubscriptionAmountInr] = useState<number>(899);

    // Calculator State (in INR)
    const [calcNodeCost, setCalcNodeCost] = useState(9999);
    const [calcNodeRam, setCalcNodeRam] = useState(128);
    const [calcAvgServerRam, setCalcAvgServerRam] = useState(8);
    const [calcPricePerGb, setCalcPricePerGb] = useState(150);
    const [calcActiveServers, setCalcActiveServers] = useState(14);

    // UPI Gateway Configuration State
    const [upiConfig, setUpiConfig] = useState<{ upi_id: string; payee_name: string }>({
        upi_id: 'votion@upi',
        payee_name: 'Votion Game Infrastructure',
    });
    const [isEditingUpi, setIsEditingUpi] = useState(false);
    const [upiForm, setUpiForm] = useState({ upi_id: 'votion@upi', payee_name: 'Votion Game Infrastructure' });
    const [savingUpi, setSavingUpi] = useState(false);

    // Payment Verification Queue State
    const [adminPayments, setAdminPayments] = useState<AdminRenewalPayment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspicious'>('pending');
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

    // Modals for payments
    const [selectedProofImage, setSelectedProofImage] = useState<string | null>(null);
    const [rejectModalPayment, setRejectModalPayment] = useState<AdminRenewalPayment | null>(null);
    const [rejectionReasonInput, setRejectionReasonInput] = useState('Payment receipt could not be verified or UTR was invalid.');

    const fetchAdminUpiConfig = () => {
        http.get('/api/client/billing/admin/config')
            .then(({ data }) => {
                if (data && data.data) {
                    setUpiConfig(data.data);
                    setUpiForm(data.data);
                }
            })
            .catch(() => {});
    };

    const fetchAdminPayments = () => {
        setLoadingPayments(true);
        http.get('/api/client/billing/admin/payments')
            .then(({ data }) => {
                if (data && data.data) {
                    setAdminPayments(data.data);
                }
            })
            .catch(() => {})
            .finally(() => setLoadingPayments(false));
    };

    useEffect(() => {
        fetchAdminUpiConfig();
        fetchAdminPayments();
    }, []);

    const handleSaveUpiConfig = (e: React.FormEvent) => {
        e.preventDefault();
        setSavingUpi(true);
        http.post('/api/client/billing/admin/config', upiForm)
            .then(({ data }) => {
                if (data && data.data) {
                    setUpiConfig(data.data);
                    setIsEditingUpi(false);
                    setNotice('UPI Gateway settings updated successfully.');
                }
            })
            .catch((err) => {
                setNotice(err.response?.data?.message || 'Failed to update UPI settings.');
            })
            .finally(() => setSavingUpi(false));
    };

    const handleApprovePayment = (payment: AdminRenewalPayment) => {
        setActionLoadingId(payment.id);
        http.post(`/api/client/billing/admin/payments/${payment.id}/approve`)
            .then(() => {
                setNotice(`Payment #${payment.id} approved! Server "${payment.server?.name}" extended by 30 days.`);
                fetchAdminPayments();
            })
            .catch((err) => {
                setNotice(err.response?.data?.message || 'Failed to approve payment.');
            })
            .finally(() => setActionLoadingId(null));
    };

    const handleConfirmReject = () => {
        if (!rejectModalPayment) return;
        setActionLoadingId(rejectModalPayment.id);
        http.post(`/api/client/billing/admin/payments/${rejectModalPayment.id}/reject`, {
            reason: rejectionReasonInput,
        })
            .then(() => {
                setNotice(`Payment #${rejectModalPayment.id} rejected. Server grace period revoked.`);
                setRejectModalPayment(null);
                fetchAdminPayments();
            })
            .catch((err) => {
                setNotice(err.response?.data?.message || 'Failed to reject payment.');
            })
            .finally(() => setActionLoadingId(null));
    };

    const filteredPayments = useMemo(() => {
        return adminPayments.filter((p) => {
            if (paymentFilter === 'pending') return p.status === 'pending';
            if (paymentFilter === 'approved') return p.status === 'approved';
            if (paymentFilter === 'rejected') return p.status === 'rejected';
            if (paymentFilter === 'suspicious') return p.is_suspicious;
            return true;
        });
    }, [adminPayments, paymentFilter]);

    // Save state changes to localStorage
    useEffect(() => {
        localStorage.setItem('lunar_gp_plans_inr_v1', JSON.stringify(plans));
    }, [plans]);

    useEffect(() => {
        localStorage.setItem('lunar_gp_costs_inr_v1', JSON.stringify(costs));
    }, [costs]);

    useEffect(() => {
        localStorage.setItem('lunar_gp_invoices_inr_v2', JSON.stringify(invoices));
    }, [invoices]);

    useEffect(() => {
        localStorage.setItem('lunar_gp_policy_inr_v1', JSON.stringify(policy));
    }, [policy]);

    // Automated Expiry & Suspension Engine: Check every 30s
    useEffect(() => {
        if (!policy.autoSuspendEnabled) return;

        const checkServerExpirations = () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            setInvoices((prev) => {
                let hasChanges = false;
                const updated = prev.map((inv) => {
                    const exp = inv.expiresAt || inv.dueAt;
                    if (!exp) return inv;

                    const [yyyy, mm, dd] = exp.includes('T') ? exp.split('T')[0].split('-') : exp.split('-');
                    const expiryTime = new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
                    const isPast = expiryTime < today.getTime();

                    if (isPast && !inv.isSuspended) {
                        hasChanges = true;
                        return {
                            ...inv,
                            isSuspended: true,
                            status: (inv.status === 'paid' ? 'overdue' : inv.status) as any,
                        };
                    }
                    return inv;
                });

                if (hasChanges) {
                    setNotice('Automated Expiry Policy: Expired game servers have been suspended.');
                    return updated;
                }
                return prev;
            });
        };

        checkServerExpirations();
        const timer = setInterval(checkServerExpirations, 30000);
        return () => clearInterval(timer);
    }, [policy.autoSuspendEnabled]);

    // Auto-dismiss notification
    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [notice]);

    // Financial calculations
    const metrics = useMemo(() => {
        const totalBilled = invoices.reduce((sum, inv) => sum + inv.totalCents, 0);
        const totalCollected = invoices.reduce((sum, inv) => sum + inv.paidCents, 0);
        const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.status !== 'paid' ? inv.outstandingCents : 0), 0);
        const overdueCount = invoices.filter((inv) => inv.status === 'overdue' || inv.isSuspended).length;

        const totalMonthlyHardwareCost = costs
            .filter((c) => c.isActive)
            .reduce((sum, c) => sum + c.monthlyCostCents, 0);

        const mrrCents = invoices.reduce((sum, inv) => {
            if (inv.status === 'cancelled') return sum;
            if (inv.billingCycle === 'quarterly') return sum + Math.round(inv.totalCents / 3);
            if (inv.billingCycle === 'annually') return sum + Math.round(inv.totalCents / 12);
            return sum + inv.totalCents;
        }, 0);

        const grossProfitCents = mrrCents - totalMonthlyHardwareCost;
        const marginPercent = mrrCents > 0 ? (grossProfitCents / mrrCents) * 100 : 0;

        const totalAllocatedRam = invoices.reduce((sum, inv) => sum + (inv.status !== 'cancelled' ? inv.ramGb : 0), 0);
        const totalCapacityRam = costs.reduce((sum, c) => sum + c.ramCapacityGb, 0);

        return {
            totalBilled,
            totalCollected,
            totalOutstanding,
            overdueCount,
            totalMonthlyHardwareCost,
            mrrCents,
            grossProfitCents,
            marginPercent,
            totalAllocatedRam,
            totalCapacityRam,
            activeGameServers: invoices.filter((inv) => inv.status !== 'cancelled').length,
        };
    }, [invoices, costs]);

    // Filtered Invoices
    const filteredInvoices = useMemo(() => {
        return invoices.filter((inv) => {
            const matchesFilter =
                invoiceFilter === 'all'
                    ? true
                    : invoiceFilter === 'open'
                    ? inv.status === 'open'
                    : invoiceFilter === 'overdue'
                    ? inv.status === 'overdue' || inv.isSuspended
                    : invoiceFilter === 'paid'
                    ? inv.status === 'paid'
                    : true;

            const q = searchQuery.toLowerCase().trim();
            const matchesQuery =
                !q ||
                inv.id.toLowerCase().includes(q) ||
                inv.serverName.toLowerCase().includes(q) ||
                inv.clientEmail.toLowerCase().includes(q) ||
                inv.clientUsername.toLowerCase().includes(q) ||
                inv.game.toLowerCase().includes(q);

            return matchesFilter && matchesQuery;
        });
    }, [invoices, invoiceFilter, searchQuery]);

    // Guard: Only admins can view Billing Operations
    if (!isAdmin) {
        return <Redirect to="/" />;
    }

    // Actions
    const handleRecordPayment = (invoice: GameServerInvoice) => {
        const daysToAdd = invoice.billingCycle === 'quarterly' ? 90 : invoice.billingCycle === 'annually' ? 365 : 30;
        const currentExp = invoice.expiresAt || invoice.dueAt;
        let baseDate = new Date();
        if (currentExp) {
            const [yyyy, mm, dd] = currentExp.includes('T') ? currentExp.split('T')[0].split('-') : currentExp.split('-');
            const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            if (parsed > baseDate) {
                baseDate = parsed;
            }
        }
        baseDate.setDate(baseDate.getDate() + daysToAdd);
        const yyyy = baseDate.getFullYear();
        const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
        const dd = String(baseDate.getDate()).padStart(2, '0');
        const newExpiryStr = `${yyyy}-${mm}-${dd}`;

        setInvoices((prev) =>
            prev.map((inv) =>
                inv.id === invoice.id
                    ? {
                          ...inv,
                          status: 'paid',
                          paidCents: inv.totalCents,
                          outstandingCents: 0,
                          paidAt: new Date().toISOString(),
                          expiresAt: newExpiryStr,
                          dueAt: newExpiryStr,
                          isSuspended: false,
                      }
                    : inv
            )
        );
        setNotice(`Payment of ${formatCurrency(invoice.totalCents, invoice.currency)} recorded for ${invoice.id}. Server "${invoice.serverName}" reactivated with new expiry ${formatDateDisplay(newExpiryStr)}.`);
    };

    const handleToggleSuspension = (invoice: GameServerInvoice) => {
        const nextState = !invoice.isSuspended;
        setInvoices((prev) =>
            prev.map((inv) =>
                inv.id === invoice.id
                    ? {
                          ...inv,
                          isSuspended: nextState,
                          status: nextState ? 'overdue' : inv.status,
                      }
                    : inv
            )
        );
        setNotice(
            nextState
                ? `Game server "${invoice.serverName}" has been suspended.`
                : `Game server "${invoice.serverName}" has been reactivated.`
        );
    };

    // Save Expiry Date AND Renewal Amount together
    const handleSaveExpiryAndAmount = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingExpiryInvoice) return;

        setInvoices((prev) =>
            prev.map((inv) => {
                if (inv.id === editingExpiryInvoice.id) {
                    const willUnsuspend = unsuspendOnExpiryUpdate && inv.isSuspended;
                    const newTotalCents = targetRenewalAmountInr * 100;
                    return {
                        ...inv,
                        expiresAt: targetExpiryDate,
                        dueAt: targetExpiryDate,
                        totalCents: newTotalCents,
                        subtotalCents: newTotalCents,
                        renewalPriceInr: targetRenewalAmountInr,
                        isSuspended: willUnsuspend ? false : inv.isSuspended,
                    };
                }
                return inv;
            })
        );

        setNotice(`Server "${editingExpiryInvoice.serverName}": Expiry date set to ${formatDateDisplay(targetExpiryDate)} and renewal amount set to ₹${targetRenewalAmountInr.toLocaleString('en-IN')}.`);
        setEditingExpiryInvoice(null);
    };

    const handlePrintReceipt = (invoice: GameServerInvoice) => {
        const receiptWindow = window.open('', '_blank', 'width=700,height=800');
        if (!receiptWindow) return;

        receiptWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - ${invoice.id}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; max-width: 600px; margin: auto; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
                    .brand { font-size: 20px; font-weight: 800; text-transform: lowercase; }
                    .title { font-size: 24px; font-weight: 700; margin: 0; }
                    .meta { display: grid; grid-cols: 2; gap: 8px; margin-bottom: 24px; font-size: 14px; }
                    .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
                    .table th, .table td { border-bottom: 1px solid #ddd; padding: 12px 8px; text-align: left; }
                    .total { font-size: 18px; font-weight: 700; text-align: right; margin-top: 10px; }
                    .status-paid { color: #059669; font-weight: 700; text-transform: uppercase; }
                    .btn { display: block; margin-top: 30px; padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer; text-align: center; }
                    @media print { .btn { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="brand">votion / lunar panel</div>
                        <p style="margin: 4px 0 0; color: #666; font-size: 12px;">Game Server Infrastructure Operations</p>
                    </div>
                    <div style="text-align: right;">
                        <h1 class="title">INVOICE RECEIPT</h1>
                        <p style="margin: 4px 0 0; font-family: monospace; font-size: 14px;">${invoice.id}</p>
                    </div>
                </div>

                <div class="meta">
                    <div><strong>Customer:</strong> ${invoice.clientUsername} (${invoice.clientEmail})</div>
                    <div><strong>Server:</strong> ${invoice.serverName} (${invoice.game})</div>
                    <div><strong>Node:</strong> ${invoice.nodeName}</div>
                    <div><strong>Expiry Date:</strong> ${formatDateDisplay(invoice.expiresAt || invoice.dueAt)}</div>
                    <div><strong>Status:</strong> <span class="status-paid">${invoice.status}</span></div>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>RAM / Specs</th>
                            <th>Cycle</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>${invoice.planName}</strong></td>
                            <td>${invoice.ramGb} GB RAM</td>
                            <td>${invoice.billingCycle}</td>
                            <td style="text-align: right;">${formatCurrency(invoice.totalCents, invoice.currency)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="total">Total Paid: ${formatCurrency(invoice.paidCents, invoice.currency)}</div>

                <button class="btn" onclick="window.print()">Print or Save PDF Receipt</button>
            </body>
            </html>
        `);
        receiptWindow.document.close();
    };

    // Simulated break-even in INR
    const maxSimulatedServers = Math.max(1, Math.floor(calcNodeRam / Math.max(1, calcAvgServerRam)));
    const simulatedRevenue = calcActiveServers * (calcAvgServerRam * calcPricePerGb);
    const simulatedProfit = simulatedRevenue - calcNodeCost;
    const simulatedMargin = simulatedRevenue > 0 ? (simulatedProfit / simulatedRevenue) * 100 : 0;
    const breakEvenServers = Math.ceil(calcNodeCost / Math.max(1, calcAvgServerRam * calcPricePerGb));

    return (
        <div className="billing-operations-page max-w-7xl mx-auto space-y-6 pb-12 font-sans select-none text-[#F3F4F6]">
            {/* Notification Banner */}
            {notice && (
                <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2"
                >
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                        <span>{notice}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setNotice(null)}
                        className="text-emerald-400 hover:text-emerald-200 bg-transparent border-none cursor-pointer text-xs"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* 1. Header & Live Telemetry Strip */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#242424] pb-6">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                            ADMIN ACCESS
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-950/60 text-amber-400 border border-amber-500/30">
                            INR (₹) PRICING
                        </span>
                        <h1 className="text-xl sm:text-2xl font-serif font-normal tracking-tight text-[#FFFFFF] m-0">
                            Game Fleet Billing Operations
                        </h1>
                    </div>
                    <p className="text-xs text-[#8A8A8A] mt-1.5 max-w-2xl m-0 leading-relaxed">
                        Configure game server subscriptions, set renewal prices in INR (₹) together with expiry dates, manage node costs, and automate non-payment suspension.
                    </p>
                </div>

                {/* Embedded Finance Operations Visual */}
                <div className="shrink-0 flex items-center gap-3">
                    <FinanceOperationsVisual
                        summary={{
                            invoiceCount: invoices.length,
                            gameServerCount: metrics.activeGameServers,
                            billedCents: metrics.totalBilled,
                            collectedCents: metrics.totalCollected,
                            outstandingCents: metrics.totalOutstanding,
                            overdueCount: metrics.overdueCount,
                            monthlyHardwareCostCents: metrics.totalMonthlyHardwareCost,
                            projectedGrossProfitCents: metrics.grossProfitCents,
                            projectedMarginPercent: metrics.marginPercent,
                            reportingCurrency: policy.currency,
                        }}
                    />
                </div>
            </div>

            {/* 2. Primary 6 KPI Cards (in INR ₹) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#242424] flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider font-mono">Monthly Revenue</span>
                    <div className="mt-2">
                        <span className="text-lg font-bold font-mono text-[#FFFFFF] tracking-tight">
                            {formatCurrency(metrics.mrrCents, policy.currency)}
                        </span>
                        <span className="block text-[10px] text-emerald-400 mt-0.5">Recurring MRR (INR)</span>
                    </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#242424] flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider font-mono">Collected MTD</span>
                    <div className="mt-2">
                        <span className="text-lg font-bold font-mono text-[#FFFFFF] tracking-tight">
                            {formatCurrency(metrics.totalCollected, policy.currency)}
                        </span>
                        <span className="block text-[10px] text-[#71717a] mt-0.5 font-mono">
                            {invoices.filter((i) => i.status === 'paid').length} payments
                        </span>
                    </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#242424] flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider font-mono">Outstanding</span>
                    <div className="mt-2">
                        <span className={`text-lg font-bold font-mono tracking-tight ${metrics.totalOutstanding > 0 ? 'text-amber-400' : 'text-[#FFFFFF]'}`}>
                            {formatCurrency(metrics.totalOutstanding, policy.currency)}
                        </span>
                        <span className="block text-[10px] text-amber-400 mt-0.5">
                            {metrics.overdueCount} overdue / suspended
                        </span>
                    </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#242424] flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider font-mono">Hardware Costs</span>
                    <div className="mt-2">
                        <span className="text-lg font-bold font-mono text-[#FFFFFF] tracking-tight">
                            {formatCurrency(metrics.totalMonthlyHardwareCost, policy.currency)}
                        </span>
                        <span className="block text-[10px] text-[#71717a] mt-0.5">Dedicated nodes</span>
                    </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#242424] flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider font-mono">Gross Profit</span>
                    <div className="mt-2">
                        <span className={`text-lg font-bold font-mono tracking-tight ${metrics.grossProfitCents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {metrics.grossProfitCents >= 0 ? '+' : ''}
                            {formatCurrency(metrics.grossProfitCents, policy.currency)}
                        </span>
                        <span className="block text-[10px] text-[#71717a] mt-0.5">Net cash flow</span>
                    </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#242424] flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider font-mono">Fleet Margin</span>
                    <div className="mt-2">
                        <span className={`text-lg font-bold font-mono tracking-tight ${metrics.marginPercent >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {metrics.marginPercent.toFixed(1)}%
                        </span>
                        <span className="block text-[10px] text-emerald-400 mt-0.5">
                            {metrics.totalAllocatedRam} GB / {metrics.totalCapacityRam} GB RAM
                        </span>
                    </div>
                </div>
            </div>

            {/* UPI Payment Gateway Configuration & Verification Queue */}
            <section className="bg-[#0A0A0A] border border-[#242424] rounded-xl overflow-hidden shadow-xl" aria-label="UPI Payment Gateway and Verification Queue">
                <div className="p-4 sm:p-5 border-b border-[#242424] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-semibold text-[#FFFFFF] m-0">
                                UPI Renewal Payment Verification Queue
                            </h2>
                            {adminPayments.filter((p) => p.status === 'pending').length > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                                    {adminPayments.filter((p) => p.status === 'pending').length} Action Required
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-[#71717a] mt-1 m-0">
                            Validate uploaded UPI receipts and 12-digit UTR numbers. Approving extends server by 30 days.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsEditingUpi(!isEditingUpi)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#18181b] hover:bg-[#27272a] text-[#EDEDED] text-xs font-semibold transition-colors cursor-pointer border border-[#27272a]"
                        >
                            <span>⚙️ Gateway Settings</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => fetchAdminPayments()}
                            className="px-3 py-1.5 rounded-md bg-[#18181b] hover:bg-[#27272a] text-[#EDEDED] text-xs font-semibold transition-colors cursor-pointer border border-[#27272a]"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Gateway Configuration Drawer */}
                {isEditingUpi && (
                    <div className="p-4 bg-[#0e0e10] border-b border-[#242424] animate-in fade-in">
                        <form onSubmit={handleSaveUpiConfig} className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-semibold text-[#FFFFFF] uppercase tracking-wider font-mono m-0">
                                    Configure Merchant UPI Gateway Details
                                </h3>
                                <span className="text-[10px] text-[#71717a]">
                                    Shown to clients in payment QR codes & apps
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                    <label className="block text-xs font-medium text-[#EDEDED] mb-1">
                                        Merchant UPI ID <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. yourbusiness@okaxis or yourid@upi"
                                        value={upiForm.upi_id}
                                        onChange={(e) => setUpiForm({ ...upiForm, upi_id: e.target.value })}
                                        required
                                        className="w-full bg-[#121214] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] font-mono outline-none focus:border-emerald-400/60"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[#EDEDED] mb-1">
                                        Payee Business Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Votion Game Infrastructure"
                                        value={upiForm.payee_name}
                                        onChange={(e) => setUpiForm({ ...upiForm, payee_name: e.target.value })}
                                        required
                                        className="w-full bg-[#121214] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none focus:border-emerald-400/60"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingUpi(false)}
                                    className="px-3 py-1.5 rounded bg-transparent hover:bg-[#1C1C1F] text-[#A0A0A0] text-xs cursor-pointer border border-[#27272a]"
                                >
                                    Close
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingUpi}
                                    className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[#FFFFFF] text-xs font-semibold cursor-pointer border-none"
                                >
                                    {savingUpi ? 'Saving...' : 'Save UPI Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Gateway Status Bar */}
                <div className="px-4 py-2.5 bg-[#08080a] border-b border-[#1C1C1F] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-[#71717a] font-mono text-[11px]">Active Gateway:</span>
                        <span className="font-mono text-emerald-400 font-semibold">{upiConfig.upi_id}</span>
                        <span className="text-[#52525b]">·</span>
                        <span className="text-[#A0A0A0]">{upiConfig.payee_name}</span>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                        {(['pending', 'all', 'suspicious', 'approved', 'rejected'] as const).map((filterKey) => (
                            <button
                                key={filterKey}
                                type="button"
                                onClick={() => setPaymentFilter(filterKey)}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold capitalize transition-colors cursor-pointer border ${
                                    paymentFilter === filterKey
                                        ? 'bg-[#27272a] text-[#FFFFFF] border-[#3f3f46]'
                                        : 'bg-transparent text-[#71717a] hover:text-[#FFFFFF] border-transparent'
                                }`}
                            >
                                {filterKey === 'pending'
                                    ? `Pending (${adminPayments.filter((p) => p.status === 'pending').length})`
                                    : filterKey === 'suspicious'
                                    ? `Flagged (${adminPayments.filter((p) => p.is_suspicious).length})`
                                    : filterKey}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Payments Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" role="table">
                        <thead className="bg-[#050505] text-[10px] uppercase font-mono tracking-wider text-[#71717a] border-b border-[#242424]">
                            <tr>
                                <th scope="col" className="py-3 px-4 font-semibold">Receipt / Proof</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Server & Client</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Amount (INR)</th>
                                <th scope="col" className="py-3 px-4 font-semibold">UTR / Payer Name</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Anti-Fraud & Grace Period</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Status</th>
                                <th scope="col" className="py-3 px-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1C1C1F] text-xs font-mono">
                            {loadingPayments ? (
                                <TableSkeleton
                                    rows={5}
                                    columns={[
                                        { width: '40px', align: 'left' },
                                        { width: '130px', align: 'left' },
                                        { width: '90px', align: 'left' },
                                        { width: '100px', align: 'left' },
                                        { width: '70px', align: 'left' },
                                        { width: '90px', align: 'left' },
                                        { width: '130px', align: 'right' },
                                    ]}
                                />
                            ) : filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-[#71717a]">
                                        No renewal payments match the selected filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredPayments.map((p) => (
                                    <tr key={p.id} className="hover:bg-[#121214] transition-colors">
                                        {/* Proof thumbnail */}
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            {p.screenshot_path ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedProofImage(p.screenshot_path)}
                                                    className="group relative block w-14 h-14 rounded-lg overflow-hidden border border-[#27272a] hover:border-emerald-500/60 transition-colors p-0 cursor-pointer bg-black"
                                                    title="Click to view full receipt"
                                                >
                                                    <img
                                                        src={p.screenshot_path}
                                                        alt="Proof"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                    <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-sans font-bold">
                                                        View
                                                    </span>
                                                </button>
                                            ) : (
                                                <span className="text-[#71717a] text-[10px]">No file</span>
                                            )}
                                        </td>

                                        {/* Server & Client */}
                                        <td className="py-3.5 px-4">
                                            <span className="text-[#FFFFFF] font-semibold block">
                                                {p.server?.name || 'Server #' + p.server_id}
                                            </span>
                                            <span className="text-[10px] text-[#71717a] block">
                                                User: {p.user?.username || 'Client #' + p.user_id} ({p.user?.email})
                                            </span>
                                            <span className="text-[10px] text-[#A0A0A0] block mt-0.5">
                                                Expires: {formatDateDisplay(p.server?.expires_at)}
                                            </span>
                                        </td>

                                        {/* Amount */}
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            <span className="text-base font-bold text-amber-400">
                                                ₹{p.amount.toLocaleString('en-IN')}
                                            </span>
                                        </td>

                                        {/* UTR & Payer */}
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-[#EDEDED]">{p.utr_number}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => navigator.clipboard.writeText(p.utr_number)}
                                                    className="px-1.5 py-0.5 rounded bg-[#27272a] hover:bg-[#3f3f46] text-[9px] text-[#EDEDED] cursor-pointer border-none"
                                                    title="Copy UTR"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                            <span className="text-[10px] text-[#71717a] block mt-0.5">
                                                Payer: {p.payer_name || 'N/A'}
                                            </span>
                                            {p.payment_note && (
                                                <span className="text-[10px] text-emerald-400 font-mono block mt-0.5" title="Individual UPI Payment Note">
                                                    Note: {p.payment_note}
                                                </span>
                                            )}
                                        </td>

                                        {/* Anti-Fraud & Grace Period */}
                                        <td className="py-3.5 px-4">
                                            <div className="space-y-1">
                                                {p.is_suspicious ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/70 text-red-400 border border-red-500/40" title={p.suspicious_reason || ''}>
                                                        ⚠️ Flagged: {p.suspicious_reason || 'Suspicious submission'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                                                        ✓ Valid UTR & Receipt
                                                    </span>
                                                )}

                                                {p.grace_period_granted && p.status === 'pending' && (
                                                    <span className="block text-[10px] text-cyan-300 font-semibold animate-pulse">
                                                        ⚡ 12h Grace Active (Unsuspended)
                                                    </span>
                                                )}
                                                {!p.grace_period_granted && p.is_suspicious && (
                                                    <span className="block text-[10px] text-zinc-400">
                                                        Grace Withheld (Suspended)
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            {p.status === 'pending' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-500/30">
                                                    Pending Review
                                                </span>
                                            ) : p.status === 'approved' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                                                    Approved
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/70 text-red-400 border border-red-500/40" title={p.rejection_reason || ''}>
                                                    Rejected
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                            {p.status === 'pending' ? (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApprovePayment(p)}
                                                        disabled={actionLoadingId === p.id}
                                                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[#FFFFFF] text-xs font-semibold cursor-pointer border-none transition-colors"
                                                    >
                                                        {actionLoadingId === p.id ? 'Approving...' : 'Approve (+30d)'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setRejectModalPayment(p);
                                                            setRejectionReasonInput('Payment receipt could not be verified or UTR was invalid.');
                                                        }}
                                                        disabled={actionLoadingId === p.id}
                                                        className="px-3 py-1.5 rounded bg-red-950/60 hover:bg-red-900/60 text-red-300 text-xs font-semibold cursor-pointer border border-red-500/40 transition-colors"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-[#71717a]">
                                                    {p.reviewed_at ? new Date(p.reviewed_at).toLocaleDateString() : 'Reviewed'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 3. Invoices Ledger & Game Server Subscriptions */}
            <section className="bg-[#0A0A0A] border border-[#242424] rounded-xl overflow-hidden shadow-xl" aria-label="Game Server Subscriptions and Invoices">
                <div className="p-4 sm:p-5 border-b border-[#242424] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-base font-semibold text-[#FFFFFF] m-0">
                            Game Server Subscriptions & Invoices (INR ₹)
                        </h2>
                        <p className="text-xs text-[#71717a] mt-1 m-0">
                            Set expiry dates and renewal prices in INR together. Servers automatically suspend past expiry.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => {
                                setNewSubscriptionExpiry(formatDate(30));
                                setNewSubscriptionAmountInr(899);
                                setIsCreateInvoiceOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#EDEDED] text-[#000000] text-xs font-semibold transition-colors cursor-pointer border-none"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>New Subscription</span>
                        </button>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-3 sm:px-5 border-b border-[#1C1C1F] bg-[#0E0E10] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        {['all', 'open', 'overdue', 'paid'].map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => setInvoiceFilter(filter)}
                                aria-pressed={invoiceFilter === filter}
                                className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition-colors cursor-pointer border ${
                                    invoiceFilter === filter
                                        ? 'bg-[#27272a] text-[#FFFFFF] border-[#3f3f46]'
                                        : 'bg-transparent text-[#71717a] hover:text-[#FFFFFF] border-transparent'
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="Search server, game, client..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#050505] border border-[#27272a] rounded px-2.5 py-1 text-xs text-[#FFFFFF] placeholder-[#52525b] outline-none focus:border-[#52525b]"
                            aria-label="Search game server invoices"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1.5 text-xs text-[#71717a] hover:text-[#FFFFFF] bg-transparent border-none cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Invoices Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" role="table" aria-label="Game Server Invoices Table">
                        <thead className="bg-[#050505] text-[10px] uppercase font-mono tracking-wider text-[#71717a] border-b border-[#242424]">
                            <tr>
                                <th scope="col" className="py-3 px-4 font-semibold">Invoice / ID</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Game Server & Client</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Tier & RAM</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Expiry & Suspension</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Renewal Amount (INR)</th>
                                <th scope="col" className="py-3 px-4 font-semibold">Status</th>
                                <th scope="col" className="py-3 px-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#18181b] text-xs">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-[#52525b]">
                                        No invoices match the selected filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((inv) => {
                                    const exp = inv.expiresAt || inv.dueAt;
                                    let diffDays: number | null = null;
                                    if (exp) {
                                        const [yyyy, mm, dd] = exp.includes('T') ? exp.split('T')[0].split('-') : exp.split('-');
                                        const target = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                    }

                                    return (
                                        <tr key={inv.id} className="hover:bg-[#121214] transition-colors">
                                            <td className="py-3.5 px-4 font-mono">
                                                <span className="font-semibold text-[#FFFFFF]">{inv.id}</span>
                                                <span className="block text-[10px] text-[#71717a] mt-0.5">{inv.nodeName}</span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="font-medium text-[#FFFFFF] flex items-center gap-1.5">
                                                    <span>{inv.serverName}</span>
                                                    {inv.isSuspended && (
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase tracking-wider bg-red-950/60 text-red-400 border border-red-500/30">
                                                            Suspended
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-[#71717a] mt-0.5">
                                                    {inv.clientUsername} · <span className="font-mono">{inv.clientEmail}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 font-sans">
                                                <span className="text-[#EDEDED] font-medium">{inv.planName}</span>
                                                <span className="block text-[10px] text-emerald-400 font-mono mt-0.5">
                                                    {inv.ramGb} GB RAM · {inv.game}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-xs font-semibold ${
                                                        diffDays !== null && diffDays <= 0
                                                            ? 'text-red-400'
                                                            : diffDays !== null && diffDays <= 3
                                                            ? 'text-amber-400'
                                                            : 'text-[#EDEDED]'
                                                    }`}>
                                                        {formatDateDisplay(exp)}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingExpiryInvoice(inv);
                                                            setTargetExpiryDate(exp ? (exp.includes('T') ? exp.split('T')[0] : exp) : formatDate(30));
                                                            setTargetRenewalAmountInr(inv.renewalPriceInr || Math.round(inv.totalCents / 100));
                                                            setUnsuspendOnExpiryUpdate(true);
                                                        }}
                                                        className="text-[10px] text-[#71717a] hover:text-amber-400 bg-transparent border-none cursor-pointer"
                                                        title="Set Expiry Date and Renewal Price Together"
                                                    >
                                                        ✎ Edit
                                                    </button>
                                                </div>
                                                <div className="text-[10px] mt-0.5">
                                                    {diffDays !== null ? (
                                                        diffDays > 0 ? (
                                                            <span className={diffDays <= 3 ? 'text-amber-400' : 'text-emerald-400'}>
                                                                Expires in {diffDays} days
                                                            </span>
                                                        ) : diffDays === 0 ? (
                                                            <span className="text-red-400 font-bold">Expires Today</span>
                                                        ) : (
                                                            <span className="text-red-400">
                                                                Expired {Math.abs(diffDays)}d ago · Suspended
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-[#71717a]">No expiry set</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                                                <span className="font-semibold text-[#FFFFFF] text-sm">
                                                    {formatCurrency(inv.totalCents, 'INR')}
                                                </span>
                                                <span className="block text-[10px] text-[#71717a]">
                                                    renewal price
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                                                        inv.status === 'paid'
                                                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                                                            : inv.status === 'overdue' || inv.isSuspended
                                                            ? 'bg-red-950/40 text-red-400 border border-red-500/30'
                                                            : 'bg-amber-950/40 text-amber-400 border border-amber-500/30'
                                                    }`}
                                                >
                                                    {inv.isSuspended ? 'Suspended' : inv.status}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center justify-end gap-1.5">
                                                    {inv.status !== 'paid' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRecordPayment(inv)}
                                                            className="px-2.5 py-1 rounded text-xs font-semibold bg-[#FFFFFF] hover:bg-[#EDEDED] text-[#000000] transition-colors cursor-pointer border-none"
                                                            title="Record payment: extends expiry by +30d and reactivates server"
                                                        >
                                                            Record Pay
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingExpiryInvoice(inv);
                                                            setTargetExpiryDate(exp ? (exp.includes('T') ? exp.split('T')[0] : exp) : formatDate(30));
                                                            setTargetRenewalAmountInr(inv.renewalPriceInr || Math.round(inv.totalCents / 100));
                                                            setUnsuspendOnExpiryUpdate(true);
                                                        }}
                                                        className="px-2 py-1 rounded text-[11px] text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#141416] hover:bg-[#1f1f23] border border-[#27272a] transition-colors cursor-pointer"
                                                        title="Set Expiry Date and Renewal Price Together"
                                                    >
                                                        Set Expiry & ₹
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleSuspension(inv)}
                                                        className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                                                            inv.isSuspended
                                                                ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50'
                                                                : 'border-red-500/30 bg-red-950/30 text-red-400 hover:bg-red-950/50'
                                                        }`}
                                                        title={inv.isSuspended ? 'Reactivate suspended game server' : 'Suspend game server for non-payment'}
                                                    >
                                                        {inv.isSuspended ? 'Unsuspend' : 'Suspend'}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrintReceipt(inv)}
                                                        className="px-2 py-1 rounded text-[11px] text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#141416] hover:bg-[#1f1f23] border border-[#27272a] transition-colors cursor-pointer"
                                                        title="View or print printable receipt"
                                                    >
                                                        Receipt
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 4. Automated Game Server Suspension Policy */}
            <section className="bg-[#0A0A0A] border border-[#242424] rounded-xl p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#242424]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
                            <h2 className="text-base font-semibold text-[#FFFFFF] m-0">
                                Automated Server Suspension & Lifecycle Policy
                            </h2>
                        </div>
                        <p className="text-xs text-[#71717a] mt-1 m-0">
                            Fail-closed game server lifecycle automation. Automatically suspends game container processes when the server expiry date has passed.
                        </p>
                    </div>

                    <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                            policy.autoSuspendEnabled
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                        }`}
                    >
                        {policy.autoSuspendEnabled ? 'AUTOMATION ACTIVE' : 'MANUAL REVIEW ONLY'}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                    <label className="flex items-start justify-between p-3.5 rounded-lg bg-[#121214] border border-[#242424] cursor-pointer">
                        <div>
                            <span className="text-xs font-semibold text-[#EDEDED] block">Automated Suspension</span>
                            <span className="text-[11px] text-[#71717a] block mt-0.5">Suspend servers automatically after expiry</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={policy.autoSuspendEnabled}
                            onChange={(e) => {
                                setPolicy({ ...policy, autoSuspendEnabled: e.target.checked });
                                setNotice(`Automated suspension policy ${e.target.checked ? 'enabled' : 'disabled'}.`);
                            }}
                            className="w-4 h-4 accent-emerald-400 rounded cursor-pointer mt-0.5"
                        />
                    </label>

                    <div className="p-3.5 rounded-lg bg-[#121214] border border-[#242424]">
                        <span className="text-xs font-semibold text-[#EDEDED] block">Overdue Grace Period</span>
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="number"
                                min="0"
                                max="30"
                                value={policy.gracePeriodDays}
                                onChange={(e) => setPolicy({ ...policy, gracePeriodDays: Number(e.target.value) })}
                                className="w-16 bg-[#050505] border border-[#27272a] rounded px-2 py-1 text-xs text-[#FFFFFF] font-mono"
                            />
                            <span className="text-xs text-[#71717a]">days after expiry</span>
                        </div>
                    </div>

                    <label className="flex items-start justify-between p-3.5 rounded-lg bg-[#121214] border border-[#242424] cursor-pointer">
                        <div>
                            <span className="text-xs font-semibold text-[#EDEDED] block">Auto-Unsuspend on Pay</span>
                            <span className="text-[11px] text-[#71717a] block mt-0.5">Instantly boot server when payment clears</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={policy.autoUnsuspendOnPay}
                            onChange={(e) => {
                                setPolicy({ ...policy, autoUnsuspendOnPay: e.target.checked });
                                setNotice(`Auto-unsuspend upon payment ${e.target.checked ? 'activated' : 'deactivated'}.`);
                            }}
                            className="w-4 h-4 accent-emerald-400 rounded cursor-pointer mt-0.5"
                        />
                    </label>

                    <div className="p-3.5 rounded-lg bg-[#121214] border border-[#242424]">
                        <span className="text-xs font-semibold text-[#EDEDED] block">Data Retention Period</span>
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="number"
                                min="7"
                                max="180"
                                value={policy.autoPurgeDays}
                                onChange={(e) => setPolicy({ ...policy, autoPurgeDays: Number(e.target.value) })}
                                className="w-16 bg-[#050505] border border-[#27272a] rounded px-2 py-1 text-xs text-[#FFFFFF] font-mono"
                            />
                            <span className="text-xs text-[#71717a]">days before world purge</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. Game Server Pricing Plans (Tier Catalog in INR) */}
            <section className="bg-[#0A0A0A] border border-[#242424] rounded-xl p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#242424]">
                    <div>
                        <h2 className="text-base font-semibold text-[#FFFFFF] m-0">Game Server Plan Catalog (INR ₹)</h2>
                        <p className="text-xs text-[#71717a] mt-1 m-0">
                            Pre-configured game server templates with hardware limits, port allocations, and monthly pricing in Indian Rupees.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setEditingPlan(null);
                            setIsPlanFormOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#18181b] hover:bg-[#27272a] text-[#FFFFFF] text-xs font-medium border border-[#3f3f46] transition-colors cursor-pointer"
                    >
                        + Add Custom Plan
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                    {plans.map((plan) => (
                        <div key={plan.id} className="p-4 rounded-lg bg-[#121214] border border-[#242424] flex flex-col justify-between hover:border-[#3f3f46] transition-all">
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                                            {plan.game}
                                        </span>
                                        <h3 className="text-sm font-semibold text-[#FFFFFF] mt-0.5 m-0">{plan.name}</h3>
                                    </div>
                                    <span className="text-base font-bold font-mono text-[#FFFFFF]">
                                        {formatCurrency(plan.monthlyPriceCents, 'INR')}
                                        <span className="text-[10px] font-normal text-[#71717a]">/mo</span>
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] font-mono text-[#A0A0A0] bg-[#0A0A0A] p-2.5 rounded border border-[#1C1C1F]">
                                    <div>
                                        <span className="text-[#71717a] block text-[9px] uppercase">RAM Allocation</span>
                                        <strong className="text-[#EDEDED]">{plan.ramGb} GB DDR4/5</strong>
                                    </div>
                                    <div>
                                        <span className="text-[#71717a] block text-[9px] uppercase">CPU Core Thread</span>
                                        <strong className="text-[#EDEDED]">{plan.cpuPercent}% Limit</strong>
                                    </div>
                                    <div>
                                        <span className="text-[#71717a] block text-[9px] uppercase">NVMe Storage</span>
                                        <strong className="text-[#EDEDED]">{plan.diskGb} GB NVMe</strong>
                                    </div>
                                    <div>
                                        <span className="text-[#71717a] block text-[9px] uppercase">Ports / Backups</span>
                                        <strong className="text-[#EDEDED]">{plan.allocations} Port · {plan.backups} Bkp</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-[#1C1C1F] flex items-center justify-between">
                                <span className={`text-[10px] font-mono font-semibold uppercase ${plan.isActive ? 'text-emerald-400' : 'text-[#71717a]'}`}>
                                    {plan.isActive ? '● Available' : '○ Inactive'}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingPlan(plan);
                                            setIsPlanFormOpen(true);
                                        }}
                                        className="text-xs text-[#A0A0A0] hover:text-[#FFFFFF] bg-transparent border-none cursor-pointer"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPlans((prev) => prev.filter((p) => p.id !== plan.id));
                                            setNotice(`Removed plan "${plan.name}".`);
                                        }}
                                        className="text-xs text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 6. Dedicated Server Node Margin & Density Calculator (in INR ₹) */}
            <section className="bg-[#0A0A0A] border border-[#242424] rounded-xl p-5 shadow-xl">
                <div className="pb-4 border-b border-[#242424]">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                            INR Calculator
                        </span>
                        <h2 className="text-base font-semibold text-[#FFFFFF] m-0">
                            Node Capacity, Break-Even & Profit Calculator (₹ INR)
                        </h2>
                    </div>
                    <p className="text-xs text-[#71717a] mt-1 m-0">
                        Simulate game server hosting density, hardware break-even server thresholds, and operating gross margin per physical daemon box in Indian Rupees.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
                    {/* Controls */}
                    <div className="lg:col-span-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-[#EDEDED]">
                                    Node Monthly Cost (₹ INR)
                                    <input
                                        type="number"
                                        min="100"
                                        value={calcNodeCost}
                                        onChange={(e) => setCalcNodeCost(Math.max(1, Number(e.target.value)))}
                                        className="mt-1 w-full bg-[#121214] border border-[#242424] rounded px-3 py-2 text-xs text-[#FFFFFF] font-mono outline-none"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#EDEDED]">
                                    Physical RAM Capacity (GB)
                                    <input
                                        type="number"
                                        min="16"
                                        step="16"
                                        value={calcNodeRam}
                                        onChange={(e) => setCalcNodeRam(Math.max(16, Number(e.target.value)))}
                                        className="mt-1 w-full bg-[#121214] border border-[#242424] rounded px-3 py-2 text-xs text-[#FFFFFF] font-mono outline-none"
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-[#EDEDED]">
                                    Avg Game Server RAM (GB)
                                    <input
                                        type="number"
                                        min="1"
                                        value={calcAvgServerRam}
                                        onChange={(e) => setCalcAvgServerRam(Math.max(1, Number(e.target.value)))}
                                        className="mt-1 w-full bg-[#121214] border border-[#242424] rounded px-3 py-2 text-xs text-[#FFFFFF] font-mono outline-none"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#EDEDED]">
                                    Price / GB RAM (₹/mo)
                                    <input
                                        type="number"
                                        min="10"
                                        step="10"
                                        value={calcPricePerGb}
                                        onChange={(e) => setCalcPricePerGb(Math.max(10, Number(e.target.value)))}
                                        className="mt-1 w-full bg-[#121214] border border-[#242424] rounded px-3 py-2 text-xs text-[#FFFFFF] font-mono outline-none"
                                    />
                                </label>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-xs font-semibold text-[#EDEDED] mb-1.5">
                                <span>Simulated Active Game Servers:</span>
                                <strong className="font-mono text-emerald-400 text-sm">
                                    {calcActiveServers} Servers ({calcActiveServers * calcAvgServerRam} GB RAM)
                                </strong>
                            </div>
                            <input
                                type="range"
                                role="slider"
                                aria-label="Simulated active game servers on node"
                                aria-valuemin={0}
                                aria-valuemax={maxSimulatedServers}
                                aria-valuenow={calcActiveServers}
                                aria-valuetext={`${calcActiveServers} game servers (${Math.round((calcActiveServers / maxSimulatedServers) * 100)}% capacity)`}
                                min="0"
                                max={maxSimulatedServers}
                                value={calcActiveServers}
                                onChange={(e) => setCalcActiveServers(Number(e.target.value))}
                                className="w-full accent-emerald-400 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-[#71717a] mt-1 font-mono">
                                <span>0 Servers</span>
                                <span className="text-amber-400 font-bold">Break-Even: {breakEvenServers} Servers</span>
                                <span>Max Safe Capacity: {maxSimulatedServers} Servers</span>
                            </div>
                        </div>
                    </div>

                    {/* Live Metric Gauges */}
                    <div className="lg:col-span-6 bg-[#121214] border border-[#242424] rounded-xl p-5 flex flex-col justify-between">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-[#0A0A0A] rounded border border-[#1C1C1F]">
                                <span className="text-[10px] font-mono uppercase text-[#71717a]">Monthly Node Revenue</span>
                                <span className="block text-xl font-bold font-mono text-[#FFFFFF] mt-1">
                                    ₹{simulatedRevenue.toLocaleString('en-IN')}
                                </span>
                            </div>

                            <div className="p-3 bg-[#0A0A0A] rounded border border-[#1C1C1F]">
                                <span className="text-[10px] font-mono uppercase text-[#71717a]">Net Node Profit</span>
                                <span className={`block text-xl font-bold font-mono mt-1 ${simulatedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {simulatedProfit >= 0 ? '+' : ''}₹{simulatedProfit.toLocaleString('en-IN')}
                                </span>
                            </div>

                            <div className="p-3 bg-[#0A0A0A] rounded border border-[#1C1C1F]">
                                <span className="text-[10px] font-mono uppercase text-[#71717a]">Operating Margin</span>
                                <span className={`block text-xl font-bold font-mono mt-1 ${simulatedMargin >= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {simulatedMargin.toFixed(1)}%
                                </span>
                            </div>

                            <div className="p-3 bg-[#0A0A0A] rounded border border-[#1C1C1F]">
                                <span className="text-[10px] font-mono uppercase text-[#71717a]">RAM Allocation Density</span>
                                <span className="block text-xl font-bold font-mono text-[#FFFFFF] mt-1">
                                    {Math.round((calcActiveServers / maxSimulatedServers) * 100)}%
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#1C1C1F] text-xs text-[#71717a]">
                            <p className="m-0 leading-relaxed">
                                At current density, this dedicated box requires{' '}
                                <strong className="text-amber-400 font-mono">{breakEvenServers} game servers</strong> to completely cover hardware and power costs.
                                Additional servers generate pure profit at ~<strong className="text-emerald-400 font-mono">₹{(calcAvgServerRam * calcPricePerGb).toLocaleString('en-IN')}/mo</strong> each.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Modal: Create Game Server Subscription (Sets Expiry & Amount in INR Together) */}
            {isCreateInvoiceOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Create New Game Server Subscription"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                >
                    <div className="bg-[#0e0e10] border border-[#27272a] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-[#242424] pb-3">
                            <div>
                                <h3 className="text-base font-semibold text-[#FFFFFF] m-0">Create Game Server Subscription</h3>
                                <p className="text-xs text-amber-400 mt-0.5 m-0 font-mono">Configures Expiry Date & Renewal Amount (₹ INR) Together</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateInvoiceOpen(false)}
                                className="text-[#71717a] hover:text-[#FFFFFF] bg-transparent border-none cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.currentTarget as any;
                                const selectedPlan = plans.find((p) => p.id === form.planId.value) || plans[0];
                                const expDate = newSubscriptionExpiry || formatDate(30);
                                const renewalAmount = Number(form.renewalAmount.value) || newSubscriptionAmountInr || 899;
                                const totalPaise = renewalAmount * 100;

                                const newInv: GameServerInvoice = {
                                    id: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
                                    serverId: form.serverId.value || `srv_${Date.now()}`,
                                    serverName: form.serverName.value,
                                    game: selectedPlan.game,
                                    clientUsername: form.username.value,
                                    clientEmail: form.email.value,
                                    planId: selectedPlan.id,
                                    planName: selectedPlan.name,
                                    nodeName: 'US-East 01',
                                    ramGb: selectedPlan.ramGb,
                                    billingCycle: form.cycle.value,
                                    subtotalCents: totalPaise,
                                    totalCents: totalPaise,
                                    paidCents: 0,
                                    outstandingCents: totalPaise,
                                    currency: 'INR',
                                    status: 'open',
                                    issuedAt: new Date().toISOString(),
                                    dueAt: expDate,
                                    expiresAt: expDate,
                                    renewalPriceInr: renewalAmount,
                                    isSuspended: false,
                                };
                                setInvoices((prev) => [newInv, ...prev]);
                                setIsCreateInvoiceOpen(false);
                                setNotice(`Created subscription ${newInv.id} for "${newInv.serverName}" expiring on ${formatDateDisplay(expDate)} at ₹${renewalAmount}/mo.`);
                            }}
                            className="space-y-4 text-xs"
                        >
                            <div>
                                <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                    Game Server Name
                                </label>
                                <input
                                    name="serverName"
                                    required
                                    placeholder="e.g. Pixelmon SMP or Rust 2x"
                                    className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Client Username
                                    </label>
                                    <input
                                        name="username"
                                        required
                                        placeholder="Username"
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Client Email
                                    </label>
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        placeholder="client@domain.com"
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Pricing Plan Tier
                                    </label>
                                    <select
                                        name="planId"
                                        onChange={(e) => {
                                            const p = plans.find((item) => item.id === e.target.value);
                                            if (p) setNewSubscriptionAmountInr(Math.round(p.monthlyPriceCents / 100));
                                        }}
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                    >
                                        {plans.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({formatCurrency(p.monthlyPriceCents, 'INR')}/mo)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Billing Cycle
                                    </label>
                                    <select
                                        name="cycle"
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                    >
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="annually">Annually</option>
                                    </select>
                                </div>
                            </div>

                            {/* Set Expiry Date Together with Renewal Amount */}
                            <div className="border border-[#27272a] rounded-lg p-3 bg-[#0A0A0C] space-y-3">
                                <span className="text-xs font-semibold text-amber-400 block font-mono">
                                    ★ Expiry & Renewal Amount (INR ₹)
                                </span>

                                <ResponsiveExpiryDatePicker
                                    value={newSubscriptionExpiry}
                                    onChange={setNewSubscriptionExpiry}
                                    label="Initial Server Expiry Date"
                                    helperText="Server will automatically suspend on this date."
                                />

                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Renewal Amount (INR ₹):
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-amber-400 font-mono">₹</span>
                                        <input
                                            name="renewalAmount"
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={newSubscriptionAmountInr}
                                            onChange={(e) => setNewSubscriptionAmountInr(Number(e.target.value))}
                                            required
                                            className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] font-mono outline-none focus:border-amber-400/60"
                                            placeholder="e.g. 899"
                                        />
                                        <span className="text-xs text-[#71717a] whitespace-nowrap">INR / cycle</span>
                                    </div>
                                </div>
                            </div>

                            <input type="hidden" name="serverId" value={`srv_${Date.now()}`} />

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateInvoiceOpen(false)}
                                    className="px-4 py-2 rounded bg-transparent hover:bg-[#1C1C1F] text-[#A0A0A0] text-xs cursor-pointer border border-[#27272a]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded bg-[#FFFFFF] hover:bg-[#EDEDED] text-[#000000] text-xs font-semibold cursor-pointer border-none"
                                >
                                    Create Subscription
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Set Server Expiry Date AND Renewal Amount (INR ₹) Together */}
            {editingExpiryInvoice && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Set Server Expiry Date and Renewal Amount"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                >
                    <div className="bg-[#0e0e10] border border-[#27272a] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[#242424] pb-3">
                            <div>
                                <h3 className="text-base font-semibold text-[#FFFFFF] m-0">
                                    Set Expiry Date & Renewal Price
                                </h3>
                                <p className="text-xs text-[#71717a] mt-0.5 m-0">
                                    {editingExpiryInvoice.serverName} ({editingExpiryInvoice.game})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingExpiryInvoice(null)}
                                className="text-[#71717a] hover:text-[#FFFFFF] bg-transparent border-none cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveExpiryAndAmount} className="space-y-4">
                            {/* Expiry Date input */}
                            <ResponsiveExpiryDatePicker
                                value={targetExpiryDate}
                                onChange={setTargetExpiryDate}
                                label="Server Expiry Date"
                            />

                            {/* Renewal Amount (INR ₹) input set together */}
                            <div className="bg-[#050505] p-3 rounded-lg border border-[#27272a]">
                                <label className="block text-xs font-semibold text-[#EDEDED] mb-1.5 flex items-center gap-1.5">
                                    <span className="text-amber-400 font-bold">₹</span>
                                    <span>Renewal Amount (INR ₹)</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={targetRenewalAmountInr}
                                        onChange={(e) => setTargetRenewalAmountInr(Number(e.target.value))}
                                        required
                                        className="w-full bg-[#121214] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] font-mono outline-none focus:border-amber-400/60"
                                        placeholder="e.g. 899"
                                    />
                                    <span className="text-xs text-[#71717a] whitespace-nowrap">INR to Renew</span>
                                </div>
                                <span className="block text-[10px] text-[#71717a] mt-1 font-mono">
                                    This is the exact renewal amount the client will see in their billing section.
                                </span>
                            </div>

                            {editingExpiryInvoice.isSuspended && (
                                <label className="flex items-center gap-2 p-2.5 rounded bg-[#121214] border border-[#242424] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={unsuspendOnExpiryUpdate}
                                        onChange={(e) => setUnsuspendOnExpiryUpdate(e.target.checked)}
                                        className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
                                    />
                                    <span className="text-xs text-emerald-400">
                                        Reactivate / unsuspend server immediately
                                    </span>
                                </label>
                            )}

                            <div className="flex justify-end gap-2 pt-2 border-t border-[#242424]">
                                <button
                                    type="button"
                                    onClick={() => setEditingExpiryInvoice(null)}
                                    className="px-4 py-2 rounded bg-transparent hover:bg-[#1C1C1F] text-[#A0A0A0] text-xs cursor-pointer border border-[#27272a]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded bg-[#FFFFFF] hover:bg-[#EDEDED] text-[#000000] text-xs font-semibold cursor-pointer border-none"
                                >
                                    Save Expiry & Price
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Add or Edit Plan */}
            {isPlanFormOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add or Edit Game Server Plan"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                >
                    <div className="bg-[#0e0e10] border border-[#27272a] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[#242424] pb-3">
                            <h3 className="text-base font-semibold text-[#FFFFFF] m-0">
                                {editingPlan ? 'Edit Game Server Plan' : 'Create Game Server Plan'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsPlanFormOpen(false)}
                                className="text-[#71717a] hover:text-[#FFFFFF] bg-transparent border-none cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.currentTarget as any;
                                const planData: GameServerPlan = {
                                    id: editingPlan?.id || `plan_${Date.now()}`,
                                    name: form.planName.value,
                                    game: form.game.value,
                                    currency: 'INR',
                                    monthlyPriceCents: Math.round(Number(form.price.value) * 100),
                                    ramGb: Number(form.ram.value),
                                    cpuPercent: Number(form.cpu.value),
                                    diskGb: Number(form.disk.value),
                                    allocations: Number(form.allocations.value),
                                    backups: Number(form.backups.value),
                                    databases: 1,
                                    isActive: true,
                                };

                                if (editingPlan) {
                                    setPlans((prev) => prev.map((p) => (p.id === editingPlan.id ? planData : p)));
                                    setNotice(`Updated plan "${planData.name}".`);
                                } else {
                                    setPlans((prev) => [...prev, planData]);
                                    setNotice(`Added plan "${planData.name}".`);
                                }
                                setIsPlanFormOpen(false);
                            }}
                            className="space-y-4 text-xs"
                        >
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Plan Name
                                    </label>
                                    <input
                                        name="planName"
                                        defaultValue={editingPlan?.name || ''}
                                        required
                                        placeholder="e.g. Minecraft 8GB Performance"
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Game Category
                                    </label>
                                    <input
                                        name="game"
                                        defaultValue={editingPlan?.game || 'Minecraft'}
                                        required
                                        placeholder="Minecraft, Rust, Palworld"
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Price / Month (₹ INR)
                                    </label>
                                    <input
                                        name="price"
                                        type="number"
                                        step="1"
                                        defaultValue={editingPlan ? Math.round(editingPlan.monthlyPriceCents / 100) : 899}
                                        required
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        RAM (GB)
                                    </label>
                                    <input
                                        name="ram"
                                        type="number"
                                        min="0.5"
                                        step="0.5"
                                        defaultValue={editingPlan?.ramGb || 4}
                                        required
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        CPU Limit (%)
                                    </label>
                                    <input
                                        name="cpu"
                                        type="number"
                                        min="25"
                                        step="25"
                                        defaultValue={editingPlan?.cpuPercent || 200}
                                        required
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        NVMe Disk (GB)
                                    </label>
                                    <input
                                        name="disk"
                                        type="number"
                                        min="5"
                                        defaultValue={editingPlan?.diskGb || 25}
                                        required
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Port Allocations
                                    </label>
                                    <input
                                        name="allocations"
                                        type="number"
                                        min="1"
                                        defaultValue={editingPlan?.allocations || 1}
                                        required
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#EDEDED] mb-1">
                                        Backup Slots
                                    </label>
                                    <input
                                        name="backups"
                                        type="number"
                                        min="0"
                                        defaultValue={editingPlan?.backups || 2}
                                        required
                                        className="w-full bg-[#050505] border border-[#27272a] rounded px-3 py-2 text-xs text-[#FFFFFF] outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsPlanFormOpen(false)}
                                    className="px-4 py-2 rounded bg-transparent hover:bg-[#1C1C1F] text-[#A0A0A0] text-xs cursor-pointer border border-[#27272a]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded bg-[#FFFFFF] hover:bg-[#EDEDED] text-[#000000] text-xs font-semibold cursor-pointer border-none"
                                >
                                    {editingPlan ? 'Save Plan Changes' : 'Create Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Proof Lightbox Modal */}
            {selectedProofImage && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Payment Screenshot Proof"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
                    onClick={() => setSelectedProofImage(null)}
                >
                    <div
                        className="bg-[#0e0e10] border border-[#27272a] rounded-xl max-w-2xl w-full p-4 shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">Payment Screenshot Proof</span>
                                <a
                                    href={selectedProofImage}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-emerald-400 hover:underline"
                                >
                                    Open Full Size ↗
                                </a>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedProofImage(null)}
                                className="text-[#71717a] hover:text-[#FFFFFF] bg-transparent border-none cursor-pointer text-base"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="py-3 flex justify-center max-h-[75vh] overflow-auto bg-black/50 rounded-lg mt-2">
                            <img
                                src={selectedProofImage}
                                alt="UPI Payment Proof"
                                className="max-w-full max-h-[70vh] object-contain rounded"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Rejection Modal */}
            {rejectModalPayment && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Reject Payment"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                >
                    <div className="bg-[#0e0e10] border border-[#27272a] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[#242424] pb-3">
                            <div>
                                <h3 className="text-base font-semibold text-red-400 m-0">
                                    Reject Renewal Payment
                                </h3>
                                <p className="text-xs text-[#71717a] mt-0.5 m-0">
                                    Server: {rejectModalPayment.server?.name} (UTR: {rejectModalPayment.utr_number})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRejectModalPayment(null)}
                                className="text-[#71717a] hover:text-[#FFFFFF] bg-transparent border-none cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 space-y-1">
                            <strong>Policy Notice:</strong>
                            <p className="m-0 text-[11px]">
                                Rejecting this payment will revoke the 12-hour grace period immediately. If the server is past its expiration date, it will be automatically re-suspended.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-[#EDEDED] mb-1">
                                Rejection Reason (shown to client):
                            </label>
                            <textarea
                                rows={3}
                                value={rejectionReasonInput}
                                onChange={(e) => setRejectionReasonInput(e.target.value)}
                                className="w-full bg-[#121214] border border-[#27272a] rounded p-2 text-xs text-[#FFFFFF] outline-none focus:border-red-400/60"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-[#242424]">
                            <button
                                type="button"
                                onClick={() => setRejectModalPayment(null)}
                                className="px-3 py-1.5 rounded bg-transparent hover:bg-[#1C1C1F] text-[#A0A0A0] text-xs cursor-pointer border border-[#27272a]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmReject}
                                disabled={actionLoadingId === rejectModalPayment.id}
                                className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer border-none"
                            >
                                {actionLoadingId === rejectModalPayment.id ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingOperationsView;
