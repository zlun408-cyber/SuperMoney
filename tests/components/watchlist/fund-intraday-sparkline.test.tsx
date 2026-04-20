import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FundIntradaySparkline } from '@/components/watchlist/fund-intraday-sparkline';
import type { EstimateIntradayPoint } from '@/lib/funds/types';

const point = (overrides: Partial<EstimateIntradayPoint> = {}): EstimateIntradayPoint => ({
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

describe('FundIntradaySparkline', () => {
  it('renders an empty state without points', () => {
    render(<FundIntradaySparkline points={[]} />);

    expect(screen.getByText('今日暂无分时')).toBeTruthy();
  });

  it('renders a generating state with only one point', () => {
    render(<FundIntradaySparkline points={[point()]} />);

    expect(screen.getByText('分时生成中')).toBeTruthy();
  });

  it('renders a lightweight svg when multiple points exist', () => {
    render(
      <FundIntradaySparkline
        points={[
          point({ estimatedNav: 1 }),
          point({ minuteKey: '2026-04-17 10:31', estimatedNav: 1.01 }),
        ]}
      />,
    );

    expect(screen.getByTestId('fund-intraday-sparkline')).toBeTruthy();
    expect(screen.getByTestId('fund-intraday-sparkline-area')).toBeTruthy();
    expect(screen.getByTestId('fund-intraday-sparkline-baseline')).toBeTruthy();
    expect(screen.getByTestId('fund-intraday-sparkline-latest')).toBeTruthy();
  });
});
