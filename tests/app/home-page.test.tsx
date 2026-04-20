import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '@/app/page';

const mockUseAuthSession = vi.fn();
const mockUseWatchlist = vi.fn();
const mockUseFundQuotes = vi.fn();
const mockLoadEstimateIntradayPoints = vi.fn();
const mockTrack = vi.fn();
const mockTrackOnce = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock('@/lib/hooks/use-watchlist', () => ({
  useWatchlist: (...args: unknown[]) => mockUseWatchlist(...args),
}));

vi.mock('@/lib/hooks/use-fund-quotes', () => ({
  useFundQuotes: (...args: unknown[]) => mockUseFundQuotes(...args),
}));

vi.mock('@/lib/hooks/use-intraday-analytics', () => ({
  useIntradayAnalytics: () => ({
    track: mockTrack,
    trackOnce: mockTrackOnce,
  }),
}));

vi.mock('@/lib/storage/estimate-intraday-storage', () => ({
  ESTIMATE_INTRADAY_STORAGE_KEY: 'super-finance-estimate-intraday',
  ESTIMATE_INTRADAY_UPDATED_EVENT: 'super-finance-estimate-intraday-updated',
  loadEstimateIntradayPoints: () => mockLoadEstimateIntradayPoints(),
}));

vi.mock('@/components/auth/sync-conflict-dialog', () => ({
  SyncConflictDialog: () => null,
}));

vi.mock('@/components/shared/status-banner', () => ({
  StatusBanner: () => null,
}));

vi.mock('@/components/watchlist/add-fund-dialog', () => ({
  AddFundDialog: () => <div data-testid="add-fund-dialog" />,
}));

vi.mock('@/components/watchlist/edit-position-dialog', () => ({
  EditPositionDialog: () => null,
}));

const baseFund = {
  code: '000001',
  name: '测试基金',
  position: {
    cost: 1000,
    shares: 500,
  },
};

afterEach(() => {
  cleanup();
});

