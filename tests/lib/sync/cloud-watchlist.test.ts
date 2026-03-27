import { describe, expect, it } from 'vitest';

import {
  loadCloudWatchlist,
  saveCloudWatchlist,
  type CloudFundRecord,
  type CloudTransactionRecord,
  type CloudWatchlistClient,
} from '@/lib/sync/cloud-watchlist';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

class FakeCloudWatchlistClient implements CloudWatchlistClient {
  fundsToLoad: CloudFundRecord[] = [];
  transactionsToLoad: CloudTransactionRecord[] = [];
  replacedFundsInput: Parameters<CloudWatchlistClient['replaceFunds']>[1] | null = null;
  replacedTransactionsInput: Parameters<CloudWatchlistClient['replaceTransactions']>[1] | null = null;
  replaceFundsResult: CloudFundRecord[] = [];

  async listFunds() {
    return this.fundsToLoad;
  }

  async listTransactions() {
    return this.transactionsToLoad;
  }

  async replaceFunds(_userId: string, funds: Parameters<CloudWatchlistClient['replaceFunds']>[1]) {
    this.replacedFundsInput = funds;
    return this.replaceFundsResult;
  }

  async replaceTransactions(
    _userId: string,
    transactions: Parameters<CloudWatchlistClient['replaceTransactions']>[1],
  ) {
    this.replacedTransactionsInput = transactions;
  }
}

describe('cloud watchlist helpers', () => {
  it('loads watchlist funds and attaches matching transactions', async () => {
    const client = new FakeCloudWatchlistClient();

    client.fundsToLoad = [
      {
        id: 'fund-1',
        userId: 'user-1',
        code: '161725',
        name: '招商中证白酒指数',
        createdAt: '2026-03-20T10:00:00.000Z',
      },
      {
        id: 'fund-2',
        userId: 'user-1',
        code: '110011',
        name: '易方达中小盘',
        createdAt: '2026-03-21T10:00:00.000Z',
      },
    ];

    client.transactionsToLoad = [
      {
        id: 'tx-2',
        userId: 'user-1',
        fundId: 'fund-1',
        type: 'sell',
        tradeDate: '2026-03-05',
        shares: 100,
        nav: 1.2,
        fee: 1.5,
        note: '部分卖出',
        createdAt: '2026-03-05T10:00:00.000Z',
        updatedAt: '2026-03-05T10:00:00.000Z',
      },
      {
        id: 'tx-1',
        userId: 'user-1',
        fundId: 'fund-1',
        type: 'buy',
        tradeDate: '2026-03-01',
        amount: 1000,
        nav: 1,
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z',
      },
      {
        id: 'tx-3',
        userId: 'user-1',
        fundId: 'fund-missing',
        type: 'cash_dividend',
        tradeDate: '2026-03-10',
        amount: 25,
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:00:00.000Z',
      },
    ];

    const watchlist = await loadCloudWatchlist(client, 'user-1');

    expect(watchlist).toEqual<WatchlistFund[]>([
      {
        code: '161725',
        name: '招商中证白酒指数',
        transactions: [
          {
            id: 'tx-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 1000,
            nav: 1,
          },
          {
            id: 'tx-2',
            type: 'sell',
            tradeDate: '2026-03-05',
            shares: 100,
            nav: 1.2,
            fee: 1.5,
            note: '部分卖出',
          },
        ],
      },
      {
        code: '110011',
        name: '易方达中小盘',
        transactions: [],
      },
    ]);
  });

  it('replaces cloud funds and transactions when saving watchlist data', async () => {
    const client = new FakeCloudWatchlistClient();

    client.replaceFundsResult = [
      {
        id: 'cloud-fund-1',
        userId: 'user-1',
        code: '161725',
        name: '招商中证白酒指数',
        createdAt: '2026-03-20T10:00:00.000Z',
      },
    ];

    await saveCloudWatchlist(client, 'user-1', [
      {
        code: '161725',
        name: '招商中证白酒指数',
        position: {
          amount: 5000,
          cost: 4800,
          shares: 5000,
        },
        transactions: [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 1000,
            nav: 1,
          },
          {
            id: 'dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-15',
            amount: 18.8,
            note: '现金分红',
          },
        ],
      },
    ]);

    expect(client.replacedFundsInput).toEqual([
      {
        code: '161725',
        name: '招商中证白酒指数',
      },
    ]);

    expect(client.replacedTransactionsInput).toEqual([
      {
        id: 'buy-1',
        userId: 'user-1',
        fundId: 'cloud-fund-1',
        type: 'buy',
        tradeDate: '2026-03-01',
        amount: 1000,
        nav: 1,
      },
      {
        id: 'dividend-1',
        userId: 'user-1',
        fundId: 'cloud-fund-1',
        type: 'cash_dividend',
        tradeDate: '2026-03-15',
        amount: 18.8,
        note: '现金分红',
      },
    ]);
  });
});
