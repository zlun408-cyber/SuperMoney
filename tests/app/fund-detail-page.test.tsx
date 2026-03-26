import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let mockWatchlist = [
  {
    code: '161725',
    name: '招商中证白酒指数',
    position: { amount: 1000, cost: 900, shares: 1000 },
    transactions: [
      {
        id: 'buy-1',
        type: 'buy',
        tradeDate: '2026-03-01',
        amount: 1000,
        nav: 1,
      },
    ],
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
    addTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    removeTransaction: vi.fn(),
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
      transactions: [
        {
          id: 'buy-1',
          type: 'buy',
          tradeDate: '2026-03-01',
          amount: 1000,
          nav: 1,
        },
      ],
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
    expect(screen.getByText('50.00')).toBeTruthy();
    expect(screen.getAllByText('交易记录').length).toBeGreaterThan(0);
    expect(screen.getByText('买入')).toBeTruthy();
    expect(screen.getByText(/2026-03-01/)).toBeTruthy();
  });


  it('prefers transaction-derived summary values when transactions exist', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
        position: { amount: 9999, cost: 9999, shares: 9999 },
        transactions: [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 1000,
            nav: 1,
          },
          {
            id: 'sell-1',
            type: 'sell',
            tradeDate: '2026-03-02',
            shares: 200,
            nav: 1.2,
          },
        ],
      },
    ];
    mockQuotes = [
      {
        code: '161725',
        name: '招商中证白酒指数',
        estimatedNav: 1.5,
        changeRate: 0.52,
        updatedAt: '2026-03-25T15:30:00.000Z',
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getByText('持仓成本')).toBeTruthy();
    expect(screen.getByText('800.00')).toBeTruthy();
    expect(screen.getByText('估算盈亏')).toBeTruthy();
    expect(screen.getByText('400.00')).toBeTruthy();
    expect(screen.queryByText('9999.00')).toBeNull();
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

  it('shows an empty transaction message when there are no transactions', async () => {
    mockWatchlist = [{ code: '161725', name: '招商中证白酒指数', transactions: [] }];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getByText('还没有交易记录，请先添加第一笔记录。')).toBeTruthy();
  });
});
