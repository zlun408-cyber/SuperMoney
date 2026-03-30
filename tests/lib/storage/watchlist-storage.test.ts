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
        placedDate: '2026-03-01',
        placedPeriod: 'before_1500',
        effectiveDate: '2026-03-01',
        amount: 1000,
        confirmedNav: 1,
        source: 'manual',
      },
    ],
    sipPlans: [
      {
        id: 'sip-1',
        amount: 500,
        frequency: 'monthly',
        startDate: '2026-04-01',
        endDate: '2026-12-31',
        executionTime: '14:30',
        executionPeriod: 'before_1500',
        status: 'active',
        nextExecutionAt: '2026-04-01T14:30:00.000Z',
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
        placedDate: '2026-03-01',
        placedPeriod: 'before_1500',
        effectiveDate: '2026-03-01',
        amount: 1000,
        confirmedNav: 1,
        source: 'manual',
      },
    ]);
  });

  it('keeps sip plans when loading saved watchlist data', () => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(sampleWatchlist));

    const loaded = loadWatchlist();

    expect(loaded[0]?.sipPlans).toEqual([
      {
        id: 'sip-1',
        amount: 500,
        frequency: 'monthly',
        startDate: '2026-04-01',
        endDate: '2026-12-31',
        executionTime: '14:30',
        executionPeriod: 'before_1500',
        status: 'active',
        nextExecutionAt: '2026-04-01T14:30:00.000Z',
      },
    ]);
  });

  it('migrates legacy transaction records to the new placed/effective date structure', () => {
    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify([
        {
          code: '161725',
          name: '招商中证白酒指数',
          transactions: [
            {
              id: 'legacy-buy-1',
              type: 'buy',
              tradeDate: '2026-03-01',
              amount: 1000,
              nav: 1,
            },
          ],
        },
      ]),
    );

    expect(loadWatchlist()).toEqual([
      {
        code: '161725',
        name: '招商中证白酒指数',
        transactions: [
          {
            id: 'legacy-buy-1',
            type: 'buy',
            placedDate: '2026-03-01',
            placedPeriod: 'before_1500',
            effectiveDate: '2026-03-01',
            amount: 1000,
            confirmedNav: 1,
            source: 'manual',
          },
        ],
        sipPlans: [],
      },
    ]);
  });

  it('falls back to an empty list when localStorage data is invalid', () => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, 'not-json');

    expect(loadWatchlist()).toEqual([]);
  });
});
