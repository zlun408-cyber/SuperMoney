import { describe, expect, it } from 'vitest';

import { summarizeEstimateAccuracyDiagnostics } from '@/lib/funds/estimate-accuracy-diagnostics';
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

describe('summarizeEstimateAccuracyDiagnostics', () => {
  it('classifies high-error funds into persistent high, persistent low, and volatile patterns', () => {
    const diagnostics = summarizeEstimateAccuracyDiagnostics([
      buildSnapshot({
        id: 'high-1',
        fundCode: '000001',
        fundName: '持续偏高基金',
        tradingDate: '2026-04-10',
        estimatedNav: 1.04,
        finalNav: 1,
        absoluteErrorRate: 0.04,
      }),
      buildSnapshot({
        id: 'high-2',
        fundCode: '000001',
        fundName: '持续偏高基金',
        tradingDate: '2026-04-11',
        quoteUpdatedAt: '2026-04-11 14:30',
        estimatedNav: 1.03,
        finalNav: 1,
        absoluteErrorRate: 0.03,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      }),
      buildSnapshot({
        id: 'low-1',
        fundCode: '000002',
        fundName: '持续偏低基金',
        tradingDate: '2026-04-10',
        estimatedNav: 0.96,
        finalNav: 1,
        absoluteErrorRate: 0.04,
      }),
      buildSnapshot({
        id: 'low-2',
        fundCode: '000002',
        fundName: '持续偏低基金',
        tradingDate: '2026-04-11',
        quoteUpdatedAt: '2026-04-11 14:30',
        estimatedNav: 0.98,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      }),
      buildSnapshot({
        id: 'volatile-1',
        fundCode: '000003',
        fundName: '波动型基金',
        tradingDate: '2026-04-10',
        estimatedNav: 1.03,
        finalNav: 1,
        absoluteErrorRate: 0.03,
      }),
      buildSnapshot({
        id: 'volatile-2',
        fundCode: '000003',
        fundName: '波动型基金',
        tradingDate: '2026-04-11',
        quoteUpdatedAt: '2026-04-11 14:30',
        estimatedNav: 0.97,
        finalNav: 1,
        absoluteErrorRate: 0.03,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      }),
    ]);

    expect(diagnostics).toHaveLength(3);

    expect(diagnostics[0]).toMatchObject({
      fundCode: '000001',
      diagnosis: '持续偏高',
      overestimatedCount: 2,
      underestimatedCount: 0,
      worstTradingDate: '2026-04-10',
    });
    expect(diagnostics[0].averageAbsoluteErrorRate).toBeCloseTo(0.035);
    expect(diagnostics[0].averageSignedErrorRate).toBeCloseTo(0.035);
    expect(diagnostics[0].priorityScore).toBeCloseTo(0.035);

    expect(diagnostics[1]).toMatchObject({
      fundCode: '000003',
      diagnosis: '波动偏差',
      overestimatedCount: 1,
      underestimatedCount: 1,
      worstTradingDate: '2026-04-10',
    });
    expect(diagnostics[1].averageAbsoluteErrorRate).toBeCloseTo(0.03);
    expect(diagnostics[1].averageSignedErrorRate).toBeCloseTo(0);
    expect(diagnostics[1].priorityScore).toBeCloseTo(0.03);

    expect(diagnostics[2]).toMatchObject({
      fundCode: '000002',
      diagnosis: '持续偏低',
      overestimatedCount: 0,
      underestimatedCount: 2,
      worstTradingDate: '2026-04-10',
    });
    expect(diagnostics[2].averageAbsoluteErrorRate).toBeCloseTo(0.03);
    expect(diagnostics[2].averageSignedErrorRate).toBeCloseTo(-0.03);
    expect(diagnostics[2].priorityScore).toBeCloseTo(0.03);
  });

  it('treats funds with fewer than two computable samples as insufficient', () => {
    const diagnostics = summarizeEstimateAccuracyDiagnostics([
      buildSnapshot({
        id: 'insufficient-1',
        fundCode: '000004',
        fundName: '样本不足基金',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
      }),
      buildSnapshot({
        id: 'insufficient-2',
        fundCode: '000004',
        fundName: '样本不足基金',
        tradingDate: '2026-04-11',
        quoteUpdatedAt: '2026-04-11 14:30',
        estimatedNav: 1.01,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T14:30:00.000Z',
      }),
    ]);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      fundCode: '000004',
      diagnosis: '样本不足',
      computableSampleCount: 1,
      worstTradingDate: '2026-04-10',
    });
    expect(diagnostics[0].averageAbsoluteErrorRate).toBeCloseTo(0.02);
    expect(diagnostics[0].averageSignedErrorRate).toBeCloseTo(0.02);
  });
});
