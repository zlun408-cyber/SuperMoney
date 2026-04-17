import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FundDetailContent } from '@/components/fund/fund-detail-content';

const mockUseFundQuotes = vi.fn();
const mockUseWatchlist = vi.fn();
const mockLoadEstimateAccuracySnapshots = vi.fn();
const mockUseAuthSession = vi.fn();

vi.mock('@/components/fund/add-sip-plan-dialog', () => ({
  AddSipPlanDialog: () => <div data-testid="add-sip-plan-dialog" />,
}));

vi.mock('@/components/fund/add-transaction-dialog', () => ({
  AddTransactionDialog: () => <div data-testid="add-transaction-dialog" />,
}));

vi.mock('@/components/fund/sip-plan-list', () => ({
  SipPlanList: () => <div data-testid="sip-plan-list" />,
}));

vi.mock('@/components/fund/transaction-list', () => ({
  TransactionList: () => <div data-testid="transaction-list" />,
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock('@/lib/hooks/use-fund-quotes', () => ({
  useFundQuotes: (...args: unknown[]) => mockUseFundQuotes(...args),
}));

vi.mock('@/lib/hooks/use-watchlist', () => ({
  useWatchlist: (...args: unknown[]) => mockUseWatchlist(...args),
}));

vi.mock('@/lib/storage/estimate-accuracy-storage', () => ({
  ESTIMATE_ACCURACY_STORAGE_KEY: 'super-finance-estimate-accuracy',
  ESTIMATE_ACCURACY_UPDATED_EVENT: 'super-finance-estimate-accuracy-updated',
  loadEstimateAccuracySnapshots: () => mockLoadEstimateAccuracySnapshots(),
}));

const baseFund = {
  code: '000001',
  name: '测试基金',
  position: {
    cost: 1000,
    shares: 500,
  },
};

const noop = vi.fn();

describe('FundDetailContent estimate confidence integration', () => {
  beforeEach(() => {
    mockUseAuthSession.mockReturnValue({
      userId: null,
      cloudClient: null,
      accuracyStore: {
        loadSnapshots: () => mockLoadEstimateAccuracySnapshots(),
      },
    });
    mockUseFundQuotes.mockReturnValue({
      quotes: [
        {
          code: '000001',
          name: '测试基金',
          estimatedNav: 1.23,
          changeRate: 0.8,
          updatedAt: '2026-04-13 14:30',
        },
      ],
    });
    mockUseWatchlist.mockReturnValue({
      watchlist: [baseFund],
      isReady: true,
      addTransaction: noop,
      updateTransaction: noop,
      removeTransaction: noop,
      addSipPlan: noop,
    });
    mockLoadEstimateAccuracySnapshots.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a loading state before the watchlist finishes loading', () => {
    mockUseWatchlist.mockReturnValue({
      watchlist: [],
      isReady: false,
      addTransaction: noop,
      updateTransaction: noop,
      removeTransaction: noop,
      addSipPlan: noop,
    });

    render(<FundDetailContent code="000001" />);

    expect(screen.getByText('正在加载基金详情…')).toBeTruthy();
    expect(screen.queryByText('没有找到这只基金，请先回到首页添加。')).toBeNull();
  });

  it('shows the unknown confidence panel even when there are no local samples yet', async () => {
    render(<FundDetailContent code="000001" />);

    await waitFor(() => {
      expect(screen.getByText('估值可信度')).toBeTruthy();
      expect(screen.getByText('未知')).toBeTruthy();
      expect(screen.getByText('0 / 0')).toBeTruthy();
      expect(screen.getByText('暂无足够已收敛样本，估值可信度暂不可判断。')).toBeTruthy();
    });
  });

  it('passes the auth accuracy store into useFundQuotes and reads summary snapshots from that store', async () => {
    const accuracyStore = {
      loadSnapshots: vi.fn(() => [
        {
          id: 's-1',
          fundCode: '000001',
          fundName: '测试基金',
          quoteUpdatedAt: '2026-04-10 14:30',
          tradingDate: '2026-04-10',
          estimatedNav: 1.004,
          finalNav: 1,
          absoluteErrorRate: 0.004,
          resolvedAt: '2026-04-10T15:30:00.000Z',
          createdAt: '2026-04-10T14:30:00.000Z',
          updatedAt: '2026-04-10T15:30:00.000Z',
        },
        {
          id: 's-2',
          fundCode: '000001',
          fundName: '测试基金',
          quoteUpdatedAt: '2026-04-11 14:30',
          tradingDate: '2026-04-11',
          estimatedNav: 1.005,
          finalNav: 1,
          absoluteErrorRate: 0.005,
          resolvedAt: '2026-04-11T15:30:00.000Z',
          createdAt: '2026-04-11T14:30:00.000Z',
          updatedAt: '2026-04-11T15:30:00.000Z',
        },
        {
          id: 's-3',
          fundCode: '000001',
          fundName: '测试基金',
          quoteUpdatedAt: '2026-04-12 14:30',
          tradingDate: '2026-04-12',
          estimatedNav: 1.003,
          finalNav: 1,
          absoluteErrorRate: 0.003,
          resolvedAt: '2026-04-12T15:30:00.000Z',
          createdAt: '2026-04-12T14:30:00.000Z',
          updatedAt: '2026-04-12T15:30:00.000Z',
        },
      ]),
    };
    mockUseAuthSession.mockReturnValue({
      userId: 'user-1',
      cloudClient: { kind: 'watchlist-cloud' },
      accuracyStore,
    });

    render(<FundDetailContent code="000001" />);

    expect(mockUseFundQuotes).toHaveBeenCalledWith(['000001'], undefined, undefined, {
      accuracyStore,
    });

    await waitFor(() => {
      expect(screen.getByText('中')).toBeTruthy();
      expect(screen.getByText('3 / 3')).toBeTruthy();
      expect(screen.getByText('0.40%')).toBeTruthy();
    });
  });

  it('refreshes the panel after same-tab estimate accuracy updates', async () => {
    let snapshots: Array<Record<string, unknown>> = [];
    mockLoadEstimateAccuracySnapshots.mockImplementation(() => snapshots);

    render(<FundDetailContent code="000001" />);

    await waitFor(() => {
      expect(screen.getByText('未知')).toBeTruthy();
      expect(screen.getByText('0 / 0')).toBeTruthy();
    });

    snapshots = [
      {
        id: 'a',
        fundCode: '000001',
        fundName: '测试基金',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.004,
        finalNav: 1,
        absoluteErrorRate: 0.004,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'b',
        fundCode: '000001',
        fundName: '测试基金',
        quoteUpdatedAt: '2026-04-11 14:30',
        tradingDate: '2026-04-11',
        estimatedNav: 1.005,
        finalNav: 1,
        absoluteErrorRate: 0.005,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
      {
        id: 'c',
        fundCode: '000001',
        fundName: '测试基金',
        quoteUpdatedAt: '2026-04-12 14:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.003,
        finalNav: 1,
        absoluteErrorRate: 0.003,
        resolvedAt: '2026-04-12T15:30:00.000Z',
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T15:30:00.000Z',
      },
    ];

    window.dispatchEvent(new CustomEvent('super-finance-estimate-accuracy-updated'));

    await waitFor(() => {
      expect(screen.getByText('中')).toBeTruthy();
      expect(screen.getByText('3 / 3')).toBeTruthy();
      expect(screen.getByText('0.40%')).toBeTruthy();
    });
  });

  it.each([
    ['review', '建议重点复核', '修正仍有改善，但已出现恶化样本或改善幅度偏弱，需要继续复核。'],
    ['downgrade', '建议降级观察', '最近回写样本连续恶化或整体改善已转负，建议先回退到观察状态。'],
  ] as const)(
    'keeps detail content on raw estimate when validation recommendation is %s',
    async (
      validationRecommendationStatus,
      validationRecommendationLabel,
      validationRecommendationReason,
    ) => {
      mockUseFundQuotes.mockReturnValue({
        quotes: [
          {
            code: '000001',
            name: '测试基金',
            estimatedNav: 1.23,
            changeRate: 0.8,
            updatedAt: '2026-04-13 14:30',
            adjustedEstimatedNav: 1.19,
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
              adjustedEstimatedNav: 1.19,
              reason: '该基金修正规则已通过闭环验证，当前为预览启用状态。',
            },
          },
        ],
      });

      render(<FundDetailContent code="000001" />);

      await waitFor(() => {
        expect(screen.getByText('回写复核中')).toBeTruthy();
        expect(screen.getByText(validationRecommendationLabel)).toBeTruthy();
        expect(screen.queryByText('估值修正预览')).toBeNull();
        expect(screen.queryByRole('button', { name: '切换到修正估值预览' })).toBeNull();
      });
    },
  );
});
