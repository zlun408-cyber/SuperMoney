import type {
  EstimateAccuracyDiagnosis,
  EstimateAccuracyDiagnosticItem,
} from '@/lib/funds/estimate-accuracy-diagnostics';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

const LOCAL_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

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

interface ComputableSnapshot {
  snapshot: EstimateAccuracySnapshot;
  signedErrorRate: number;
  timeBucketLabel: string;
}

interface TimeBucketSignedBiasItem {
  label: string;
  sampleCount: number;
  averageSignedErrorRate: number | null;
}

export interface EstimateAccuracyAdjustmentScenario {
  key: 'diagnosis_only' | 'close_session_enhanced';
  title: string;
  description: string;
  sampleCount: number;
  adjustedAverageAbsoluteErrorRate: number | null;
  absoluteImprovementRate: number | null;
  relativeImprovementRate: number | null;
}

export interface EstimateAccuracyAdjustmentBucketComparison {
  label: string;
  sampleCount: number;
  baselineAverageAbsoluteErrorRate: number | null;
  adjustedAverageAbsoluteErrorRate: number | null;
  relativeImprovementRate: number | null;
}

export interface EstimateAccuracyAdjustmentExperiment {
  sampleCount: number;
  baselineAverageAbsoluteErrorRate: number | null;
  recommendedScenarioKey: EstimateAccuracyAdjustmentScenario['key'] | null;
  scenarios: EstimateAccuracyAdjustmentScenario[];
  bucketComparisons: EstimateAccuracyAdjustmentBucketComparison[];
  appliedRules: string[];
}

const isComputableSnapshot = (
  snapshot: EstimateAccuracySnapshot,
): snapshot is EstimateAccuracySnapshot & { finalNav: number; resolvedAt: string; absoluteErrorRate: number } =>
  snapshot.finalNav !== null &&
  snapshot.finalNav > 0 &&
  snapshot.resolvedAt !== null &&
  snapshot.absoluteErrorRate !== null;

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

const getTimeBucketLabel = (quoteUpdatedAt: string): string => {
  const hour = getChinaMarketHour(quoteUpdatedAt);

  return TIME_BUCKETS.find((bucket) => hour !== null && bucket.includes(hour))?.label ?? '未知时段';
};

const toComputableSnapshot = (snapshot: EstimateAccuracySnapshot): ComputableSnapshot | null => {
  if (!isComputableSnapshot(snapshot)) {
    return null;
  }

  return {
    snapshot,
    signedErrorRate: (snapshot.estimatedNav - snapshot.finalNav) / snapshot.finalNav,
    timeBucketLabel: getTimeBucketLabel(snapshot.quoteUpdatedAt),
  };
};

const buildTimeBucketSignedBias = (
  snapshots: ComputableSnapshot[],
): Map<string, TimeBucketSignedBiasItem> => {
  const grouped = new Map<string, ComputableSnapshot[]>();

  for (const item of snapshots) {
    const current = grouped.get(item.timeBucketLabel) ?? [];
    current.push(item);
    grouped.set(item.timeBucketLabel, current);
  }

  return new Map(
    TIME_BUCKETS.map((bucket) => {
      const items = grouped.get(bucket.label) ?? [];
      const totalSignedErrorRate = items.reduce((sum, item) => sum + item.signedErrorRate, 0);

      return [
        bucket.label,
        {
          label: bucket.label,
          sampleCount: items.length,
          averageSignedErrorRate:
            items.length > 0 ? totalSignedErrorRate / items.length : null,
        } satisfies TimeBucketSignedBiasItem,
      ];
    }),
  );
};

const buildFundBiasMap = (
  diagnostics: EstimateAccuracyDiagnosticItem[],
): Map<string, EstimateAccuracyDiagnosticItem> =>
  new Map(diagnostics.map((item) => [item.fundCode, item]));

const applyCorrectionFactor = (estimatedNav: number, correctionFactor: number | null): number => {
  if (correctionFactor === null || correctionFactor === 0 || correctionFactor <= -0.99) {
    return estimatedNav;
  }

  return estimatedNav / (1 + correctionFactor);
};

const getDiagnosisCorrectionFactor = (
  diagnosis: EstimateAccuracyDiagnosis | undefined,
  averageSignedErrorRate: number | null | undefined,
): number | null => {
  if (
    (diagnosis === '持续偏高' || diagnosis === '持续偏低') &&
    averageSignedErrorRate !== null &&
    averageSignedErrorRate !== undefined
  ) {
    return averageSignedErrorRate;
  }

  return null;
};

