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
});
