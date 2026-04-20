import { describe, expect, it } from 'vitest';

import {
  buildEstimateIntradayPoint,
  buildIntradaySummary,
  classifyIntradayTrend,
  filterIntradayPointsForTradingDate,
  normalizeIntradayChartPoints,
} from '@/lib/funds/estimate-intraday';
import type { EstimateIntradayPoint, FundQuote } from '@/lib/funds/types';

const quote = (overrides: Partial<FundQuote> = {}): FundQuote => ({
  code: '000001',
  name: '测试基金',
  estimatedNav: 1.2345,
  changeRate: 0.82,
  updatedAt: '2026-04-17 10:31',
  ...overrides,
});

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

describe('estimate intraday helpers', () => {
  it('builds a minute-level intraday point from a quote', () => {
    expect(buildEstimateIntradayPoint(quote(), '2026-04-17T02:31:45.000Z')).toEqual({
      fundCode: '000001',
      fundName: '测试基金',
      tradingDate: '2026-04-17',
      minuteKey: '2026-04-17 10:31',
      estimatedNav: 1.2345,
      changeRate: 0.82,
      updatedAt: '2026-04-17 10:31',
      capturedAt: '2026-04-17T02:31:45.000Z',
    });
  });

  it('filters malformed or non-matching trading dates', () => {
    expect(
      filterIntradayPointsForTradingDate(
        [
          point({ minuteKey: '2026-04-17 10:30' }),
          point({ tradingDate: '2026-04-16', minuteKey: '2026-04-16 14:30' }),
        ],
        '2026-04-17',
      ),
    ).toEqual([point({ minuteKey: '2026-04-17 10:30' })]);
  });

  it('classifies up, down, flat and volatile trends', () => {
    expect(classifyIntradayTrend([point({ estimatedNav: 1 }), point({ estimatedNav: 1.01 })])).toBe('up');
    expect(classifyIntradayTrend([point({ estimatedNav: 1.01 }), point({ estimatedNav: 1 })])).toBe('down');
    expect(classifyIntradayTrend([point({ estimatedNav: 1 }), point({ estimatedNav: 1.0001 })])).toBe('flat');
    expect(
      classifyIntradayTrend([
        point({ estimatedNav: 1 }),
        point({ minuteKey: '2026-04-17 10:31', estimatedNav: 1.02 }),
        point({ minuteKey: '2026-04-17 10:32', estimatedNav: 1.001 }),
      ]),
    ).toBe('volatile');
  });

  it('builds summary values for the detail chart', () => {
    expect(
      buildIntradaySummary([
        point({ minuteKey: '2026-04-17 10:30', estimatedNav: 1, changeRate: 0.1 }),
        point({
          minuteKey: '2026-04-17 10:31',
          estimatedNav: 1.02,
          changeRate: 1.1,
          updatedAt: '2026-04-17 10:31',
        }),
        point({
          minuteKey: '2026-04-17 10:32',
          estimatedNav: 0.99,
          changeRate: -0.5,
          updatedAt: '2026-04-17 10:32',
        }),
      ]),
    ).toMatchObject({
      pointCount: 3,
      firstEstimatedNav: 1,
      latestEstimatedNav: 0.99,
      highEstimatedNav: 1.02,
      lowEstimatedNav: 0.99,
      changeFromFirst: -0.01,
      changeRateFromFirst: -1,
      latestChangeRate: -0.5,
      latestUpdatedAt: '2026-04-17 10:32',
      trend: 'volatile',
    });
  });

  it('normalizes chart points into an SVG viewport', () => {
    expect(
      normalizeIntradayChartPoints(
        [
          point({ minuteKey: '2026-04-17 10:30', estimatedNav: 1 }),
          point({ minuteKey: '2026-04-17 10:31', estimatedNav: 2 }),
        ],
        100,
        40,
      ),
    ).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 0 },
    ]);
  });
});
