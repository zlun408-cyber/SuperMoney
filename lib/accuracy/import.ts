import type {
  AccuracyJsonExport,
  AccuracyJsonExportAdjustmentDecisionItem,
  AccuracyJsonExportSnapshotItem,
} from '@/lib/accuracy/export';
import { deriveTradingDateFromQuoteUpdatedAt } from '@/lib/funds/estimate-accuracy';
import type {
  EstimateAccuracySnapshot,
  EstimateAdjustmentDecisionItem,
} from '@/lib/funds/types';
import { upsertEstimateAccuracySnapshots } from '@/lib/storage/estimate-accuracy-storage';
import { normalizeEstimateAdjustmentDecisionItem } from '@/lib/storage/estimate-adjustment-storage';

export interface AccuracyImportSource {
  app: 'SuperFinance';
  mode: 'local' | 'cloud';
  userId?: string | null;
}

export interface AccuracyImportData {
  schemaVersion: 'accuracy-export/v1';
  source: AccuracyImportSource;
  snapshots: EstimateAccuracySnapshot[];
  decisions: Record<string, EstimateAdjustmentDecisionItem>;
}

export interface AccuracyImportValidationIssue {
  path: string;
  message: string;
}

export class AccuracyImportValidationError extends Error {
  readonly issues: AccuracyImportValidationIssue[];

  constructor(issues: AccuracyImportValidationIssue[]) {
    super(issues[0]?.message ?? 'Invalid accuracy import payload');
    this.name = 'AccuracyImportValidationError';
    this.issues = issues;
  }
}

export interface AccuracyImportSectionSummary {
  total: number;
  new: number;
  upgraded: number;
  duplicate: number;
  conflict: number;
  applied: number;
}

export interface AccuracyImportSummary {
  strategy: 'appendOnly';
  snapshots: AccuracyImportSectionSummary;
  decisions: AccuracyImportSectionSummary;
  fundCount: number;
  dateRange: {
    startTradingDate: string | null;
    endTradingDate: string | null;
  };
}

export interface AccuracyImportDryRunResult {
  strategy: 'appendOnly';
  importData: AccuracyImportData;
  summary: AccuracyImportSummary;
}

export interface AccuracyImportApplyResult extends AccuracyImportDryRunResult {
  nextSnapshots: EstimateAccuracySnapshot[];
  nextDecisions: Record<string, EstimateAdjustmentDecisionItem>;
}

const LOCAL_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const ABSOLUTE_TIME_FORMAT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const TRADING_DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

const isAbsoluteTime = (value: unknown): value is string =>
  typeof value === 'string' && ABSOLUTE_TIME_FORMAT.test(value) && !Number.isNaN(Date.parse(value));

const isValidLocalTime = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const match = value.match(LOCAL_TIME_FORMAT);
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

const isLocalOrAbsoluteTime = (value: unknown): value is string =>
  isValidLocalTime(value) || isAbsoluteTime(value);

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const pushIssue = (
  issues: AccuracyImportValidationIssue[],
  path: string,
  message: string,
): void => {
  issues.push({ path, message });
};

const isResolvedSnapshot = (snapshot: EstimateAccuracySnapshot): boolean =>
  snapshot.finalNav !== null &&
  snapshot.absoluteErrorRate !== null &&
  snapshot.resolvedAt !== null;

const isSnapshotBaseCompatible = (
  left: EstimateAccuracySnapshot,
  right: EstimateAccuracySnapshot,
): boolean =>
  left.id === right.id &&
  left.fundCode === right.fundCode &&
  left.quoteUpdatedAt === right.quoteUpdatedAt &&
  left.tradingDate === right.tradingDate &&
  left.estimatedNav === right.estimatedNav;

const hasResolvedFactsConflict = (
  left: EstimateAccuracySnapshot,
  right: EstimateAccuracySnapshot,
): boolean =>
  left.finalNav !== right.finalNav || left.absoluteErrorRate !== right.absoluteErrorRate;

const sortDecisionHistory = (
  history: EstimateAdjustmentDecisionItem['history'],
): EstimateAdjustmentDecisionItem['history'] =>
  [...history].sort((a, b) => {
    const timeDelta = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return a.status.localeCompare(b.status);
  });

