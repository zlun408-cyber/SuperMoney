import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createIntradayAnalyticsEvent } from '@/lib/analytics/intraday-analytics';
import {
  appendIntradayAnalyticsEvent,
  clearIntradayAnalyticsEvents,
  INTRADAY_ANALYTICS_STORAGE_KEY,
  INTRADAY_ANALYTICS_UPDATED_EVENT,
  loadIntradayAnalyticsEvents,
} from '@/lib/storage/intraday-analytics-storage';

describe('intraday analytics storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads an empty array when localStorage is empty or malformed', () => {
    expect(loadIntradayAnalyticsEvents()).toEqual([]);

    window.localStorage.setItem(INTRADAY_ANALYTICS_STORAGE_KEY, '{bad json');
    expect(loadIntradayAnalyticsEvents()).toEqual([]);
  });

  it('appends one event and broadcasts a same-tab update event', () => {
    const listener = vi.fn();
    window.addEventListener(INTRADAY_ANALYTICS_UPDATED_EVENT, listener);

    const event = createIntradayAnalyticsEvent({
      eventName: 'watchlist_row_viewed',
      page: 'home',
      fundCode: '000001',
      occurredAt: '2026-04-20T03:00:00.000Z',
    });

    appendIntradayAnalyticsEvent(event);

    expect(loadIntradayAnalyticsEvents()).toEqual([event]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('appends multiple events in insertion order', () => {
    const first = createIntradayAnalyticsEvent({
      eventName: 'watchlist_row_viewed',
      page: 'home',
      fundCode: '000001',
      occurredAt: '2026-04-20T03:00:00.000Z',
    });
    const second = createIntradayAnalyticsEvent({
      eventName: 'watchlist_fund_clicked',
      page: 'home',
      fundCode: '000001',
      occurredAt: '2026-04-20T03:01:00.000Z',
    });

    appendIntradayAnalyticsEvent(first);
    appendIntradayAnalyticsEvent(second);

    expect(loadIntradayAnalyticsEvents()).toEqual([first, second]);
  });

  it('keeps only the latest bounded set of events', () => {
    for (let index = 0; index < 5; index += 1) {
      appendIntradayAnalyticsEvent(
        createIntradayAnalyticsEvent({
          eventName: 'watchlist_row_viewed',
          page: 'home',
          fundCode: `00000${index}`,
          occurredAt: `2026-04-20T03:0${index}:00.000Z`,
        }),
        3,
      );
    }

    const events = loadIntradayAnalyticsEvents();
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.fundCode)).toEqual(['000002', '000003', '000004']);
  });

  it('clears all events and broadcasts an update', () => {
    const listener = vi.fn();
    window.addEventListener(INTRADAY_ANALYTICS_UPDATED_EVENT, listener);

    appendIntradayAnalyticsEvent(
      createIntradayAnalyticsEvent({
        eventName: 'fund_detail_viewed',
        page: 'fund_detail',
        fundCode: '000001',
        occurredAt: '2026-04-20T03:00:00.000Z',
      }),
    );

    clearIntradayAnalyticsEvents();

    expect(loadIntradayAnalyticsEvents()).toEqual([]);
    expect(window.localStorage.getItem(INTRADAY_ANALYTICS_STORAGE_KEY)).toBe('[]');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
