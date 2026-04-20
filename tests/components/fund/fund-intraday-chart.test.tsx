import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FundIntradayChart } from '@/components/fund/fund-intraday-chart';
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

afterEach(() => {
  cleanup();
});

describe('FundIntradayChart', () => {
  it('renders an empty state without points', () => {
    render(<FundIntradayChart points={[]} />);

    expect(screen.getByText('今日走势')).toBeTruthy();
    expect(screen.getByText(/今日分时数据还在生成中/)).toBeTruthy();
    expect(screen.getByText(/开盘后保持页面打开/)).toBeTruthy();
  });

  it('renders summary metrics and svg for multiple points', () => {
    render(
      <FundIntradayChart
        points={[
          point({ estimatedNav: 1, changeRate: 0 }),
          point({
            minuteKey: '2026-04-17 10:31',
            estimatedNav: 1.02,
            changeRate: 1.1,
            updatedAt: '2026-04-17 10:31',
          }),
          point({
            minuteKey: '2026-04-17 10:32',
            estimatedNav: 1.01,
            changeRate: 0.8,
            updatedAt: '2026-04-17 10:32',
          }),
        ]}
      />,
    );

    expect(screen.getByTestId('fund-intraday-chart')).toBeTruthy();
    expect(screen.getByText('当前估值')).toBeTruthy();
    expect(screen.getByText('1.0100')).toBeTruthy();
    expect(screen.getByText('今日最高')).toBeTruthy();
    expect(screen.getByText('1.0200')).toBeTruthy();
    expect(screen.getByText('今日最低')).toBeTruthy();
    expect(screen.getByText('1.0000')).toBeTruthy();
    expect(screen.getByText('开盘至今')).toBeTruthy();
    expect(screen.getByText('+1.00%')).toBeTruthy();
    expect(screen.getByText('最新涨跌')).toBeTruthy();
    expect(screen.getByText('+0.80%')).toBeTruthy();
    expect(screen.getByText('日内振幅')).toBeTruthy();
    expect(screen.getByText('2.00%')).toBeTruthy();
    expect(screen.getByText('上行')).toBeTruthy();
  });
});
