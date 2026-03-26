import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddFundDialog } from '@/components/watchlist/add-fund-dialog';
import type { FundSearchResult } from '@/lib/funds/types';

afterEach(() => {
  cleanup();
});

describe('AddFundDialog', () => {
  it('searches funds and adds the clicked result', async () => {
    const onAddFund = vi.fn();
    const searchFunds = vi.fn<(_: string) => Promise<FundSearchResult[]>>().mockResolvedValue([
      {
        code: '588350',
        name: '鹏扬中证科创创业50ETF',
        category: '基金',
        fundType: '指数型-股票',
      },
    ]);

    render(<AddFundDialog onAddFund={onAddFund} searchFunds={searchFunds} existingCodes={[]} />);

    fireEvent.click(screen.getByText('添加基金'));
    fireEvent.change(screen.getByPlaceholderText('输入基金代码或名称'), {
      target: { value: '588350' },
    });

    await waitFor(() => {
      expect(searchFunds).toHaveBeenCalledWith('588350');
    });

    fireEvent.click(await screen.findByText('鹏扬中证科创创业50ETF'));

    expect(onAddFund).toHaveBeenCalledWith({
      code: '588350',
      name: '鹏扬中证科创创业50ETF',
    });
  });

  it('shows a not-found message when there are no search results', async () => {
    const searchFunds = vi.fn<(_: string) => Promise<FundSearchResult[]>>().mockResolvedValue([]);

    render(<AddFundDialog onAddFund={vi.fn()} searchFunds={searchFunds} existingCodes={[]} />);

    fireEvent.click(screen.getByText('添加基金'));
    fireEvent.change(screen.getByPlaceholderText('输入基金代码或名称'), {
      target: { value: '不存在的基金' },
    });

    expect(await screen.findByText('没有找到这只基金，请检查代码或名称')).toBeTruthy();
  });

  it('marks already-added funds as unavailable', async () => {
    const searchFunds = vi.fn<(_: string) => Promise<FundSearchResult[]>>().mockResolvedValue([
      {
        code: '588350',
        name: '鹏扬中证科创创业50ETF',
        category: '基金',
        fundType: '指数型-股票',
      },
    ]);

    render(<AddFundDialog onAddFund={vi.fn()} searchFunds={searchFunds} existingCodes={['588350']} />);

    fireEvent.click(screen.getByText('添加基金'));
    fireEvent.change(screen.getByPlaceholderText('输入基金代码或名称'), {
      target: { value: '588350' },
    });

    expect(await screen.findByText('已在自选中')).toBeTruthy();
  });
});
