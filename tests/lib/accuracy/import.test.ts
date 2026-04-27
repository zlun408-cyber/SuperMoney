import { describe, expect, it } from 'vitest';

import { buildAccuracyJsonExport } from '@/lib/accuracy/export';
import {
  AccuracyImportValidationError,
  applyAccuracyImport,
  dryRunAccuracyImport,
  parseAccuracyImport,
} from '@/lib/accuracy/import';
import type { EstimateAccuracySnapshot, EstimateAdjustmentDecisionItem } from '@/lib/funds/types';

const snapshot = (
  overrides: Partial<EstimateAccuracySnapshot> & Pick<EstimateAccuracySnapshot, 'id' | 'fundCode' | 'fundName' | 'quoteUpdatedAt' | 'tradingDate' | 'estimatedNav' | 'createdAt' | 'updatedAt'>,
): EstimateAccuracySnapshot => ({
  finalNav: null,
  absoluteErrorRate: null,
  resolvedAt: null,
  ...overrides,
});

const decision = (
  overrides: Partial<EstimateAdjustmentDecisionItem> & Pick<EstimateAdjustmentDecisionItem, 'status' | 'updatedAt' | 'history'>,
): EstimateAdjustmentDecisionItem => ({
  ...overrides,
});

describe('accuracy import parsing', () => {
  it('validates a v1 export and maps snapshots / decisions back to internal models', () => {
    const payload = buildAccuracyJsonExport({
      snapshots: [
        snapshot({
          id: '000001::2026-04-13 14:30',
          fundCode: '000001',
          fundName: '基金A',
          quoteUpdatedAt: '2026-04-13 14:30',
          tradingDate: '2026-04-13',
          estimatedNav: 1.02,
          finalNav: 1,
          absoluteErrorRate: 0.02,
          resolvedAt: '2026-04-13T15:30:00.000Z',
          createdAt: '2026-04-13 14:30',
          updatedAt: '2026-04-13T15:30:00.000Z',
        }),
      ],
      decisions: {
        '000001': decision({
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [
            { status: 'verification', updatedAt: '2026-04-14T08:00:00.000Z' },
            { status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' },
          ],
        }),
      },
      source: {
        mode: 'cloud',
        userId: 'user-1',
      },
    });

    expect(parseAccuracyImport(payload)).toEqual({
      schemaVersion: 'accuracy-export/v1',
      source: {
        app: 'SuperFinance',
        mode: 'cloud',
        userId: 'user-1',
      },
      snapshots: [
        {
          id: '000001::2026-04-13 14:30',
          fundCode: '000001',
          fundName: '基金A',
          quoteUpdatedAt: '2026-04-13 14:30',
          tradingDate: '2026-04-13',
          estimatedNav: 1.02,
          finalNav: 1,
          absoluteErrorRate: 0.02,
          resolvedAt: '2026-04-13T15:30:00.000Z',
          createdAt: '2026-04-13 14:30',
          updatedAt: '2026-04-13T15:30:00.000Z',
        },
      ],
      decisions: {
        '000001': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [
            { status: 'verification', updatedAt: '2026-04-14T08:00:00.000Z' },
            { status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' },
          ],
        },
      },
    });
  });

  it('rejects invalid top-level contract and malformed snapshot data', () => {
    expect(() =>
      parseAccuracyImport({
        schemaVersion: 'accuracy-export/v0',
        source: {
          app: 'OtherApp',
          mode: 'desktop',
        },
        snapshots: [
          {
            snapshotKey: '000001::2026-04-13 14:30',
            fundCode: '000001',
            fundName: '基金A',
            quoteUpdatedAt: '2026-04-13 14:30',
            tradingDate: '2026-04-12',
            estimatedNav: 1.02,
            finalNav: 1,
            absoluteErrorRate: null,
            resolvedAt: null,
            createdAt: '2026-04-13 14:30',
            updatedAt: '2026-04-13T15:30:00.000Z',
          },
        ],
        adjustmentDecisions: {},
      }),
    ).toThrow(AccuracyImportValidationError);

    try {
      parseAccuracyImport({
        schemaVersion: 'accuracy-export/v1',
        source: {
          app: 'SuperFinance',
          mode: 'local',
        },
        snapshots: [
          {
            snapshotKey: '000001::2026-04-13 14:30',
            fundCode: '000001',
            fundName: '基金A',
            quoteUpdatedAt: '2026-04-13 14:30',
            tradingDate: '2026-04-12',
            estimatedNav: 1.02,
            finalNav: 1,
            absoluteErrorRate: null,
            resolvedAt: null,
            createdAt: '2026-04-13 14:30',
            updatedAt: '2026-04-13T15:30:00.000Z',
          },
        ],
        adjustmentDecisions: [],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AccuracyImportValidationError);
      expect((error as AccuracyImportValidationError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'snapshots[0]', message: expect.stringContaining('resolved snapshots') }),
          expect.objectContaining({ path: 'snapshots[0].tradingDate', message: expect.stringContaining('must match') }),
        ]),
      );
    }
  });
});

