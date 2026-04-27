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
  const transactions = fund.transactions ?? [];
  const hasLedgerSource = transactions.length > 0;
  const ledgerSummary = hasLedgerSource
    ? calculateTransactionLedgerSummary(transactions, quote?.estimatedNav)
    : null;
  const summary = calculatePositionSummary({
    cost: fund.position?.cost,
    estimatedNav: quote?.estimatedNav,
    shares: fund.position?.shares,
    amount: fund.position?.amount,
  });
  const holdingSourceText = hasLedgerSource ? '交易记录' : summary.isComputable ? '手工持仓' : null;
  const holdingValueText = ledgerSummary
    ? `成本 ${formatNumber(ledgerSummary.currentCost)} / 份额 ${formatNumber(ledgerSummary.currentShares)}`
    : summary.isComputable
      ? `成本 ${formatNumber(fund.position?.cost)} / 份额 ${formatNumber(fund.position?.shares)}`
      : '待填写';
  const profitSourceText = hasLedgerSource ? '按交易记录估算' : summary.isComputable ? '按手工持仓估算' : null;
  const profitValue = ledgerSummary
    ? ledgerSummary.unrealizedProfit
    : summary.isComputable
      ? summary.profit
      : null;
  const tradingDate = resolveIntradaySignalTradingDate({
    quoteUpdatedAt: quote?.updatedAt ?? null,
    points: intradayPoints,
  });

  const changeRate = quote?.changeRate ?? 0;
  const changeColorClass = changeRate > 0 ? 'text-rose-600' : changeRate < 0 ? 'text-emerald-600' : 'text-slate-900';
  const profitColorClass = (profitValue ?? 0) > 0 ? 'text-rose-600' : (profitValue ?? 0) < 0 ? 'text-emerald-600' : 'text-slate-900';

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
    <tr className="group transition hover:bg-slate-50/50">
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          <Link
            className="font-bold text-slate-900 transition hover:text-emerald-600"
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
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{fund.code}</span>
            <FundTrendBadge summary={intradaySummary} />
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-base font-bold text-slate-900">{formatNumber(quote?.estimatedNav)}</span>
          {hasAdjustmentPreview && (
            <span className="mt-1 inline-flex w-fit items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              修正可用
            </span>
          )}
        </div>
      </td>
      <td className={`px-6 py-4 text-base font-bold ${changeColorClass}`}>
        {changeRate > 0 ? '+' : ''}{formatPercent(quote?.changeRate)}
      </td>
      <td className="px-6 py-4">
        <div className="flex min-w-[120px] flex-col gap-2">
          <FundIntradaySparkline points={intradayPoints} />
          {intradayTrustSignal ? (
            <div className="flex flex-wrap items-center gap-1.5">
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
              <span className="text-[10px] text-slate-400">{intradayTrustSignal.coverageText}</span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-300 italic">等待数据中...</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-900">{holdingValueText}</span>
          {holdingSourceText && (
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{holdingSourceText}</span>
          )}
        </div>
      </td>
      <td className={`px-6 py-4 text-base font-bold ${profitColorClass}`}>
        <div className="flex flex-col gap-1">
          <span>{(profitValue ?? 0) > 0 ? '+' : ''}{formatNumber(profitValue)}</span>
          {profitSourceText && (
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{profitSourceText}</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
            disabled={disablePositionEditing}
            onClick={() => onEditPosition(fund)}
          >
            编辑
          </button>
          <button
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-rose-600 shadow-sm ring-1 ring-inset ring-rose-200 transition hover:bg-rose-50 hover:ring-rose-300"
            onClick={() => onRemoveFund(fund.code)}
          >
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
      <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-200">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mt-6 text-sm font-bold text-slate-900">暂无关注基金</h3>
        <p className="mt-1 text-sm text-slate-500">添加第一只基金，开启分钟级实时估值监控。</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-6 py-4">基金信息</th>
            <th className="px-6 py-4">当前估值</th>
            <th className="px-6 py-4">日内涨跌</th>
            <th className="px-6 py-4">分钟走势 / 信号</th>
            <th className="px-6 py-4">持仓详情</th>
            <th className="px-6 py-4">估算盈亏</th>
            <th className="px-6 py-4 text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {funds.map((fund) => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
