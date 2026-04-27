import { buildEstimateAdjustmentPolicy } from '@/lib/funds/estimate-adjustment-policy';
import type {
  EstimateAccuracySnapshot,
  EstimateAdjustmentDecisionItem,
  FundQuote,
} from '@/lib/funds/types';

export interface EstimateAdjustmentValidationFundItem {
  fundCode: string;
  fundName: string;
  sampleCount: number;
  improvedSampleCount: number;
  worsenedSampleCount: number;
  flatSampleCount: number;
  latestWorsenedStreak: number;
  baselineAverageAbsoluteErrorRate: number | null;
  adjustedAverageAbsoluteErrorRate: number | null;
  improvementRate: number | null;
  validationSampleCount: number;
  averageAbsoluteErrorRate: number | null;
  averageImprovementRate: number | null;
  recommendationStatus: 'keep' | 'review' | 'downgrade';
  recommendationLabel: string;
  recommendationReason: string;
}

export interface EstimateAdjustmentValidationSummary {
  validatedFundCount: number;
  recheckFundCount: number;
  sampleCount: number;
  improvedSampleCount: number;
  worsenedSampleCount: number;
  flatSampleCount: number;
  baselineAverageAbsoluteErrorRate: number | null;
  adjustedAverageAbsoluteErrorRate: number | null;
  improvementRate: number | null;
  improvementCoverage: number;
  funds: EstimateAdjustmentValidationFundItem[];
}

interface ValidationSampleItem {
  fundCode: string;
  fundName: string;
  tradingDate: string;
  quoteUpdatedAt: string;
  baselineAbsoluteErrorRate: number;
  adjustedAbsoluteErrorRate: number;
}

interface EstimateAdjustmentValidationRecommendationInput {
  sampleCount: number;
  improvedSampleCount: number;
  worsenedSampleCount: number;
  flatSampleCount: number;
  latestWorsenedStreak: number;
  improvementRate: number | null;
}

export const getEstimateAdjustmentValidationRecommendation = (
  input: EstimateAdjustmentValidationRecommendationInput,
): Pick<
  EstimateAdjustmentValidationFundItem,
  'recommendationStatus' | 'recommendationLabel' | 'recommendationReason'
> => {
  if (input.latestWorsenedStreak >= 2 || input.improvementRate === null || input.improvementRate <= 0) {
    return {
      recommendationStatus: 'downgrade',
      recommendationLabel: '建议降级观察',
      recommendationReason: '最近回写样本连续恶化或整体改善已转负，建议先回退到观察状态。',
    };
  }

  if (input.worsenedSampleCount > 0 || input.improvementRate < 0.1) {
    return {
      recommendationStatus: 'review',
      recommendationLabel: '建议重点复核',
      recommendationReason: '修正仍有改善，但已出现恶化样本或改善幅度偏弱，需要继续复核。',
    };
  }

  return {
    recommendationStatus: 'keep',
    recommendationLabel: '继续保持',
    recommendationReason: '当前回写样本仍保持稳定改善，可继续保留 validated 状态。',
  };
};

const getAverage = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const toQuote = (snapshot: EstimateAccuracySnapshot): FundQuote => ({
  code: snapshot.fundCode,
  name: snapshot.fundName,
  estimatedNav: snapshot.estimatedNav,
  changeRate: 0,
  updatedAt: snapshot.quoteUpdatedAt,
});

const isComputableSnapshot = (
  snapshot: EstimateAccuracySnapshot,
): snapshot is EstimateAccuracySnapshot & {
  finalNav: number;
  absoluteErrorRate: number;
  resolvedAt: string;
} =>
  snapshot.finalNav !== null &&
  snapshot.finalNav > 0 &&
  snapshot.absoluteErrorRate !== null &&
  snapshot.resolvedAt !== null;

