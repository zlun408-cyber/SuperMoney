import type { EstimateAccuracyDiagnosticItem } from '@/lib/funds/estimate-accuracy-diagnostics';
import {
  summarizeEstimateAccuracyDailyTrend,
  summarizeEstimateAccuracyTimeBuckets,
  type EstimateAccuracyDailyTrendItem,
  type EstimateAccuracyTimeBucketItem,
} from '@/lib/funds/estimate-accuracy-insights';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

export interface EstimateAccuracySourceModel {
  dominantDiagnosis: {
    label: string;
    affectedFundCount: number;
    averageAbsoluteErrorRate: number | null;
  };
  riskiestTimeBucket: EstimateAccuracyTimeBucketItem;
  riskiestTradingDate: EstimateAccuracyDailyTrendItem;
  unresolvedPressure: {
    unresolvedSampleCount: number;
    unresolvedRatio: number;
  };
}

export interface EstimateAccuracyStrategyItem {
  title: string;
  description: string;
}

const getDiagnosisGroupLabel = (diagnosis: EstimateAccuracyDiagnosticItem['diagnosis']) => {
  switch (diagnosis) {
    case '持续偏高':
      return '持续偏高主导';
    case '持续偏低':
      return '持续偏低主导';
    case '波动偏差':
      return '波动偏差主导';
    case '样本不足':
      return '样本不足主导';
  }
};

export const buildEstimateAccuracySourceModel = (
  snapshots: EstimateAccuracySnapshot[],
  diagnostics: EstimateAccuracyDiagnosticItem[],
): EstimateAccuracySourceModel => {
  const groupedDiagnostics = new Map<
    EstimateAccuracyDiagnosticItem['diagnosis'],
    EstimateAccuracyDiagnosticItem[]
  >();

  for (const item of diagnostics) {
    const current = groupedDiagnostics.get(item.diagnosis) ?? [];
    current.push(item);
    groupedDiagnostics.set(item.diagnosis, current);
  }

  const dominantDiagnosisEntry =
    Array.from(groupedDiagnostics.entries())
      .map(([diagnosis, items]) => {
        const computableItems = items.filter((item) => item.averageAbsoluteErrorRate !== null);
        const totalAbsoluteErrorRate = computableItems.reduce(
          (sum, item) => sum + (item.averageAbsoluteErrorRate ?? 0),
          0,
        );

        return {
          diagnosis,
          affectedFundCount: items.length,
          averageAbsoluteErrorRate:
            computableItems.length > 0 ? totalAbsoluteErrorRate / computableItems.length : null,
        };
      })
      .sort((left, right) => {
        const leftScore = left.averageAbsoluteErrorRate ?? -1;
        const rightScore = right.averageAbsoluteErrorRate ?? -1;
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return right.affectedFundCount - left.affectedFundCount;
      })[0] ?? {
      diagnosis: '样本不足' as const,
      affectedFundCount: 0,
      averageAbsoluteErrorRate: null,
    };

  const riskiestTimeBucket =
    summarizeEstimateAccuracyTimeBuckets(snapshots).sort((left, right) => {
      const leftScore = left.averageAbsoluteErrorRate ?? -1;
      const rightScore = right.averageAbsoluteErrorRate ?? -1;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return right.sampleCount - left.sampleCount;
    })[0] ?? {
      label: '暂无样本',
      sampleCount: 0,
      averageAbsoluteErrorRate: null,
    };

  const riskiestTradingDate =
    summarizeEstimateAccuracyDailyTrend(snapshots, 999).sort((left, right) => {
      const leftScore = left.averageAbsoluteErrorRate ?? -1;
      const rightScore = right.averageAbsoluteErrorRate ?? -1;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return right.tradingDate.localeCompare(left.tradingDate);
    })[0] ?? {
      tradingDate: '暂无样本',
      sampleCount: 0,
      impactedFundCount: 0,
      averageAbsoluteErrorRate: null,
    };

  const unresolvedSampleCount = snapshots.filter(
    (snapshot) => snapshot.finalNav === null || snapshot.resolvedAt === null,
  ).length;

  return {
    dominantDiagnosis: {
      label: getDiagnosisGroupLabel(dominantDiagnosisEntry.diagnosis),
      affectedFundCount: dominantDiagnosisEntry.affectedFundCount,
      averageAbsoluteErrorRate: dominantDiagnosisEntry.averageAbsoluteErrorRate,
    },
    riskiestTimeBucket,
    riskiestTradingDate,
    unresolvedPressure: {
      unresolvedSampleCount,
      unresolvedRatio: snapshots.length > 0 ? unresolvedSampleCount / snapshots.length : 0,
    },
  };
};

export const buildEstimateAccuracyStrategy = (
  model: EstimateAccuracySourceModel,
): EstimateAccuracyStrategyItem[] => {
  const items: EstimateAccuracyStrategyItem[] = [];

  if (model.dominantDiagnosis.label === '持续偏高主导') {
    items.push({
      title: '先修系统性高估',
      description: '当前以持续偏高为主，优先回查指数映射、替代价格与权重估算是否整体偏高。',
    });
  } else if (model.dominantDiagnosis.label === '持续偏低主导') {
    items.push({
      title: '先修系统性低估',
      description: '当前以持续偏低为主，优先补查现金、债券或低波仓位估算是否偏低。',
    });
  } else if (model.dominantDiagnosis.label === '波动偏差主导') {
    items.push({
      title: '先稳住波动型误差',
      description: '当前以波动偏差为主，优先收紧异常值过滤和盘中刷新抖动。',
    });
  } else {
    items.push({
      title: '先补样本再判断',
      description: '当前样本仍偏少，先积累收敛样本，避免过早对误差来源下结论。',
    });
  }

  items.push({
    title: `重点优化${model.riskiestTimeBucket.label}链路`,
    description: `${model.riskiestTimeBucket.label} 的平均误差最高，优先排查该时段的数据刷新、映射和计算路径。`,
  });

  items.push({
    title: '继续补齐收敛样本',
    description: `当前还有 ${model.unresolvedPressure.unresolvedSampleCount} 条未收敛样本，先提高最终净值回补覆盖率。`,
  });

  return items;
};
