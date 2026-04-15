import { describe, expect, it } from 'vitest';

import {
  buildEstimateAccuracyRecommendations,
  summarizeEstimateAccuracyDailyTrend,
  summarizeEstimateAccuracyTimeBuckets,
} from '@/lib/funds/estimate-accuracy-insights';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

const buildSnapshot = (
  overrides: Partial<EstimateAccuracySnapshot>,
): EstimateAccuracySnapshot => ({
  id: 'default',
  fundCode: '000001',
  fundName: '默认基金',
  quoteUpdatedAt: '2026-04-10 14:30',
  tradingDate: '2026-04-10',
  estimatedNav: 1,
  finalNav: 1,
  absoluteErrorRate: 0,
  resolvedAt: '2026-04-10T15:30:00.000Z',
  createdAt: '2026-04-10T14:30:00.000Z',
  updatedAt: '2026-04-10T15:30:00.000Z',
  ...overrides,
});

describe('estimate accuracy insights', () => {
  it('groups computable samples into China-market time buckets', () => {
    const buckets = summarizeEstimateAccuracyTimeBuckets([
      buildSnapshot({
        id: 'morning',
        quoteUpdatedAt: '2026-04-10 10:30',
        absoluteErrorRate: 0.01,
      }),
      buildSnapshot({
        id: 'afternoon',
        quoteUpdatedAt: '2026-04-10 13:30',
        absoluteErrorRate: 0.02,
      }),
      buildSnapshot({
        id: 'close',
        quoteUpdatedAt: '2026-04-10 14:45',
        absoluteErrorRate: 0.03,
      }),
      buildSnapshot({
        id: 'after-close',
        quoteUpdatedAt: '2026-04-10T08:05:00.000Z',
        absoluteErrorRate: 0.04,
      }),
      buildSnapshot({
        id: 'unresolved',
        quoteUpdatedAt: '2026-04-10 11:00',
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
      }),
    ]);

    expect(buckets).toHaveLength(4);
    expect(buckets[0]).toMatchObject({
      label: '盘前 / 上午',
      sampleCount: 1,
    });
    expect(buckets[0].averageAbsoluteErrorRate).toBeCloseTo(0.01);
    expect(buckets[1]).toMatchObject({
      label: '午后',
      sampleCount: 1,
    });
    expect(buckets[1].averageAbsoluteErrorRate).toBeCloseTo(0.02);
    expect(buckets[2]).toMatchObject({
      label: '尾盘',
      sampleCount: 1,
    });
    expect(buckets[2].averageAbsoluteErrorRate).toBeCloseTo(0.03);
    expect(buckets[3]).toMatchObject({
      label: '收盘后',
      sampleCount: 1,
    });
    expect(buckets[3].averageAbsoluteErrorRate).toBeCloseTo(0.04);
  });

  it('builds recent daily trend ordered by trading date descending', () => {
    const trend = summarizeEstimateAccuracyDailyTrend([
      buildSnapshot({
        id: 'd1-a',
        tradingDate: '2026-04-10',
        quoteUpdatedAt: '2026-04-10 10:30',
        absoluteErrorRate: 0.01,
      }),
      buildSnapshot({
        id: 'd1-b',
        fundCode: '000002',
        fundName: '第二只基金',
        tradingDate: '2026-04-10',
        quoteUpdatedAt: '2026-04-10 14:30',
        absoluteErrorRate: 0.03,
      }),
      buildSnapshot({
        id: 'd2',
        tradingDate: '2026-04-11',
        quoteUpdatedAt: '2026-04-11 14:30',
        absoluteErrorRate: 0.02,
      }),
      buildSnapshot({
        id: 'd3',
        tradingDate: '2026-04-12',
        quoteUpdatedAt: '2026-04-12 14:30',
        absoluteErrorRate: 0.04,
      }),
    ]);

    expect(trend).toHaveLength(3);
    expect(trend[0]).toMatchObject({
      tradingDate: '2026-04-12',
      sampleCount: 1,
      impactedFundCount: 1,
    });
    expect(trend[0].averageAbsoluteErrorRate).toBeCloseTo(0.04);
    expect(trend[1]).toMatchObject({
      tradingDate: '2026-04-11',
      sampleCount: 1,
      impactedFundCount: 1,
    });
    expect(trend[2]).toMatchObject({
      tradingDate: '2026-04-10',
      sampleCount: 2,
      impactedFundCount: 2,
    });
    expect(trend[2].averageAbsoluteErrorRate).toBeCloseTo(0.02);
  });

  it('creates actionable recommendations from diagnosis patterns', () => {
    const recommendations = buildEstimateAccuracyRecommendations([
      {
        fundCode: '000001',
        fundName: '持续偏高基金',
        sampleCount: 3,
        computableSampleCount: 3,
        averageAbsoluteErrorRate: 0.025,
        averageSignedErrorRate: 0.02,
        overestimatedCount: 3,
        underestimatedCount: 0,
        diagnosis: '持续偏高',
        priorityScore: 0.025,
        worstTradingDate: '2026-04-10',
        worstAbsoluteErrorRate: 0.03,
      },
      {
        fundCode: '000002',
        fundName: '波动基金',
        sampleCount: 3,
        computableSampleCount: 3,
        averageAbsoluteErrorRate: 0.02,
        averageSignedErrorRate: 0,
        overestimatedCount: 2,
        underestimatedCount: 1,
        diagnosis: '波动偏差',
        priorityScore: 0.02,
        worstTradingDate: '2026-04-11',
        worstAbsoluteErrorRate: 0.025,
      },
    ]);

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0]).toMatchObject({
      fundCode: '000001',
      title: '优先校正高估偏差',
    });
    expect(recommendations[0].description).toContain('指数映射');

    expect(recommendations[1]).toMatchObject({
      fundCode: '000002',
      title: '优先稳定波动型偏差',
    });
    expect(recommendations[1].description).toContain('刷新频率');
  });
});
