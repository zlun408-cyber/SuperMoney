'use client';

import React, { useMemo, useState } from 'react';

import { EstimateConfidencePanel } from '@/components/fund/estimate-confidence-panel';
import { calculatePositionSummary } from '@/lib/calculations/profit-loss';
import {
  canPreviewAdjustedEstimate,
  isEstimateAdjustmentPreviewLocked,
} from '@/lib/funds/estimate-adjustment-preview';
import { calculateTransactionLedgerSummary } from '@/lib/funds/transactions';
import type {
  EstimateAccuracySummary,
  EstimateConfidenceLevel,
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SummaryGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <SummaryItem key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </div>
  );
}

function EstimateAdjustmentPolicyPanel({ policy }: { policy: EstimateAdjustmentPolicy }) {
  const hasValidationRecheck = isEstimateAdjustmentPreviewLocked(policy);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">估值修正策略</p>
          <p className="mt-1 text-sm text-slate-600">{policy.reason}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${policyModeClasses[policy.mode]}`}
        >
          {policyModeLabels[policy.mode]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-white p-3">
          <p className="text-sm text-slate-500">当前决策</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {policy.decisionStatus ? decisionLabels[policy.decisionStatus] : '未决策'}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-sm text-slate-500">推荐方案</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {policy.scenarioLabel ?? '暂无'}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-sm text-slate-500">修正后估值预览</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatNavPreview(policy.adjustedEstimatedNav)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-sm text-slate-500">模拟改善率</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatImprovementRate(policy.recommendedImprovementRate)}
          </p>
        </div>
      </div>

      {hasValidationRecheck ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">回写复核中</p>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                validationRecommendationClasses[
                  policy.validationRecommendationStatus as 'review' | 'downgrade'
                ]
              }`}
            >
              {policy.validationRecommendationLabel}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{policy.validationRecommendationReason}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
        <span>诊断：{policy.diagnosis ?? '暂无'}</span>
        <span>最近决策：{formatDecisionTime(policy.decisionUpdatedAt)}</span>
        <span>
          {policy.cooldownActive
            ? `状态：失败冷却中 · ${formatCooldownHint(policy.cooldownEndsAt)}`
            : '状态：可继续跟踪'}
        </span>
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
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">估值修正预览</p>
          <p className="mt-1 text-sm text-slate-600">
            {previewEnabled ? '当前按修正估值预览持仓与收益' : '当前仍按原始估值展示持仓与收益'}
          </p>
        </div>
        <button
          className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-700"
          onClick={onTogglePreview}
          type="button"
        >
          {previewEnabled ? '切换回原始估值' : '切换到修正估值预览'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-white p-3">
          <p className="text-sm text-slate-500">原始估值</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatNavPreview(rawEstimatedNav)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-sm text-slate-500">修正估值</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatNavPreview(adjustedEstimatedNav)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-sm text-slate-500">估值差额</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatDelta(adjustedEstimatedNav - rawEstimatedNav)}
          </p>
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
  const currentCost = ledgerSummary ? ledgerSummary.currentCost : fund.position?.cost;
  const estimatedProfit = ledgerSummary ? ledgerSummary.unrealizedProfit : summary.isComputable ? summary.profit : null;
  const totalProfit = ledgerSummary
    ? ledgerSummary.realizedProfit + ledgerSummary.unrealizedProfit
    : estimatedProfit;
  const holdingItems = ledgerSummary
    ? [
        { label: '当前估值', value: formatNumber(displayEstimatedNav) },
        {
          label: '涨跌幅',
          value: typeof quote?.changeRate === 'number' ? `${quote.changeRate.toFixed(2)}%` : '待填写',
        },
        { label: '当前份额', value: formatNumber(ledgerSummary.currentShares) },
        { label: '当前成本', value: formatNumber(ledgerSummary.currentCost) },
        { label: '平均成本', value: formatAverageCost(ledgerSummary.averageCost) },
      ]
    : [
        { label: '当前估值', value: formatNumber(displayEstimatedNav) },
        {
          label: '涨跌幅',
          value: typeof quote?.changeRate === 'number' ? `${quote.changeRate.toFixed(2)}%` : '待填写',
        },
        { label: '持仓成本', value: formatNumber(currentCost) },
        { label: '估算盈亏', value: formatNumber(estimatedProfit) },
      ];
  const profitItems = ledgerSummary
    ? [
        { label: '未实现收益', value: formatNumber(ledgerSummary.unrealizedProfit) },
        { label: '已实现收益', value: formatNumber(ledgerSummary.realizedProfit) },
        { label: '累计分红', value: formatNumber(ledgerSummary.totalDividends) },
        { label: '总收益', value: formatNumber(totalProfit) },
      ]
    : [];

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

      <div className="mt-6 space-y-6">
        {ledgerSummary ? (
          <>
            <SummaryGroup items={holdingItems} title="持仓概览" />
            <SummaryGroup items={profitItems} title="收益拆分" />
          </>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {holdingItems.map((item) => (
              <SummaryItem key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        )}
      </div>

      {ledgerSummary ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">账本说明</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>总收益 = 已实现收益 + 未实现收益</li>
            <li>累计分红已计入已实现收益，这里单独展示，方便你看清收益来源。</li>
          </ul>
        </div>
      ) : null}

      {estimateAccuracySummary ? (
        <EstimateConfidencePanel
          summary={estimateAccuracySummary}
          confidenceLevel={estimateConfidenceLevel}
        />
      ) : null}

      {quote?.adjustmentPolicy ? (
        <EstimateAdjustmentPolicyPanel policy={quote.adjustmentPolicy} />
      ) : null}

      {canAdjustedEstimatePreview && typeof quote?.estimatedNav === 'number' ? (
        <EstimateAdjustmentPreviewPanel
          rawEstimatedNav={quote.estimatedNav}
          adjustedEstimatedNav={quote.adjustedEstimatedNav ?? quote.estimatedNav}
          previewEnabled={isAdjustedPreviewEnabled}
          onTogglePreview={() => setIsAdjustedPreviewEnabled((current) => !current)}
        />
      ) : null}
    </section>
  );
}
