import type React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WatchlistTable } from '@/components/watchlist/watchlist-table';

const mockTrack = vi.fn();
const mockTrackOnce = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock('@/lib/hooks/use-intraday-analytics', () => ({
  useIntradayAnalytics: () => ({
    track: mockTrack,
    trackOnce: mockTrackOnce,
  }),
}));

const baseFund = {
  code: '000001',
  name: '测试基金',
  position: {
    cost: 1000,
    shares: 500,
  },
};

const baseQuote = {
  code: '000001',
  name: '测试基金',
  estimatedNav: 1.05,
  changeRate: 0.88,
  updatedAt: '2026-04-14 15:10',
  adjustedEstimatedNav: 1.0345,
  adjustmentApplied: true,
  adjustmentPolicy: {
    mode: 'active' as const,
    decisionStatus: 'validated' as const,
    decisionUpdatedAt: '2026-04-14T09:00:00.000Z',
    cooldownActive: false,
    cooldownEndsAt: null,
    scenarioKey: 'diagnosis-aware' as const,
    scenarioLabel: '诊断 + 尾盘联动修正',
    diagnosis: '持续偏高' as const,
    recommendedImprovementRate: 0.83,
    correctionFactor: 0.015,
    adjustedEstimatedNav: 1.0345,
    reason: '该基金修正规则已通过闭环验证，当前为预览启用状态。',
  },
};

