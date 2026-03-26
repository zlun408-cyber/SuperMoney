import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddTransactionDialog } from '@/components/fund/add-transaction-dialog';

afterEach(() => {
  cleanup();
});

describe('AddTransactionDialog', () => {
  it('creates a buy transaction and sends it to the save handler', () => {
    const onAddTransaction = vi.fn();

    render(<AddTransactionDialog onAddTransaction={onAddTransaction} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('记录类型'), {
      target: { value: 'buy' },
    });
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('金额'), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.25' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(onAddTransaction).toHaveBeenCalledTimes(1);
    expect(onAddTransaction.mock.calls[0]?.[0]).toMatchObject({
      type: 'buy',
      tradeDate: '2026-03-01',
      amount: 1000,
      nav: 1.25,
    });
  });

  it('shows the cash dividend form without nav input', () => {
    render(<AddTransactionDialog onAddTransaction={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('记录类型'), {
      target: { value: 'cash_dividend' },
    });

    expect(screen.getByLabelText('金额')).toBeTruthy();
    expect(screen.queryByLabelText('净值')).toBeNull();
  });
});
