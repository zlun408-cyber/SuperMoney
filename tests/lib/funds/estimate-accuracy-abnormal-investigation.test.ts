import { describe, expect, it } from 'vitest';

import { buildEstimateAccuracyAbnormalInvestigationItems } from '@/lib/funds/estimate-accuracy-abnormal-investigation';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

describe('buildEstimateAccuracyAbnormalInvestigationItems', () => {
  it('sorts abnormal funds by severity and keeps multiple anomaly tags on the same fund', () => {
    const snapshots: EstimateAccuracySnapshot[] = [
      {
        id: 'bias-1',
        fundCode: '000001',
        fundName: '连续偏高基金',
        quoteUpdatedAt: '2026-04-10 10:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.05,
        finalNav: 1,
        absoluteErrorRate: 0.05,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T10:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'bias-2',
        fundCode: '000001',
        fundName: '连续偏高基金',
        quoteUpdatedAt: '2026-04-11 10:30',
        tradingDate: '2026-04-11',
        estimatedNav: 1.03,
        finalNav: 1,
        absoluteErrorRate: 0.03,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T10:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
      {
        id: 'bias-3',
        fundCode: '000001',
        fundName: '连续偏高基金',
        quoteUpdatedAt: '2026-04-12 10:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.02,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T10:30:00.000Z',
        updatedAt: '2026-04-12T10:30:00.000Z',
      },
      {
        id: 'error-1',
        fundCode: '000002',
        fundName: '高误差基金',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.03,
        finalNav: 1,
        absoluteErrorRate: 0.03,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'error-2',
        fundCode: '000002',
        fundName: '高误差基金',
        quoteUpdatedAt: '2026-04-11 14:30',
        tradingDate: '2026-04-11',
        estimatedNav: 0.97,
        finalNav: 1,
        absoluteErrorRate: 0.03,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
      {
        id: 'pending-1',
        fundCode: '000003',
        fundName: '待收敛基金',
        quoteUpdatedAt: '2026-04-12 15:05',
        tradingDate: '2026-04-12',
        estimatedNav: 1.01,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T15:05:00.000Z',
        updatedAt: '2026-04-12T15:05:00.000Z',
      },
      {
        id: 'pending-2',
        fundCode: '000003',
        fundName: '待收敛基金',
        quoteUpdatedAt: '2026-04-13 15:05',
        tradingDate: '2026-04-13',
        estimatedNav: 1.02,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-13T15:05:00.000Z',
        updatedAt: '2026-04-13T15:05:00.000Z',
      },
    ];

    const items = buildEstimateAccuracyAbnormalInvestigationItems(snapshots);

    expect(items).toHaveLength(3);
    expect(items[0]?.fundCode).toBe('000001');
    expect(items[0]?.severityLabel).toBe('连续偏差');
    expect(items[0]?.tags).toEqual(['连续偏差', '高误差', '未收敛']);
    expect(items[0]?.unresolvedSampleCount).toBe(1);
    expect(items[1]?.fundCode).toBe('000002');
    expect(items[1]?.severityLabel).toBe('高误差');
    expect(items[1]?.tags).toEqual(['高误差']);
    expect(items[2]?.fundCode).toBe('000003');
    expect(items[2]?.severityLabel).toBe('未收敛');
    expect(items[2]?.tags).toEqual(['未收敛']);
  });

  it('returns an empty list when no fund matches abnormal conditions', () => {
    const snapshots: EstimateAccuracySnapshot[] = [
      {
        id: 'safe-1',
        fundCode: '000010',
        fundName: '正常基金',
        quoteUpdatedAt: '2026-04-10 10:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.004,
        finalNav: 1,
        absoluteErrorRate: 0.004,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T10:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'safe-2',
        fundCode: '000010',
        fundName: '正常基金',
        quoteUpdatedAt: '2026-04-11 10:30',
        tradingDate: '2026-04-11',
        estimatedNav: 0.996,
        finalNav: 1,
        absoluteErrorRate: 0.004,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T10:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
    ];

    expect(buildEstimateAccuracyAbnormalInvestigationItems(snapshots)).toEqual([]);
  });
});
