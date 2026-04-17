import { describe, expect, it } from 'vitest';

import type { EstimateAccuracySnapshot, EstimateAdjustmentDecisionItem } from '@/lib/funds/types';
import {
  buildAccuracyCsvExportFiles,
  buildAccuracyJsonExport,
  buildZipArchive,
} from '@/lib/accuracy/export';

const snapshots: EstimateAccuracySnapshot[] = [
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
  {
    id: '000002::2026-04-13T07:10:00.000Z',
    fundCode: '000002',
    fundName: '基金B',
    quoteUpdatedAt: '2026-04-13T07:10:00.000Z',
    tradingDate: '2026-04-13',
    estimatedNav: 0.98,
    finalNav: null,
    absoluteErrorRate: null,
    resolvedAt: null,
    createdAt: '2026-04-13T07:10:00.000Z',
    updatedAt: '2026-04-13T07:10:00.000Z',
  },
];

const decisions: Record<string, EstimateAdjustmentDecisionItem> = {
  '000001': {
    status: 'validated',
    updatedAt: '2026-04-14T09:00:00.000Z',
    history: [
      { status: 'verification', updatedAt: '2026-04-14T08:00:00.000Z' },
      { status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' },
    ],
  },
};

describe('accuracy export builders', () => {
  it('builds a JSON export with normalized snapshots and derived sections', () => {
    const exportedAt = '2026-04-17T12:00:00.000Z';

    expect(
      buildAccuracyJsonExport({
        snapshots,
        decisions,
        source: {
          mode: 'cloud',
          userId: 'user-1',
        },
        exportedAt,
      }),
    ).toEqual({
      schemaVersion: 'accuracy-export/v1',
      exportedAt,
      source: {
        app: 'SuperFinance',
        mode: 'cloud',
        userId: 'user-1',
      },
      filters: {
        fundCodes: null,
        startTradingDate: null,
        endTradingDate: null,
        includeDerived: true,
      },
      snapshots: [
        {
          snapshotKey: '000001::2026-04-13 14:30',
          fundCode: '000001',
          fundName: '基金A',
          quoteUpdatedAt: '2026-04-13 14:30',
          quoteUpdatedAtUtc: '2026-04-13T06:30:00.000Z',
          quoteTimeSemantics: 'china_local',
          tradingDate: '2026-04-13',
          estimatedNav: 1.02,
          finalNav: 1,
          absoluteErrorRate: 0.02,
          resolvedAt: '2026-04-13T15:30:00.000Z',
          createdAt: '2026-04-13 14:30',
          updatedAt: '2026-04-13T15:30:00.000Z',
          resolved: true,
        },
        {
          snapshotKey: '000002::2026-04-13T07:10:00.000Z',
          fundCode: '000002',
          fundName: '基金B',
          quoteUpdatedAt: '2026-04-13T07:10:00.000Z',
          quoteUpdatedAtUtc: '2026-04-13T07:10:00.000Z',
          quoteTimeSemantics: 'absolute',
          tradingDate: '2026-04-13',
          estimatedNav: 0.98,
          finalNav: null,
          absoluteErrorRate: null,
          resolvedAt: null,
          createdAt: '2026-04-13T07:10:00.000Z',
          updatedAt: '2026-04-13T07:10:00.000Z',
          resolved: false,
        },
      ],
      fundSummaries: [
        {
          fundCode: '000001',
          fundName: '基金A',
          sampleCount: 1,
          resolvedSampleCount: 1,
          resolvedTradingDayCount: 1,
          highErrorResolvedSampleCount: 1,
          averageAbsoluteErrorRate: 0.02,
          latestQuoteUpdatedAt: '2026-04-13 14:30',
          latestResolvedAt: '2026-04-13T15:30:00.000Z',
          confidenceLevel: 'low',
        },
        {
          fundCode: '000002',
          fundName: '基金B',
          sampleCount: 1,
          resolvedSampleCount: 0,
          resolvedTradingDayCount: 0,
          highErrorResolvedSampleCount: 0,
          averageAbsoluteErrorRate: null,
          latestQuoteUpdatedAt: '2026-04-13T07:10:00.000Z',
          latestResolvedAt: null,
          confidenceLevel: 'unknown',
        },
      ],
      diagnostics: [
        {
          fundCode: '000001',
          fundName: '基金A',
          sampleCount: 1,
          computableSampleCount: 1,
          averageAbsoluteErrorRate: 0.02,
          averageSignedErrorRate: 0.02,
          overestimatedCount: 1,
          underestimatedCount: 0,
          diagnosis: '样本不足',
          priorityScore: 0.02,
          worstTradingDate: '2026-04-13',
          worstAbsoluteErrorRate: 0.02,
        },
        {
          fundCode: '000002',
          fundName: '基金B',
          sampleCount: 1,
          computableSampleCount: 0,
          averageAbsoluteErrorRate: null,
          averageSignedErrorRate: null,
          overestimatedCount: 0,
          underestimatedCount: 0,
          diagnosis: '样本不足',
          priorityScore: -1,
          worstTradingDate: null,
          worstAbsoluteErrorRate: null,
        },
      ],
      adjustmentDecisions: [
        {
          fundCode: '000001',
          fundName: '基金A',
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [
            { status: 'verification', updatedAt: '2026-04-14T08:00:00.000Z' },
            { status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' },
          ],
        },
      ],
    });
  });

  it('builds CSV files with fixed column order, empty null cells, and flattened history', () => {
    const files = buildAccuracyCsvExportFiles({
      snapshots,
      decisions,
    });

    expect(files.map((file) => file.name)).toEqual([
      'accuracy_snapshots.csv',
      'accuracy_fund_summaries.csv',
      'accuracy_diagnostics.csv',
      'accuracy_adjustment_decisions.csv',
      'accuracy_adjustment_decision_history.csv',
    ]);

    expect(files[0]?.content).toBe(
      [
        'snapshot_key,fund_code,fund_name,quote_updated_at_raw,quote_updated_at_utc,quote_time_semantics,trading_date,estimated_nav,final_nav,absolute_error_rate,resolved_at,created_at,updated_at,resolved',
        '000001::2026-04-13 14:30,000001,基金A,2026-04-13 14:30,2026-04-13T06:30:00.000Z,china_local,2026-04-13,1.02,1,0.02,2026-04-13T15:30:00.000Z,2026-04-13 14:30,2026-04-13T15:30:00.000Z,true',
        '000002::2026-04-13T07:10:00.000Z,000002,基金B,2026-04-13T07:10:00.000Z,2026-04-13T07:10:00.000Z,absolute,2026-04-13,0.98,,,,2026-04-13T07:10:00.000Z,2026-04-13T07:10:00.000Z,false',
      ].join('\n'),
    );

    expect(files[3]?.content).toBe(
      [
        'fund_code,fund_name,status,updated_at,history_count',
        '000001,基金A,validated,2026-04-14T09:00:00.000Z,2',
      ].join('\n'),
    );
    expect(files[4]?.content).toBe(
      [
        'fund_code,status,updated_at,sequence',
        '000001,verification,2026-04-14T08:00:00.000Z,1',
        '000001,validated,2026-04-14T09:00:00.000Z,2',
      ].join('\n'),
    );
  });

  it('builds a ZIP archive containing each CSV file', () => {
    const archive = buildZipArchive([
      { name: 'accuracy_snapshots.csv', content: 'a,b\n1,2' },
      { name: 'accuracy_diagnostics.csv', content: 'c,d\n3,4' },
    ]);

    expect(archive[0]).toBe(0x50);
    expect(archive[1]).toBe(0x4b);

    const text = new TextDecoder().decode(archive);
    expect(text).toContain('accuracy_snapshots.csv');
    expect(text).toContain('accuracy_diagnostics.csv');
  });

  it('filters export payload by fund codes and trading date range', () => {
    expect(
      buildAccuracyJsonExport({
        snapshots: [
          ...snapshots,
          {
            id: '000001::2026-04-15 14:30',
            fundCode: '000001',
            fundName: '基金A',
            quoteUpdatedAt: '2026-04-15 14:30',
            tradingDate: '2026-04-15',
            estimatedNav: 1.01,
            finalNav: 1,
            absoluteErrorRate: 0.01,
            resolvedAt: '2026-04-15T15:30:00.000Z',
            createdAt: '2026-04-15 14:30',
            updatedAt: '2026-04-15T15:30:00.000Z',
          },
        ],
        decisions: {
          ...decisions,
          '000002': {
            status: 'watch',
            updatedAt: '2026-04-14T10:00:00.000Z',
            history: [{ status: 'watch', updatedAt: '2026-04-14T10:00:00.000Z' }],
          },
        },
        source: {
          mode: 'local',
        },
        fundCodes: ['000001'],
        startTradingDate: '2026-04-14',
        endTradingDate: '2026-04-15',
      }),
    ).toEqual(
      expect.objectContaining({
        filters: {
          fundCodes: ['000001'],
          startTradingDate: '2026-04-14',
          endTradingDate: '2026-04-15',
          includeDerived: true,
        },
        snapshots: [
          expect.objectContaining({
            snapshotKey: '000001::2026-04-15 14:30',
            fundCode: '000001',
            tradingDate: '2026-04-15',
          }),
        ],
        fundSummaries: [
          expect.objectContaining({
            fundCode: '000001',
            sampleCount: 1,
          }),
        ],
        adjustmentDecisions: [
          expect.objectContaining({
            fundCode: '000001',
          }),
        ],
      }),
    );
  });
});