const intradayPoint = (overrides = {}) => ({
  fundCode: '000001',
  fundName: '测试基金',
  tradingDate: '2026-04-17',
  minuteKey: '2026-04-17 10:30',
  estimatedNav: 1,
  changeRate: 0,
  updatedAt: '2026-04-17 10:30',
  capturedAt: '2026-04-17T02:30:00.000Z',
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe('WatchlistTable adjustment preview status', () => {
  beforeEach(() => {
    mockTrack.mockReset();
    mockTrackOnce.mockReset();
  });

  it('surfaces validated adjustment preview availability without replacing the raw list estimate', () => {
    render(
      <WatchlistTable
        funds={[baseFund]}
        quotesByCode={{
          '000001': baseQuote,
        }}
        onEditPosition={vi.fn()}
        onRemoveFund={vi.fn()}
      />,
    );

    const row = screen.getByRole('row', { name: /测试基金/ });
    expect(within(row).getByText('1.05')).toBeTruthy();
    expect(within(row).getByText('修正预览可用')).toBeTruthy();
    expect(within(row).getByText('首页仍显示原始估值，修正预览请到详情页查看')).toBeTruthy();
    expect(within(row).queryByText(/差额/)).toBeNull();
  });

  it.each([
    ['review', '建议重点复核', '修正仍有改善，但已出现恶化样本或改善幅度偏弱，需要继续复核。'],
    ['downgrade', '建议降级观察', '最近回写样本连续恶化或整体改善已转负，建议先回退到观察状态。'],
  ] as const)(
    'hides the preview badge when validation recommendation is %s',
    (validationRecommendationStatus, validationRecommendationLabel, validationRecommendationReason) => {
      render(
        <WatchlistTable
          funds={[baseFund]}
          quotesByCode={{
            '000001': {
              ...baseQuote,
              adjustmentPolicy: {
                ...baseQuote.adjustmentPolicy,
                validationRecommendationStatus,
                validationRecommendationLabel,
                validationRecommendationReason,
              },
            },
          }}
          onEditPosition={vi.fn()}
          onRemoveFund={vi.fn()}
        />,
      );

      const row = screen.getByRole('row', { name: /测试基金/ });
      expect(within(row).getByText('1.05')).toBeTruthy();
      expect(within(row).queryByText('修正预览可用')).toBeNull();
      expect(within(row).queryByText(/首页仍显示原始估值/)).toBeNull();
    },
  );

  it('does not show the preview badge for non-active policies', () => {
    render(
      <WatchlistTable
        funds={[baseFund]}
        quotesByCode={{
          '000001': {
            code: '000001',
            name: '测试基金',
            estimatedNav: 1.05,
            changeRate: 0.88,
            updatedAt: '2026-04-14 15:10',
            adjustedEstimatedNav: null,
            adjustmentApplied: false,
            adjustmentPolicy: {
              mode: 'observe',
              decisionStatus: 'watch',
              decisionUpdatedAt: '2026-04-14T09:00:00.000Z',
              cooldownActive: false,
              cooldownEndsAt: null,
              scenarioKey: 'diagnosis-aware',
              scenarioLabel: '诊断 + 尾盘联动修正',
              diagnosis: '持续偏高',
              recommendedImprovementRate: 0.83,
              correctionFactor: 0.015,
              adjustedEstimatedNav: null,
              reason: '当前仅保留观察结论，先继续积累样本，不直接改写实时估值。',
            },
          },
        }}
        onEditPosition={vi.fn()}
        onRemoveFund={vi.fn()}
      />,
    );

    expect(screen.queryByText('修正预览可用')).toBeNull();
  });

  it('labels manual position-derived holding and profit clearly on the homepage', () => {
    render(
      <WatchlistTable
        funds={[baseFund]}
        quotesByCode={{
          '000001': baseQuote,
        }}
        onEditPosition={vi.fn()}
        onRemoveFund={vi.fn()}
      />,
    );

    const row = screen.getByRole('row', { name: /测试基金/ });
    expect(within(row).getByText('手工持仓')).toBeTruthy();
    expect(within(row).getByText('按手工持仓估算')).toBeTruthy();
    expect(within(row).getByText('成本 1000.00 / 份额 500.00')).toBeTruthy();
    expect(within(row).getByText('-475.00')).toBeTruthy();
  });

  it('labels transaction-ledger-derived holding and profit clearly on the homepage', () => {
    render(
      <WatchlistTable
        funds={[
          {
            ...baseFund,
            transactions: [
              {
                id: 'tx-1',
                type: 'buy',
                amount: 1000,
                confirmedNav: 1,
                fee: 0,
                placedDate: '2026-04-10',
                placedPeriod: 'before_1500',
                effectiveDate: '2026-04-10',
                source: 'manual',
              },
            ],
          },
        ]}
        quotesByCode={{
          '000001': baseQuote,
        }}
        onEditPosition={vi.fn()}
        onRemoveFund={vi.fn()}
      />,
    );

    const row = screen.getByRole('row', { name: /测试基金/ });
    expect(within(row).getByText('交易记录')).toBeTruthy();
    expect(within(row).getByText('按交易记录估算')).toBeTruthy();
    expect(within(row).getByText('成本 1000.00 / 份额 1000.00')).toBeTruthy();
    expect(within(row).getByText('50.00')).toBeTruthy();
  });

  it('renders intraday trend beside fund name and a sparkline column', () => {
    render(
      <WatchlistTable
        funds={[baseFund]}
        quotesByCode={{
          '000001': baseQuote,
        }}
        intradayPointsByCode={{
          '000001': [
            intradayPoint({ estimatedNav: 1 }),
            intradayPoint({ minuteKey: '2026-04-17 10:31', estimatedNav: 1.01 }),
          ],
        }}
        intradayTrustSignalsByCode={{
          '000001': {
            status: 'ready',
            statusLabel: '10:31 更新',
            statusTone: 'info',
            lastUpdatedAt: '2026-04-17 10:31',
            lastUpdatedLabel: '10:31 更新',
            coverageRatio: 0.02,
            coverageText: '2/240',
            pointCount: 2,
            expectedPointCount: 240,
            confidenceLevel: 'medium',
            confidenceText: '置信度中',
          },
        }}
        onEditPosition={vi.fn()}
        onRemoveFund={vi.fn()}
      />,
    );

    const row = screen.getByRole('row', { name: /测试基金/ });
    expect(within(row).getByText('上行')).toBeTruthy();
    expect(within(row).getByText('今日 +1.00%')).toBeTruthy();
    expect(within(row).getByTestId('fund-intraday-sparkline')).toBeTruthy();
    expect(within(row).getByText('10:31 更新')).toBeTruthy();
    expect(within(row).getByText('置信度中')).toBeTruthy();
    expect(within(row).getByText('2/240')).toBeTruthy();
  });

  it('tracks watchlist row views and intraday state exposure on first render', async () => {
    render(
      <WatchlistTable
        funds={[baseFund]}
        quotesByCode={{
          '000001': baseQuote,
        }}
        intradayPointsByCode={{
          '000001': [
            intradayPoint({ estimatedNav: 1 }),
            intradayPoint({ minuteKey: '2026-04-17 10:31', estimatedNav: 1.01 }),
          ],
        }}
        intradayTrustSignalsByCode={{
          '000001': {
            status: 'ready',
            statusLabel: '10:31 更新',
            statusTone: 'info',
            lastUpdatedAt: '2026-04-17 10:31',
            lastUpdatedLabel: '10:31 更新',
            coverageRatio: 0.02,
            coverageText: '2/240',
            pointCount: 2,
            expectedPointCount: 240,
            confidenceLevel: 'medium',
            confidenceText: '置信度中',
          },
        }}
        onEditPosition={vi.fn()}
        onRemoveFund={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockTrackOnce).toHaveBeenCalledWith(
        'watchlist-row:000001',
        expect.objectContaining({
          eventName: 'watchlist_row_viewed',
          page: 'home',
          fundCode: '000001',
        }),
      );
    });

    expect(mockTrackOnce).toHaveBeenCalledWith(
      'watchlist-intraday-state:000001:ready:2026-04-17',
      expect.objectContaining({
        eventName: 'watchlist_intraday_state_seen',
        page: 'home',
        fundCode: '000001',
        tradingDate: '2026-04-17',
        intradayStatus: 'ready',
        confidenceLevel: 'medium',
        coverageRatio: 0.02,
      }),
    );
  });

  it('tracks fund name clicks from the watchlist row', () => {
    render(
      <WatchlistTable
        funds={[baseFund]}
        quotesByCode={{
          '000001': baseQuote,
        }}
        onEditPosition={vi.fn()}
        onRemoveFund={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: '测试基金' }));

    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'watchlist_fund_clicked',
        page: 'home',
        fundCode: '000001',
      }),
    );
  });
});
