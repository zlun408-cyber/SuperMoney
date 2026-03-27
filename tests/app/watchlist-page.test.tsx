import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HomePage from '@/app/page';

let mockWatchlist = [
  {
    code: '161725',
    name: '招商中证白酒指数',
    position: { amount: 1000, cost: 900, shares: 1000 },
  },
  {
    code: '005827',
    name: '易方达蓝筹精选',
  },
  {
    code: '163406',
    name: '兴全合润混合',
    position: { amount: 9999, cost: 9999, shares: 9999 },
    transactions: [
      {
        id: 'buy-1',
        type: 'buy',
        tradeDate: '2026-03-20',
        amount: 1000,
        nav: 1,
      },
      {
        id: 'sell-1',
        type: 'sell',
        tradeDate: '2026-03-22',
        shares: 200,
        nav: 1.2,
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
  {
    code: '005827',
    name: '易方达蓝筹精选',
    estimatedNav: 2.13,
    changeRate: -0.18,
    updatedAt: '2026-03-25T15:30:00.000Z',
  },
  {
    code: '163406',
    name: '兴全合润混合',
    estimatedNav: 1.5,
    changeRate: 1.23,
    updatedAt: '2026-03-25T15:30:00.000Z',
  },
];

let mockError: string | null = 'network failed';
let mockIsAuthenticated = false;
let mockUserId: string | null = null;

vi.mock('@/lib/hooks/use-watchlist', () => ({
  useWatchlist: () => ({
    watchlist: mockWatchlist,
    addFund: vi.fn(),
    removeFund: vi.fn(),
    updatePosition: vi.fn(),
    isAuthenticated: mockIsAuthenticated,
  }),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuthSession: () => ({
    userId: mockUserId,
    isAuthenticated: mockIsAuthenticated,
    cloudClient: mockIsAuthenticated ? {} : null,
  }),
}));

vi.mock('@/lib/hooks/use-fund-quotes', () => ({
  useFundQuotes: () => ({
    quotes: mockQuotes,
    error: mockError,
    isRefreshing: false,
    lastUpdatedAt: '2026-03-25T15:30:00.000Z',
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  mockWatchlist = [
    {
      code: '161725',
      name: '招商中证白酒指数',
      position: { amount: 1000, cost: 900, shares: 1000 },
    },
    {
      code: '005827',
      name: '易方达蓝筹精选',
    },
    {
      code: '163406',
      name: '兴全合润混合',
      position: { amount: 9999, cost: 9999, shares: 9999 },
      transactions: [
        {
          id: 'buy-1',
          type: 'buy',
          tradeDate: '2026-03-20',
          amount: 1000,
          nav: 1,
        },
        {
          id: 'sell-1',
          type: 'sell',
          tradeDate: '2026-03-22',
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
      estimatedNav: 1.05,
      changeRate: 0.52,
      updatedAt: '2026-03-25T15:30:00.000Z',
    },
    {
      code: '005827',
      name: '易方达蓝筹精选',
      estimatedNav: 2.13,
      changeRate: -0.18,
      updatedAt: '2026-03-25T15:30:00.000Z',
    },
    {
      code: '163406',
      name: '兴全合润混合',
      estimatedNav: 1.5,
      changeRate: 1.23,
      updatedAt: '2026-03-25T15:30:00.000Z',
    },
  ];
  mockError = 'network failed';
  mockIsAuthenticated = false;
  mockUserId = null;
});

describe('HomePage', () => {
  it('renders saved funds, quote columns, and incomplete position fallback', () => {
    render(<HomePage />);

    expect(screen.getByText('基金实时估值监控')).toBeTruthy();
    expect(screen.getByRole('link', { name: '招商中证白酒指数' }).getAttribute('href')).toBe('/fund/161725');
    expect(screen.getByText('易方达蓝筹精选')).toBeTruthy();
    expect(screen.getByText('161725')).toBeTruthy();
    expect(screen.getByText('1.05')).toBeTruthy();
    expect(screen.getByText('0.52%')).toBeTruthy();
    expect(screen.getAllByText('待填写').length).toBeGreaterThan(0);
  });

  it('shows the refresh failure banner while keeping rows visible', () => {
    render(<HomePage />);

    expect(screen.getAllByText('本次刷新失败，当前显示的是上次数据').length).toBeGreaterThan(0);
    expect(screen.getByText('005827')).toBeTruthy();
  });

  it('prefers transaction-derived summary values when transactions exist', () => {
    render(<HomePage />);

    expect(screen.getByRole('link', { name: '兴全合润混合' }).getAttribute('href')).toBe('/fund/163406');
    expect(screen.getByText('成本 800.00 / 份额 800.00')).toBeTruthy();
    expect(screen.getByText('400.00')).toBeTruthy();
    expect(screen.queryByText('成本 9999.00 / 份额 9999.00')).toBeNull();
  });

  it('shows an empty-state message when the watchlist is empty', () => {
    mockWatchlist = [];
    mockQuotes = [];
    mockError = null;

    render(<HomePage />);

    expect(screen.getByText('还没有添加基金，请先添加一只基金开始监控。')).toBeTruthy();
  });

  it('shows login sync hint when the user is not authenticated', () => {
    render(<HomePage />);

    expect(screen.getByText('登录后可同步自选基金和交易记录，换设备也能继续使用。')).toBeTruthy();
  });

  it('hides login sync hint when the user is authenticated', () => {
    mockIsAuthenticated = true;
    mockUserId = 'user-1';

    render(<HomePage />);

    expect(screen.queryByText('登录后可同步自选基金和交易记录，换设备也能继续使用。')).toBeNull();
  });

  it('disables manual position editing after login and shows ledger guidance', () => {
    mockIsAuthenticated = true;
    mockUserId = 'user-1';

    render(<HomePage />);

    expect(screen.getByText('已登录账号请使用交易记录维护持仓与收益，手工持仓编辑已停用。')).toBeTruthy();

    const editButtons = screen.getAllByRole('button', { name: '编辑持仓' });

    expect(editButtons.length).toBeGreaterThan(0);
    expect(editButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});
