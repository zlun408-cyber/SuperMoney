'use client';

import React, { useMemo, useState } from 'react';

import { EstimateConfidencePanel } from '@/components/fund/estimate-confidence-panel';
import { FundIntradayChart } from '@/components/fund/fund-intraday-chart';
import { calculatePositionSummary } from '@/lib/calculations/profit-loss';
import {
  canPreviewAdjustedEstimate,
  isEstimateAdjustmentPreviewLocked,
} from '@/lib/funds/estimate-adjustment-preview';
import { calculateTransactionLedgerSummary } from '@/lib/funds/transactions';
import type {
  EstimateAccuracySummary,
  EstimateConfidenceLevel,
  EstimateIntradayPoint,
  EstimateIntradayTrustSignal,
  EstimateAdjustmentDecisionStatus,
  EstimateAdjustmentPolicy,
  FundQuote,
} from '@/lib/funds/types';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

interface FundDetailCardProps {
  fund: WatchlistFund;
  quote?: FundQuote;
  estimateAccuracySummary?: EstimateAccuracySummary;
  estimateConfidenceLevel?: EstimateConfidenceLevel;
  intradayPoints?: EstimateIntradayPoint[];
  intradayTrustSignal?: EstimateIntradayTrustSignal;
}

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : '待填写';
}

function formatAverageCost(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(4) : '待填写';
}

function formatNavPreview(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(4) : '暂不启用';
}

