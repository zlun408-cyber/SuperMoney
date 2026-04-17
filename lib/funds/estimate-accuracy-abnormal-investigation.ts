import {
  summarizeEstimateAccuracyDiagnostics,
  type EstimateAccuracyDiagnosis,
} from '@/lib/funds/estimate-accuracy-diagnostics';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

export type EstimateAccuracyAbnormalTag = '连续偏差' | '高误差' | '未收敛';

export interface EstimateAccuracyAbnormalInvestigationItem {
  fundCode: string;
  fundName: string;
  tags: EstimateAccuracyAbnormalTag[];
  severityLabel: EstimateAccuracyAbnormalTag;
  diagnosis: EstimateAccuracyDiagnosis;
  averageAbsoluteErrorRate: number | null;
  resolvedSampleCount: number;
  unresolvedSampleCount: number;
  latestAbnormalDate: string | null;
  suggestion: string;
}

const HIGH_ERROR_THRESHOLD = 0.02;
const TAG_RANK: Record<EstimateAccuracyAbnormalTag, number> = {
  连续偏差: 0,
  高误差: 1,
  未收敛: 2,
};

const isResolvedSnapshot = (snapshot: EstimateAccuracySnapshot): boolean =>
  snapshot.finalNav !== null && snapshot.resolvedAt !== null;

const getLatestTradingDate = (snapshots: EstimateAccuracySnapshot[]): string | null => {
  if (snapshots.length === 0) {
    return null;
  }

  return snapshots.reduce<string | null>((current, snapshot) => {
    if (current === null) {
      return snapshot.tradingDate;
    }

    return snapshot.tradingDate > current ? snapshot.tradingDate : current;
  }, null);
};

const getSuggestion = (
  severityLabel: EstimateAccuracyAbnormalTag,
  diagnosis: EstimateAccuracyDiagnosis,
): string => {
  if (severityLabel === '未收敛') {
    return '等待最终净值回写；若持续未收敛，优先检查历史净值获取链路。';
  }

  if (diagnosis === '持续偏高') {
    return '连续偏高，优先检查指数映射、权重估算和替代价格是否系统性偏高。';
  }

  if (diagnosis === '持续偏低') {
    return '连续偏低，优先检查现金仓位、债券仓位或低波资产是否被遗漏。';
  }

  return '高误差但方向不稳定，优先查看分时段误差和样本明细。';
};

export const buildEstimateAccuracyAbnormalInvestigationItems = (
  snapshots: EstimateAccuracySnapshot[],
): EstimateAccuracyAbnormalInvestigationItem[] => {
  const grouped = snapshots.reduce<Map<string, EstimateAccuracySnapshot[]>>((accumulator, snapshot) => {
    const current = accumulator.get(snapshot.fundCode) ?? [];
    current.push(snapshot);
    accumulator.set(snapshot.fundCode, current);
    return accumulator;
  }, new Map());
  const diagnosticsByFundCode = new Map(
    summarizeEstimateAccuracyDiagnostics(snapshots, Number.MAX_SAFE_INTEGER).map((item) => [
      item.fundCode,
      item,
    ]),
  );

  return Array.from(grouped.entries())
    .map(([fundCode, fundSnapshots]) => {
      const diagnostic = diagnosticsByFundCode.get(fundCode);
      if (!diagnostic) {
        return null;
      }

      const unresolvedSampleCount = fundSnapshots.filter((snapshot) => !isResolvedSnapshot(snapshot)).length;
      const hasConsecutiveBias =
        diagnostic.computableSampleCount >= 2 &&
        (diagnostic.diagnosis === '持续偏高' || diagnostic.diagnosis === '持续偏低');
      const hasHighError =
        diagnostic.averageAbsoluteErrorRate !== null &&
        diagnostic.averageAbsoluteErrorRate >= HIGH_ERROR_THRESHOLD;
      const hasUnresolved = unresolvedSampleCount > 0;
      const tags: EstimateAccuracyAbnormalTag[] = [
        ...(hasConsecutiveBias ? (['连续偏差'] as const) : []),
        ...(hasHighError ? (['高误差'] as const) : []),
        ...(hasUnresolved ? (['未收敛'] as const) : []),
      ];

      if (tags.length === 0) {
        return null;
      }

      return {
        fundCode,
        fundName: diagnostic.fundName,
        tags,
        severityLabel: tags[0],
        diagnosis: diagnostic.diagnosis,
        averageAbsoluteErrorRate: diagnostic.averageAbsoluteErrorRate,
        resolvedSampleCount: diagnostic.computableSampleCount,
        unresolvedSampleCount,
        latestAbnormalDate: getLatestTradingDate(fundSnapshots),
        suggestion: getSuggestion(tags[0], diagnostic.diagnosis),
      } satisfies EstimateAccuracyAbnormalInvestigationItem;
    })
    .filter((item): item is EstimateAccuracyAbnormalInvestigationItem => item !== null)
    .sort((left, right) => {
      const severityDelta = TAG_RANK[left.severityLabel] - TAG_RANK[right.severityLabel];
      if (severityDelta !== 0) {
        return severityDelta;
      }

      if (left.severityLabel === '未收敛') {
        const unresolvedDelta = right.unresolvedSampleCount - left.unresolvedSampleCount;
        if (unresolvedDelta !== 0) {
          return unresolvedDelta;
        }
      }

      const errorDelta =
        (right.averageAbsoluteErrorRate ?? -1) - (left.averageAbsoluteErrorRate ?? -1);
      if (errorDelta !== 0) {
        return errorDelta;
      }

      if (right.latestAbnormalDate !== left.latestAbnormalDate) {
        return (right.latestAbnormalDate ?? '').localeCompare(left.latestAbnormalDate ?? '');
      }

      return left.fundCode.localeCompare(right.fundCode);
    });
};
