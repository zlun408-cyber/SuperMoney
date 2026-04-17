export type FundCode = string;

export interface PositionInput {
  amount?: number;
  cost?: number;
  estimatedNav?: number;
  shares?: number;
}

export interface PositionSummary {
  isComputable: boolean;
  currentValue: number | null;
  profit: number | null;
}

export interface FundQuote {
  code: FundCode;
  name: string;
  estimatedNav: number;
  changeRate: number;
  updatedAt: string;
  adjustedEstimatedNav?: number | null;
  adjustmentApplied?: boolean;
  adjustmentPolicy?: EstimateAdjustmentPolicy | null;
}

export interface FundSearchResult {
  code: FundCode;
  name: string;
  category: string;
  fundType: string;
}

export type NavCacheSource = 'api' | 'cache' | 'manual';

export interface NavCacheEntry {
  fundCode: string;
  date: string;
  nav: number;
  updatedAt: string;
  source: NavCacheSource;
}

export type FundTransactionType = 'buy' | 'sell' | 'cash_dividend' | 'reinvest_dividend';
export type FundTradePeriod = 'before_1500' | 'after_1500';
export type FundTransactionSource = 'manual' | 'sip_plan';
export type SipPlanFrequency = 'daily' | 'weekly' | 'monthly';
export type SipPlanStatus = 'active' | 'paused' | 'ended';

export interface FundTransactionBase {
  id: string;
  type: FundTransactionType;
  note?: string;
  fee?: number;
}

export interface LegacyBuyTransaction extends FundTransactionBase {
  type: 'buy';
  tradeDate: string;
  amount: number;
  nav: number;
}

export interface LegacySellTransaction extends FundTransactionBase {
  type: 'sell';
  tradeDate: string;
  shares: number;
  nav: number;
}

export interface LegacyCashDividendTransaction extends FundTransactionBase {
  type: 'cash_dividend';
  tradeDate: string;
  amount: number;
}

export interface LegacyReinvestDividendTransaction extends FundTransactionBase {
  type: 'reinvest_dividend';
  tradeDate: string;
  amount: number;
  nav: number;
}

export type LegacyFundTransaction =
  | LegacyBuyTransaction
  | LegacySellTransaction
  | LegacyCashDividendTransaction
  | LegacyReinvestDividendTransaction;

export interface NormalizedFundTransactionBase extends FundTransactionBase {
  placedDate: string;
  placedPeriod: FundTradePeriod;
  effectiveDate: string;
  source: FundTransactionSource;
  sourcePlanId?: string;
}

export interface BuyTransaction extends NormalizedFundTransactionBase {
  type: 'buy';
  amount: number;
  confirmedNav: number;
}

export interface SellTransaction extends NormalizedFundTransactionBase {
  type: 'sell';
  shares: number;
  confirmedNav: number;
}

export interface CashDividendTransaction extends NormalizedFundTransactionBase {
  type: 'cash_dividend';
  amount: number;
}

export interface ReinvestDividendTransaction extends NormalizedFundTransactionBase {
  type: 'reinvest_dividend';
  amount: number;
  confirmedNav: number;
}

export type NormalizedFundTransaction =
  | BuyTransaction
  | SellTransaction
  | CashDividendTransaction
  | ReinvestDividendTransaction;

export type FundTransaction = LegacyFundTransaction | NormalizedFundTransaction;

export type SipExecutionStatus = 'pending' | 'generated' | 'skipped';

export interface SipExecutionRecord {
  id: string;
  planId: string;
  fundId: string;
  executionDate: string;
  status: SipExecutionStatus;
  transactionId?: string;
  generatedAt?: string;
  skippedAt?: string;
  skipReason?: 'deleted_generated_transaction';
  createdAt: string;
  updatedAt: string;
}

export interface SipPlan {
  id: string;
  name?: string;
  amount: number;
  frequency: SipPlanFrequency;
  startDate: string;
  endDate?: string;
  executionTime: string;
  executionPeriod: FundTradePeriod;
  status: SipPlanStatus;
  lastExecutedAt?: string;
  nextExecutionAt?: string;
}

export interface TransactionLedgerSummary {
  currentShares: number;
  currentCost: number;
  averageCost: number;
  realizedProfit: number;
  unrealizedProfit: number;
  totalDividends: number;
}

export interface EstimateAccuracySnapshot {
  id: string;
  fundCode: string;
  fundName: string;
  quoteUpdatedAt: string;
  tradingDate: string;
  estimatedNav: number;
  finalNav: number | null;
  absoluteErrorRate: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EstimateConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface EstimateAccuracySummary {
  fundCode: string;
  sampleCount: number;
  resolvedSampleCount: number;
  resolvedTradingDayCount: number;
  highErrorResolvedSampleCount: number;
  averageAbsoluteErrorRate: number | null;
  latestQuoteUpdatedAt: string | null;
  latestResolvedAt: string | null;
}

export type EstimateAdjustmentDecisionStatus =
  | 'verification'
  | 'watch'
  | 'dismissed'
  | 'validated'
  | 'failed';

export interface EstimateAdjustmentDecisionHistoryItem {
  status: EstimateAdjustmentDecisionStatus;
  updatedAt: string;
}

export interface EstimateAdjustmentDecisionItem {
  status: EstimateAdjustmentDecisionStatus;
  updatedAt: string;
  history: EstimateAdjustmentDecisionHistoryItem[];
}

export type EstimateAdjustmentScenarioKey = 'global' | 'late-session' | 'diagnosis-aware';
export type EstimateAdjustmentPolicyMode = 'active' | 'observe' | 'blocked' | 'inactive';
export type EstimateAdjustmentDiagnosis = '持续偏高' | '持续偏低' | '波动偏差' | '样本不足';

export interface EstimateAdjustmentPolicy {
  mode: EstimateAdjustmentPolicyMode;
  decisionStatus: EstimateAdjustmentDecisionStatus | null;
  decisionUpdatedAt: string | null;
  cooldownActive: boolean;
  cooldownEndsAt: string | null;
  validationRecommendationStatus?: 'keep' | 'review' | 'downgrade';
  validationRecommendationLabel?: string | null;
  validationRecommendationReason?: string | null;
  scenarioKey: EstimateAdjustmentScenarioKey | null;
  scenarioLabel: string | null;
  diagnosis: EstimateAdjustmentDiagnosis | null;
  recommendedImprovementRate: number | null;
  correctionFactor: number | null;
  adjustedEstimatedNav: number | null;
  reason: string;
}
