import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FundTrendBadge } from '@/components/watchlist/fund-trend-badge';
import type { EstimateIntradaySummary } from '@/lib/funds/types';

const summary = (overrides: Partial<EstimateIntradaySummary> = {}): EstimateIntradaySummary => ({
  pointCount: 3,
  firstEstimatedNav: 1,
  latestEstimatedNav: 1.01,
  highEstimatedNav: 1.02,
  lowEstimatedNav: 1,
  changeFromFirst: 0.01,
  changeRateFromFirst: 1,
  latestChangeRate: 0.8,
  latestUpdatedAt: '2026-04-17 10:32',
  trend: 'up',
  ...overrides,
});

describe('FundTrendBadge', () => {
  it('renders up trend and today change summary', () => {
    render(<FundTrendBadge summary={summary()} />);

    expect(screen.getByText('上行')).toBeTruthy();
    expect(screen.getByText('今日 +1.00%')).toBeTruthy();
  });

  it('renders an accumulating state for fewer than two points', () => {
    render(
      <FundTrendBadge
        summary={summary({ pointCount: 1, trend: 'unknown', changeRateFromFirst: null })}
      />,
    );

    expect(screen.getByText('分时生成中')).toBeTruthy();
    expect(screen.getByText('今日待更新')).toBeTruthy();
  });
});
