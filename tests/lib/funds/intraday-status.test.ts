import { describe, expect, it } from 'vitest';

import {
  buildIntradayTrustSignal,
  formatIntradayLastUpdatedLabel,
  resolveIntradaySignalTradingDate,
} from '@/lib/funds/intraday-status';
import type { EstimateIntradayPoint, EstimateIntradayTrustSignalInput } from '@/lib/funds/types';

const point = (overrides: Partial<EstimateIntradayPoint> = {}): EstimateIntradayPoint => ({
  fundCode: '000001',
  fundName: '测试基金',
  tradingDate: '2026-04-20',
  minuteKey: '2026-04-20 09:31',
  estimatedNav: 1,
  changeRate: 0,
  updatedAt: '2026-04-20 09:31',
  capturedAt: '2026-04-20T01:31:00.000Z',
  ...overrides,
});

const buildInput = (
  overrides: Partial<EstimateIntradayTrustSignalInput> = {},
): EstimateIntradayTrustSignalInput => ({
  points: [],
  quoteUpdatedAt: '2026-04-20 09:31',
  currentTradingDate: '2026-04-20',
  historicalConfidenceLevel: 'unknown',
  ...overrides,
});

describe('buildIntradayTrustSignal', () => {
  it('marks malformed quote timestamps as unsupported', () => {
    expect(
      buildIntradayTrustSignal(
        buildInput({
          quoteUpdatedAt: 'bad timestamp',
        }),
      ),
    ).toMatchObject({
      status: 'unsupported',
      statusLabel: '暂不支持',
      confidenceLevel: 'unknown',
      coverageText: '0/240',
    });
  });

  it('marks old-only points as stale for today', () => {
    expect(
      buildIntradayTrustSignal(
        buildInput({
          quoteUpdatedAt: '2026-04-19 14:58',
          points: [point({ tradingDate: '2026-04-19', minuteKey: '2026-04-19 14:58', updatedAt: '2026-04-19 14:58' })],
        }),
      ),
    ).toMatchObject({
      status: 'stale',
      statusLabel: '今日待更新',
      confidenceLevel: 'low',
      lastUpdatedLabel: '14:58 更新',
    });
  });

  it('marks no current-day points as empty', () => {
    expect(buildIntradayTrustSignal(buildInput())).toMatchObject({
      status: 'empty',
      statusLabel: '今日暂无分时',
      confidenceLevel: 'unknown',
      coverageText: '0/240',
      coverageRatio: 0,
    });
  });

  it('marks sparse current-day points as generating', () => {
    expect(
      buildIntradayTrustSignal(
        buildInput({
          points: [
            point(),
            point({ minuteKey: '2026-04-20 09:32', updatedAt: '2026-04-20 09:32' }),
          ],
        }),
      ),
    ).toMatchObject({
      status: 'generating',
      statusLabel: '分时生成中',
      confidenceLevel: 'low',
      coverageText: '2/240',
    });
  });

  it('marks sufficiently populated current-day points as ready and promotes historical confidence', () => {
    const points = Array.from({ length: 12 }, (_, index) =>
      point({
        minuteKey: `2026-04-20 09:${String(31 + index).padStart(2, '0')}`,
        updatedAt: `2026-04-20 09:${String(31 + index).padStart(2, '0')}`,
      }),
    );

    expect(
      buildIntradayTrustSignal(
        buildInput({
          points,
          quoteUpdatedAt: '2026-04-20 09:42',
          historicalConfidenceLevel: 'high',
        }),
      ),
    ).toMatchObject({
      status: 'ready',
      statusLabel: '09:42 更新',
      lastUpdatedAt: '2026-04-20 09:42',
      lastUpdatedLabel: '09:42 更新',
      confidenceLevel: 'high',
      confidenceText: '置信度高',
      coverageText: '12/240',
      coverageRatio: 0.05,
    });
  });

  it('degrades ready status with weak historical accuracy into medium or low confidence', () => {
    const points = Array.from({ length: 12 }, (_, index) =>
      point({
        minuteKey: `2026-04-20 10:${String(index).padStart(2, '0')}`,
        updatedAt: `2026-04-20 10:${String(index).padStart(2, '0')}`,
      }),
    );

    expect(
      buildIntradayTrustSignal(
        buildInput({
          points,
          quoteUpdatedAt: '2026-04-20 10:11',
          historicalConfidenceLevel: 'medium',
        }),
      ).confidenceLevel,
    ).toBe('medium');

    expect(
      buildIntradayTrustSignal(
        buildInput({
          points,
          quoteUpdatedAt: '2026-04-20 10:11',
          historicalConfidenceLevel: 'low',
        }),
      ).confidenceLevel,
    ).toBe('low');
  });
});

describe('formatIntradayLastUpdatedLabel', () => {
  it('formats supported timestamps into hh:mm 更新', () => {
    expect(formatIntradayLastUpdatedLabel('2026-04-20 09:42')).toBe('09:42 更新');
    expect(formatIntradayLastUpdatedLabel('2026-04-20T01:42:00.000Z')).toBe('09:42 更新');
  });

  it('falls back gracefully for missing values', () => {
    expect(formatIntradayLastUpdatedLabel(null)).toBe('暂无更新');
  });
});

describe('resolveIntradaySignalTradingDate', () => {
  it('uses the latest trading date across quote and intraday points', () => {
    expect(
      resolveIntradaySignalTradingDate({
        quoteUpdatedAt: '2026-04-17 10:31',
        points: [point({ tradingDate: '2026-04-18', minuteKey: '2026-04-18 10:31', updatedAt: '2026-04-18 10:31' })],
      }),
    ).toBe('2026-04-18');
  });
});
