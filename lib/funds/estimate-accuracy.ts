import type {
  EstimateAccuracySnapshot,
  EstimateAccuracySummary,
  EstimateConfidenceLevel,
} from '@/lib/funds/types';

interface BuildEstimateSnapshotInput {
  code: string;
  name: string;
  estimatedNav: number;
  quoteUpdatedAt: string;
}

const LOCAL_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const ABSOLUTE_TIME_FORMAT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const CHINA_MARKET_TIMEZONE_OFFSET_HOURS = 8;
const TRADING_DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const HIGH_ERROR_RATE_THRESHOLD = 0.01;

const isValidLocalDateTime = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) => {
  if (month < 1 || month > 12 || day < 1 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
};

const parseKnownTimestamp = (value: string): number | null => {
  const localMatch = value.match(LOCAL_TIME_FORMAT);
  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const h = Number(hour);
    const min = Number(minute);

    if (!isValidLocalDateTime(y, m, d, h, min)) {
      return null;
    }

    return Date.UTC(
      y,
      m - 1,
      d,
      h - CHINA_MARKET_TIMEZONE_OFFSET_HOURS,
      min,
      0,
      0,
    );
  }

  if (ABSOLUTE_TIME_FORMAT.test(value)) {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  return null;
};

const formatChinaMarketDate = (timestamp: number): string => {
  const chinaTimestamp = timestamp + CHINA_MARKET_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(chinaTimestamp).toISOString().slice(0, 10);
};

const parseTradingDateTimestamp = (tradingDate: string): number | null => {
  const match = tradingDate.match(TRADING_DATE_FORMAT);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  if (!isValidLocalDateTime(y, m, d, 0, 0)) {
    return null;
  }

  return Date.UTC(y, m - 1, d, 0, 0, 0, 0);
};

export const isSupportedQuoteUpdatedAt = (quoteUpdatedAt: string): boolean =>
  parseKnownTimestamp(quoteUpdatedAt) !== null;

export const isValidTradingDate = (tradingDate: string): boolean =>
  parseTradingDateTimestamp(tradingDate) !== null;

const pickLatestTimestamp = (
  current: string | null,
  candidate: string,
  label: string,
): string | null => {
  if (!current) {
    return candidate;
  }

  const currentParsed = parseKnownTimestamp(current);
  const candidateParsed = parseKnownTimestamp(candidate);
  if (currentParsed === null || candidateParsed === null) {
    throw new Error(`Unsupported ${label} time format`);
  }

  return candidateParsed > currentParsed ? candidate : current;
};

export const deriveTradingDateFromQuoteUpdatedAt = (quoteUpdatedAt: string): string => {
  const localMatch = quoteUpdatedAt.match(LOCAL_TIME_FORMAT);
  if (localMatch) {
    const [, year, month, day] = localMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = parseKnownTimestamp(quoteUpdatedAt);
  if (parsed !== null) {
    return formatChinaMarketDate(parsed);
  }

  return quoteUpdatedAt;
};

export const getCurrentChinaMarketTradingDate = (now: number = Date.now()): string =>
  formatChinaMarketDate(now);

export const isTradingDateBefore = (
  targetTradingDate: string,
  currentTradingDate: string,
): boolean => {
  const targetTimestamp = parseTradingDateTimestamp(targetTradingDate);
  const currentTimestamp = parseTradingDateTimestamp(currentTradingDate);
  if (targetTimestamp === null || currentTimestamp === null) {
    return false;
  }

  return targetTimestamp < currentTimestamp;
};

export const buildEstimateSnapshot = (
  input: BuildEstimateSnapshotInput,
  now?: string,
): EstimateAccuracySnapshot => {
  const timestamp = now ?? input.quoteUpdatedAt;

  return {
    id: `${input.code}::${input.quoteUpdatedAt}`,
    fundCode: input.code,
    fundName: input.name,
    quoteUpdatedAt: input.quoteUpdatedAt,
    tradingDate: deriveTradingDateFromQuoteUpdatedAt(input.quoteUpdatedAt),
    estimatedNav: input.estimatedNav,
    finalNav: null,
    absoluteErrorRate: null,
    resolvedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const mergeEstimateSnapshots = (
  existing: EstimateAccuracySnapshot[],
  incoming: EstimateAccuracySnapshot,
): EstimateAccuracySnapshot[] => {
  const byId = new Map<string, EstimateAccuracySnapshot>();

  for (const snapshot of existing) {
    byId.set(snapshot.id, snapshot);
  }

  const current = byId.get(incoming.id);
  if (!current) {
    byId.set(incoming.id, incoming);
    return Array.from(byId.values());
  }

  const pickMostRecentSnapshot = (
    currentSnapshot: EstimateAccuracySnapshot,
    incomingSnapshot: EstimateAccuracySnapshot,
  ): EstimateAccuracySnapshot => {
    const currentTimestamp = parseKnownTimestamp(currentSnapshot.updatedAt);
    const incomingTimestamp = parseKnownTimestamp(incomingSnapshot.updatedAt);

    if (currentTimestamp === null || incomingTimestamp === null) {
      return incomingSnapshot;
    }

    return incomingTimestamp > currentTimestamp ? incomingSnapshot : currentSnapshot;
  };

  const currentIsResolved = current.finalNav !== null && current.resolvedAt !== null;
  const incomingIsResolved = incoming.finalNav !== null && incoming.resolvedAt !== null;
  const incomingIsUnresolved = incoming.finalNav === null && incoming.resolvedAt === null;

  if (currentIsResolved && incomingIsUnresolved) {
    byId.set(incoming.id, current);
  } else if (currentIsResolved && incomingIsResolved) {
    byId.set(incoming.id, pickMostRecentSnapshot(current, incoming));
  } else if (!currentIsResolved && !incomingIsResolved) {
    byId.set(incoming.id, pickMostRecentSnapshot(current, incoming));
  } else {
    byId.set(incoming.id, incoming);
  }

  return Array.from(byId.values());
};

export const reconcileEstimateSnapshot = (
  snapshot: EstimateAccuracySnapshot,
  finalNav: number,
  now?: string,
): EstimateAccuracySnapshot => {
  const timestamp = now ?? snapshot.updatedAt;
  const absoluteErrorRate =
    finalNav <= 0 ? null : Math.abs(snapshot.estimatedNav - finalNav) / finalNav;

  return {
    ...snapshot,
    finalNav,
    absoluteErrorRate,
    resolvedAt: timestamp,
    updatedAt: timestamp,
  };
};

export const summarizeEstimateAccuracy = (
  snapshots: EstimateAccuracySnapshot[],
): EstimateAccuracySummary => {
  const fundCodes = new Set(snapshots.map((snapshot) => snapshot.fundCode));
  if (fundCodes.size > 1) {
    throw new Error('summarizeEstimateAccuracy requires a single fundCode');
  }

  const resolved = snapshots.filter(
    (snapshot) =>
      snapshot.finalNav !== null &&
      snapshot.absoluteErrorRate !== null &&
      snapshot.resolvedAt !== null,
  );

  const totalAbsoluteErrorRate = resolved.reduce(
    (sum, snapshot) => sum + (snapshot.absoluteErrorRate ?? 0),
    0,
  );
  const resolvedTradingDayCount = new Set(resolved.map((snapshot) => snapshot.tradingDate)).size;
  const highErrorResolvedSampleCount = resolved.filter(
    (snapshot) => (snapshot.absoluteErrorRate ?? 0) > HIGH_ERROR_RATE_THRESHOLD,
  ).length;

  const latestQuoteUpdatedAt = snapshots.reduce<string | null>((latest, snapshot) => {
    return pickLatestTimestamp(latest, snapshot.quoteUpdatedAt, 'quoteUpdatedAt');
  }, null);

  const latestResolvedAt = resolved.reduce<string | null>((latest, snapshot) => {
    const resolvedAt = snapshot.resolvedAt;
    if (!resolvedAt) {
      return latest;
    }

    return pickLatestTimestamp(latest, resolvedAt, 'resolvedAt');
  }, null);

  return {
    fundCode: snapshots[0]?.fundCode ?? '',
    sampleCount: snapshots.length,
    resolvedSampleCount: resolved.length,
    resolvedTradingDayCount,
    highErrorResolvedSampleCount,
    averageAbsoluteErrorRate:
      resolved.length > 0 ? totalAbsoluteErrorRate / resolved.length : null,
    latestQuoteUpdatedAt,
    latestResolvedAt,
  };
};

export const gradeEstimateConfidence = (
  summary: EstimateAccuracySummary,
): EstimateConfidenceLevel => {
  if (summary.resolvedSampleCount === 0 || summary.averageAbsoluteErrorRate === null) {
    return 'unknown';
  }

  const highErrorShare =
    summary.resolvedSampleCount > 0
      ? summary.highErrorResolvedSampleCount / summary.resolvedSampleCount
      : 1;

  let windowLevel: EstimateConfidenceLevel = 'low';
  if (summary.resolvedTradingDayCount >= 6) {
    windowLevel = 'high';
  } else if (summary.resolvedTradingDayCount >= 3) {
    windowLevel = 'medium';
  }

  let sampleLevel: EstimateConfidenceLevel = 'low';
  if (summary.resolvedSampleCount >= 6) {
    sampleLevel = 'high';
  } else if (summary.resolvedSampleCount >= 3) {
    sampleLevel = 'medium';
  }

  let distributionLevel: EstimateConfidenceLevel = 'low';
  if (highErrorShare === 0) {
    distributionLevel = 'high';
  } else if (highErrorShare <= 0.2) {
    distributionLevel = 'medium';
  }

  const rank: Record<EstimateConfidenceLevel, number> = {
    unknown: 0,
    low: 1,
    medium: 2,
    high: 3,
  };
  const weakestLevel = [windowLevel, sampleLevel, distributionLevel].reduce<EstimateConfidenceLevel>(
    (current, candidate) => (rank[candidate] < rank[current] ? candidate : current),
    'high',
  );

  if (summary.averageAbsoluteErrorRate <= 0.003 && weakestLevel === 'high') {
    return 'high';
  }

  if (summary.averageAbsoluteErrorRate <= 0.01 && rank[weakestLevel] >= rank.medium) {
    return 'medium';
  }

  return 'low';
};
