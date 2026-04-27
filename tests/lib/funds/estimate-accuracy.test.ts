import { describe, expect, it } from 'vitest';

import {
  buildEstimateSnapshot,
  deriveTradingDateFromQuoteUpdatedAt,
  gradeEstimateConfidence,
  mergeEstimateSnapshots,
  reconcileEstimateSnapshot,
  summarizeEstimateAccuracy,
} from '@/lib/funds/estimate-accuracy';

describe('estimate accuracy domain', () => {
  it('builds a deduplicated snapshot key from code and quote timestamp', () => {
    const now = '2026-04-13T14:30:00.000Z';

    expect(
      buildEstimateSnapshot({
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        quoteUpdatedAt: '2026-04-13 14:30',
      }, now),
    ).toEqual(
      expect.objectContaining({
        id: '000001::2026-04-13 14:30',
        fundCode: '000001',
        estimatedNav: 1.23,
        finalNav: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  });

  it('derives trading date from ISO quote updated at', () => {
    expect(
      deriveTradingDateFromQuoteUpdatedAt('2026-04-13T14:30:00.000Z'),
    ).toBe('2026-04-13');
  });

  it('derives trading date from local quote timestamps', () => {
    expect(deriveTradingDateFromQuoteUpdatedAt('2026-04-13 14:30')).toBe('2026-04-13');
  });

  it('reconciles an unresolved snapshot once final nav becomes available', () => {
    const createdAt = '2026-04-13T14:30:00.000Z';
    const resolvedAt = '2026-04-13T15:30:00.000Z';
    const snapshot = buildEstimateSnapshot({
      code: '000001',
      name: '基金A',
      estimatedNav: 1.23,
      quoteUpdatedAt: '2026-04-13 14:30',
    }, createdAt);

    expect(reconcileEstimateSnapshot(snapshot, 1.20, resolvedAt)).toEqual(
      expect.objectContaining({
        finalNav: 1.20,
        absoluteErrorRate: expect.closeTo(0.025, 6),
        resolvedAt,
        updatedAt: resolvedAt,
      }),
    );
  });

  it('summarizes rolling accuracy and returns a medium confidence grade', () => {
    const summary = summarizeEstimateAccuracy([
      { id: 'a', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 14:30', tradingDate: '2026-04-10', estimatedNav: 1.00, finalNav: 1.00, absoluteErrorRate: 0, resolvedAt: '2026-04-10T15:30:00.000Z', createdAt: '2026-04-10T14:30:00.000Z', updatedAt: '2026-04-10T15:30:00.000Z' },
      { id: 'b', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 14:30', tradingDate: '2026-04-11', estimatedNav: 1.009, finalNav: 1.00, absoluteErrorRate: 0.009, resolvedAt: '2026-04-11T15:30:00.000Z', createdAt: '2026-04-11T14:30:00.000Z', updatedAt: '2026-04-11T15:30:00.000Z' },
      { id: 'c', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-12 14:30', tradingDate: '2026-04-12', estimatedNav: 1.01, finalNav: 1.00, absoluteErrorRate: 0.01, resolvedAt: '2026-04-12T15:30:00.000Z', createdAt: '2026-04-12T14:30:00.000Z', updatedAt: '2026-04-12T15:30:00.000Z' },
    ]);

    expect(summary.averageAbsoluteErrorRate).toBeCloseTo(0.006333333, 6);
    expect(summary.averageSignedErrorRate).toBeCloseTo(0.006333333, 6);
    expect(summary.resolvedTradingDayCount).toBe(3);
    expect(summary.highErrorResolvedSampleCount).toBe(0);
    expect(gradeEstimateConfidence(summary)).toBe('medium');
  });

  it('returns high only when trading-day coverage, sample volume, and high-error share all satisfy the conservative gates', () => {
    const summary = summarizeEstimateAccuracy([
      { id: 'a', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 14:30', tradingDate: '2026-04-10', estimatedNav: 1.001, finalNav: 1.00, absoluteErrorRate: 0.001, resolvedAt: '2026-04-10T15:30:00.000Z', createdAt: '2026-04-10T14:30:00.000Z', updatedAt: '2026-04-10T15:30:00.000Z' },
      { id: 'b', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 14:30', tradingDate: '2026-04-11', estimatedNav: 1.002, finalNav: 1.00, absoluteErrorRate: 0.002, resolvedAt: '2026-04-11T15:30:00.000Z', createdAt: '2026-04-11T14:30:00.000Z', updatedAt: '2026-04-11T15:30:00.000Z' },
      { id: 'c', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-12 14:30', tradingDate: '2026-04-12', estimatedNav: 1.003, finalNav: 1.00, absoluteErrorRate: 0.003, resolvedAt: '2026-04-12T15:30:00.000Z', createdAt: '2026-04-12T14:30:00.000Z', updatedAt: '2026-04-12T15:30:00.000Z' },
      { id: 'd', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-13 14:30', tradingDate: '2026-04-13', estimatedNav: 0.999, finalNav: 1.00, absoluteErrorRate: 0.001, resolvedAt: '2026-04-13T15:30:00.000Z', createdAt: '2026-04-13T14:30:00.000Z', updatedAt: '2026-04-13T15:30:00.000Z' },
      { id: 'e', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-14 14:30', tradingDate: '2026-04-14', estimatedNav: 0.998, finalNav: 1.00, absoluteErrorRate: 0.002, resolvedAt: '2026-04-14T15:30:00.000Z', createdAt: '2026-04-14T14:30:00.000Z', updatedAt: '2026-04-14T15:30:00.000Z' },
      { id: 'f', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-15 14:30', tradingDate: '2026-04-15', estimatedNav: 1.001, finalNav: 1.00, absoluteErrorRate: 0.001, resolvedAt: '2026-04-15T15:30:00.000Z', createdAt: '2026-04-15T14:30:00.000Z', updatedAt: '2026-04-15T15:30:00.000Z' },
    ]);

    expect(summary.resolvedTradingDayCount).toBe(6);
    expect(summary.highErrorResolvedSampleCount).toBe(0);
    expect(summary.averageAbsoluteErrorRate).toBeCloseTo(0.001666666, 6);
    expect(gradeEstimateConfidence(summary)).toBe('high');
  });

  it('downgrades to low when resolved samples are concentrated in too few trading days', () => {
    const summary = summarizeEstimateAccuracy([
      { id: 'a', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 10:30', tradingDate: '2026-04-10', estimatedNav: 1.001, finalNav: 1.00, absoluteErrorRate: 0.001, resolvedAt: '2026-04-10T11:00:00.000Z', createdAt: '2026-04-10T10:30:00.000Z', updatedAt: '2026-04-10T11:00:00.000Z' },
      { id: 'b', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 14:30', tradingDate: '2026-04-10', estimatedNav: 1.002, finalNav: 1.00, absoluteErrorRate: 0.002, resolvedAt: '2026-04-10T15:30:00.000Z', createdAt: '2026-04-10T14:30:00.000Z', updatedAt: '2026-04-10T15:30:00.000Z' },
      { id: 'c', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 10:30', tradingDate: '2026-04-11', estimatedNav: 1.001, finalNav: 1.00, absoluteErrorRate: 0.001, resolvedAt: '2026-04-11T11:00:00.000Z', createdAt: '2026-04-11T10:30:00.000Z', updatedAt: '2026-04-11T11:00:00.000Z' },
      { id: 'd', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 14:30', tradingDate: '2026-04-11', estimatedNav: 1.002, finalNav: 1.00, absoluteErrorRate: 0.002, resolvedAt: '2026-04-11T15:30:00.000Z', createdAt: '2026-04-11T14:30:00.000Z', updatedAt: '2026-04-11T15:30:00.000Z' },
      { id: 'e', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 14:45', tradingDate: '2026-04-11', estimatedNav: 1.001, finalNav: 1.00, absoluteErrorRate: 0.001, resolvedAt: '2026-04-11T15:45:00.000Z', createdAt: '2026-04-11T14:45:00.000Z', updatedAt: '2026-04-11T15:45:00.000Z' },
      { id: 'f', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 14:45', tradingDate: '2026-04-10', estimatedNav: 1.001, finalNav: 1.00, absoluteErrorRate: 0.001, resolvedAt: '2026-04-10T15:45:00.000Z', createdAt: '2026-04-10T14:45:00.000Z', updatedAt: '2026-04-10T15:45:00.000Z' },
    ]);

    expect(summary.resolvedSampleCount).toBe(6);
    expect(summary.resolvedTradingDayCount).toBe(2);
    expect(summary.averageAbsoluteErrorRate).toBeCloseTo(0.001333333, 6);
    expect(gradeEstimateConfidence(summary)).toBe('low');
  });

  it('downgrades to low when too many resolved samples fall into the high-error tail', () => {
    const summary = summarizeEstimateAccuracy([
      { id: 'a', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 14:30', tradingDate: '2026-04-10', estimatedNav: 1.002, finalNav: 1.00, absoluteErrorRate: 0.002, resolvedAt: '2026-04-10T15:30:00.000Z', createdAt: '2026-04-10T14:30:00.000Z', updatedAt: '2026-04-10T15:30:00.000Z' },
      { id: 'b', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 14:30', tradingDate: '2026-04-11', estimatedNav: 1.012, finalNav: 1.00, absoluteErrorRate: 0.012, resolvedAt: '2026-04-11T15:30:00.000Z', createdAt: '2026-04-11T14:30:00.000Z', updatedAt: '2026-04-11T15:30:00.000Z' },
      { id: 'c', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-12 14:30', tradingDate: '2026-04-12', estimatedNav: 1.002, finalNav: 1.00, absoluteErrorRate: 0.002, resolvedAt: '2026-04-12T15:30:00.000Z', createdAt: '2026-04-12T14:30:00.000Z', updatedAt: '2026-04-12T15:30:00.000Z' },
      { id: 'd', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-13 14:30', tradingDate: '2026-04-13', estimatedNav: 1.013, finalNav: 1.00, absoluteErrorRate: 0.013, resolvedAt: '2026-04-13T15:30:00.000Z', createdAt: '2026-04-13T14:30:00.000Z', updatedAt: '2026-04-13T15:30:00.000Z' },
      { id: 'e', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-14 14:30', tradingDate: '2026-04-14', estimatedNav: 1.002, finalNav: 1.00, absoluteErrorRate: 0.002, resolvedAt: '2026-04-14T15:30:00.000Z', createdAt: '2026-04-14T14:30:00.000Z', updatedAt: '2026-04-14T15:30:00.000Z' },
      { id: 'f', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-15 14:30', tradingDate: '2026-04-15', estimatedNav: 1.012, finalNav: 1.00, absoluteErrorRate: 0.012, resolvedAt: '2026-04-15T15:30:00.000Z', createdAt: '2026-04-15T14:30:00.000Z', updatedAt: '2026-04-15T15:30:00.000Z' },
    ]);

    expect(summary.resolvedTradingDayCount).toBe(6);
    expect(summary.highErrorResolvedSampleCount).toBe(3);
    expect(summary.averageAbsoluteErrorRate).toBeCloseTo(0.007166666, 6);
    expect(gradeEstimateConfidence(summary)).toBe('low');
  });

  it('returns low when there are resolved samples but not enough for medium', () => {
    const summary = summarizeEstimateAccuracy([
      { id: 'a', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 14:30', tradingDate: '2026-04-10', estimatedNav: 1.00, finalNav: 1.00, absoluteErrorRate: 0, resolvedAt: '2026-04-10T15:30:00.000Z', createdAt: '2026-04-10T14:30:00.000Z', updatedAt: '2026-04-10T15:30:00.000Z' },
      { id: 'b', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 14:30', tradingDate: '2026-04-11', estimatedNav: 1.01, finalNav: 1.00, absoluteErrorRate: 0.01, resolvedAt: '2026-04-11T15:30:00.000Z', createdAt: '2026-04-11T14:30:00.000Z', updatedAt: '2026-04-11T15:30:00.000Z' },
    ]);

    expect(summary.resolvedSampleCount).toBe(2);
    expect(summary.averageAbsoluteErrorRate).toBeCloseTo(0.005, 6);
    expect(gradeEstimateConfidence(summary)).toBe('low');
  });

  it('deduplicates snapshots by id when merging', () => {
    const existing = [
      { id: 'a', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 14:30', tradingDate: '2026-04-10', estimatedNav: 1.00, finalNav: null, absoluteErrorRate: null, resolvedAt: null, createdAt: '2026-04-10T14:30:00.000Z', updatedAt: '2026-04-10T14:30:00.000Z' },
      { id: 'b', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 14:30', tradingDate: '2026-04-11', estimatedNav: 1.01, finalNav: null, absoluteErrorRate: null, resolvedAt: null, createdAt: '2026-04-11T14:30:00.000Z', updatedAt: '2026-04-11T14:30:00.000Z' },
    ];
    const incoming = { id: 'b', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 14:30', tradingDate: '2026-04-11', estimatedNav: 1.02, finalNav: null, absoluteErrorRate: null, resolvedAt: null, createdAt: '2026-04-11T14:30:00.000Z', updatedAt: '2026-04-11T15:30:00.000Z' };

    const merged = mergeEstimateSnapshots(existing, incoming);

    expect(merged).toHaveLength(2);
    expect(merged.find((snapshot) => snapshot.id === 'b')).toEqual(incoming);
  });

  it('keeps final nav but does not produce an error rate when final nav is zero', () => {
    const snapshot = buildEstimateSnapshot({
      code: '000001',
      name: '基金A',
      estimatedNav: 1.23,
      quoteUpdatedAt: '2026-04-13 14:30',
    }, '2026-04-13T14:30:00.000Z');

    const reconciled = reconcileEstimateSnapshot(snapshot, 0, '2026-04-13T15:30:00.000Z');
    const summary = summarizeEstimateAccuracy([reconciled]);

    expect(reconciled.finalNav).toBe(0);
    expect(reconciled.absoluteErrorRate).toBeNull();
    expect(summary.resolvedSampleCount).toBe(0);
  });

  it('treats negative final nav as non-resolvable for accuracy stats', () => {
    const snapshot = buildEstimateSnapshot({
      code: '000001',
      name: '基金A',
      estimatedNav: 1.23,
      quoteUpdatedAt: '2026-04-13 14:30',
    }, '2026-04-13T14:30:00.000Z');

    const reconciled = reconcileEstimateSnapshot(snapshot, -1, '2026-04-13T15:30:00.000Z');
    const summary = summarizeEstimateAccuracy([reconciled]);

    expect(reconciled.finalNav).toBe(-1);
    expect(reconciled.absoluteErrorRate).toBeNull();
    expect(summary.resolvedSampleCount).toBe(0);
  });

  it('returns an empty summary for empty snapshots', () => {
    expect(summarizeEstimateAccuracy([])).toEqual({
      fundCode: '',
      sampleCount: 0,
      resolvedSampleCount: 0,
      resolvedTradingDayCount: 0,
      highErrorResolvedSampleCount: 0,
      averageAbsoluteErrorRate: null,
      averageSignedErrorRate: null,
      latestQuoteUpdatedAt: null,
      latestResolvedAt: null,
    });
  });

  it('throws when snapshots contain mixed fund codes', () => {
    expect(() =>
      summarizeEstimateAccuracy([
        { id: 'a', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 14:30', tradingDate: '2026-04-10', estimatedNav: 1.00, finalNav: 1.00, absoluteErrorRate: 0, resolvedAt: '2026-04-10T15:30:00.000Z', createdAt: '2026-04-10T14:30:00.000Z', updatedAt: '2026-04-10T15:30:00.000Z' },
        { id: 'b', fundCode: '000002', fundName: '基金B', quoteUpdatedAt: '2026-04-11 14:30', tradingDate: '2026-04-11', estimatedNav: 1.01, finalNav: 1.00, absoluteErrorRate: 0.01, resolvedAt: '2026-04-11T15:30:00.000Z', createdAt: '2026-04-11T14:30:00.000Z', updatedAt: '2026-04-11T15:30:00.000Z' },
      ]),
    ).toThrow(/fundCode/i);
  });

  it('supports mixed local and absolute timestamps when finding latest values', () => {
    const summary = summarizeEstimateAccuracy([
      {
        id: 'a',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-13 14:30',
        tradingDate: '2026-04-13',
        estimatedNav: 1.02,
        finalNav: 1.00,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-13 15:00',
        createdAt: '2026-04-13 14:30',
        updatedAt: '2026-04-13 15:00',
      },
      {
        id: 'b',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-13T06:45:00.000Z',
        tradingDate: '2026-04-13',
        estimatedNav: 1.01,
        finalNav: 1.00,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-13T07:10:00.000Z',
        createdAt: '2026-04-13T06:45:00.000Z',
        updatedAt: '2026-04-13T07:10:00.000Z',
      },
    ]);

    expect(summary.latestQuoteUpdatedAt).toBe('2026-04-13T06:45:00.000Z');
    expect(summary.latestResolvedAt).toBe('2026-04-13T07:10:00.000Z');
  });

  it('picks latestQuoteUpdatedAt correctly for local format', () => {
    const summary = summarizeEstimateAccuracy([
      { id: 'a', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-13 14:30', tradingDate: '2026-04-13', estimatedNav: 1.00, finalNav: 1.00, absoluteErrorRate: 0, resolvedAt: '2026-04-13T14:30:00.000Z', createdAt: '2026-04-13T14:30:00.000Z', updatedAt: '2026-04-13T14:30:00.000Z' },
      { id: 'b', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-13 14:31', tradingDate: '2026-04-13', estimatedNav: 1.00, finalNav: 1.00, absoluteErrorRate: 0, resolvedAt: '2026-04-13T14:31:00.000Z', createdAt: '2026-04-13T14:31:00.000Z', updatedAt: '2026-04-13T14:31:00.000Z' },
    ]);

    expect(summary.latestQuoteUpdatedAt).toBe('2026-04-13 14:31');
  });

  it('derives trading date from absolute timestamps using china market timezone', () => {
    expect(deriveTradingDateFromQuoteUpdatedAt('2026-04-12T18:30:00.000Z')).toBe('2026-04-13');
  });
});
