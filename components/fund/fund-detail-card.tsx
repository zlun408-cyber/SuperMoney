'use client';

import React from 'react';

import { calculatePositionSummary } from '@/lib/calculations/profit-loss';
import { calculateTransactionLedgerSummary } from '@/lib/funds/transactions';
import type { FundQuote } from '@/lib/funds/types';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

interface FundDetailCardProps {
  fund: WatchlistFund;
  quote?: FundQuote;
}

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : '待填写';
}

function formatAverageCost(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(4) : '待填写';
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function FundDetailCard({ fund, quote }: FundDetailCardProps) {
  const ledgerSummary = fund.transactions?.length
    ? calculateTransactionLedgerSummary(fund.transactions, quote?.estimatedNav)
    : null;
  const summary = calculatePositionSummary({
    cost: fund.position?.cost,
    shares: fund.position?.shares,
    amount: fund.position?.amount,
    estimatedNav: quote?.estimatedNav,
  });
  const currentCost = ledgerSummary ? ledgerSummary.currentCost : fund.position?.cost;
  const estimatedProfit = ledgerSummary ? ledgerSummary.unrealizedProfit : summary.isComputable ? summary.profit : null;
  const totalProfit = ledgerSummary
    ? ledgerSummary.realizedProfit + ledgerSummary.unrealizedProfit
    : estimatedProfit;
  const summaryItems = ledgerSummary
    ? [
        { label: '当前估值', value: formatNumber(quote?.estimatedNav) },
        {
          label: '涨跌幅',
          value: typeof quote?.changeRate === 'number' ? `${quote.changeRate.toFixed(2)}%` : '待填写',
        },
        { label: '当前份额', value: formatNumber(ledgerSummary.currentShares) },
        { label: '当前成本', value: formatNumber(ledgerSummary.currentCost) },
        { label: '平均成本', value: formatAverageCost(ledgerSummary.averageCost) },
        { label: '未实现收益', value: formatNumber(ledgerSummary.unrealizedProfit) },
        { label: '已实现收益', value: formatNumber(ledgerSummary.realizedProfit) },
        { label: '累计分红', value: formatNumber(ledgerSummary.totalDividends) },
        { label: '总收益', value: formatNumber(totalProfit) },
      ]
    : [
        { label: '当前估值', value: formatNumber(quote?.estimatedNav) },
        {
          label: '涨跌幅',
          value: typeof quote?.changeRate === 'number' ? `${quote.changeRate.toFixed(2)}%` : '待填写',
        },
        { label: '持仓成本', value: formatNumber(currentCost) },
        { label: '估算盈亏', value: formatNumber(estimatedProfit) },
      ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{fund.name}</h1>
          <p className="mt-2 text-sm text-slate-600">基金代码：{fund.code}</p>
        </div>
        <a className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/">
          返回首页
        </a>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {summaryItems.map((item) => (
          <SummaryItem key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </section>
  );
}