const isCloseSessionBucket = (label: string): boolean => label === '尾盘' || label === '收盘后';

const buildScenarioMetrics = (
  computableSnapshots: ComputableSnapshot[],
  diagnosticsByFund: Map<string, EstimateAccuracyDiagnosticItem>,
  signedBiasByBucket: Map<string, TimeBucketSignedBiasItem>,
  scenarioKey: EstimateAccuracyAdjustmentScenario['key'],
): EstimateAccuracyAdjustmentScenario & {
  adjustedErrorRatesByBucket: Map<string, number[]>;
} => {
  const adjustedErrorRates: number[] = [];
  const adjustedErrorRatesByBucket = new Map<string, number[]>();

  for (const item of computableSnapshots) {
    const diagnostic = diagnosticsByFund.get(item.snapshot.fundCode);
    let correctionFactor = getDiagnosisCorrectionFactor(
      diagnostic?.diagnosis,
      diagnostic?.averageSignedErrorRate,
    );

    if (
      scenarioKey === 'close_session_enhanced' &&
      isCloseSessionBucket(item.timeBucketLabel) &&
      (diagnostic?.diagnosis === '波动偏差' || diagnostic?.diagnosis === '样本不足' || !diagnostic)
    ) {
      correctionFactor =
        signedBiasByBucket.get(item.timeBucketLabel)?.averageSignedErrorRate ?? correctionFactor;
    }

    const adjustedEstimatedNav = applyCorrectionFactor(item.snapshot.estimatedNav, correctionFactor);
    const finalNav = item.snapshot.finalNav ?? 1;
    const adjustedAbsoluteErrorRate = Math.abs(adjustedEstimatedNav - finalNav) / finalNav;

    adjustedErrorRates.push(adjustedAbsoluteErrorRate);
    const bucketItems = adjustedErrorRatesByBucket.get(item.timeBucketLabel) ?? [];
    bucketItems.push(adjustedAbsoluteErrorRate);
    adjustedErrorRatesByBucket.set(item.timeBucketLabel, bucketItems);
  }

  const adjustedAverageAbsoluteErrorRate =
    adjustedErrorRates.length > 0
      ? adjustedErrorRates.reduce((sum, value) => sum + value, 0) / adjustedErrorRates.length
      : null;

  return {
    key: scenarioKey,
    title: scenarioKey === 'diagnosis_only' ? '诊断修正' : '尾盘 / 收盘后增强',
    description:
      scenarioKey === 'diagnosis_only'
        ? '对持续偏高/偏低基金直接套用基金级平均有符号误差。'
        : '对波动型或样本不足基金，仅在尾盘/收盘后额外套用时段修正因子。',
    sampleCount: computableSnapshots.length,
    adjustedAverageAbsoluteErrorRate,
    absoluteImprovementRate: null,
    relativeImprovementRate: null,
    adjustedErrorRatesByBucket,
  };
};

const withImprovementRates = (
  baselineAverageAbsoluteErrorRate: number | null,
  scenario: EstimateAccuracyAdjustmentScenario & { adjustedErrorRatesByBucket?: Map<string, number[]> },
) => {
  const adjustedAverageAbsoluteErrorRate = scenario.adjustedAverageAbsoluteErrorRate;
  const absoluteImprovementRate =
    baselineAverageAbsoluteErrorRate !== null && adjustedAverageAbsoluteErrorRate !== null
      ? baselineAverageAbsoluteErrorRate - adjustedAverageAbsoluteErrorRate
      : null;
  const relativeImprovementRate =
    baselineAverageAbsoluteErrorRate !== null &&
    baselineAverageAbsoluteErrorRate > 0 &&
    adjustedAverageAbsoluteErrorRate !== null &&
    absoluteImprovementRate !== null
      ? absoluteImprovementRate / baselineAverageAbsoluteErrorRate
      : null;

  return {
    ...scenario,
    absoluteImprovementRate,
    relativeImprovementRate,
  };
};