export const mergeAdjustmentDecisionHistories = (
  left: EstimateAdjustmentDecisionItem['history'],
  right: EstimateAdjustmentDecisionItem['history'],
): EstimateAdjustmentDecisionItem['history'] => {
  const byKey = new Map<string, EstimateAdjustmentDecisionItem['history'][number]>();

  for (const item of [...left, ...right]) {
    byKey.set(`${item.status}::${item.updatedAt}`, item);
  }

  return sortDecisionHistory(Array.from(byKey.values()));
};

export const mergeEstimateAdjustmentDecisions = (
  left: Record<string, EstimateAdjustmentDecisionItem>,
  right: Record<string, EstimateAdjustmentDecisionItem>,
): Record<string, EstimateAdjustmentDecisionItem> => {
  const fundCodes = new Set([...Object.keys(left), ...Object.keys(right)]);

  return Array.from(fundCodes).reduce<Record<string, EstimateAdjustmentDecisionItem>>(
    (accumulator, fundCode) => {
      const leftDecision = left[fundCode];
      const rightDecision = right[fundCode];

      if (!leftDecision) {
        if (rightDecision) {
          accumulator[fundCode] = rightDecision;
        }
        return accumulator;
      }

      if (!rightDecision) {
        accumulator[fundCode] = leftDecision;
        return accumulator;
      }

      const mergedHistory = mergeAdjustmentDecisionHistories(
        leftDecision.history,
        rightDecision.history,
      );
      const leftUpdatedAt = Date.parse(leftDecision.updatedAt);
      const rightUpdatedAt = Date.parse(rightDecision.updatedAt);
      const current = rightUpdatedAt >= leftUpdatedAt ? rightDecision : leftDecision;

      accumulator[fundCode] = {
        status: current.status,
        updatedAt: current.updatedAt,
        history: mergedHistory,
      };

      return accumulator;
    },
    {},
  );
};

const areDecisionItemsEqual = (
  left: EstimateAdjustmentDecisionItem,
  right: EstimateAdjustmentDecisionItem,
): boolean =>
  left.status === right.status &&
  left.updatedAt === right.updatedAt &&
  JSON.stringify(sortDecisionHistory(left.history)) === JSON.stringify(sortDecisionHistory(right.history));

const validateSource = (source: unknown, issues: AccuracyImportValidationIssue[]): source is AccuracyImportSource => {
  if (!isRecord(source)) {
    pushIssue(issues, 'source', 'source must be an object');
    return false;
  }

  if (source.app !== 'SuperFinance') {
    pushIssue(issues, 'source.app', 'source.app must be SuperFinance');
  }

  if (source.mode !== 'local' && source.mode !== 'cloud') {
    pushIssue(issues, 'source.mode', 'source.mode must be local or cloud');
  }

  if (!(source.userId === undefined || source.userId === null || isNonEmptyString(source.userId))) {
    pushIssue(issues, 'source.userId', 'source.userId must be a non-empty string, null, or undefined');
  }

  return issues.length === 0;
};