describe('HomePage adjustment preview consistency', () => {
  beforeEach(() => {
    mockTrack.mockReset();
    mockTrackOnce.mockReset();
    mockUseAuthSession.mockReturnValue({
      userId: null,
      isAuthenticated: false,
      cloudClient: null,
      accuracyStore: { kind: 'local-store' },
    });
    mockUseWatchlist.mockReturnValue({
      watchlist: [baseFund],
      addFund: vi.fn(),
      removeFund: vi.fn(),
      updatePosition: vi.fn(),
    });
    mockLoadEstimateIntradayPoints.mockReturnValue({});
  });

  it.each([
    ['review', '建议重点复核', '修正仍有改善，但已出现恶化样本或改善幅度偏弱，需要继续复核。'],
    ['downgrade', '建议降级观察', '最近回写样本连续恶化或整体改善已转负，建议先回退到观察状态。'],
  ] as const)(
    'does not advertise preview availability on the home page when validation recommendation is %s',
    (validationRecommendationStatus, validationRecommendationLabel, validationRecommendationReason) => {
      mockUseFundQuotes.mockReturnValue({
        quotes: [
          {
            code: '000001',
            name: '测试基金',
            estimatedNav: 1.05,
            changeRate: 0.88,
            updatedAt: '2026-04-14 15:10',
            adjustedEstimatedNav: 1.0345,
            adjustmentApplied: true,
            adjustmentPolicy: {
              mode: 'active',
              decisionStatus: 'validated',
              decisionUpdatedAt: '2026-04-14T09:00:00.000Z',
              cooldownActive: false,
              cooldownEndsAt: null,
              validationRecommendationStatus,
              validationRecommendationLabel,
              validationRecommendationReason,
              scenarioKey: 'diagnosis-aware',
              scenarioLabel: '诊断 + 尾盘联动修正',
              diagnosis: '持续偏高',
              recommendedImprovementRate: 0.83,
              correctionFactor: 0.015,
              adjustedEstimatedNav: 1.0345,
              reason: '该基金修正规则已通过闭环验证，当前为预览启用状态。',
            },
          },
        ],
        error: null,
        isRefreshing: false,
        lastUpdatedAt: '2026-04-14 15:10',
        refresh: vi.fn(),
      });

      render(<HomePage />);

      const row = screen.getByRole('row', { name: /测试基金/ });
      expect(within(row).getByText('1.05')).toBeTruthy();
      expect(within(row).queryByText('修正预览可用')).toBeNull();
      expect(within(row).queryByText(/详情页可切换/)).toBeNull();
    },
  );

  it('passes the auth accuracy store into useFundQuotes', () => {
    const accuracyStore = { kind: 'auth-accuracy-store' };
    mockUseAuthSession.mockReturnValue({
      userId: 'user-1',
      isAuthenticated: true,
      cloudClient: { kind: 'watchlist-cloud' },
      accuracyStore,
    });
    mockUseFundQuotes.mockReturnValue({
      quotes: [],
      error: null,
      isRefreshing: false,
      lastUpdatedAt: null,
      refresh: vi.fn(),
    });

    render(<HomePage />);

    expect(mockUseFundQuotes).toHaveBeenCalledWith(['000001'], undefined, undefined, {
      accuracyStore,
    });
  });

  it('tracks manual refresh clicks from the homepage', () => {
    const refresh = vi.fn();
    mockUseFundQuotes.mockReturnValue({
      quotes: [],
      error: null,
      isRefreshing: false,
      lastUpdatedAt: null,
      refresh,
    });

    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: '手动刷新' }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'watchlist_manual_refresh_clicked',
        page: 'home',
      }),
    );
  });

  it('renders intraday trends from local intraday storage', () => {
    mockUseFundQuotes.mockReturnValue({
      quotes: [
        {
          code: '000001',
          name: '测试基金',
          estimatedNav: 1.05,
          changeRate: 0.88,
          updatedAt: '2026-04-17 10:31',
        },
      ],
      error: null,
      isRefreshing: false,
      lastUpdatedAt: '2026-04-17 10:31',
      refresh: vi.fn(),
    });
    mockLoadEstimateIntradayPoints.mockReturnValue({
      '000001': [
        {
          fundCode: '000001',
          fundName: '测试基金',
          tradingDate: '2026-04-17',
          minuteKey: '2026-04-17 10:30',
          estimatedNav: 1,
          changeRate: 0,
          updatedAt: '2026-04-17 10:30',
          capturedAt: '2026-04-17T02:30:00.000Z',
        },
        {
          fundCode: '000001',
          fundName: '测试基金',
          tradingDate: '2026-04-17',
          minuteKey: '2026-04-17 10:31',
          estimatedNav: 1.01,
          changeRate: 0.8,
          updatedAt: '2026-04-17 10:31',
          capturedAt: '2026-04-17T02:31:00.000Z',
        },
      ],
    });

    render(<HomePage />);

    expect(screen.getByText('上行')).toBeTruthy();
    expect(screen.getByTestId('fund-intraday-sparkline')).toBeTruthy();
    expect(screen.getByText('分时生成中')).toBeTruthy();
    expect(screen.getByText('置信度低')).toBeTruthy();
    expect(screen.getByText('2/240')).toBeTruthy();
  });

  it('upgrades homepage confidence when historical accuracy samples are available', () => {
    mockUseAuthSession.mockReturnValue({
      userId: null,
      isAuthenticated: false,
      cloudClient: null,
      accuracyStore: {
        loadSnapshots: () => [
          {
            id: 's-1',
            fundCode: '000001',
            fundName: '测试基金',
            quoteUpdatedAt: '2026-04-14 10:30',
            tradingDate: '2026-04-14',
            estimatedNav: 1.001,
            finalNav: 1,
            absoluteErrorRate: 0.001,
            resolvedAt: '2026-04-14T15:30:00.000Z',
            createdAt: '2026-04-14T10:30:00.000Z',
            updatedAt: '2026-04-14T15:30:00.000Z',
          },
          {
            id: 's-2',
            fundCode: '000001',
            fundName: '测试基金',
            quoteUpdatedAt: '2026-04-15 10:30',
            tradingDate: '2026-04-15',
            estimatedNav: 1.002,
            finalNav: 1,
            absoluteErrorRate: 0.002,
            resolvedAt: '2026-04-15T15:30:00.000Z',
            createdAt: '2026-04-15T10:30:00.000Z',
            updatedAt: '2026-04-15T15:30:00.000Z',
          },
          {
            id: 's-3',
            fundCode: '000001',
            fundName: '测试基金',
            quoteUpdatedAt: '2026-04-16 10:30',
            tradingDate: '2026-04-16',
            estimatedNav: 1.003,
            finalNav: 1,
            absoluteErrorRate: 0.003,
            resolvedAt: '2026-04-16T15:30:00.000Z',
            createdAt: '2026-04-16T10:30:00.000Z',
            updatedAt: '2026-04-16T15:30:00.000Z',
          },
        ],
      },
    });
    mockUseFundQuotes.mockReturnValue({
      quotes: [
        {
          code: '000001',
          name: '测试基金',
          estimatedNav: 1.05,
          changeRate: 0.88,
          updatedAt: '2026-04-17 10:42',
        },
      ],
      error: null,
      isRefreshing: false,
      lastUpdatedAt: '2026-04-17 10:42',
      refresh: vi.fn(),
    });
    mockLoadEstimateIntradayPoints.mockReturnValue({
      '000001': Array.from({ length: 12 }, (_, index) => ({
        fundCode: '000001',
        fundName: '测试基金',
        tradingDate: '2026-04-17',
        minuteKey: `2026-04-17 10:${String(30 + index).padStart(2, '0')}`,
        estimatedNav: 1 + index * 0.001,
        changeRate: 0.1 * index,
        updatedAt: `2026-04-17 10:${String(30 + index).padStart(2, '0')}`,
        capturedAt: `2026-04-17T02:${String(30 + index).padStart(2, '0')}:00.000Z`,
      })),
    });

    render(<HomePage />);

    const row = screen.getByRole('row', { name: /测试基金/ });
    expect(within(row).getByText('10:41 更新')).toBeTruthy();
    expect(within(row).getByText('置信度中')).toBeTruthy();
    expect(within(row).getByText('12/240')).toBeTruthy();
  });
});
