import { buildEstimateAccuracyAdjustmentSimulation } from '@/lib/funds/estimate-accuracy-adjustment';
import { summarizeEstimateAccuracyDiagnostics } from '@/lib/funds/estimate-accuracy-diagnostics';
import type {
  EstimateAccuracySnapshot,
  EstimateAdjustmentDecisionItem,
  EstimateAdjustmentDiagnosis,
  EstimateAdjustmentPolicy,
  EstimateAdjustmentScenarioKey,
  FundQuote,
} from '@/lib/funds/types';
export {
  ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
  ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT,
  loadEstimateAdjustmentDecisions,
} from '@/lib/storage/estimate-adjustment-storage';

export const ESTIMATE_ADJUSTMENT_FAILED_COOLDOWN_DAYS = 5;

const LOCAL_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const MIN_EFFECTIVE_CORRECTION_FACTOR = 1e-8;

const SCENARIO_LABELS: Record<EstimateAdjustmentScenarioKey, string> = {
  global: '全局签名修正',
  'late-session': '尾盘 / 收盘后专用修正',
  'diagnosis-aware': '诊断 + 尾盘联动修正',
};

const isComputableSnapshot = (
  snapshot: EstimateAccuracySnapshot,
): snapshot is EstimateAccuracySnapshot & {
  finalNav: number;
  resolvedAt: string;
  absoluteErrorRate: number;
} =>
  snapshot.finalNav !== null &&
  snapshot.finalNav > 0 &&
  snapshot.resolvedAt !== null &&
  snapshot.absoluteErrorRate !== null;

