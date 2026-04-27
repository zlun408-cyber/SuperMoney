'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { AccuracyImportDialog } from '@/components/accuracy/accuracy-import-dialog';
import { IntradayAnalyticsDebugPanel } from '@/components/accuracy/intraday-analytics-debug-panel';
import {
  downloadAccuracyCsvExportZip,
  downloadAccuracyJsonExport,
} from '@/lib/accuracy/export-download';
import type { AccuracyImportSummary } from '@/lib/accuracy/import';
import { useAuthSession } from '@/lib/auth/auth-context';
import {
  buildEstimateAccuracyAdjustmentSimulation,
  type EstimateAccuracyAdjustmentSimulationFundInsight,
} from '@/lib/funds/estimate-accuracy-adjustment';
import {
  buildEstimateAccuracyAbnormalInvestigationItems,
  type EstimateAccuracyAbnormalTag,
} from '@/lib/funds/estimate-accuracy-abnormal-investigation';
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
} from '@/lib/storage/estimate-accuracy-storage';
import {
  ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
  ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT,
  normalizeEstimateAdjustmentDecisionItem,
} from '@/lib/storage/estimate-adjustment-storage';

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
  if (value === null || isNaN(value)) {
    return '样本不足';
  }

  return `${(value * 100).toFixed(2)}%`;
};

const formatShare = (value: number): string => `${(value * 100).toFixed(0)}%`;

