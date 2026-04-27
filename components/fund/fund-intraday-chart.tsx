import React from 'react';

import { IntradayStatusBadge } from '@/components/fund/intraday-status-badge';
import {
  buildIntradaySummary,
  buildSvgPath,
  normalizeIntradayChartPoints,
} from '@/lib/funds/estimate-intraday';
import type { EstimateIntradayPoint, EstimateIntradayTrustSignal } from '@/lib/funds/types';

const trendLabels = {
  unknown: '分时生成中',
  up: '上行',
  down: '回落',
  flat: '横盘',
  volatile: '波动',
} as const;

const trendClasses = {
  unknown: 'bg-slate-100 text-slate-500',
  up: 'bg-rose-50 text-rose-700',
  down: 'bg-emerald-50 text-emerald-700',
  flat: 'bg-slate-100 text-slate-600',
  volatile: 'bg-amber-50 text-amber-700',
} as const;

function formatNav(value: number | null): string {
  return typeof value === 'number' ? value.toFixed(4) : '--';
}

function formatPercent(value: number | null): string {
  if (typeof value !== 'number') {
    return '--';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatAmplitudePercent(
  highEstimatedNav: number | null,
  lowEstimatedNav: number | null,
  firstEstimatedNav: number | null,
): string {
  if (
    typeof highEstimatedNav !== 'number' ||
    typeof lowEstimatedNav !== 'number' ||
    typeof firstEstimatedNav !== 'number' ||
    firstEstimatedNav === 0
  ) {
    return '--';
  }

  return `${(((highEstimatedNav - lowEstimatedNav) / firstEstimatedNav) * 100).toFixed(2)}%`;
}

function getMarketTone(value: number | null) {
  if (typeof value !== 'number') {
    return 'neutral';
  }

  if (value > 0) {
    return 'up';
  }

  if (value < 0) {
    return 'down';
  }

  return 'neutral';
}

const marketToneClasses = {
  up: {
    text: 'text-rose-600',
    stroke: 'stroke-rose-500',
  },
  down: {
    text: 'text-emerald-600',
    stroke: 'stroke-emerald-500',
  },
  neutral: {
    text: 'text-slate-900',
    stroke: 'stroke-slate-500',
  },
} as const;

function Metric({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${colorClass ?? 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

export function FundIntradayChart({
  points,
  trustSignal,
}: {
  points: EstimateIntradayPoint[];
  trustSignal?: EstimateIntradayTrustSignal;
}) {
  const summary = buildIntradaySummary(points);
  const chartTone = getMarketTone(summary.latestChangeRate);
  const changeFromFirstTone = getMarketTone(summary.changeRateFromFirst);
  const latestChangeTone = getMarketTone(summary.latestChangeRate);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">今日走势</p>
          <p className="mt-1 text-sm text-slate-500">
            最近更新：{trustSignal?.lastUpdatedLabel ?? summary.latestUpdatedAt ?? '暂无'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {trustSignal ? (
            <>
              <IntradayStatusBadge label={trustSignal.statusLabel} tone={trustSignal.statusTone} />
              <IntradayStatusBadge
                label={trustSignal.confidenceText}
                tone={
                  trustSignal.confidenceLevel === 'high'
                    ? 'info'
                    : trustSignal.confidenceLevel === 'medium' ||
                        trustSignal.confidenceLevel === 'low'
                      ? 'warning'
                      : 'muted'
                }
              />
              <span className="text-xs text-slate-500">{trustSignal.coverageText}</span>
            </>
          ) : null}
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${trendClasses[summary.trend]}`}>
            {trendLabels[summary.trend]}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            {summary.pointCount} 个分钟点
          </span>
        </div>
      </div>

      {summary.pointCount < 2 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          今日分时数据还在生成中。开盘后保持页面打开并等待几次刷新，曲线会逐步补齐。
        </div>
      ) : (
        <svg
          aria-label="今日分钟走势"
          className="mt-4 h-40 w-full overflow-visible"
          data-testid="fund-intraday-chart"
          role="img"
          viewBox="0 0 640 160"
        >
          <path
            d={buildSvgPath(normalizeIntradayChartPoints(points, 640, 160))}
            className={`fill-none ${marketToneClasses[chartTone].stroke}`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </svg>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="当前估值" value={formatNav(summary.latestEstimatedNav)} />
        <Metric label="今日最高" value={formatNav(summary.highEstimatedNav)} />
        <Metric label="今日最低" value={formatNav(summary.lowEstimatedNav)} />
        <Metric
          label="开盘至今"
          value={formatPercent(summary.changeRateFromFirst)}
          colorClass={marketToneClasses[changeFromFirstTone].text}
        />
        <Metric
          label="最新涨跌"
          value={formatPercent(summary.latestChangeRate)}
          colorClass={marketToneClasses[latestChangeTone].text}
        />
        <Metric
          label="日内振幅"
          value={formatAmplitudePercent(
            summary.highEstimatedNav,
            summary.lowEstimatedNav,
            summary.firstEstimatedNav,
          )}
        />
      </div>
    </div>
  );
}
