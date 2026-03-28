import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FundQuote, FundTransaction } from '@/lib/funds/types';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

let mockWatchlist: WatchlistFund[] = [
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

let mockQuotes: FundQuote[] = [
  {
    code: '161725',
    name: '招商中证白酒指数',
    estimatedNav: 1.05,
    changeRate: 0.52,
    updatedAt: '2026-03-25T15:30:00.000Z',
  },
];

vi.mock('@/lib/hooks/use-watchlist', () => ({
  useWatchlist: () => {
    const [watchlist, setWatchlist] = React.useState(mockWatchlist);

    return {
      watchlist,
      addFund: vi.fn(),
      removeFund: vi.fn(),
      updatePosition: vi.fn(),
      addTransaction: (code: string, transaction: FundTransaction) => {
        setWatchlist((current) =>
          current.map((item) =>
            item.code === code
              ? {
                  ...item,
                  transactions: [...(item.transactions ?? []), transaction],
                }
              : item,
          ),
        );
      },
      updateTransaction: (code: string, transactionId: string, transaction: FundTransaction) => {
        setWatchlist((current) =>
          current.map((item) =>
            item.code === code
              ? {
                  ...item,
                  transactions: (item.transactions ?? []).map((currentTransaction) =>
                    currentTransaction.id === transactionId ? transaction : currentTransaction,
                  ),
                }
              : item,
          ),
        );
      },
      removeTransaction: (code: string, transactionId: string) => {
        setWatchlist((current) =>
          current.map((item) =>
            item.code === code
              ? {
                  ...item,
                  transactions: (item.transactions ?? []).filter(
                    (currentTransaction) => currentTransaction.id !== transactionId,
                  ),
                }
              : item,
          ),
        );
      },
    };
  },
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

function expectSummaryCardValue(label: string, value: string) {
  const labelElement = screen.getByText(label);
  const cardElement = labelElement.closest('div');

  expect(cardElement).toBeTruthy();

  expect(within(cardElement as HTMLElement).getByText(value)).toBeTruthy();
}

function getTransactionRows() {
  const transactionHeading = screen.getAllByText('交易记录').at(-1);
  const transactionSection = transactionHeading?.closest('section');

  expect(transactionSection).toBeTruthy();

  return within(transactionSection as HTMLElement).getAllByRole('listitem');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    expectSummaryCardValue('未实现收益', '50.00');
    expect(screen.getAllByText('交易记录').length).toBeGreaterThan(0);
    const rows = getTransactionRows();
    expect(within(rows[0]).getByText('买入')).toBeTruthy();
    expect(within(rows[0]).getByText(/2026-03-01/)).toBeTruthy();
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

    expectSummaryCardValue('当前成本', '800.00');
    expectSummaryCardValue('未实现收益', '400.00');
    expect(screen.queryByText('9999.00')).toBeNull();
  });

  it('shows readable holding and profit breakdown fields when transactions exist', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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
          {
            id: 'cash-dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-03',
            amount: 20,
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

    expectSummaryCardValue('当前份额', '800.00');
    expectSummaryCardValue('平均成本', '1.0000');
    expectSummaryCardValue('未实现收益', '400.00');
    expectSummaryCardValue('已实现收益', '60.00');
    expectSummaryCardValue('累计分红', '20.00');
    expectSummaryCardValue('总收益', '460.00');
  });

  it('shows ledger explanation text when transaction summary is displayed', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
        transactions: [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 1000,
            nav: 1,
          },
          {
            id: 'cash-dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-03',
            amount: 20,
          },
        ],
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getByText('账本说明')).toBeTruthy();
    expect(screen.getByText('总收益 = 已实现收益 + 未实现收益')).toBeTruthy();
    expect(screen.getByText('累计分红已计入已实现收益，这里单独展示，方便你看清收益来源。')).toBeTruthy();
  });

  it('groups ledger summary into holding and profit sections', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getByText('持仓概览')).toBeTruthy();
    expect(screen.getByText('收益拆分')).toBeTruthy();
  });

  it('shows richer transaction row details for reconciliation', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
        transactions: [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 1000,
            nav: 1.0234,
            fee: 1.5,
            note: '第一次建仓',
          },
          {
            id: 'cash-dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-03',
            amount: 20,
            note: '季度分红',
          },
        ],
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getByText('金额 1000')).toBeTruthy();
    expect(screen.getByText(/净值 1.0234 · 手续费 1.50/)).toBeTruthy();
    expect(screen.getByText(/备注：第一次建仓/)).toBeTruthy();
    const primaryValue = screen.getByText((_, node) => node?.textContent === '金额 1000');
    expect(primaryValue.className).toContain('font-semibold');
    expect(primaryValue.className).toContain('text-slate-900');
    expect(screen.getByText('净值 1.0234 · 手续费 1.50').className).toContain('rounded-full');
    expect(screen.getByText('备注：第一次建仓').className).toContain('rounded-full');

    expect(screen.getByText('金额 20')).toBeTruthy();
    expect(screen.getByText(/备注：季度分红/)).toBeTruthy();
  });

  it('shows post-transaction holding hints for buy and sell rows', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getByText('买入后持仓 1000.00 份')).toBeTruthy();
    expect(screen.getByText('卖出后剩余 800.00 份 · 本次已实现收益 40.00')).toBeTruthy();
  });

  it('shows dividend impact hints for cash dividend and reinvest rows', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
        transactions: [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 1000,
            nav: 1,
          },
          {
            id: 'cash-dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-03',
            amount: 20,
          },
          {
            id: 'reinvest-dividend-1',
            type: 'reinvest_dividend',
            tradeDate: '2026-03-04',
            amount: 10,
            nav: 1.25,
          },
        ],
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getByText('分红入账 20.00 元 · 累计分红 20.00')).toBeTruthy();
    expect(screen.getByText('红利再投后持仓 1008.00 份 · 累计分红 30.00')).toBeTruthy();
  });

  it('shows transactions newest first by default', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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
          {
            id: 'cash-dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-03',
            amount: 20,
          },
        ],
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getByRole('button', { name: '最新在前' }).getAttribute('aria-pressed')).toBe('true');

    const rows = getTransactionRows();

    expect(within(rows[0]).getByText('现金分红')).toBeTruthy();
    expect(within(rows[1]).getByText('卖出')).toBeTruthy();
    expect(within(rows[2]).getByText('买入')).toBeTruthy();
  });

  it('can switch transaction list to oldest first', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    fireEvent.click(screen.getByRole('button', { name: '最早在前' }));

    expect(screen.getByRole('button', { name: '最早在前' }).getAttribute('aria-pressed')).toBe('true');

    const rows = getTransactionRows();

    expect(within(rows[0]).getByText('买入')).toBeTruthy();
    expect(within(rows[1]).getByText('卖出')).toBeTruthy();
  });

  it('can filter transaction list by dividend types', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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
          {
            id: 'cash-dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-03',
            amount: 20,
          },
          {
            id: 'reinvest-dividend-1',
            type: 'reinvest_dividend',
            tradeDate: '2026-03-04',
            amount: 10,
            nav: 1.25,
          },
        ],
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    fireEvent.click(screen.getByRole('button', { name: '只看分红' }));

    expect(screen.getByRole('button', { name: '只看分红' }).getAttribute('aria-pressed')).toBe('true');

    const rows = getTransactionRows();

    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('红利再投资')).toBeTruthy();
    expect(within(rows[1]).getByText('现金分红')).toBeTruthy();
    expect(rows.some((row) => within(row).queryByText('买入'))).toBe(false);
    expect(rows.some((row) => within(row).queryByText('卖出'))).toBe(false);
  });

  it('groups transactions into date sections like a timeline', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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
            tradeDate: '2026-03-01',
            shares: 200,
            nav: 1.2,
          },
          {
            id: 'cash-dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-03',
            amount: 20,
          },
        ],
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    expect(screen.getByText('2026-03-01 · 2 笔')).toBeTruthy();
    expect(screen.getByText('2026-03-03 · 1 笔')).toBeTruthy();

    const rows = getTransactionRows();

    expect(within(rows[0]).getByText('现金分红')).toBeTruthy();
    expect(within(rows[1]).getByText('卖出')).toBeTruthy();
    expect(within(rows[2]).getByText('买入')).toBeTruthy();
  });

  it('shows a toolbar summary for current sort, filter, and result count', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
        transactions: [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 1000,
            nav: 1,
          },
          {
            id: 'cash-dividend-1',
            type: 'cash_dividend',
            tradeDate: '2026-03-03',
            amount: 20,
          },
          {
            id: 'reinvest-dividend-1',
            type: 'reinvest_dividend',
            tradeDate: '2026-03-04',
            amount: 10,
            nav: 1.25,
          },
        ],
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    fireEvent.click(screen.getByRole('button', { name: '只看分红' }));

    expect(screen.getByText('当前显示：只看分红 · 最新在前 · 共 2 条')).toBeTruthy();
  });

  it('shows a filtered empty state when no transaction matches the selected type', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    fireEvent.click(screen.getByRole('button', { name: '卖出' }));

    expect(screen.getByText('当前显示：卖出 · 最新在前 · 共 0 条')).toBeTruthy();
    expect(screen.getByText('当前筛选下还没有交易记录，试试切回“全部”查看完整账本。')).toBeTruthy();
  });

  it('can reset back to all transactions from the filtered empty state', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    fireEvent.click(screen.getByRole('button', { name: '卖出' }));

    expect(screen.getByText('当前显示：卖出 · 最新在前 · 共 0 条')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '切回全部' }));

    expect(screen.getByText('当前显示：全部 · 最新在前 · 共 1 条')).toBeTruthy();
    expect(screen.getByText('金额 1000')).toBeTruthy();
    expect(screen.queryByText('当前筛选下还没有交易记录，试试切回“全部”查看完整账本。')).toBeNull();
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

  it('enters edit mode and updates the transaction row after saving changes', async () => {
    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });

    render(page);

    fireEvent.click(screen.getByRole('button', { name: '编辑 2026-03-01 买入记录' }));

    expect(screen.getByRole('heading', { name: '编辑交易记录' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-05' },
    });
    fireEvent.change(screen.getByLabelText('金额'), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.2' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    expect(screen.getByText('金额 1200')).toBeTruthy();
    expect(screen.queryByText('金额 1000')).toBeNull();
    expect(screen.queryByRole('heading', { name: '编辑交易记录' })).toBeNull();
  });

  it('removes a transaction from the list after confirming deletion', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
        transactions: [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-01',
            amount: 1000,
            nav: 1,
          },
          {
            id: 'buy-2',
            type: 'buy',
            tradeDate: '2026-03-02',
            amount: 500,
            nav: 1.1,
          },
        ],
      },
    ];
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });
    render(page);

    fireEvent.click(screen.getByRole('button', { name: '删除 2026-03-01 买入记录' }));

    expect(confirmMock).toHaveBeenCalledWith('确认删除这条交易记录吗？删除后会自动重算持仓和收益。');
    expect(screen.queryByText('金额 1000')).toBeNull();
    expect(screen.getByText('金额 500')).toBeTruthy();
  });

  it('shows the empty state after deleting the last transaction', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });

    render(page);

    fireEvent.click(screen.getByRole('button', { name: '编辑 2026-03-01 买入记录' }));
    expect(screen.getByRole('heading', { name: '编辑交易记录' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '删除 2026-03-01 买入记录' }));

    expect(confirmMock).toHaveBeenCalledWith('确认删除这条交易记录吗？删除后会自动重算持仓和收益。');
    expect(screen.getByText('还没有交易记录，请先添加第一笔记录。')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '编辑交易记录' })).toBeNull();
  });

  it('blocks adding an oversold transaction, then saves successfully after correcting shares', async () => {
    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });

    render(page);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('记录类型'), {
      target: { value: 'sell' },
    });
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-02' },
    });
    fireEvent.change(screen.getByLabelText('份额'), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.1' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('卖出份额不能大于当前可用份额')).toBeTruthy();
    expect(screen.queryByText('份额 1200')).toBeNull();

    fireEvent.change(screen.getByLabelText('份额'), {
      target: { value: '500' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.queryByText('卖出份额不能大于当前可用份额')).toBeNull();
    expect(screen.getByText('份额 500')).toBeTruthy();
  });

  it('blocks adding a sell transaction dated before the first buy', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
        transactions: [
          {
            id: 'buy-1',
            type: 'buy',
            tradeDate: '2026-03-10',
            amount: 1000,
            nav: 1,
          },
        ],
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });

    render(page);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('记录类型'), {
      target: { value: 'sell' },
    });
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('份额'), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.1' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('卖出份额不能大于当前可用份额')).toBeTruthy();
    expect(screen.queryByText('份额 500')).toBeNull();
    expect(screen.getByText('金额 1000')).toBeTruthy();
  });

  it('clears the business error when resetting the add form', async () => {
    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });

    render(page);

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));
    fireEvent.change(screen.getByLabelText('记录类型'), {
      target: { value: 'sell' },
    });
    fireEvent.change(screen.getByLabelText('交易日期'), {
      target: { value: '2026-03-02' },
    });
    fireEvent.change(screen.getByLabelText('份额'), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText('净值'), {
      target: { value: '1.1' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(screen.getByText('卖出份额不能大于当前可用份额')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '添加交易记录' }));

    expect(screen.queryByText('卖出份额不能大于当前可用份额')).toBeNull();
  });

  it('validates edited sell transactions against remaining transactions only', async () => {
    mockWatchlist = [
      {
        code: '161725',
        name: '招商中证白酒指数',
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
            nav: 1.1,
          },
        ],
      },
    ];

    const page = await FundDetailPage({ params: Promise.resolve({ code: '161725' }) });

    render(page);

    fireEvent.click(screen.getByRole('button', { name: '编辑 2026-03-02 卖出记录' }));
    fireEvent.change(screen.getByLabelText('份额'), {
      target: { value: '900' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    expect(screen.queryByText('卖出份额不能大于当前可用份额')).toBeNull();
    expect(screen.getByText('份额 900')).toBeTruthy();
    expect(screen.queryByText('份额 200')).toBeNull();
  });
});