function formatDelta(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '暂无';
  }

  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(4)}`;
}

function formatImprovementRate(value: number | null | undefined) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '样本不足';
}

function formatDecisionTime(value: string | null | undefined) {
  if (!value) {
    return '未记录';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function formatCooldownHint(value: string | null | undefined) {
  if (!value) {
    return '冷却期未记录';
  }

  return `失败冷却至 ${formatDecisionTime(value)}`;
}

const decisionLabels: Record<EstimateAdjustmentDecisionStatus, string> = {
  verification: '待验证',
  watch: '继续观察',
  dismissed: '暂不处理',
  validated: '验证通过',
  failed: '验证失败',
};

const policyModeLabels: Record<EstimateAdjustmentPolicy['mode'], string> = {
  active: '已启用预览',
  observe: '观察中',
  blocked: '冷却中',
  inactive: '未启用',
};

const policyModeClasses: Record<EstimateAdjustmentPolicy['mode'], string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  observe: 'bg-amber-50 text-amber-700 ring-amber-200',
  blocked: 'bg-rose-50 text-rose-700 ring-rose-200',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const validationRecommendationClasses: Record<'review' | 'downgrade', string> = {
  review: 'bg-amber-50 text-amber-700 ring-amber-200',
  downgrade: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function SummaryStat({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-slate-50/50 p-4 transition hover:bg-slate-50">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-xl font-bold tracking-tight ${colorClass || 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function SummaryGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string; colorClass?: string }>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <SummaryStat key={item.label} label={item.label} value={item.value} colorClass={item.colorClass} />
        ))}
      </div>
    </div>
  );
}

function EstimateAdjustmentPolicyPanel({ policy }: { policy: EstimateAdjustmentPolicy }) {
  const hasValidationRecheck = isEstimateAdjustmentPreviewLocked(policy);

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full animate-pulse ${policy.mode === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          <div>
            <p className="text-sm font-bold text-slate-900">估值修正策略</p>
            <p className="text-xs text-slate-500">{policy.reason}</p>
          </div>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${policyModeClasses[policy.mode]}`}
        >
          {policyModeLabels[policy.mode]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">当前决策</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {policy.decisionStatus ? decisionLabels[policy.decisionStatus] : '未决策'}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">推荐方案</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {policy.scenarioLabel ?? '暂无'}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">修正估值</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {formatNavPreview(policy.adjustedEstimatedNav)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">改善率</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {formatImprovementRate(policy.recommendedImprovementRate)}
          </p>
        </div>
      </div>

      {hasValidationRecheck ? (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-amber-900">回写复核中</p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                validationRecommendationClasses[
                  policy.validationRecommendationStatus as 'review' | 'downgrade'
                ]
              }`}
            >
              {policy.validationRecommendationLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-700">{policy.validationRecommendationReason}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] text-slate-400 uppercase tracking-tighter">
        <span>诊断: {policy.diagnosis ?? '暂无'}</span>
        <span>更新: {formatDecisionTime(policy.decisionUpdatedAt)}</span>
        {policy.cooldownActive && (
           <span className="text-rose-500 font-bold">{formatCooldownHint(policy.cooldownEndsAt)}</span>
        )}
      </div>
    </div>
  );
}

function EstimateAdjustmentPreviewPanel({
  rawEstimatedNav,
  adjustedEstimatedNav,
  previewEnabled,
  onTogglePreview,
}: {
  rawEstimatedNav: number;
  adjustedEstimatedNav: number;
  previewEnabled: boolean;
  onTogglePreview: () => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-emerald-800">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <div>
            <p className="text-sm font-bold">估值修正预览</p>
            <p className="text-xs opacity-80">
              {previewEnabled ? '已切换至修正估值计算' : '当前展示原始实时估值'}
            </p>
          </div>
        </div>
        <button
          className={`rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition ${
            previewEnabled
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-white text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50'
          }`}
          onClick={onTogglePreview}
          type="button"
        >
          {previewEnabled ? '重置原始估值' : '启用修正预览'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">原始估值</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{formatNavPreview(rawEstimatedNav)}</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">修正估值</p>
          <p className="mt-1 text-sm font-bold text-emerald-600">{formatNavPreview(adjustedEstimatedNav)}</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">偏离度</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{formatDelta(adjustedEstimatedNav - rawEstimatedNav)}</p>
        </div>
      </div>
    </div>
  );
}

export function FundDetailCard({
  fund,
  quote,
  estimateAccuracySummary,
  estimateConfidenceLevel = 'unknown',
  intradayPoints = [],
  intradayTrustSignal,
}: FundDetailCardProps) {
  const [isAdjustedPreviewEnabled, setIsAdjustedPreviewEnabled] = useState(false);
  const canAdjustedEstimatePreview = canPreviewAdjustedEstimate(quote);
  const displayEstimatedNav = useMemo(() => {
    if (isAdjustedPreviewEnabled && canAdjustedEstimatePreview) {
      return quote?.adjustedEstimatedNav ?? quote?.estimatedNav;
    }

    return quote?.estimatedNav;
  }, [
    canAdjustedEstimatePreview,
    isAdjustedPreviewEnabled,
    quote?.adjustedEstimatedNav,
    quote?.estimatedNav,
  ]);
  const ledgerSummary = fund.transactions?.length
    ? calculateTransactionLedgerSummary(fund.transactions, displayEstimatedNav)
    : null;
  const summary = calculatePositionSummary({
    cost: fund.position?.cost,
    shares: fund.position?.shares,
    amount: fund.position?.amount,
    estimatedNav: displayEstimatedNav,
  });

  const changeRate = quote?.changeRate ?? 0;
  const changeColorClass = changeRate > 0 ? 'text-rose-600' : changeRate < 0 ? 'text-emerald-600' : 'text-slate-900';

  const currentCost = ledgerSummary ? ledgerSummary.currentCost : fund.position?.cost;
  const estimatedProfit = ledgerSummary ? ledgerSummary.unrealizedProfit : summary.isComputable ? summary.profit : null;
  const totalProfit = ledgerSummary
    ? ledgerSummary.realizedProfit + ledgerSummary.unrealizedProfit
    : estimatedProfit;

  const profitColorClass = (totalProfit ?? 0) > 0 ? 'text-rose-600' : (totalProfit ?? 0) < 0 ? 'text-emerald-600' : 'text-slate-900';

  const holdingItems = ledgerSummary
    ? [
        { label: '当前实时估值', value: formatNumber(displayEstimatedNav) },
        {
          label: '估值当日涨跌',
          value: typeof quote?.changeRate === 'number' ? `${quote.changeRate > 0 ? '+' : ''}${quote.changeRate.toFixed(2)}%` : '待填写',
          colorClass: changeColorClass,
        },
        { label: '当前持有份额', value: formatNumber(ledgerSummary.currentShares) },
        { label: '平均持有成本', value: formatAverageCost(ledgerSummary.averageCost) },
      ]
    : [
        { label: '当前实时估值', value: formatNumber(displayEstimatedNav) },
        {
          label: '估值当日涨跌',
          value: typeof quote?.changeRate === 'number' ? `${quote.changeRate > 0 ? '+' : ''}${quote.changeRate.toFixed(2)}%` : '待填写',
          colorClass: changeColorClass,
        },
        { label: '手工持仓成本', value: formatNumber(currentCost) },
        { label: '估算浮动盈亏', value: formatNumber(estimatedProfit), colorClass: (estimatedProfit ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600' },
      ];
  const profitItems = ledgerSummary
    ? [
        { label: '未实现收益', value: formatNumber(ledgerSummary.unrealizedProfit), colorClass: (ledgerSummary.unrealizedProfit ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600' },
        { label: '已实现收益', value: formatNumber(ledgerSummary.realizedProfit), colorClass: (ledgerSummary.realizedProfit ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600' },
        { label: '累计分红金额', value: formatNumber(ledgerSummary.totalDividends), colorClass: 'text-sky-600' },
        { label: '累计总盈亏', value: formatNumber(totalProfit), colorClass: profitColorClass },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-tighter text-slate-400">
                {fund.code}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                基金详情工作台
              </p>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{fund.name}</h1>
          </div>
          <a
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
            href="/"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </a>
        </header>

        <div className="mt-8 space-y-8">
          {ledgerSummary ? (
            <>
              <SummaryGroup items={holdingItems} title="资产持仓概览" />
              <SummaryGroup items={profitItems} title="收益账本拆分" />
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {holdingItems.map((item) => (
                <SummaryStat
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  colorClass={item.colorClass}
                />
              ))}
            </div>
          )}
        </div>

        {ledgerSummary && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex gap-3">
              <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs leading-relaxed text-slate-500">
                <strong>账本提示：</strong>累计总盈亏已整合已实现与未实现部分。
                分红金额已按发放方式自动计入相应收益分类，以便您清晰追踪资产全生命周期表现。
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-2xl ring-1 ring-slate-100">
          <FundIntradayChart points={intradayPoints} trustSignal={intradayTrustSignal} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {estimateAccuracySummary && (
            <EstimateConfidencePanel
              summary={estimateAccuracySummary}
              confidenceLevel={estimateConfidenceLevel}
            />
          )}

          {quote?.adjustmentPolicy && (
            <div className="h-full">
               <EstimateAdjustmentPolicyPanel policy={quote.adjustmentPolicy} />
            </div>
          )}
        </div>

        {canAdjustedEstimatePreview && typeof quote?.estimatedNav === 'number' && (
          <EstimateAdjustmentPreviewPanel
            rawEstimatedNav={quote.estimatedNav}
            adjustedEstimatedNav={quote.adjustedEstimatedNav ?? quote.estimatedNav}
            previewEnabled={isAdjustedPreviewEnabled}
            onTogglePreview={() => setIsAdjustedPreviewEnabled((current) => !current)}
          />
        )}
      </section>
    </div>
  );
}