export const buildEstimateAccuracyAdjustmentExperiment = (
  snapshots: EstimateAccuracySnapshot[],
  diagnostics: EstimateAccuracyDiagnosticItem[],
): EstimateAccuracyAdjustmentExperiment => {
  const computableSnapshots = snapshots
    .map(toComputableSnapshot)
    .filter((item): item is ComputableSnapshot => item !== null);
  const diagnosticsByFund = buildFundBiasMap(diagnostics);
  const signedBiasByBucket = buildTimeBucketSignedBias(computableSnapshots);
  const baselineAverageAbsoluteErrorRate =
    computableSnapshots.length > 0
      ? computableSnapshots.reduce((sum, item) => sum + (item.snapshot.absoluteErrorRate ?? 0), 0) /
        computableSnapshots.length
      : null;

  const scenarios = [
    buildScenarioMetrics(
      computableSnapshots,
      diagnosticsByFund,
      signedBiasByBucket,
      'diagnosis_only',
    ),
    buildScenarioMetrics(
      computableSnapshots,
      diagnosticsByFund,
      signedBiasByBucket,
      'close_session_enhanced',
    ),
  ].map((item) => withImprovementRates(baselineAverageAbsoluteErrorRate, item));

  const recommendedScenario = scenarios.reduce<typeof scenarios[number] | null>((current, item) => {
    if (item.adjustedAverageAbsoluteErrorRate === null) {
      return current;
    }

    if (!current || current.adjustedAverageAbsoluteErrorRate === null) {
      return item;
    }

    return item.adjustedAverageAbsoluteErrorRate < current.adjustedAverageAbsoluteErrorRate
      ? item
      : current;
  }, null);

  const recommendedBucketSource =
    recommendedScenario?.key === 'close_session_enhanced' ? scenarios[1] : scenarios[0];
  const recommendedBucketErrorMap = recommendedBucketSource.adjustedErrorRatesByBucket ?? new Map<string, number[]>();

  const baselineByBucket = new Map<string, number[]>();
  for (const item of computableSnapshots) {
    const current = baselineByBucket.get(item.timeBucketLabel) ?? [];
    current.push(item.snapshot.absoluteErrorRate ?? 0);
    baselineByBucket.set(item.timeBucketLabel, current);
  }

  const bucketComparisons = TIME_BUCKETS.map((bucket) => {
    const baselineItems = baselineByBucket.get(bucket.label) ?? [];
    const adjustedItems = recommendedBucketErrorMap.get(bucket.label) ?? [];
    const baselineAverage =
      baselineItems.length > 0
        ? baselineItems.reduce((sum, value) => sum + value, 0) / baselineItems.length
        : null;
    const adjustedAverage =
      adjustedItems.length > 0
        ? adjustedItems.reduce((sum, value) => sum + value, 0) / adjustedItems.length
        : null;

    return {
      label: bucket.label,
      sampleCount: baselineItems.length,
      baselineAverageAbsoluteErrorRate: baselineAverage,
      adjustedAverageAbsoluteErrorRate: adjustedAverage,
      relativeImprovementRate:
        baselineAverage !== null && baselineAverage > 0 && adjustedAverage !== null
          ? (baselineAverage - adjustedAverage) / baselineAverage
          : null,
    } satisfies EstimateAccuracyAdjustmentBucketComparison;
  });

  return {
    sampleCount: computableSnapshots.length,
    baselineAverageAbsoluteErrorRate,
    recommendedScenarioKey: recommendedScenario?.key ?? null,
    scenarios: scenarios.map(({ adjustedErrorRatesByBucket: _adjustedErrorRatesByBucket, ...item }) => item),
    bucketComparisons,
    appliedRules: [
      '持续偏高/偏低基金按基金平均有符号误差做全局修正',
      '波动偏差或样本不足基金仅在尾盘/收盘后套用时段修正因子',
    ],
  };
};


export interface EstimateAccuracyAdjustmentSimulationScenario {
  key: 'global' | 'late-session' | 'diagnosis-aware';
  label: string;
  description: string;
  sampleCount: number;
  adjustedSampleCount: number;
  baselineAverageAbsoluteErrorRate: number | null;
  adjustedAverageAbsoluteErrorRate: number | null;
  improvementRate: number | null;
}

export interface EstimateAccuracyAdjustmentSimulationBucketInsight {
  label: string;
  sampleCount: number;
  baselineAverageAbsoluteErrorRate: number | null;
  bestScenarioKey: EstimateAccuracyAdjustmentSimulationScenario['key'] | null;
  bestScenarioLabel: string | null;
  bestScenarioAdjustedAverageAbsoluteErrorRate: number | null;
  bestScenarioImprovementRate: number | null;
}

export interface EstimateAccuracyAdjustmentSimulationDiagnosisInsight {
  diagnosis: EstimateAccuracyDiagnosis;
  sampleCount: number;
  baselineAverageAbsoluteErrorRate: number | null;
  bestScenarioKey: EstimateAccuracyAdjustmentSimulationScenario['key'] | null;
  bestScenarioLabel: string | null;
  bestScenarioAdjustedAverageAbsoluteErrorRate: number | null;
  bestScenarioImprovementRate: number | null;
}

