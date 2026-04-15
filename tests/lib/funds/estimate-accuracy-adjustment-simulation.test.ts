import { describe, expect, it } from 'vitest';

import { summarizeEstimateAccuracyDiagnostics } from '@/lib/funds/estimate-accuracy-diagnostics';
import { buildEstimateAccuracyAdjustmentSimulation } from '@/lib/funds/estimate-accuracy-adjustment';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

describe('buildEstimateAccuracyAdjustmentSimulation', () => {
  it('simulates global, late-session, and diagnosis-aware correction experiments and picks the best improvement', () => {
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
        fundName: '轻微偏高',
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
        fundName: '收盘后回落',
        quoteUpdatedAt: '2026-04-10 15:05',
        tradingDate: '2026-04-10',
        estimatedNav: 0.98,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-10T16:00:00.000Z',
        createdAt: '2026-04-10T15:05:00.000Z',
        updatedAt: '2026-04-10T16:00:00.000Z',
      },
      {
        id: 'd-1',
        fundCode: '000004',
        fundName: '未收敛样本',
        quoteUpdatedAt: '2026-04-12 14:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.08,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T14:30:00.000Z',
      },
    ];

    const diagnostics = summarizeEstimateAccuracyDiagnostics(snapshots, 10);
    const simulation = buildEstimateAccuracyAdjustmentSimulation(snapshots, diagnostics);

    expect(simulation.baselineAverageAbsoluteErrorRate).toBeCloseTo(0.0225, 6);
    expect(simulation.bestScenarioKey).toBe('diagnosis-aware');
    expect(simulation.bestScenarioLabel).toBe('诊断 + 尾盘联动修正');
    expect(simulation.bestScenarioAdjustedAverageAbsoluteErrorRate).toBeCloseTo(0.00805654, 6);
    expect(simulation.bestScenarioImprovementRate).toBeCloseTo(0.64193153, 6);

    expect(simulation.scenarios).toHaveLength(3);
    expect(simulation.scenarios.map((item) => item.key)).toEqual([
      'global',
      'late-session',
      'diagnosis-aware',
    ]);

    expect(simulation.scenarios[0]).toMatchObject({
      label: '全局签名修正',
      sampleCount: 4,
      adjustedSampleCount: 4,
    });
    expect(simulation.scenarios[0].adjustedAverageAbsoluteErrorRate).toBeCloseTo(0.01728395, 6);

    expect(simulation.scenarios[1]).toMatchObject({
      label: '尾盘 / 收盘后专用修正',
      sampleCount: 4,
      adjustedSampleCount: 1,
    });
    expect(simulation.scenarios[1].adjustedAverageAbsoluteErrorRate).toBeCloseTo(0.0125, 6);

    expect(simulation.scenarios[2]).toMatchObject({
      label: '诊断 + 尾盘联动修正',
      sampleCount: 4,
      adjustedSampleCount: 3,
    });
    expect(simulation.scenarios[2].adjustedAverageAbsoluteErrorRate).toBeCloseTo(0.00805654, 6);

    expect(simulation.bucketInsights).toHaveLength(4);
    expect(simulation.bucketInsights[0]).toMatchObject({
      label: '盘前 / 上午',
      sampleCount: 1,
      bestScenarioKey: 'global',
      bestScenarioLabel: '全局签名修正',
    });
    expect(simulation.bucketInsights[0].baselineAverageAbsoluteErrorRate).toBeCloseTo(0.01, 6);
    expect(simulation.bucketInsights[0].bestScenarioAdjustedAverageAbsoluteErrorRate).toBeCloseTo(
      0.00246914,
      6,
    );
    expect(simulation.bucketInsights[0].bestScenarioImprovementRate).toBeCloseTo(0.75308641, 6);

    expect(simulation.bucketInsights[1]).toMatchObject({
      label: '午后',
      sampleCount: 0,
      bestScenarioKey: null,
      bestScenarioLabel: null,
    });
    expect(simulation.bucketInsights[1].baselineAverageAbsoluteErrorRate).toBeNull();

    expect(simulation.bucketInsights[2]).toMatchObject({
      label: '尾盘',
      sampleCount: 1,
      bestScenarioKey: 'late-session',
      bestScenarioLabel: '尾盘 / 收盘后专用修正',
    });
    expect(simulation.bucketInsights[2].baselineAverageAbsoluteErrorRate).toBeCloseTo(0.04, 6);
    expect(simulation.bucketInsights[2].bestScenarioAdjustedAverageAbsoluteErrorRate).toBeCloseTo(0, 6);
    expect(simulation.bucketInsights[2].bestScenarioImprovementRate).toBeCloseTo(1, 6);

    expect(simulation.bucketInsights[3]).toMatchObject({
      label: '收盘后',
      sampleCount: 2,
      bestScenarioKey: 'diagnosis-aware',
      bestScenarioLabel: '诊断 + 尾盘联动修正',
    });
    expect(simulation.bucketInsights[3].baselineAverageAbsoluteErrorRate).toBeCloseTo(0.02, 6);
    expect(simulation.bucketInsights[3].bestScenarioAdjustedAverageAbsoluteErrorRate).toBeCloseTo(
      0.01246305,
      6,
    );
    expect(simulation.bucketInsights[3].bestScenarioImprovementRate).toBeCloseTo(0.37684729, 6);

    expect(simulation.diagnosisInsights).toHaveLength(4);
    expect(simulation.diagnosisInsights[0]).toMatchObject({
      diagnosis: '持续偏高',
      sampleCount: 2,
      bestScenarioKey: 'diagnosis-aware',
      bestScenarioLabel: '诊断 + 尾盘联动修正',
    });
    expect(simulation.diagnosisInsights[0].baselineAverageAbsoluteErrorRate).toBeCloseTo(
      0.03,
      6,
    );
    expect(
      simulation.diagnosisInsights[0].bestScenarioAdjustedAverageAbsoluteErrorRate,
    ).toBeCloseTo(0.00487805, 6);
    expect(simulation.diagnosisInsights[0].bestScenarioImprovementRate).toBeCloseTo(
      0.8373829,
      6,
    );

    expect(simulation.diagnosisInsights[1]).toMatchObject({
      diagnosis: '持续偏低',
      sampleCount: 0,
      bestScenarioKey: null,
      bestScenarioLabel: null,
    });

    expect(simulation.diagnosisInsights[2]).toMatchObject({
      diagnosis: '波动偏差',
      sampleCount: 0,
      bestScenarioKey: null,
      bestScenarioLabel: null,
    });

    expect(simulation.diagnosisInsights[3]).toMatchObject({
      diagnosis: '样本不足',
      sampleCount: 2,
      bestScenarioKey: 'diagnosis-aware',
      bestScenarioLabel: '诊断 + 尾盘联动修正',
    });
    expect(simulation.diagnosisInsights[3].baselineAverageAbsoluteErrorRate).toBeCloseTo(0.015, 6);
    expect(
      simulation.diagnosisInsights[3].bestScenarioAdjustedAverageAbsoluteErrorRate,
    ).toBeCloseTo(0.01123457, 6);
    expect(simulation.diagnosisInsights[3].bestScenarioImprovementRate).toBeCloseTo(
      0.25102881,
      6,
    );

    expect(simulation.fundInsights).toHaveLength(3);
    expect(simulation.fundInsights[0]).toMatchObject({
      fundCode: '000001',
      fundName: '偏高基金',
      diagnosis: '持续偏高',
      sampleCount: 2,
      bestScenarioKey: 'diagnosis-aware',
      bestScenarioLabel: '诊断 + 尾盘联动修正',
      recommendationStatus: 'priority',
      recommendationLabel: '优先验证',
    });
    expect(simulation.fundInsights[0].baselineAverageAbsoluteErrorRate).toBeCloseTo(0.03, 6);
    expect(simulation.fundInsights[0].bestScenarioAdjustedAverageAbsoluteErrorRate).toBeCloseTo(
      0.00487805,
      6,
    );
    expect(simulation.fundInsights[0].bestScenarioImprovementRate).toBeCloseTo(0.8373829, 6);

    expect(simulation.fundInsights[1]).toMatchObject({
      fundCode: '000002',
      fundName: '轻微偏高',
      diagnosis: '样本不足',
      sampleCount: 1,
      bestScenarioKey: 'global',
      bestScenarioLabel: '全局签名修正',
      recommendationStatus: 'collect-more',
      recommendationLabel: '继续收集样本',
    });
    expect(simulation.fundInsights[1].baselineAverageAbsoluteErrorRate).toBeCloseTo(0.01, 6);
    expect(simulation.fundInsights[1].bestScenarioAdjustedAverageAbsoluteErrorRate).toBeCloseTo(
      0.00246914,
      6,
    );
    expect(simulation.fundInsights[1].bestScenarioImprovementRate).toBeCloseTo(0.75308641, 6);

    expect(simulation.fundInsights[2]).toMatchObject({
      fundCode: '000003',
      fundName: '收盘后回落',
      diagnosis: '样本不足',
      sampleCount: 1,
      bestScenarioKey: 'late-session',
      bestScenarioLabel: '尾盘 / 收盘后专用修正',
      recommendationStatus: 'not-recommended',
      recommendationLabel: '暂不建议修正',
    });
    expect(simulation.fundInsights[2].baselineAverageAbsoluteErrorRate).toBeCloseTo(0.02, 6);
    expect(simulation.fundInsights[2].bestScenarioAdjustedAverageAbsoluteErrorRate).toBeCloseTo(
      0.02,
      6,
    );
    expect(simulation.fundInsights[2].bestScenarioImprovementRate).toBeCloseTo(0, 6);
  });

  it('returns empty improvement metrics when there are no computable resolved samples', () => {
    const diagnostics = summarizeEstimateAccuracyDiagnostics([], 10);
    const simulation = buildEstimateAccuracyAdjustmentSimulation([], diagnostics);

    expect(simulation.baselineAverageAbsoluteErrorRate).toBeNull();
    expect(simulation.bestScenarioKey).toBeNull();
    expect(simulation.bestScenarioLabel).toBeNull();
    expect(simulation.bestScenarioAdjustedAverageAbsoluteErrorRate).toBeNull();
    expect(simulation.bestScenarioImprovementRate).toBeNull();
    expect(simulation.scenarios).toHaveLength(3);
    expect(simulation.scenarios.every((item) => item.adjustedAverageAbsoluteErrorRate === null)).toBe(true);
    expect(simulation.bucketInsights).toHaveLength(4);
    expect(simulation.bucketInsights.every((item) => item.bestScenarioKey === null)).toBe(true);
    expect(simulation.diagnosisInsights).toHaveLength(4);
    expect(simulation.diagnosisInsights.every((item) => item.bestScenarioKey === null)).toBe(true);
    expect(simulation.fundInsights).toEqual([]);
  });
});
