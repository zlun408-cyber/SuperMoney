import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useWatchlist } from '@/lib/hooks/use-watchlist';
import { WATCHLIST_STORAGE_KEY } from '@/lib/storage/watchlist-storage';

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
});
