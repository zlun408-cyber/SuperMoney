import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '@/app/page';

const mockUseAuthSession = vi.fn();
const mockUseWatchlist = vi.fn();
const mockUseFundQuotes = vi.fn();

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
});
