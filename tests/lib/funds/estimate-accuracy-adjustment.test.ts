import { describe, expect, it } from 'vitest';

import { summarizeEstimateAccuracyDiagnostics } from '@/lib/funds/estimate-accuracy-diagnostics';
import { buildEstimateAccuracyAdjustmentExperiment } from '@/lib/funds/estimate-accuracy-adjustment';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

const snapshots: EstimateAccuracySnapshot[] = [
  {
    id: 'a-1',
    fundCode: '000001',
    fundName: '高估一号',
    quoteUpdatedAt: '2026-04-10 14:30',
    tradingDate: '2026-04-10',
    estimatedNav: 1.02,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    createdAt: '2026-04-10T15:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  },
  {
    id: 'a-2',
    fundCode: '000001',
    fundName: '高估一号',
    quoteUpdatedAt: '2026-04-11 15:05',
    tradingDate: '2026-04-11',
    estimatedNav: 1.015,
    finalNav: 1,
    absoluteErrorRate: 0.015,
    resolvedAt: '2026-04-11T15:30:00.000Z',
    createdAt: '2026-04-11T15:30:00.000Z',
    updatedAt: '2026-04-11T15:30:00.000Z',
  },
  {
    id: 'b-1',
    fundCode: '000002',
    fundName: '低估二号',
    quoteUpdatedAt: '2026-04-10 10:30',
    tradingDate: '2026-04-10',
    estimatedNav: 0.99,
    finalNav: 1,
    absoluteErrorRate: 0.01,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    createdAt: '2026-04-10T15:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  },
  {
    id: 'b-2',
    fundCode: '000002',
    fundName: '低估二号',
    quoteUpdatedAt: '2026-04-11 13:30',
    tradingDate: '2026-04-11',
    estimatedNav: 0.995,
    finalNav: 1,
    absoluteErrorRate: 0.005,
    resolvedAt: '2026-04-11T15:30:00.000Z',
    createdAt: '2026-04-11T15:30:00.000Z',
    updatedAt: '2026-04-11T15:30:00.000Z',
  },
  {
    id: 'c-1',
    fundCode: '000003',
    fundName: '波动三号',
    quoteUpdatedAt: '2026-04-10 14:45',
    tradingDate: '2026-04-10',
    estimatedNav: 1.03,
    finalNav: 1,
    absoluteErrorRate: 0.03,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    createdAt: '2026-04-10T15:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  },
  {
    id: 'c-2',
    fundCode: '000003',
    fundName: '波动三号',
    quoteUpdatedAt: '2026-04-11 11:00',
    tradingDate: '2026-04-11',
    estimatedNav: 0.99,
    finalNav: 1,
    absoluteErrorRate: 0.01,
    resolvedAt: '2026-04-11T15:30:00.000Z',
    createdAt: '2026-04-11T15:30:00.000Z',
    updatedAt: '2026-04-11T15:30:00.000Z',
  },
  {
    id: 'u-1',
    fundCode: '000004',
    fundName: '未收敛四号',
    quoteUpdatedAt: '2026-04-12 14:30',
    tradingDate: '2026-04-12',
    estimatedNav: 1.01,
    finalNav: null,
    absoluteErrorRate: null,
    resolvedAt: null,
    createdAt: '2026-04-12T15:30:00.000Z',
    updatedAt: '2026-04-12T15:30:00.000Z',
  },
];

describe('buildEstimateAccuracyAdjustmentExperiment', () => {
  it('simulates diagnosis correction plus tail/after-close enhancement and compares before vs after', () => {
    const diagnostics = summarizeEstimateAccuracyDiagnostics(snapshots, 10);

    const experiment = buildEstimateAccuracyAdjustmentExperiment(snapshots, diagnostics);

    expect(experiment.sampleCount).toBe(6);
    expect(experiment.baselineAverageAbsoluteErrorRate).toBeCloseTo(0.015, 6);
    expect(experiment.recommendedScenarioKey).toBe('close_session_enhanced');
    expect(experiment.scenarios).toHaveLength(2);

    expect(experiment.scenarios[0]).toMatchObject({
      key: 'diagnosis_only',
      title: '诊断修正',
      sampleCount: 6,
    });
    expect(experiment.scenarios[0].adjustedAverageAbsoluteErrorRate).toBeCloseTo(
      0.0083252980,
      6,
    );

    expect(experiment.scenarios[1]).toMatchObject({
      key: 'close_session_enhanced',
      title: '尾盘 / 收盘后增强',
      sampleCount: 6,
    });
    expect(experiment.scenarios[1].adjustedAverageAbsoluteErrorRate).toBeCloseTo(
      0.0041383061,
      6,
    );
    expect(experiment.scenarios[1].relativeImprovementRate).toBeCloseTo(0.7241129214, 6);

    const tailBucket = experiment.bucketComparisons.find((item) => item.label === '尾盘');
    expect(tailBucket).toMatchObject({ sampleCount: 2 });
    expect(tailBucket?.baselineAverageAbsoluteErrorRate).toBeCloseTo(0.025, 6);
    expect(tailBucket?.adjustedAverageAbsoluteErrorRate).toBeCloseTo(0.0036675256, 6);

    expect(experiment.appliedRules).toEqual([
      '持续偏高/偏低基金按基金平均有符号误差做全局修正',
      '波动偏差或样本不足基金仅在尾盘/收盘后套用时段修正因子',
    ]);
  });

  it('returns empty-safe output when no computable sample exists', () => {
    const experiment = buildEstimateAccuracyAdjustmentExperiment(
      snapshots.filter((item) => item.finalNav === null),
      [],
    );

    expect(experiment.sampleCount).toBe(0);
    expect(experiment.baselineAverageAbsoluteErrorRate).toBeNull();
    expect(experiment.recommendedScenarioKey).toBeNull();
    expect(experiment.scenarios).toHaveLength(2);
    expect(experiment.bucketComparisons).toHaveLength(4);
    expect(
      experiment.bucketComparisons.every(
        (item) => item.sampleCount === 0 && item.adjustedAverageAbsoluteErrorRate === null,
      ),
    ).toBe(true);
  });
});
