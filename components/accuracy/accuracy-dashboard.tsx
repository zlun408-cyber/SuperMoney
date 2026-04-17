'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  buildEstimateAccuracyAdjustmentSimulation,
  type EstimateAccuracyAdjustmentSimulationFundInsight,
} from '@/lib/funds/estimate-accuracy-adjustment';
import {
  buildEstimateAccuracyAbnormalInvestigationItems,
  type EstimateAccuracyAbnormalTag,
} from '@/lib/funds/estimate-accuracy-abnormal-investigation';
import {
  ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
  ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT,
} from '@/lib/funds/estimate-adjustment-policy';
import { buildEstimateAdjustmentValidationSummary } from '@/lib/funds/estimate-adjustment-validation';
import {
  summarizeEstimateAccuracyDiagnostics,
  type EstimateAccuracyDiagnosis,
} from '@/lib/funds/estimate-accuracy-diagnostics';
import { summarizeEstimateAccuracy } from '@/lib/funds/estimate-accuracy';
import {
  buildEstimateAccuracyRecommendations,
  summarizeEstimateAccuracyDailyTrend,
  summarizeEstimateAccuracyTimeBuckets,
} from '@/lib/funds/estimate-accuracy-insights';
import {
  buildEstimateAccuracySourceModel,
  buildEstimateAccuracyStrategy,
} from '@/lib/funds/estimate-accuracy-source-model';
import type { EstimateAccuracySnapshot, EstimateAccuracySummary } from '@/lib/funds/types';
import {
  ESTIMATE_ACCURACY_STORAGE_KEY,
  ESTIMATE_ACCURACY_UPDATED_EVENT,
  loadEstimateAccuracySnapshots,
} from '@/lib/storage/estimate-accuracy-storage';

interface FundAccuracyItem {
  fundCode: string;
  fundName: string;
  summary: EstimateAccuracySummary;
  resolvedSampleCount: number;
}

interface ErrorDistributionItem {
  label: string;
  count: number;
  share: number;
}

interface UnresolvedAccuracyItem {
  id: string;
  fundCode: string;
  fundName: string;
  tradingDate: string;
  quoteUpdatedAt: string;
}

type AdjustmentFundFilter = 'all' | 'priority' | 'collect-more' | 'not-recommended';
type AdjustmentFundSort = 'improvement' | 'baseline';
type AdjustmentFundDecisionStatus =
  | 'verification'
  | 'watch'
  | 'dismissed'
  | 'validated'
  | 'failed';
type AdjustmentExecutionFilter = 'all' | 'verification' | 'watch' | 'recheck';

interface AdjustmentFundDecisionHistoryItem {
  status: AdjustmentFundDecisionStatus;
  updatedAt: string;
}

interface AdjustmentFundDecisionItem {
  status: AdjustmentFundDecisionStatus;
  updatedAt: string;
  history: AdjustmentFundDecisionHistoryItem[];
}

interface AdjustmentFundDetailBucketItem {
  label: string;
  sampleCount: number;
  averageAbsoluteErrorRate: number | null;
}

interface AdjustmentFundDetailSampleItem {
  id: string;
  tradingDate: string;
  quoteUpdatedAt: string;
  estimatedNav: number;
  finalNav: number | null;
  absoluteErrorRate: number | null;
  resolved: boolean;
}

interface AdjustmentFundDetailItem {
  buckets: AdjustmentFundDetailBucketItem[];
  samples: AdjustmentFundDetailSampleItem[];
}

interface AdjustmentFundRuleDraft {
  title: string;
  summary: string;
  focus: string;
  checklist: string[];
}

interface AdjustmentFundExecutionItem {
  fundCode: string;
  fundName: string;
  diagnosis: EstimateAccuracyDiagnosis;
  decisionStatus: AdjustmentFundDecisionStatus;
  executionFilterKey: Exclude<AdjustmentExecutionFilter, 'all'>;
  decisionLabel: string;
  priorityLabel: 'P0' | 'P1' | 'P2';
  validationRecommendationStatus?: 'keep' | 'review' | 'downgrade';
  validationRecommendationLabel?: string;
  validationRecommendationReason?: string;
  updatedAtLabel: string;
  updatedAt: string;
  ruleDraftTitle: string;
  nextStep: string;
}

interface AdjustmentFundHistoryItem {
  fundCode: string;
  fundName: string;
  status: AdjustmentFundDecisionStatus;
  statusLabel: string;
  updatedAt: string;
  updatedAtLabel: string;
  ruleDraftTitle: string;
}

const ERROR_RATE_BUCKETS = [
  {
    label: '≤ 0.30%',
    includes: (value: number) => value <= 0.003,
  },
  {
    label: '0.30% - 1.00%',
    includes: (value: number) => value > 0.003 && value <= 0.01,
  },
  {
    label: '1.00% - 2.00%',
    includes: (value: number) => value > 0.01 && value <= 0.02,
  },
  {
    label: '> 2.00%',
    includes: (value: number) => value > 0.02,
  },
] as const;

const CONFIDENCE_RULE_CARDS = [
  {
    testId: 'accuracy-confidence-rule-window',
    title: '交易日覆盖',
    description: '先看已收敛样本是否覆盖足够交易日，避免单日偶然偏差直接推高可信度。',
  },
  {
    testId: 'accuracy-confidence-rule-sample',
    title: '已收敛样本量',
    description: '只把拿到最终净值的样本计入可信度判断；样本量不足时会保守下调等级。',
  },
  {
    testId: 'accuracy-confidence-rule-distribution',
    title: '高误差样本占比',
    description: '检查误差尾部风险；即使平均误差可接受，高误差占比偏高也不能给高可信度。',
  },
] as const;

const QUOTE_UPDATED_LOCAL_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const ADJUSTMENT_FUND_TIME_BUCKETS = ['盘前 / 上午', '午后', '尾盘', '收盘后', '未知'] as const;
const formatPercent = (value: number | null): string => {
  if (value === null) {
    return '样本不足';
  }

  return `${(value * 100).toFixed(2)}%`;
};

const formatShare = (value: number): string => `${(value * 100).toFixed(0)}%`;

const formatSignedPercent = (value: number | null): string => {
  if (value === null) {
    return '样本不足';
  }

  const prefix = value > 0 ? '+' : '';
  return `${prefix}${(value * 100).toFixed(2)}%`;
};

const formatNavValue = (value: number | null): string => {
  if (value === null) {
    return '待收敛';
  }

  return value.toFixed(4);
};

const getPriorityLabel = (index: number): string => {
  if (index === 0) {
    return '最高优先';
  }

  if (index === 1) {
    return '优先排查';
  }

  return '持续观察';
};

const getToggleButtonClassName = (active: boolean): string =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    active
      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
  }`;

const getDecisionButtonClassName = (active: boolean): string =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    active
      ? 'border-blue-900 bg-blue-900 text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
  }`;

const getAbnormalTagClassName = (tag: EstimateAccuracyAbnormalTag): string => {
  if (tag === '连续偏差') {
    return 'rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700';
  }

  if (tag === '高误差') {
    return 'rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700';
  }

  return 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700';
};

const getQuoteUpdatedHour = (quoteUpdatedAt: string): number | null => {
  const localMatch = quoteUpdatedAt.match(QUOTE_UPDATED_LOCAL_TIME_FORMAT);
  if (localMatch) {
    return Number(localMatch[4]);
  }

  const timestamp = Date.parse(quoteUpdatedAt);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const chinaTimestamp = timestamp + 8 * 60 * 60 * 1000;
  return new Date(chinaTimestamp).getUTCHours();
};

const getAdjustmentFundTimeBucket = (quoteUpdatedAt: string): string => {
  const hour = getQuoteUpdatedHour(quoteUpdatedAt);

  if (hour === null) {
    return '未知';
  }

  if (hour < 12) {
    return '盘前 / 上午';
  }

  if (hour < 14) {
    return '午后';
  }

  if (hour < 15) {
    return '尾盘';
  }

  return '收盘后';
};

