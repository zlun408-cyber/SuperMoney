export type IntradayAnalyticsEventName =
  | 'watchlist_row_viewed'
  | 'watchlist_intraday_visible'
  | 'watchlist_fund_clicked'
  | 'watchlist_manual_refresh_clicked'
  | 'watchlist_intraday_state_seen'
  | 'fund_detail_viewed'
  | 'fund_intraday_chart_viewed'
  | 'fund_intraday_state_seen';

export type IntradayAnalyticsPage = 'home' | 'fund_detail';

export type IntradayAnalyticsStatus =
  | 'ready'
  | 'generating'
  | 'stale'
  | 'empty'
  | 'unsupported';

export type IntradayAnalyticsConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface IntradayAnalyticsEvent {
  id: string;
  eventName: IntradayAnalyticsEventName;
  page: IntradayAnalyticsPage;
  occurredAt: string;
  fundCode: string | null;
  tradingDate: string | null;
  intradayStatus: IntradayAnalyticsStatus | null;
  confidenceLevel: IntradayAnalyticsConfidenceLevel | null;
  coverageRatio: number | null;
  meta: Record<string, string | number | boolean | null> | null;
}

export interface IntradayAnalyticsSummary {
  totalEvents: number;
  eventCounts: Partial<Record<IntradayAnalyticsEventName, number>>;
  topFunds: Array<{
    fundCode: string;
    rowViewCount: number;
    detailViewCount: number;
    clickCount: number;
  }>;
  intradayStatusCounts: Partial<Record<IntradayAnalyticsStatus, number>>;
  manualRefreshCount: number;
  detailViewCount: number;
}

export interface CreateIntradayAnalyticsEventInput {
  eventName: IntradayAnalyticsEventName;
  page: IntradayAnalyticsPage;
  occurredAt?: string;
  fundCode?: string | null;
  tradingDate?: string | null;
  intradayStatus?: IntradayAnalyticsStatus | null;
  confidenceLevel?: IntradayAnalyticsConfidenceLevel | null;
  coverageRatio?: number | null;
  meta?: Record<string, string | number | boolean | null> | null;
}

const EVENT_NAMES: IntradayAnalyticsEventName[] = [
  'watchlist_row_viewed',
  'watchlist_intraday_visible',
  'watchlist_fund_clicked',
  'watchlist_manual_refresh_clicked',
  'watchlist_intraday_state_seen',
  'fund_detail_viewed',
  'fund_intraday_chart_viewed',
  'fund_intraday_state_seen',
];

const PAGES: IntradayAnalyticsPage[] = ['home', 'fund_detail'];

const normalizeOptionalString = (value?: string | null): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const normalizeOptionalNumber = (value?: number | null): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function createIntradayAnalyticsEvent(
  input: CreateIntradayAnalyticsEventInput,
): IntradayAnalyticsEvent {
  return {
    id: crypto.randomUUID(),
    eventName: input.eventName,
    page: input.page,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    fundCode: normalizeOptionalString(input.fundCode),
    tradingDate: normalizeOptionalString(input.tradingDate),
    intradayStatus: input.intradayStatus ?? null,
    confidenceLevel: input.confidenceLevel ?? null,
    coverageRatio: normalizeOptionalNumber(input.coverageRatio),
    meta: input.meta ?? null,
  };
}

export function summarizeIntradayAnalyticsEvents(
  events: IntradayAnalyticsEvent[],
): IntradayAnalyticsSummary {
  const eventCounts: Partial<Record<IntradayAnalyticsEventName, number>> = {};
  const intradayStatusCounts: Partial<Record<IntradayAnalyticsStatus, number>> = {};
  const fundStats = new Map<
    string,
    {
      fundCode: string;
      rowViewCount: number;
      detailViewCount: number;
      clickCount: number;
    }
  >();

  for (const event of events) {
    eventCounts[event.eventName] = (eventCounts[event.eventName] ?? 0) + 1;

    if (event.intradayStatus) {
      intradayStatusCounts[event.intradayStatus] =
        (intradayStatusCounts[event.intradayStatus] ?? 0) + 1;
    }

    if (!event.fundCode) {
      continue;
    }

    const current = fundStats.get(event.fundCode) ?? {
      fundCode: event.fundCode,
      rowViewCount: 0,
      detailViewCount: 0,
      clickCount: 0,
    };

    if (event.eventName === 'watchlist_row_viewed') {
      current.rowViewCount += 1;
    }

    if (event.eventName === 'fund_detail_viewed') {
      current.detailViewCount += 1;
    }

    if (event.eventName === 'watchlist_fund_clicked') {
      current.clickCount += 1;
    }

    fundStats.set(event.fundCode, current);
  }

  return {
    totalEvents: events.length,
    eventCounts,
    topFunds: Array.from(fundStats.values()).sort((left, right) => {
      if (right.rowViewCount !== left.rowViewCount) {
        return right.rowViewCount - left.rowViewCount;
      }

      if (right.detailViewCount !== left.detailViewCount) {
        return right.detailViewCount - left.detailViewCount;
      }

      if (right.clickCount !== left.clickCount) {
        return right.clickCount - left.clickCount;
      }

      return left.fundCode.localeCompare(right.fundCode);
    }),
    intradayStatusCounts,
    manualRefreshCount: eventCounts.watchlist_manual_refresh_clicked ?? 0,
    detailViewCount: eventCounts.fund_detail_viewed ?? 0,
  };
}

export function isIntradayAnalyticsEvent(value: unknown): value is IntradayAnalyticsEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.id === 'string' &&
    EVENT_NAMES.includes(event.eventName as IntradayAnalyticsEventName) &&
    PAGES.includes(event.page as IntradayAnalyticsPage) &&
    typeof event.occurredAt === 'string' &&
    (event.fundCode === null || typeof event.fundCode === 'string') &&
    (event.tradingDate === null || typeof event.tradingDate === 'string') &&
    (event.intradayStatus === null || typeof event.intradayStatus === 'string') &&
    (event.confidenceLevel === null || typeof event.confidenceLevel === 'string') &&
    (event.coverageRatio === null ||
      (typeof event.coverageRatio === 'number' && Number.isFinite(event.coverageRatio))) &&
    (event.meta === null || (typeof event.meta === 'object' && !Array.isArray(event.meta)))
  );
}
