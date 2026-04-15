import type React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WatchlistTable } from '@/components/watchlist/watchlist-table';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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

afterEach(() => {
  cleanup();
});

describe('WatchlistTable adjustment preview status', () => {
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
    expect(within(row).getByText(/详情页可切换/)).toBeTruthy();
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
      expect(within(row).queryByText(/详情页可切换/)).toBeNull();
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
});