const mapImportSnapshot = (
  item: AccuracyJsonExportSnapshotItem,
): EstimateAccuracySnapshot => ({
  id: item.snapshotKey,
  fundCode: item.fundCode,
  fundName: item.fundName,
  quoteUpdatedAt: item.quoteUpdatedAt,
  tradingDate: item.tradingDate,
  estimatedNav: item.estimatedNav,
  finalNav: item.finalNav,
  absoluteErrorRate: item.absoluteErrorRate,
  resolvedAt: item.resolvedAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const validateSnapshotItem = (
  item: unknown,
  index: number,
  issues: AccuracyImportValidationIssue[],
): item is AccuracyJsonExportSnapshotItem => {
  const path = `snapshots[${index}]`;
  if (!isRecord(item)) {
    pushIssue(issues, path, 'snapshot must be an object');
    return false;
  }

  if (!isNonEmptyString(item.snapshotKey)) {
    pushIssue(issues, `${path}.snapshotKey`, 'snapshotKey is required');
  }
  if (!isNonEmptyString(item.fundCode)) {
    pushIssue(issues, `${path}.fundCode`, 'fundCode is required');
  }
  if (!isNonEmptyString(item.fundName)) {
    pushIssue(issues, `${path}.fundName`, 'fundName is required');
  }
  if (!isNonEmptyString(item.quoteUpdatedAt) || !isLocalOrAbsoluteTime(item.quoteUpdatedAt)) {
    pushIssue(issues, `${path}.quoteUpdatedAt`, 'quoteUpdatedAt must be a supported local or absolute timestamp');
  }
  if (!isValidTradingDate(item.tradingDate)) {
    pushIssue(issues, `${path}.tradingDate`, 'tradingDate must be a valid YYYY-MM-DD date');
  }
  if (!isFiniteNumber(item.estimatedNav)) {
    pushIssue(issues, `${path}.estimatedNav`, 'estimatedNav must be a finite number');
  }
  if (!isNullableFiniteNumber(item.finalNav)) {
    pushIssue(issues, `${path}.finalNav`, 'finalNav must be a finite number or null');
  }
  if (!isNullableFiniteNumber(item.absoluteErrorRate)) {
    pushIssue(issues, `${path}.absoluteErrorRate`, 'absoluteErrorRate must be a finite number or null');
  }
  if (!(item.resolvedAt === null || isLocalOrAbsoluteTime(item.resolvedAt))) {
    pushIssue(issues, `${path}.resolvedAt`, 'resolvedAt must be null or a valid timestamp');
  }
  if (!isLocalOrAbsoluteTime(item.createdAt)) {
    pushIssue(issues, `${path}.createdAt`, 'createdAt must be a valid timestamp');
  }
  if (!isLocalOrAbsoluteTime(item.updatedAt)) {
    pushIssue(issues, `${path}.updatedAt`, 'updatedAt must be a valid timestamp');
  }

  const hasResolvedFields = item.finalNav !== null || item.absoluteErrorRate !== null || item.resolvedAt !== null;
  const resolvedFieldsComplete =
    item.finalNav !== null && item.absoluteErrorRate !== null && item.resolvedAt !== null;
  if (hasResolvedFields && !resolvedFieldsComplete) {
    pushIssue(
      issues,
      path,
      'resolved snapshots must provide finalNav, absoluteErrorRate, and resolvedAt together',
    );
  }

  if (
    isNonEmptyString(item.quoteUpdatedAt) &&
    isValidTradingDate(item.tradingDate) &&
    deriveTradingDateFromQuoteUpdatedAt(item.quoteUpdatedAt) !== item.tradingDate
  ) {
    pushIssue(
      issues,
      `${path}.tradingDate`,
      'tradingDate must match the trading date derived from quoteUpdatedAt',
    );
  }

  return issues.length === 0;
};

const validateDecisionItem = (
  item: unknown,
  index: number,
  issues: AccuracyImportValidationIssue[],
): item is AccuracyJsonExportAdjustmentDecisionItem => {
  const path = `adjustmentDecisions[${index}]`;
  if (!isRecord(item)) {
    pushIssue(issues, path, 'adjustmentDecision must be an object');
    return false;
  }

  if (!isNonEmptyString(item.fundCode)) {
    pushIssue(issues, `${path}.fundCode`, 'fundCode is required');
  }

  if (!isNonEmptyString(item.fundName)) {
    pushIssue(issues, `${path}.fundName`, 'fundName is required');
  }

  const normalized = normalizeEstimateAdjustmentDecisionItem({
    status: item.status,
    updatedAt: item.updatedAt,
    history: item.history,
  });

  if (!normalized) {
    pushIssue(issues, path, 'adjustmentDecision must contain a valid status, updatedAt, and history');
    return false;
  }

  return true;
};

export function parseAccuracyImport(input: unknown): AccuracyImportData {
  const issues: AccuracyImportValidationIssue[] = [];

  if (!isRecord(input)) {
    throw new AccuracyImportValidationError([
      {
        path: 'root',
        message: 'accuracy import payload must be an object',
      },
    ]);
  }

  if (input.schemaVersion !== 'accuracy-export/v1') {
    pushIssue(issues, 'schemaVersion', 'schemaVersion must be accuracy-export/v1');
  }

  validateSource(input.source, issues);

  if (!Array.isArray(input.snapshots)) {
    pushIssue(issues, 'snapshots', 'snapshots must be an array');
  }

  if (!Array.isArray(input.adjustmentDecisions)) {
    pushIssue(issues, 'adjustmentDecisions', 'adjustmentDecisions must be an array');
  }

  if (issues.length > 0) {
    throw new AccuracyImportValidationError(issues);
  }

  const snapshotIssues: AccuracyImportValidationIssue[] = [];
  const snapshots = (input.snapshots as unknown[]).map((item, index) => {
    const before = snapshotIssues.length;
    if (!validateSnapshotItem(item, index, snapshotIssues)) {
      return null;
    }

    if (snapshotIssues.length > before) {
      return null;
    }

    return mapImportSnapshot(item);
  });

  const decisionIssues: AccuracyImportValidationIssue[] = [];
  const decisions = (input.adjustmentDecisions as unknown[]).reduce<
    Record<string, EstimateAdjustmentDecisionItem>
  >((accumulator, item, index) => {
    const before = decisionIssues.length;
    if (!validateDecisionItem(item, index, decisionIssues)) {
      return accumulator;
    }

    if (decisionIssues.length > before) {
      return accumulator;
    }

    const normalized = normalizeEstimateAdjustmentDecisionItem({
      status: item.status,
      updatedAt: item.updatedAt,
      history: item.history,
    });

    if (!normalized) {
      return accumulator;
    }

    const fundCode = item.fundCode;
    const existing = accumulator[fundCode];
    if (!existing) {
      accumulator[fundCode] = normalized;
      return accumulator;
    }

    accumulator[fundCode] = mergeEstimateAdjustmentDecisions(
      { [fundCode]: existing },
      { [fundCode]: normalized },
    )[fundCode] as EstimateAdjustmentDecisionItem;
    return accumulator;
  }, {});

  if (snapshotIssues.length > 0 || decisionIssues.length > 0) {
    throw new AccuracyImportValidationError([...snapshotIssues, ...decisionIssues]);
  }

  const source = isRecord(input.source) ? input.source : null;

  return {
    schemaVersion: 'accuracy-export/v1',
    source: {
      app: 'SuperFinance',
      mode: source?.mode === 'cloud' ? 'cloud' : 'local',
      userId: typeof source?.userId === 'string' ? source.userId : undefined,
    },
    snapshots: snapshots.filter(
      (snapshot): snapshot is EstimateAccuracySnapshot => snapshot !== null,
    ),
    decisions,
  };
}

type SnapshotImportStatus = 'new' | 'upgraded' | 'duplicate' | 'conflict';
type DecisionImportStatus = 'new' | 'upgraded' | 'duplicate' | 'conflict';

const classifySnapshotImport = (
  existing: EstimateAccuracySnapshot | undefined,
  incoming: EstimateAccuracySnapshot,
): SnapshotImportStatus => {
  if (!existing) {
    return 'new';
  }

  if (!isSnapshotBaseCompatible(existing, incoming)) {
    return 'conflict';
  }

  const existingResolved = isResolvedSnapshot(existing);
  const incomingResolved = isResolvedSnapshot(incoming);

  if (!existingResolved && incomingResolved) {
    return 'upgraded';
  }

  if (existingResolved && !incomingResolved) {
    return 'duplicate';
  }

  if (existingResolved && incomingResolved) {
    return hasResolvedFactsConflict(existing, incoming) ? 'conflict' : 'duplicate';
  }

  return 'duplicate';
};

const classifyDecisionImport = (
  existing: EstimateAdjustmentDecisionItem | undefined,
  incoming: EstimateAdjustmentDecisionItem,
): DecisionImportStatus => {
  if (!existing) {
    return 'new';
  }

  if (existing.updatedAt === incoming.updatedAt && existing.status !== incoming.status) {
    return 'conflict';
  }

  const merged = mergeEstimateAdjustmentDecisions(
    { current: existing },
    { current: incoming },
  ).current;

  if (!merged || areDecisionItemsEqual(existing, merged)) {
    return 'duplicate';
  }

  return 'upgraded';
};

const incrementSectionSummary = (
  summary: AccuracyImportSectionSummary,
  status: SnapshotImportStatus | DecisionImportStatus,
): AccuracyImportSectionSummary => ({
  ...summary,
  [status]: summary[status] + 1,
  applied: summary.applied + (status === 'new' || status === 'upgraded' ? 1 : 0),
});

const buildEmptySectionSummary = (total: number): AccuracyImportSectionSummary => ({
  total,
  new: 0,
  upgraded: 0,
  duplicate: 0,
  conflict: 0,
  applied: 0,
});

const mergeSnapshotsAppendOnly = (
  currentSnapshots: EstimateAccuracySnapshot[],
  importedSnapshots: EstimateAccuracySnapshot[],
): { nextSnapshots: EstimateAccuracySnapshot[]; summary: AccuracyImportSectionSummary } => {
  let nextSnapshots = [...currentSnapshots];
  let summary = buildEmptySectionSummary(importedSnapshots.length);
  const existingById = new Map(currentSnapshots.map((snapshot) => [snapshot.id, snapshot] as const));

  for (const incoming of importedSnapshots) {
    const existing = existingById.get(incoming.id);
    const status = classifySnapshotImport(existing, incoming);
    summary = incrementSectionSummary(summary, status);

    if (status === 'new' || status === 'upgraded') {
      nextSnapshots = upsertEstimateAccuracySnapshots(nextSnapshots, incoming);
      existingById.set(incoming.id, incoming);
    }
  }

  return {
    nextSnapshots,
    summary,
  };
};

const mergeDecisionsAppendOnly = (
  currentDecisions: Record<string, EstimateAdjustmentDecisionItem>,
  importedDecisions: Record<string, EstimateAdjustmentDecisionItem>,
): {
  nextDecisions: Record<string, EstimateAdjustmentDecisionItem>;
  summary: AccuracyImportSectionSummary;
} => {
  const nextDecisions = { ...currentDecisions };
  let summary = buildEmptySectionSummary(Object.keys(importedDecisions).length);

  for (const [fundCode, incoming] of Object.entries(importedDecisions)) {
    const existing = nextDecisions[fundCode];
    const status = classifyDecisionImport(existing, incoming);
    summary = incrementSectionSummary(summary, status);

    if (status === 'new') {
      nextDecisions[fundCode] = incoming;
      continue;
    }

    if (status === 'upgraded') {
      nextDecisions[fundCode] = mergeEstimateAdjustmentDecisions(
        { [fundCode]: existing as EstimateAdjustmentDecisionItem },
        { [fundCode]: incoming },
      )[fundCode] as EstimateAdjustmentDecisionItem;
    }
  }

  return {
    nextDecisions,
    summary,
  };
};

const buildFundCount = (
  snapshots: EstimateAccuracySnapshot[],
  decisions: Record<string, EstimateAdjustmentDecisionItem>,
): number =>
  new Set([
    ...snapshots.map((snapshot) => snapshot.fundCode),
    ...Object.keys(decisions),
  ]).size;

const buildDateRange = (snapshots: EstimateAccuracySnapshot[]): AccuracyImportSummary['dateRange'] => {
  if (snapshots.length === 0) {
    return {
      startTradingDate: null,
      endTradingDate: null,
    };
  }

  const tradingDates = snapshots.map((snapshot) => snapshot.tradingDate).sort((a, b) => a.localeCompare(b));
  return {
    startTradingDate: tradingDates[0] ?? null,
    endTradingDate: tradingDates[tradingDates.length - 1] ?? null,
  };
};

const buildImportSummary = (
  importData: AccuracyImportData,
  snapshotSummary: AccuracyImportSectionSummary,
  decisionSummary: AccuracyImportSectionSummary,
): AccuracyImportSummary => ({
  strategy: 'appendOnly',
  snapshots: snapshotSummary,
  decisions: decisionSummary,
  fundCount: buildFundCount(importData.snapshots, importData.decisions),
  dateRange: buildDateRange(importData.snapshots),
});

export function dryRunAccuracyImport(input: {
  payload: unknown;
  currentSnapshots: EstimateAccuracySnapshot[];
  currentDecisions: Record<string, EstimateAdjustmentDecisionItem>;
}): AccuracyImportDryRunResult {
  const importData = parseAccuracyImport(input.payload);
  const { summary: snapshotSummary } = mergeSnapshotsAppendOnly(
    input.currentSnapshots,
    importData.snapshots,
  );
  const { summary: decisionSummary } = mergeDecisionsAppendOnly(
    input.currentDecisions,
    importData.decisions,
  );

  return {
    strategy: 'appendOnly',
    importData,
    summary: buildImportSummary(importData, snapshotSummary, decisionSummary),
  };
}

export function applyAccuracyImport(input: {
  payload: unknown;
  currentSnapshots: EstimateAccuracySnapshot[];
  currentDecisions: Record<string, EstimateAdjustmentDecisionItem>;
}): AccuracyImportApplyResult {
  const importData = parseAccuracyImport(input.payload);
  const { nextSnapshots, summary: snapshotSummary } = mergeSnapshotsAppendOnly(
    input.currentSnapshots,
    importData.snapshots,
  );
  const { nextDecisions, summary: decisionSummary } = mergeDecisionsAppendOnly(
    input.currentDecisions,
    importData.decisions,
  );

  return {
    strategy: 'appendOnly',
    importData,
    nextSnapshots,
    nextDecisions,
    summary: buildImportSummary(importData, snapshotSummary, decisionSummary),
  };
}