export const buildEstimateAdjustmentValidationSummary = (
  snapshots: EstimateAccuracySnapshot[],
  decisions: Record<string, EstimateAdjustmentDecisionItem>,
  now = Date.now(),
): EstimateAdjustmentValidationSummary => {
  const validationSamples: ValidationSampleItem[] = snapshots
    .filter(isComputableSnapshot)
    .flatMap((snapshot) => {
      const decision = decisions[snapshot.fundCode];
      if (!decision || decision.status !== 'validated') {
        return [];
      }

      const policy = buildEstimateAdjustmentPolicy(toQuote(snapshot), snapshots, decisions, now);
      if (policy?.mode !== 'active' || policy.adjustedEstimatedNav === null) {
        return [];
      }

      return [
        {
          fundCode: snapshot.fundCode,
          fundName: snapshot.fundName,
          tradingDate: snapshot.tradingDate,
          quoteUpdatedAt: snapshot.quoteUpdatedAt,
          baselineAbsoluteErrorRate: snapshot.absoluteErrorRate,
          adjustedAbsoluteErrorRate:
            Math.abs(policy.adjustedEstimatedNav - snapshot.finalNav) / snapshot.finalNav,
        },
      ];
    });

  const baselineAverageAbsoluteErrorRate = getAverage(
    validationSamples.map((item) => item.baselineAbsoluteErrorRate),
  );
  const adjustedAverageAbsoluteErrorRate = getAverage(
    validationSamples.map((item) => item.adjustedAbsoluteErrorRate),
  );

  const funds = Array.from(
    validationSamples.reduce<Map<string, ValidationSampleItem[]>>((accumulator, sample) => {
      const current = accumulator.get(sample.fundCode) ?? [];
      current.push(sample);
      accumulator.set(sample.fundCode, current);
      return accumulator;
    }, new Map()),
  )
    .map(([fundCode, items]) => {
      const sortedItems = [...items].sort((left, right) => {
        if (left.tradingDate !== right.tradingDate) {
          return left.tradingDate.localeCompare(right.tradingDate);
        }

        return left.quoteUpdatedAt.localeCompare(right.quoteUpdatedAt);
      });
      const improvedSampleCount = items.filter(
        (item) => item.adjustedAbsoluteErrorRate < item.baselineAbsoluteErrorRate,
      ).length;
      const worsenedSampleCount = items.filter(
        (item) => item.adjustedAbsoluteErrorRate > item.baselineAbsoluteErrorRate,
      ).length;
      const flatSampleCount = items.length - improvedSampleCount - worsenedSampleCount;
      const fundBaselineAverage = getAverage(items.map((item) => item.baselineAbsoluteErrorRate));
      const fundAdjustedAverage = getAverage(items.map((item) => item.adjustedAbsoluteErrorRate));
      const improvementRate =
        fundBaselineAverage !== null &&
        fundAdjustedAverage !== null &&
        fundBaselineAverage > 0
          ? (fundBaselineAverage - fundAdjustedAverage) / fundBaselineAverage
          : null;
      let latestWorsenedStreak = 0;
      for (let index = sortedItems.length - 1; index >= 0; index -= 1) {
        const item = sortedItems[index];
        if (item.adjustedAbsoluteErrorRate > item.baselineAbsoluteErrorRate) {
          latestWorsenedStreak += 1;
          continue;
        }

        break;
      }
      const recommendation = getEstimateAdjustmentValidationRecommendation({
        sampleCount: items.length,
        improvedSampleCount,
        worsenedSampleCount,
        flatSampleCount,
        latestWorsenedStreak,
        improvementRate,
      });

      return {
        fundCode,
        fundName: items[0]?.fundName ?? fundCode,
        sampleCount: items.length,
        improvedSampleCount,
        worsenedSampleCount,
        flatSampleCount,
        latestWorsenedStreak,
        baselineAverageAbsoluteErrorRate: fundBaselineAverage,
        adjustedAverageAbsoluteErrorRate: fundAdjustedAverage,
        improvementRate,
        validationSampleCount: items.length,
        averageAbsoluteErrorRate: fundAdjustedAverage,
        averageImprovementRate: improvementRate,
        ...recommendation,
      } satisfies EstimateAdjustmentValidationFundItem;
    })
    .sort((left, right) => {
      const delta = (right.improvementRate ?? -1) - (left.improvementRate ?? -1);
      if (delta !== 0) {
        return delta;
      }

      return left.fundCode.localeCompare(right.fundCode);
    });

  const improvedSampleCount = validationSamples.filter(
    (item) => item.adjustedAbsoluteErrorRate < item.baselineAbsoluteErrorRate,
  ).length;
  const worsenedSampleCount = validationSamples.filter(
    (item) => item.adjustedAbsoluteErrorRate > item.baselineAbsoluteErrorRate,
  ).length;
  const flatSampleCount = validationSamples.length - improvedSampleCount - worsenedSampleCount;

  return {
    validatedFundCount: funds.length,
    recheckFundCount: funds.filter((fund) => fund.recommendationStatus !== 'keep').length,
    sampleCount: validationSamples.length,
    improvedSampleCount,
    worsenedSampleCount,
    flatSampleCount,
    baselineAverageAbsoluteErrorRate,
    adjustedAverageAbsoluteErrorRate,
    improvementRate:
      baselineAverageAbsoluteErrorRate !== null &&
      adjustedAverageAbsoluteErrorRate !== null &&
      baselineAverageAbsoluteErrorRate > 0
        ? (baselineAverageAbsoluteErrorRate - adjustedAverageAbsoluteErrorRate) /
          baselineAverageAbsoluteErrorRate
        : null,
    improvementCoverage:
      validationSamples.length > 0 ? improvedSampleCount / validationSamples.length : 0,
    funds,
  };
};