export interface EstimateAccuracyAdjustmentSimulationFundInsight {
  fundCode: string;
  fundName: string;
  diagnosis: EstimateAccuracyDiagnosis;
  sampleCount: number;
  baselineAverageAbsoluteErrorRate: number | null;
  bestScenarioKey: EstimateAccuracyAdjustmentSimulationScenario['key'] | null;
  bestScenarioLabel: string | null;
  bestScenarioAdjustedAverageAbsoluteErrorRate: number | null;
  bestScenarioImprovementRate: number | null;
  recommendationStatus: 'priority' | 'collect-more' | 'not-recommended';
  recommendationLabel: string;
  recommendationReason: string;
}

export interface EstimateAccuracyAdjustmentSimulationResult {
  baselineAverageAbsoluteErrorRate: number | null;
  bestScenarioKey: EstimateAccuracyAdjustmentSimulationScenario['key'] | null;
  bestScenarioLabel: string | null;
  bestScenarioAdjustedAverageAbsoluteErrorRate: number | null;
  bestScenarioImprovementRate: number | null;
  scenarios: EstimateAccuracyAdjustmentSimulationScenario[];
  bucketInsights: EstimateAccuracyAdjustmentSimulationBucketInsight[];
  diagnosisInsights: EstimateAccuracyAdjustmentSimulationDiagnosisInsight[];
  fundInsights: EstimateAccuracyAdjustmentSimulationFundInsight[];
}

interface SimulationComputableSnapshot {
  snapshot: EstimateAccuracySnapshot;
  signedErrorRate: number;
  timeBucket: '盘前 / 上午' | '午后' | '尾盘' | '收盘后' | '未知';
}

const DIAGNOSIS_BUCKETS: EstimateAccuracyDiagnosis[] = [
  '持续偏高',
  '持续偏低',
  '波动偏差',
  '样本不足',
];

const getFundRecommendation = (input: {
  sampleCount: number;
  diagnosis: EstimateAccuracyDiagnosis;
  bestScenarioImprovementRate: number | null;
}): Pick<
  EstimateAccuracyAdjustmentSimulationFundInsight,
  'recommendationStatus' | 'recommendationLabel' | 'recommendationReason'
> => {
  const improvementRate = input.bestScenarioImprovementRate;

  if (improvementRate === null || improvementRate <= 0.05) {
    return {
      recommendationStatus: 'not-recommended',
      recommendationLabel: '暂不建议修正',
      recommendationReason: '当前模拟改善有限，先保留原估值链路并继续观察。',
    };
  }

  if (input.sampleCount < 2 || input.diagnosis === '样本不足') {
    return {
      recommendationStatus: 'collect-more',
      recommendationLabel: '继续收集样本',
      recommendationReason: '当前样本仍偏少，先补齐收敛样本再决定是否上线修正。',
    };
  }

  return {
    recommendationStatus: 'priority',
    recommendationLabel: '优先验证',
    recommendationReason: '模拟改善明显，适合优先进入基金级修正验证。',
  };
};

const SIMULATION_MIN_CORRECTION_DELTA = 1e-8;

const getSimulationAverage = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const clampSimulationCorrectionFactor = (value: number): number => {
  if (value <= -0.95) {
    return -0.95;
  }

  if (value >= 0.95) {
    return 0.95;
  }

  return value;
};

const getSimulationTimeBucket = (
  quoteUpdatedAt: string,
): SimulationComputableSnapshot['timeBucket'] => {
  const label = getTimeBucketLabel(quoteUpdatedAt);
  if (
    label === '盘前 / 上午' ||
    label === '午后' ||
    label === '尾盘' ||
    label === '收盘后'
  ) {
    return label;
  }

  return '未知';
};

const toSimulationComputableSnapshot = (
  snapshot: EstimateAccuracySnapshot,
): SimulationComputableSnapshot | null => {
  if (!isComputableSnapshot(snapshot)) {
    return null;
  }

  return {
    snapshot,
    signedErrorRate: (snapshot.estimatedNav - snapshot.finalNav) / snapshot.finalNav,
    timeBucket: getSimulationTimeBucket(snapshot.quoteUpdatedAt),
  };
};

