'use client';

import React from 'react';

import { calculatePositionSummary } from '@/lib/calculations/profit-loss';
import type { FundQuote } from '@/lib/funds/types';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

interface FundDetailCardProps {
  fund: WatchlistFund;
  quote?: FundQuote;
}

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : '待填写';
}

export function FundDetailCard({ fund, quote }: FundDetailCardProps) {
  const summary = calculatePositionSummary({
    cost: fund.position?.cost,
    shares: fund.position?.shares,
    amount: fund.position?.amount,
    estimatedNav: quote?.estimatedNav,
  });

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
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">当前估值</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(quote?.estimatedNav)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">涨跌幅</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {typeof quote?.changeRate === 'number' ? `${quote.changeRate.toFixed(2)}%` : '待填写'}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">持仓成本</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(fund.position?.cost)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">估算盈亏</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {summary.isComputable ? formatNumber(summary.profit) : '待填写'}
          </p>
        </div>
      </div>
    </section>
  );
}
