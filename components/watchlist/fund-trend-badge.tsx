import React from 'react';

import type { EstimateIntradaySummary, EstimateIntradayTrend } from '@/lib/funds/types';

const trendLabels: Record<EstimateIntradayTrend, string> = {
  unknown: '分时生成中',
  up: '上行',
  down: '回落',
  flat: '横盘',
  volatile: '波动',
};

const trendClasses: Record<EstimateIntradayTrend, string> = {
  unknown: 'bg-slate-100 text-slate-500 ring-slate-200',
  up: 'bg-rose-50 text-rose-700 ring-rose-200',
  down: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  flat: 'bg-slate-100 text-slate-600 ring-slate-200',
  volatile: 'bg-amber-50 text-amber-700 ring-amber-200',
};

function formatTodayChange(value: number | null): string {
  if (typeof value !== 'number') {
    return '今日待更新';
  }

  return `今日 ${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getTodayChangeClass(value: number | null): string {
  if (typeof value !== 'number') {
    return 'text-slate-500';
  }

  if (value > 0) {
    return 'text-rose-600';
  }

  if (value < 0) {
    return 'text-emerald-600';
  }

  return 'text-slate-500';
}

export function FundTrendBadge({ summary }: { summary: EstimateIntradaySummary }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span
        className={`inline-flex rounded-full px-2 py-0.5 font-medium ring-1 ${trendClasses[summary.trend]}`}
      >
        {trendLabels[summary.trend]}
      </span>
      <span className={getTodayChangeClass(summary.changeRateFromFirst)}>
        {formatTodayChange(summary.changeRateFromFirst)}
      </span>
    </div>
  );
}
