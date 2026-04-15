import { describe, expect, it } from 'vitest';

import {
  buildEstimateAdjustmentValidationSummary,
  getEstimateAdjustmentValidationRecommendation,
} from '@/lib/funds/estimate-adjustment-validation';
import type { EstimateAccuracySnapshot, EstimateAdjustmentDecisionItem } from '@/lib/funds/types';

const snapshots: EstimateAccuracySnapshot[] = [
  {
    id: 'a-1',
    fundCode: '000001',
    fundName: '偏高基金',
    quoteUpdatedAt: '2026-04-10 14:30',
    tradingDate: '2026-04-10',
    estimatedNav: 1.04,
    finalNav: 1,
    absoluteErrorRate: 0.04,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    createdAt: '2026-04-10T14:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  },
  {
    id: 'a-2',
    fundCode: '000001',
    fundName: '偏高基金',
    quoteUpdatedAt: '2026-04-11 15:10',
    tradingDate: '2026-04-11',
    estimatedNav: 1.02,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-11T16:00:00.000Z',
    createdAt: '2026-04-11T15:10:00.000Z',
    updatedAt: '2026-04-11T16:00:00.000Z',
  },
  {
    id: 'b-1',
    fundCode: '000002',
    fundName: '观察基金',
    quoteUpdatedAt: '2026-04-10 10:30',
    tradingDate: '2026-04-10',
    estimatedNav: 1.01,
    finalNav: 1,
    absoluteErrorRate: 0.01,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    createdAt: '2026-04-10T10:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  },
  {
    id: 'c-1',
    fundCode: '000003',
    fundName: '冷却基金',
    quoteUpdatedAt: '2026-04-10 15:05',
    tradingDate: '2026-04-10',
    estimatedNav: 0.98,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-10T16:00:00.000Z',
    createdAt: '2026-04-10T15:05:00.000Z',
    updatedAt: '2026-04-10T16:00:00.000Z',
  },
];

const decisions: Record<string, EstimateAdjustmentDecisionItem> = {
  '000001': {
    status: 'validated',
    updatedAt: '2026-04-14T09:00:00.000Z',
    history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
  },
  '000002': {
    status: 'watch',
    updatedAt: '2026-04-14T09:00:00.000Z',
    history: [{ status: 'watch', updatedAt: '2026-04-14T09:00:00.000Z' }],
  },
  '000003': {
    status: 'failed',
    updatedAt: '2026-04-14T09:00:00.000Z',
    history: [{ status: 'failed', updatedAt: '2026-04-14T09:00:00.000Z' }],
  },
};

describe('buildEstimateAdjustmentValidationSummary', () => {
  it('summarizes post-validation adjusted-vs-raw error only for validated active funds', () => {
    const summary = buildEstimateAdjustmentValidationSummary(
      snapshots,
      decisions,
      Date.parse('2026-04-16T09:00:00.000Z'),
    );

    expect(summary.validatedFundCount).toBe(1);
    expect(summary.sampleCount).toBe(2);
    expect(summary.improvedSampleCount).toBe(2);
    expect(summary.worsenedSampleCount).toBe(0);
    expect(summary.flatSampleCount).toBe(0);
    expect(summary.baselineAverageAbsoluteErrorRate).toBeCloseTo(0.03, 6);
    expect(summary.adjustedAverageAbsoluteErrorRate).toBeCloseTo(0.0048780488, 6);
    expect(summary.improvementRate).toBeCloseTo(0.8373828959, 6);
    expect(summary.funds).toEqual([
      expect.objectContaining({
        fundCode: '000001',
        fundName: '偏高基金',
        sampleCount: 2,
        improvedSampleCount: 2,
        worsenedSampleCount: 0,
        baselineAverageAbsoluteErrorRate: 0.03,
        recommendationStatus: 'keep',
        recommendationLabel: '继续保持',
      }),
    ]);
  });

  it('returns empty-safe output when there are no validated active resolved samples', () => {
    const summary = buildEstimateAdjustmentValidationSummary(snapshots, {
      '000001': {
        status: 'watch',
        updatedAt: '2026-04-14T09:00:00.000Z',
        history: [{ status: 'watch', updatedAt: '2026-04-14T09:00:00.000Z' }],
      },
    });

    expect(summary.validatedFundCount).toBe(0);
    expect(summary.sampleCount).toBe(0);
    expect(summary.baselineAverageAbsoluteErrorRate).toBeNull();
    expect(summary.adjustedAverageAbsoluteErrorRate).toBeNull();
    expect(summary.improvementRate).toBeNull();
    expect(summary.funds).toEqual([]);
  });
});

describe('getEstimateAdjustmentValidationRecommendation', () => {
  it('suggests downgrade when the latest samples worsen consecutively', () => {
    expect(
      getEstimateAdjustmentValidationRecommendation({
        sampleCount: 3,
        improvedSampleCount: 1,
        worsenedSampleCount: 2,
        flatSampleCount: 0,
        latestWorsenedStreak: 2,
        improvementRate: -0.04,
      }),
    ).toMatchObject({
      recommendationStatus: 'downgrade',
      recommendationLabel: '建议降级观察',
    });
  });
});
