import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

export type EstimateAccuracyDiagnosis =
  | '持续偏高'
  | '持续偏低'
  | '波动偏差'
  | '样本不足';

export interface EstimateAccuracyDiagnosticItem {
  fundCode: string;
  fundName: string;
  sampleCount: number;
  computableSampleCount: number;
  averageAbsoluteErrorRate: number | null;
  averageSignedErrorRate: number | null;
  overestimatedCount: number;
  underestimatedCount: number;
  diagnosis: EstimateAccuracyDiagnosis;
  priorityScore: number;
  worstTradingDate: string | null;
  worstAbsoluteErrorRate: number | null;
}

interface ComputableSnapshot {
  snapshot: EstimateAccuracySnapshot;
  signedErrorRate: number;
}

const DIAGNOSIS_PRIORITY_RANK: Record<EstimateAccuracyDiagnosis, number> = {
  波动偏差: 3,
  持续偏高: 2,
  持续偏低: 1,
  样本不足: 0,
};

const toComputableSnapshot = (
  snapshot: EstimateAccuracySnapshot,
): ComputableSnapshot | null => {
  if (
    snapshot.finalNav === null ||
    snapshot.finalNav <= 0 ||
    snapshot.resolvedAt === null ||
    snapshot.absoluteErrorRate === null
  ) {
    return null;
  }

  return {
    snapshot,
    signedErrorRate: (snapshot.estimatedNav - snapshot.finalNav) / snapshot.finalNav,
  };
};

const classifyDiagnosis = (
  computableSampleCount: number,
  overestimatedCount: number,
  underestimatedCount: number,
): EstimateAccuracyDiagnosis => {
  if (computableSampleCount < 2) {
    return '样本不足';
  }

  if (overestimatedCount > 0 && underestimatedCount > 0) {
    return '波动偏差';
  }

  if (overestimatedCount > 0) {
    return '持续偏高';
  }

  if (underestimatedCount > 0) {
    return '持续偏低';
  }

  return '样本不足';
};

export const summarizeEstimateAccuracyDiagnostics = (
  snapshots: EstimateAccuracySnapshot[],
  limit = 5,
): EstimateAccuracyDiagnosticItem[] => {
  const grouped = new Map<string, EstimateAccuracySnapshot[]>();

  for (const snapshot of snapshots) {
    const current = grouped.get(snapshot.fundCode) ?? [];
    current.push(snapshot);
    grouped.set(snapshot.fundCode, current);
  }

  return Array.from(grouped.entries())
    .map(([fundCode, fundSnapshots]) => {
      const computableSnapshots = fundSnapshots
        .map(toComputableSnapshot)
        .filter((item): item is ComputableSnapshot => item !== null);

      const overestimatedCount = computableSnapshots.filter(
        (item) => item.signedErrorRate > 0,
      ).length;
      const underestimatedCount = computableSnapshots.filter(
        (item) => item.signedErrorRate < 0,
      ).length;
      const totalAbsoluteErrorRate = computableSnapshots.reduce(
        (sum, item) => sum + (item.snapshot.absoluteErrorRate ?? 0),
        0,
      );
      const totalSignedErrorRate = computableSnapshots.reduce(
        (sum, item) => sum + item.signedErrorRate,
        0,
      );

      const worstSnapshot = computableSnapshots.reduce<ComputableSnapshot | null>(
        (current, item) => {
          if (!current) {
            return item;
          }

          return (item.snapshot.absoluteErrorRate ?? -1) >
            (current.snapshot.absoluteErrorRate ?? -1)
            ? item
            : current;
        },
        null,
      );

      const averageAbsoluteErrorRate =
        computableSnapshots.length > 0
          ? totalAbsoluteErrorRate / computableSnapshots.length
          : null;
      const averageSignedErrorRate =
        computableSnapshots.length > 0
          ? totalSignedErrorRate / computableSnapshots.length
          : null;
      const diagnosis = classifyDiagnosis(
        computableSnapshots.length,
        overestimatedCount,
        underestimatedCount,
      );

      return {
        fundCode,
        fundName: fundSnapshots[0]?.fundName ?? fundCode,
        sampleCount: fundSnapshots.length,
        computableSampleCount: computableSnapshots.length,
        averageAbsoluteErrorRate,
        averageSignedErrorRate,
        overestimatedCount,
        underestimatedCount,
        diagnosis,
        priorityScore: averageAbsoluteErrorRate ?? -1,
        worstTradingDate: worstSnapshot?.snapshot.tradingDate ?? null,
        worstAbsoluteErrorRate: worstSnapshot?.snapshot.absoluteErrorRate ?? null,
      } satisfies EstimateAccuracyDiagnosticItem;
    })
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      const diagnosisRankDelta =
        DIAGNOSIS_PRIORITY_RANK[right.diagnosis] -
        DIAGNOSIS_PRIORITY_RANK[left.diagnosis];
      if (diagnosisRankDelta !== 0) {
        return diagnosisRankDelta;
      }

      return left.fundCode.localeCompare(right.fundCode);
    })
    .slice(0, limit);
};
