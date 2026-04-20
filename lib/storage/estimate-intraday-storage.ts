import { isEstimateIntradayPoint, sortIntradayPoints } from '@/lib/funds/estimate-intraday';
import type { EstimateIntradayPoint } from '@/lib/funds/types';

export const ESTIMATE_INTRADAY_STORAGE_KEY = 'super-finance-estimate-intraday';
export const ESTIMATE_INTRADAY_UPDATED_EVENT = 'super-finance-estimate-intraday-updated';
export const DEFAULT_INTRADAY_POINTS_LIMIT = 300;

export type EstimateIntradayPointMap = Record<string, EstimateIntradayPoint[]>;

const dispatchUpdatedEvent = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(ESTIMATE_INTRADAY_UPDATED_EVENT));
};

const normalizePointMap = (value: unknown): EstimateIntradayPointMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<EstimateIntradayPointMap>(
    (result, [fundCode, maybePoints]) => {
      if (!Array.isArray(maybePoints)) {
        return result;
      }

      const points = maybePoints.filter(isEstimateIntradayPoint);
      if (points.length > 0) {
        result[fundCode] = sortIntradayPoints(points);
      }
      return result;
    },
    {},
  );
};

export function loadEstimateIntradayPoints(): EstimateIntradayPointMap {
  if (typeof window === 'undefined') {
    return {};
  }

  const rawValue = window.localStorage.getItem(ESTIMATE_INTRADAY_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    return normalizePointMap(JSON.parse(rawValue));
  } catch {
    return {};
  }
}

export function saveEstimateIntradayPoints(pointsByFund: EstimateIntradayPointMap): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    ESTIMATE_INTRADAY_STORAGE_KEY,
    JSON.stringify(normalizePointMap(pointsByFund)),
  );
  dispatchUpdatedEvent();
}

export function upsertEstimateIntradayPoints(
  existing: EstimateIntradayPointMap,
  incomingPoints: EstimateIntradayPoint[],
  currentTradingDate: string,
  perFundLimit = DEFAULT_INTRADAY_POINTS_LIMIT,
): EstimateIntradayPointMap {
  const next: EstimateIntradayPointMap = {};

  for (const [fundCode, points] of Object.entries(existing)) {
    const currentDatePoints = points.filter((point) => point.tradingDate === currentTradingDate);
    if (currentDatePoints.length > 0) {
      next[fundCode] = currentDatePoints;
    }
  }

  for (const point of incomingPoints.filter((item) => item.tradingDate === currentTradingDate)) {
    const points = next[point.fundCode] ?? [];
    const byMinute = new Map(points.map((item) => [item.minuteKey, item] as const));
    byMinute.set(point.minuteKey, point);
    next[point.fundCode] = sortIntradayPoints([...byMinute.values()]).slice(-perFundLimit);
  }

  return next;
}

export function saveEstimateIntradayQuotePoints(
  incomingPoints: EstimateIntradayPoint[],
  currentTradingDate: string,
): void {
  if (incomingPoints.length === 0) {
    return;
  }

  const existing = loadEstimateIntradayPoints();
  saveEstimateIntradayPoints(
    upsertEstimateIntradayPoints(existing, incomingPoints, currentTradingDate),
  );
}