const formatChinaDateTime = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const chinaDate = new Date(timestamp + 8 * 60 * 60 * 1000);
  const year = chinaDate.getUTCFullYear();
  const month = `${chinaDate.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${chinaDate.getUTCDate()}`.padStart(2, '0');
  const hour = `${chinaDate.getUTCHours()}`.padStart(2, '0');
  const minute = `${chinaDate.getUTCMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const getAdjustmentFundPrimaryBucket = (
  detail: AdjustmentFundDetailItem | undefined,
): string | null => {
  if (!detail || detail.buckets.length === 0) {
    return null;
  }

  return [...detail.buckets]
    .sort((left, right) => {
      const errorDelta =
        (right.averageAbsoluteErrorRate ?? -1) - (left.averageAbsoluteErrorRate ?? -1);
      if (errorDelta !== 0) {
        return errorDelta;
      }

      const sampleDelta = right.sampleCount - left.sampleCount;
      if (sampleDelta !== 0) {
        return sampleDelta;
      }

      return ADJUSTMENT_FUND_TIME_BUCKETS.indexOf(left.label as (typeof ADJUSTMENT_FUND_TIME_BUCKETS)[number]) -
        ADJUSTMENT_FUND_TIME_BUCKETS.indexOf(right.label as (typeof ADJUSTMENT_FUND_TIME_BUCKETS)[number]);
    })[0]?.label ?? null;
};

const buildAdjustmentFundRuleDraft = (
  item: EstimateAccuracyAdjustmentSimulationFundInsight,
  detail: AdjustmentFundDetailItem | undefined,
): AdjustmentFundRuleDraft => {
  const primaryBucket = getAdjustmentFundPrimaryBucket(detail) ?? '重点时段';

  if (item.recommendationStatus === 'not-recommended') {
    return {
      title: '保留原链路观察',
      summary: '当前模拟改善有限，暂不建议为该基金单独上线修正规则。',
      focus: '继续保留现有估值链路，仅在新增样本显示改善扩大时再重新评估。',
      checklist: [
        '继续补充最近交易日样本，确认改善率是否重新抬升。',
        '复核当前高误差样本是否来自异常行情或一次性噪声。',
        '若后续再进入候选名单，再重新评估上线范围。',
      ],
    };
  }

  if (item.recommendationStatus === 'collect-more' || item.bestScenarioKey === null) {
    return {
      title: '样本收集观察草案',
      summary: '当前已有潜在修正方向，但样本仍不足，先不直接上线基金级规则。',
      focus: `优先补齐 ${primaryBucket} 相关样本，确认改善是否具备稳定性后再转正式修正规则。`,
      checklist: [
        '至少补齐 2 个以上新增已收敛样本，再重新评估改善幅度。',
        `重点补充 ${primaryBucket} 相关样本，确认问题是否持续出现。`,
        '样本补齐后再决定是否进入灰度验证。',
      ],
    };
  }

  if (item.bestScenarioKey === 'late-session') {
    return {
      title: '尾盘增强修正草案',
      summary: '仅对尾盘与收盘后估值启用附加修正，其他时段保持原链路。',
      focus: `当前误差更集中在 ${primaryBucket}，优先收敛盘末链路，避免扩大到全天时段。`,
      checklist: [
        '灰度验证尾盘 / 收盘后链路，确认盘末样本仍稳定优于基线。',
        '比对盘前 / 午后样本，确认未引入额外偏差。',
        '至少复核最近 2 个已收敛交易日的盘末样本，再考虑扩大范围。',
      ],
    };
  }

  if (item.bestScenarioKey === 'diagnosis-aware') {
    return {
      title: '诊断联动修正草案',
      summary: '按基金诊断结果做主修正，并在关键时段叠加局部增强，兼顾系统性和时段性误差。',
      focus: `先围绕 ${item.diagnosis} 方向消除主偏差，再重点复核 ${primaryBucket} 的局部稳定性。`,
      checklist: [
        '同时回放诊断主方向与关键时段样本，确认双重修正未互相放大。',
        '检查持续偏高 / 偏低方向是否被有效压缩到目标区间。',
        '先做小范围灰度，再观察最近交易日是否保持改善。',
      ],
    };
  }

  return {
    title: '全局偏差平移草案',
    summary: '对该基金全时段估值施加统一方向修正，优先消除持续偏高 / 偏低误差。',
    focus: `该基金更像系统性偏差，先用统一平移校正主误差，再观察 ${primaryBucket} 是否仍残留异常。`,
    checklist: [
      '回放最近已收敛样本，确认全时段平均误差持续低于基线。',
      '检查修正后是否出现由高估转低估或由低估转高估的反向偏差。',
      '先灰度到单基金，再决定是否推广到同类基金。',
    ],
  };
};

const loadAdjustmentFundDecisions = (): Record<string, AdjustmentFundDecisionItem> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<
      string,
      AdjustmentFundDecisionItem | { status: AdjustmentFundDecisionStatus; updatedAt: string }
    >;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([fundCode, item]) => {
        const normalizedHistory =
          'history' in item && Array.isArray(item.history) && item.history.length > 0
            ? item.history
            : [{ status: item.status, updatedAt: item.updatedAt }];

        return [
          fundCode,
          {
            status: item.status,
            updatedAt: item.updatedAt,
            history: normalizedHistory,
          } satisfies AdjustmentFundDecisionItem,
        ];
      }),
    );
  } catch {
    return {};
  }
};

const saveAdjustmentFundDecisions = (
  decisions: Record<string, AdjustmentFundDecisionItem>,
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
    JSON.stringify(decisions),
  );
  window.dispatchEvent(new CustomEvent(ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT));
};

const getAdjustmentDecisionLabel = (status: AdjustmentFundDecisionStatus): string => {
  switch (status) {
    case 'verification':
      return '加入验证';
    case 'watch':
      return '继续观察';
    case 'dismissed':
      return '暂不处理';
    case 'validated':
      return '已验证通过';
    case 'failed':
      return '验证失败';
    default:
      return status;
  }
};

const getAdjustmentDecisionBadgeClassName = (status: AdjustmentFundDecisionStatus): string => {
  switch (status) {
    case 'verification':
      return 'rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700';
    case 'watch':
      return 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700';
    case 'dismissed':
      return 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600';
    case 'validated':
      return 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700';
    case 'failed':
      return 'rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700';
    default:
      return 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600';
  }
};

const getAdjustmentValidationRecommendationBadgeClassName = (
  status: 'keep' | 'review' | 'downgrade',
): string => {
  if (status === 'keep') {
    return 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700';
  }

  if (status === 'review') {
    return 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700';
  }

  return 'rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700';
};

const getAdjustmentExecutionPriority = (
  status: AdjustmentFundDecisionStatus,
  recommendationStatus: EstimateAccuracyAdjustmentSimulationFundInsight['recommendationStatus'],
): 'P0' | 'P1' | 'P2' => {
  if (status === 'watch') {
    return 'P2';
  }

  if (recommendationStatus === 'priority') {
    return 'P0';
  }

  if (recommendationStatus === 'collect-more') {
    return 'P1';
  }

  return 'P2';
};

const getAdjustmentExecutionPriorityFromValidation = (
  status: 'keep' | 'review' | 'downgrade',
): 'P0' | 'P1' | 'P2' => {
  if (status === 'downgrade') {
    return 'P0';
  }

  if (status === 'review') {
    return 'P1';
  }

  return 'P2';
};

const getAdjustmentExecutionPriorityRank = (priorityLabel: 'P0' | 'P1' | 'P2'): number => {
  if (priorityLabel === 'P0') {
    return 0;
  }

  if (priorityLabel === 'P1') {
    return 1;
  }

  return 2;
};

const getAdjustmentExecutionFilterKey = (input: {
  decisionStatus: AdjustmentFundDecisionStatus;
  validationRecommendationStatus?: 'keep' | 'review' | 'downgrade';
}): Exclude<AdjustmentExecutionFilter, 'all'> => {
  if (
    input.decisionStatus === 'validated' &&
    input.validationRecommendationStatus !== undefined &&
    input.validationRecommendationStatus !== 'keep'
  ) {
    return 'recheck';
  }

  return input.decisionStatus === 'watch' ? 'watch' : 'verification';
};

const getAdjustmentExecutionCompleteLabel = (
  executionFilterKey: Exclude<AdjustmentExecutionFilter, 'all'>,
): string => (executionFilterKey === 'recheck' ? '重新确认通过' : '已验证通过');

const getAdjustmentExecutionFailedLabel = (
  executionFilterKey: Exclude<AdjustmentExecutionFilter, 'all'>,
): string => (executionFilterKey === 'recheck' ? '重新标记失败' : '验证失败');

const buildFundItems = (snapshots: EstimateAccuracySnapshot[]): FundAccuracyItem[] => {
  const grouped = new Map<string, EstimateAccuracySnapshot[]>();

  for (const snapshot of snapshots) {
    const current = grouped.get(snapshot.fundCode) ?? [];
    current.push(snapshot);
    grouped.set(snapshot.fundCode, current);
  }

  return Array.from(grouped.entries())
    .map(([fundCode, fundSnapshots]) => ({
      fundCode,
      fundName: fundSnapshots[0]?.fundName ?? fundCode,
      summary: summarizeEstimateAccuracy(fundSnapshots),
      resolvedSampleCount: fundSnapshots.filter(
        (snapshot) => snapshot.finalNav !== null && snapshot.resolvedAt !== null,
      ).length,
    }))
    .sort((left, right) => {
      const leftError = left.summary.averageAbsoluteErrorRate ?? -1;
      const rightError = right.summary.averageAbsoluteErrorRate ?? -1;

      if (rightError !== leftError) {
        return rightError - leftError;
      }

      return left.fundCode.localeCompare(right.fundCode);
    });
};

const buildOverallSummary = (snapshots: EstimateAccuracySnapshot[]) => {
  const sampleCount = snapshots.length;
  const resolvedSnapshots = snapshots.filter(
    (snapshot) => snapshot.finalNav !== null && snapshot.resolvedAt !== null,
  );
  const computableSnapshots = resolvedSnapshots.filter(
    (snapshot) => snapshot.absoluteErrorRate !== null,
  );
  const totalAbsoluteErrorRate = computableSnapshots.reduce(
    (sum, snapshot) => sum + (snapshot.absoluteErrorRate ?? 0),
    0,
  );

  return {
    sampleCount,
    resolvedSampleCount: resolvedSnapshots.length,
    unresolvedSampleCount: sampleCount - resolvedSnapshots.length,
    averageAbsoluteErrorRate:
      computableSnapshots.length > 0
        ? totalAbsoluteErrorRate / computableSnapshots.length
        : null,
  };
};

const buildErrorDistribution = (
  snapshots: EstimateAccuracySnapshot[],
): ErrorDistributionItem[] => {
  const resolvedComputableSnapshots = snapshots.filter(
    (snapshot) =>
      snapshot.finalNav !== null &&
      snapshot.resolvedAt !== null &&
      snapshot.absoluteErrorRate !== null,
  );

  return ERROR_RATE_BUCKETS.map((bucket) => {
    const count = resolvedComputableSnapshots.filter((snapshot) =>
      bucket.includes(snapshot.absoluteErrorRate ?? 0),
    ).length;

    return {
      label: bucket.label,
      count,
      share:
        resolvedComputableSnapshots.length > 0
          ? count / resolvedComputableSnapshots.length
          : 0,
    };
  });
};

const buildUnresolvedItems = (
  snapshots: EstimateAccuracySnapshot[],
  limit = 5,
): UnresolvedAccuracyItem[] =>
  snapshots
    .filter((snapshot) => snapshot.finalNav === null || snapshot.resolvedAt === null)
    .sort((left, right) => {
      if (right.tradingDate !== left.tradingDate) {
        return right.tradingDate.localeCompare(left.tradingDate);
      }

      if (right.quoteUpdatedAt !== left.quoteUpdatedAt) {
        return right.quoteUpdatedAt.localeCompare(left.quoteUpdatedAt);
      }

      return left.fundCode.localeCompare(right.fundCode);
    })
    .slice(0, limit)
    .map((snapshot) => ({
      id: snapshot.id,
      fundCode: snapshot.fundCode,
      fundName: snapshot.fundName,
      tradingDate: snapshot.tradingDate,
      quoteUpdatedAt: snapshot.quoteUpdatedAt,
    }));

const buildAdjustmentFundDetails = (
  snapshots: EstimateAccuracySnapshot[],
): Map<string, AdjustmentFundDetailItem> => {
  const grouped = new Map<string, EstimateAccuracySnapshot[]>();

  for (const snapshot of snapshots) {
    const current = grouped.get(snapshot.fundCode) ?? [];
    current.push(snapshot);
    grouped.set(snapshot.fundCode, current);
  }

  return new Map(
    Array.from(grouped.entries()).map(([fundCode, fundSnapshots]) => {
      const bucketGroups = new Map<string, EstimateAccuracySnapshot[]>();
      for (const snapshot of fundSnapshots) {
        const bucket = getAdjustmentFundTimeBucket(snapshot.quoteUpdatedAt);
        const current = bucketGroups.get(bucket) ?? [];
        current.push(snapshot);
        bucketGroups.set(bucket, current);
      }

      const buckets = ADJUSTMENT_FUND_TIME_BUCKETS.map((label) => {
        const items = bucketGroups.get(label) ?? [];
        const computableItems = items.filter(
          (snapshot) => snapshot.absoluteErrorRate !== null,
        );

        return {
          label,
          sampleCount: items.length,
          averageAbsoluteErrorRate:
            computableItems.length > 0
              ? computableItems.reduce(
                  (sum, snapshot) => sum + (snapshot.absoluteErrorRate ?? 0),
                  0,
                ) / computableItems.length
              : null,
        } satisfies AdjustmentFundDetailBucketItem;
      }).filter((item) => item.sampleCount > 0);

      const samples = [...fundSnapshots]
        .sort((left, right) => {
          if (right.tradingDate !== left.tradingDate) {
            return right.tradingDate.localeCompare(left.tradingDate);
          }

          if (right.quoteUpdatedAt !== left.quoteUpdatedAt) {
            return right.quoteUpdatedAt.localeCompare(left.quoteUpdatedAt);
          }

          return left.id.localeCompare(right.id);
        })
        .map((snapshot) => ({
          id: snapshot.id,
          tradingDate: snapshot.tradingDate,
          quoteUpdatedAt: snapshot.quoteUpdatedAt,
          estimatedNav: snapshot.estimatedNav,
          finalNav: snapshot.finalNav,
          absoluteErrorRate: snapshot.absoluteErrorRate,
          resolved: snapshot.finalNav !== null && snapshot.resolvedAt !== null,
        }));

      return [fundCode, { buckets, samples } satisfies AdjustmentFundDetailItem];
    }),
  );
};

export function AccuracyDashboard() {
  const [snapshots, setSnapshots] = useState<EstimateAccuracySnapshot[]>([]);
  const [hasLoadedSnapshots, setHasLoadedSnapshots] = useState(false);
  const [adjustmentFundFilter, setAdjustmentFundFilter] = useState<AdjustmentFundFilter>('all');
  const [adjustmentFundSort, setAdjustmentFundSort] = useState<AdjustmentFundSort>('improvement');
  const [adjustmentExecutionFilter, setAdjustmentExecutionFilter] = useState<AdjustmentExecutionFilter>('all');
  const [expandedAdjustmentFundCode, setExpandedAdjustmentFundCode] = useState<string | null>(null);
  const [adjustmentFundDecisions, setAdjustmentFundDecisions] = useState<
    Record<string, AdjustmentFundDecisionItem>
  >({});

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      if (cancelled) {
        return;
      }

      setSnapshots(loadEstimateAccuracySnapshots());
      setAdjustmentFundDecisions(loadAdjustmentFundDecisions());
      setHasLoadedSnapshots(true);
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== ESTIMATE_ACCURACY_STORAGE_KEY &&
        event.key !== ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY
      ) {
        return;
      }

      refresh();
    };

    Promise.resolve().then(refresh);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(ESTIMATE_ACCURACY_UPDATED_EVENT, refresh);
    window.addEventListener(ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT, refresh);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ESTIMATE_ACCURACY_UPDATED_EVENT, refresh);
      window.removeEventListener(ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT, refresh);
    };
  }, []);

  const fundItems = useMemo(() => buildFundItems(snapshots), [snapshots]);
  const overall = useMemo(() => buildOverallSummary(snapshots), [snapshots]);
  const highErrorFunds = useMemo(
    () => fundItems.filter((item) => item.summary.averageAbsoluteErrorRate !== null).slice(0, 5),
    [fundItems],
  );
  const errorDistribution = useMemo(() => buildErrorDistribution(snapshots), [snapshots]);
  const unresolvedItems = useMemo(() => buildUnresolvedItems(snapshots), [snapshots]);
  const abnormalInvestigationItems = useMemo(
    () => buildEstimateAccuracyAbnormalInvestigationItems(snapshots),
    [snapshots],
  );
  const adjustmentFundDetails = useMemo(() => buildAdjustmentFundDetails(snapshots), [snapshots]);
  const diagnostics = useMemo(
    () => summarizeEstimateAccuracyDiagnostics(snapshots, 5),
    [snapshots],
  );
  const timeBuckets = useMemo(() => summarizeEstimateAccuracyTimeBuckets(snapshots), [snapshots]);
  const dailyTrend = useMemo(() => summarizeEstimateAccuracyDailyTrend(snapshots, 5), [snapshots]);
  const recommendations = useMemo(
    () => buildEstimateAccuracyRecommendations(diagnostics, 3),
    [diagnostics],
  );
  const sourceModel = useMemo(
    () => buildEstimateAccuracySourceModel(snapshots, diagnostics),
    [diagnostics, snapshots],
  );
  const sourceStrategy = useMemo(
    () => buildEstimateAccuracyStrategy(sourceModel),
    [sourceModel],
  );
  const adjustmentSimulation = useMemo(
    () => buildEstimateAccuracyAdjustmentSimulation(snapshots, diagnostics),
    [diagnostics, snapshots],
  );
  const adjustmentValidationSummary = useMemo(
    () => buildEstimateAdjustmentValidationSummary(snapshots, adjustmentFundDecisions),
    [adjustmentFundDecisions, snapshots],
  );
  const adjustmentValidationByFundCode = useMemo(
    () =>
      new Map(
        adjustmentValidationSummary.funds.map((item) => [item.fundCode, item] as const),
      ),
    [adjustmentValidationSummary.funds],
  );
  const unresolvedFundCount = useMemo(
    () => new Set(unresolvedItems.map((item) => item.fundCode)).size,
    [unresolvedItems],
  );
  const filteredAdjustmentFundInsights = useMemo(() => {
    const items = adjustmentSimulation.fundInsights.filter((item) =>
      adjustmentFundFilter === 'all' ? true : item.recommendationStatus === adjustmentFundFilter,
    );

    return [...items].sort((left, right) => {
      if (adjustmentFundSort === 'baseline') {
        const baselineDelta =
          (right.baselineAverageAbsoluteErrorRate ?? -1) -
          (left.baselineAverageAbsoluteErrorRate ?? -1);
        if (baselineDelta !== 0) {
          return baselineDelta;
        }

        const improvementDelta =
          (right.bestScenarioImprovementRate ?? -1) - (left.bestScenarioImprovementRate ?? -1);
        if (improvementDelta !== 0) {
          return improvementDelta;
        }

        return left.fundCode.localeCompare(right.fundCode);
      }

      const improvementDelta =
        (right.bestScenarioImprovementRate ?? -1) - (left.bestScenarioImprovementRate ?? -1);
      if (improvementDelta !== 0) {
        return improvementDelta;
      }

      const baselineDelta =
        (right.baselineAverageAbsoluteErrorRate ?? -1) -
        (left.baselineAverageAbsoluteErrorRate ?? -1);
      if (baselineDelta !== 0) {
        return baselineDelta;
      }

      return left.fundCode.localeCompare(right.fundCode);
    });
  }, [adjustmentFundFilter, adjustmentFundSort, adjustmentSimulation.fundInsights]);
  const adjustmentExecutionItems = useMemo(() => {
    return Object.entries(adjustmentFundDecisions)
      .map<AdjustmentFundExecutionItem | null>(([fundCode, decision]) => {
        const insight = adjustmentSimulation.fundInsights.find((item) => item.fundCode === fundCode);
        if (!insight) {
          return null;
        }

        const validationFeedback = adjustmentValidationByFundCode.get(fundCode);
        const shouldReopenValidatedDecision =
          decision.status === 'validated' &&
          validationFeedback !== undefined &&
          validationFeedback.recommendationStatus !== 'keep';

        if (
          decision.status === 'dismissed' ||
          decision.status === 'failed' ||
          (decision.status === 'validated' && !shouldReopenValidatedDecision)
        ) {
          return null;
        }

        const ruleDraft = buildAdjustmentFundRuleDraft(
          insight,
          adjustmentFundDetails.get(fundCode),
        );
        const validationPriorityLabel =
          validationFeedback && shouldReopenValidatedDecision
            ? getAdjustmentExecutionPriorityFromValidation(validationFeedback.recommendationStatus)
            : undefined;

        return {
          fundCode,
          fundName: insight.fundName,
          diagnosis: insight.diagnosis,
          decisionStatus: decision.status,
          executionFilterKey: getAdjustmentExecutionFilterKey({
            decisionStatus: decision.status,
            validationRecommendationStatus: validationFeedback?.recommendationStatus,
          }),
          decisionLabel: getAdjustmentDecisionLabel(decision.status),
          priorityLabel:
            validationPriorityLabel ??
            getAdjustmentExecutionPriority(decision.status, insight.recommendationStatus),
          validationRecommendationStatus: validationFeedback?.recommendationStatus,
          validationRecommendationLabel: validationFeedback?.recommendationLabel,
          validationRecommendationReason: validationFeedback?.recommendationReason,
          updatedAtLabel: formatChinaDateTime(decision.updatedAt),
          updatedAt: decision.updatedAt,
          ruleDraftTitle: ruleDraft.title,
          nextStep:
            validationFeedback && shouldReopenValidatedDecision
              ? validationFeedback.recommendationReason
              : (ruleDraft.checklist[0] ?? '继续观察后续样本变化。'),
        } satisfies AdjustmentFundExecutionItem;
      })
      .filter((item): item is AdjustmentFundExecutionItem => item !== null)
      .sort((left, right) => {
        const priorityDelta =
          getAdjustmentExecutionPriorityRank(left.priorityLabel) -
          getAdjustmentExecutionPriorityRank(right.priorityLabel);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        if (right.updatedAt !== left.updatedAt) {
          return right.updatedAt.localeCompare(left.updatedAt);
        }

        return left.fundCode.localeCompare(right.fundCode);
      });
  }, [
    adjustmentFundDecisions,
    adjustmentFundDetails,
    adjustmentSimulation.fundInsights,
    adjustmentValidationByFundCode,
  ]);
  const filteredAdjustmentExecutionItems = useMemo(
    () =>
      adjustmentExecutionItems.filter((item) =>
        adjustmentExecutionFilter === 'all'
          ? true
          : item.executionFilterKey === adjustmentExecutionFilter,
      ),
    [adjustmentExecutionFilter, adjustmentExecutionItems],
  );
  const adjustmentHistoryItems = useMemo(() => {
    return Object.entries(adjustmentFundDecisions)
      .flatMap(([fundCode, decision]) => {
        const insight = adjustmentSimulation.fundInsights.find((item) => item.fundCode === fundCode);
        if (!insight) {
          return [];
        }

        const ruleDraft = buildAdjustmentFundRuleDraft(
          insight,
          adjustmentFundDetails.get(fundCode),
        );

        return decision.history.map((historyItem) => ({
          fundCode,
          fundName: insight.fundName,
          status: historyItem.status,
          statusLabel: getAdjustmentDecisionLabel(historyItem.status),
          updatedAt: historyItem.updatedAt,
          updatedAtLabel: formatChinaDateTime(historyItem.updatedAt),
          ruleDraftTitle: ruleDraft.title,
        }));
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [adjustmentFundDecisions, adjustmentFundDetails, adjustmentSimulation.fundInsights]);

  const handleAdjustmentDecision = (
    fundCode: string,
    status: AdjustmentFundDecisionStatus,
  ): void => {
    setAdjustmentFundDecisions((current) => {
      const now = new Date().toISOString();
      const next = {
        ...current,
        [fundCode]: {
          status,
          updatedAt: now,
          history: [
            ...(current[fundCode]?.history ?? []),
            {
              status,
              updatedAt: now,
            },
          ],
        },
      };
      saveAdjustmentFundDecisions(next);
      return next;
    });
  };

  const handleOpenAdjustmentExecution = (fundCode: string): void => {
    setAdjustmentExecutionFilter('all');
    setAdjustmentFundFilter('all');
    setExpandedAdjustmentFundCode(fundCode);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-slate-500">SuperFinance</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">估值准确度看板</h1>
        <p className="text-sm text-slate-600">基于本地 estimate accuracy snapshots 汇总各基金估值误差表现。</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article
          data-testid="accuracy-summary-total"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm text-slate-500">总样本</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedSnapshots ? overall.sampleCount : '读取中'}
          </p>
        </article>
        <article
          data-testid="accuracy-summary-resolved"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm text-slate-500">已收敛样本</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedSnapshots ? overall.resolvedSampleCount : '读取中'}
          </p>
        </article>
        <article
          data-testid="accuracy-summary-unresolved"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
        >
          <p className="text-sm text-amber-700">未收敛样本</p>
          <p className="mt-2 text-3xl font-semibold text-amber-950">
            {hasLoadedSnapshots ? overall.unresolvedSampleCount : '读取中'}
          </p>
        </article>
        <article
          data-testid="accuracy-summary-average"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm text-slate-500">平均误差</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedSnapshots ? formatPercent(overall.averageAbsoluteErrorRate) : '读取中'}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">估值可信度分层规则</h2>
          <p className="mt-1 text-sm text-slate-500">
            当前可信度会同时受交易日窗口、已收敛样本量与误差尾部分布约束。
          </p>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-3">
          {CONFIDENCE_RULE_CARDS.map((card) => (
            <article
              key={card.title}
              data-testid="accuracy-confidence-rule-card"
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <h3
                data-testid={card.testId}
                className="text-sm font-semibold text-slate-900"
              >
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          最终等级按三层门槛中的最弱项决定；平均误差仍作为 high/medium 的上限约束。
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">高误差基金</h2>
            <p className="mt-1 text-sm text-slate-500">优先关注平均误差最高的基金，快速定位估值偏差来源。</p>
          </div>

          {!hasLoadedSnapshots ? (
            <div className="px-5 py-10 text-sm text-slate-500">正在读取诊断数据…</div>
          ) : highErrorFunds.length === 0 ? (
            <div className="px-5 py-10 text-sm text-slate-500">暂无可计算误差的已收敛样本</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {highErrorFunds.map((item, index) => (
                <div
                  key={item.fundCode}
                  data-testid="accuracy-high-error-row"
                  className="grid gap-3 px-5 py-4 md:grid-cols-[56px_minmax(0,1fr)_120px]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-700">
                    #{index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{item.fundName}</p>
                    <p className="text-sm text-slate-500">
                      {item.fundCode} · {item.resolvedSampleCount} / {item.summary.sampleCount}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">平均误差</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatPercent(item.summary.averageAbsoluteErrorRate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">误差分布</h2>
            <p className="mt-1 text-sm text-slate-500">观察已收敛且可计算误差样本落在哪些误差区间。</p>
          </div>

          {!hasLoadedSnapshots ? (
            <div className="px-5 py-10 text-sm text-slate-500">正在读取诊断数据…</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {errorDistribution.map((bucket) => (
                <div
                  key={bucket.label}
                  data-testid="accuracy-error-bucket"
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_80px_80px]"
                >
                  <div>
                    <p className="font-medium text-slate-900">{bucket.label}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">样本数</p>
                    <p className="mt-1 font-medium text-slate-900">{bucket.count}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">占比</p>
                    <p className="mt-1 font-medium text-slate-900">{formatShare(bucket.share)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">异常基金排查</h2>
          <p className="mt-1 text-sm text-slate-500">
            合并连续偏差、高误差和未收敛样本，按异常严重度给出排查顺序。
          </p>
        </div>

        {!hasLoadedSnapshots ? (
          <div className="px-5 py-10 text-sm text-slate-500">正在读取异常基金排查数据…</div>
        ) : abnormalInvestigationItems.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-500">暂无需要优先排查的异常基金</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {abnormalInvestigationItems.map((item) => (
              <div
                key={item.fundCode}
                data-testid="accuracy-abnormal-row"
                className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1.1fr)]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{item.fundName}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {item.fundCode}
                    </span>
                    {item.tags.map((tag) => (
                      <span key={tag} className={getAbnormalTagClassName(tag)}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {item.diagnosis} · 最近异常 {item.latestAbnormalDate ?? '暂无'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">平均误差</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatPercent(item.averageAbsoluteErrorRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">样本</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {item.resolvedSampleCount} / +{item.unresolvedSampleCount}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">排查建议</p>
                  <p className="mt-1 text-sm text-slate-600">{item.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">高误差原因拆解</h2>
          <p className="mt-1 text-sm text-slate-500">
            按“持续偏高 / 持续偏低 / 波动偏差”归因，帮助确定优先修复名单。
          </p>
        </div>

        {!hasLoadedSnapshots ? (
          <div className="px-5 py-10 text-sm text-slate-500">正在读取诊断数据…</div>
        ) : diagnostics.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-500">暂无可拆解的误差样本</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {diagnostics.map((item, index) => (
              <div
                key={item.fundCode}
                data-testid="accuracy-diagnostic-row"
                className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.4fr)_120px_120px_140px]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{item.fundName}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {item.diagnosis}
                    </span>
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
                      {getPriorityLabel(index)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.fundCode} · 可计算 {item.computableSampleCount} / {item.sampleCount}
                    {item.worstTradingDate ? ` · 最大偏差日 ${item.worstTradingDate}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">平均绝对误差</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {formatPercent(item.averageAbsoluteErrorRate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">平均有符号误差</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {formatSignedPercent(item.averageSignedErrorRate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">偏高 / 偏低</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {item.overestimatedCount} / {item.underestimatedCount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">时间段误差拆解</h2>
            <p className="mt-1 text-sm text-slate-500">
              观察误差是否集中在上午、午后、尾盘或收盘后。
            </p>
          </div>

          {!hasLoadedSnapshots ? (
            <div className="px-5 py-10 text-sm text-slate-500">正在读取诊断数据…</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {timeBuckets.map((item) => (
                <div
                  key={item.label}
                  data-testid="accuracy-time-bucket-row"
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_80px_120px]"
                >
                  <div>
                    <p className="font-medium text-slate-900">{item.label}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">样本数</p>
                    <p className="mt-1 font-medium text-slate-900">{item.sampleCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">平均误差</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatPercent(item.averageAbsoluteErrorRate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">最近交易日趋势</h2>
            <p className="mt-1 text-sm text-slate-500">看误差是否在最近几个交易日持续扩大。</p>
          </div>

          {!hasLoadedSnapshots ? (
            <div className="px-5 py-10 text-sm text-slate-500">正在读取诊断数据…</div>
          ) : dailyTrend.length === 0 ? (
            <div className="px-5 py-10 text-sm text-slate-500">暂无可用趋势样本</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {dailyTrend.map((item) => (
                <div
                  key={item.tradingDate}
                  data-testid="accuracy-trend-row"
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_80px_80px_120px]"
                >
                  <div>
                    <p className="font-medium text-slate-900">{item.tradingDate}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">样本</p>
                    <p className="mt-1 font-medium text-slate-900">{item.sampleCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">基金数</p>
                    <p className="mt-1 font-medium text-slate-900">{item.impactedFundCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">平均误差</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatPercent(item.averageAbsoluteErrorRate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">优先修复名单</h2>
          <p className="mt-1 text-sm text-slate-500">把高误差基金转换成可执行的排查动作。</p>
        </div>

        {!hasLoadedSnapshots ? (
          <div className="px-5 py-10 text-sm text-slate-500">正在读取诊断数据…</div>
        ) : recommendations.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-500">暂无修复建议</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {recommendations.map((item) => (
              <div
                key={item.fundCode}
                data-testid="accuracy-recommendation-row"
                className="grid gap-2 px-5 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{item.fundName}</p>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {item.fundCode}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                <p className="text-sm text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">误差来源模型</h2>
            <p className="mt-1 text-sm text-slate-500">自动识别主导偏差类型、最高风险时段和收敛压力。</p>
          </div>

          {!hasLoadedSnapshots ? (
            <div className="px-5 py-10 text-sm text-slate-500">正在读取诊断数据…</div>
          ) : (
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <article
                data-testid="accuracy-source-model-card"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">主导偏差类型</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {sourceModel.dominantDiagnosis.label}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  涉及 {sourceModel.dominantDiagnosis.affectedFundCount} 只基金
                </p>
              </article>
              <article
                data-testid="accuracy-source-model-card"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">最高风险时段</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {sourceModel.riskiestTimeBucket.label}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatPercent(sourceModel.riskiestTimeBucket.averageAbsoluteErrorRate)}
                </p>
              </article>
              <article
                data-testid="accuracy-source-model-card"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">最高风险交易日</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {sourceModel.riskiestTradingDate.tradingDate}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatPercent(sourceModel.riskiestTradingDate.averageAbsoluteErrorRate)}
                </p>
              </article>
              <article
                data-testid="accuracy-source-model-card"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">收敛压力</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatShare(sourceModel.unresolvedPressure.unresolvedRatio)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  未收敛 {sourceModel.unresolvedPressure.unresolvedSampleCount} 条
                </p>
              </article>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">估值修正策略</h2>
            <p className="mt-1 text-sm text-slate-500">把来源模型转成一组更聚焦的修复顺序。</p>
          </div>

          {!hasLoadedSnapshots ? (
            <div className="px-5 py-10 text-sm text-slate-500">正在读取诊断数据…</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {sourceStrategy.map((item) => (
                <div key={item.title} data-testid="accuracy-strategy-row" className="grid gap-2 px-5 py-4">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">修正前后对比</h2>
          <p className="mt-1 text-sm text-slate-500">
            用当前样本做离线修正模拟，先比较全局偏差、尾盘链路和诊断联动三种方案。
          </p>
        </div>

        {!hasLoadedSnapshots ? (
          <div className="px-5 py-10 text-sm text-slate-500">正在模拟修正实验…</div>
        ) : (
          <div className="grid gap-5 px-5 py-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article
                data-testid="accuracy-adjustment-summary-card"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">修正前平均误差</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatPercent(adjustmentSimulation.baselineAverageAbsoluteErrorRate)}
                </p>
                <p className="mt-1 text-sm text-slate-500">当前可计算样本的平均绝对误差</p>
              </article>
              <article
                data-testid="accuracy-adjustment-summary-card"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">最佳实验方案</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {adjustmentSimulation.bestScenarioLabel ?? '样本不足'}
                </p>
                <p className="mt-1 text-sm text-slate-500">当前样本下修正后误差最低的方案</p>
              </article>
              <article
                data-testid="accuracy-adjustment-summary-card"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
              >
                <p className="text-sm text-emerald-700">修正后平均误差</p>
                <p className="mt-2 text-lg font-semibold text-emerald-950">
                  {formatPercent(adjustmentSimulation.bestScenarioAdjustedAverageAbsoluteErrorRate)}
                </p>
                <p className="mt-1 text-sm text-emerald-700">取最优方案的修正后平均绝对误差</p>
              </article>
              <article
                data-testid="accuracy-adjustment-summary-card"
                className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
              >
                <p className="text-sm text-blue-700">相对改善</p>
                <p className="mt-2 text-lg font-semibold text-blue-950">
                  {adjustmentSimulation.bestScenarioImprovementRate === null
                    ? '样本不足'
                    : formatShare(adjustmentSimulation.bestScenarioImprovementRate)}
                </p>
                <p className="mt-1 text-sm text-blue-700">基于平均绝对误差下降幅度</p>
              </article>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <article className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="font-semibold text-slate-900">方案实验</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    比较全局修正、尾盘修正和诊断联动修正三种模拟结果。
                  </p>
                </div>
                <div className="divide-y divide-slate-200">
                  {adjustmentSimulation.scenarios.map((item) => (
                    <div
                      key={item.key}
                      data-testid="accuracy-adjustment-row"
                      className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.5fr)_110px_110px_110px]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{item.label}</p>
                          {item.key === adjustmentSimulation.bestScenarioKey ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              最优
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">修正后误差</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {formatPercent(item.adjustedAverageAbsoluteErrorRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">改善</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {item.improvementRate === null ? '样本不足' : formatShare(item.improvementRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">影响样本</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {item.adjustedSampleCount} / {item.sampleCount}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="font-semibold text-slate-900">时段修正机会</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    按时段观察哪种修正方案收益最高，判断误差更偏系统性还是尾盘链路问题。
                  </p>
                </div>
                <div className="divide-y divide-slate-200">
                  {adjustmentSimulation.bucketInsights.map((item) => (
                    <div
                      key={item.label}
                      data-testid="accuracy-adjustment-bucket-row"
                      className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_90px_120px_110px_90px]"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{item.label}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          最优方案：{item.bestScenarioLabel ?? '暂无样本'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">样本</p>
                        <p className="mt-1 font-medium text-slate-900">{item.sampleCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">修正前</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {formatPercent(item.baselineAverageAbsoluteErrorRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">修正后</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {formatPercent(item.bestScenarioAdjustedAverageAbsoluteErrorRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">改善</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {item.bestScenarioImprovementRate === null
                            ? '样本不足'
                            : formatShare(item.bestScenarioImprovementRate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="font-semibold text-slate-900">诊断类型修正机会</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    观察持续偏高、持续偏低、波动偏差、样本不足四类问题，各自最适合哪种修正策略。
                  </p>
                </div>
                <div className="divide-y divide-slate-200">
                  {adjustmentSimulation.diagnosisInsights.map((item) => (
                    <div
                      key={item.diagnosis}
                      data-testid="accuracy-adjustment-diagnosis-row"
                      className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.1fr)_90px_120px_110px_90px]"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{item.diagnosis}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          最优方案：{item.bestScenarioLabel ?? '样本不足'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">样本</p>
                        <p className="mt-1 font-medium text-slate-900">{item.sampleCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">修正前</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {formatPercent(item.baselineAverageAbsoluteErrorRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">修正后</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {formatPercent(item.bestScenarioAdjustedAverageAbsoluteErrorRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">改善</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {item.bestScenarioImprovementRate === null
                            ? '样本不足'
                            : formatShare(item.bestScenarioImprovementRate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <article className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">基金级修正候选名单</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      按每只基金的模拟改善幅度排序，优先验证收益更明确的基金级修正路径。
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">状态</span>
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-filter-all"
                        className={getToggleButtonClassName(adjustmentFundFilter === 'all')}
                        onClick={() => setAdjustmentFundFilter('all')}
                      >
                        全部
                      </button>
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-filter-priority"
                        className={getToggleButtonClassName(adjustmentFundFilter === 'priority')}
                        onClick={() => setAdjustmentFundFilter('priority')}
                      >
                        优先验证
                      </button>
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-filter-collect-more"
                        className={getToggleButtonClassName(adjustmentFundFilter === 'collect-more')}
                        onClick={() => setAdjustmentFundFilter('collect-more')}
                      >
                        继续收集样本
                      </button>
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-filter-not-recommended"
                        className={getToggleButtonClassName(adjustmentFundFilter === 'not-recommended')}
                        onClick={() => setAdjustmentFundFilter('not-recommended')}
                      >
                        暂不建议修正
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">排序</span>
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-sort-improvement"
                        className={getToggleButtonClassName(adjustmentFundSort === 'improvement')}
                        onClick={() => setAdjustmentFundSort('improvement')}
                      >
                        按改善幅度
                      </button>
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-sort-baseline"
                        className={getToggleButtonClassName(adjustmentFundSort === 'baseline')}
                        onClick={() => setAdjustmentFundSort('baseline')}
                      >
                        按基线误差
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {adjustmentSimulation.fundInsights.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">暂无可计算的基金级候选</div>
              ) : filteredAdjustmentFundInsights.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">暂无符合条件的基金级候选</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredAdjustmentFundInsights.map((item) => {
                    const fundDetail = adjustmentFundDetails.get(item.fundCode);
                    const ruleDraft = buildAdjustmentFundRuleDraft(item, fundDetail);

                    return (
                    <div key={item.fundCode}>
                      <div
                        data-testid="accuracy-adjustment-fund-row"
                        className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.4fr)_120px_120px_110px_90px]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-900">{item.fundName}</p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {item.fundCode}
                            </span>
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                              {item.diagnosis}
                            </span>
                            <span
                              className={
                                item.recommendationStatus === 'priority'
                                  ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700'
                                  : item.recommendationStatus === 'collect-more'
                                    ? 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700'
                                    : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600'
                              }
                            >
                              {item.recommendationLabel}
                            </span>
                            {adjustmentFundDecisions[item.fundCode] ? (
                              <span
                                className={getAdjustmentDecisionBadgeClassName(
                                  adjustmentFundDecisions[item.fundCode].status,
                                )}
                              >
                                {getAdjustmentDecisionLabel(
                                  adjustmentFundDecisions[item.fundCode].status,
                                )}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            最优方案：{item.bestScenarioLabel ?? '样本不足'} · 样本 {item.sampleCount}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{item.recommendationReason}</p>
                          <button
                            type="button"
                            data-testid={`accuracy-adjustment-fund-toggle-${item.fundCode}`}
                            className="mt-3 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                            onClick={() =>
                              setExpandedAdjustmentFundCode((current) =>
                                current === item.fundCode ? null : item.fundCode,
                              )
                            }
                          >
                            {expandedAdjustmentFundCode === item.fundCode ? '收起明细' : '查看明细'}
                          </button>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">修正前</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {formatPercent(item.baselineAverageAbsoluteErrorRate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">修正后</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {formatPercent(item.bestScenarioAdjustedAverageAbsoluteErrorRate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">改善</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {item.bestScenarioImprovementRate === null
                              ? '样本不足'
                              : formatShare(item.bestScenarioImprovementRate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">样本</p>
                          <p className="mt-1 font-medium text-slate-900">{item.sampleCount}</p>
                        </div>
                      </div>

                      {expandedAdjustmentFundCode === item.fundCode ? (
                        <div
                          data-testid={`accuracy-adjustment-fund-detail-${item.fundCode}`}
                          className="border-t border-slate-100 bg-slate-50 px-4 py-4"
                        >
                          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-sm font-medium text-slate-900">建议依据</p>
                                <div className="mt-3 space-y-2 text-sm text-slate-600">
                                  <p>建议动作：{item.recommendationLabel}</p>
                                  <p>诊断类型：{item.diagnosis}</p>
                                  <p>最优方案：{item.bestScenarioLabel ?? '样本不足'}</p>
                                  <p>建议原因：{item.recommendationReason}</p>
                                </div>
                              </div>

                              <div
                                data-testid={`accuracy-adjustment-fund-draft-${item.fundCode}`}
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                              >
                                <p className="text-sm font-medium text-slate-900">修正规则草案</p>
                                <p className="mt-3 text-sm font-medium text-slate-900">
                                  {ruleDraft.title}
                                </p>
                                <div className="mt-2 space-y-2 text-sm text-slate-600">
                                  <p>{ruleDraft.summary}</p>
                                  <p>{ruleDraft.focus}</p>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    data-testid={`accuracy-adjustment-decision-verification-${item.fundCode}`}
                                    className={getDecisionButtonClassName(
                                      adjustmentFundDecisions[item.fundCode]?.status === 'verification',
                                    )}
                                    onClick={() =>
                                      handleAdjustmentDecision(item.fundCode, 'verification')
                                    }
                                  >
                                    加入验证
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`accuracy-adjustment-decision-watch-${item.fundCode}`}
                                    className={getDecisionButtonClassName(
                                      adjustmentFundDecisions[item.fundCode]?.status === 'watch',
                                    )}
                                    onClick={() => handleAdjustmentDecision(item.fundCode, 'watch')}
                                  >
                                    继续观察
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`accuracy-adjustment-decision-dismissed-${item.fundCode}`}
                                    className={getDecisionButtonClassName(
                                      adjustmentFundDecisions[item.fundCode]?.status === 'dismissed',
                                    )}
                                    onClick={() =>
                                      handleAdjustmentDecision(item.fundCode, 'dismissed')
                                    }
                                  >
                                    暂不处理
                                  </button>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-sm font-medium text-slate-900">时段分布</p>
                                <div className="mt-3 space-y-2">
                                  {(fundDetail?.buckets ?? []).map((bucket) => (
                                    <div
                                      key={bucket.label}
                                      data-testid={`accuracy-adjustment-fund-bucket-row-${item.fundCode}`}
                                      className="grid grid-cols-[minmax(0,1fr)_72px_88px] gap-3 text-sm"
                                    >
                                      <p className="text-slate-700">{bucket.label}</p>
                                      <p className="text-slate-500">{bucket.sampleCount} 条</p>
                                      <p className="text-right font-medium text-slate-900">
                                        {formatPercent(bucket.averageAbsoluteErrorRate)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-sm font-medium text-slate-900">上线前验证清单</p>
                                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                                  {ruleDraft.checklist.map((entry) => (
                                    <li
                                      key={entry}
                                      data-testid={`accuracy-adjustment-fund-checklist-item-${item.fundCode}`}
                                      className="flex gap-2"
                                    >
                                      <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                                      <span>{entry}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-sm font-medium text-slate-900">样本明细</p>
                              <div className="mt-3 space-y-3">
                                {(fundDetail?.samples ?? []).map((sample) => (
                                  <div
                                    key={sample.id}
                                    data-testid={`accuracy-adjustment-fund-sample-row-${item.fundCode}`}
                                    className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-slate-900">
                                        {sample.tradingDate}
                                      </p>
                                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                                        {sample.quoteUpdatedAt}
                                      </span>
                                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                                        {getAdjustmentFundTimeBucket(sample.quoteUpdatedAt)}
                                      </span>
                                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                                        {sample.resolved ? '已收敛' : '未收敛'}
                                      </span>
                                    </div>
                                    <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                                      <p>估值 {formatNavValue(sample.estimatedNav)}</p>
                                      <p>净值 {formatNavValue(sample.finalNav)}</p>
                                      <p>误差 {formatPercent(sample.absoluteErrorRate)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">基金级修正待执行列表</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      汇总已手动确认进入验证/观察，或被回写验证重新拉回复核的基金。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">状态</span>
                    <button
                      type="button"
                      data-testid="accuracy-adjustment-execution-filter-all"
                      className={getToggleButtonClassName(adjustmentExecutionFilter === 'all')}
                      onClick={() => setAdjustmentExecutionFilter('all')}
                    >
                      全部
                    </button>
                    <button
                      type="button"
                      data-testid="accuracy-adjustment-execution-filter-verification"
                      className={getToggleButtonClassName(
                        adjustmentExecutionFilter === 'verification',
                      )}
                      onClick={() => setAdjustmentExecutionFilter('verification')}
                    >
                      加入验证
                    </button>
                    <button
                      type="button"
                      data-testid="accuracy-adjustment-execution-filter-watch"
                      className={getToggleButtonClassName(adjustmentExecutionFilter === 'watch')}
                      onClick={() => setAdjustmentExecutionFilter('watch')}
                    >
                      继续观察
                    </button>
                    <button
                      type="button"
                      data-testid="accuracy-adjustment-execution-filter-recheck"
                      className={getToggleButtonClassName(adjustmentExecutionFilter === 'recheck')}
                      onClick={() => setAdjustmentExecutionFilter('recheck')}
                    >
                      回写复核
                    </button>
                  </div>
                </div>
              </div>
              {adjustmentExecutionItems.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">暂无已确认的基金级待执行项</div>
              ) : filteredAdjustmentExecutionItems.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">暂无符合条件的待执行项</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredAdjustmentExecutionItems.map((item) => (
                    <div
                      key={item.fundCode}
                      data-testid="accuracy-adjustment-decision-row"
                      className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_90px_150px_minmax(0,1fr)_100px]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{item.fundName}</p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {item.fundCode}
                          </span>
                          <span className={getAdjustmentDecisionBadgeClassName(item.decisionStatus)}>
                            {item.decisionLabel}
                          </span>
                          {item.validationRecommendationStatus ? (
                            <span
                              className={getAdjustmentValidationRecommendationBadgeClassName(
                                item.validationRecommendationStatus,
                              )}
                            >
                              {item.validationRecommendationLabel}
                            </span>
                          ) : null}
                          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
                            {item.priorityLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.diagnosis} · {item.ruleDraftTitle}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">优先级</p>
                        <p className="mt-1 font-medium text-slate-900">{item.priorityLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">最近决策</p>
                        <p className="mt-1 font-medium text-slate-900">{item.updatedAtLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">下一步</p>
                        <p className="mt-1 font-medium text-slate-900">{item.decisionLabel}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-400">执行建议</p>
                        <p className="mt-1 text-sm text-slate-600">{item.nextStep}</p>
                      </div>
                      <div className="flex items-start justify-start lg:justify-end">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            data-testid={`accuracy-adjustment-execution-complete-${item.fundCode}`}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:border-emerald-300"
                            onClick={() => handleAdjustmentDecision(item.fundCode, 'validated')}
                          >
                            {getAdjustmentExecutionCompleteLabel(item.executionFilterKey)}
                          </button>
                          <button
                            type="button"
                            data-testid={`accuracy-adjustment-execution-failed-${item.fundCode}`}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
                            onClick={() => handleAdjustmentDecision(item.fundCode, 'failed')}
                          >
                            {getAdjustmentExecutionFailedLabel(item.executionFilterKey)}
                          </button>
                          <button
                            type="button"
                            data-testid={`accuracy-adjustment-execution-watch-${item.fundCode}`}
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:border-amber-300"
                            onClick={() => handleAdjustmentDecision(item.fundCode, 'watch')}
                          >
                            回退观察
                          </button>
                          <button
                            type="button"
                            data-testid={`accuracy-adjustment-execution-open-${item.fundCode}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                            onClick={() => handleOpenAdjustmentExecution(item.fundCode)}
                          >
                            查看基金明细
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="font-semibold text-slate-900">历史决策记录</h3>
                <p className="mt-1 text-sm text-slate-500">
                  保留基金级修正动作的时间线，方便回看验证通过、失败与回退记录。
                </p>
              </div>
              {adjustmentHistoryItems.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">暂无历史决策记录</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {adjustmentHistoryItems.map((item, index) => (
                    <div
                      key={`${item.fundCode}-${item.updatedAt}-${index}`}
                      data-testid="accuracy-adjustment-history-row"
                      className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.4fr)_160px_160px]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{item.fundName}</p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {item.fundCode}
                          </span>
                          <span className={getAdjustmentDecisionBadgeClassName(item.status)}>
                            {item.statusLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{item.ruleDraftTitle}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">动作状态</p>
                        <p className="mt-1 font-medium text-slate-900">{item.statusLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">记录时间</p>
                        <p className="mt-1 font-medium text-slate-900">{item.updatedAtLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-medium text-slate-900">当前模拟结论</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-500">
                <li>优先先做能稳定降低平均误差的方案验证，再继续拆分基金级规则。</li>
                <li>如果尾盘专用修正收益最高，说明实时估值准确度的核心瓶颈更可能在盘末链路。</li>
                <li>若诊断联动收益继续领先，再进入基金分组和更细颗粒度修正规则。</li>
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">未收敛样本诊断</h2>
          <p className="mt-1 text-sm text-slate-500">
            {hasLoadedSnapshots
              ? `${overall.unresolvedSampleCount} 条未收敛样本，涉及 ${unresolvedFundCount} 只基金。`
              : '用于识别哪些基金还没有拿到最终净值。'}
          </p>
        </div>

        {!hasLoadedSnapshots ? (
          <div className="px-5 py-10 text-sm text-slate-500">正在读取本地准确度样本…</div>
        ) : unresolvedItems.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-500">暂无未收敛样本</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {unresolvedItems.map((item) => (
              <div
                key={item.id}
                data-testid="accuracy-unresolved-row"
                className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)] md:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{item.fundName}</p>
                  <p className="text-sm text-slate-500">{item.fundCode}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">交易日</p>
                  <p className="mt-1 font-medium text-slate-900">{item.tradingDate}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">估值时间</p>
                  <p className="mt-1 font-medium text-slate-900">{item.quoteUpdatedAt}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">修正效果回写验证</h2>
          <p className="mt-1 text-sm text-slate-500">
            仅统计当前已验证通过的基金，持续比较修正后误差是否真的优于原始误差。
          </p>
        </div>

        {!hasLoadedSnapshots ? (
          <div className="px-5 py-10 text-sm text-slate-500">正在汇总修正回写验证…</div>
        ) : adjustmentValidationSummary.sampleCount === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-500">
            暂无已验证通过且可回写验证的收敛样本
          </div>
        ) : (
          <div className="grid gap-5 px-5 py-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article
                data-testid="accuracy-adjustment-validation-summary-card"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">已验证基金</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {adjustmentValidationSummary.validatedFundCount}
                </p>
                <p className="mt-1 text-sm text-slate-500">当前仍处于 validated 状态的基金数</p>
              </article>
              <article
                data-testid="accuracy-adjustment-validation-summary-card"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">回写样本</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {adjustmentValidationSummary.sampleCount}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  改善 {adjustmentValidationSummary.improvedSampleCount} · 恶化{' '}
                  {adjustmentValidationSummary.worsenedSampleCount}
                </p>
              </article>
              <article
                data-testid="accuracy-adjustment-validation-summary-card"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">修正前 / 后</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {`${formatPercent(
                    adjustmentValidationSummary.baselineAverageAbsoluteErrorRate,
                  )} → ${formatPercent(
                    adjustmentValidationSummary.adjustedAverageAbsoluteErrorRate,
                  )}`}
                </p>
                <p className="mt-1 text-sm text-slate-500">按 validated 基金的回写样本重新计算</p>
              </article>
              <article
                data-testid="accuracy-adjustment-validation-summary-card"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
              >
                <p className="text-sm text-emerald-700">净改善</p>
                <p className="mt-2 text-lg font-semibold text-emerald-950">
                  {adjustmentValidationSummary.improvementRate === null
                    ? '样本不足'
                    : formatShare(adjustmentValidationSummary.improvementRate)}
                </p>
                <p className="mt-1 text-sm text-emerald-700">以平均绝对误差变化衡量</p>
              </article>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="font-semibold text-slate-900">基金级回写验证结果</h3>
                <p className="mt-1 text-sm text-slate-500">
                  优先关注改善幅度持续为正的基金，若出现恶化样本需重新审视规则。
                </p>
              </div>
              <div className="divide-y divide-slate-200">
                {adjustmentValidationSummary.funds.map((item) => (
                  <div
                    key={item.fundCode}
                    data-testid="accuracy-adjustment-validation-fund-row"
                    className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.5fr)_100px_110px_110px_90px_90px]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{item.fundName}</p>
                        <span
                          className={getAdjustmentValidationRecommendationBadgeClassName(
                            item.recommendationStatus,
                          )}
                        >
                          {item.recommendationLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{item.fundCode}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.recommendationReason}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">改善样本</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {item.improvedSampleCount} / {item.sampleCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">修正前</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatPercent(item.baselineAverageAbsoluteErrorRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">修正后</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatPercent(item.adjustedAverageAbsoluteErrorRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">改善</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {item.improvementRate === null ? '样本不足' : formatShare(item.improvementRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">恶化</p>
                      <p className="mt-1 font-medium text-slate-900">{item.worsenedSampleCount}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">按基金汇总</h2>
          <p className="mt-1 text-sm text-slate-500">按平均误差从高到低排序，便于优先排查偏差更大的基金。</p>
        </div>

        {!hasLoadedSnapshots ? (
          <div className="px-5 py-10 text-sm text-slate-500">正在读取本地准确度样本…</div>
        ) : fundItems.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-500">暂无估值准确度样本</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {fundItems.map((item) => (
              <div
                key={item.fundCode}
                data-testid="accuracy-fund-row"
                className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.5fr)_140px_140px] md:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{item.fundName}</p>
                  <p className="text-sm text-slate-500">{item.fundCode}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">已收敛 / 总样本</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {item.resolvedSampleCount} / {item.summary.sampleCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">平均误差</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {formatPercent(item.summary.averageAbsoluteErrorRate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