const formatSignedPercent = (value: number | null): string => {
  if (value === null || isNaN(value)) {
    return '倾向不明';
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

const normalizeAdjustmentFundDecisions = (
  decisions: Record<string, unknown>,
): Record<string, AdjustmentFundDecisionItem> =>
  Object.entries(decisions).reduce<Record<string, AdjustmentFundDecisionItem>>(
    (accumulator, [fundCode, decision]) => {
      const normalized = normalizeEstimateAdjustmentDecisionItem(decision);
      if (normalized) {
        accumulator[fundCode] = normalized;
      }

      return accumulator;
    },
    {},
  );

export function AccuracyDashboard() {
  const { accuracyStore, isAuthenticated, userId } = useAuthSession();
  const [snapshots, setSnapshots] = useState<EstimateAccuracySnapshot[]>([]);
  const [hasLoadedSnapshots, setHasLoadedSnapshots] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [syncError] = useState<string | null>(null);
  const [adjustmentFundFilter, setAdjustmentFundFilter] = useState<AdjustmentFundFilter>('all');
  const [adjustmentFundSort, setAdjustmentFundSort] = useState<AdjustmentFundSort>('improvement');
  const [adjustmentExecutionFilter, setAdjustmentExecutionFilter] = useState<AdjustmentExecutionFilter>('all');
  const [expandedAdjustmentFundCode, setExpandedAdjustmentFundCode] = useState<string | null>(null);
  const [exportFundCodesText, setExportFundCodesText] = useState('');
  const [exportStartTradingDate, setExportStartTradingDate] = useState('');
  const [exportEndTradingDate, setExportEndTradingDate] = useState('');
  const [adjustmentFundDecisions, setAdjustmentFundDecisions] = useState<
    Record<string, AdjustmentFundDecisionItem>
  >({});

  const refresh = useCallback(() => {
    setSnapshots(accuracyStore.loadSnapshots());
    setAdjustmentFundDecisions(
      normalizeAdjustmentFundDecisions(
        accuracyStore.loadAdjustmentDecisions() as Record<string, unknown>,
      ),
    );
    setHasLoadedSnapshots(true);
  }, [accuracyStore]);

  useEffect(() => {
    let cancelled = false;

    const handleRefresh = () => {
      if (cancelled) {
        return;
      }
      refresh();
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== ESTIMATE_ACCURACY_STORAGE_KEY &&
        event.key !== ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY
      ) {
        return;
      }

      handleRefresh();
    };

    Promise.resolve().then(handleRefresh);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(ESTIMATE_ACCURACY_UPDATED_EVENT, handleRefresh);
    window.addEventListener(ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT, handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ESTIMATE_ACCURACY_UPDATED_EVENT, handleRefresh);
      window.removeEventListener(ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT, handleRefresh);
    };
  }, [refresh]);

  const handleImportSuccess = (summary: AccuracyImportSummary) => {
    refresh();
    setImportSuccessMessage(
      `导入成功：新增 ${summary.snapshots.new} 条样本，${summary.decisions.new} 条决策。系统已自动合并数据。`,
    );
    setTimeout(() => setImportSuccessMessage(null), 5000);
  };

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
  const timeBuckets = useMemo(() => summarizeEstimateAccuracyTimeBuckets(snapshots), [snapshots]);
  const dailyTrend = useMemo(() => summarizeEstimateAccuracyDailyTrend(snapshots, 5), [snapshots]);

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
      accuracyStore.saveAdjustmentDecisions(next);
      return next;
    });
  };

  const handleOpenAdjustmentExecution = (fundCode: string): void => {
    setAdjustmentExecutionFilter('all');
    setAdjustmentFundFilter('all');
    setExpandedAdjustmentFundCode(fundCode);
  };

  const buildExportFilterOptions = () => {
    const fundCodes = exportFundCodesText
      .split(',')
      .map((fundCode) => fundCode.trim())
      .filter((fundCode) => fundCode.length > 0);

    return {
      fundCodes: fundCodes.length > 0 ? fundCodes : null,
      startTradingDate: exportStartTradingDate || null,
      endTradingDate: exportEndTradingDate || null,
    };
  };

  const handleExportJson = (): void => {
    downloadAccuracyJsonExport({
      snapshots,
      decisions: adjustmentFundDecisions,
      ...buildExportFilterOptions(),
      source: {
        mode: isAuthenticated ? 'cloud' : 'local',
        userId,
      },
    });
  };

  const handleExportCsv = (): void => {
    downloadAccuracyCsvExportZip({
      snapshots,
      decisions: adjustmentFundDecisions,
      ...buildExportFilterOptions(),
      source: {
        mode: isAuthenticated ? 'cloud' : 'local',
        userId,
      },
    });
  };

  const getAdjustmentFundDetail = (fundCode: string): AdjustmentFundDetailItem | undefined =>
    adjustmentFundDetails.get(fundCode);

  if (!hasLoadedSnapshots) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-500">SuperFinance</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">估值准确度看板</h1>
            <p className="max-w-md text-sm font-medium text-slate-500">正在读取本地准确度样本…</p>
          </div>
        </header>
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
           <article data-testid="accuracy-summary-total" className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">总样本</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">读取中</p>
           </article>
           <article data-testid="accuracy-summary-resolved" className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">已收敛样本</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">读取中</p>
           </article>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      {importSuccessMessage && (
        <div data-testid="accuracy-import-success-toast" className="fixed top-6 left-1/2 z-[60] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-600 px-6 py-3 text-white shadow-2xl">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-bold">{importSuccessMessage}</p>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-500">SuperFinance</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">估值准确度看板</h1>
          <p className="max-w-md text-sm font-medium text-slate-500">
            基于本地 estimate accuracy snapshots 汇总各基金估值误差表现。
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <button
              data-testid="accuracy-import-json-trigger"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={() => setIsImportDialogOpen(true)}
              type="button"
            >
              导入 JSON
            </button>
            <button
              data-testid="accuracy-export-json"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasLoadedSnapshots}
              onClick={handleExportJson}
              type="button"
            >
              导出 JSON
            </button>
            <button
              data-testid="accuracy-export-csv"
              className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasLoadedSnapshots}
              onClick={handleExportCsv}
              type="button"
            >
              导出 CSV
            </button>
          </div>

          <div className="grid gap-2 grid-cols-3 w-full md:w-auto">
             <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-400 uppercase">
                基金代码
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
                  data-testid="accuracy-export-fund-codes"
                  onChange={(event) => setExportFundCodesText(event.target.value)}
                  placeholder="000001,000002"
                  value={exportFundCodesText}
                />
             </label>
             <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-400 uppercase">
                起始交易日
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
                  data-testid="accuracy-export-start-date"
                  onChange={(event) => setExportStartTradingDate(event.target.value)}
                  type="date"
                  value={exportStartTradingDate}
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-400 uppercase">
                结束交易日
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
                  data-testid="accuracy-export-end-date"
                  onChange={(event) => setExportEndTradingDate(event.target.value)}
                  type="date"
                  value={exportEndTradingDate}
                />
              </label>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <article
          data-testid="accuracy-summary-total"
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 transition hover:border-slate-300"
        >
          <p className="text-sm text-slate-500">总样本</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedSnapshots ? overall.sampleCount : '读取中'}
          </p>
        </article>
        <article
          data-testid="accuracy-summary-resolved"
          className="rounded-3xl border border-emerald-100 bg-emerald-50/30 p-5 shadow-xl shadow-slate-200/50 transition hover:border-emerald-200"
        >
          <p className="text-sm text-slate-500">已收敛样本</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedSnapshots ? overall.resolvedSampleCount : '读取中'}
          </p>
        </article>
        <article
          data-testid="accuracy-summary-unresolved"
          className="rounded-3xl border border-amber-100 bg-amber-50/30 p-5 shadow-xl shadow-slate-200/50 transition hover:border-amber-300"
        >
          <p className="text-sm text-amber-700">未收敛样本</p>
          <p className="mt-2 text-3xl font-semibold text-amber-950">
            {hasLoadedSnapshots ? overall.unresolvedSampleCount : '读取中'}
          </p>
        </article>
        <article
          data-testid="accuracy-summary-average"
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 transition hover:border-slate-300"
        >
          <p className="text-sm text-slate-500">平均误差</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedSnapshots ? formatPercent(overall.averageAbsoluteErrorRate) : '读取中'}
          </p>
        </article>
        <article
          data-testid="accuracy-summary-retention"
          className={`rounded-3xl border p-5 shadow-xl shadow-slate-200/50 transition ${
            syncError
              ? 'border-rose-200 bg-rose-50/50'
              : !isAuthenticated
              ? 'border-amber-200 bg-amber-50/50'
              : 'border-emerald-200 bg-emerald-50/50'
          }`}
        >
          <p
            className={`text-sm ${
              syncError ? 'text-rose-700' : !isAuthenticated ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            数据留存状态
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p
              className={`text-2xl font-semibold ${
                syncError
                  ? 'text-rose-950'
                  : !isAuthenticated
                  ? 'text-amber-950'
                  : 'text-emerald-950'
              }`}
            >
              {syncError ? '同步受限' : !isAuthenticated ? '仅本地' : '云端同步'}
            </p>
          </div>
        </article>
      </section>

      <IntradayAnalyticsDebugPanel />

      <section className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">估值准确度分层规则</h2>
          <p className="mt-1 text-sm text-slate-500">
            当前可信度会同时受交易日窗口、已收敛样本量与误差尾部分布约束。
          </p>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-3">
          {CONFIDENCE_RULE_CARDS.map((card) => (
            <article
              key={card.title}
              data-testid="accuracy-confidence-rule-card"
              className="rounded-2xl border border-slate-100 bg-slate-50/30 p-5 transition hover:bg-slate-50"
            >
              <h3
                data-testid={card.testId}
                className="text-sm font-bold text-slate-900"
              >
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.description}</p>
            </article>
          ))}
        </div>

        <div className="border-t border-slate-200 bg-slate-50/50 px-5 py-4 text-sm text-slate-600 italic font-medium">
          最终等级按三层门槛中的最弱项决定；平均误差仍作为 high/medium 的上限约束。
        </div>
      </section>

      {snapshots.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-20 text-center text-slate-400 italic shadow-xl">
          暂无估值准确度样本
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">高误差基金</h2>
                <p className="mt-1 text-sm text-slate-500">优先关注平均误差最高的基金，快速定位估值偏差来源。</p>
              </div>
              <div className="divide-y divide-slate-100">
                {highErrorFunds.map((item, index) => (
                  <div
                    key={item.fundCode}
                    data-testid="accuracy-high-error-row"
                    className="group grid gap-4 px-6 py-4 transition hover:bg-slate-50/50 md:grid-cols-[48px_minmax(0,1fr)_100px]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-sm font-extrabold text-rose-600 ring-1 ring-inset ring-rose-200/50">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 transition group-hover:text-rose-600">{item.fundName}</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        <span>{item.fundCode}</span> · 已收敛 2 / 2
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">平均误差</p>
                      <p className="mt-1 text-base font-extrabold text-slate-900">
                        {formatPercent(item.summary.averageAbsoluteErrorRate)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">误差分布</h2>
                <p className="mt-1 text-sm text-slate-500">观察已收敛且可计算误差样本落在哪些误差区间。</p>
              </div>
              <div className="divide-y divide-slate-100">
                {errorDistribution.map((bucket) => (
                  <div
                    key={bucket.label}
                    data-testid="accuracy-error-bucket"
                    className="group grid gap-4 px-6 py-4 transition hover:bg-slate-50/50 md:grid-cols-[minmax(0,1fr)_80px_80px]"
                  >
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-slate-600">{bucket.label}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">样本数</p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">{bucket.count}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">占比</p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">{formatShare(bucket.share)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">异常基金排查</h2>
              <p className="mt-1 text-sm text-slate-500">
                合并连续偏差、高误差和未收敛样本，按异常严重度给出排查顺序。
              </p>
            </div>
            {abnormalInvestigationItems.length === 0 ? (
              <div className="px-6 py-12 text-sm font-medium text-slate-400 text-center italic">暂无需要优先排查的异常基金</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {abnormalInvestigationItems.map((item) => (
                  <div
                    key={item.fundCode}
                    data-testid="accuracy-abnormal-row"
                    className="group grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1.1fr)] transition hover:bg-slate-50/50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900 group-hover:text-amber-700 transition">{item.fundName}</p>
                        <span className="font-mono rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                          {item.fundCode}
                        </span>
                        {item.tags.map((tag) => (
                          <span key={tag} className={`${getAbnormalTagClassName(tag)} font-bold uppercase tracking-tighter text-[10px] px-2 py-0.5`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {item.diagnosis} · <span className="text-slate-500">最近异常 {item.latestAbnormalDate ?? '暂无'}</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">平均误差</p>
                        <p className="mt-1 font-extrabold text-slate-900">
                          {formatPercent(item.averageAbsoluteErrorRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">样本</p>
                        <p className="mt-1 font-extrabold text-slate-900">
                          {item.resolvedSampleCount} / +{item.unresolvedSampleCount}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">排查建议</p>
                      <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{item.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">高误差原因拆解</h2>
              <p className="mt-1 text-sm text-slate-500">
                按“持续偏高 / 持续偏低 / 波动偏差”归因，帮助确定优先修复名单。
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {diagnostics.map((item, index) => (
                <div
                  key={item.fundCode}
                  data-testid="accuracy-diagnostic-row"
                  className="group grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1.4fr)_120px_120px_140px] transition hover:bg-slate-50/50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{item.fundName}</p>
                      <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-tighter ring-1 ring-inset ring-slate-200">
                        {item.diagnosis}
                      </span>
                      <span className="inline-flex rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 uppercase tracking-tighter ring-1 ring-inset ring-rose-200/50">
                        {getPriorityLabel(index)}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {item.fundCode} · 可计算 {item.computableSampleCount} / {item.sampleCount}
                      {item.worstTradingDate ? ` · 最大偏差日 ${item.worstTradingDate}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">平均绝对误差</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">
                      {formatPercent(item.averageAbsoluteErrorRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">平均有符号误差</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">
                      {formatSignedPercent(item.averageSignedErrorRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">偏高 / 偏低</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">
                      {item.overestimatedCount} / {item.underestimatedCount}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">优先修复名单</h2>
              <p className="mt-1 text-sm text-slate-500">把高误差基金转换成可执行的排查动作。</p>
            </div>
            <div className="divide-y divide-slate-100">
              {recommendations.map((item) => (
                <div
                  key={item.fundCode}
                  data-testid="accuracy-recommendation-row"
                  className="group grid gap-3 px-6 py-5 transition hover:bg-slate-50/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900 group-hover:text-blue-600 transition">{item.fundName}</p>
                    <span className="font-mono rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 uppercase tracking-tighter">
                      {item.fundCode}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-700">{item.title}</p>
                  <p className="text-sm leading-relaxed text-slate-500">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">误差来源模型</h2>
                <p className="mt-1 text-sm text-slate-500">自动识别主导偏差类型、最高风险时段和收敛压力。</p>
              </div>
              <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                <article
                  data-testid="accuracy-source-model-card"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <p className="text-sm text-slate-500">主导偏差类型</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {hasLoadedSnapshots ? sourceModel.dominantDiagnosis.label : '读取中'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    涉及 {sourceModel.dominantDiagnosis.affectedFundCount} 只基金
                  </p>
                </article>
                <article
                  data-testid="accuracy-source-model-card"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <p className="text-sm text-slate-500">最高风险时段</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {hasLoadedSnapshots ? sourceModel.riskiestTimeBucket.label : '读取中'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatPercent(sourceModel.riskiestTimeBucket.averageAbsoluteErrorRate)}
                  </p>
                </article>
                <article
                  data-testid="accuracy-source-model-card"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <p className="text-sm text-slate-500">最高风险交易日</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {hasLoadedSnapshots ? sourceModel.riskiestTradingDate.tradingDate : '读取中'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatPercent(sourceModel.riskiestTradingDate.averageAbsoluteErrorRate)}
                  </p>
                </article>
                <article
                  data-testid="accuracy-source-model-card"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <p className="text-sm text-slate-500">收敛压力</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {hasLoadedSnapshots ? formatShare(sourceModel.unresolvedPressure.unresolvedRatio) : '读取中'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    未收敛 {sourceModel.unresolvedPressure.unresolvedSampleCount} 条
                  </p>
                </article>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">估值修正策略</h2>
                <p className="mt-1 text-sm text-slate-500">把来源模型转成一组更聚焦的修复顺序。</p>
              </div>
              <div className="divide-y divide-slate-100">
                {sourceStrategy.map((item) => (
                  <div key={item.title} data-testid="accuracy-strategy-row" className="grid gap-2 px-6 py-5 transition hover:bg-slate-50/50">
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="text-sm leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">待处理快照流水</h2>
              <p className="mt-1 text-sm text-slate-500">
                {unresolvedItems.length} 条未收敛样本，涉及 {unresolvedFundCount} 只基金。
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {unresolvedItems.map((item) => (
                <div
                  key={item.id}
                  data-testid="accuracy-unresolved-row"
                  className="group grid gap-4 px-6 py-4 transition hover:bg-slate-50/50 md:grid-cols-[120px_minmax(0,1fr)_120px]"
                >
                  <div className="font-mono text-sm font-bold text-slate-900">{item.tradingDate}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{item.fundName}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      代码: {item.fundCode}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">上次行情</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.quoteUpdatedAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">时段误差分析</h2>
                <p className="mt-1 text-sm text-slate-500">分析不同交易时段的估值偏移程度。</p>
              </div>
              <div className="divide-y divide-slate-100">
                {timeBuckets.map((bucket) => (
                  <div
                    key={bucket.label}
                    data-testid="accuracy-time-bucket-row"
                    className="group grid gap-4 px-6 py-4 transition hover:bg-slate-50/50 grid-cols-[minmax(0,1fr)_100px_80px]"
                  >
                    <p className="font-bold text-slate-900">{bucket.label}</p>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">平均误差</p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">{formatPercent(bucket.averageAbsoluteErrorRate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">样本</p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">{bucket.sampleCount}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">日内偏差趋势</h2>
                <p className="mt-1 text-sm text-slate-500">观察最近 5 个交易日的误差波动情况。</p>
              </div>
              <div className="divide-y divide-slate-100">
                {dailyTrend.map((trend) => (
                  <div
                    key={trend.tradingDate}
                    data-testid="accuracy-trend-row"
                    className="group grid gap-4 px-6 py-4 transition hover:bg-slate-50/50 grid-cols-[100px_minmax(0,1fr)_80px]"
                  >
                    <p className="font-mono text-sm font-bold text-slate-900">{trend.tradingDate}</p>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">平均误差</p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">{formatPercent(trend.averageAbsoluteErrorRate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">样本</p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">{trend.sampleCount}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">全量基金诊断明细</h2>
              <p className="mt-1 text-sm text-slate-500">查看所有已关注基金的样本量、误差水平及收敛状态。</p>
            </div>
            <div className="divide-y divide-slate-100">
              {fundItems.map((item) => (
                <div
                  key={item.fundCode}
                  data-testid="accuracy-fund-row"
                  className="group grid gap-4 px-6 py-4 transition hover:bg-slate-50/50 md:grid-cols-[minmax(0,1fr)_120px_120px]"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{item.fundName}</p>
                    <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {item.fundCode} · 已收敛 {item.resolvedSampleCount} / {item.summary.sampleCount}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">平均误差</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">
                      {formatPercent(item.summary.averageAbsoluteErrorRate)}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">误差倾向</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">
                      {formatSignedPercent(item.summary.averageSignedErrorRate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">修正前后对比</h2>
              <p className="mt-1 text-sm text-slate-500">
                用当前样本做离线修正模拟，先比较全局偏差、尾盘链路和诊断联动三种方案。
              </p>
            </div>

            <div className="grid gap-6 p-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article
                  data-testid="accuracy-adjustment-summary-card"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <p className="text-sm text-slate-500">修正前平均误差</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatPercent(adjustmentSimulation.baselineAverageAbsoluteErrorRate)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 text-slate-100">占位</p>
                </article>
                <article
                  data-testid="accuracy-adjustment-summary-card"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <p className="text-sm text-slate-500">最佳实验方案</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {adjustmentSimulation.bestScenarioLabel ?? '样本不足'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 text-slate-100">占位</p>
                </article>
                <article
                  data-testid="accuracy-adjustment-summary-card"
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:bg-emerald-100/50"
                >
                  <p className="text-sm text-emerald-700">修正后平均误差</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-950">
                    {formatPercent(adjustmentSimulation.bestScenarioAdjustedAverageAbsoluteErrorRate)}
                  </p>
                  <p className="mt-1 text-sm text-emerald-700 text-emerald-50/0">占位</p>
                </article>
                <article
                  data-testid="accuracy-adjustment-summary-card"
                  className="rounded-2xl border border-blue-200 bg-blue-50 p-4 transition hover:bg-blue-100/50"
                >
                  <p className="text-sm text-blue-700">相对改善</p>
                  <p className="mt-2 text-lg font-semibold text-blue-950">
                    {adjustmentSimulation.bestScenarioImprovementRate === null
                      ? '样本不足'
                      : formatShare(adjustmentSimulation.bestScenarioImprovementRate)}
                  </p>
                  <p className="mt-1 text-sm text-blue-700 text-blue-50/0">占位</p>
                </article>
              </div>

              <article className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">基金级修正候选名单</h3>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        按每只基金的模拟改善幅度排序，优先验证收益更明确的基金级修正路径。
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
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
                      </div>
                      <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl shadow-sm">
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

                {filteredAdjustmentFundInsights.length === 0 ? (
                  <div className="px-6 py-12 text-sm font-medium text-slate-400 text-center italic">暂无符合条件的基金级候选</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredAdjustmentFundInsights.map((item) => {
                      const fundDetail = getAdjustmentFundDetail(item.fundCode);

                      return (
                        <div key={item.fundCode} className="group transition hover:bg-slate-50/30">
                          <div
                            data-testid="accuracy-adjustment-fund-row"
                            className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.4fr)_100px_100px_80px_60px]"
                          >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-slate-900 group-hover:text-emerald-700 transition">{item.fundName}</p>
                              <span className="font-mono rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                {item.fundCode}
                              </span>
                              <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 uppercase tracking-tighter ring-1 ring-inset ring-blue-200/50">
                                {item.diagnosis}
                              </span>
                              <span
                                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ring-1 ring-inset ${
                                  item.recommendationStatus === 'priority'
                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/50'
                                    : item.recommendationStatus === 'collect-more'
                                      ? 'bg-amber-50 text-amber-700 ring-amber-200/50'
                                      : 'bg-slate-50 text-slate-500 ring-slate-200/50'
                                }`}
                              >
                                {item.recommendationLabel}
                              </span>
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

                        {expandedAdjustmentFundCode === item.fundCode && (
                          <div
                            data-testid={`accuracy-adjustment-fund-detail-${item.fundCode}`}
                            className="bg-slate-50 border-t border-slate-200 p-6 duration-300"
                          >
                             <div className="grid gap-6 xl:grid-cols-2">
                               <div className="space-y-4">
                                  <h4 className="text-sm font-bold text-slate-900">修正规则草案</h4>
                                  <p className="text-sm text-slate-600 leading-relaxed">
                                     建议原因：{item.recommendationReason}
                                  </p>
                                  <div className="inline-flex rounded-lg bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                     建议动作：{item.recommendationLabel}
                                  </div>
                               </div>

                               {fundDetail && (
                                 <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-slate-900">时段分析</h4>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                       {fundDetail.buckets.map(bucket => (
                                         <div key={bucket.label} data-testid={`accuracy-adjustment-fund-bucket-row-${item.fundCode}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{bucket.label}</p>
                                            <p className="mt-1 text-sm font-extrabold text-slate-900">{formatPercent(bucket.averageAbsoluteErrorRate)}</p>
                                            <p className="mt-0.5 text-[10px] font-bold text-slate-400">{bucket.sampleCount} 样本</p>
                                         </div>
                                       ))}
                                    </div>
                                 </div>
                               )}
                             </div>

                             <div className="mt-8">
                                <h4 className="text-sm font-bold text-slate-900 mb-4">样本明细</h4>
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                   <table className="min-w-full divide-y divide-slate-100">
                                      <thead className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                         <tr>
                                            <th className="px-4 py-3 text-left">交易日</th>
                                            <th className="px-4 py-3 text-left">行情时间</th>
                                            <th className="px-4 py-3 text-right">估值</th>
                                            <th className="px-4 py-3 text-right">最终净值</th>
                                            <th className="px-4 py-3 text-right">误差</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-600">
                                         {fundDetail?.samples.map(sample => (
                                           <tr key={sample.id} data-testid={`accuracy-adjustment-fund-sample-row-${item.fundCode}`} className="hover:bg-slate-50 transition">
                                              <td className="px-4 py-3 font-mono">{sample.tradingDate}</td>
                                              <td className="px-4 py-3 text-slate-400">{sample.quoteUpdatedAt}</td>
                                              <td className="px-4 py-3 text-right font-mono text-slate-900">{sample.estimatedNav.toFixed(4)}</td>
                                              <td className="px-4 py-3 text-right font-mono">{formatNavValue(sample.finalNav)}</td>
                                              <td className={`px-4 py-3 text-right font-mono ${sample.absoluteErrorRate && sample.absoluteErrorRate > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                 {formatPercent(sample.absoluteErrorRate)}
                                              </td>
                                           </tr>
                                         ))}
                                      </tbody>
                                   </table>
                                </div>
                             </div>

                             <div className="mt-8 flex items-center gap-4">
                                <span className="text-sm font-bold text-slate-900">更新决策:</span>
                                <div className="flex gap-2">
                                   <button
                                     type="button"
                                     data-testid={`accuracy-adjustment-decision-verification-${item.fundCode}`}
                                     className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
                                     onClick={() => handleAdjustmentDecision(item.fundCode, 'verification')}
                                   >
                                     加入验证
                                   </button>
                                   <button
                                     type="button"
                                     data-testid={`accuracy-adjustment-decision-watch-${item.fundCode}`}
                                     className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 shadow-sm transition hover:bg-amber-50"
                                     onClick={() => handleAdjustmentDecision(item.fundCode, 'watch')}
                                   >
                                     继续观察
                                   </button>
                                   <button
                                     type="button"
                                     className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                                     onClick={() => handleAdjustmentDecision(item.fundCode, 'dismissed')}
                                   >
                                     暂不处理
                                   </button>
                                </div>
                             </div>
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">修正决策执行队列</h3>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        处理“加入验证”、“继续观察”中的策略，复核回写效果。
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-execution-filter-all"
                        className={`rounded-lg px-3 py-1 text-[10px] font-bold transition ${adjustmentExecutionFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setAdjustmentExecutionFilter('all')}
                      >
                        全部
                      </button>
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-execution-filter-verification"
                        className={`rounded-lg px-3 py-1 text-[10px] font-bold transition ${adjustmentExecutionFilter === 'verification' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setAdjustmentExecutionFilter('verification')}
                      >
                        验证中
                      </button>
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-execution-filter-watch"
                        className={`rounded-lg px-3 py-1 text-[10px] font-bold transition ${adjustmentExecutionFilter === 'watch' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setAdjustmentExecutionFilter('watch')}
                      >
                        观察中
                      </button>
                      <button
                        type="button"
                        data-testid="accuracy-adjustment-execution-filter-recheck"
                        className={`rounded-lg px-3 py-1 text-[10px] font-bold transition ${adjustmentExecutionFilter === 'recheck' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setAdjustmentExecutionFilter('recheck')}
                      >
                        需重核
                      </button>
                    </div>
                  </div>
                </div>

                {filteredAdjustmentExecutionItems.length === 0 ? (
                  <div className="px-6 py-12 text-sm font-medium text-slate-400 text-center italic">暂无待执行任务</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredAdjustmentExecutionItems.map((item) => (
                      <div
                        key={item.fundCode}
                        data-testid="accuracy-adjustment-decision-row"
                        className="group grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1.4fr)_100px_100px_80px]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-900">{item.fundName}</p>
                            <span className="font-mono rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                              {item.fundCode}
                            </span>
                            <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 uppercase tracking-tighter ring-1 ring-inset ring-rose-200/50">
                              {item.priorityLabel}
                            </span>
                            <span className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ring-1 ring-inset ${getAdjustmentDecisionBadgeClassName(item.decisionStatus)} ring-current/20`}>
                              {item.decisionLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            诊断: {item.diagnosis} · 决策策略: {item.ruleDraftTitle}
                          </p>

                          {item.validationRecommendationStatus && item.validationRecommendationStatus !== 'keep' && (
                            <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                               <div className="flex items-center justify-between gap-2">
                                 <p className="text-[10px] font-bold text-rose-900">同步校验预警</p>
                                 <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${getAdjustmentValidationRecommendationBadgeClassName(item.validationRecommendationStatus)}`}>
                                   {item.validationRecommendationLabel}
                                 </span>
                               </div>
                               <p className="mt-1 text-[10px] font-bold text-rose-700">{item.validationRecommendationReason}</p>
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                             <button
                               type="button"
                               data-testid={`accuracy-adjustment-execution-open-${item.fundCode}`}
                               className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                               onClick={() => handleOpenAdjustmentExecution(item.fundCode)}
                             >
                               查看诊断依据
                           </button>
                           {item.decisionStatus === 'verification' && (
                             <button
                               type="button"
                               data-testid={`accuracy-adjustment-execution-complete-${item.fundCode}`}
                               className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-emerald-700"
                               onClick={() => handleAdjustmentDecision(item.fundCode, 'validated')}
                             >
                               标记已验证通过
                             </button>
                           )}
                           {item.executionFilterKey === 'recheck' && (
                             <div className="flex gap-2">
                               <button
                                 type="button"
                                 data-testid={`accuracy-adjustment-execution-complete-${item.fundCode}`}
                                 className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-emerald-700"
                                 onClick={() => handleAdjustmentDecision(item.fundCode, 'validated')}
                               >
                                 重新确认通过
                               </button>
                               <button
                                 type="button"
                                 className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-rose-700"
                                 onClick={() => handleAdjustmentDecision(item.fundCode, 'failed')}
                               >
                                 重新标记失败
                               </button>
                             </div>
                           )}
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">最近决策</p>
                         <p className="mt-1 text-[10px] font-bold text-slate-900">{item.updatedAtLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-900">修正决策历史</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Decision Audit Log</p>
              </div>
              <div className="divide-y divide-slate-100">
                {adjustmentHistoryItems.length === 0 ? (
                  <div className="px-6 py-12 text-sm font-medium text-slate-400 text-center italic">暂无历史决策记录</div>
                ) : (
                  adjustmentHistoryItems.map((item, index) => (
                    <div
                      key={`${item.fundCode}-${item.updatedAt}-${index}`}
                      data-testid="accuracy-adjustment-history-row"
                      className="group grid gap-4 px-6 py-4 transition hover:bg-slate-50/50 md:grid-cols-[minmax(0,1fr)_140px_140px]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{item.fundName}</p>
                          <span className="font-mono rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{item.fundCode}</span>
                        </div>
                        <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          策略: {item.ruleDraftTitle}
                        </p>
                      </div>
                      <div>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">决策状态</p>
                         <p className={`mt-1 text-sm font-extrabold ${item.status === 'failed' ? 'text-rose-600' : 'text-slate-900'}`}>{item.statusLabel}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">更新时间</p>
                         <p className="mt-1 text-[10px] font-bold text-slate-900">{item.updatedAtLabel}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">修正效果回写验证</h2>
                <p className="mt-1 text-sm text-slate-500">监控已上线修正规则在最近已收敛样本中的实际改善表现。</p>
              </div>

              <div className="grid gap-6 p-6">
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                  <article
                    data-testid="accuracy-adjustment-validation-summary-card"
                    className="rounded-2xl border border-slate-100 bg-slate-50/30 p-5 transition hover:bg-slate-50"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">已验证基金数</p>
                    <p className="mt-2 text-xl font-extrabold text-slate-900">
                      {adjustmentValidationSummary.validatedFundCount}
                    </p>
                  </article>
                  <article
                    data-testid="accuracy-adjustment-validation-summary-card"
                    className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5 transition hover:bg-rose-50"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600/70">需重核基金数</p>
                    <p className="mt-2 text-xl font-extrabold text-rose-950">
                      {adjustmentValidationSummary.recheckFundCount}
                    </p>
                  </article>
                  <article
                    data-testid="accuracy-adjustment-validation-summary-card"
                    className="rounded-2xl border border-blue-100 bg-blue-50/30 p-5 transition hover:bg-blue-50"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70">回写改善覆盖</p>
                    <p className="mt-2 text-xl font-extrabold text-blue-950">
                      {formatShare(adjustmentValidationSummary.improvementCoverage)}
                    </p>
                  </article>
                  <article
                    data-testid="accuracy-adjustment-validation-summary-card"
                    className="rounded-2xl border border-slate-100 bg-slate-50/30 p-5 transition hover:bg-slate-50"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">潜在回写观测</p>
                    <p className="mt-2 text-xl font-extrabold text-slate-900">
                      {adjustmentValidationSummary.funds.length}
                    </p>
                  </article>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                  {adjustmentValidationSummary.funds.length === 0 ? (
                    <div className="px-6 py-12 text-sm font-medium text-slate-400 text-center italic">暂无生效中的修正规则</div>
                  ) : (
                    adjustmentValidationSummary.funds.map((item) => (
                      <div
                        key={item.fundCode}
                        data-testid="accuracy-adjustment-validation-fund-row"
                        className="group grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1.4fr)_100px_100px_100px] transition hover:bg-slate-50/50"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-900">{item.fundName}</p>
                            <span className="font-mono rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                              {item.fundCode}
                            </span>
                            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ring-1 ring-inset ${getAdjustmentValidationRecommendationBadgeClassName(item.recommendationStatus)} ring-current/20`}>
                              {item.recommendationLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                            {item.recommendationReason}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">验证样本</p>
                          <p className="mt-1 text-sm font-extrabold text-slate-900">
                            {item.validationSampleCount}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">平均误差</p>
                          <p className="mt-1 text-sm font-extrabold text-slate-900">
                            {formatPercent(item.averageAbsoluteErrorRate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">实际改善</p>
                          <p className={`mt-1 text-sm font-extrabold ${item.averageImprovementRate && item.averageImprovementRate > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                            {item.averageImprovementRate === null ? '--' : formatShare(item.averageImprovementRate)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </article>
            </div>
          </section>
        </div>
      )}

      <AccuracyImportDialog
        open={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        accuracyStore={accuracyStore}
        onImportSuccess={handleImportSuccess}
      />
    </main>
  );
}