describe('accuracy import dry-run and apply', () => {
  const currentSnapshots: EstimateAccuracySnapshot[] = [
    snapshot({
      id: '000001::2026-04-13 14:30',
      fundCode: '000001',
      fundName: '基金A',
      quoteUpdatedAt: '2026-04-13 14:30',
      tradingDate: '2026-04-13',
      estimatedNav: 1.02,
      createdAt: '2026-04-13 14:30',
      updatedAt: '2026-04-13 14:30',
    }),
    snapshot({
      id: '000003::2026-04-14 14:30',
      fundCode: '000003',
      fundName: '基金C',
      quoteUpdatedAt: '2026-04-14 14:30',
      tradingDate: '2026-04-14',
      estimatedNav: 1.03,
      createdAt: '2026-04-14 14:30',
      updatedAt: '2026-04-14 14:30',
    }),
    snapshot({
      id: '000004::2026-04-15 14:30',
      fundCode: '000004',
      fundName: '基金D',
      quoteUpdatedAt: '2026-04-15 14:30',
      tradingDate: '2026-04-15',
      estimatedNav: 1.04,
      finalNav: 1,
      absoluteErrorRate: 0.04,
      resolvedAt: '2026-04-15T15:30:00.000Z',
      createdAt: '2026-04-15 14:30',
      updatedAt: '2026-04-15T15:30:00.000Z',
    }),
  ];

  const currentDecisions: Record<string, EstimateAdjustmentDecisionItem> = {
    '000001': decision({
      status: 'validated',
      updatedAt: '2026-04-14T09:00:00.000Z',
      history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
    }),
    '000003': decision({
      status: 'watch',
      updatedAt: '2026-04-14T08:00:00.000Z',
      history: [{ status: 'watch', updatedAt: '2026-04-14T08:00:00.000Z' }],
    }),
    '000004': decision({
      status: 'watch',
      updatedAt: '2026-04-15T09:00:00.000Z',
      history: [{ status: 'watch', updatedAt: '2026-04-15T09:00:00.000Z' }],
    }),
  };

  const payload = buildAccuracyJsonExport({
    snapshots: [
      snapshot({
        id: '000001::2026-04-13 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-13 14:30',
        tradingDate: '2026-04-13',
        estimatedNav: 1.02,
        createdAt: '2026-04-13 14:30',
        updatedAt: '2026-04-13 14:30',
      }),
      snapshot({
        id: '000002::2026-04-16 14:30',
        fundCode: '000002',
        fundName: '基金B',
        quoteUpdatedAt: '2026-04-16 14:30',
        tradingDate: '2026-04-16',
        estimatedNav: 1.01,
        createdAt: '2026-04-16 14:30',
        updatedAt: '2026-04-16 14:30',
      }),
      snapshot({
        id: '000003::2026-04-14 14:30',
        fundCode: '000003',
        fundName: '基金C',
        quoteUpdatedAt: '2026-04-14 14:30',
        tradingDate: '2026-04-14',
        estimatedNav: 1.03,
        finalNav: 1,
        absoluteErrorRate: 0.03,
        resolvedAt: '2026-04-14T15:30:00.000Z',
        createdAt: '2026-04-14 14:30',
        updatedAt: '2026-04-14T15:30:00.000Z',
      }),
      snapshot({
        id: '000004::2026-04-15 14:30',
        fundCode: '000004',
        fundName: '基金D',
        quoteUpdatedAt: '2026-04-15 14:30',
        tradingDate: '2026-04-15',
        estimatedNav: 1.04,
        finalNav: 1.01,
        absoluteErrorRate: 0.02970297,
        resolvedAt: '2026-04-15T15:31:00.000Z',
        createdAt: '2026-04-15 14:30',
        updatedAt: '2026-04-15T15:31:00.000Z',
      }),
    ],
    decisions: {
      '000001': decision({
        status: 'validated',
        updatedAt: '2026-04-14T09:00:00.000Z',
        history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
      }),
      '000003': decision({
        status: 'validated',
        updatedAt: '2026-04-14T10:00:00.000Z',
        history: [
          { status: 'watch', updatedAt: '2026-04-14T08:00:00.000Z' },
          { status: 'validated', updatedAt: '2026-04-14T10:00:00.000Z' },
        ],
      }),
      '000004': decision({
        status: 'failed',
        updatedAt: '2026-04-15T09:00:00.000Z',
        history: [{ status: 'failed', updatedAt: '2026-04-15T09:00:00.000Z' }],
      }),
      '000005': decision({
        status: 'verification',
        updatedAt: '2026-04-16T09:00:00.000Z',
        history: [{ status: 'verification', updatedAt: '2026-04-16T09:00:00.000Z' }],
      }),
    },
    source: {
      mode: 'cloud',
      userId: 'user-1',
    },
  });

  it('reports appendOnly dry-run stats for snapshots and decisions', () => {
    const result = dryRunAccuracyImport({
      payload,
      currentSnapshots,
      currentDecisions,
    });

    expect(result.summary).toEqual({
      strategy: 'appendOnly',
      snapshots: {
        total: 4,
        new: 1,
        upgraded: 1,
        duplicate: 1,
        conflict: 1,
        applied: 2,
      },
      decisions: {
        total: 4,
        new: 1,
        upgraded: 1,
        duplicate: 1,
        conflict: 1,
        applied: 2,
      },
      fundCount: 5,
      dateRange: {
        startTradingDate: '2026-04-13',
        endTradingDate: '2026-04-16',
      },
    });
  });

  it('applies appendOnly import without overwriting conflicts', () => {
    const result = applyAccuracyImport({
      payload,
      currentSnapshots,
      currentDecisions,
    });

    expect(result.summary.snapshots.applied).toBe(2);
    expect(result.summary.decisions.applied).toBe(2);
    expect(result.nextSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '000002::2026-04-16 14:30', fundCode: '000002' }),
        expect.objectContaining({
          id: '000003::2026-04-14 14:30',
          fundCode: '000003',
          finalNav: 1,
          absoluteErrorRate: 0.03,
        }),
        expect.objectContaining({
          id: '000004::2026-04-15 14:30',
          finalNav: 1,
          absoluteErrorRate: 0.04,
        }),
      ]),
    );
    expect(result.nextSnapshots).toHaveLength(4);
    expect(result.nextDecisions).toEqual({
      '000001': currentDecisions['000001'] as EstimateAdjustmentDecisionItem,
      '000003': {
        status: 'validated',
        updatedAt: '2026-04-14T10:00:00.000Z',
        history: [
          { status: 'watch', updatedAt: '2026-04-14T08:00:00.000Z' },
          { status: 'validated', updatedAt: '2026-04-14T10:00:00.000Z' },
        ],
      },
      '000004': currentDecisions['000004'] as EstimateAdjustmentDecisionItem,
      '000005': {
        status: 'verification',
        updatedAt: '2026-04-16T09:00:00.000Z',
        history: [{ status: 'verification', updatedAt: '2026-04-16T09:00:00.000Z' }],
      },
    });
  });
});
