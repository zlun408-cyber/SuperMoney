import React, { useEffect } from 'react';
import Link from 'next/link';

import { IntradayStatusBadge } from '@/components/fund/intraday-status-badge';
import { FundIntradaySparkline } from '@/components/watchlist/fund-intraday-sparkline';
import { FundTrendBadge } from '@/components/watchlist/fund-trend-badge';
import { calculatePositionSummary } from '@/lib/calculations/profit-loss';
import { buildIntradaySummary } from '@/lib/funds/estimate-intraday';
import { canPreviewAdjustedEstimate } from '@/lib/funds/estimate-adjustment-preview';
import { resolveIntradaySignalTradingDate } from '@/lib/funds/intraday-status';
import { calculateTransactionLedgerSummary } from '@/lib/funds/transactions';
import type { EstimateIntradayPoint, EstimateIntradayTrustSignal, FundQuote } from '@/lib/funds/types';
import { useIntradayAnalytics } from '@/lib/hooks/use-intraday-analytics';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

interface WatchlistTableProps {
  funds: WatchlistFund[];
  quotesByCode: Record<string, FundQuote>;
  intradayPointsByCode?: Record<string, EstimateIntradayPoint[]>;
  intradayTrustSignalsByCode?: Record<string, EstimateIntradayTrustSignal>;
  onEditPosition: (fund: WatchlistFund) => void;
  onRemoveFund: (code: string) => void;
  disablePositionEditing?: boolean;
}

interface WatchlistTableRowProps {
  fund: WatchlistFund;
  quote?: FundQuote;
  intradayPoints: EstimateIntradayPoint[];
  intradayTrustSignal?: EstimateIntradayTrustSignal;
  onEditPosition: (fund: WatchlistFund) => void;
  onRemoveFund: (code: string) => void;
  disablePositionEditing: boolean;
}

function formatPercent(value: number | undefined) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : '--';
}

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : '--';
}