const buildSimulationScenario = (
  key: EstimateAccuracyAdjustmentSimulationScenario['key'],
  label: string,
  description: string,
  computableSnapshots: SimulationComputableSnapshot[],
  baselineAverageAbsoluteErrorRate: number | null,
  diagnosticsByFund: Map<string, EstimateAccuracyDiagnosticItem>,
  getCorrectionFactor: (item: SimulationComputableSnapshot) => number | null,
): EstimateAccuracyAdjustmentSimulationScenario & {
  adjustedErrorRatesByBucket: Map<SimulationComputableSnapshot['timeBucket'], number[]>;
  adjustedErrorRatesByDiagnosis: Map<EstimateAccuracyDiagnosis, number[]>;
  adjustedErrorRatesByFund: Map<string, number[]>;
} => {
  let adjustedSampleCount = 0;
  const adjustedErrorRatesByBucket = new Map<
    SimulationComputableSnapshot['timeBucket'],
    number[]
  >();
  const adjustedErrorRatesByDiagnosis = new Map<EstimateAccuracyDiagnosis, number[]>();
  const adjustedErrorRatesByFund = new Map<string, number[]>();

  const adjustedAverageAbsoluteErrorRate = getSimulationAverage(
    computableSnapshots.map((item) => {
      const correctionFactor = getCorrectionFactor(item);
      const normalizedCorrectionFactor =
        correctionFactor === null ? null : clampSimulationCorrectionFactor(correctionFactor);

      if (
        normalizedCorrectionFactor !== null &&
        Math.abs(normalizedCorrectionFactor) > SIMULATION_MIN_CORRECTION_DELTA
      ) {
        adjustedSampleCount += 1;
      }

      const adjustedNav =
        normalizedCorrectionFactor === null ||
        Math.abs(normalizedCorrectionFactor) <= SIMULATION_MIN_CORRECTION_DELTA
          ? item.snapshot.estimatedNav
          : item.snapshot.estimatedNav / (1 + normalizedCorrectionFactor);

      const finalNav = item.snapshot.finalNav ?? 1;
      const adjustedAbsoluteErrorRate = Math.abs(adjustedNav - finalNav) / finalNav;
      const bucketItems = adjustedErrorRatesByBucket.get(item.timeBucket) ?? [];
      bucketItems.push(adjustedAbsoluteErrorRate);
      adjustedErrorRatesByBucket.set(item.timeBucket, bucketItems);
      const diagnosis = diagnosticsByFund.get(item.snapshot.fundCode)?.diagnosis ?? '样本不足';
      const diagnosisItems = adjustedErrorRatesByDiagnosis.get(diagnosis) ?? [];
      diagnosisItems.push(adjustedAbsoluteErrorRate);
      adjustedErrorRatesByDiagnosis.set(diagnosis, diagnosisItems);
      const fundItems = adjustedErrorRatesByFund.get(item.snapshot.fundCode) ?? [];
      fundItems.push(adjustedAbsoluteErrorRate);
      adjustedErrorRatesByFund.set(item.snapshot.fundCode, fundItems);
      return adjustedAbsoluteErrorRate;
    }),
  );

  return {
    key,
    label,
    description,
    sampleCount: computableSnapshots.length,
    adjustedSampleCount,
    baselineAverageAbsoluteErrorRate,
    adjustedAverageAbsoluteErrorRate,
    improvementRate:
      baselineAverageAbsoluteErrorRate !== null &&
      adjustedAverageAbsoluteErrorRate !== null &&
      baselineAverageAbsoluteErrorRate > 0
        ? (baselineAverageAbsoluteErrorRate - adjustedAverageAbsoluteErrorRate) /
          baselineAverageAbsoluteErrorRate
        : null,
    adjustedErrorRatesByBucket,
    adjustedErrorRatesByDiagnosis,
    adjustedErrorRatesByFund,
  };
};

