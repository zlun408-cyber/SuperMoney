import { describe, expect, it } from 'vitest';

import {
  calculateTransactionLedgerSummary,
  sortTransactionsByDate,
} from '@/lib/funds/transactions';
import type { FundTransaction } from '@/lib/funds/types';

describe('transactions', () => {
  describe('sortTransactionsByDate', () => {
    it('sorts transactions by date from oldest to newest', () => {
      const transactions: FundTransaction[] = [
        {
          id: 'sell-1',
          type: 'sell',
          tradeDate: '2026-03-03',
          shares: 50,
          nav: 1.3,
        },
        {
          id: 'buy-1',
          type: 'buy',
          tradeDate: '2026-03-01',
          amount: 100,
          nav: 1,
        },
      ];

      const result = sortTransactionsByDate(transactions);

      expect(result.map((item) => item.id)).toEqual(['buy-1', 'sell-1']);
    });
  });

  describe('calculateTransactionLedgerSummary', () => {
    it('calculates remaining shares and realized profit with fifo after buy and sell', () => {
      const result = calculateTransactionLedgerSummary(
        [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 100,
            nav: 1,
          },
          {
            id: 'buy-2',
            type: 'buy',
            tradeDate: '2026-03-02',
            amount: 120,
            nav: 1.2,
          },
          {
            id: 'sell-1',
            type: 'sell',
            tradeDate: '2026-03-03',
            shares: 150,
            nav: 1.3,
          },
        ],
        1.4,
      );

      expect(result.currentShares).toBe(50);
      expect(result.currentCost).toBe(60);
      expect(result.averageCost).toBe(1.2);
      expect(result.realizedProfit).toBe(35);
      expect(result.unrealizedProfit).toBe(10);
      expect(result.totalDividends).toBe(0);
    });

    it('includes cash dividend and reinvested dividend in the summary', () => {
      const result = calculateTransactionLedgerSummary(
        [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 100,
            nav: 1,
          },
          {
            id: 'cash-dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-02',
            amount: 10,
          },
          {
            id: 'reinvest-1',
            type: 'reinvest_dividend',
            tradeDate: '2026-03-03',
            amount: 12,
            nav: 1.2,
          },
        ],
        1.5,
      );

      expect(result.currentShares).toBe(110);
      expect(result.currentCost).toBe(112);
      expect(result.averageCost).toBeCloseTo(1.0182, 4);
      expect(result.realizedProfit).toBe(10);
      expect(result.totalDividends).toBe(22);
      expect(result.unrealizedProfit).toBe(53);
    });

    it('throws when a sell transaction exceeds available shares', () => {
      expect(() =>
        calculateTransactionLedgerSummary([
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 100,
            nav: 1,
          },
          {
            id: 'sell-1',
            type: 'sell',
            tradeDate: '2026-03-02',
            shares: 200,
            nav: 1.2,
          },
        ]),
      ).toThrow('卖出份额不能大于当前可用份额');
    });
  });
});
