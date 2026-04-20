import { describe, expect, it } from 'vitest';

import {
  createIntradayAnalyticsEvent,
  summarizeIntradayAnalyticsEvents,
} from '@/lib/analytics/intraday-analytics';

describe('createIntradayAnalyticsEvent', () => {
  it('fills required fields and keeps normalized optional fields', () => {
    const event = createIntradayAnalyticsEvent({
      eventName: 'watchlist_intraday_state_seen',
      page: 'home',
      fundCode: '000001',
      tradingDate: '2026-04-20',
      intradayStatus: 'generating',
      confidenceLevel: 'low',
      coverageRatio: 0.05,
      occurredAt: '2026-04-20T02:31:00.000Z',
      meta: {
        source: 'watchlist-row',
      },
    });

    expect(event).toEqual({
      id: expect.any(String),
      eventName: 'watchlist_intraday_state_seen',
      page: 'home',
      fundCode: '000001',
      tradingDate: '2026-04-20',
      intradayStatus: 'generating',
      confidenceLevel: 'low',
      coverageRatio: 0.05,
      occurredAt: '2026-04-20T02:31:00.000Z',
      meta: {
        source: 'watchlist-row',
      },
    });
  });

  it('normalizes invalid optional fields to null', () => {
    const event = createIntradayAnalyticsEvent({
      eventName: 'watchlist_manual_refresh_clicked',
      page: 'home',
      fundCode: '',
      tradingDate: '',
      intradayStatus: undefined,
      confidenceLevel: undefined,
      coverageRatio: Number.NaN,
      occurredAt: '2026-04-20T02:31:00.000Z',
    });

    expect(event).toEqual({
      id: expect.any(String),
      eventName: 'watchlist_manual_refresh_clicked',
      page: 'home',
      fundCode: null,
      tradingDate: null,
      intradayStatus: null,
      confidenceLevel: null,
      coverageRatio: null,
      occurredAt: '2026-04-20T02:31:00.000Z',
      meta: null,
    });
  });
});

describe('summarizeIntradayAnalyticsEvents', () => {
  it('aggregates counts, top funds, status distribution, and refresh activity', () => {
    const summary = summarizeIntradayAnalyticsEvents([
      createIntradayAnalyticsEvent({
        eventName: 'watchlist_row_viewed',
        page: 'home',
        fundCode: '000001',
        occurredAt: '2026-04-20T02:30:00.000Z',
      }),
      createIntradayAnalyticsEvent({
        eventName: 'watchlist_row_viewed',
        page: 'home',
        fundCode: '000001',
        occurredAt: '2026-04-20T02:31:00.000Z',
      }),
      createIntradayAnalyticsEvent({
        eventName: 'watchlist_row_viewed',
        page: 'home',
        fundCode: '000002',
        occurredAt: '2026-04-20T02:32:00.000Z',
      }),
      createIntradayAnalyticsEvent({
        eventName: 'watchlist_fund_clicked',
        page: 'home',
        fundCode: '000001',
        occurredAt: '2026-04-20T02:33:00.000Z',
      }),
      createIntradayAnalyticsEvent({
        eventName: 'watchlist_manual_refresh_clicked',
        page: 'home',
        occurredAt: '2026-04-20T02:34:00.000Z',
      }),
      createIntradayAnalyticsEvent({
        eventName: 'watchlist_intraday_state_seen',
        page: 'home',
        fundCode: '000001',
        intradayStatus: 'generating',
        occurredAt: '2026-04-20T02:35:00.000Z',
      }),
      createIntradayAnalyticsEvent({
        eventName: 'fund_detail_viewed',
        page: 'fund_detail',
        fundCode: '000001',
        occurredAt: '2026-04-20T02:36:00.000Z',
      }),
      createIntradayAnalyticsEvent({
        eventName: 'fund_intraday_chart_viewed',
        page: 'fund_detail',
        fundCode: '000001',
        intradayStatus: 'ready',
        occurredAt: '2026-04-20T02:37:00.000Z',
      }),
    ]);

    expect(summary.totalEvents).toBe(8);
    expect(summary.eventCounts).toEqual({
      watchlist_row_viewed: 3,
      watchlist_fund_clicked: 1,
      watchlist_manual_refresh_clicked: 1,
      watchlist_intraday_state_seen: 1,
      fund_detail_viewed: 1,
      fund_intraday_chart_viewed: 1,
    });
    expect(summary.topFunds).toEqual([
      { fundCode: '000001', rowViewCount: 2, detailViewCount: 1, clickCount: 1 },
      { fundCode: '000002', rowViewCount: 1, detailViewCount: 0, clickCount: 0 },
    ]);
    expect(summary.intradayStatusCounts).toEqual({
      generating: 1,
      ready: 1,
    });
    expect(summary.manualRefreshCount).toBe(1);
    expect(summary.detailViewCount).toBe(1);
  });

  it('returns empty summary defaults when there are no events', () => {
    expect(summarizeIntradayAnalyticsEvents([])).toEqual({
      totalEvents: 0,
      eventCounts: {},
      topFunds: [],
      intradayStatusCounts: {},
      manualRefreshCount: 0,
      detailViewCount: 0,
    });
  });
});
