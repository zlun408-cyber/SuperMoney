import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EstimateConfidencePanel } from '@/components/fund/estimate-confidence-panel';
import { FundDetailCard } from '@/components/fund/fund-detail-card';
import type { EstimateAccuracySummary } from '@/lib/funds/types';

const accuracySummary: EstimateAccuracySummary = {
  fundCode: '000001',
  sampleCount: 8,
  resolvedSampleCount: 6,
  resolvedTradingDayCount: 6,
  highErrorResolvedSampleCount: 0,
  averageAbsoluteErrorRate: 0.0042,
  latestQuoteUpdatedAt: '2026-04-13T08:00:00.000Z',
  latestResolvedAt: '2026-04-12T08:00:00.000Z',
};

afterEach(() => {
  cleanup();
});

describe('EstimateConfidencePanel', () => {
  it('shows confidence, resolved sample count, and average absolute error percentage', () => {
    render(<EstimateConfidencePanel summary={accuracySummary} confidenceLevel="medium" />);

    expect(screen.getByText('估值可信度')).toBeTruthy();
    expect(screen.getByText('中')).toBeTruthy();
    expect(screen.getByText('已收敛样本数')).toBeTruthy();
    expect(screen.getByText('6 / 8')).toBeTruthy();
    expect(screen.getByText('平均绝对误差')).toBeTruthy();
    expect(screen.getByText('0.42%')).toBeTruthy();
  });

  it('uses an honest fallback when confidence is unknown', () => {
    render(
      <EstimateConfidencePanel
        summary={{
          ...accuracySummary,
          sampleCount: 2,
          resolvedSampleCount: 0,
          averageAbsoluteErrorRate: null,
        }}
        confidenceLevel="unknown"
      />,
    );

    expect(screen.getByText('未知')).toBeTruthy();
    expect(screen.getByText('0 / 2')).toBeTruthy();
    expect(screen.getByText('样本不足')).toBeTruthy();
    expect(screen.getByText('暂无足够已收敛样本，估值可信度暂不可判断。')).toBeTruthy();
  });
});

describe('FundDetailCard estimate confidence panel', () => {
  const fund = {
    code: '000001',
    name: '测试基金',
    position: { cost: 1000, shares: 500 },
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

  it('renders the estimate confidence panel when an accuracy summary is provided', () => {
    const { container } = render(
      <FundDetailCard
        fund={fund}
        estimateAccuracySummary={accuracySummary}
        estimateConfidenceLevel="high"
      />,
    );

    expect(within(container).getByText('估值可信度')).toBeTruthy();
    expect(within(container).getByText('高')).toBeTruthy();
    expect(within(container).getByText('6 / 8')).toBeTruthy();
  });

  it('renders the estimate adjustment policy preview when the quote carries a validated policy', () => {
    render(
      <FundDetailCard
        fund={fund}
        quote={baseQuote}
      />,
    );

    expect(screen.getByText('估值修正策略')).toBeTruthy();
    expect(screen.getByText('已启用预览')).toBeTruthy();
    expect(screen.getByText('诊断 + 尾盘联动修正')).toBeTruthy();
    expect(screen.getAllByText('1.0345').length).toBeGreaterThan(0);
    expect(screen.getByText('83.0%')).toBeTruthy();
  });

  it('shows raw vs adjusted nav comparison and lets validated funds switch into preview mode', () => {
    render(
      <FundDetailCard
        fund={fund}
        quote={baseQuote}
      />,
    );

    expect(screen.getAllByText('原始估值').length).toBeGreaterThan(0);
    expect(screen.getAllByText('修正估值').length).toBeGreaterThan(0);
    expect(screen.getAllByText('估值差额').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '切换到修正估值预览' })).toBeTruthy();
    expect(screen.getByText('1.05')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '切换到修正估值预览' }));

    expect(screen.getByRole('button', { name: '切换回原始估值' })).toBeTruthy();
    expect(screen.getByText('当前按修正估值预览持仓与收益')).toBeTruthy();
    expect(screen.getByText('1.03')).toBeTruthy();
  });

  it.each([
    ['review', '建议重点复核', '修正仍有改善，但已出现恶化样本或改善幅度偏弱，需要继续复核。'],
    ['downgrade', '建议降级观察', '最近回写样本连续恶化或整体改善已转负，建议先回退到观察状态。'],
  ] as const)(
    'locks adjusted preview when validation recommendation is %s',
    (validationRecommendationStatus, validationRecommendationLabel, validationRecommendationReason) => {
      const { rerender } = render(<FundDetailCard fund={fund} quote={baseQuote} />);

      fireEvent.click(screen.getByRole('button', { name: '切换到修正估值预览' }));
      expect(screen.getByRole('button', { name: '切换回原始估值' })).toBeTruthy();
      expect(screen.getByText('当前按修正估值预览持仓与收益')).toBeTruthy();
      expect(screen.getByText('1.03')).toBeTruthy();

      rerender(
        <FundDetailCard
          fund={fund}
          quote={{
            ...baseQuote,
            adjustmentPolicy: {
              ...baseQuote.adjustmentPolicy,
              validationRecommendationStatus,
              validationRecommendationLabel,
              validationRecommendationReason,
            },
          }}
        />,
      );

      expect(screen.queryByRole('button', { name: '切换回原始估值' })).toBeNull();
      expect(screen.queryByRole('button', { name: '切换到修正估值预览' })).toBeNull();
      expect(screen.queryByText('当前按修正估值预览持仓与收益')).toBeNull();
      expect(screen.queryByText('估值修正预览')).toBeNull();
      expect(screen.getByText('1.05')).toBeTruthy();
      expect(screen.queryByText('1.03')).toBeNull();
    },
  );

  it('shows validation recheck warning when an active policy is flagged by writeback feedback', () => {
    render(
      <FundDetailCard
        fund={fund}
        quote={{
          ...baseQuote,
          adjustmentPolicy: {
            ...baseQuote.adjustmentPolicy,
            validationRecommendationStatus: 'downgrade',
            validationRecommendationLabel: '建议降级观察',
            validationRecommendationReason:
              '最近回写样本连续恶化或整体改善已转负，建议先回退到观察状态。',
          },
        }}
      />,
    );

    expect(screen.getByText('回写复核中')).toBeTruthy();
    expect(screen.getByText('建议降级观察')).toBeTruthy();
    expect(screen.getByText(/最近回写样本连续恶化/)).toBeTruthy();
  });
});
