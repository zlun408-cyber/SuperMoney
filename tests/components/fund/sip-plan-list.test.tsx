import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SipPlanList } from '@/components/fund/sip-plan-list';
import type { SipExecutionRecord, SipPlan } from '@/lib/funds/types';

const plans: SipPlan[] = [
  {
    id: 'plan-a',
    name: '周一定投A',
    amount: 100,
    frequency: 'weekly',
    startDate: '2026-04-01',
    executionTime: '10:00',
    executionPeriod: 'before_1500',
    status: 'active',
    nextExecutionAt: '2026-04-09T10:00:00.000Z',
  },
  {
    id: 'plan-b',
    name: '周一定投B',
    amount: 100,
    frequency: 'weekly',
    startDate: '2026-04-01',
    executionTime: '10:00',
    executionPeriod: 'before_1500',
    status: 'active',
    nextExecutionAt: '2026-04-09T10:00:00.000Z',
  },
];

const executionRecords: SipExecutionRecord[] = [
  {
    id: 'exec-a',
    planId: 'plan-a',
    fundId: '000001',
    executionDate: '2026-04-09',
    status: 'skipped',
    skippedAt: '2026-04-09T10:05:00.000Z',
    skipReason: 'deleted_generated_transaction',
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:05:00.000Z',
  },
  {
    id: 'exec-b',
    planId: 'plan-b',
    fundId: '000001',
    executionDate: '2026-04-09',
    status: 'generated',
    transactionId: 'tx-b',
    generatedAt: '2026-04-09T10:01:00.000Z',
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:01:00.000Z',
  },
];

describe('SipPlanList', () => {
  it('shows skipped summary and reason for the matching plan only', () => {
    render(<SipPlanList plans={plans} executionRecords={executionRecords} />);

    const skippedPlan = screen.getAllByText('周一定投A')[0].closest('li');
    const generatedPlan = screen.getAllByText('周一定投B')[0].closest('li');

    expect(skippedPlan).not.toBeNull();
    expect(generatedPlan).not.toBeNull();

    expect(within(skippedPlan as HTMLElement).getAllByText('本次已跳过，不会自动补回')).toHaveLength(2);
    expect(within(generatedPlan as HTMLElement).getByText('最近一次已生成')).toBeTruthy();
  });

  it('keeps same-day multi-plan execution records separated by plan id', () => {
    cleanup();
    render(<SipPlanList plans={plans} executionRecords={executionRecords} />);

    screen.getAllByRole('button', { name: '查看执行记录' }).forEach((button) => fireEvent.click(button));

    const skippedPlan = screen.getAllByText('周一定投A')[0].closest('li') as HTMLElement;
    const generatedPlan = screen.getAllByText('周一定投B')[0].closest('li') as HTMLElement;

    expect(within(skippedPlan).getAllByText('2026-04-09')).toHaveLength(1);
    expect(within(generatedPlan).getAllByText('2026-04-09')).toHaveLength(1);
    expect(within(skippedPlan).queryByText('关联交易 tx-b')).toBeNull();
    expect(within(generatedPlan).getByText('关联交易 tx-b')).toBeTruthy();
  });
});
