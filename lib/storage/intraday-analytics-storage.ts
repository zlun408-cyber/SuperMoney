import {
  isIntradayAnalyticsEvent,
  type IntradayAnalyticsEvent,
} from '@/lib/analytics/intraday-analytics';

export const INTRADAY_ANALYTICS_STORAGE_KEY = 'super-finance-intraday-analytics';
export const INTRADAY_ANALYTICS_UPDATED_EVENT = 'super-finance-intraday-analytics-updated';
export const DEFAULT_INTRADAY_ANALYTICS_LIMIT = 500;

const dispatchUpdatedEvent = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(INTRADAY_ANALYTICS_UPDATED_EVENT));
};

export function loadIntradayAnalyticsEvents(): IntradayAnalyticsEvent[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawValue = window.localStorage.getItem(INTRADAY_ANALYTICS_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isIntradayAnalyticsEvent);
  } catch {
    return [];
  }
}

export function appendIntradayAnalyticsEvent(
  event: IntradayAnalyticsEvent,
  limit = DEFAULT_INTRADAY_ANALYTICS_LIMIT,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const nextEvents = [...loadIntradayAnalyticsEvents(), event].slice(-limit);
  window.localStorage.setItem(INTRADAY_ANALYTICS_STORAGE_KEY, JSON.stringify(nextEvents));
  dispatchUpdatedEvent();
}

export function clearIntradayAnalyticsEvents(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(INTRADAY_ANALYTICS_STORAGE_KEY, '[]');
  dispatchUpdatedEvent();
}
