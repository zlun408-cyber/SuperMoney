import { StrictMode, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccuracyStore } from '@/lib/accuracy/accuracy-store';
import type { FundQuote } from '@/lib/funds/types';
import { ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT } from '@/lib/funds/estimate-adjustment-policy';
import { useFundQuotes } from '@/lib/hooks/use-fund-quotes';
import * as intradayStorage from '@/lib/storage/estimate-intraday-storage';

const sampleQuotes: FundQuote[] = [
  {
    code: '161725',
    name: '招商中证白酒指数',
    estimatedNav: 1.05,
    changeRate: 0.52,
    updatedAt: '2026-03-25T15:30:00.000Z',
  },
];

const policySnapshots = [
  {
    id: 'a-1',
    fundCode: '161725',
    fundName: '招商中证白酒指数',
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
    fundCode: '161725',
    fundName: '招商中证白酒指数',
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
    fundName: '基金B',
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
    fundName: '基金C',
    quoteUpdatedAt: '2026-04-10 15:05',
    tradingDate: '2026-04-10',
    estimatedNav: 0.98,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-10T16:00:00.000Z',
    createdAt: '2026-04-10T15:05:00.000Z',
    updatedAt: '2026-04-10T16:00:00.000Z',
  },
];

const recheckPolicySnapshots = [
  {
    id: 'recheck-1',
    fundCode: '161725',
    fundName: '招商中证白酒指数',
    quoteUpdatedAt: '2026-04-10 10:30',
    tradingDate: '2026-04-10',
    estimatedNav: 1.02,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    createdAt: '2026-04-10T10:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  },
  {
    id: 'recheck-2',
    fundCode: '161725',
    fundName: '招商中证白酒指数',
    quoteUpdatedAt: '2026-04-11 10:30',
    tradingDate: '2026-04-11',
    estimatedNav: 1.02,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-11T15:30:00.000Z',
    createdAt: '2026-04-11T10:30:00.000Z',
    updatedAt: '2026-04-11T15:30:00.000Z',
  },
  {
    id: 'recheck-3',
    fundCode: '161725',
    fundName: '招商中证白酒指数',
    quoteUpdatedAt: '2026-04-12 10:30',
    tradingDate: '2026-04-12',
    estimatedNav: 0.99,
    finalNav: 1,
    absoluteErrorRate: 0.01,
    resolvedAt: '2026-04-12T15:30:00.000Z',
    createdAt: '2026-04-12T10:30:00.000Z',
    updatedAt: '2026-04-12T15:30:00.000Z',
  },
  {
    id: 'recheck-4',
    fundCode: '161725',
    fundName: '招商中证白酒指数',
    quoteUpdatedAt: '2026-04-13 10:30',
    tradingDate: '2026-04-13',
    estimatedNav: 0.99,
    finalNav: 1,
    absoluteErrorRate: 0.01,
    resolvedAt: '2026-04-13T15:30:00.000Z',
    createdAt: '2026-04-13T10:30:00.000Z',
    updatedAt: '2026-04-13T15:30:00.000Z',
  },
];

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useFundQuotes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads quotes on first render', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue(sampleQuotes);

    const { result } = renderHook(() => useFundQuotes(['161725'], fetchQuotes, 60_000));

    await flushAsyncWork();

    expect(fetchQuotes).toHaveBeenCalledWith(['161725']);
    expect(result.current.quotes).toEqual(sampleQuotes);
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdatedAt).toBe('2026-03-25T15:30:00.000Z');
  });

  it('polls quotes on the refresh interval', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue(sampleQuotes);

    renderHook(() => useFundQuotes(['161725'], fetchQuotes, 60_000));

    await flushAsyncWork();
    expect(fetchQuotes).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(fetchQuotes).toHaveBeenCalledTimes(2);
  });

  it('keeps the previous quotes when a refresh fails', async () => {
    const fetchQuotes = vi
      .fn()
      .mockResolvedValueOnce(sampleQuotes)
      .mockRejectedValueOnce(new Error('network failed'));

    const { result } = renderHook(() => useFundQuotes(['161725'], fetchQuotes, 60_000));

    await flushAsyncWork();
    expect(result.current.quotes).toEqual(sampleQuotes);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(result.current.error).toBe('network failed');
    expect(result.current.quotes).toEqual(sampleQuotes);
    expect(result.current.lastUpdatedAt).toBe('2026-03-25T15:30:00.000Z');
  });

  it('supports manual refresh', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue(sampleQuotes);

    const { result } = renderHook(() => useFundQuotes(['161725'], fetchQuotes, 60_000));

    await flushAsyncWork();
    expect(fetchQuotes).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchQuotes).toHaveBeenCalledTimes(2);
  });

  it('loads correctly under React StrictMode', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue(sampleQuotes);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    const { result } = renderHook(() => useFundQuotes(['161725'], fetchQuotes, 60_000), {
      wrapper,
    });

    await flushAsyncWork();
    await flushAsyncWork();

    expect(fetchQuotes).toHaveBeenCalled();
    expect(result.current.quotes).toEqual(sampleQuotes);
    expect(result.current.isRefreshing).toBe(false);
  });

  it('enriches quotes with adjustment policy metadata when a validated decision exists', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue([
      {
        ...sampleQuotes[0],
        updatedAt: '2026-04-14 15:10',
      },
    ]);

    const { result } = renderHook(() =>
      useFundQuotes(['161725'], fetchQuotes, 60_000, {
        loadSnapshots: () => policySnapshots,
        saveSnapshots: vi.fn(),
        resolveFinalNav: vi.fn().mockResolvedValue(null),
        loadAdjustmentDecisions: () => ({
          '161725': {
            status: 'validated',
            updatedAt: '2026-04-14T09:00:00.000Z',
            history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
          },
        }),
      }),
    );

    await flushAsyncWork();

    expect(result.current.quotes[0]).toMatchObject({
      code: '161725',
      adjustmentApplied: true,
      adjustedEstimatedNav: expect.any(Number),
      adjustmentPolicy: expect.objectContaining({
        mode: 'active',
        scenarioKey: 'diagnosis-aware',
        decisionStatus: 'validated',
      }),
    });
  });

  it('attaches writeback validation feedback to active adjustment policies', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue([
      {
        ...sampleQuotes[0],
        updatedAt: '2026-04-14 15:10',
      },
    ]);

    const { result } = renderHook(() =>
      useFundQuotes(['161725'], fetchQuotes, 60_000, {
        loadSnapshots: () => recheckPolicySnapshots,
        saveSnapshots: vi.fn(),
        resolveFinalNav: vi.fn().mockResolvedValue(null),
        loadAdjustmentDecisions: () => ({
          '161725': {
            status: 'validated',
            updatedAt: '2026-04-14T09:00:00.000Z',
            history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
          },
        }),
      }),
    );

    await flushAsyncWork();

    expect(result.current.quotes[0].adjustmentPolicy).toMatchObject({
      mode: 'active',
      validationRecommendationStatus: 'downgrade',
      validationRecommendationLabel: '建议降级观察',
      validationRecommendationReason: expect.stringContaining('最近回写样本连续恶化'),
    });
  });

  it('refreshes adjustment policy immediately when decision updates are broadcast in the same tab', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue([
      {
        ...sampleQuotes[0],
        updatedAt: '2026-04-14 15:10',
      },
    ]);
    let decisions = {
      '161725': {
        status: 'validated' as const,
        updatedAt: '2026-04-14T09:00:00.000Z',
        history: [{ status: 'validated' as const, updatedAt: '2026-04-14T09:00:00.000Z' }],
      },
    };

    const { result } = renderHook(() =>
      useFundQuotes(['161725'], fetchQuotes, 60_000, {
        loadSnapshots: () => policySnapshots,
        saveSnapshots: vi.fn(),
        resolveFinalNav: vi.fn().mockResolvedValue(null),
        loadAdjustmentDecisions: () => decisions,
      }),
    );

    await flushAsyncWork();

    expect(result.current.quotes[0].adjustmentPolicy).toMatchObject({
      mode: 'active',
      decisionStatus: 'validated',
    });

    decisions = {
      '161725': {
        status: 'watch',
        updatedAt: '2026-04-14T10:00:00.000Z',
        history: [
          { status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' },
          { status: 'watch', updatedAt: '2026-04-14T10:00:00.000Z' },
        ],
      },
    };

    await act(async () => {
      window.dispatchEvent(new CustomEvent(ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT));
      await Promise.resolve();
    });

    await flushAsyncWork();
    await flushAsyncWork();

    expect(fetchQuotes).toHaveBeenCalledTimes(2);
    expect(result.current.quotes[0].adjustmentPolicy).toMatchObject({
      mode: 'observe',
      decisionStatus: 'watch',
    });
    expect(result.current.quotes[0].adjustmentApplied).toBe(false);
  });

  it('uses the injected accuracy store for snapshot persistence and decision loading', async () => {
    vi.useRealTimers();

    const fetchQuotes = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.01,
        changeRate: 0.2,
        updatedAt: '2026-04-14 14:30',
      },
    ]);
    let snapshotsStore: Parameters<AccuracyStore['saveSnapshots']>[0] = [];
    const accuracyStore: AccuracyStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      loadSnapshots: vi.fn(() => snapshotsStore),
      saveSnapshots: vi.fn((snapshots) => {
        snapshotsStore = snapshots;
      }),
      upsertSnapshots: vi.fn(),
      loadAdjustmentDecisions: vi.fn(() => ({
        '000001': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      })),
      saveAdjustmentDecisions: vi.fn(),
    };

    const { result } = renderHook(() =>
      useFundQuotes(['000001'], fetchQuotes, 60_000, {
        accuracyStore,
        resolveFinalNav: vi.fn().mockResolvedValue(null),
      }),
    );

    await waitFor(() => {
      expect(result.current.quotes).toHaveLength(1);
      expect(accuracyStore.loadAdjustmentDecisions).toHaveBeenCalled();
      expect(accuracyStore.saveSnapshots).toHaveBeenCalled();
    });
  });
});

