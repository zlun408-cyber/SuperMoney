import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let mockWatchlist = [
  {
    code: '161725',
    name: '招商中证白酒指数',
    position: { amount: 1000, cost: 900, shares: 1000 },
  },
];

let mockQuotes = [
  {
    code: '161725',
    name: '招商中证白酒指数',
    estimatedNav: 1.05,
    changeRate: 0.52,
    updatedAt: '2026-03-25T15:30:00.000Z',
  },
];

vi.mock('@/lib/hooks/use-watchlist', () => ({
  useWatchlist: () => ({
    watchlist: mockWatchlist,
    addFund: vi.fn(),
    removeFund: vi.fn(),
    updatePosition: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/use-fund-quotes', () => ({
  useFundQuotes: () => ({
    quotes: mockQuotes,
    error: null,
    isRefreshing: false,
    lastUpdatedAt: '2026-03-25T15:30:00.000Z',
    refresh: vi.fn(),
  }),
}));

import FundDetailPage from '@/app/fund/[code]/page';

afterEach(() => {
  cleanup();
  mockWatchlist = [
    {
      code: '161725',
      name: '招商中证白酒指数',
      position: { amount: 1000, cost: 900, shares: 1000 },
    },
  ];
  mockQuotes = [
    {
      code: '161725',
      name: '招商中证白酒指数',
      estimatedNav: 1.05,
      changeRate: 0.52,
      updatedAt: '2026-03-25T15:30:00.000Z',
    },
  ];
});

describe('FundDetailPage', () => {
  it('loads the fund by code and shows quote and position summary', async () => {
    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });

    render(page);

    expect(screen.getByText('招商中证白酒指数')).toBeTruthy();
    expect(screen.getByText('基金代码：161725')).toBeTruthy();
    expect(screen.getByText('当前估值')).toBeTruthy();
    expect(screen.getByText('1.05')).toBeTruthy();
    expect(screen.getByText('估算盈亏')).toBeTruthy();
    expect(screen.getByText('150.00')).toBeTruthy();
  });

  it('shows fallback text when no position exists', async () => {
    mockWatchlist = [{ code: '161725', name: '招商中证白酒指数' }];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getAllByText('待填写').length).toBeGreaterThan(0);
  });

  it('shows a not-found message when the fund is missing', async () => {
    mockWatchlist = [];
    mockQuotes = [];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '000000' }) });
    render(page);

    expect(screen.getByText('没有找到这只基金，请先回到首页添加。')).toBeTruthy();
  });
});
