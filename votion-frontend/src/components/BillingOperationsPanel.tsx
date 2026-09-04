import React, { useEffect, useMemo, useState } from 'react';
import { FinanceOperationsVisual } from './FinanceOperationsVisual';
import {
  apiClient,
  ApiBillingConfig,
  ApiBillingCostBase,
  ApiBillingInvoice,
  ApiBillingSummary,
  ApiBillingServerCost,
  ApiBillingServerProfitability,
  ApiBillingSuspensionAction,
  ApiProxmoxConnection,
  ApiProxmoxVmIdentityConflict,
  ApiPricingPlan,
  ApiVmBillingProfile,
  BillingCurrency,
} from '../services/apiClient';

const money = (cents: number, currency = 'USD') => new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2,
}).format((Number(cents) || 0) / 100);
const moneyPaise = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format((Number(paise) || 0) / 100);
const projectedRevenueLabel = (value: Record<string, { cents: number; assignmentCount: number }>) => Object.entries(value || {}).map(([currency, item]) => `${money(item.cents, currency)} projected · ${item.assignmentCount} assignment${item.assignmentCount === 1 ? '' : 's'}`).join(' · ');

const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const amountToMinorUnits = (value: string) => Math.max(0, Math.round((Number(value) || 0) * 100));
const minorUnitsToAmountInput = (value: number) => (Number(value || 0) / 100).toFixed(2).replace(/\.00$/, '');
const rupeesToPaise = amountToMinorUnits;
const paiseToRupeesInput = minorUnitsToAmountInput;