describe('useFundQuotes estimate accuracy side effects', () => {
  it('stores derived tradingDate on saved snapshots', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-13 14:30',
      },
    ]);
    const saveSnapshots = vi.fn();

    renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots: () => [],
        saveSnapshots,
        resolveFinalNav: vi.fn().mockResolvedValue(null),
      }),
    );

    await waitFor(() => {
      expect(saveSnapshots).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '000001::2026-04-13 14:30',
            tradingDate: '2026-04-13',
          }),
        ]),
      );
    });
  });

  it('stores snapshots across multiple quote refreshes', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([
        {
          code: '000001',
          name: '基金A',
          estimatedNav: 1.23,
          changeRate: 0.8,
          updatedAt: '2026-04-13 14:30',
        },
      ])
      .mockResolvedValueOnce([
        {
          code: '000001',
          name: '基金A',
          estimatedNav: 1.25,
          changeRate: 1.1,
          updatedAt: '2026-04-13 14:31',
        },
      ]);
    let snapshots: Array<Record<string, unknown>> = [];
    const loadSnapshots = vi.fn(() => snapshots);
    const saveSnapshots = vi.fn();
    const resolveFinalNav = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(saveSnapshots).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '000001::2026-04-13 14:30',
            estimatedNav: 1.23,
            tradingDate: '2026-04-13',
          }),
        ]),
      );
    });

    snapshots = saveSnapshots.mock.calls.at(-1)?.[0] ?? [];

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(saveSnapshots).toHaveBeenCalledTimes(2);
      expect(saveSnapshots).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: '000001::2026-04-13 14:30', estimatedNav: 1.23 }),
          expect.objectContaining({ id: '000001::2026-04-13 14:31', estimatedNav: 1.25 }),
        ]),
      );
    });
  });

  it('does not overwrite a resolved snapshot with a same-id unresolved update', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-13 14:30',
      },
    ]);
    const loadSnapshots = vi.fn().mockReturnValue([
      {
        id: '000001::2026-04-13 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-13 14:30',
        tradingDate: '2026-04-13',
        estimatedNav: 1.23,
        finalNav: 1.18,
        absoluteErrorRate: 0.0423728813,
        resolvedAt: '2026-04-13T15:00:00.000Z',
        createdAt: '2026-04-13T14:30:00.000Z',
        updatedAt: '2026-04-13T15:00:00.000Z',
      },
    ]);
    const saveSnapshots = vi.fn();
    const resolveFinalNav = vi.fn().mockResolvedValue(null);

    renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(saveSnapshots).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '000001::2026-04-13 14:30',
            finalNav: 1.18,
            resolvedAt: '2026-04-13T15:00:00.000Z',
          }),
        ]),
      );
    });
  });

  it('keeps quote success semantics when accuracy side effects throw', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-13 14:30',
      },
    ]);
    const loadSnapshots = vi.fn(() => {
      throw new Error('storage read failed');
    });
    const saveSnapshots = vi.fn();
    const resolveFinalNav = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(result.current.quotes).toEqual([
        expect.objectContaining({
          code: '000001',
          estimatedNav: 1.23,
          updatedAt: '2026-04-13 14:30',
        }),
      ]);
      expect(result.current.error).toBeNull();
    });
    expect(saveSnapshots).not.toHaveBeenCalled();
  });

  it('merges the latest snapshots before save to avoid overwriting concurrent writers', async () => {
    const concurrentSnapshot = {
      id: '000002::2026-04-12 14:35',
      fundCode: '000002',
      fundName: '基金B',
      quoteUpdatedAt: '2026-04-12 14:35',
      tradingDate: '2026-04-12',
      estimatedNav: 2.3,
      finalNav: null,
      absoluteErrorRate: null,
      resolvedAt: null,
      createdAt: '2026-04-12T14:35:00.000Z',
      updatedAt: '2026-04-12T14:35:00.000Z',
    };
    const existingSnapshots = [
      {
        id: '000001::2026-04-12 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-12 14:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.2,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T14:30:00.000Z',
      },
    ];
    const resolveFinalNavDeferred = createDeferred<number | null>();
    const resolveFinalNav = vi.fn().mockImplementation(() => resolveFinalNavDeferred.promise);
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-13 14:30',
      },
    ]);
    let snapshotsStore = existingSnapshots;
    const loadSnapshots = vi.fn(() => snapshotsStore);
    const saveSnapshots = vi.fn((snapshots) => {
      snapshotsStore = snapshots;
    });

    renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(resolveFinalNav).toHaveBeenCalledWith('000001', '2026-04-12');
    });

    snapshotsStore = [...snapshotsStore, concurrentSnapshot];

    await act(async () => {
      resolveFinalNavDeferred.resolve(1.18);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(saveSnapshots).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          concurrentSnapshot,
          expect.objectContaining({
            id: '000001::2026-04-12 14:30',
            finalNav: 1.18,
          }),
          expect.objectContaining({
            id: '000001::2026-04-13 14:30',
          }),
        ]),
      );
    });
  });

  it('preserves a newer same-id snapshot written concurrently by another writer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T15:30:00.000Z'));

    try {
      const resolveFinalNavDeferred = createDeferred<number | null>();
      const resolveFinalNav = vi.fn().mockImplementation(() => resolveFinalNavDeferred.promise);
      const fetcher = vi.fn().mockResolvedValue([
        {
          code: '000001',
          name: '基金A',
          estimatedNav: 1.23,
          changeRate: 0.8,
          updatedAt: '2026-04-13 14:30',
        },
      ]);
      let snapshotsStore = [
        {
          id: '000001::2026-04-12 14:30',
          fundCode: '000001',
          fundName: '基金A',
          quoteUpdatedAt: '2026-04-12 14:30',
          tradingDate: '2026-04-12',
          estimatedNav: 1.2,
          finalNav: null,
          absoluteErrorRate: null,
          resolvedAt: null,
          createdAt: '2026-04-12T14:30:00.000Z',
          updatedAt: '2026-04-12T14:30:00.000Z',
        },
      ];
      const loadSnapshots = vi.fn(() => snapshotsStore);
      const saveSnapshots = vi.fn((snapshots) => {
        snapshotsStore = snapshots;
      });

      renderHook(() =>
        useFundQuotes(['000001'], fetcher, 60_000, {
          loadSnapshots,
          saveSnapshots,
          resolveFinalNav,
        }),
      );

      await flushAsyncWork();
      expect(resolveFinalNav).toHaveBeenCalledWith('000001', '2026-04-12');

      snapshotsStore = [
        {
          id: '000001::2026-04-12 14:30',
          fundCode: '000001',
          fundName: '基金A',
          quoteUpdatedAt: '2026-04-12 14:30',
          tradingDate: '2026-04-12',
          estimatedNav: 1.2,
          finalNav: 1.17,
          absoluteErrorRate: 0.0256410256,
          resolvedAt: '2026-04-13T16:00:00.000Z',
          createdAt: '2026-04-12T14:30:00.000Z',
          updatedAt: '2026-04-13T16:00:00.000Z',
        },
      ];

      await act(async () => {
        resolveFinalNavDeferred.resolve(1.18);
        await Promise.resolve();
      });

      expect(saveSnapshots).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '000001::2026-04-12 14:30',
            finalNav: 1.17,
            updatedAt: '2026-04-13T16:00:00.000Z',
          }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips persisting live quotes with unsupported updatedAt formats', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026/04/13 14:30',
      },
    ]);
    const saveSnapshots = vi.fn();

    const { result } = renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots: () => [],
        saveSnapshots,
        resolveFinalNav: vi.fn().mockResolvedValue(null),
      }),
    );

    await waitFor(() => {
      expect(result.current.quotes).toEqual([
        expect.objectContaining({
          code: '000001',
          updatedAt: '2026/04/13 14:30',
        }),
      ]);
    });

    expect(saveSnapshots).not.toHaveBeenCalled();
  });

  it('reconciles older unresolved snapshots when final nav becomes available', async () => {
    const loadSnapshots = vi.fn().mockReturnValue([
      {
        id: '000001::2026-04-12 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-12 14:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.2,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T14:30:00.000Z',
      },
    ]);
    const saveSnapshots = vi.fn();
    const resolveFinalNav = vi.fn().mockResolvedValue(1.18);

    renderHook(() =>
      useFundQuotes([], vi.fn().mockResolvedValue([]), 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(saveSnapshots).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ finalNav: 1.18 })]),
      );
    });
  });

  it('reconciles older snapshots using the tradingDate derived from the latest quote', async () => {
    const loadSnapshots = vi.fn().mockReturnValue([
      {
        id: '000001::2026-04-12 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-12 14:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.2,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T14:30:00.000Z',
      },
    ]);
    const saveSnapshots = vi.fn();
    const resolveFinalNav = vi.fn().mockResolvedValue(1.18);
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-12T18:30:00.000Z',
      },
    ]);

    renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(resolveFinalNav).toHaveBeenCalledWith('000001', '2026-04-12');
      expect(saveSnapshots).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '000001::2026-04-12 14:30',
            finalNav: 1.18,
          }),
        ]),
      );
    });
  });

  it('attempts reconcile on initial load when quotes are empty', async () => {
    const loadSnapshots = vi.fn().mockReturnValue([
      {
        id: '000001::2026-04-12 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-12 14:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.2,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T14:30:00.000Z',
      },
    ]);
    const saveSnapshots = vi.fn();
    const resolveFinalNav = vi.fn().mockResolvedValue(1.18);

    renderHook(() =>
      useFundQuotes([], vi.fn().mockResolvedValue([]), 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(resolveFinalNav).toHaveBeenCalledWith('000001', '2026-04-12');
      expect(saveSnapshots).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ finalNav: 1.18 })]),
      );
    });
  });

  it('attempts reconcile on initial load even when quote fetch fails', async () => {
    const loadSnapshots = vi.fn().mockReturnValue([
      {
        id: '000001::2026-04-12 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-12 14:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.2,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T14:30:00.000Z',
      },
    ]);
    const saveSnapshots = vi.fn();
    const resolveFinalNav = vi.fn().mockResolvedValue(1.18);

    const { result } = renderHook(() =>
      useFundQuotes(['000001'], vi.fn().mockRejectedValue(new Error('network failed')), 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(result.current.error).toBe('network failed');
      expect(resolveFinalNav).toHaveBeenCalledWith('000001', '2026-04-12');
      expect(saveSnapshots).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ finalNav: 1.18 })]),
      );
    });
  });

  it('ignores stale responses when a newer refresh resolves first', async () => {
    const firstRequest = createDeferred<FundQuote[]>();
    const secondRequest = createDeferred<FundQuote[]>();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);
    const saveSnapshots = vi.fn();

    const { result } = renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots: () => [],
        saveSnapshots,
        resolveFinalNav: vi.fn().mockResolvedValue(null),
      }),
    );

    await flushAsyncWork();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(true);

    const newerQuotes: FundQuote[] = [
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.25,
        changeRate: 1.1,
        updatedAt: '2026-04-13 14:31',
      },
    ];
    const olderQuotes: FundQuote[] = [
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-13 14:30',
      },
    ];

    let manualRefreshPromise: Promise<void>;
    act(() => {
      manualRefreshPromise = result.current.refresh();
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondRequest.resolve(newerQuotes);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.quotes).toEqual(newerQuotes);
      expect(result.current.lastUpdatedAt).toBe('2026-04-13 14:31');
      expect(result.current.error).toBeNull();
      expect(result.current.isRefreshing).toBe(false);
      expect(saveSnapshots).toHaveBeenCalledTimes(1);
      expect(saveSnapshots).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '000001::2026-04-13 14:31',
          }),
        ]),
      );
    });

    await act(async () => {
      firstRequest.resolve(olderQuotes);
      await Promise.resolve();
    });

    await manualRefreshPromise!;

    expect(result.current.quotes).toEqual(newerQuotes);
    expect(result.current.lastUpdatedAt).toBe('2026-04-13 14:31');
    expect(result.current.error).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
    expect(saveSnapshots).toHaveBeenCalledTimes(1);
  });

  it('ignores stale request failures after a newer refresh succeeds', async () => {
    const firstRequest = createDeferred<FundQuote[]>();
    const secondRequest = createDeferred<FundQuote[]>();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);

    const { result } = renderHook(() => useFundQuotes(['000001'], fetcher, 60_000));

    await flushAsyncWork();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(true);

    let manualRefreshPromise: Promise<void>;
    act(() => {
      manualRefreshPromise = result.current.refresh();
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    const newerQuotes: FundQuote[] = [
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.27,
        changeRate: 1.3,
        updatedAt: '2026-04-13 14:32',
      },
    ];

    await act(async () => {
      secondRequest.resolve(newerQuotes);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.quotes).toEqual(newerQuotes);
      expect(result.current.error).toBeNull();
      expect(result.current.lastUpdatedAt).toBe('2026-04-13 14:32');
      expect(result.current.isRefreshing).toBe(false);
    });

    await act(async () => {
      firstRequest.reject(new Error('stale network failed'));
      await Promise.resolve();
    });

    await expect(manualRefreshPromise!).resolves.toBeUndefined();

    expect(result.current.quotes).toEqual(newerQuotes);
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdatedAt).toBe('2026-04-13 14:32');
    expect(result.current.isRefreshing).toBe(false);
  });

  it('keeps isRefreshing true until the latest in-flight request completes', async () => {
    const firstRequest = createDeferred<FundQuote[]>();
    const secondRequest = createDeferred<FundQuote[]>();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);

    const { result } = renderHook(() => useFundQuotes(['000001'], fetcher, 60_000));

    await flushAsyncWork();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(true);

    let manualRefreshPromise: Promise<void>;
    act(() => {
      manualRefreshPromise = result.current.refresh();
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(result.current.isRefreshing).toBe(true);
    });

    await act(async () => {
      firstRequest.resolve(sampleQuotes);
      await Promise.resolve();
    });

    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      secondRequest.resolve([
        {
          ...sampleQuotes[0],
          estimatedNav: 1.08,
          updatedAt: '2026-03-25T15:31:00.000Z',
        },
      ]);
      await Promise.resolve();
    });

    await manualRefreshPromise!;

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.lastUpdatedAt).toBe('2026-03-25T15:31:00.000Z');
  });

  it('does not persist accuracy side effects after unmount', async () => {
    const request = createDeferred<FundQuote[]>();
    const fetcher = vi.fn().mockImplementation(() => request.promise);
    const saveSnapshots = vi.fn();

    const { unmount } = renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots: () => [],
        saveSnapshots,
        resolveFinalNav: vi.fn().mockResolvedValue(null),
      }),
    );

    await flushAsyncWork();
    expect(fetcher).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      request.resolve([
        {
          code: '000001',
          name: '基金A',
          estimatedNav: 1.23,
          changeRate: 0.8,
          updatedAt: '2026-04-13 14:30',
        },
      ]);
      await Promise.resolve();
    });

    expect(saveSnapshots).not.toHaveBeenCalled();
  });
});

