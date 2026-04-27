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
    <div className="rounded-2xl border border-slate-200 bg-slate-50/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
           <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div>
            <p className="text-sm font-bold text-slate-900">估值可信度</p>
            {confidenceLevel === 'unknown' && (
              <p className="text-xs text-slate-500">
                暂无足够已收敛样本，估值可信度暂不可判断。
              </p>
            )}
          </div>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${confidenceStyles[confidenceLevel]}`}
        >
          {confidenceLabels[confidenceLevel]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">已收敛样本</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {summary.resolvedSampleCount} / {summary.sampleCount}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">平均绝对误差</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {formatErrorRate(summary.averageAbsoluteErrorRate)}
          </p>
        </div>
      </div>
    </div>
  );
}
