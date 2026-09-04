import React from 'react';
import { ApiBillingSummary } from '../services/apiClient';

interface FinanceOperationsVisualProps {
  summary: ApiBillingSummary | null;
  loading?: boolean;
}

const formatMoney = (paise: number | undefined) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format((Number(paise) || 0) / 100);

export const FinanceOperationsVisual: React.FC<FinanceOperationsVisualProps> = ({ summary, loading = false }) => {
  const billed = Number(summary?.inrBilledPaise || 0);
  const collected = Number(summary?.inrCollectedPaise || 0);
  const collectionRate = billed > 0 ? Math.min(100, Math.max(0, (collected / billed) * 100)) : 0;
  const margin = summary?.projectedInrMarginPercent ?? null;
  const marginTone = margin === null ? 'neutral' : margin < 0 ? 'negative' : 'positive';
  const marginStatus = margin === null ? 'Awaiting data' : margin < 0 ? 'Review required' : 'On track';

  return (
    <section className={`billing-finance-snapshot ${loading ? 'is-loading' : ''}`} aria-label="Finance operations snapshot">
      <div className="billing-snapshot-header">
        <span>Finance operations</span>
        <strong>LIVE SYSTEM</strong>
      </div>

      <div className="billing-snapshot-primary">
        <div>
          <span>Projected margin</span>
          <strong className={`billing-snapshot-margin billing-snapshot-margin-${marginTone}`}>
            {margin === null ? '—' : `${margin.toFixed(1)}%`}
          </strong>
        </div>
        <span className={`billing-snapshot-status billing-snapshot-status-${marginTone}`}>{marginStatus}</span>
      </div>

      <div className="billing-snapshot-meter" aria-label={summary ? `${collectionRate.toFixed(0)} percent of billed revenue collected` : 'Collection data loading'}>
        <div className="billing-snapshot-meter-track"><span style={{ width: `${loading ? 0 : collectionRate}%` }} /></div>
        <div className="billing-snapshot-meter-labels"><span>Collection health</span><strong>{loading ? 'Loading' : `${collectionRate.toFixed(0)}% collected`}</strong></div>
      </div>

      <div className="billing-snapshot-stats">
        <div><span>Outstanding</span><strong>{loading ? '—' : formatMoney(summary?.inrOutstandingPaise)}</strong></div>
        <div><span>Running VMs</span><strong>{loading ? '—' : summary?.totalRunningServerVms ?? '—'}</strong></div>
      </div>
    </section>
  );
};
