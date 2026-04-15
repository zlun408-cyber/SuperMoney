import { describe, expect, it, vi } from 'vitest';

import { loadCloudWatchlist, saveCloudWatchlist, type CloudWatchlistClient } from '@/lib/sync/cloud-watchlist';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

describe('cloud-watchlist normalized transaction mapping', () => {
  it('saves normalized transactions with trade date and confirmed nav', async () => {
    const replaceTransactions = vi.fn().mockResolvedValue(undefined);
    const replaceSipExecutions = vi.fn().mockResolvedValue(undefined);
    const client: CloudWatchlistClient = {
      listFunds: vi.fn(),
      listTransactions: vi.fn(),
      listSipPlans: vi.fn(),
      listSipExecutions: vi.fn(),
      replaceFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-1',
          userId: 'user-1',
          code: '000001',
          name: '基金A',
          createdAt: '2026-04-10T00:00:00.000Z',
        },
      ]),
      replaceTransactions,
      replaceSipPlans: vi.fn().mockResolvedValue(undefined),
      replaceSipExecutions,
    };

    const watchlist: WatchlistFund[] = [
      {
        code: '000001',
        name: '基金A',
        transactions: [
          {
            id: 'tx-1',
            type: 'buy',
            amount: 100,
            confirmedNav: 1.2345,
            placedDate: '2026-04-10',
            placedPeriod: 'after_1500',
            effectiveDate: '2026-04-11',
            source: 'manual',
            fee: 1.2,
          },
        ],
      },
    ];

    await saveCloudWatchlist(client, 'user-1', watchlist);

    expect(replaceTransactions).toHaveBeenCalledWith('user-1', [
      expect.objectContaining({
        id: 'tx-1',
        userId: 'user-1',
        fundId: 'fund-1',
        type: 'buy',
        tradeDate: '2026-04-10',
        nav: 1.2345,
        amount: 100,
        fee: 1.2,
      }),
    ]);
    expect(replaceSipExecutions).toHaveBeenCalledWith('user-1', []);
  });

  it('loads cloud transactions back into normalized app shape', async () => {
    const client: CloudWatchlistClient = {
      listFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-1',
          userId: 'user-1',
          code: '000001',
          name: '基金A',
          createdAt: '2026-04-10T00:00:00.000Z',
        },
      ]),
      listTransactions: vi.fn().mockResolvedValue([
        {
          id: 'tx-1',
          userId: 'user-1',
          fundId: 'fund-1',
          type: 'buy',
          tradeDate: '2026-04-10',
          amount: 100,
          nav: 1.2345,
          fee: 1.2,
          createdAt: '2026-04-10T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      ]),
      listSipPlans: vi.fn().mockResolvedValue([]),
      listSipExecutions: vi.fn().mockResolvedValue([]),
      replaceFunds: vi.fn(),
      replaceTransactions: vi.fn(),
      replaceSipPlans: vi.fn(),
      replaceSipExecutions: vi.fn(),
    };

    const watchlist = await loadCloudWatchlist(client, 'user-1');

    expect(watchlist).toEqual([
      {
        code: '000001',
        name: '基金A',
        transactions: [
          {
            id: 'tx-1',
            type: 'buy',
            amount: 100,
            confirmedNav: 1.2345,
            placedDate: '2026-04-10',
            placedPeriod: 'before_1500',
            effectiveDate: '2026-04-10',
            source: 'manual',
            fee: 1.2,
          },
        ],
        sipPlans: [],
        sipExecutionRecords: [],
      },
    ]);
  });

  it('saves and loads SIP execution records', async () => {
    const replaceSipExecutions = vi.fn().mockResolvedValue(undefined);
    const client: CloudWatchlistClient = {
      listFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-1',
          userId: 'user-1',
          code: '000001',
          name: '基金A',
          createdAt: '2026-04-10T00:00:00.000Z',
        },
      ]),
      listTransactions: vi.fn().mockResolvedValue([]),
      listSipPlans: vi.fn().mockResolvedValue([]),
      listSipExecutions: vi.fn().mockResolvedValue([
        {
          id: 'exec-1',
          userId: 'user-1',
          fundId: 'fund-1',
          planId: 'plan-1',
          executionDate: '2026-04-10',
          status: 'generated',
          transactionId: 'tx-1',
          generatedAt: '2026-04-10T10:00:00.000Z',
          skippedAt: undefined,
          skipReason: undefined,
          createdAt: '2026-04-10T10:00:00.000Z',
          updatedAt: '2026-04-10T10:00:00.000Z',
        },
      ]),
      replaceFunds: vi.fn().mockResolvedValue([
        {
          id: 'fund-1',
          userId: 'user-1',
          code: '000001',
          name: '基金A',
          createdAt: '2026-04-10T00:00:00.000Z',
        },
      ]),
      replaceTransactions: vi.fn().mockResolvedValue(undefined),
      replaceSipPlans: vi.fn().mockResolvedValue(undefined),
      replaceSipExecutions,
    };

    const watchlistToSave: WatchlistFund[] = [
      {
        code: '000001',
        name: '基金A',
        sipExecutionRecords: [
          {
            id: 'exec-1',
            planId: 'plan-1',
            fundId: '000001',
            executionDate: '2026-04-10',
            status: 'generated',
            transactionId: 'tx-1',
            generatedAt: '2026-04-10T10:00:00.000Z',
            createdAt: '2026-04-10T10:00:00.000Z',
            updatedAt: '2026-04-10T10:00:00.000Z',
          },
        ],
      },
    ];

    await saveCloudWatchlist(client, 'user-1', watchlistToSave);

    expect(replaceSipExecutions).toHaveBeenCalledWith('user-1', [
      expect.objectContaining({
        id: 'exec-1',
        userId: 'user-1',
        fundId: 'fund-1',
        planId: 'plan-1',
        executionDate: '2026-04-10',
        status: 'generated',
        transactionId: 'tx-1',
      }),
    ]);

    const watchlist = await loadCloudWatchlist(client, 'user-1');

    expect(watchlist).toEqual([
      {
        code: '000001',
        name: '基金A',
        transactions: [],
        sipPlans: [],
        sipExecutionRecords: [
          expect.objectContaining({
            id: 'exec-1',
            planId: 'plan-1',
            fundId: '000001',
            executionDate: '2026-04-10',
            status: 'generated',
            transactionId: 'tx-1',
          }),
        ],
      },
    ]);
  });
});
