import type {
  EstimateIntradayPoint,
  EstimateIntradaySummary,
  EstimateIntradayTrend,
  FundQuote,
} from '@/lib/funds/types';

const MINUTE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
const FLAT_THRESHOLD_RATE = 0.001;
const VOLATILE_AMPLITUDE_RATE = 0.01;

const round = (value: number, digits = 6): number => Number(value.toFixed(digits));

export function deriveIntradayTradingDate(updatedAt: string): string {
  return updatedAt.slice(0, 10);
}

export function deriveIntradayMinuteKey(updatedAt: string): string {
  const normalized = updatedAt.replace('T', ' ');
  return normalized.slice(0, 16);
}

export function buildEstimateIntradayPoint(
  quote: FundQuote,
  capturedAt: string,
): EstimateIntradayPoint | null {
  if (
    !quote.code ||
    !quote.name ||
    typeof quote.estimatedNav !== 'number' ||
    !Number.isFinite(quote.estimatedNav) ||
    typeof quote.changeRate !== 'number' ||
    !Number.isFinite(quote.changeRate) ||
    !MINUTE_KEY_PATTERN.test(quote.updatedAt)
  ) {
    return null;
  }

  return {
    fundCode: quote.code,
    fundName: quote.name,
    tradingDate: deriveIntradayTradingDate(quote.updatedAt),
    minuteKey: deriveIntradayMinuteKey(quote.updatedAt),
    estimatedNav: quote.estimatedNav,
    changeRate: quote.changeRate,
    updatedAt: quote.updatedAt,
    capturedAt,
  };
}

export function isEstimateIntradayPoint(value: unknown): value is EstimateIntradayPoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.fundCode === 'string' &&
    typeof item.fundName === 'string' &&
    typeof item.tradingDate === 'string' &&
    typeof item.minuteKey === 'string' &&
    typeof item.estimatedNav === 'number' &&
    Number.isFinite(item.estimatedNav) &&
    typeof item.changeRate === 'number' &&
    Number.isFinite(item.changeRate) &&
    typeof item.updatedAt === 'string' &&
    typeof item.capturedAt === 'string'
  );
}

export function sortIntradayPoints(points: EstimateIntradayPoint[]): EstimateIntradayPoint[] {
  return [...points].sort((left, right) => left.minuteKey.localeCompare(right.minuteKey));
}

export function filterIntradayPointsForTradingDate(
  points: EstimateIntradayPoint[],
  tradingDate: string,
): EstimateIntradayPoint[] {
  return sortIntradayPoints(points.filter((point) => point.tradingDate === tradingDate));
}

export function classifyIntradayTrend(points: EstimateIntradayPoint[]): EstimateIntradayTrend {
  if (points.length < 2) {
    return 'unknown';
  }

  const sorted = sortIntradayPoints(points);
  const first = sorted[0].estimatedNav;
  const latest = sorted.at(-1)?.estimatedNav ?? first;
  const high = Math.max(...sorted.map((point) => point.estimatedNav));
  const low = Math.min(...sorted.map((point) => point.estimatedNav));
  const base = Math.abs(first) > 0 ? Math.abs(first) : 1;
  const directionRate = (latest - first) / base;
  const amplitudeRate = (high - low) / base;

  if (Math.abs(directionRate) <= FLAT_THRESHOLD_RATE) {
    return amplitudeRate >= VOLATILE_AMPLITUDE_RATE ? 'volatile' : 'flat';
  }

  if (amplitudeRate >= VOLATILE_AMPLITUDE_RATE && Math.abs(directionRate) < amplitudeRate * 0.35) {
    return 'volatile';
  }

  return directionRate > 0 ? 'up' : 'down';
}

export function buildIntradaySummary(points: EstimateIntradayPoint[]): EstimateIntradaySummary {
  const sorted = sortIntradayPoints(points);

  if (sorted.length === 0) {
    return {
      pointCount: 0,
      firstEstimatedNav: null,
      latestEstimatedNav: null,
      highEstimatedNav: null,
      lowEstimatedNav: null,
      changeFromFirst: null,
      changeRateFromFirst: null,
      latestChangeRate: null,
      latestUpdatedAt: null,
      trend: 'unknown',
    };
  }

  const first = sorted[0];
  const latest = sorted.at(-1) ?? first;
  const values = sorted.map((point) => point.estimatedNav);
  const changeFromFirst = latest.estimatedNav - first.estimatedNav;

  return {
    pointCount: sorted.length,
    firstEstimatedNav: first.estimatedNav,
    latestEstimatedNav: latest.estimatedNav,
    highEstimatedNav: Math.max(...values),
    lowEstimatedNav: Math.min(...values),
    changeFromFirst: round(changeFromFirst),
    changeRateFromFirst:
      first.estimatedNav === 0 ? null : round((changeFromFirst / first.estimatedNav) * 100, 4),
    latestChangeRate: latest.changeRate,
    latestUpdatedAt: latest.updatedAt,
    trend: classifyIntradayTrend(sorted),
  };
}

export function normalizeIntradayChartPoints(
  points: EstimateIntradayPoint[],
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  const sorted = sortIntradayPoints(points);

  if (sorted.length === 0) {
    return [];
  }

  if (sorted.length === 1) {
    return [{ x: width / 2, y: height / 2 }];
  }

  const values = sorted.map((point) => point.estimatedNav);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  return sorted.map((point, index) => ({
    x: round((index / (sorted.length - 1)) * width, 3),
    y: range === 0 ? height / 2 : round(height - ((point.estimatedNav - min) / range) * height, 3),
  }));
}

export function buildSvgPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}