interface PlanFormState {
  id: string;
  name: string;
  currency: BillingCurrency;
  monthlyPriceCents: string;
  vcpuLimit: string;
  ramGb: string;
  diskGb: string;
  bandwidthGb: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyPlan: PlanFormState = {
  id: '',
  name: '',
  currency: 'INR',
  monthlyPriceCents: '0',
  vcpuLimit: '1',
  ramGb: '1',
  diskGb: '10',
  bandwidthGb: '',
  isActive: true,
  sortOrder: '0',
};

const emptyCost = { id: '', name: '', monthlyCostCents: '0', allocationMethod: 'fixed', currency: 'INR' as BillingCurrency, isActive: true };
const emptyServerCost = { id: '', name: '', nodeName: '', proxmoxConnectionId: '', monthlyCostPaise: '0', ipCostPaise: '0', plannedVmCapacity: '0', includedIpCount: '0', isActive: true };
const billingCurrencyOptions: Array<{ value: BillingCurrency; label: string }> = [
  { value: 'INR', label: 'INR — Indian Rupee (₹)' },
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
];

type BillingKpiIconKind = 'revenue' | 'collected' | 'outstanding' | 'cost' | 'profit' | 'margin';

const BillingKpiIcon: React.FC<{ kind: BillingKpiIconKind }> = ({ kind }) => {
  const iconPath = {
    revenue: <><circle cx="11" cy="11" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 6.5v9M13.5 8.5c-.5-.8-1.3-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.7 0 2.5 4.8 1.2 4.8 3.8 0 1.1-1 1.9-2.5 1.9-1.2 0-2.1-.4-2.7-1.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
    collected: <><path d="M3 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm1-3h11a2 2 0 0 1 2 2v1H4a2 2 0 0 0-2 2V5.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 10.5h5v3h-5a1.5 1.5 0 1 1 0-3Z" fill="none" stroke="currentColor" strokeWidth="1.6" /></>,
    outstanding: <><path d="M3 19.5h16M5 17V8m4 9V8m4 9V8m4 9V8M3 6l8-4 8 4H3Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 10v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="11" cy="15.3" r=".7" fill="currentColor" /></>,
    cost: <><rect x="2.5" y="3" width="17" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="2.5" y="13" width="17" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 6h.01M6 16h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M10 6h6M10 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
    profit: <><path d="M3 17 8 12l3 2 7-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 6h4v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 19h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
    margin: <><path d="M3 15a8 8 0 1 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="m11 15 3.8-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M5 18h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
  }[kind];

  return <svg aria-hidden="true" height="16" viewBox="0 0 22 22" width="16">{iconPath}</svg>;
};

export const BillingOperationsPanel: React.FC = () => {
  const [summary, setSummary] = useState<ApiBillingSummary | null>(null);
  const [plans, setPlans] = useState<ApiPricingPlan[]>([]);
  const [invoices, setInvoices] = useState<ApiBillingInvoice[]>([]);
  const [profiles, setProfiles] = useState<ApiVmBillingProfile[]>([]);
  const [suspensionActions, setSuspensionActions] = useState<ApiBillingSuspensionAction[]>([]);
  const [costBases, setCostBases] = useState<ApiBillingCostBase[]>([]);
  const [serverCosts, setServerCosts] = useState<ApiBillingServerCost[]>([]);
  const [serverProfitability, setServerProfitability] = useState<ApiBillingServerProfitability[]>([]);
  const [connections, setConnections] = useState<ApiProxmoxConnection[]>([]);
  const [identityConflicts, setIdentityConflicts] = useState<ApiProxmoxVmIdentityConflict[]>([]);
  const [config, setConfig] = useState<ApiBillingConfig | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [costForm, setCostForm] = useState(emptyCost);
  const [serverCostForm, setServerCostForm] = useState(emptyServerCost);
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Interactive Dedicated-Server Break-Even & Profit Calculator state
  const [calcConnId, setCalcConnId] = useState<string>('custom');
  const [calcServerCost, setCalcServerCost] = useState<number>(12000);
  const [calcVmCapacity, setCalcVmCapacity] = useState<number>(20);
  const [calcAvgPrice, setCalcAvgPrice] = useState<number>(1200);
  const [calcIpCost, setCalcIpCost] = useState<number>(200);
  const [calcIncludedIps, setCalcIncludedIps] = useState<number>(1);
  const [calcActiveVms, setCalcActiveVms] = useState<number>(8);

  const handleSelectCalcConnection = (connId: string) => {
    setCalcConnId(connId);
    if (connId === 'custom') return;
    const costProfile = serverCosts.find(c => c.proxmoxConnectionId === connId);
    const profRow = serverProfitability.find(p => p.proxmoxConnectionId === connId);
    if (costProfile) {
      setCalcServerCost(Math.round(costProfile.monthlyCostPaise / 100));
      setCalcIpCost(Math.round(costProfile.ipCostPaise / 100));
      setCalcIncludedIps(costProfile.includedIpCount || 1);
      if (costProfile.plannedVmCapacity > 0) setCalcVmCapacity(costProfile.plannedVmCapacity);
    }
    if (profRow && profRow.runningVmCount > 0) {
      setCalcActiveVms(profRow.runningVmCount);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    const sections = ['summary', 'pricing plans', 'invoices', 'billing policy', 'cost bases', 'dedicated-server costs', 'server profitability', 'VM billing assignments', 'suspension actions', 'Proxmox connections', 'VM identity diagnostics'] as const;
    const requests = [
      apiClient.getBillingSummary(),
      apiClient.getBillingPlans(),
      apiClient.getBillingInvoices(),
      apiClient.getBillingConfig(),
      apiClient.getBillingCostBases(),
      apiClient.getBillingServerCosts(),
      apiClient.getBillingServerProfitability(),
      apiClient.getVmBillingProfiles(),
      apiClient.getBillingSuspensionActions(),
      apiClient.getProxmoxConnections(),
      apiClient.getProxmoxVmIdentityConflicts(),
    ] as const;
    const results = await Promise.allSettled(requests);
    const [summaryResult, plansResult, invoicesResult, configResult, costBasesResult, serverCostsResult, profitabilityResult, profilesResult, actionsResult, connectionsResult, conflictsResult] = results;
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
    if (plansResult.status === 'fulfilled') setPlans(plansResult.value);
    if (invoicesResult.status === 'fulfilled') setInvoices(invoicesResult.value);
    if (configResult.status === 'fulfilled') setConfig(configResult.value);
    if (costBasesResult.status === 'fulfilled') setCostBases(costBasesResult.value);
    if (serverCostsResult.status === 'fulfilled') setServerCosts(serverCostsResult.value);
    if (profitabilityResult.status === 'fulfilled') setServerProfitability(profitabilityResult.value);
    if (profilesResult.status === 'fulfilled') setProfiles(profilesResult.value);
    if (actionsResult.status === 'fulfilled') setSuspensionActions(actionsResult.value);
    if (connectionsResult.status === 'fulfilled') setConnections(connectionsResult.value);
    if (conflictsResult.status === 'fulfilled') setIdentityConflicts(conflictsResult.value);
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [
      `${sections[index]}: ${result.reason instanceof Error ? result.reason.message : 'request failed'}`,
    ] : []);
    if (failures.length > 0) {
      setError(`Some billing data could not be loaded. ${failures.join(' · ')}`);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filteredInvoices = useMemo(() => invoiceFilter === 'all' ? invoices : invoices.filter(invoice => invoice.status === invoiceFilter), [invoices, invoiceFilter]);
  const outstandingRatio = summary && summary.inrBilledPaise > 0 ? Math.min(100, (summary.inrOutstandingPaise / summary.inrBilledPaise) * 100) : 0;

  const calcBillableIps = Math.max(0, calcActiveVms - calcIncludedIps);
  const calcTotalIpCost = calcBillableIps * calcIpCost;
  const calcTotalCost = calcServerCost + calcTotalIpCost;
  const calcMonthlyRevenue = calcActiveVms * calcAvgPrice;
  const calcGrossProfit = calcMonthlyRevenue - calcTotalCost;
  const calcMargin = calcMonthlyRevenue > 0 ? ((calcGrossProfit / calcMonthlyRevenue) * 100) : 0;
  const calcNetPerVm = calcAvgPrice - calcIpCost;
  const calcBreakEven = calcNetPerVm > 0
    ? Math.max(1, Math.ceil((calcServerCost - (calcIncludedIps * calcIpCost)) / calcNetPerVm))
    : (calcAvgPrice > 0 ? Math.ceil(calcServerCost / calcAvgPrice) : 0);
  const calcMaxRevenue = calcVmCapacity * calcAvgPrice;
  const calcMaxBillableIps = Math.max(0, calcVmCapacity - calcIncludedIps);
  const calcMaxCost = calcServerCost + (calcMaxBillableIps * calcIpCost);
  const calcMaxProfit = calcMaxRevenue - calcMaxCost;

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving('plan');
    setError(null);
    try {
      await apiClient.upsertBillingPlan({
        id: planForm.id || undefined,
        name: planForm.name,
        currency: planForm.currency,
        monthlyPriceCents: amountToMinorUnits(planForm.monthlyPriceCents),
        vcpuLimit: Number(planForm.vcpuLimit),
        ramGb: Number(planForm.ramGb),
        diskGb: Number(planForm.diskGb),
        bandwidthGb: planForm.bandwidthGb === '' ? null : Number(planForm.bandwidthGb),
        isActive: planForm.isActive,
        sortOrder: Number(planForm.sortOrder),
      });
      setPlanForm(emptyPlan);
      setNotice('Pricing catalog updated.');
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || 'Unable to save pricing plan.');
    } finally {
      setSaving(null);
    }
  };

  const saveCost = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving('cost');
    setError(null);
    try {
      await apiClient.upsertBillingCostBase({ ...costForm, monthlyCostCents: amountToMinorUnits(costForm.monthlyCostCents) });
      setCostForm(emptyCost);
      setNotice('Cost basis updated.');
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || 'Unable to save cost basis.');
    } finally {
      setSaving(null);
    }
  };

  const saveServerCost = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving('server-cost');
    setError(null);
    try {
      await apiClient.upsertBillingServerCost({
        id: serverCostForm.id || undefined,
        name: serverCostForm.name,
        nodeName: serverCostForm.nodeName || null,
        proxmoxConnectionId: serverCostForm.proxmoxConnectionId,
        monthlyCostPaise: rupeesToPaise(serverCostForm.monthlyCostPaise),
        ipCostPaise: rupeesToPaise(serverCostForm.ipCostPaise),
        plannedVmCapacity: Number(serverCostForm.plannedVmCapacity),
        includedIpCount: Number(serverCostForm.includedIpCount),
        isActive: serverCostForm.isActive,
      });
      setServerCostForm(emptyServerCost);
      setNotice('Dedicated-server cost profile updated.');
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || 'Unable to save dedicated-server cost.');
    } finally {
      setSaving(null);
    }
  };

  const deleteServerCost = async (server: ApiBillingServerCost) => {
    const confirmed = window.confirm(`Delete the cost profile “${server.name}” for ${server.connectionName || 'the unassigned legacy profile'}? This removes only the profitability configuration; VMs, invoices, payments, and Proxmox resources are not deleted.`);
    if (!confirmed) return;
    setSaving(`delete-server-cost:${server.id}`);
    setError(null);
    try {
      await apiClient.deleteBillingServerCost(server.id);
      setServerCostForm(emptyServerCost);
      setNotice(`Cost profile deleted for ${server.connectionName || 'the legacy profile'}.`);
      await load();
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Unable to delete dedicated-server cost.');
    } finally {
      setSaving(null);
    }
  };

  const updateConfig = async (patch: Partial<ApiBillingConfig>) => {
    if (!config) return;
    let confirmation: string | undefined;
    if (patch.suspensionExecutionEnabled === true && !config.suspensionExecutionEnabled) {
      confirmation = window.prompt('This can suspend overdue VMs without deleting them. Type ENABLE_REVERSIBLE_SUSPENSION_AUTOMATION to continue.') || undefined;
      if (confirmation !== 'ENABLE_REVERSIBLE_SUSPENSION_AUTOMATION') {
        setNotice('Automatic suspension remains disabled.');
        return;
      }
    }
    setSaving('config');
    setError(null);
    try {
      const next = await apiClient.updateBillingConfig({ ...patch, confirmation });
      setConfig(next);
      setNotice('Billing policy saved.');
    } catch (saveError: any) {
      setError(saveError?.message || 'Unable to save billing policy.');
    } finally {
      setSaving(null);
    }
  };

  const recordPayment = async (invoice: ApiBillingInvoice) => {
    const amount = window.prompt(`Record payment for ${invoice.id}. Enter amount in cents (outstanding: ${invoice.outstandingCents}).`);
    if (!amount) return;
    setSaving(`payment:${invoice.id}`);
    try {
      await apiClient.recordBillingPayment(invoice.id, Number(amount), 'Recorded from billing operations');
      setNotice(`Payment recorded for ${invoice.id}.`);
      await load();
    } catch (paymentError: any) {
      setError(paymentError?.message || 'Unable to record payment.');
    } finally {
      setSaving(null);
    }
  };

  const saveVmProfile = async (profile: ApiVmBillingProfile, planId: string, customPrice: string, ipCount: string) => {
    const saveKey = `vm:${profile.proxmoxConnectionId || ''}:${profile.vmid}`;
    setSaving(saveKey);
    try {
      await apiClient.updateVmBillingProfile(profile.vmid, {
        planId: planId || undefined,
        customMonthlyPriceCents: customPrice === '' ? null : rupeesToPaise(customPrice),
        ipCount: Number(ipCount),
        billingStatus: profile.billingStatus,
        billingCycleDay: profile.billingCycleDay,
        gracePeriodDays: profile.gracePeriodDays,
        proxmoxConnectionId: profile.proxmoxConnectionId,
      }, profile.proxmoxConnectionId);
      setNotice(`Billing profile saved for VM-${profile.vmid}${profile.connectionName ? ` (${profile.connectionName})` : ''}.`);
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || 'Unable to save VM billing profile.');
    } finally {
      setSaving(null);
    }
  };

  const reverseAction = async (action: ApiBillingSuspensionAction) => {
    const confirmation = window.prompt(`Paid-service recovery for VM-${action.vmid} will be attempted only after the linked invoice is fully paid. Type RESTORE_PAID_SERVICE to continue.`) || '';
    if (confirmation !== 'RESTORE_PAID_SERVICE') {
      setNotice('Recovery was not initiated.');
      return;
    }
    setSaving(`recovery:${action.id}`);
    setError(null);
    try {
      await apiClient.reverseBillingSuspension(action.id);
      setNotice(`Paid service recovery completed for VM-${action.vmid}.`);
      await load();
    } catch (recoveryError: any) {
      setError(recoveryError?.message || 'Unable to restore paid service.');
    } finally {
      setSaving(null);
    }
  };

  const fieldClass = 'w-full rounded-md border border-[#dedfdf] bg-white px-3 py-2 text-sm text-[#1a1a1a] outline-none transition-colors placeholder:text-[#a0a1a2] focus:border-[#1a1a1a] focus:ring-2 focus:ring-[#2563eb]/20';
  const cardClass = 'ink-block-wrapper !mb-0';
  const statusClass = (status: string) => status === 'paid' ? 'text-[#176b52] bg-[#eef9f4] border-[#b8e3cf]' : status === 'overdue' ? 'text-[#8d3028] bg-[#fff1ef] border-[#f0c0bb]' : status === 'partially_paid' ? 'text-[#8b5e00] bg-[#fff8e8] border-[#f3d19a]' : 'text-[#656b6b] bg-[#f4f5f5] border-[#dedfdf]';
  const actionStatusClass = (status: string) => status === 'executed' ? 'text-[#8d3028] bg-[#fff1ef] border-[#f0c0bb]' : status === 'reversed' ? 'text-[#176b52] bg-[#eef9f4] border-[#b8e3cf]' : status === 'failed' ? 'text-[#8b5e00] bg-[#fff8e8] border-[#f3d19a]' : 'text-[#656b6b] bg-[#f4f5f5] border-[#dedfdf]';
  const profitabilityStatusClass = (status: string) => status === 'profitable' ? 'text-[#176b52] bg-[#eef9f4] border-[#b8e3cf]' : status === 'loss' ? 'text-[#8d3028] bg-[#fff1ef] border-[#f0c0bb]' : status === 'configure_costs' ? 'text-[#8b5e00] bg-[#fff8e8] border-[#f3d19a]' : 'text-[#656b6b] bg-[#f4f5f5] border-[#dedfdf]';

  return (
    <main className="app-content billing-operations-panel min-h-full px-4 py-5 sm:px-6 lg:px-8" aria-busy={loading}>
      <div className="mx-auto w-full">
        <header className="ink-block-wrapper !mb-6 flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b5e00]">Finance operations</p>
            <h1 className="page-heading !mb-1 font-serif font-medium tracking-[-0.03em]">Billing control plane</h1>
            <p className="ink-description-text !mt-0 max-w-3xl">A single operating view for revenue collection, infrastructure cost allocation, dedicated-server economics, and controlled lifecycle policy.</p>
          </div>
          <FinanceOperationsVisual summary={summary} loading={loading} />
        </header>

        {error && <div role="alert" className="mb-5 rounded-lg border border-[#e4b5b0] bg-[#fff7f6] px-4 py-3 text-sm text-[#8d3028] shadow-sm">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-lg border border-[#b8e3cf] bg-[#eef9f4] px-4 py-3 text-sm text-[#176b52] shadow-sm">{notice}<button type="button" onClick={() => setNotice(null)} className="ml-3 font-semibold underline underline-offset-2">Dismiss</button></div>}
        {serverCosts.some(server => server.legacyNeedsAssignment) && <div role="alert" className="mb-5 rounded-lg border border-[#ead9a7] bg-[#fffaf0] px-4 py-3 text-sm text-[#6f5200] shadow-sm"><span className="font-semibold">Action required:</span> {serverCosts.filter(server => server.legacyNeedsAssignment).length} legacy cost profile{serverCosts.filter(server => server.legacyNeedsAssignment).length === 1 ? ' is' : 's are'} not assigned to a Proxmox connection. They are preserved but excluded from attributed profitability until explicitly mapped.</div>}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" aria-label="Billing KPIs">
          {[
            { label: 'Billed revenue', value: summary ? moneyPaise(summary.inrBilledPaise) : '—', icon: 'revenue', tone: 'text-[#8b5e00] bg-[#fff8e8]' },
            { label: 'Collected', value: summary ? moneyPaise(summary.inrCollectedPaise) : '—', icon: 'collected', tone: 'text-[#176b52] bg-[#eef9f4]' },
            { label: 'Outstanding', value: summary ? moneyPaise(summary.inrOutstandingPaise) : '—', icon: 'outstanding', tone: 'text-[#8b5e00] bg-[#fff8e8]' },
            { label: 'Monthly cost', value: summary ? moneyPaise(summary.totalInrCostPaise) : '—', icon: 'cost', tone: 'text-[#656b6b] bg-[#f4f5f5]' },
            { label: 'Projected gross profit', value: summary ? moneyPaise(summary.projectedInrGrossProfitPaise) : '—', icon: 'profit', tone: summary && summary.projectedInrGrossProfitPaise < 0 ? 'text-[#8d3028] bg-[#fff1ef]' : 'text-[#176b52] bg-[#eef9f4]' },
            { label: 'Projected margin', value: summary?.projectedInrMarginPercent === null ? '—' : summary ? `${summary.projectedInrMarginPercent.toFixed(1)}%` : '—', icon: 'margin', tone: summary && summary.projectedInrMarginPercent !== null && summary.projectedInrMarginPercent < 0 ? 'text-[#8d3028] bg-[#fff1ef]' : 'text-[#176b52] bg-[#eef9f4]' },
          ].map(({ label, value, icon: iconKind, tone }) => <div key={label} className="tile-white !mb-0 !min-h-[118px] !flex-col !items-start !justify-start !gap-3 !p-5"><div className={`flex h-8 w-8 items-center justify-center rounded-md ${tone}`}><BillingKpiIcon kind={iconKind as BillingKpiIconKind} /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8a9090]">{label}</p><p className={`mt-2 text-xl font-semibold tabular-nums ${label === 'Projected gross profit' && summary && summary.projectedInrGrossProfitPaise < 0 ? 'text-[#8d3028]' : 'text-[#1a1a1a]'}`}>{value}</p></div></div>)}
        </section>

        {summary && <section className="mb-6 grid gap-6 xl:grid-cols-2" aria-label="Unit economics"><div className={`${cardClass} p-5`}><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-[#1a1a1a]">Unit economics</h2><p className="mt-1 text-xs leading-5 text-[#656b6b]">Revenue less actual configured costs. This is an operational estimate, not an accounting or tax statement.</p></div></div><div className="space-y-3 text-xs"><div className="flex items-center justify-between"><span className="text-[#656b6b]">Shared operating costs</span><span className="font-mono font-semibold text-[#1a1a1a]">{moneyPaise(summary.monthlySharedCostPaise)}</span></div><div className="flex items-center justify-between"><span className="text-[#656b6b]">Dedicated-server base cost</span><span className="font-mono font-semibold text-[#1a1a1a]">{moneyPaise(summary.monthlyServerCostPaise)}</span></div><div className="flex items-center justify-between"><span className="text-[#656b6b]">Additional IP charges</span><span className="font-mono font-semibold text-[#1a1a1a]">{moneyPaise(summary.monthlyIpCostPaise)}</span></div><div className="flex items-center justify-between border-t border-[#ededed] pt-3"><span className="font-semibold text-[#1a1a1a]">Total monthly cost</span><span className="font-mono font-semibold text-[#1a1a1a]">{moneyPaise(summary.totalInrCostPaise)}</span></div><div className="border-t border-[#ededed] pt-3"><div className="flex items-center justify-between"><span className="font-semibold text-[#1a1a1a]">Active assignment revenue</span><span className="font-mono text-right font-semibold text-[#1a1a1a]">{projectedRevenueLabel(summary.projectedRevenueByCurrency) || '—'}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-[#656b6b]">Projected gross profit</span><span className={`font-mono font-semibold ${summary.projectedInrGrossProfitPaise < 0 ? 'text-[#8d3028]' : 'text-[#176b52]'}`}>{moneyPaise(summary.projectedInrGrossProfitPaise)}</span></div><p className="mt-2 text-[11px] leading-5 text-[#8a9090]">Projected profit includes active VM assignments. The billed-profit card uses issued invoices; other currencies are shown without an implicit exchange-rate conversion.</p></div></div></div><div className={`${cardClass} p-5`}><div className="mb-4"><h2 className="text-sm font-semibold text-[#1a1a1a]">Capacity & IP utilization</h2><p className="mt-1 text-xs leading-5 text-[#656b6b]">Running VM count includes assigned and unassigned guests. Use these figures to see live capacity and paid IP exposure on each dedicated server.</p></div><div className="grid grid-cols-2 gap-4 text-xs"><div><p className="text-[#656b6b]">Running VMs</p><p className="mt-1 text-lg font-semibold tabular-nums text-[#1a1a1a]">{summary.totalRunningServerVms} <span className="text-xs font-normal text-[#8a9090]">/ {summary.totalServerCapacityVms || '—'}</span></p></div><div><p className="text-[#656b6b]">Available VM capacity</p><p className="mt-1 text-lg font-semibold tabular-nums text-[#1a1a1a]">{summary.availableServerCapacityVms}</p></div><div><p className="text-[#656b6b]">Running IPs</p><p className="mt-1 text-lg font-semibold tabular-nums text-[#1a1a1a]">{summary.totalRunningIpCount}</p></div><div><p className="text-[#656b6b]">Billable running IPs</p><p className="mt-1 text-lg font-semibold tabular-nums text-[#1a1a1a]">{summary.billableRunningIpCount}</p></div></div>{summary.revenueByCurrency.length > 0 && <div className="mt-5 border-t border-[#ededed] pt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a9090]">Revenue by currency</p><div className="space-y-2">{summary.revenueByCurrency.map(item => <div key={item.currency} className="flex items-center justify-between text-xs"><span className="font-semibold text-[#656b6b]">{item.currency} · {item.invoiceCount} invoices</span><span className="font-mono font-semibold text-[#1a1a1a]">{money(item.billedCents, item.currency)} billed</span></div>)}</div></div>}</div></section>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
          <section className={`${cardClass} overflow-hidden`}>
            <div className="flex items-start justify-between gap-4 border-b border-[#dedfdf] px-5 py-4"><div><h2 className="text-sm font-semibold text-[#1a1a1a]">Revenue collection</h2><p className="mt-1 text-xs text-[#656b6b]">Invoice-level collection state and reversible service controls.</p></div><span className="text-xs font-mono text-[#656b6b]">{summary?.invoiceCount || 0} invoices</span></div>
            <div className="flex flex-wrap items-center gap-2 border-b border-[#ededed] px-5 py-3"><span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a9090]">Filter</span>{['all', 'open', 'overdue', 'partially_paid', 'paid'].map(status => <button key={status} type="button" onClick={() => setInvoiceFilter(status)} className={`rounded border px-2.5 py-1 text-[11px] font-semibold ${invoiceFilter === status ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white' : 'border-[#dedfdf] text-[#656b6b] hover:bg-[#f4f5f5]'}`}>{status.replace('_', ' ')}</button>)}</div>
            <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left"><thead className="bg-[#fbfaf9] text-[10px] uppercase tracking-[0.12em] text-[#8a9090]"><tr><th className="px-5 py-3 font-semibold">Invoice</th><th className="px-3 py-3 font-semibold">Account / VM</th><th className="px-3 py-3 font-semibold">Due</th><th className="px-3 py-3 font-semibold">Balance</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-[#ededed]">{filteredInvoices.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[#8a9090]">No invoices match this filter.</td></tr> : filteredInvoices.map(invoice => <tr key={invoice.id} className="text-xs text-[#1a1a1a]"><td className="px-5 py-3"><span className="font-mono font-semibold">{invoice.id}</span><span className="mt-1 block text-[10px] text-[#8a9090]">{invoice.planName || 'Custom pricing'}</span></td><td className="px-3 py-3"><span className="font-semibold">{invoice.accountEmail}</span><span className="mt-1 block text-[10px] text-[#8a9090]">VM-{invoice.vmid} · {invoice.vmName || 'Unnamed guest'}</span></td><td className="px-3 py-3 whitespace-nowrap">{dateLabel(invoice.dueAt)}</td><td className="px-3 py-3 whitespace-nowrap font-mono">{money(invoice.outstandingCents, invoice.currency)}</td><td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase ${statusClass(invoice.status)}`}>{invoice.status.replace('_', ' ')}</span></td><td className="px-5 py-3 text-right">{invoice.outstandingCents > 0 && <button type="button" onClick={() => void recordPayment(invoice)} disabled={saving !== null} className="rounded border border-[#1a1a1a] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[#f4f5f5] disabled:opacity-50">Record payment</button>}</td></tr>)}</tbody></table></div>
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-[#1a1a1a]">Billing policy</h2><p className="mt-1 text-xs leading-5 text-[#656b6b]">Automation is fail-closed. Enabling suspension requires a separate explicit confirmation.</p></div><span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase ${config?.automationEnabled ? 'border-[#b8e3cf] bg-[#eef9f4] text-[#176b52]' : 'border-[#dedfdf] bg-[#f4f5f5] text-[#656b6b]'}`}>{config?.automationEnabled ? 'active' : 'dry run'}</span></div>
            {config && <div className="space-y-4"><label className="flex items-center justify-between gap-3 text-xs font-semibold text-[#1a1a1a]"><span>Billing lifecycle automation</span><input type="checkbox" checked={config.automationEnabled} onChange={event => void updateConfig({ automationEnabled: event.target.checked })} /></label><label className="flex items-center justify-between gap-3 text-xs font-semibold text-[#1a1a1a]"><span>Reminder emails</span><input type="checkbox" checked={config.reminderEmailsEnabled} onChange={event => void updateConfig({ reminderEmailsEnabled: event.target.checked })} /></label><label className="flex items-center justify-between gap-3 text-xs font-semibold text-[#1a1a1a]"><span>Automatic reversible suspension</span><input type="checkbox" checked={config.suspensionExecutionEnabled} onChange={event => void updateConfig({ suspensionExecutionEnabled: event.target.checked })} /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-[#1a1a1a]">Reminder lead days<input className={`${fieldClass} mt-1`} type="number" min="0" max="365" value={config.daysBeforeDue} onChange={event => setConfig({ ...config, daysBeforeDue: Number(event.target.value) })} /></label><label className="text-xs font-semibold text-[#1a1a1a]">Grace period days<input className={`${fieldClass} mt-1`} type="number" min="0" max="365" value={config.gracePeriodDays} onChange={event => setConfig({ ...config, gracePeriodDays: Number(event.target.value) })} /></label><label className="text-xs font-semibold text-[#1a1a1a]">Suspend after overdue<input className={`${fieldClass} mt-1`} type="number" min="0" max="365" value={config.suspendAfterDaysOverdue} onChange={event => setConfig({ ...config, suspendAfterDaysOverdue: Number(event.target.value) })} /></label><label className="text-xs font-semibold text-[#1a1a1a]">Tax rate %<input className={`${fieldClass} mt-1`} type="number" min="0" max="100" step="0.01" value={config.taxRatePercent} onChange={event => setConfig({ ...config, taxRatePercent: Number(event.target.value) })} /></label><label className="text-xs font-semibold text-[#1a1a1a]">Default billing currency<select className={`${fieldClass} mt-1`} value={config.currency} onChange={event => setConfig({ ...config, currency: event.target.value as BillingCurrency })}>{billingCurrencyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><button type="button" onClick={() => void updateConfig(config)} disabled={saving !== null} className="h-9 w-full rounded bg-[#1a1a1a] px-4 text-xs font-semibold text-white hover:bg-[#333] disabled:opacity-50">{saving === 'config' ? 'Saving…' : 'Save policy'}</button><div className="border-t border-[#ededed] pt-3 text-[11px] leading-5 text-[#656b6b]">Suspension preserves the VM and its disks. It should be enabled only after payment status, reminder delivery, recovery, and legal/commercial policy are reviewed.</div></div>}
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className={`${cardClass} overflow-hidden`}><div className="border-b border-[#dedfdf] px-5 py-4"><h2 className="text-sm font-semibold text-[#1a1a1a]">Pricing catalog</h2><p className="mt-1 text-xs text-[#656b6b]">Publish resource-based plans in the selected currency; values are stored precisely in minor units.</p></div><form onSubmit={savePlan} className="grid gap-3 border-b border-[#ededed] bg-[#fbfaf9] p-5 sm:grid-cols-2"><input className={fieldClass} placeholder="Plan name" value={planForm.name} onChange={event => setPlanForm({ ...planForm, name: event.target.value })} required /><select className={fieldClass} value={planForm.currency} onChange={event => setPlanForm({ ...planForm, currency: event.target.value as BillingCurrency })} aria-label="Plan currency">{billingCurrencyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input className={fieldClass} type="number" min="0" placeholder="Monthly price" aria-label={`Monthly price in ${planForm.currency}`} value={planForm.monthlyPriceCents} onChange={event => setPlanForm({ ...planForm, monthlyPriceCents: event.target.value })} required /><input className={fieldClass} type="number" min="1" placeholder="vCPU limit" value={planForm.vcpuLimit} onChange={event => setPlanForm({ ...planForm, vcpuLimit: event.target.value })} required /><input className={fieldClass} type="number" min="0.1" step="0.1" placeholder="RAM GB" value={planForm.ramGb} onChange={event => setPlanForm({ ...planForm, ramGb: event.target.value })} required /><input className={fieldClass} type="number" min="0.1" step="0.1" placeholder="Disk GB" value={planForm.diskGb} onChange={event => setPlanForm({ ...planForm, diskGb: event.target.value })} required /><input className={fieldClass} type="number" min="0" placeholder="Bandwidth GB (optional)" value={planForm.bandwidthGb} onChange={event => setPlanForm({ ...planForm, bandwidthGb: event.target.value })} /><button type="submit" disabled={saving !== null} className="h-9 rounded bg-[#1a1a1a] px-4 text-xs font-semibold text-white hover:bg-[#333] disabled:opacity-50 sm:col-span-2">{saving === 'plan' ? 'Saving…' : planForm.id ? 'Update plan' : 'Add plan'}</button></form><div className="divide-y divide-[#ededed]">{plans.map(plan => <div key={plan.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[#1a1a1a]">{plan.name} <span className="ml-1 text-[10px] font-mono text-[#8a9090]">{plan.id}</span></p><p className="mt-1 text-xs text-[#656b6b]">{money(plan.monthlyPriceCents, plan.currency)} / month · {plan.vcpuLimit} vCPU · {plan.ramGb} GB RAM · {plan.diskGb} GB disk</p></div><div className="flex gap-2"><button type="button" onClick={() => setPlanForm({ id: plan.id, name: plan.name, currency: plan.currency, monthlyPriceCents: minorUnitsToAmountInput(plan.monthlyPriceCents), vcpuLimit: String(plan.vcpuLimit), ramGb: String(plan.ramGb), diskGb: String(plan.diskGb), bandwidthGb: plan.bandwidthGb === null ? '' : String(plan.bandwidthGb), isActive: plan.isActive, sortOrder: String(plan.sortOrder) })} className="rounded border border-[#dedfdf] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[#f4f5f5]">Edit</button><button type="button" onClick={() => void apiClient.toggleBillingPlan(plan.id, !plan.isActive).then(() => load()).catch(saveError => setError(saveError.message))} className="rounded border border-[#dedfdf] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[#f4f5f5]">{plan.isActive ? 'Disable' : 'Enable'}</button></div></div>)}</div></section>

          <section className={`${cardClass} overflow-hidden`}><div className="border-b border-[#dedfdf] px-5 py-4"><h2 className="text-sm font-semibold text-[#1a1a1a]">Cost basis & profitability</h2><p className="mt-1 text-xs text-[#656b6b]">Enter actual monthly infrastructure and operating costs to turn revenue into an estimate—not a financial statement.</p></div><form onSubmit={saveCost} className="grid gap-3 border-b border-[#ededed] bg-[#fbfaf9] p-5 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"><input className={fieldClass} placeholder="Cost name" value={costForm.name} onChange={event => setCostForm({ ...costForm, name: event.target.value })} required /><input className={fieldClass} type="number" min="0" placeholder="Monthly cost" value={costForm.monthlyCostCents} onChange={event => setCostForm({ ...costForm, monthlyCostCents: event.target.value })} required /><select className={fieldClass} value={costForm.currency} onChange={event => setCostForm({ ...costForm, currency: event.target.value as BillingCurrency })} aria-label="Cost currency">{billingCurrencyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select className={fieldClass} value={costForm.allocationMethod} onChange={event => setCostForm({ ...costForm, allocationMethod: event.target.value })} aria-label="Cost allocation method"><option value="fixed">Fixed overhead</option><option value="per_vm">Per VM</option><option value="per_vcpu">Per vCPU</option><option value="per_gb_ram">Per GB RAM</option><option value="per_gb_disk">Per GB disk</option></select><button type="submit" disabled={saving !== null} className="h-9 rounded bg-[#1a1a1a] px-4 text-xs font-semibold text-white hover:bg-[#333] disabled:opacity-50">{saving === 'cost' ? 'Saving…' : costForm.id ? 'Update cost' : 'Add cost'}</button></form><div className="divide-y divide-[#ededed]">{costBases.length === 0 ? <div className="px-5 py-10 text-center text-sm text-[#8a9090]">No cost bases configured. Add infrastructure, licensing, support, or payment costs to improve profitability estimates.</div> : costBases.map(cost => <div key={cost.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[#1a1a1a]">{cost.name}</p><p className="mt-1 text-xs text-[#656b6b]">{money(cost.monthlyCostCents, cost.currency)} / month · {cost.allocationMethod.replace('_', ' ')} · {cost.currency}</p></div><div className="flex items-center gap-2"><span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase ${cost.isActive ? 'border-[#b8e3cf] bg-[#eef9f4] text-[#176b52]' : 'border-[#dedfdf] text-[#8a9090]'}`}>{cost.isActive ? 'active' : 'inactive'}</span><button type="button" onClick={() => setCostForm({ id: cost.id, name: cost.name, monthlyCostCents: minorUnitsToAmountInput(cost.monthlyCostCents), allocationMethod: cost.allocationMethod, currency: cost.currency, isActive: cost.isActive })} className="rounded border border-[#dedfdf] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[#f4f5f5]">Edit</button></div></div>)}</div><div className="px-5 py-4"><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-[#656b6b]">Outstanding as % of billed</span><span className="font-mono font-semibold text-[#1a1a1a]">{outstandingRatio.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded bg-[#ededed]"><div className="h-full rounded bg-[#8b5e00]" style={{ width: `${outstandingRatio}%` }} /></div></div></section>
        </div>

        {/* INTERACTIVE BREAK-EVEN & PROFIT CALCULATOR */}
        <section className={`${cardClass} mt-6 overflow-hidden`}>
          <div className="border-b border-[#dedfdf] px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#eef9f4] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#176b52]">
                    Interactive Tool
                  </span>
                  <h2 className="text-sm font-semibold text-[#1a1a1a]">Dedicated-Server Break-Even & Profit Calculator</h2>
                </div>
                <p className="mt-1 text-xs text-[#656b6b]">
                  Simulate guest VM pricing, infrastructure break-even count, and operating margins with live Proxmox nodes or custom parameters.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#656b6b]">Server Preset:</span>
                <select
                  className="rounded border border-[#dedfdf] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1a1a1a]"
                  value={calcConnId}
                  onChange={e => handleSelectCalcConnection(e.target.value)}
                >
                  <option value="custom">Custom Server Model</option>
                  {connections.map(conn => {
                    const row = serverProfitability.find(p => p.proxmoxConnectionId === conn.id);
                    return (
                      <option key={conn.id} value={conn.id}>
                        {conn.name} {row ? `(${row.runningVmCount} running VMs)` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-12">
            {/* Input Controls */}
            <div className="space-y-4 lg:col-span-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1a1a1a]">
                    Server Monthly Cost (₹)
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className={`${fieldClass} mt-1 font-mono`}
                      value={calcServerCost}
                      onChange={e => setCalcServerCost(Math.max(0, Number(e.target.value)))}
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1a1a1a]">
                    Planned VM Capacity
                    <input
                      type="number"
                      min="1"
                      max="256"
                      className={`${fieldClass} mt-1 font-mono`}
                      value={calcVmCapacity}
                      onChange={e => setCalcVmCapacity(Math.max(1, Number(e.target.value)))}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1a1a1a]">
                    Avg Price / VM (₹/mo)
                    <input
                      type="number"
                      min="0"
                      step="50"
                      className={`${fieldClass} mt-1 font-mono`}
                      value={calcAvgPrice}
                      onChange={e => setCalcAvgPrice(Math.max(0, Number(e.target.value)))}
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1a1a1a]">
                    IP Cost / IP (₹/mo)
                    <input
                      type="number"
                      min="0"
                      step="10"
                      className={`${fieldClass} mt-1 font-mono`}
                      value={calcIpCost}
                      onChange={e => setCalcIpCost(Math.max(0, Number(e.target.value)))}
                    />
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-[#1a1a1a] mb-1">
                  <span>Simulated Active Guests: <strong className="font-mono text-[#2563eb]">{calcActiveVms} VMs</strong></span>
                  <span className="text-[#8a9090] font-normal">{Math.round((calcActiveVms / (calcVmCapacity || 1)) * 100)}% density</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={calcVmCapacity}
                  value={calcActiveVms}
                  onChange={e => setCalcActiveVms(Number(e.target.value))}
                  className="w-full accent-[#2563eb] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#8a9090] mt-1 font-mono">
                  <span>0 VMs</span>
                  <span className="text-[#8b5e00] font-semibold">Break-even: {calcBreakEven} VMs</span>
                  <span>Max: {calcVmCapacity} VMs</span>
                </div>
              </div>
            </div>

            {/* Live Metrics Output */}
            <div className="flex flex-col justify-between rounded-xl bg-[#fbfaf9] p-4 border border-[#ededed] lg:col-span-6">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg bg-white p-3 border border-[#ededed]">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8a9090]">Break-Even Target</span>
                  <p className="mt-1 text-xl font-bold font-mono text-[#1a1a1a]">
                    {calcBreakEven} <span className="text-xs font-normal text-[#656b6b]">VMs</span>
                  </p>
                  <span className="text-[10px] text-[#656b6b]">
                    {calcActiveVms >= calcBreakEven ? `✓ Covered (+${calcActiveVms - calcBreakEven} profit VMs)` : `⚠ Needs ${calcBreakEven - calcActiveVms} more VMs`}
                  </span>
                </div>

                <div className="rounded-lg bg-white p-3 border border-[#ededed]">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8a9090]">Monthly Revenue</span>
                  <p className="mt-1 text-xl font-bold font-mono text-[#1a1a1a]">
                    ₹{calcMonthlyRevenue.toLocaleString('en-IN')}
                  </p>
                  <span className="text-[10px] text-[#656b6b]">{calcActiveVms} paying customer{calcActiveVms === 1 ? '' : 's'}</span>
                </div>

                <div className="rounded-lg bg-white p-3 border border-[#ededed]">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8a9090]">Total Host Cost</span>
                  <p className="mt-1 text-xl font-bold font-mono text-[#1a1a1a]">
                    ₹{calcTotalCost.toLocaleString('en-IN')}
                  </p>
                  <span className="text-[10px] text-[#656b6b]">Server ₹{calcServerCost} + IPs ₹{calcTotalIpCost}</span>
                </div>

                <div className={`rounded-lg p-3 border ${calcGrossProfit >= 0 ? 'bg-[#eef9f4] border-[#b8e3cf]' : 'bg-[#fff1ef] border-[#e4b5b0]'}`}>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8a9090]">Projected Net Profit</span>
                  <p className={`mt-1 text-xl font-bold font-mono ${calcGrossProfit >= 0 ? 'text-[#176b52]' : 'text-[#8d3028]'}`}>
                    {calcGrossProfit >= 0 ? '+' : ''}₹{calcGrossProfit.toLocaleString('en-IN')}
                  </p>
                  <span className="text-[10px] font-semibold text-[#656b6b]">
                    {calcMargin.toFixed(1)}% operating margin
                  </span>
                </div>
              </div>

              {/* Progress to Break-Even / Capacity */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#1a1a1a]">Capacity & Breakeven Meter</span>
                  <span className="font-mono text-xs text-[#176b52] font-semibold">
                    Max Potential: +₹{calcMaxProfit.toLocaleString('en-IN')}/mo
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#ededed]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${calcActiveVms >= calcBreakEven ? 'bg-[#16a34a]' : 'bg-[#d97706]'}`}
                    style={{ width: `${Math.min(100, Math.round((calcActiveVms / (calcVmCapacity || 1)) * 100))}%` }}
                  />
                  {calcVmCapacity > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#1a1a1a] z-10"
                      style={{ left: `${Math.min(100, Math.round((calcBreakEven / calcVmCapacity) * 100))}%` }}
                      title={`Break-even point: ${calcBreakEven} VMs`}
                    />
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-[#656b6b]">
                  Black tick marks the break-even threshold ({calcBreakEven} VMs). At 100% capacity ({calcVmCapacity} VMs), potential revenue is ₹{calcMaxRevenue.toLocaleString('en-IN')}/mo.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${cardClass} mt-6 overflow-hidden`}><div className="border-b border-[#dedfdf] px-5 py-4"><div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-[#1a1a1a]">Dedicated-server cost model</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-[#656b6b]">Configure the actual monthly price of each dedicated server and recurring public IP cost. Connection names are the primary attribution identity; the raw Proxmox node is retained only as technical metadata.</p></div></div></div>{identityConflicts.length > 0 && <div className="border-b border-[#ead9a7] bg-[#fffaf0] px-5 py-3 text-xs text-[#6f5200]"><span className="font-semibold">VM identity warning:</span> {identityConflicts.length} duplicate VMID {identityConflicts.length === 1 ? 'is' : 'values are'} present across Proxmox connections. Those incoming records are held out of the VM roster until VM identity is qualified; no records are merged silently.</div>}<form onSubmit={saveServerCost} className="grid gap-4 border-b border-[#ededed] bg-[#fbfaf9] p-5 sm:grid-cols-2 lg:grid-cols-12"><label className="block text-xs font-semibold text-[#1a1a1a] lg:col-span-3">Profile name<span className="mt-1 block text-[11px] font-normal text-[#656b6b]">Internal name for this cost profile</span><input className={`${fieldClass} mt-2`} placeholder="e.g. Primary dedicated host" value={serverCostForm.name} onChange={event => setServerCostForm({ ...serverCostForm, name: event.target.value })} required /></label><label className="block text-xs font-semibold text-[#1a1a1a] lg:col-span-3">Proxmox connection<span className="mt-1 block text-[11px] font-normal text-[#656b6b]">Primary identity for this dedicated server</span><select className={`${fieldClass} mt-2`} value={serverCostForm.proxmoxConnectionId} onChange={event => setServerCostForm({ ...serverCostForm, proxmoxConnectionId: event.target.value })} required><option value="">Select a configured connection</option>{connections.map(connection => <option key={connection.id} value={connection.id}>{connection.name}</option>)}</select></label><label className="block text-xs font-semibold text-[#1a1a1a] lg:col-span-3">Raw node label<span className="mt-1 block text-[11px] font-normal text-[#656b6b]">Optional technical metadata; never used as identity</span><input className={`${fieldClass} mt-2`} placeholder="e.g. Proxmox-VE" value={serverCostForm.nodeName} onChange={event => setServerCostForm({ ...serverCostForm, nodeName: event.target.value })} /></label><label className="block text-xs font-semibold text-[#1a1a1a] lg:col-span-3">Dedicated server cost<span className="mt-1 block text-[11px] font-normal text-[#656b6b]">Actual monthly rental</span><div className="relative mt-2"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[#656b6b]">₹</span><input className={`${fieldClass} pl-7`} type="number" min="0" step="0.01" placeholder="0.00" value={serverCostForm.monthlyCostPaise} onChange={event => setServerCostForm({ ...serverCostForm, monthlyCostPaise: event.target.value })} required aria-label="Dedicated server monthly cost in INR" /></div></label><label className="block text-xs font-semibold text-[#1a1a1a] lg:col-span-3">Additional IP cost<span className="mt-1 block text-[11px] font-normal text-[#656b6b]">Monthly cost for each billable IP</span><div className="relative mt-2"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[#656b6b]">₹</span><input className={`${fieldClass} pl-7`} type="number" min="0" step="0.01" placeholder="0.00" value={serverCostForm.ipCostPaise} onChange={event => setServerCostForm({ ...serverCostForm, ipCostPaise: event.target.value })} required aria-label="Additional public IP monthly cost in INR" /></div></label><label className="block text-xs font-semibold text-[#1a1a1a] lg:col-span-3">Planned VM capacity<span className="mt-1 block text-[11px] font-normal text-[#656b6b]">Maximum customer VMs for this host</span><input className={`${fieldClass} mt-2`} type="number" min="0" placeholder="e.g. 20" value={serverCostForm.plannedVmCapacity} onChange={event => setServerCostForm({ ...serverCostForm, plannedVmCapacity: event.target.value })} /></label><label className="block text-xs font-semibold text-[#1a1a1a] lg:col-span-3">Included IPs<span className="mt-1 block text-[11px] font-normal text-[#656b6b]">IPs included in the server contract</span><input className={`${fieldClass} mt-2`} type="number" min="0" placeholder="e.g. 1" value={serverCostForm.includedIpCount} onChange={event => setServerCostForm({ ...serverCostForm, includedIpCount: event.target.value })} /></label><button type="submit" disabled={saving !== null} className="btn-primary h-10 lg:col-span-6">{saving === 'server-cost' ? 'Saving…' : serverCostForm.id ? 'Update server cost' : 'Add server cost'}</button></form>{serverCosts.length === 0 ? <div className="px-5 py-10 text-center text-sm text-[#8a9090]">No dedicated-server cost profiles configured. Add one profile for each configured Proxmox connection to calculate infrastructure break-even and profit.</div> : <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left"><thead className="bg-[#fbfaf9] text-[10px] uppercase tracking-[0.12em] text-[#8a9090]"><tr><th className="px-5 py-3 font-semibold">Server / node</th><th className="px-3 py-3 font-semibold">Server cost</th><th className="px-3 py-3 font-semibold">IP economics</th><th className="px-3 py-3 font-semibold">Running VMs</th><th className="px-3 py-3 font-semibold">Utilization</th><th className="px-5 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-[#ededed]">{serverCosts.map(server => <tr key={server.id} className="text-xs text-[#1a1a1a]"><td className="px-5 py-3"><span className="font-semibold">{server.connectionName || 'Legacy profile — assignment required'}</span><span className="mt-1 block text-[10px] text-[#656b6b]">{server.name}</span><span className="mt-1 block font-mono text-[10px] text-[#8a9090]">Raw node: {server.rawNodeName || 'all nodes in connection'}</span>{server.legacyNeedsAssignment && <span className="mt-1 block text-[10px] font-semibold text-[#8b5e00]">Needs connection assignment</span>}</td><td className="px-3 py-3 font-mono">{moneyPaise(server.monthlyCostPaise)}<span className="mt-1 block text-[10px] text-[#8a9090]">monthly base</span></td><td className="px-3 py-3 font-mono">{moneyPaise(server.ipCostPaise)}<span className="mt-1 block text-[10px] text-[#8a9090]">per IP · {server.includedIpCount} included</span></td><td className="px-3 py-3">{server.runningVmCount} <span className="text-[#8a9090]">/ {server.plannedVmCapacity || '—'} VMs</span></td><td className="px-3 py-3">{server.runningIpCount} running IPs<span className="mt-1 block text-[10px] text-[#8a9090]">{Math.max(0, server.runningIpCount - server.includedIpCount)} billable</span></td><td className="px-5 py-3 text-right"><button type="button" onClick={() => setServerCostForm({ id: server.id, name: server.name, nodeName: server.rawNodeName || '', proxmoxConnectionId: server.proxmoxConnectionId || '', monthlyCostPaise: paiseToRupeesInput(server.monthlyCostPaise), ipCostPaise: paiseToRupeesInput(server.ipCostPaise), plannedVmCapacity: String(server.plannedVmCapacity), includedIpCount: String(server.includedIpCount), isActive: server.isActive })} className="rounded border border-[#dedfdf] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[#f4f5f5]">Edit</button><button type="button" onClick={() => void deleteServerCost(server)} disabled={saving !== null} className="rounded border border-[#e4b5b0] px-2.5 py-1.5 text-[11px] font-semibold text-[#8d3028] hover:bg-[#fff7f6] disabled:opacity-50">{saving === `delete-server-cost:${server.id}` ? 'Deleting…' : 'Delete'}</button></td></tr>)}</tbody></table></div>}</section>

        <section className={`${cardClass} mt-6 overflow-hidden`}><div className="border-b border-[#dedfdf] px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-sm font-semibold text-[#1a1a1a]">Dedicated-server profitability</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-[#656b6b]">Compare each configured Proxmox connection independently: INR revenue minus dedicated-server cost, billable IP charges, and its allocated share of INR operating costs. Connection names are primary; raw node labels are supporting metadata.</p></div></div></div>{serverProfitability.length === 0 ? <div className="px-5 py-12 text-center text-sm text-[#8a9090]">No dedicated-server profitability rows are available yet. Sync a configured connection or add a connection-mapped cost profile to begin comparing dedicated servers.</div> : <div className="overflow-x-auto"><table className="min-w-[1280px] w-full text-left"><thead className="bg-[#fbfaf9] text-[10px] uppercase tracking-[0.12em] text-[#8a9090]"><tr><th className="whitespace-nowrap px-5 py-3 font-semibold">Proxmox connection</th><th className="whitespace-nowrap px-3 py-3 font-semibold">Billed revenue</th><th className="whitespace-nowrap px-3 py-3 font-semibold">Monthly cost</th><th className="whitespace-nowrap px-3 py-3 font-semibold">Projected gross profit / loss</th><th className="whitespace-nowrap px-3 py-3 font-semibold">Margin</th><th className="whitespace-nowrap px-3 py-3 font-semibold">Running VMs</th><th className="whitespace-nowrap px-3 py-3 font-semibold">IP exposure</th><th className="whitespace-nowrap px-3 py-3 font-semibold">Status</th><th className="whitespace-nowrap px-5 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-[#ededed]">{serverProfitability.map(server => <tr key={server.serverId} className="text-xs text-[#1a1a1a]"><td className="px-5 py-4"><span className="font-semibold">{server.connectionName || server.serverName}</span><span className="mt-1 block text-[10px] text-[#656b6b]">{server.serverName}</span><span className="mt-1 block font-mono text-[10px] text-[#8a9090]">Raw node: {server.rawNodeName || '—'}</span>{server.legacyNeedsAssignment && <span className="mt-1 block text-[10px] font-semibold text-[#8b5e00]">Legacy profile needs connection assignment</span>}</td><td className="whitespace-nowrap px-3 py-4 font-mono"><span>{moneyPaise(server.billedPaise)}</span><span className="mt-1 block text-[10px] text-[#8a9090]">{server.invoiceCount} invoice{server.invoiceCount === 1 ? '' : 's'}</span>{projectedRevenueLabel(server.projectedRevenueByCurrency) && <span className="mt-1 block max-w-[260px] text-[10px] text-[#176b52]">{projectedRevenueLabel(server.projectedRevenueByCurrency)}</span>}</td><td className="whitespace-nowrap px-3 py-4 font-mono"><span>{moneyPaise(server.totalCostPaise)}</span><span className="mt-1 block text-[10px] text-[#8a9090]">Server {moneyPaise(server.serverCostPaise)} · IP {moneyPaise(server.ipCostPaise)}</span></td><td className={`whitespace-nowrap px-3 py-4 font-mono font-semibold ${(server.projectedRevenuePaise > 0 ? server.projectedGrossProfitPaise : server.grossProfitPaise) < 0 ? 'text-[#8d3028]' : 'text-[#176b52]'}`}>{moneyPaise(server.projectedRevenuePaise > 0 ? server.projectedGrossProfitPaise : server.grossProfitPaise)}<span className="mt-1 block text-[10px] font-normal text-[#8a9090]">Projected · Shared {moneyPaise(server.sharedCostPaise)}</span>{server.projectedRevenuePaise > 0 && <span className={`mt-1 block text-[10px] font-normal ${server.grossProfitPaise < 0 ? 'text-[#8d3028]' : 'text-[#176b52]'}`}>Billed {moneyPaise(server.grossProfitPaise)}</span>}</td><td className="whitespace-nowrap px-3 py-4 font-mono font-semibold">{server.marginPercent === null ? '—' : `${server.marginPercent.toFixed(1)}%`}</td><td className="whitespace-nowrap px-3 py-4"><span className="font-semibold">{server.runningVmCount}</span><span className="text-[#8a9090]"> / {server.plannedVmCapacity || '—'}</span><span className="mt-1 block text-[10px] text-[#8a9090]">{server.availableVmCapacity} available</span></td><td className="whitespace-nowrap px-3 py-4"><span className="font-semibold">{server.billableIpCount} billable</span><span className="mt-1 block text-[10px] text-[#8a9090]">{server.runningIpCount} running · {server.includedIpCount} included</span></td><td className="whitespace-nowrap px-3 py-4"><span className={`inline-flex whitespace-nowrap rounded border px-2 py-1 text-[10px] font-semibold uppercase ${profitabilityStatusClass(server.breakEvenStatus)}`}>{server.breakEvenStatus.replace('_', ' ')}</span>{!server.hasCostProfile && <span className="mt-1 block text-[10px] text-[#8b5e00]">Cost profile needed</span>}</td><td className="whitespace-nowrap px-5 py-4 text-right">{server.hasCostProfile ? <div className="flex justify-end gap-2 whitespace-nowrap"><button type="button" onClick={() => { const profile = serverCosts.find(item => item.id === server.serverId); if (profile) setServerCostForm({ id: profile.id, name: profile.name, nodeName: profile.rawNodeName || '', proxmoxConnectionId: profile.proxmoxConnectionId || '', monthlyCostPaise: paiseToRupeesInput(profile.monthlyCostPaise), ipCostPaise: paiseToRupeesInput(profile.ipCostPaise), plannedVmCapacity: String(profile.plannedVmCapacity), includedIpCount: String(profile.includedIpCount), isActive: profile.isActive }); }} className="rounded border border-[#dedfdf] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[#f4f5f5]">Edit</button><button type="button" onClick={() => { const profile = serverCosts.find(item => item.id === server.serverId); if (profile) void deleteServerCost(profile); }} disabled={saving !== null} className="rounded border border-[#e4b5b0] px-2.5 py-1.5 text-[11px] font-semibold text-[#8d3028] hover:bg-[#fff7f6] disabled:opacity-50">{saving === `delete-server-cost:${server.serverId}` ? 'Deleting…' : 'Delete'}</button></div> : <span className="text-[11px] text-[#8b5e00]">Add cost profile</span>}</td></tr>)}</tbody></table></div>}</section>

        <section className={`${cardClass} mt-6 overflow-hidden`}><div className="border-b border-[#dedfdf] px-5 py-4"><h2 className="text-sm font-semibold text-[#1a1a1a]">Per-system billing assignments</h2><p className="mt-1 text-xs text-[#656b6b]">Assign a published plan or an explicit custom monthly amount to each customer VM. These values drive future invoices.</p></div><div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left"><thead className="bg-[#fbfaf9] text-[10px] uppercase tracking-[0.12em] text-[#8a9090]"><tr><th className="px-5 py-3 font-semibold">System</th><th className="px-3 py-3 font-semibold">Account</th><th className="px-3 py-3 font-semibold">Plan</th><th className="px-3 py-3 font-semibold">IP count</th><th className="px-3 py-3 font-semibold">Custom price (INR)</th><th className="px-3 py-3 font-semibold">Effective price</th><th className="px-5 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-[#ededed]">{profiles.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#8a9090]">No billing profiles yet. Assign a plan to a customer VM to begin invoicing.</td></tr> : profiles.map(profile => <VmBillingRow key={`${profile.proxmoxConnectionId || ''}:${profile.vmid}`} profile={profile} plans={plans} saving={saving} onSave={saveVmProfile} />)}</tbody></table></div></section>

        <section className={`${cardClass} mt-6 overflow-hidden`}><div className="flex items-start justify-between gap-4 border-b border-[#dedfdf] px-5 py-4"><div><h2 className="text-sm font-semibold text-[#1a1a1a]">Suspension action ledger</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#656b6b]">Every policy-generated action is retained here with its reason, linked balance, and recovery state. No actions are generated while suspension execution is disabled.</p></div><span className="text-xs font-mono text-[#656b6b]">{suspensionActions.length} actions</span></div>{suspensionActions.length === 0 ? <div className="px-5 py-10 text-center text-sm text-[#8a9090]">No suspension actions recorded. The current fail-closed policy is preserving service and VM resources.</div> : <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left"><thead className="bg-[#fbfaf9] text-[10px] uppercase tracking-[0.12em] text-[#8a9090]"><tr><th className="px-5 py-3 font-semibold">Action</th><th className="px-3 py-3 font-semibold">System / account</th><th className="px-3 py-3 font-semibold">Outstanding</th><th className="px-3 py-3 font-semibold">Requested</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Recovery</th></tr></thead><tbody className="divide-y divide-[#ededed]">{suspensionActions.map(action => <tr key={action.id} className="text-xs text-[#1a1a1a]"><td className="px-5 py-3"><span className="font-mono font-semibold">{action.id}</span><span className="mt-1 block max-w-[260px] truncate text-[10px] text-[#8a9090]" title={action.reason}>{action.reason || 'Policy action'}</span></td><td className="px-3 py-3"><span className="font-semibold">VM-{action.vmid} · {action.vm_name || 'Unnamed guest'}</span><span className="mt-1 block text-[10px] text-[#8a9090]">{action.account_email || '—'}</span></td><td className="px-3 py-3 font-mono">{money(Math.max(0, Number(action.total_cents || 0) - Number(action.paid_cents || 0)))} </td><td className="px-3 py-3 whitespace-nowrap">{dateLabel(action.requested_at)}</td><td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase ${actionStatusClass(action.status)}`}>{action.status}</span></td><td className="px-5 py-3 text-right">{action.status === 'executed' ? <button type="button" onClick={() => void reverseAction(action)} disabled={saving !== null} className="rounded border border-[#1a1a1a] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[#f4f5f5] disabled:opacity-50">{saving === `recovery:${action.id}` ? 'Recovering…' : 'Recover paid service'}</button> : <span className="text-[11px] text-[#8a9090]">No action</span>}</td></tr>)}</tbody></table></div>}</section>
      </div>
    </main>
  );
};

const VmBillingRow: React.FC<{ profile: ApiVmBillingProfile; plans: ApiPricingPlan[]; saving: string | null; onSave: (profile: ApiVmBillingProfile, planId: string, customPrice: string, ipCount: string) => Promise<void> }> = ({ profile, plans, saving, onSave }) => {
  const [planId, setPlanId] = useState(profile.planId || '');
  const [customPrice, setCustomPrice] = useState(profile.customMonthlyPriceCents === null ? '' : paiseToRupeesInput(profile.customMonthlyPriceCents));
  const [ipCount, setIpCount] = useState(String(profile.ipCount || 1));
  useEffect(() => { setPlanId(profile.planId || ''); setCustomPrice(profile.customMonthlyPriceCents === null ? '' : paiseToRupeesInput(profile.customMonthlyPriceCents)); setIpCount(String(profile.ipCount || 1)); }, [profile.planId, profile.customMonthlyPriceCents, profile.ipCount]);
  const isSaving = saving === `vm:${profile.proxmoxConnectionId || ''}:${profile.vmid}`;
  return (
    <tr className="text-xs text-[#1a1a1a]">
      <td className="px-5 py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold">VM-{profile.vmid} · {profile.vmName || 'Unnamed guest'}</span>
          {profile.connectionName && (
            <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-[10px] font-mono text-[#656b6b]">
              {profile.connectionName}
            </span>
          )}
        </div>
        <span className="mt-1 block text-[10px] text-[#8a9090]">Due {dateLabel(profile.nextDueAt)}</span>
      </td>
      <td className="px-3 py-3 font-medium">{profile.ownerEmail || '—'}</td>
      <td className="px-3 py-3"><select className="rounded border border-[#dedfdf] bg-white px-2 py-1.5 text-xs" value={planId} onChange={event => setPlanId(event.target.value)}><option value="">Custom / none</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></td>
      <td className="px-3 py-3"><input className="w-20 rounded border border-[#dedfdf] px-2 py-1.5 font-mono text-xs" type="number" min="1" max="256" value={ipCount} onChange={event => setIpCount(event.target.value)} aria-label={`IP count for VM-${profile.vmid}`} /></td>
      <td className="px-3 py-3"><input className="w-36 rounded border border-[#dedfdf] px-2 py-1.5 font-mono text-xs" type="number" min="0" step="0.01" placeholder="optional" value={customPrice} onChange={event => setCustomPrice(event.target.value)} aria-label={`Custom monthly price for VM-${profile.vmid}`} /></td>
      <td className="px-3 py-3 font-mono">{money(profile.monthlyPriceCents, profile.currency)}</td>
      <td className="px-5 py-3 text-right"><button type="button" onClick={() => void onSave(profile, planId, customPrice, ipCount)} disabled={saving !== null} className="rounded border border-[#1a1a1a] px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[#f4f5f5] disabled:opacity-50">{isSaving ? 'Saving…' : 'Save'}</button></td>
    </tr>
  );
};
