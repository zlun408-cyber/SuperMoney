import { beforeEach, describe, expect, it } from 'vitest';

import { loadWatchlist, saveWatchlist, WATCHLIST_STORAGE_KEY } from '@/lib/storage/watchlist-storage';

const sampleWatchlist = [
  {
    code: '161725',
    name: '招商中证白酒指数',
    position: {
      amount: 1000,
      cost: 900,
      shares: 1000,
    },
    transactions: [
      {
        id: 'buy-1',
        type: 'buy',
        tradeDate: '2026-03-01',
        amount: 1000,
        nav: 1,
      },
    ],
  },
];

describe('watchlist storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves the watchlist to localStorage', () => {
    saveWatchlist(sampleWatchlist);

    expect(window.localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBe(JSON.stringify(sampleWatchlist));
  });

  it('loads the watchlist from localStorage', () => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(sampleWatchlist));

    expect(loadWatchlist()).toEqual(sampleWatchlist);
  });

  it('keeps transaction records when loading saved watchlist data', () => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(sampleWatchlist));

    const loaded = loadWatchlist();

    expect(loaded[0]?.transactions).toEqual([
      {
        id: 'buy-1',
        type: 'buy',
        tradeDate: '2026-03-01',
        amount: 1000,
        nav: 1,
      },
    ]);
  });

  it('falls back to an empty list when localStorage data is invalid', () => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, 'not-json');

    expect(loadWatchlist()).toEqual([]);
  });
});
