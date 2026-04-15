import {
  deriveTradingDateFromQuoteUpdatedAt,
  mergeEstimateSnapshots,
} from '@/lib/funds/estimate-accuracy';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

export const ESTIMATE_ACCURACY_STORAGE_KEY = 'super-finance-estimate-accuracy';
export const ESTIMATE_ACCURACY_UPDATED_EVENT = 'super-finance-estimate-accuracy-updated';

export const upsertEstimateAccuracySnapshots = (
  existing: EstimateAccuracySnapshot[],
  incoming: EstimateAccuracySnapshot | EstimateAccuracySnapshot[],
): EstimateAccuracySnapshot[] => {
  const snapshots = Array.isArray(incoming) ? incoming : [incoming];
  return snapshots.reduce<EstimateAccuracySnapshot[]>(
    (accumulator, snapshot) => mergeEstimateSnapshots(accumulator, snapshot),
    existing,
  );
};

const LOCAL_QUOTE_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const ABSOLUTE_TIME_FORMAT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const TRADING_DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isNullableNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value));

const isAbsoluteTime = (value: unknown): value is string =>
  typeof value === 'string' &&
  ABSOLUTE_TIME_FORMAT.test(value) &&
  !Number.isNaN(Date.parse(value));

const isValidLocalTime = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const match = value.match(LOCAL_QUOTE_TIME_FORMAT);
  if (!match) {
    return false;
  }

  const [, year, month, day, hour, minute] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const min = Number(minute);

  if (m < 1 || m > 12 || d < 1 || h < 0 || h > 23 || min < 0 || min > 59) {
    return false;
  }

  const utcTimestamp = Date.UTC(y, m - 1, d, h, min, 0, 0);
  const date = new Date(utcTimestamp);

  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d &&
    date.getUTCHours() === h &&
    date.getUTCMinutes() === min
  );
};

const isQuoteUpdatedAt = (value: unknown): value is string => {
  if (isValidLocalTime(value)) {
    return true;
  }

  return isAbsoluteTime(value);
};

const isLocalOrAbsoluteTime = (value: unknown): value is string => {
  if (isValidLocalTime(value)) {
    return true;
  }

  return isAbsoluteTime(value);
};

const isValidTradingDate = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const match = value.match(TRADING_DATE_FORMAT);
  if (!match) {
    return false;
  }

  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1) {
    return false;
  }

  const date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

function isEstimateAccuracySnapshot(value: unknown): value is EstimateAccuracySnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const snapshot = value as Record<string, unknown>;

  const hasRequiredFields =
    isNonEmptyString(snapshot.id) &&
    isNonEmptyString(snapshot.fundCode) &&
    isNonEmptyString(snapshot.fundName) &&
    isQuoteUpdatedAt(snapshot.quoteUpdatedAt) &&
    isValidTradingDate(snapshot.tradingDate) &&
    isLocalOrAbsoluteTime(snapshot.createdAt) &&
    isLocalOrAbsoluteTime(snapshot.updatedAt) &&
    typeof snapshot.estimatedNav === 'number' &&
    Number.isFinite(snapshot.estimatedNav) &&
    isNullableNumber(snapshot.finalNav) &&
    isNullableNumber(snapshot.absoluteErrorRate);

  if (!hasRequiredFields) {
    return false;
  }

  const quoteUpdatedAt = snapshot.quoteUpdatedAt;
  const tradingDate = snapshot.tradingDate;
  if (
    typeof quoteUpdatedAt !== 'string' ||
    typeof tradingDate !== 'string' ||
    deriveTradingDateFromQuoteUpdatedAt(quoteUpdatedAt) !== tradingDate
  ) {
    return false;
  }

  if (snapshot.resolvedAt !== null && !isLocalOrAbsoluteTime(snapshot.resolvedAt)) {
    return false;
  }

  if (snapshot.resolvedAt !== null) {
    return snapshot.finalNav !== null;
  }

  if (snapshot.absoluteErrorRate !== null) {
    return snapshot.finalNav !== null && isLocalOrAbsoluteTime(snapshot.resolvedAt);
  }

  if (snapshot.finalNav !== null) {
    return isLocalOrAbsoluteTime(snapshot.resolvedAt);
  }

  return true;
}

export function loadEstimateAccuracySnapshots(): EstimateAccuracySnapshot[] {
  if (typeof window === 'undefined') {
    return [];
  }

  let rawValue: string | null = null;
  try {
    rawValue = window.localStorage.getItem(ESTIMATE_ACCURACY_STORAGE_KEY);
  } catch {
    return [];
  }

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isEstimateAccuracySnapshot);
  } catch {
    return [];
  }
}

export function saveEstimateAccuracySnapshots(
  snapshots: EstimateAccuracySnapshot[],
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      ESTIMATE_ACCURACY_STORAGE_KEY,
      JSON.stringify(snapshots),
    );
    window.dispatchEvent(new CustomEvent(ESTIMATE_ACCURACY_UPDATED_EVENT));
  } catch {
    // Ignore localStorage write failures (quota/privacy modes)
  }
}
