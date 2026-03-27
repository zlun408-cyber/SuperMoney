import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddTransactionDialog } from '@/components/fund/add-transaction-dialog';
import type { FundTransaction } from '@/lib/funds/types';

afterEach(() => {
  cleanup();
});

describe('AddTransactionDialog', () => {
  it('shows a trade date error only after saving with an empty date', () => {
    const onAddTransaction = vi.fn();

    render(<AddTransactionDialog onAddTransaction={onAddTransaction} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));

    expect(screen.queryByText('请选择交易日期')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: /金额/ }), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.25' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('请选择交易日期')).toBeTruthy();
    expect(onAddTransaction).not.toHaveBeenCalled();
  });

  it('shows an amount error when saving a buy transaction with an invalid amount', () => {
    const onAddTransaction = vi.fn();

    render(<AddTransactionDialog onAddTransaction={onAddTransaction} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('金额'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.25' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('请输入大于 0 的金额')).toBeTruthy();
    expect(onAddTransaction).not.toHaveBeenCalled();
  });

  it('shows a nav error when saving a buy transaction with an invalid nav', () => {
    const onAddTransaction = vi.fn();

    render(<AddTransactionDialog onAddTransaction={onAddTransaction} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /金额/ }), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '0' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('请输入大于 0 的净值')).toBeTruthy();
    expect(onAddTransaction).not.toHaveBeenCalled();
  });

  it('shows a shares error when saving a sell transaction with an invalid amount', () => {
    const onAddTransaction = vi.fn();

    render(<AddTransactionDialog onAddTransaction={onAddTransaction} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('记录类型'), {
      target: { value: 'sell' },
    });
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('份额'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.25' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('请输入大于 0 的份额')).toBeTruthy();
    expect(onAddTransaction).not.toHaveBeenCalled();
  });

  it('clears an amount error after the field is corrected', () => {
    render(<AddTransactionDialog onAddTransaction={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('金额'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.25' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('请输入大于 0 的金额')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: /金额/ }), {
      target: { value: '1000' },
    });

    expect(screen.queryByText('请输入大于 0 的金额')).toBeNull();
  });

  it('updates the amount error message when switching from buy to sell after a failed save', () => {
    render(<AddTransactionDialog onAddTransaction={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('金额'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.25' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('请输入大于 0 的金额')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('记录类型'), {
      target: { value: 'sell' },
    });

    expect(screen.queryByText('请输入大于 0 的金额')).toBeNull();
    expect(screen.getByText('请输入大于 0 的份额')).toBeTruthy();
  });

  it('removes a nav error when switching to cash dividend after a failed save', () => {
    render(<AddTransactionDialog onAddTransaction={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('金额'), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '0' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('请输入大于 0 的净值')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('记录类型'), {
      target: { value: 'cash_dividend' },
    });

    expect(screen.queryByText('请输入大于 0 的净值')).toBeNull();
    expect(screen.queryByLabelText('净值')).toBeNull();
  });

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

  it('prefills and updates an existing transaction in edit mode', () => {
    const onAddTransaction = vi.fn();
    const onUpdateTransaction = vi.fn();
    const editingTransaction: FundTransaction = {
      id: 'tx-123',
      type: 'buy',
      tradeDate: '2026-03-01',
      amount: 1000,
      nav: 1.25,
    };

    render(
      <AddTransactionDialog
        onAddTransaction={onAddTransaction}
        editingTransaction={editingTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />
    );

    expect(screen.getByRole('heading', { name: '编辑交易记录' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存修改' })).toBeTruthy();
    expect((screen.getByLabelText('交易日期') as HTMLInputElement).value).toBe('2026-03-01');
    expect((screen.getByLabelText('金额') as HTMLInputElement).value).toBe('1000');
    expect((screen.getByLabelText('净值') as HTMLInputElement).value).toBe('1.25');

    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-05' },
    });
    fireEvent.change(screen.getByLabelText('金额'), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.3' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    expect(onUpdateTransaction).toHaveBeenCalledTimes(1);
    expect(onAddTransaction).not.toHaveBeenCalled();
    expect(onUpdateTransaction.mock.calls[0]?.[0]).toMatchObject({
      id: 'tx-123',
      type: 'buy',
      tradeDate: '2026-03-05',
      amount: 1200,
      nav: 1.3,
    });
  });

  it('keeps edit mode controlled by the parent and notifies parent when canceling edit', () => {
    const onCancelEdit = vi.fn();
    const editingTransaction: FundTransaction = {
      id: 'tx-456',
      type: 'buy',
      tradeDate: '2026-03-10',
      amount: 800,
      nav: 1.18,
    };

    const { rerender } = render(
      <AddTransactionDialog
        onAddTransaction={vi.fn()}
        editingTransaction={editingTransaction}
        onUpdateTransaction={vi.fn()}
        onCancelEdit={onCancelEdit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(onCancelEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: '编辑交易记录' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存修改' })).toBeTruthy();

    rerender(
      <AddTransactionDialog
        onAddTransaction={vi.fn()}
        editingTransaction={editingTransaction}
        onUpdateTransaction={vi.fn()}
        onCancelEdit={onCancelEdit}
      />
    );

    expect(screen.getByRole('heading', { name: '编辑交易记录' })).toBeTruthy();

    rerender(<AddTransactionDialog onAddTransaction={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '交易记录' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '保存修改' })).toBeNull();
  });

  it('rejects edit mode without an update handler', () => {
    const editingTransaction: FundTransaction = {
      id: 'tx-789',
      type: 'buy',
      tradeDate: '2026-03-12',
      amount: 500,
      nav: 1.05,
    };

    expect(() =>
      render(<AddTransactionDialog onAddTransaction={vi.fn()} editingTransaction={editingTransaction} />)
    ).toThrow(/onUpdateTransaction/);
  });
});
