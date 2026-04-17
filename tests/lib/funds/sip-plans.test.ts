import { describe, expect, it } from 'vitest';

import { markSipExecutionSkippedAfterDeletion, materializeSipPlans } from '@/lib/funds/sip-plans';
import type { BuyTransaction, SipExecutionRecord, SipPlan } from '@/lib/funds/types';

const plan: SipPlan = {
  id: 'plan-1',
  amount: 100,
  frequency: 'monthly',
  startDate: '2026-04-01',
  executionTime: '10:00',
  executionPeriod: 'before_1500',
  status: 'active',
  nextExecutionAt: '2026-04-10T10:00:00.000Z',
};

describe('materializeSipPlans', () => {
  it('creates a generated execution record when a due plan resolves nav', () => {
    const result = materializeSipPlans({
      fundId: '000001',
      plans: [plan],
      transactions: [],
      executionRecords: [],
      now: '2026-04-10T10:00:00.000Z',
      resolveConfirmedNav: () => 1.25,
    });

    expect(result.createdTransactions).toEqual([
      expect.objectContaining({
        id: 'plan-1-2026-04-10',
        type: 'buy',
        amount: 100,
        confirmedNav: 1.25,
        source: 'sip_plan',
        sourcePlanId: 'plan-1',
      }),
    ]);
    expect(result.updatedExecutionRecords).toEqual([
      expect.objectContaining({
        planId: 'plan-1',
        fundId: '000001',
        executionDate: '2026-04-10',
        status: 'generated',
        transactionId: 'plan-1-2026-04-10',
      }),
    ]);
  });

  it('replays a pending execution when nav becomes available later', () => {
    const pendingRecord: SipExecutionRecord = {
      id: 'exec-1',
      planId: 'plan-1',
      fundId: '000001',
      executionDate: '2026-04-10',
      status: 'pending',
      createdAt: '2026-04-10T10:00:00.000Z',
      updatedAt: '2026-04-10T10:00:00.000Z',
    };

    const result = materializeSipPlans({
      fundId: '000001',
      plans: [plan],
      transactions: [],
      executionRecords: [pendingRecord],
      now: '2026-04-10T10:05:00.000Z',
      resolveConfirmedNav: () => 1.33,
    });

    expect(result.createdTransactions).toHaveLength(1);
    expect(result.updatedExecutionRecords).toEqual([
      expect.objectContaining({
        id: 'exec-1',
        status: 'generated',
        transactionId: 'plan-1-2026-04-10',
      }),
    ]);
  });

  it('does not regenerate a skipped execution', () => {
    const skippedRecord: SipExecutionRecord = {
      id: 'exec-1',
      planId: 'plan-1',
      fundId: '000001',
      executionDate: '2026-04-10',
      status: 'skipped',
      skippedAt: '2026-04-10T11:00:00.000Z',
      skipReason: 'deleted_generated_transaction',
      createdAt: '2026-04-10T10:00:00.000Z',
      updatedAt: '2026-04-10T11:00:00.000Z',
    };

    const result = materializeSipPlans({
      fundId: '000001',
      plans: [plan],
      transactions: [],
      executionRecords: [skippedRecord],
      now: '2026-04-10T12:00:00.000Z',
      resolveConfirmedNav: () => 1.25,
    });

    expect(result.createdTransactions).toEqual([]);
    expect(result.updatedExecutionRecords).toEqual([skippedRecord]);
  });

  it('repairs a missing execution record from an existing auto-generated transaction without creating a duplicate', () => {
    const existingGeneratedTransaction: BuyTransaction = {
      id: 'plan-1-2026-04-10',
      type: 'buy',
      amount: 100,
      confirmedNav: 1.25,
      placedDate: '2026-04-10',
      placedPeriod: 'before_1500',
      effectiveDate: '2026-04-10',
      source: 'sip_plan',
      sourcePlanId: 'plan-1',
    };

    const result = materializeSipPlans({
      fundId: '000001',
      plans: [plan],
      transactions: [existingGeneratedTransaction],
      executionRecords: [],
      now: '2026-04-10T12:00:00.000Z',
      resolveConfirmedNav: () => 1.33,
    });

    expect(result.createdTransactions).toEqual([]);
    expect(result.updatedExecutionRecords).toEqual([
      expect.objectContaining({
        planId: 'plan-1',
        executionDate: '2026-04-10',
        status: 'generated',
        transactionId: 'plan-1-2026-04-10',
      }),
    ]);
  });

  it('keeps same-day plans independent when materializing the same fund', () => {
    const secondPlan: SipPlan = {
      ...plan,
      id: 'plan-2',
    };

    const result = materializeSipPlans({
      fundId: '000001',
      plans: [plan, secondPlan],
      transactions: [],
      executionRecords: [],
      now: '2026-04-10T10:00:00.000Z',
      resolveConfirmedNav: () => 1.25,
    });

    expect(result.createdTransactions).toHaveLength(2);
    expect(result.createdTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plan-1-2026-04-10', sourcePlanId: 'plan-1' }),
        expect.objectContaining({ id: 'plan-2-2026-04-10', sourcePlanId: 'plan-2' }),
      ]),
    );
    expect(result.updatedExecutionRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ planId: 'plan-1', executionDate: '2026-04-10', status: 'generated' }),
        expect.objectContaining({ planId: 'plan-2', executionDate: '2026-04-10', status: 'generated' }),
      ]),
    );
  });
});

describe('markSipExecutionSkippedAfterDeletion', () => {
  it('marks a generated execution as skipped after its auto transaction is deleted', () => {
    const executionRecords: SipExecutionRecord[] = [
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
    ];
    const generatedTransaction: BuyTransaction = {
      id: 'plan-1-2026-04-10',
      type: 'buy',
      amount: 100,
      confirmedNav: 1.25,
      placedDate: '2026-04-10',
      placedPeriod: 'before_1500',
      effectiveDate: '2026-04-10',
      source: 'sip_plan',
      sourcePlanId: 'plan-1',
    };

    const updated = markSipExecutionSkippedAfterDeletion({
      executionRecords,
      transaction: generatedTransaction,
      skippedAt: '2026-04-10T12:00:00.000Z',
    });

    expect(updated).toEqual([
      expect.objectContaining({
        id: 'exec-1',
        status: 'skipped',
        transactionId: undefined,
        skipReason: 'deleted_generated_transaction',
        skippedAt: '2026-04-10T12:00:00.000Z',
      }),
    ]);
  });
});
