import { describe, expect, it } from 'vitest';

import type { SipPlan } from '@/lib/funds/types';
import { materializeSipPlans } from '@/lib/funds/sip-plans';

const monthlyPlan: SipPlan = {
  id: 'sip-1',
  amount: 500,
  frequency: 'monthly',
  startDate: '2026-04-01',
  endDate: '2026-06-30',
  executionTime: '14:30',
  executionPeriod: 'before_1500',
  status: 'active',
  nextExecutionAt: '2026-04-01T14:30:00.000Z',
};

describe('materializeSipPlans', () => {
  it('creates a buy transaction for a due plan and advances the next execution', () => {
    const result = materializeSipPlans({
      code: '161725',
      plans: [monthlyPlan],
      transactions: [],
      now: '2026-04-01T15:00:00.000Z',
      resolveConfirmedNav: () => 1.25,
    });

    expect(result.createdTransactions).toEqual([
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
    expect(result.updatedPlans[0]).toMatchObject({
      id: 'sip-1',
      lastExecutedAt: '2026-04-01T14:30:00.000Z',
      nextExecutionAt: '2026-05-01T14:30:00.000Z',
      status: 'active',
    });
  });

  it('does not create duplicate transactions for the same planned execution', () => {
    const result = materializeSipPlans({
      code: '161725',
      plans: [monthlyPlan],
      transactions: [
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
      ],
      now: '2026-04-01T15:00:00.000Z',
      resolveConfirmedNav: () => 1.25,
    });

    expect(result.createdTransactions).toEqual([]);
    expect(result.updatedPlans[0]).toMatchObject({
      id: 'sip-1',
      lastExecutedAt: '2026-04-01T14:30:00.000Z',
      nextExecutionAt: '2026-05-01T14:30:00.000Z',
      status: 'active',
    });
  });

  it('marks the plan ended when the next execution would pass the end date', () => {
    const result = materializeSipPlans({
      plans: [
        {
          ...monthlyPlan,
          endDate: '2026-04-30',
        },
      ],
      transactions: [],
      now: '2026-04-30T15:00:00.000Z',
      resolveConfirmedNav: () => 1.28,
    });

    expect(result.createdTransactions).toEqual([
      expect.objectContaining({
        id: 'sip-1-2026-04-01',
      }),
    ]);
    expect(result.updatedPlans[0]).toMatchObject({
      id: 'sip-1',
      status: 'ended',
      lastExecutedAt: '2026-04-01T14:30:00.000Z',
      nextExecutionAt: undefined,
    });
  });

  it('advances paused plans past skipped periods so they are not backfilled after resume', () => {
    const pausedResult = materializeSipPlans({
      plans: [
        {
          ...monthlyPlan,
          endDate: '2026-12-31',
          status: 'paused',
        },
      ],
      transactions: [],
      now: '2026-06-15T15:00:00.000Z',
      resolveConfirmedNav: () => 1.25,
    });

    expect(pausedResult.createdTransactions).toEqual([]);
    expect(pausedResult.updatedPlans[0]).toMatchObject({
      id: 'sip-1',
      status: 'paused',
      nextExecutionAt: '2026-07-01T14:30:00.000Z',
    });

    const resumedResult = materializeSipPlans({
      plans: [
        {
          ...pausedResult.updatedPlans[0],
          status: 'active',
        },
      ],
      transactions: [],
      now: '2026-07-01T15:00:00.000Z',
      resolveConfirmedNav: () => 1.32,
    });

    expect(resumedResult.createdTransactions).toEqual([
      expect.objectContaining({
        id: 'sip-1-2026-07-01',
        placedDate: '2026-07-01',
      }),
    ]);
  });

  it('keeps a due period pending when confirmed NAV is unavailable so it can recover later', () => {
    const blockedResult = materializeSipPlans({
      plans: [monthlyPlan],
      transactions: [],
      now: '2026-04-01T15:00:00.000Z',
      resolveConfirmedNav: () => null,
    });

    expect(blockedResult.createdTransactions).toEqual([]);
    expect(blockedResult.updatedPlans[0]).toMatchObject({
      id: 'sip-1',
      status: 'active',
      nextExecutionAt: '2026-04-01T14:30:00.000Z',
    });

    const recoveredResult = materializeSipPlans({
      plans: blockedResult.updatedPlans,
      transactions: [],
      now: '2026-04-02T15:00:00.000Z',
      resolveConfirmedNav: () => 1.25,
    });

    expect(recoveredResult.createdTransactions).toEqual([
      expect.objectContaining({
        id: 'sip-1-2026-04-01',
        placedDate: '2026-04-01',
      }),
    ]);
    expect(recoveredResult.updatedPlans[0]).toMatchObject({
      id: 'sip-1',
      lastExecutedAt: '2026-04-01T14:30:00.000Z',
      nextExecutionAt: '2026-05-01T14:30:00.000Z',
      status: 'active',
    });
  });

  it('deduplicates historical ended executions when a plan is reactivated from a stale cursor', () => {
    const result = materializeSipPlans({
      plans: [
        {
          ...monthlyPlan,
          endDate: '2026-07-31',
          lastExecutedAt: '2026-06-01T14:30:00.000Z',
          nextExecutionAt: '2026-04-01T14:30:00.000Z',
          status: 'active',
        },
      ],
      transactions: [
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
        {
          id: 'sip-1-2026-05-01',
          type: 'buy',
          amount: 500,
          confirmedNav: 1.28,
          placedDate: '2026-05-01',
          placedPeriod: 'before_1500',
          effectiveDate: '2026-05-01',
          source: 'sip_plan',
          sourcePlanId: 'sip-1',
        },
        {
          id: 'sip-1-2026-06-01',
          type: 'buy',
          amount: 500,
          confirmedNav: 1.31,
          placedDate: '2026-06-01',
          placedPeriod: 'before_1500',
          effectiveDate: '2026-06-01',
          source: 'sip_plan',
          sourcePlanId: 'sip-1',
        },
      ],
      now: '2026-07-01T15:00:00.000Z',
      resolveConfirmedNav: () => 1.35,
    });

    expect(result.createdTransactions).toEqual([
      expect.objectContaining({
        id: 'sip-1-2026-07-01',
        placedDate: '2026-07-01',
      }),
    ]);
    expect(result.updatedPlans[0]).toMatchObject({
      id: 'sip-1',
      lastExecutedAt: '2026-07-01T14:30:00.000Z',
      nextExecutionAt: undefined,
      status: 'ended',
    });
  });
});
