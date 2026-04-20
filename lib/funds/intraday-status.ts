import {
  deriveTradingDateFromQuoteUpdatedAt,
  getCurrentChinaMarketTradingDate,
  isSupportedQuoteUpdatedAt,
} from '@/lib/funds/estimate-accuracy';
import { filterIntradayPointsForTradingDate, sortIntradayPoints } from '@/lib/funds/estimate-intraday';
import type {
  EstimateConfidenceLevel,
  EstimateIntradayDataStatus,
  EstimateIntradaySignalTone,
  EstimateIntradayTrustSignal,
  EstimateIntradayTrustSignalInput,
} from '@/lib/funds/types';

const EXPECTED_INTRADAY_POINT_COUNT = 240;
const READY_POINT_COUNT_THRESHOLD = 10;

const CHINA_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
});

const LOCAL_TIME_FORMAT = /^\d{4}-\d{2}-\d{2} (\d{2}:\d{2})$/;

const round = (value: number, digits = 4): number => Number(value.toFixed(digits));

const confidenceTextMap: Record<EstimateConfidenceLevel, string> = {
  high: '置信度高',
  medium: '置信度中',
  low: '置信度低',
  unknown: '置信度待判定',
};

const statusToneMap: Record<EstimateIntradayDataStatus, EstimateIntradaySignalTone> = {
  ready: 'info',
  generating: 'warning',
  stale: 'warning',
  empty: 'muted',
  unsupported: 'muted',
};

const statusBaseLabelMap: Record<EstimateIntradayDataStatus, string> = {
  ready: '已更新',
  generating: '分时生成中',
  stale: '今日待更新',
  empty: '今日暂无分时',
  unsupported: '暂不支持',
};

const inferConfidenceLevel = (
  status: EstimateIntradayDataStatus,
  historicalConfidenceLevel: EstimateConfidenceLevel,
  pointCount: number,
): EstimateConfidenceLevel => {
  if (status === 'unsupported' || status === 'empty') {
    return 'unknown';
  }

  if (status === 'stale' || status === 'generating') {
    return 'low';
  }

  if (pointCount < READY_POINT_COUNT_THRESHOLD) {
    return 'low';
  }

  if (historicalConfidenceLevel === 'high') {
    return 'high';
  }

  if (historicalConfidenceLevel === 'medium') {
    return 'medium';
  }

  if (historicalConfidenceLevel === 'low') {
    return 'low';
  }

  return 'unknown';
};

export function formatIntradayLastUpdatedLabel(updatedAt: string | null): string {
  if (!updatedAt) {
    return '暂无更新';
  }

  const localMatch = updatedAt.match(LOCAL_TIME_FORMAT);
  if (localMatch) {
    return `${localMatch[1]} 更新`;
  }

  const parsed = Date.parse(updatedAt);
  if (Number.isNaN(parsed)) {
    return '暂无更新';
  }

  return `${CHINA_TIME_FORMATTER.format(new Date(parsed))} 更新`;
}

export function buildIntradayTrustSignal(
  input: EstimateIntradayTrustSignalInput,
): EstimateIntradayTrustSignal {
  const historicalConfidenceLevel = input.historicalConfidenceLevel ?? 'unknown';
  const latestPoint = sortIntradayPoints(input.points).at(-1) ?? null;
  const currentTradingDatePoints = filterIntradayPointsForTradingDate(
    input.points,
    input.currentTradingDate,
  );
  const currentPointCount = currentTradingDatePoints.length;
  const coverageRatio = round(currentPointCount / EXPECTED_INTRADAY_POINT_COUNT);
  const coverageText = `${currentPointCount}/${EXPECTED_INTRADAY_POINT_COUNT}`;
  const lastUpdatedAt = currentTradingDatePoints.at(-1)?.updatedAt ?? latestPoint?.updatedAt ?? input.quoteUpdatedAt;

  let status: EstimateIntradayDataStatus;

  if (input.quoteUpdatedAt && !isSupportedQuoteUpdatedAt(input.quoteUpdatedAt)) {
    status = 'unsupported';
  } else {
    const latestTradingDate = latestPoint?.tradingDate ??
      (input.quoteUpdatedAt ? deriveTradingDateFromQuoteUpdatedAt(input.quoteUpdatedAt) : null);

    if (latestTradingDate && latestTradingDate < input.currentTradingDate) {
      status = 'stale';
    } else if (currentPointCount === 0) {
      status = 'empty';
    } else if (currentPointCount < READY_POINT_COUNT_THRESHOLD) {
      status = 'generating';
    } else {
      status = 'ready';
    }
  }

  const confidenceLevel = inferConfidenceLevel(status, historicalConfidenceLevel, currentPointCount);
  const lastUpdatedLabel = formatIntradayLastUpdatedLabel(lastUpdatedAt);

  return {
    status,
    statusLabel: status === 'ready' && lastUpdatedAt ? lastUpdatedLabel : statusBaseLabelMap[status],
    statusTone: statusToneMap[status],
    lastUpdatedAt,
    lastUpdatedLabel,
    coverageRatio,
    coverageText,
    pointCount: currentPointCount,
    expectedPointCount: EXPECTED_INTRADAY_POINT_COUNT,
    confidenceLevel,
    confidenceText: confidenceTextMap[confidenceLevel],
  };
}

export function resolveIntradaySignalTradingDate(input: {
  quoteUpdatedAt: string | null;
  points: Array<{ tradingDate: string }>;
}): string {
  const candidates: string[] = [];

  if (input.quoteUpdatedAt && isSupportedQuoteUpdatedAt(input.quoteUpdatedAt)) {
    candidates.push(deriveTradingDateFromQuoteUpdatedAt(input.quoteUpdatedAt));
  }

  for (const point of input.points) {
    if (point.tradingDate) {
      candidates.push(point.tradingDate);
    }
  }

  return candidates.sort().at(-1) ?? getCurrentChinaMarketTradingDate();
}