export const buildEstimateAccuracyAdjustmentSimulation = (
  snapshots: EstimateAccuracySnapshot[],
  diagnostics: EstimateAccuracyDiagnosticItem[],
): EstimateAccuracyAdjustmentSimulationResult => {
  const computableSnapshots = snapshots
    .map(toSimulationComputableSnapshot)
    .filter((item): item is SimulationComputableSnapshot => item !== null);

  const baselineAverageAbsoluteErrorRate = getSimulationAverage(
    computableSnapshots.map((item) => item.snapshot.absoluteErrorRate ?? 0),
  );

  const globalCorrectionFactor = getSimulationAverage(
    computableSnapshots.map((item) => item.signedErrorRate),
  );
  const tailCorrectionFactor = getSimulationAverage(
    computableSnapshots
      .filter((item) => item.timeBucket === '尾盘')
      .map((item) => item.signedErrorRate),
  );
  const afterCloseCorrectionFactor = getSimulationAverage(
    computableSnapshots
      .filter((item) => item.timeBucket === '收盘后')
      .map((item) => item.signedErrorRate),
  );

  const diagnosisFactorByFundCode = new Map<string, number>();
  for (const item of diagnostics) {
    if (
      (item.diagnosis === '持续偏高' || item.diagnosis === '持续偏低') &&
      item.averageSignedErrorRate !== null
    ) {
      diagnosisFactorByFundCode.set(item.fundCode, item.averageSignedErrorRate);
    }
  }
  const diagnosticsByFund = buildFundBiasMap(diagnostics);

  const scenarios = [
    buildSimulationScenario(
      'global',
      '全局签名修正',
      '用全样本平均有符号误差做统一平移，优先验证是否存在系统性高估或低估。',
      computableSnapshots,
      baselineAverageAbsoluteErrorRate,
      diagnosticsByFund,
      () => globalCorrectionFactor,
    ),
    buildSimulationScenario(
      'late-session',
      '尾盘 / 收盘后专用修正',
      '仅对尾盘与收盘后样本套用各自时段偏差，验证盘中末段链路是否是主要误差源。',
      computableSnapshots,
      baselineAverageAbsoluteErrorRate,
      diagnosticsByFund,
      (item) => {
        if (item.timeBucket === '尾盘') {
          return tailCorrectionFactor;
        }

        if (item.timeBucket === '收盘后') {
          return afterCloseCorrectionFactor;
        }

        return null;
      },
    ),
    buildSimulationScenario(
      'diagnosis-aware',
      '诊断 + 尾盘联动修正',
      '持续偏高 / 偏低基金优先按诊断修正，尾盘与收盘后再叠加时段信号，兼顾系统性和时段性误差。',
      computableSnapshots,
      baselineAverageAbsoluteErrorRate,
      diagnosticsByFund,
      (item) => {
        const factors: number[] = [];
        const diagnosisFactor = diagnosisFactorByFundCode.get(item.snapshot.fundCode);
        if (diagnosisFactor !== undefined) {
          factors.push(diagnosisFactor);
        }

        if (item.timeBucket === '尾盘' && tailCorrectionFactor !== null) {
          factors.push(tailCorrectionFactor);
        }

        if (item.timeBucket === '收盘后' && afterCloseCorrectionFactor !== null) {
          factors.push(afterCloseCorrectionFactor);
        }

        if (factors.length === 0) {
          return globalCorrectionFactor;
        }

        return getSimulationAverage(factors);
      },
    ),
  ];

  const baselineErrorRatesByBucket = new Map<SimulationComputableSnapshot['timeBucket'], number[]>();
  for (const item of computableSnapshots) {
    const bucketItems = baselineErrorRatesByBucket.get(item.timeBucket) ?? [];
    bucketItems.push(item.snapshot.absoluteErrorRate ?? 0);
    baselineErrorRatesByBucket.set(item.timeBucket, bucketItems);
  }

  const bucketInsights: EstimateAccuracyAdjustmentSimulationBucketInsight[] = TIME_BUCKETS.map(
    (bucket) => {
      const bucketLabel = bucket.label as SimulationComputableSnapshot['timeBucket'];
      const baselineItems = baselineErrorRatesByBucket.get(bucketLabel) ?? [];
      const baselineAverageAbsoluteErrorRate = getSimulationAverage(baselineItems);
      const scenarioCandidates = scenarios
        .map((scenario) => {
          const adjustedAverageAbsoluteErrorRate = getSimulationAverage(
            scenario.adjustedErrorRatesByBucket.get(bucketLabel) ?? [],
          );

          return {
            key: scenario.key,
            label: scenario.label,
            adjustedAverageAbsoluteErrorRate,
            improvementRate:
              baselineAverageAbsoluteErrorRate !== null &&
              baselineAverageAbsoluteErrorRate > 0 &&
              adjustedAverageAbsoluteErrorRate !== null
                ? (baselineAverageAbsoluteErrorRate - adjustedAverageAbsoluteErrorRate) /
                  baselineAverageAbsoluteErrorRate
                : null,
          };
        })
        .filter((item) => item.adjustedAverageAbsoluteErrorRate !== null);

      const bestScenario =
        scenarioCandidates.sort((left, right) => {
          const adjustedDelta =
            (left.adjustedAverageAbsoluteErrorRate ?? Number.POSITIVE_INFINITY) -
            (right.adjustedAverageAbsoluteErrorRate ?? Number.POSITIVE_INFINITY);
          if (adjustedDelta !== 0) {
            return adjustedDelta;
          }

          return (right.improvementRate ?? -1) - (left.improvementRate ?? -1);
        })[0] ?? null;

      return {
        label: bucket.label,
        sampleCount: baselineItems.length,
        baselineAverageAbsoluteErrorRate,
        bestScenarioKey: bestScenario?.key ?? null,
        bestScenarioLabel: bestScenario?.label ?? null,
        bestScenarioAdjustedAverageAbsoluteErrorRate:
          bestScenario?.adjustedAverageAbsoluteErrorRate ?? null,
        bestScenarioImprovementRate: bestScenario?.improvementRate ?? null,
      };
    },
  );

  const baselineErrorRatesByDiagnosis = new Map<EstimateAccuracyDiagnosis, number[]>();
  for (const item of computableSnapshots) {
    const diagnosis = diagnosticsByFund.get(item.snapshot.fundCode)?.diagnosis ?? '样本不足';
    const diagnosisItems = baselineErrorRatesByDiagnosis.get(diagnosis) ?? [];
    diagnosisItems.push(item.snapshot.absoluteErrorRate ?? 0);
    baselineErrorRatesByDiagnosis.set(diagnosis, diagnosisItems);
  }

  const diagnosisInsights: EstimateAccuracyAdjustmentSimulationDiagnosisInsight[] =
    DIAGNOSIS_BUCKETS.map((diagnosis) => {
      const baselineItems = baselineErrorRatesByDiagnosis.get(diagnosis) ?? [];
      const baselineAverageAbsoluteErrorRate = getSimulationAverage(baselineItems);
      const scenarioCandidates = scenarios
        .map((scenario) => {
          const adjustedAverageAbsoluteErrorRate = getSimulationAverage(
            scenario.adjustedErrorRatesByDiagnosis.get(diagnosis) ?? [],
          );

          return {
            key: scenario.key,
            label: scenario.label,
            adjustedAverageAbsoluteErrorRate,
            improvementRate:
              baselineAverageAbsoluteErrorRate !== null &&
              baselineAverageAbsoluteErrorRate > 0 &&
              adjustedAverageAbsoluteErrorRate !== null
                ? (baselineAverageAbsoluteErrorRate - adjustedAverageAbsoluteErrorRate) /
                  baselineAverageAbsoluteErrorRate
                : null,
          };
        })
        .filter((item) => item.adjustedAverageAbsoluteErrorRate !== null);

      const bestScenario =
        scenarioCandidates.sort((left, right) => {
          const adjustedDelta =
            (left.adjustedAverageAbsoluteErrorRate ?? Number.POSITIVE_INFINITY) -
            (right.adjustedAverageAbsoluteErrorRate ?? Number.POSITIVE_INFINITY);
          if (adjustedDelta !== 0) {
            return adjustedDelta;
          }

          return (right.improvementRate ?? -1) - (left.improvementRate ?? -1);
        })[0] ?? null;

      return {
        diagnosis,
        sampleCount: baselineItems.length,
        baselineAverageAbsoluteErrorRate,
        bestScenarioKey: bestScenario?.key ?? null,
        bestScenarioLabel: bestScenario?.label ?? null,
        bestScenarioAdjustedAverageAbsoluteErrorRate:
          bestScenario?.adjustedAverageAbsoluteErrorRate ?? null,
        bestScenarioImprovementRate: bestScenario?.improvementRate ?? null,
      };
    });

  const fundMetaByCode = new Map<string, { fundName: string; diagnosis: EstimateAccuracyDiagnosis }>();
  const baselineErrorRatesByFund = new Map<string, number[]>();
  for (const item of computableSnapshots) {
    const diagnosis = diagnosticsByFund.get(item.snapshot.fundCode)?.diagnosis ?? '样本不足';
    fundMetaByCode.set(item.snapshot.fundCode, {
      fundName: item.snapshot.fundName,
      diagnosis,
    });
    const fundItems = baselineErrorRatesByFund.get(item.snapshot.fundCode) ?? [];
    fundItems.push(item.snapshot.absoluteErrorRate ?? 0);
    baselineErrorRatesByFund.set(item.snapshot.fundCode, fundItems);
  }

  const fundInsights: EstimateAccuracyAdjustmentSimulationFundInsight[] = Array.from(
    baselineErrorRatesByFund.entries(),
  )
    .map(([fundCode, baselineItems]) => {
      const baselineAverageAbsoluteErrorRate = getSimulationAverage(baselineItems);
      const scenarioCandidates = scenarios
        .map((scenario) => {
          const adjustedAverageAbsoluteErrorRate = getSimulationAverage(
            scenario.adjustedErrorRatesByFund.get(fundCode) ?? [],
          );

          return {
            key: scenario.key,
            label: scenario.label,
            adjustedAverageAbsoluteErrorRate,
            improvementRate:
              baselineAverageAbsoluteErrorRate !== null &&
              baselineAverageAbsoluteErrorRate > 0 &&
              adjustedAverageAbsoluteErrorRate !== null
                ? (baselineAverageAbsoluteErrorRate - adjustedAverageAbsoluteErrorRate) /
                  baselineAverageAbsoluteErrorRate
                : null,
          };
        })
        .filter((item) => item.adjustedAverageAbsoluteErrorRate !== null);

      const bestScenario =
        scenarioCandidates.sort((left, right) => {
          const adjustedDelta =
            (left.adjustedAverageAbsoluteErrorRate ?? Number.POSITIVE_INFINITY) -
            (right.adjustedAverageAbsoluteErrorRate ?? Number.POSITIVE_INFINITY);
          if (adjustedDelta !== 0) {
            return adjustedDelta;
          }

          return (right.improvementRate ?? -1) - (left.improvementRate ?? -1);
        })[0] ?? null;

      const meta = fundMetaByCode.get(fundCode) ?? { fundName: fundCode, diagnosis: '样本不足' as const };
      const recommendation = getFundRecommendation({
        sampleCount: baselineItems.length,
        diagnosis: meta.diagnosis,
        bestScenarioImprovementRate: bestScenario?.improvementRate ?? null,
      });

      return {
        fundCode,
        fundName: meta.fundName,
        diagnosis: meta.diagnosis,
        sampleCount: baselineItems.length,
        baselineAverageAbsoluteErrorRate,
        bestScenarioKey: bestScenario?.key ?? null,
        bestScenarioLabel: bestScenario?.label ?? null,
        bestScenarioAdjustedAverageAbsoluteErrorRate:
          bestScenario?.adjustedAverageAbsoluteErrorRate ?? null,
        bestScenarioImprovementRate: bestScenario?.improvementRate ?? null,
        ...recommendation,
      };
    })
    .sort((left, right) => {
      const improvementDelta =
        (right.bestScenarioImprovementRate ?? -1) - (left.bestScenarioImprovementRate ?? -1);
      if (improvementDelta !== 0) {
        return improvementDelta;
      }

      const errorDelta =
        (right.baselineAverageAbsoluteErrorRate ?? -1) - (left.baselineAverageAbsoluteErrorRate ?? -1);
      if (errorDelta !== 0) {
        return errorDelta;
      }

      return left.fundCode.localeCompare(right.fundCode);
    });

  const bestScenario =
    scenarios
      .filter((item) => item.adjustedAverageAbsoluteErrorRate !== null)
      .sort((left, right) => {
        const adjustedDelta =
          (left.adjustedAverageAbsoluteErrorRate ?? Number.POSITIVE_INFINITY) -
          (right.adjustedAverageAbsoluteErrorRate ?? Number.POSITIVE_INFINITY);
        if (adjustedDelta !== 0) {
          return adjustedDelta;
        }

        return (right.improvementRate ?? -1) - (left.improvementRate ?? -1);
      })[0] ?? null;

  return {
    baselineAverageAbsoluteErrorRate,
    bestScenarioKey: bestScenario?.key ?? null,
    bestScenarioLabel: bestScenario?.label ?? null,
    bestScenarioAdjustedAverageAbsoluteErrorRate:
      bestScenario?.adjustedAverageAbsoluteErrorRate ?? null,
    bestScenarioImprovementRate: bestScenario?.improvementRate ?? null,
    scenarios: scenarios.map(
      ({
        adjustedErrorRatesByBucket: _adjustedErrorRatesByBucket,
        adjustedErrorRatesByDiagnosis: _adjustedErrorRatesByDiagnosis,
        adjustedErrorRatesByFund: _adjustedErrorRatesByFund,
        ...item
      }) => item,
    ),
    bucketInsights,
    diagnosisInsights,
    fundInsights,
  };
};