const getAverage = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const clampCorrectionFactor = (value: number | null): number | null => {
  if (value === null) {
    return null;
  }

  if (value <= -0.95) {
    return -0.95;
  }

  if (value >= 0.95) {
    return 0.95;
  }

  return value;
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

const getTimeBucket = (
  quoteUpdatedAt: string,
): '盘前 / 上午' | '午后' | '尾盘' | '收盘后' | '未知' => {
  const hour = getChinaMarketHour(quoteUpdatedAt);
  if (hour === null) {
    return '未知';
  }

  if (hour < 12) {
    return '盘前 / 上午';
  }

  if (hour < 14) {
    return '午后';
  }

  if (hour < 15) {
    return '尾盘';
  }

  return '收盘后';
};

const applyCorrectionFactor = (estimatedNav: number, correctionFactor: number | null): number => {
  if (
    correctionFactor === null ||
    Math.abs(correctionFactor) <= MIN_EFFECTIVE_CORRECTION_FACTOR ||
    correctionFactor <= -0.99
  ) {
    return estimatedNav;
  }

  return estimatedNav / (1 + correctionFactor);
};

const getCooldownEndsAt = (updatedAt: string): string | null => {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(
    timestamp + ESTIMATE_ADJUSTMENT_FAILED_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
};

const buildCorrectionContext = (snapshots: EstimateAccuracySnapshot[]) => {
  const computableSnapshots = snapshots.filter(isComputableSnapshot);
  const signedErrorRates = computableSnapshots.map(
    (snapshot) => (snapshot.estimatedNav - snapshot.finalNav) / snapshot.finalNav,
  );
  const globalCorrectionFactor = clampCorrectionFactor(getAverage(signedErrorRates));
  const tailCorrectionFactor = clampCorrectionFactor(
    getAverage(
      computableSnapshots
        .filter((snapshot) => getTimeBucket(snapshot.quoteUpdatedAt) === '尾盘')
        .map((snapshot) => (snapshot.estimatedNav - snapshot.finalNav) / snapshot.finalNav),
    ),
  );
  const afterCloseCorrectionFactor = clampCorrectionFactor(
    getAverage(
      computableSnapshots
        .filter((snapshot) => getTimeBucket(snapshot.quoteUpdatedAt) === '收盘后')
        .map((snapshot) => (snapshot.estimatedNav - snapshot.finalNav) / snapshot.finalNav),
    ),
  );
  const diagnostics = summarizeEstimateAccuracyDiagnostics(
    snapshots,
    Math.max(snapshots.length, 10),
  );
  const simulation = buildEstimateAccuracyAdjustmentSimulation(snapshots, diagnostics);
  const diagnosisFactorByFundCode = new Map<string, number>();

  for (const item of diagnostics) {
    if (
      (item.diagnosis === '持续偏高' || item.diagnosis === '持续偏低') &&
      item.averageSignedErrorRate !== null
    ) {
      diagnosisFactorByFundCode.set(item.fundCode, item.averageSignedErrorRate);
    }
  }

  return {
    diagnosticsByFund: new Map(diagnostics.map((item) => [item.fundCode, item])),
    fundInsightsByCode: new Map(simulation.fundInsights.map((item) => [item.fundCode, item])),
    diagnosisFactorByFundCode,
    globalCorrectionFactor,
    tailCorrectionFactor,
    afterCloseCorrectionFactor,
  };
};

const resolveCorrectionFactor = (
  quote: FundQuote,
  scenarioKey: EstimateAdjustmentScenarioKey | null,
  context: ReturnType<typeof buildCorrectionContext>,
): number | null => {
  if (scenarioKey === null) {
    return null;
  }

  const timeBucket = getTimeBucket(quote.updatedAt);

  if (scenarioKey === 'global') {
    return context.globalCorrectionFactor;
  }

  if (scenarioKey === 'late-session') {
    if (timeBucket === '尾盘') {
      return context.tailCorrectionFactor;
    }

    if (timeBucket === '收盘后') {
      return context.afterCloseCorrectionFactor;
    }

    return null;
  }

  const factors: number[] = [];
  const diagnosisFactor = context.diagnosisFactorByFundCode.get(quote.code);
  if (diagnosisFactor !== undefined) {
    factors.push(diagnosisFactor);
  }

  if (timeBucket === '尾盘' && context.tailCorrectionFactor !== null) {
    factors.push(context.tailCorrectionFactor);
  }

  if (timeBucket === '收盘后' && context.afterCloseCorrectionFactor !== null) {
    factors.push(context.afterCloseCorrectionFactor);
  }

  if (factors.length === 0) {
    return context.globalCorrectionFactor;
  }

  return clampCorrectionFactor(getAverage(factors));
};

export const buildEstimateAdjustmentPolicy = (
  quote: FundQuote,
  snapshots: EstimateAccuracySnapshot[],
  decisions: Record<string, EstimateAdjustmentDecisionItem>,
  now = Date.now(),
): EstimateAdjustmentPolicy | null => {
  const context = buildCorrectionContext(snapshots);
  return buildEstimateAdjustmentPolicyFromContext(quote, decisions, context, now);
};

const buildEstimateAdjustmentPolicyFromContext = (
  quote: FundQuote,
  decisions: Record<string, EstimateAdjustmentDecisionItem>,
  context: ReturnType<typeof buildCorrectionContext>,
  now: number,
): EstimateAdjustmentPolicy | null => {
  const decision = decisions[quote.code];
  if (!decision || decision.status === 'dismissed') {
    return null;
  }

  const fundInsight = context.fundInsightsByCode.get(quote.code);
  const diagnosis =
    (context.diagnosticsByFund.get(quote.code)?.diagnosis as EstimateAdjustmentDiagnosis | undefined) ??
    null;
  const scenarioKey = fundInsight?.bestScenarioKey ?? null;
  const scenarioLabel = scenarioKey ? SCENARIO_LABELS[scenarioKey] : null;
  const correctionFactor = resolveCorrectionFactor(quote, scenarioKey, context);
  const hasEffectiveCorrection =
    correctionFactor !== null && Math.abs(correctionFactor) > MIN_EFFECTIVE_CORRECTION_FACTOR;
  const adjustedEstimatedNav = hasEffectiveCorrection
    ? applyCorrectionFactor(quote.estimatedNav, correctionFactor)
    : null;
  const cooldownEndsAt = decision.status === 'failed' ? getCooldownEndsAt(decision.updatedAt) : null;
  const cooldownActive =
    decision.status === 'failed' &&
    cooldownEndsAt !== null &&
    !Number.isNaN(now) &&
    now < Date.parse(cooldownEndsAt);

  if (decision.status === 'failed' && cooldownActive) {
    return {
      mode: 'blocked',
      decisionStatus: decision.status,
      decisionUpdatedAt: decision.updatedAt,
      cooldownActive,
      cooldownEndsAt,
      scenarioKey,
      scenarioLabel,
      diagnosis,
      recommendedImprovementRate: fundInsight?.bestScenarioImprovementRate ?? null,
      correctionFactor,
      adjustedEstimatedNav: null,
      reason: '该基金修正规则在验证中失败，当前进入冷却观察期，不会自动应用到实时估值。',
    };
  }

  if (decision.status === 'watch' || decision.status === 'verification') {
    return {
      mode: 'observe',
      decisionStatus: decision.status,
      decisionUpdatedAt: decision.updatedAt,
      cooldownActive: false,
      cooldownEndsAt: null,
      scenarioKey,
      scenarioLabel,
      diagnosis,
      recommendedImprovementRate: fundInsight?.bestScenarioImprovementRate ?? null,
      correctionFactor,
      adjustedEstimatedNav: null,
      reason:
        decision.status === 'watch'
          ? '当前仅保留观察结论，先继续积累样本，不直接改写实时估值。'
          : '该基金仍在人工验证阶段，暂不自动应用修正。',
    };
  }

  if (decision.status === 'validated' && scenarioKey !== null && hasEffectiveCorrection) {
    return {
      mode: 'active',
      decisionStatus: decision.status,
      decisionUpdatedAt: decision.updatedAt,
      cooldownActive: false,
      cooldownEndsAt: null,
      scenarioKey,
      scenarioLabel,
      diagnosis,
      recommendedImprovementRate: fundInsight?.bestScenarioImprovementRate ?? null,
      correctionFactor,
      adjustedEstimatedNav,
      reason: '该基金修正规则已通过闭环验证，当前为预览启用状态。',
    };
  }

  return {
    mode: 'inactive',
    decisionStatus: decision.status,
    decisionUpdatedAt: decision.updatedAt,
    cooldownActive,
    cooldownEndsAt,
    scenarioKey,
    scenarioLabel,
    diagnosis,
    recommendedImprovementRate: fundInsight?.bestScenarioImprovementRate ?? null,
    correctionFactor,
    adjustedEstimatedNav: null,
    reason:
      decision.status === 'failed'
        ? '该基金失败冷却期已结束，但不会自动恢复修正，需要重新进入验证流程。'
        : '当前暂无可安全启用的修正因子，仍保留原始实时估值。',
  };
};

export const applyEstimateAdjustmentPolicyToQuote = (
  quote: FundQuote,
  snapshots: EstimateAccuracySnapshot[],
  decisions: Record<string, EstimateAdjustmentDecisionItem>,
  now = Date.now(),
): FundQuote => {
  const policy = buildEstimateAdjustmentPolicy(quote, snapshots, decisions, now);
  if (!policy) {
    return quote;
  }

  return {
    ...quote,
    adjustedEstimatedNav: policy.adjustedEstimatedNav,
    adjustmentApplied: policy.mode === 'active' && policy.adjustedEstimatedNav !== null,
    adjustmentPolicy: policy,
  };
};

export const applyEstimateAdjustmentPolicyToQuotes = (
  quotes: FundQuote[],
  snapshots: EstimateAccuracySnapshot[],
  decisions: Record<string, EstimateAdjustmentDecisionItem>,
  now = Date.now(),
): FundQuote[] => {
  if (quotes.length === 0 || Object.keys(decisions).length === 0) {
    return quotes;
  }

  const context = buildCorrectionContext(snapshots);

  return quotes.map((quote) => {
    const policy = buildEstimateAdjustmentPolicyFromContext(quote, decisions, context, now);
    if (!policy) {
      return quote;
    }

    return {
      ...quote,
      adjustedEstimatedNav: policy.adjustedEstimatedNav,
      adjustmentApplied: policy.mode === 'active' && policy.adjustedEstimatedNav !== null,
      adjustmentPolicy: policy,
    };
  });
};
