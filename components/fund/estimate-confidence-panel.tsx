'use client';

import React from 'react';

import type { EstimateAccuracySummary, EstimateConfidenceLevel } from '@/lib/funds/types';

interface EstimateConfidencePanelProps {
  summary: EstimateAccuracySummary;
  confidenceLevel: EstimateConfidenceLevel;
}

const confidenceLabels: Record<EstimateConfidenceLevel, string> = {
  high: '高',
  medium: '中',
  low: '低',
  unknown: '未知',
};

const confidenceStyles: Record<EstimateConfidenceLevel, string> = {
  high: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-rose-50 text-rose-700 ring-rose-200',
  unknown: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function formatErrorRate(value: number | null) {
  return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : '样本不足';
}

export function EstimateConfidencePanel({
  summary,
  confidenceLevel,
}: EstimateConfidencePanelProps) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">估值可信度</p>
          {confidenceLevel === 'unknown' ? (
            <p className="mt-1 text-sm text-slate-600">
              暂无足够已收敛样本，估值可信度暂不可判断。
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${confidenceStyles[confidenceLevel]}`}
        >
          {confidenceLabels[confidenceLevel]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-white p-3">
          <p className="text-sm text-slate-500">已收敛样本数</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {summary.resolvedSampleCount} / {summary.sampleCount}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-sm text-slate-500">平均绝对误差</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatErrorRate(summary.averageAbsoluteErrorRate)}
          </p>
        </div>
      </div>
    </div>
  );
}
