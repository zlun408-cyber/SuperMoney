import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstimateIntradayPoint } from '@/lib/funds/types';
import {
  ESTIMATE_INTRADAY_STORAGE_KEY,
  ESTIMATE_INTRADAY_UPDATED_EVENT,
  loadEstimateIntradayPoints,
  saveEstimateIntradayPoints,
  upsertEstimateIntradayPoints,
} from '@/lib/storage/estimate-intraday-storage';

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

describe('estimate intraday storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads an empty collection when localStorage is empty or malformed', () => {
    expect(loadEstimateIntradayPoints()).toEqual({});

    window.localStorage.setItem(ESTIMATE_INTRADAY_STORAGE_KEY, '{bad json');
    expect(loadEstimateIntradayPoints()).toEqual({});
  });

  it('saves valid points and broadcasts a same-tab update event', () => {
    const listener = vi.fn();
    window.addEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, listener);

    saveEstimateIntradayPoints({ '000001': [point()] });

    expect(JSON.parse(window.localStorage.getItem(ESTIMATE_INTRADAY_STORAGE_KEY) ?? '{}')).toEqual({
      '000001': [point()],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('filters malformed points when loading', () => {
    window.localStorage.setItem(
      ESTIMATE_INTRADAY_STORAGE_KEY,
      JSON.stringify({
        '000001': [point(), { fundCode: '000001', estimatedNav: 'bad' }],
      }),
    );

    expect(loadEstimateIntradayPoints()).toEqual({ '000001': [point()] });
  });

  it('upserts by fundCode and minuteKey while keeping latest same-minute value', () => {
    const result = upsertEstimateIntradayPoints(
      { '000001': [point({ estimatedNav: 1 })] },
      [point({ estimatedNav: 1.01, changeRate: 0.2, capturedAt: '2026-04-17T02:30:20.000Z' })],
      '2026-04-17',
    );

    expect(result['000001']).toEqual([
      point({ estimatedNav: 1.01, changeRate: 0.2, capturedAt: '2026-04-17T02:30:20.000Z' }),
    ]);
  });

  it('prunes non-current trading dates and caps per-fund points', () => {
    const points = Array.from({ length: 305 }, (_, index) =>
      point({
        minuteKey: `2026-04-17 10:${String(index).padStart(2, '0')}`,
        estimatedNav: 1 + index / 1000,
      }),
    );

    const result = upsertEstimateIntradayPoints(
      {
        '000001': [point({ tradingDate: '2026-04-16', minuteKey: '2026-04-16 14:30' })],
      },
      points,
      '2026-04-17',
      300,
    );

    expect(result['000001']).toHaveLength(300);
    expect(result['000001'].every((item) => item.tradingDate === '2026-04-17')).toBe(true);
  });
});
