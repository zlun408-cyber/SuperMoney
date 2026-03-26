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
];

let mockError: string | null = 'network failed';

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
  ];
  mockError = 'network failed';
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

  it('shows an empty-state message when the watchlist is empty', () => {
    mockWatchlist = [];
    mockQuotes = [];
    mockError = null;

    render(<HomePage />);

    expect(screen.getByText('还没有添加基金，请先添加一只基金开始监控。')).toBeTruthy();
  });
});
