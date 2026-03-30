import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWatchlist } from '@/lib/hooks/use-watchlist';
import { WATCHLIST_STORAGE_KEY } from '@/lib/storage/watchlist-storage';
import type { CloudWatchlistClient } from '@/lib/sync/cloud-watchlist';
import type { SipPlan } from '@/lib/funds/types';

const sampleFund = {
  code: '161725',
  name: '招商中证白酒指数',
};

describe('useWatchlist', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads the initial watchlist from localStorage', () => {
    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify([{ ...sampleFund, position: { amount: 1000, cost: 900, shares: 1000 } }]),
    );

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0]?.code).toBe('161725');
  });

  it('adds a fund and persists it', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addFund(sampleFund);
    });

    expect(result.current.watchlist).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? '[]')).toHaveLength(1);
  });

  it('updates position info for an existing fund', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addFund(sampleFund);
      result.current.updatePosition('161725', { amount: 1000, cost: 900, shares: 1000 });
    });

    expect(result.current.watchlist[0]?.position?.cost).toBe(900);
  });

  it('removes a fund from the watchlist', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addFund(sampleFund);
      result.current.removeFund('161725');
    });

    expect(result.current.watchlist).toHaveLength(0);
  });

  it('adds a transaction record to an existing fund', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addFund(sampleFund);
      result.current.addTransaction('161725', {
        id: 'buy-1',
        type: 'buy',
        tradeDate: '2026-03-01',
        amount: 1000,
        nav: 1,
      });
    });

    expect(result.current.watchlist[0]?.transactions).toHaveLength(1);
    expect(result.current.watchlist[0]?.transactions?.[0]?.id).toBe('buy-1');
  });

  it('updates an existing transaction record', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addFund(sampleFund);
      result.current.addTransaction('161725', {
        id: 'buy-1',
        type: 'buy',
        tradeDate: '2026-03-01',
        amount: 1000,
        nav: 1,
      });
      result.current.updateTransaction('161725', 'buy-1', {
        id: 'buy-1',
        type: 'buy',
        tradeDate: '2026-03-01',
        amount: 1200,
        nav: 1,
      });
    });

    expect(result.current.watchlist[0]?.transactions?.[0]).toMatchObject({
      id: 'buy-1',
      amount: 1200,
    });
  });

  it('removes a transaction record from an existing fund', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addFund(sampleFund);
      result.current.addTransaction('161725', {
        id: 'buy-1',
        type: 'buy',
        tradeDate: '2026-03-01',
        amount: 1000,
        nav: 1,
      });
      result.current.removeTransaction('161725', 'buy-1');
    });

    expect(result.current.watchlist[0]?.transactions ?? []).toHaveLength(0);
  });

  it('adds a sip plan to an existing fund', () => {
    const { result } = renderHook(() => useWatchlist());
    const sipPlan: SipPlan = {
      id: 'sip-1',
      amount: 500,
      frequency: 'monthly',
      startDate: '2026-04-01',
      endDate: '2026-12-31',
      executionTime: '14:30',
      executionPeriod: 'before_1500',
      status: 'active',
      nextExecutionAt: '2026-04-01T14:30:00.000Z',
    };

    act(() => {
      result.current.addFund(sampleFund);
      result.current.addSipPlan('161725', sipPlan);
    });

    expect(result.current.watchlist[0]?.sipPlans).toEqual([sipPlan]);
  });

  it('auto-generates a due sip buy transaction when a nav resolver is available', () => {
    const { result } = renderHook(() =>
      useWatchlist({
        getNow: () => '2026-04-01T15:00:00.000Z',
        resolveSipPlanNav: () => 1.25,
      }),
    );

    act(() => {
      result.current.addFund(sampleFund);
      result.current.addSipPlan('161725', {
        id: 'sip-1',
        amount: 500,
        frequency: 'monthly',
        startDate: '2026-04-01',
        endDate: '2026-12-31',
        executionTime: '14:30',
        executionPeriod: 'before_1500',
        status: 'active',
        nextExecutionAt: '2026-04-01T14:30:00.000Z',
      });
    });

    expect(result.current.watchlist[0]?.transactions).toEqual([
      {
        id: 'sip-1-2026-04-01',
        type: 'buy',
        amount: 500,
        confirmedNav: 1.25,
        placedDate: '2026-04-01',
        placedPeriod: 'before_1500',
        effectiveDate: '2026-04-01',
        source: 'sip_plan',
        sourcePlanId: 'sip-1',
      },
    ]);
    expect(result.current.watchlist[0]?.sipPlans?.[0]).toMatchObject({
      id: 'sip-1',
      lastExecutedAt: '2026-04-01T14:30:00.000Z',
      nextExecutionAt: '2026-05-01T14:30:00.000Z',
    });
  });

  it('loads the initial watchlist from cloud when user is authenticated', async () => {
    const cloudClient: CloudWatchlistClient = {
      listFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-1',
          userId: 'user-1',
          code: '161725',
          name: '招商中证白酒指数',
          createdAt: '2026-03-27T10:00:00.000Z',
        },
      ]),
      listTransactions: vi.fn().mockResolvedValue([
        {
          id: 'tx-1',
          userId: 'user-1',
          fundId: 'fund-1',
          type: 'buy',
          tradeDate: '2026-03-20',
          amount: 1000,
          nav: 1,
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-20T10:00:00.000Z',
        },
      ]),
      listSipPlans: vi.fn().mockResolvedValue([]),
      replaceFunds: vi.fn().mockResolvedValue([]),
      replaceTransactions: vi.fn().mockResolvedValue(undefined),
      replaceSipPlans: vi.fn().mockResolvedValue(undefined),
    };

    const { result } = renderHook(() =>
      useWatchlist({
        userId: 'user-1',
        cloudClient,
      }),
    );

    await waitFor(() => {
      expect(result.current.watchlist).toEqual([
        {
          code: '161725',
          name: '招商中证白酒指数',
          sipPlans: [],
          transactions: [
            {
              id: 'tx-1',
              type: 'buy',
              tradeDate: '2026-03-20',
              amount: 1000,
              nav: 1,
            },
          ],
        },
      ]);
    });

    expect(window.localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBeNull();
  });

  it('saves watchlist changes to cloud when user is authenticated', async () => {
    const cloudClient: CloudWatchlistClient = {
      listFunds: vi.fn().mockResolvedValue([]),
      listTransactions: vi.fn().mockResolvedValue([]),
      listSipPlans: vi.fn().mockResolvedValue([]),
      replaceFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-1',
          userId: 'user-1',
          code: '161725',
          name: '招商中证白酒指数',
          createdAt: '2026-03-27T10:00:00.000Z',
        },
      ]),
      replaceTransactions: vi.fn().mockResolvedValue(undefined),
      replaceSipPlans: vi.fn().mockResolvedValue(undefined),
    };

    const { result } = renderHook(() =>
      useWatchlist({
        userId: 'user-1',
        cloudClient,
      }),
    );

    await waitFor(() => {
      expect(cloudClient.listFunds).toHaveBeenCalledWith('user-1');
    });

    act(() => {
      result.current.addFund(sampleFund);
    });

    await waitFor(() => {
      expect(cloudClient.replaceFunds).toHaveBeenLastCalledWith('user-1', [
        {
          code: '161725',
          name: '招商中证白酒指数',
        },
      ]);
    });

    expect(window.localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBeNull();
  });

  it('waits for user choice when local and cloud data both exist on first login', async () => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([{ code: '110011', name: '易方达中小盘' }]));

    const onConflict = vi.fn();
    const cloudClient: CloudWatchlistClient = {
      listFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-1',
          userId: 'user-1',
          code: '161725',
          name: '招商中证白酒指数',
          createdAt: '2026-03-27T10:00:00.000Z',
        },
      ]),
      listTransactions: vi.fn().mockResolvedValue([]),
      listSipPlans: vi.fn().mockResolvedValue([]),
      replaceFunds: vi.fn().mockResolvedValue([]),
      replaceTransactions: vi.fn().mockResolvedValue(undefined),
      replaceSipPlans: vi.fn().mockResolvedValue(undefined),
    };

    const { result } = renderHook(() =>
      useWatchlist({
        userId: 'user-1',
        cloudClient,
        onSyncConflict: onConflict,
      }),
    );

    await waitFor(() => {
      expect(onConflict).toHaveBeenCalledTimes(1);
    });

    expect(result.current.watchlist).toEqual([]);
    expect(cloudClient.replaceFunds).not.toHaveBeenCalled();
  });

  it('uses cloud data after conflict chooser selects cloud', async () => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([{ code: '110011', name: '易方达中小盘' }]));

    const cloudClient: CloudWatchlistClient = {
      listFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-1',
          userId: 'user-1',
          code: '161725',
          name: '招商中证白酒指数',
          createdAt: '2026-03-27T10:00:00.000Z',
        },
      ]),
      listTransactions: vi.fn().mockResolvedValue([]),
      listSipPlans: vi.fn().mockResolvedValue([]),
      replaceFunds: vi.fn().mockResolvedValue([]),
      replaceTransactions: vi.fn().mockResolvedValue(undefined),
      replaceSipPlans: vi.fn().mockResolvedValue(undefined),
    };

    let chooseCloud: (() => void) | undefined;
    let chooseLocal: (() => void) | undefined;

    const { result } = renderHook(() =>
      useWatchlist({
        userId: 'user-1',
        cloudClient,
        onSyncConflict: (actions) => {
          chooseCloud = actions.useCloud;
          chooseLocal = actions.useLocal;
        },
      }),
    );

    await waitFor(() => {
      expect(chooseCloud).toBeTypeOf('function');
      expect(chooseLocal).toBeTypeOf('function');
    });

    act(() => {
      chooseCloud?.();
    });

    await waitFor(() => {
      expect(result.current.watchlist).toEqual([
        {
          code: '161725',
          name: '招商中证白酒指数',
          sipPlans: [],
          transactions: [],
        },
      ]);
    });

    expect(cloudClient.replaceFunds).not.toHaveBeenCalled();
  });

  it('uses local data after conflict chooser selects local', async () => {
    const localWatchlist = [{ code: '110011', name: '易方达中小盘' }];
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(localWatchlist));

    const cloudClient: CloudWatchlistClient = {
      listFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-1',
          userId: 'user-1',
          code: '161725',
          name: '招商中证白酒指数',
          createdAt: '2026-03-27T10:00:00.000Z',
        },
      ]),
      listTransactions: vi.fn().mockResolvedValue([]),
      listSipPlans: vi.fn().mockResolvedValue([]),
      replaceFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-local-1',
          userId: 'user-1',
          code: '110011',
          name: '易方达中小盘',
          createdAt: '2026-03-27T10:00:00.000Z',
        },
      ]),
      replaceTransactions: vi.fn().mockResolvedValue(undefined),
      replaceSipPlans: vi.fn().mockResolvedValue(undefined),
    };

    let chooseLocal: (() => void) | undefined;

    const { result } = renderHook(() =>
      useWatchlist({
        userId: 'user-1',
        cloudClient,
        onSyncConflict: (actions) => {
          chooseLocal = actions.useLocal;
        },
      }),
    );

    await waitFor(() => {
      expect(chooseLocal).toBeTypeOf('function');
    });

    act(() => {
      chooseLocal?.();
    });

    await waitFor(() => {
      expect(result.current.watchlist).toEqual([
        {
          ...localWatchlist[0],
          transactions: [],
          sipPlans: [],
        },
      ]);
    });

    expect(cloudClient.replaceFunds).toHaveBeenCalledWith('user-1', localWatchlist);
  });
});
