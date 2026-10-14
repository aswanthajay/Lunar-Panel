import React from 'react';

export interface GamePanelBillingSummary {
    invoiceCount: number;
    gameServerCount: number;
    billedCents: number;
    collectedCents: number;
    outstandingCents: number;
    overdueCount: number;
    monthlyHardwareCostCents: number;
    projectedGrossProfitCents: number;
    projectedMarginPercent: number | null;
    reportingCurrency: string;
}

interface FinanceOperationsVisualProps {
    summary: GamePanelBillingSummary | null;
    loading?: boolean;
}

const formatMoney = (cents: number | undefined, currency = 'USD') =>
    new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format((Number(cents) || 0) / 100);

export const FinanceOperationsVisual: React.FC<FinanceOperationsVisualProps> = ({ summary, loading = false }) => {
    const billed = Number(summary?.billedCents || 0);
    const collected = Number(summary?.collectedCents || 0);
    const collectionRate = billed > 0 ? Math.min(100, Math.max(0, (collected / billed) * 100)) : 0;
    const margin = summary?.projectedMarginPercent ?? null;
    const marginTone = margin === null ? 'neutral' : margin < 20 ? 'negative' : 'positive';
    const marginStatus = margin === null ? 'Awaiting data' : margin < 20 ? 'Review required' : 'Optimal';
    const currency = summary?.reportingCurrency || 'USD';

    return (
        <section
            className={`billing-finance-snapshot ${loading ? 'is-loading' : ''} flex flex-col justify-between p-3.5 rounded-lg border border-[#27272a] bg-[#0d0d0d] text-[#ededed] select-none`}
            style={{ minWidth: 240, height: 130 }}
            aria-label="Game fleet finance operations snapshot"
        >
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#71717a]">
                <span>Fleet operations</span>
                <strong className="text-emerald-400 font-extrabold tracking-widest text-[8px]">LIVE FLEET</strong>
            </div>

            <div className="flex items-end justify-between gap-3 mt-1">
                <div>
                    <span className="text-[10px] text-[#a1a1aa] block">Projected margin</span>
                    <strong
                        className={`text-2xl font-bold tracking-tight block ${
                            marginTone === 'positive' ? 'text-emerald-400' : marginTone === 'negative' ? 'text-red-400' : 'text-[#ededed]'
                        }`}
                    >
                        {margin === null ? '—' : `${margin.toFixed(1)}%`}
                    </strong>
                </div>
                <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        marginTone === 'positive'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                            : marginTone === 'negative'
                            ? 'bg-red-950/40 text-red-400 border-red-500/30'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                    }`}
                >
                    {marginStatus}
                </span>
            </div>

            <div className="mt-2" aria-label={summary ? `${collectionRate.toFixed(0)} percent of billed revenue collected` : 'Collection data loading'}>
                <div className="h-1.5 w-full bg-[#1c1c1f] rounded-full overflow-hidden">
                    <span
                        className="h-full bg-emerald-400 block rounded-full transition-all duration-300"
                        style={{ width: `${loading ? 0 : collectionRate}%` }}
                    />
                </div>
                <div className="flex items-center justify-between text-[10px] mt-1 text-[#71717a]">
                    <span>Collection health</span>
                    <strong className="text-[#ededed] font-mono">{loading ? 'Loading' : `${collectionRate.toFixed(0)}% collected`}</strong>
                </div>
            </div>

            <div className="flex items-center justify-between text-[10px] border-t border-[#1f1f23] pt-1.5 mt-1 text-[#71717a]">
                <div>
                    <span>Outstanding: </span>
                    <strong className="text-[#f4f4f5] font-mono">{loading ? '—' : formatMoney(summary?.outstandingCents, currency)}</strong>
                </div>
                <div>
                    <span>Game servers: </span>
                    <strong className="text-[#f4f4f5] font-mono">{loading ? '—' : summary?.gameServerCount ?? '—'}</strong>
                </div>
            </div>
        </section>
    );
};

export default FinanceOperationsVisual;