describe('useFundQuotes intraday side effects', () => {
  it('samples successful quotes into the intraday store', async () => {
    vi.useRealTimers();
    vi.spyOn(intradayStorage, 'saveEstimateIntradayQuotePoints').mockImplementation(vi.fn());
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-17 10:31',
      },
    ]);

    renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots: () => [],
        saveSnapshots: vi.fn(),
        resolveFinalNav: vi.fn().mockResolvedValue(null),
      }),
    );

    await waitFor(() => {
      expect(intradayStorage.saveEstimateIntradayQuotePoints).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            fundCode: '000001',
            fundName: '基金A',
            tradingDate: '2026-04-17',
            minuteKey: '2026-04-17 10:31',
            estimatedNav: 1.23,
            changeRate: 0.8,
          }),
        ],
        '2026-04-17',
      );
    });
  });

  it('keeps quote success semantics when intraday storage throws', async () => {
    vi.spyOn(intradayStorage, 'saveEstimateIntradayQuotePoints').mockImplementation(() => {
      throw new Error('intraday write failed');
    });
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-17 10:31',
      },
    ]);

    const { result } = renderHook(() => useFundQuotes(['000001'], fetcher, 60_000));

    await waitFor(() => {
      expect(result.current.quotes).toEqual([
        expect.objectContaining({ code: '000001', estimatedNav: 1.23 }),
      ]);
      expect(result.current.error).toBeNull();
    });
  });
});
