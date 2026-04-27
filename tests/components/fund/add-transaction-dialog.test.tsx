import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddTransactionDialog } from '@/components/fund/add-transaction-dialog';
import type { FundTransaction } from '@/lib/funds/types';

const mockFetchNav = vi.fn();
const mockResetAutoNav = vi.fn();

const autoNavMock = {
  state: {
    loading: false,
    error: null as string | null,
    nav: null as number | null,
    source: null as 'api' | 'cache' | 'manual' | null,
    effectiveDate: null as string | null,
  },
  fetchNav: mockFetchNav,
  reset: mockResetAutoNav,
};

vi.mock('@/lib/hooks/use-auto-nav', () => ({
  useAutoNav: () => autoNavMock,
}));

function setAutoNavState(partial: Partial<typeof autoNavMock.state>) {
  autoNavMock.state = {
    loading: false,
    error: null,
    nav: null,
    source: null,
    effectiveDate: null,
    ...partial,
  };
}

describe('AddTransactionDialog', () => {
  beforeEach(() => {
    setAutoNavState({});
    mockFetchNav.mockReset();
    mockResetAutoNav.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('saves a new buy transaction with auto nav and no manual nav input', async () => {
    setAutoNavState({
      nav: 1.2345,
      source: 'api',
      effectiveDate: '2026-04-08',
    });

    const onAddTransaction = vi.fn();

    render(<AddTransactionDialog fundCode="000001" onAddTransaction={onAddTransaction} />);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('交易日期'), { target: { value: '2026-04-08' } });
    fireEvent.change(screen.getByLabelText('金额'), { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByText('已自动获取净值')).toBeTruthy();
      expect(screen.queryByLabelText('净值')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(onAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'buy',
        amount: 100,
        confirmedNav: 1.2345,
      }),
    );
  });

  it('uses the current estimated nav instead of asking for manual nav when historical nav lookup fails', async () => {
    setAutoNavState({
      error: '净值未找到，请确认交易日期和下单时段后重试',
      effectiveDate: '2026-04-08',
    });

    const onAddTransaction = vi.fn();

    render(
      <AddTransactionDialog
        fundCode="000001"
        fallbackNav={1.05}
        fallbackNavDescription="估值时间：2026-04-08 14:30"
        onAddTransaction={onAddTransaction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('交易日期'), { target: { value: '2026-04-08' } });
    fireEvent.change(screen.getByLabelText('金额'), { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByText('已使用当前估值作为净值')).toBeTruthy();
      expect(screen.getByText('1.0500')).toBeTruthy();
      expect(screen.queryByRole('textbox', { name: '净值' })).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(onAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'buy',
        amount: 100,
        confirmedNav: 1.05,
      }),
    );
  });

  it('keeps the saved nav in edit mode until the user explicitly refreshes it', async () => {
    const editingTransaction: FundTransaction = {
      id: 'tx-1',
      type: 'buy',
      amount: 100,
      confirmedNav: 1.1111,
      placedDate: '2026-04-08',
      placedPeriod: 'before_1500',
      effectiveDate: '2026-04-08',
      source: 'manual',
    };

    const onAddTransaction = vi.fn();
    const onUpdateTransaction = vi.fn();

    const view = render(
      <AddTransactionDialog
        fundCode="000001"
        onAddTransaction={onAddTransaction}
        editingTransaction={editingTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />,
    );

    const navInput = screen.getByLabelText('净值') as HTMLInputElement;
    expect(navInput.value).toBe('1.1111');

    setAutoNavState({
      nav: 1.3333,
      source: 'api',
      effectiveDate: '2026-04-08',
    });
    view.rerender(
      <AddTransactionDialog
        fundCode="000001"
        onAddTransaction={onAddTransaction}
        editingTransaction={editingTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />,
    );

    expect((screen.getByLabelText('净值') as HTMLInputElement).value).toBe('1.1111');

    fireEvent.click(screen.getByRole('button', { name: '重新获取净值' }));
    expect(mockFetchNav).toHaveBeenCalledWith('000001', '2026-04-08', 'before_1500');

    view.rerender(
      <AddTransactionDialog
        fundCode="000001"
        onAddTransaction={onAddTransaction}
        editingTransaction={editingTransaction}
        onUpdateTransaction={onUpdateTransaction}
      />,
    );

    await waitFor(() => {
      expect((screen.getByLabelText('净值') as HTMLInputElement).value).toBe('1.3333');
    });

    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    expect(onUpdateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-1',
        confirmedNav: 1.3333,
      }),
    );
  });
});
