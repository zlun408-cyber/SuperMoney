import { describe, expect, it, vi } from 'vitest';

import { buildEstimateSnapshot } from '@/lib/funds/estimate-accuracy';
import {
  ESTIMATE_ACCURACY_STORAGE_KEY,
  loadEstimateAccuracySnapshots,
  saveEstimateAccuracySnapshots,
} from '@/lib/storage/estimate-accuracy-storage';

describe('estimate accuracy storage', () => {
  const validSnapshot = {
    id: '000001::2026-04-13 14:30',
    fundCode: '000001',
    fundName: '基金A',
    quoteUpdatedAt: '2026-04-13 14:30',
    tradingDate: '2026-04-13',
    estimatedNav: 1.23,
    finalNav: 1.2,
    absoluteErrorRate: 0.025,
    resolvedAt: '2026-04-13T15:30:00.000Z',
    createdAt: '2026-04-13T14:30:00.000Z',
    updatedAt: '2026-04-13T15:30:00.000Z',
  };

  it('returns an empty array for missing or malformed payloads', () => {
    localStorage.removeItem(ESTIMATE_ACCURACY_STORAGE_KEY);
    expect(loadEstimateAccuracySnapshots()).toEqual([]);

    localStorage.setItem(ESTIMATE_ACCURACY_STORAGE_KEY, '{bad json');
    expect(loadEstimateAccuracySnapshots()).toEqual([]);

    localStorage.setItem(ESTIMATE_ACCURACY_STORAGE_KEY, JSON.stringify([{}]));
    expect(loadEstimateAccuracySnapshots()).toEqual([]);
  });

  it('round-trips snapshots without losing resolved fields', () => {
    saveEstimateAccuracySnapshots([validSnapshot]);

    expect(loadEstimateAccuracySnapshots()[0]).toEqual(
      expect.objectContaining({
        finalNav: 1.2,
        absoluteErrorRate: 0.025,
        resolvedAt: '2026-04-13T15:30:00.000Z',
      }),
    );
  });

  it('loads snapshots built with default local createdAt/updatedAt semantics', () => {
    const snapshot = buildEstimateSnapshot({
      code: '000002',
      name: '基金B',
      estimatedNav: 1.11,
      quoteUpdatedAt: '2026-04-13 14:30',
    });

    saveEstimateAccuracySnapshots([snapshot]);

    expect(loadEstimateAccuracySnapshots()).toEqual([snapshot]);
  });

  it('keeps valid items when payload is a mixed valid/invalid array', () => {
    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([validSnapshot, {}, { ...validSnapshot, id: '' }]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([validSnapshot]);
  });

  it('filters out snapshots with inconsistent resolved fields', () => {
    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([
        validSnapshot,
        { ...validSnapshot, id: 'bad-1', resolvedAt: '2026-04-13T16:00:00.000Z', finalNav: null },
        { ...validSnapshot, id: 'bad-2', absoluteErrorRate: 0.01, finalNav: null, resolvedAt: null },
        { ...validSnapshot, id: 'bad-3', absoluteErrorRate: 0.01, resolvedAt: null },
        { ...validSnapshot, id: 'bad-4', resolvedAt: '' },
        { ...validSnapshot, id: 'bad-5', finalNav: 1.1, absoluteErrorRate: null, resolvedAt: null },
      ]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([validSnapshot]);
  });

  it('keeps resolved snapshots when final nav exists but error rate is null', () => {
    const resolvedButNonComputable = {
      ...validSnapshot,
      id: '000001::2026-04-13 15:00',
      finalNav: 0,
      absoluteErrorRate: null,
      resolvedAt: '2026-04-13T16:00:00.000Z',
    };

    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([resolvedButNonComputable]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([resolvedButNonComputable]);
  });

  it('keeps resolved snapshots when resolvedAt uses local time format', () => {
    const resolvedWithLocalTime = {
      ...validSnapshot,
      id: '000001::2026-04-13 16:30',
      resolvedAt: '2026-04-13 16:30',
      updatedAt: '2026-04-13 16:30',
    };

    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([resolvedWithLocalTime]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([resolvedWithLocalTime]);
  });

  it('returns [] when localStorage.getItem throws', () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage blocked');
      });

    expect(loadEstimateAccuracySnapshots()).toEqual([]);
    getItemSpy.mockRestore();
  });

  it('does not throw when localStorage.setItem throws', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    expect(() => saveEstimateAccuracySnapshots([validSnapshot])).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('filters out NaN and Infinity numeric fields', () => {
    localStorage.setItem(ESTIMATE_ACCURACY_STORAGE_KEY, '[]');
    const parseSpy = vi.spyOn(JSON, 'parse').mockReturnValue([
      validSnapshot,
      { ...validSnapshot, id: 'nan-estimated', estimatedNav: Number.NaN },
      { ...validSnapshot, id: 'infinity-final', finalNav: Number.POSITIVE_INFINITY },
      { ...validSnapshot, id: 'nan-error', absoluteErrorRate: Number.NaN },
    ]);

    expect(loadEstimateAccuracySnapshots()).toEqual([validSnapshot]);
    parseSpy.mockRestore();
  });

  it('round-trips snapshots built with default local createdAt/updatedAt', () => {
    const snapshot = buildEstimateSnapshot({
      code: '000001',
      name: '基金A',
      estimatedNav: 1.23,
      quoteUpdatedAt: '2026-04-13 14:30',
    });

    saveEstimateAccuracySnapshots([snapshot]);

    expect(loadEstimateAccuracySnapshots()).toEqual([snapshot]);
  });

  it('keeps valid mixed time semantics when each snapshot is individually valid', () => {
    const localSnapshot = {
      ...validSnapshot,
      id: 'local-snapshot',
      quoteUpdatedAt: '2026-04-13 14:30',
      createdAt: '2026-04-13 14:30',
      updatedAt: '2026-04-13 15:00',
      resolvedAt: '2026-04-13 15:00',
    };
    const absoluteSnapshot = {
      ...validSnapshot,
      id: 'absolute-snapshot',
      quoteUpdatedAt: '2026-04-13T06:45:00.000Z',
      createdAt: '2026-04-13T06:45:00.000Z',
      updatedAt: '2026-04-13T07:10:00.000Z',
      resolvedAt: '2026-04-13T07:10:00.000Z',
    };

    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([localSnapshot, absoluteSnapshot]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([localSnapshot, absoluteSnapshot]);
  });

  it('filters out non-empty but invalid time strings', () => {
    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([
        validSnapshot,
        { ...validSnapshot, id: 'bad-quote', quoteUpdatedAt: '2026/04/13 14:30' },
        { ...validSnapshot, id: 'bad-resolved', resolvedAt: 'not-iso' },
        { ...validSnapshot, id: 'bad-created', createdAt: '2026/04/13 14:30' },
        { ...validSnapshot, id: 'bad-updated', updatedAt: '2026/04/13 15:30' },
        { ...validSnapshot, id: 'bad-local-semantic', quoteUpdatedAt: '2026-13-40 25:99' },
      ]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([validSnapshot]);
  });

  it('filters out snapshots with invalid tradingDate values', () => {
    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([
        validSnapshot,
        { ...validSnapshot, id: 'bad-trading-date-shape', tradingDate: '2026/04/13' },
        { ...validSnapshot, id: 'bad-trading-date-value', tradingDate: '2026-02-30' },
      ]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([validSnapshot]);
  });

  it('filters out snapshots whose tradingDate does not match quoteUpdatedAt', () => {
    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([
        validSnapshot,
        {
          ...validSnapshot,
          id: 'mismatched-trading-date',
          quoteUpdatedAt: '2026-04-13 14:30',
          tradingDate: '2026-04-12',
        },
      ]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([validSnapshot]);
  });

  it('keeps valid records when quoteUpdatedAt time semantics are mixed', () => {
    const absoluteQuoteSnapshot = {
      ...validSnapshot,
      id: '000003::2026-04-13T14:30:00.000Z',
      quoteUpdatedAt: '2026-04-13T14:30:00.000Z',
      createdAt: '2026-04-13T14:30:00.000Z',
      updatedAt: '2026-04-13T15:30:00.000Z',
    };

    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([validSnapshot, absoluteQuoteSnapshot]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([validSnapshot, absoluteQuoteSnapshot]);
  });

  it('keeps valid records when resolvedAt semantics are mixed', () => {
    const localResolvedSnapshot = {
      ...validSnapshot,
      id: 'local-resolved',
      quoteUpdatedAt: '2026-04-13 16:00',
      resolvedAt: '2026-04-13 16:30',
      createdAt: '2026-04-13 16:00',
      updatedAt: '2026-04-13 16:30',
    };
    const absoluteResolvedSnapshot = {
      ...localResolvedSnapshot,
      id: 'absolute-resolved',
      resolvedAt: '2026-04-13T16:30:00.000Z',
      updatedAt: '2026-04-13T16:30:00.000Z',
    };

    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([localResolvedSnapshot, absoluteResolvedSnapshot]),
    );

    expect(loadEstimateAccuracySnapshots()).toEqual([localResolvedSnapshot, absoluteResolvedSnapshot]);
  });

  it('returns consistent records even when input order is reversed', () => {
    const localA = {
      ...validSnapshot,
      id: 'local-a',
      quoteUpdatedAt: '2026-04-13 10:00',
      resolvedAt: '2026-04-13 10:30',
      createdAt: '2026-04-13 10:00',
      updatedAt: '2026-04-13 10:30',
    };
    const localB = {
      ...validSnapshot,
      id: 'local-b',
      quoteUpdatedAt: '2026-04-13 11:00',
      resolvedAt: '2026-04-13 11:30',
      createdAt: '2026-04-13 11:00',
      updatedAt: '2026-04-13 11:30',
    };
    const absoluteC = {
      ...validSnapshot,
      id: 'absolute-c',
      quoteUpdatedAt: '2026-04-13T12:00:00.000Z',
      resolvedAt: '2026-04-13T12:30:00.000Z',
      createdAt: '2026-04-13T12:00:00.000Z',
      updatedAt: '2026-04-13T12:30:00.000Z',
    };
    const snapshots = [localA, absoluteC, localB];

    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify(snapshots),
    );
    const idsForward = loadEstimateAccuracySnapshots()
      .map((snapshot) => snapshot.id)
      .sort();

    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([...snapshots].reverse()),
    );
    const idsReversed = loadEstimateAccuracySnapshots()
      .map((snapshot) => snapshot.id)
      .sort();

    expect(idsForward).toEqual(idsReversed);
    expect(idsForward).toEqual(['absolute-c', 'local-a', 'local-b']);
  });

  it('preserves valid mixed-semantics histories across multiple funds', () => {
    const fundALocal = {
      ...validSnapshot,
      id: 'A-local',
      fundCode: '000001',
      quoteUpdatedAt: '2026-04-13 09:00',
      resolvedAt: '2026-04-13 09:30',
      createdAt: '2026-04-13 09:00',
      updatedAt: '2026-04-13 09:30',
    };
    const fundAAbsolute = {
      ...fundALocal,
      id: 'A-abs',
      quoteUpdatedAt: '2026-04-13T09:00:00.000Z',
      resolvedAt: '2026-04-13T09:30:00.000Z',
      createdAt: '2026-04-13T09:00:00.000Z',
      updatedAt: '2026-04-13T09:30:00.000Z',
    };
    const fundBAbsolute1 = {
      ...validSnapshot,
      id: 'B-abs-1',
      fundCode: '000002',
      quoteUpdatedAt: '2026-04-13T10:00:00.000Z',
      resolvedAt: '2026-04-13T10:30:00.000Z',
      createdAt: '2026-04-13T10:00:00.000Z',
      updatedAt: '2026-04-13T10:30:00.000Z',
    };
    const fundBAbsolute2 = {
      ...fundBAbsolute1,
      id: 'B-abs-2',
      quoteUpdatedAt: '2026-04-13T11:00:00.000Z',
      resolvedAt: '2026-04-13T11:30:00.000Z',
      createdAt: '2026-04-13T11:00:00.000Z',
      updatedAt: '2026-04-13T11:30:00.000Z',
    };
    const fundBLocal = {
      ...fundBAbsolute1,
      id: 'B-local',
      quoteUpdatedAt: '2026-04-13 10:00',
      resolvedAt: '2026-04-13 10:30',
      createdAt: '2026-04-13 10:00',
      updatedAt: '2026-04-13 10:30',
    };

    localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify([
        fundALocal,
        fundAAbsolute,
        fundBAbsolute1,
        fundBAbsolute2,
        fundBLocal,
      ]),
    );

    const ids = loadEstimateAccuracySnapshots()
      .map((snapshot) => snapshot.id)
      .sort();

    expect(ids).toEqual(['A-abs', 'A-local', 'B-abs-1', 'B-abs-2', 'B-local']);
  });
});