function formatDifference(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '--';
  }

  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(4)}`;
}

function WatchlistTableRow({
  fund,
  quote,
  intradayPoints,
  intradayTrustSignal,
  onEditPosition,
  onRemoveFund,
  disablePositionEditing,
}: WatchlistTableRowProps) {
  const { track, trackOnce } = useIntradayAnalytics();
  const intradaySummary = buildIntradaySummary(intradayPoints);
  const hasAdjustmentPreview = canPreviewAdjustedEstimate(quote);
  const adjustmentDifference =
    quote ? (quote.adjustedEstimatedNav ?? quote.estimatedNav) - quote.estimatedNav : null;
  const ledgerSummary = fund.transactions?.length
    ? calculateTransactionLedgerSummary(fund.transactions, quote?.estimatedNav)
    : null;
  const summary = calculatePositionSummary({
    cost: fund.position?.cost,
    estimatedNav: quote?.estimatedNav,
    shares: fund.position?.shares,
    amount: fund.position?.amount,
  });
  const holdingText = ledgerSummary
    ? `成本 ${formatNumber(ledgerSummary.currentCost)} / 份额 ${formatNumber(ledgerSummary.currentShares)}`
    : fund.position?.cost && fund.position?.shares
      ? `成本 ${formatNumber(fund.position.cost)} / 份额 ${formatNumber(fund.position.shares)}`
      : '待填写';
  const profitText = ledgerSummary
    ? formatNumber(ledgerSummary.unrealizedProfit)
    : summary.isComputable
      ? formatNumber(summary.profit)
      : '待填写';
  const tradingDate = resolveIntradaySignalTradingDate({
    quoteUpdatedAt: quote?.updatedAt ?? null,
    points: intradayPoints,
  });

  useEffect(() => {
    trackOnce(`watchlist-row:${fund.code}`, {
      eventName: 'watchlist_row_viewed',
      page: 'home',
      fundCode: fund.code,
      tradingDate,
      intradayStatus: intradayTrustSignal?.status ?? null,
      confidenceLevel: intradayTrustSignal?.confidenceLevel ?? null,
      coverageRatio: intradayTrustSignal?.coverageRatio ?? null,
    });

    if (intradayPoints.length > 0) {
      trackOnce(`watchlist-intraday-visible:${fund.code}`, {
        eventName: 'watchlist_intraday_visible',
        page: 'home',
        fundCode: fund.code,
        tradingDate,
        intradayStatus: intradayTrustSignal?.status ?? null,
        confidenceLevel: intradayTrustSignal?.confidenceLevel ?? null,
        coverageRatio: intradayTrustSignal?.coverageRatio ?? null,
      });
    }

    if (!intradayTrustSignal) {
      return;
    }

    trackOnce(`watchlist-intraday-state:${fund.code}:${intradayTrustSignal.status}:${tradingDate}`, {
      eventName: 'watchlist_intraday_state_seen',
      page: 'home',
      fundCode: fund.code,
      tradingDate,
      intradayStatus: intradayTrustSignal.status,
      confidenceLevel: intradayTrustSignal.confidenceLevel,
      coverageRatio: intradayTrustSignal.coverageRatio,
    });
  }, [fund.code, intradayPoints.length, intradayTrustSignal, trackOnce, tradingDate]);

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-900">
        <Link
          className="hover:text-emerald-600 hover:underline"
          href={`/fund/${fund.code}`}
          onClick={() => {
            track({
              eventName: 'watchlist_fund_clicked',
              page: 'home',
              fundCode: fund.code,
              tradingDate,
              intradayStatus: intradayTrustSignal?.status ?? null,
              confidenceLevel: intradayTrustSignal?.confidenceLevel ?? null,
              coverageRatio: intradayTrustSignal?.coverageRatio ?? null,
            });
          }}
        >
          {fund.name}
        </Link>
        <FundTrendBadge summary={intradaySummary} />
      </td>
      <td className="px-4 py-3 text-slate-600">{fund.code}</td>
      <td className="px-4 py-3 text-slate-900">
        <div>
          <p>{formatNumber(quote?.estimatedNav)}</p>
          {hasAdjustmentPreview ? (
            <div className="mt-1 space-y-1">
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                修正预览可用
              </span>
              <p className="text-xs text-slate-500">
                详情页可切换 · 差额 {formatDifference(adjustmentDifference)}
              </p>
            </div>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-900">{formatPercent(quote?.changeRate)}</td>
      <td className="px-4 py-3 text-slate-600">
        <div className="space-y-2">
          <FundIntradaySparkline points={intradayPoints} />
          {intradayTrustSignal ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <IntradayStatusBadge
                label={intradayTrustSignal.statusLabel}
                tone={intradayTrustSignal.statusTone}
              />
              <IntradayStatusBadge
                label={intradayTrustSignal.confidenceText}
                tone={
                  intradayTrustSignal.confidenceLevel === 'high'
                    ? 'info'
                    : intradayTrustSignal.confidenceLevel === 'medium' ||
                        intradayTrustSignal.confidenceLevel === 'low'
                      ? 'warning'
                      : 'muted'
                }
              />
              <span className="text-slate-400">{intradayTrustSignal.coverageText}</span>
            </div>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600">{holdingText}</td>
      <td className="px-4 py-3 text-slate-900">{profitText}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={disablePositionEditing}
            onClick={() => onEditPosition(fund)}
          >
            编辑持仓
          </button>
          <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-rose-600" onClick={() => onRemoveFund(fund.code)}>
            删除
          </button>
        </div>
      </td>
    </tr>
  );
}

export function WatchlistTable({
  funds,
  quotesByCode,
  intradayPointsByCode = {},
  intradayTrustSignalsByCode = {},
  onEditPosition,
  onRemoveFund,
  disablePositionEditing = false,
}: WatchlistTableProps) {
  if (funds.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        还没有添加基金，请先添加一只基金开始监控。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">基金</th>
            <th className="px-4 py-3 font-medium">代码</th>
            <th className="px-4 py-3 font-medium">当前估值</th>
            <th className="px-4 py-3 font-medium">涨跌幅</th>
            <th className="px-4 py-3 font-medium">分钟走势</th>
            <th className="px-4 py-3 font-medium">持仓</th>
            <th className="px-4 py-3 font-medium">估算盈亏</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {funds.map((fund) => {
            return (
              <WatchlistTableRow
                key={fund.code}
                disablePositionEditing={disablePositionEditing}
                fund={fund}
                intradayPoints={intradayPointsByCode[fund.code] ?? []}
                intradayTrustSignal={intradayTrustSignalsByCode[fund.code]}
                onEditPosition={onEditPosition}
                onRemoveFund={onRemoveFund}
                quote={quotesByCode[fund.code]}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
