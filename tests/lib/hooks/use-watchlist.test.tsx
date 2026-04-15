import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useWatchlist } from '@/lib/hooks/use-watchlist';
import type { CloudWatchlistClient } from '@/lib/sync/cloud-watchlist';
import { WATCHLIST_STORAGE_KEY } from '@/lib/storage/watchlist-storage';

describe('useWatchlist SIP execution records', () => {
  it('materializes due SIP plans on initial load and persists execution records', async () => {
    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify([
        {
          code: '000001',
          name: '基金A',
          sipPlans: [
            {
              id: 'plan-1',
              amount: 100,
              frequency: 'monthly',
              startDate: '2026-04-01',
              executionTime: '10:00',
              executionPeriod: 'before_1500',
              status: 'active',
              nextExecutionAt: '2026-04-10T10:00:00.000Z',
            },
          ],
        },
      ]),
    );

    const { result } = renderHook(() =>
      useWatchlist({
        getNow: () => '2026-04-10T10:00:00.000Z',
        resolveSipPlanNav: () => 1.25,
      }),
    );

    await waitFor(() => {
      expect(result.current.watchlist[0]?.transactions).toHaveLength(1);
      expect(result.current.watchlist[0]?.sipExecutionRecords).toEqual([
        expect.objectContaining({
          planId: 'plan-1',
          executionDate: '2026-04-10',
          status: 'generated',
        }),
      ]);
    });
  });

  it('marks execution record as skipped when deleting an auto-generated SIP transaction', async () => {
    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify([
        {
          code: '000001',
          name: '基金A',
          transactions: [
            {
              id: 'plan-1-2026-04-10',
              type: 'buy',
              amount: 100,
              confirmedNav: 1.25,
              placedDate: '2026-04-10',
              placedPeriod: 'before_1500',
              effectiveDate: '2026-04-10',
              source: 'sip_plan',
              sourcePlanId: 'plan-1',
            },
          ],
          sipExecutionRecords: [
            {
              id: 'exec-1',
              planId: 'plan-1',
              fundId: '000001',
              executionDate: '2026-04-10',
              status: 'generated',
              transactionId: 'plan-1-2026-04-10',
              generatedAt: '2026-04-10T10:00:00.000Z',
              createdAt: '2026-04-10T10:00:00.000Z',
              updatedAt: '2026-04-10T10:00:00.000Z',
            },
          ],
        },
      ]),
    );

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.watchlist[0]?.transactions).toHaveLength(1);
    });

    act(() => {
      result.current.removeTransaction('000001', 'plan-1-2026-04-10');
    });

    expect(result.current.watchlist[0]?.transactions).toEqual([]);
    expect(result.current.watchlist[0]?.sipExecutionRecords).toEqual([
      expect.objectContaining({
        id: 'exec-1',
        status: 'skipped',
        skipReason: 'deleted_generated_transaction',
      }),
    ]);
  });

  it('persists initial SIP materialization back to cloud for authenticated watchlists', async () => {
    const replaceFunds = vi.fn().mockResolvedValue([
      {
        id: 'fund-1',
        userId: 'user-1',
        code: '000001',
        name: '基金A',
        createdAt: '2026-04-10T00:00:00.000Z',
      },
    ]);
    const replaceTransactions = vi.fn().mockResolvedValue(undefined);
    const replaceSipPlans = vi.fn().mockResolvedValue(undefined);
    const replaceSipExecutions = vi.fn().mockResolvedValue(undefined);
    const cloudClient: CloudWatchlistClient = {
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
      listSipPlans: vi.fn().mockResolvedValue([
        {
          id: 'plan-1',
          userId: 'user-1',
          fundId: 'fund-1',
          amount: 100,
          frequency: 'monthly',
          startDate: '2026-04-01',
          executionTime: '10:00',
          executionPeriod: 'before_1500',
          status: 'active',
          nextExecutionAt: '2026-04-10T10:00:00.000Z',
          createdAt: '2026-04-10T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      ]),
      listSipExecutions: vi.fn().mockResolvedValue([]),
      replaceFunds,
      replaceTransactions,
      replaceSipPlans,
      replaceSipExecutions,
    };

    const { result } = renderHook(() =>
      useWatchlist({
        userId: 'user-1',
        cloudClient,
        getNow: () => '2026-04-10T10:00:00.000Z',
        resolveSipPlanNav: () => 1.25,
      }),
    );

    await waitFor(() => {
      expect(result.current.watchlist[0]?.transactions).toHaveLength(1);
    });

    await waitFor(() => {
      expect(replaceTransactions).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'plan-1-2026-04-10',
            fundId: 'fund-1',
            tradeDate: '2026-04-10',
            nav: 1.25,
          }),
        ]),
      );
      expect(replaceSipExecutions).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([
          expect.objectContaining({
            planId: 'plan-1',
            fundId: 'fund-1',
            executionDate: '2026-04-10',
            status: 'generated',
          }),
        ]),
      );
      expect(replaceFunds).toHaveBeenCalled();
      expect(replaceSipPlans).toHaveBeenCalled();
    });
  });

  it('marks the hook ready even when initial cloud loading fails', async () => {
    const cloudClient: CloudWatchlistClient = {
      listFunds: vi.fn().mockRejectedValue(new Error('network failed')),
      listTransactions: vi.fn(),
      listSipPlans: vi.fn(),
      listSipExecutions: vi.fn(),
      replaceFunds: vi.fn(),
      replaceTransactions: vi.fn(),
      replaceSipPlans: vi.fn(),
      replaceSipExecutions: vi.fn(),
    };

    const { result } = renderHook(() =>
      useWatchlist({
        userId: 'user-1',
        cloudClient,
      }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
      expect(result.current.watchlist).toEqual([]);
    });
  });
});
