import type { EstimateAccuracyDiagnosticItem } from '@/lib/funds/estimate-accuracy-diagnostics';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

interface ComputableSnapshot {
  snapshot: EstimateAccuracySnapshot;
}

export interface EstimateAccuracyTimeBucketItem {
  label: string;
  sampleCount: number;
  averageAbsoluteErrorRate: number | null;
}

export interface EstimateAccuracyDailyTrendItem {
  tradingDate: string;
  sampleCount: number;
  impactedFundCount: number;
  averageAbsoluteErrorRate: number | null;
}

export interface EstimateAccuracyRecommendationItem {
  fundCode: string;
  fundName: string;
  title: string;
  description: string;
}

const TIME_BUCKETS = [
  {
    label: '盘前 / 上午',
    includes: (hour: number) => hour < 12,
  },
  {
    label: '午后',
    includes: (hour: number) => hour >= 12 && hour < 14,
  },
  {
    label: '尾盘',
    includes: (hour: number) => hour >= 14 && hour < 15,
  },
  {
    label: '收盘后',
    includes: (hour: number) => hour >= 15,
  },
] as const;

const LOCAL_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

const toComputableSnapshot = (
  snapshot: EstimateAccuracySnapshot,
): ComputableSnapshot | null => {
  if (
    snapshot.finalNav === null ||
    snapshot.finalNav <= 0 ||
    snapshot.resolvedAt === null ||
    snapshot.absoluteErrorRate === null
  ) {
    return null;
  }

  return { snapshot };
};

const getChinaMarketHour = (quoteUpdatedAt: string): number | null => {
  const localMatch = quoteUpdatedAt.match(LOCAL_TIME_FORMAT);
  if (localMatch) {
    return Number(localMatch[4]);
  }

  const timestamp = Date.parse(quoteUpdatedAt);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const chinaTimestamp = timestamp + 8 * 60 * 60 * 1000;
  return new Date(chinaTimestamp).getUTCHours();
};

export const summarizeEstimateAccuracyTimeBuckets = (
  snapshots: EstimateAccuracySnapshot[],
): EstimateAccuracyTimeBucketItem[] => {
  const computableSnapshots = snapshots
    .map(toComputableSnapshot)
    .filter((item): item is ComputableSnapshot => item !== null);

  return TIME_BUCKETS.map((bucket) => {
    const bucketSnapshots = computableSnapshots.filter((item) => {
      const hour = getChinaMarketHour(item.snapshot.quoteUpdatedAt);
      return hour !== null && bucket.includes(hour);
    });

    const totalAbsoluteErrorRate = bucketSnapshots.reduce(
      (sum, item) => sum + (item.snapshot.absoluteErrorRate ?? 0),
      0,
    );

    return {
      label: bucket.label,
      sampleCount: bucketSnapshots.length,
      averageAbsoluteErrorRate:
        bucketSnapshots.length > 0
          ? totalAbsoluteErrorRate / bucketSnapshots.length
          : null,
    };
  });
};

export const summarizeEstimateAccuracyDailyTrend = (
  snapshots: EstimateAccuracySnapshot[],
  limit = 5,
): EstimateAccuracyDailyTrendItem[] => {
  const grouped = new Map<string, ComputableSnapshot[]>();

  for (const snapshot of snapshots) {
    const computableSnapshot = toComputableSnapshot(snapshot);
    if (!computableSnapshot) {
      continue;
    }

    const current = grouped.get(snapshot.tradingDate) ?? [];
    current.push(computableSnapshot);
    grouped.set(snapshot.tradingDate, current);
  }

  return Array.from(grouped.entries())
    .map(([tradingDate, items]) => {
      const totalAbsoluteErrorRate = items.reduce(
        (sum, item) => sum + (item.snapshot.absoluteErrorRate ?? 0),
        0,
      );

      return {
        tradingDate,
        sampleCount: items.length,
        impactedFundCount: new Set(items.map((item) => item.snapshot.fundCode)).size,
        averageAbsoluteErrorRate: items.length > 0 ? totalAbsoluteErrorRate / items.length : null,
      };
    })
    .sort((left, right) => right.tradingDate.localeCompare(left.tradingDate))
    .slice(0, limit);
};

export const buildEstimateAccuracyRecommendations = (
  diagnostics: EstimateAccuracyDiagnosticItem[],
  limit = 3,
): EstimateAccuracyRecommendationItem[] =>
  diagnostics.slice(0, limit).map((item) => {
    if (item.diagnosis === '持续偏高') {
      return {
        fundCode: item.fundCode,
        fundName: item.fundName,
        title: '优先校正高估偏差',
        description: '优先检查指数映射、重仓股权重估算与盘中替代源是否系统性偏高。',
      };
    }

    if (item.diagnosis === '持续偏低') {
      return {
        fundCode: item.fundCode,
        fundName: item.fundName,
        title: '优先校正低估偏差',
        description: '优先检查现金仓位、债券仓位或低波资产是否被低估或遗漏。',
      };
    }

    if (item.diagnosis === '波动偏差') {
      return {
        fundCode: item.fundCode,
        fundName: item.fundName,
        title: '优先稳定波动型偏差',
        description: '优先检查盘中刷新频率、异常值过滤和持仓变动同步是否存在抖动。',
      };
    }

    return {
      fundCode: item.fundCode,
      fundName: item.fundName,
      title: '先补充收敛样本',
      description: '先继续积累已收敛样本，再判断该基金属于持续偏高、偏低还是波动型。',
    };
  });
