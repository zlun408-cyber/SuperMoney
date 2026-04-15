import { describe, expect, it } from 'vitest';

import { summarizeEstimateAccuracyDiagnostics } from '@/lib/funds/estimate-accuracy-diagnostics';
import {
  buildEstimateAccuracyStrategy,
  buildEstimateAccuracySourceModel,
} from '@/lib/funds/estimate-accuracy-source-model';
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

describe('estimate accuracy source model', () => {
  it('summarizes dominant pattern, time bucket, trading date, and unresolved pressure', () => {
    const snapshots = [
      buildSnapshot({
        id: 'a-1',
        fundCode: '000001',
        fundName: '持续偏高基金',
        quoteUpdatedAt: '2026-04-10 14:40',
        tradingDate: '2026-04-10',
        estimatedNav: 1.03,
        finalNav: 1,
        absoluteErrorRate: 0.03,
      }),
      buildSnapshot({
        id: 'a-2',
        fundCode: '000001',
        fundName: '持续偏高基金',
        quoteUpdatedAt: '2026-04-11 14:45',
        tradingDate: '2026-04-11',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      }),
      buildSnapshot({
        id: 'b-1',
        fundCode: '000002',
        fundName: '持续偏低基金',
        quoteUpdatedAt: '2026-04-10 10:30',
        tradingDate: '2026-04-10',
        estimatedNav: 0.99,
        finalNav: 1,
        absoluteErrorRate: 0.01,
      }),
      buildSnapshot({
        id: 'c-1',
        fundCode: '000003',
        fundName: '未收敛基金',
        quoteUpdatedAt: '2026-04-12 11:00',
        tradingDate: '2026-04-12',
        estimatedNav: 1.01,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T11:00:00.000Z',
        updatedAt: '2026-04-12T11:00:00.000Z',
      }),
    ];

    const diagnostics = summarizeEstimateAccuracyDiagnostics(snapshots, 5);
    const model = buildEstimateAccuracySourceModel(snapshots, diagnostics);

    expect(model.dominantDiagnosis).toMatchObject({
      label: '持续偏高主导',
      affectedFundCount: 1,
    });
    expect(model.dominantDiagnosis.averageAbsoluteErrorRate).toBeCloseTo(0.025);

    expect(model.riskiestTimeBucket).toMatchObject({
      label: '尾盘',
      sampleCount: 2,
    });
    expect(model.riskiestTimeBucket.averageAbsoluteErrorRate).toBeCloseTo(0.025);

    expect(model.riskiestTradingDate).toMatchObject({
      tradingDate: '2026-04-11',
      sampleCount: 1,
      impactedFundCount: 1,
    });
    expect(model.riskiestTradingDate.averageAbsoluteErrorRate).toBeCloseTo(0.02);

    expect(model.unresolvedPressure).toMatchObject({
      unresolvedSampleCount: 1,
      unresolvedRatio: 0.25,
    });
  });

  it('builds strategy items from the source model', () => {
    const snapshots = [
      buildSnapshot({
        id: 'a-1',
        fundCode: '000001',
        fundName: '持续偏高基金',
        quoteUpdatedAt: '2026-04-10 14:40',
        tradingDate: '2026-04-10',
        estimatedNav: 1.03,
        finalNav: 1,
        absoluteErrorRate: 0.03,
      }),
      buildSnapshot({
        id: 'a-2',
        fundCode: '000001',
        fundName: '持续偏高基金',
        quoteUpdatedAt: '2026-04-11 14:45',
        tradingDate: '2026-04-11',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      }),
      buildSnapshot({
        id: 'c-1',
        fundCode: '000003',
        fundName: '未收敛基金',
        quoteUpdatedAt: '2026-04-12 11:00',
        tradingDate: '2026-04-12',
        estimatedNav: 1.01,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T11:00:00.000Z',
        updatedAt: '2026-04-12T11:00:00.000Z',
      }),
    ];

    const diagnostics = summarizeEstimateAccuracyDiagnostics(snapshots, 5);
    const model = buildEstimateAccuracySourceModel(snapshots, diagnostics);
    const strategy = buildEstimateAccuracyStrategy(model);

    expect(strategy).toHaveLength(3);
    expect(strategy[0].title).toBe('先修系统性高估');
    expect(strategy[0].description).toContain('持续偏高');
    expect(strategy[1].title).toBe('重点优化尾盘链路');
    expect(strategy[1].description).toContain('尾盘');
    expect(strategy[2].title).toBe('继续补齐收敛样本');
    expect(strategy[2].description).toContain('未收敛');
  });
});
