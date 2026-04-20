import React from 'react';

import {
  buildIntradaySummary,
  buildSvgPath,
  normalizeIntradayChartPoints,
} from '@/lib/funds/estimate-intraday';
import type { EstimateIntradayPoint } from '@/lib/funds/types';

export function FundIntradaySparkline({ points }: { points: EstimateIntradayPoint[] }) {
  const summary = buildIntradaySummary(points);

  if (summary.pointCount === 0) {
    return <span className="text-xs text-slate-400">今日暂无分时</span>;
  }

  if (summary.pointCount === 1) {
    return <span className="text-xs text-slate-400">分时生成中</span>;
  }

  const normalized = normalizeIntradayChartPoints(points, 120, 36);
  const path = buildSvgPath(normalized);
  const latestPoint = normalized.at(-1);
  const areaPath =
    normalized.length > 1
      ? `${path} L ${normalized.at(-1)?.x ?? 120} 36 L ${normalized[0].x} 36 Z`
      : '';
  const strokeClass =
    summary.trend === 'down'
      ? 'stroke-emerald-500'
      : summary.trend === 'up'
        ? 'stroke-rose-500'
        : 'stroke-amber-500';
  const fillClass =
    summary.trend === 'down'
      ? 'fill-emerald-100/70'
      : summary.trend === 'up'
        ? 'fill-rose-100/70'
        : 'fill-amber-100/70';

  return (
    <svg
      aria-label="今日分钟走势"
      className="h-10 w-32 overflow-visible"
      data-testid="fund-intraday-sparkline"
      role="img"
      viewBox="0 0 120 36"
    >
      <path
        d="M 0 35.5 L 120 35.5"
        className="stroke-slate-200"
        data-testid="fund-intraday-sparkline-baseline"
        strokeDasharray="3 3"
        strokeWidth="1"
      />
      <path
        className={fillClass}
        d={areaPath}
        data-testid="fund-intraday-sparkline-area"
      />
      <path
        d={path}
        className={`${strokeClass} fill-none`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      {latestPoint ? (
        <circle
          className={summary.trend === 'down' ? 'fill-emerald-500' : summary.trend === 'up' ? 'fill-rose-500' : 'fill-amber-500'}
          cx={latestPoint.x}
          cy={latestPoint.y}
          data-testid="fund-intraday-sparkline-latest"
          r="2.5"
        />
      ) : null}
    </svg>
  );
}
