import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIntradayAnalytics } from '@/lib/hooks/use-intraday-analytics';

const mockAppendIntradayAnalyticsEvent = vi.fn();

vi.mock('@/lib/storage/intraday-analytics-storage', async () => {
  const actual = await vi.importActual('@/lib/storage/intraday-analytics-storage');
  return {
    ...actual,
    appendIntradayAnalyticsEvent: (...args: unknown[]) => mockAppendIntradayAnalyticsEvent(...args),
  };
});

describe('useIntradayAnalytics', () => {
  beforeEach(() => {
    mockAppendIntradayAnalyticsEvent.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks arbitrary events', () => {
    const { result } = renderHook(() => useIntradayAnalytics());

    result.current.track({
      eventName: 'watchlist_row_viewed',
      page: 'home',
      fundCode: '000001',
      occurredAt: '2026-04-20T03:10:00.000Z',
    });

    expect(mockAppendIntradayAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'watchlist_row_viewed',
        page: 'home',
        fundCode: '000001',
        occurredAt: '2026-04-20T03:10:00.000Z',
      }),
    );
  });

  it('dedupes trackOnce calls within one mounted page lifetime', () => {
    const { result } = renderHook(() => useIntradayAnalytics());

    result.current.trackOnce('row:000001', {
      eventName: 'watchlist_row_viewed',
      page: 'home',
      fundCode: '000001',
      occurredAt: '2026-04-20T03:10:00.000Z',
    });
    result.current.trackOnce('row:000001', {
      eventName: 'watchlist_row_viewed',
      page: 'home',
      fundCode: '000001',
      occurredAt: '2026-04-20T03:11:00.000Z',
    });

    expect(mockAppendIntradayAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe different keys', () => {
    const { result } = renderHook(() => useIntradayAnalytics());

    result.current.trackOnce('row:000001', {
      eventName: 'watchlist_row_viewed',
      page: 'home',
      fundCode: '000001',
      occurredAt: '2026-04-20T03:10:00.000Z',
    });
    result.current.trackOnce('row:000002', {
      eventName: 'watchlist_row_viewed',
      page: 'home',
      fundCode: '000002',
      occurredAt: '2026-04-20T03:11:00.000Z',
    });

    expect(mockAppendIntradayAnalyticsEvent).toHaveBeenCalledTimes(2);
  });

  it('resets page-local dedupe state after unmount and remount', () => {
    const first = renderHook(() => useIntradayAnalytics());

    first.result.current.trackOnce('detail:000001', {
      eventName: 'fund_detail_viewed',
      page: 'fund_detail',
      fundCode: '000001',
      occurredAt: '2026-04-20T03:12:00.000Z',
    });
    first.unmount();

    const second = renderHook(() => useIntradayAnalytics());
    second.result.current.trackOnce('detail:000001', {
      eventName: 'fund_detail_viewed',
      page: 'fund_detail',
      fundCode: '000001',
      occurredAt: '2026-04-20T03:13:00.000Z',
    });

    expect(mockAppendIntradayAnalyticsEvent).toHaveBeenCalledTimes(2);
  });
});
