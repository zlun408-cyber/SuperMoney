import {
  gradeEstimateConfidence,
  summarizeEstimateAccuracy,
} from '@/lib/funds/estimate-accuracy';
import { summarizeEstimateAccuracyDiagnostics } from '@/lib/funds/estimate-accuracy-diagnostics';
import type {
  EstimateAccuracyDiagnosticItem,
} from '@/lib/funds/estimate-accuracy-diagnostics';
import type {
  EstimateAccuracySnapshot,
  EstimateAdjustmentDecisionItem,
} from '@/lib/funds/types';

export interface AccuracyExportSource {
  mode: 'local' | 'cloud';
  userId?: string | null;
}

export interface BuildAccuracyExportInput {
  snapshots: EstimateAccuracySnapshot[];
  decisions: Record<string, EstimateAdjustmentDecisionItem>;
  source: AccuracyExportSource;
  exportedAt?: string;
  fundCodes?: string[] | null;
  startTradingDate?: string | null;
  endTradingDate?: string | null;
  includeDerived?: boolean;
}

export interface AccuracyJsonExportSnapshotItem {
  snapshotKey: string;
  fundCode: string;
  fundName: string;
  quoteUpdatedAt: string;
  quoteUpdatedAtUtc: string;
  quoteTimeSemantics: 'china_local' | 'absolute';
  tradingDate: string;
  estimatedNav: number;
  finalNav: number | null;
  absoluteErrorRate: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
}

export interface AccuracyJsonExportFundSummaryItem {
  fundCode: string;
  fundName: string;
  sampleCount: number;
  resolvedSampleCount: number;
  resolvedTradingDayCount: number;
  highErrorResolvedSampleCount: number;
  averageAbsoluteErrorRate: number | null;
  latestQuoteUpdatedAt: string | null;
  latestResolvedAt: string | null;
  confidenceLevel: 'high' | 'medium' | 'low' | 'unknown';
}

export interface AccuracyJsonExportAdjustmentDecisionItem {
  fundCode: string;
  fundName: string;
  status: EstimateAdjustmentDecisionItem['status'];
  updatedAt: string;
  history: EstimateAdjustmentDecisionItem['history'];
}

export interface AccuracyJsonExport {
  schemaVersion: 'accuracy-export/v1';
  exportedAt: string;
  source: {
    app: 'SuperFinance';
    mode: AccuracyExportSource['mode'];
    userId?: string;
  };
  filters: {
    fundCodes: string[] | null;
    startTradingDate: string | null;
    endTradingDate: string | null;
    includeDerived: boolean;
  };
  snapshots: AccuracyJsonExportSnapshotItem[];
  fundSummaries: AccuracyJsonExportFundSummaryItem[];
  diagnostics: EstimateAccuracyDiagnosticItem[];
  adjustmentDecisions: AccuracyJsonExportAdjustmentDecisionItem[];
}

export interface AccuracyCsvFile {
  name: string;
  content: string;
}

const LOCAL_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const CHINA_MARKET_TIMEZONE_OFFSET_HOURS = 8;

const normalizeQuoteTimestamp = (
  value: string,
): { utc: string; semantics: 'china_local' | 'absolute' } => {
  const localMatch = value.match(LOCAL_TIME_FORMAT);
  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    const timestamp = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - CHINA_MARKET_TIMEZONE_OFFSET_HOURS,
      Number(minute),
      0,
      0,
    );

    return {
      utc: new Date(timestamp).toISOString(),
      semantics: 'china_local',
    };
  }

  return {
    utc: new Date(value).toISOString(),
    semantics: 'absolute',
  };
};

const groupSnapshotsByFund = (
  snapshots: EstimateAccuracySnapshot[],
): Map<string, EstimateAccuracySnapshot[]> =>
  snapshots.reduce((accumulator, snapshot) => {
    const current = accumulator.get(snapshot.fundCode) ?? [];
    current.push(snapshot);
    accumulator.set(snapshot.fundCode, current);
    return accumulator;
  }, new Map<string, EstimateAccuracySnapshot[]>());

const roundNullableNumber = (value: number | null): number | null =>
  value === null ? null : Number(value.toFixed(8));

const buildExportSnapshots = (
  snapshots: EstimateAccuracySnapshot[],
): AccuracyJsonExportSnapshotItem[] =>
  [...snapshots]
    .sort((left, right) => {
      if (left.fundCode !== right.fundCode) {
        return left.fundCode.localeCompare(right.fundCode);
      }

      if (left.tradingDate !== right.tradingDate) {
        return left.tradingDate.localeCompare(right.tradingDate);
      }

      return left.quoteUpdatedAt.localeCompare(right.quoteUpdatedAt);
    })
    .map((snapshot) => {
      const normalizedQuoteUpdatedAt = normalizeQuoteTimestamp(snapshot.quoteUpdatedAt);

      return {
        snapshotKey: snapshot.id,
        fundCode: snapshot.fundCode,
        fundName: snapshot.fundName,
        quoteUpdatedAt: snapshot.quoteUpdatedAt,
        quoteUpdatedAtUtc: normalizedQuoteUpdatedAt.utc,
        quoteTimeSemantics: normalizedQuoteUpdatedAt.semantics,
        tradingDate: snapshot.tradingDate,
        estimatedNav: snapshot.estimatedNav,
        finalNav: snapshot.finalNav,
        absoluteErrorRate: snapshot.absoluteErrorRate,
        resolvedAt: snapshot.resolvedAt,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        resolved: snapshot.finalNav !== null && snapshot.resolvedAt !== null,
      };
    });

const buildExportFundSummaries = (
  snapshots: EstimateAccuracySnapshot[],
): AccuracyJsonExportFundSummaryItem[] =>
  Array.from(groupSnapshotsByFund(snapshots).entries())
    .sort(([leftFundCode], [rightFundCode]) => leftFundCode.localeCompare(rightFundCode))
    .map(([fundCode, fundSnapshots]) => {
      const summary = summarizeEstimateAccuracy(fundSnapshots);

      return {
        fundCode,
        fundName: fundSnapshots[0]?.fundName ?? fundCode,
        sampleCount: summary.sampleCount,
        resolvedSampleCount: summary.resolvedSampleCount,
        resolvedTradingDayCount: summary.resolvedTradingDayCount,
        highErrorResolvedSampleCount: summary.highErrorResolvedSampleCount,
        averageAbsoluteErrorRate: roundNullableNumber(summary.averageAbsoluteErrorRate),
        latestQuoteUpdatedAt: summary.latestQuoteUpdatedAt,
        latestResolvedAt: summary.latestResolvedAt,
        confidenceLevel: gradeEstimateConfidence(summary),
      };
    });

const buildExportAdjustmentDecisions = (
  snapshots: EstimateAccuracySnapshot[],
  decisions: Record<string, EstimateAdjustmentDecisionItem>,
): AccuracyJsonExportAdjustmentDecisionItem[] => {
  const fundNamesByCode = new Map<string, string>();
  for (const snapshot of snapshots) {
    if (!fundNamesByCode.has(snapshot.fundCode)) {
      fundNamesByCode.set(snapshot.fundCode, snapshot.fundName);
    }
  }

  return Object.entries(decisions)
    .sort(([leftFundCode], [rightFundCode]) => leftFundCode.localeCompare(rightFundCode))
    .map(([fundCode, decision]) => ({
      fundCode,
      fundName: fundNamesByCode.get(fundCode) ?? fundCode,
      status: decision.status,
      updatedAt: decision.updatedAt,
      history: decision.history,
    }));
};

const applyFilters = (
  snapshots: EstimateAccuracySnapshot[],
  decisions: Record<string, EstimateAdjustmentDecisionItem>,
  fundCodes: string[] | null,
  startTradingDate: string | null,
  endTradingDate: string | null,
): {
  snapshots: EstimateAccuracySnapshot[];
  decisions: Record<string, EstimateAdjustmentDecisionItem>;
} => {
  const hasFundCodeFilter = fundCodes !== null && fundCodes.length > 0;
  const hasDateFilter = Boolean(startTradingDate || endTradingDate);
  if (!hasFundCodeFilter && !hasDateFilter) {
    return {
      snapshots,
      decisions,
    };
  }

  const fundCodeSet = new Set(fundCodes ?? []);
  const filteredSnapshots = snapshots.filter((snapshot) => {
    if (hasFundCodeFilter && !fundCodeSet.has(snapshot.fundCode)) {
      return false;
    }

    if (startTradingDate && snapshot.tradingDate < startTradingDate) {
      return false;
    }

    if (endTradingDate && snapshot.tradingDate > endTradingDate) {
      return false;
    }

    return true;
  });
  const decisionFundCodeSet = hasFundCodeFilter
    ? fundCodeSet
    : new Set(filteredSnapshots.map((snapshot) => snapshot.fundCode));

  return {
    snapshots: filteredSnapshots,
    decisions: Object.fromEntries(
      Object.entries(decisions).filter(([fundCode]) => decisionFundCodeSet.has(fundCode)),
    ),
  };
};

export function buildAccuracyJsonExport(
  input: BuildAccuracyExportInput,
): AccuracyJsonExport {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const includeDerived = input.includeDerived ?? true;
  const fundCodes = input.fundCodes ?? null;
  const startTradingDate = input.startTradingDate ?? null;
  const endTradingDate = input.endTradingDate ?? null;
  const filtered = applyFilters(
    input.snapshots,
    input.decisions,
    fundCodes,
    startTradingDate,
    endTradingDate,
  );
  const exportedSnapshots = buildExportSnapshots(filtered.snapshots);
  const exportedDecisions = buildExportAdjustmentDecisions(
    filtered.snapshots,
    filtered.decisions,
  );

  return {
    schemaVersion: 'accuracy-export/v1',
    exportedAt,
    source: {
      app: 'SuperFinance',
      mode: input.source.mode,
      ...(input.source.userId ? { userId: input.source.userId } : {}),
    },
    filters: {
      fundCodes,
      startTradingDate,
      endTradingDate,
      includeDerived,
    },
    snapshots: exportedSnapshots,
    fundSummaries: includeDerived ? buildExportFundSummaries(filtered.snapshots) : [],
    diagnostics: includeDerived
      ? summarizeEstimateAccuracyDiagnostics(filtered.snapshots, Number.MAX_SAFE_INTEGER).map(
          (diagnostic) => ({
            ...diagnostic,
            averageAbsoluteErrorRate: roundNullableNumber(diagnostic.averageAbsoluteErrorRate),
            averageSignedErrorRate: roundNullableNumber(diagnostic.averageSignedErrorRate),
            priorityScore: roundNullableNumber(diagnostic.priorityScore) ?? diagnostic.priorityScore,
            worstAbsoluteErrorRate: roundNullableNumber(diagnostic.worstAbsoluteErrorRate),
          }),
        )
      : [],
    adjustmentDecisions: exportedDecisions,
  };
}

const escapeCsvCell = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

const toCsvCell = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }

  return escapeCsvCell(String(value));
};

const buildCsv = (header: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string =>
  [header.join(','), ...rows.map((row) => row.map(toCsvCell).join(','))].join('\n');

export function buildAccuracyCsvExportFiles(
  input: Omit<BuildAccuracyExportInput, 'source' | 'exportedAt'>,
): AccuracyCsvFile[] {
  const exportData = buildAccuracyJsonExport({
    ...input,
    source: { mode: 'local' },
    exportedAt: '1970-01-01T00:00:00.000Z',
  });

  return [
    {
      name: 'accuracy_snapshots.csv',
      content: buildCsv(
        [
          'snapshot_key',
          'fund_code',
          'fund_name',
          'quote_updated_at_raw',
          'quote_updated_at_utc',
          'quote_time_semantics',
          'trading_date',
          'estimated_nav',
          'final_nav',
          'absolute_error_rate',
          'resolved_at',
          'created_at',
          'updated_at',
          'resolved',
        ],
        exportData.snapshots.map((snapshot) => [
          snapshot.snapshotKey,
          snapshot.fundCode,
          snapshot.fundName,
          snapshot.quoteUpdatedAt,
          snapshot.quoteUpdatedAtUtc,
          snapshot.quoteTimeSemantics,
          snapshot.tradingDate,
          snapshot.estimatedNav,
          snapshot.finalNav,
          snapshot.absoluteErrorRate,
          snapshot.resolvedAt,
          snapshot.createdAt,
          snapshot.updatedAt,
          snapshot.resolved,
        ]),
      ),
    },
    {
      name: 'accuracy_fund_summaries.csv',
      content: buildCsv(
        [
          'fund_code',
          'fund_name',
          'sample_count',
          'resolved_sample_count',
          'resolved_trading_day_count',
          'high_error_resolved_sample_count',
          'average_absolute_error_rate',
          'latest_quote_updated_at',
          'latest_resolved_at',
          'confidence_level',
        ],
        exportData.fundSummaries.map((summary) => [
          summary.fundCode,
          summary.fundName,
          summary.sampleCount,
          summary.resolvedSampleCount,
          summary.resolvedTradingDayCount,
          summary.highErrorResolvedSampleCount,
          summary.averageAbsoluteErrorRate,
          summary.latestQuoteUpdatedAt,
          summary.latestResolvedAt,
          summary.confidenceLevel,
        ]),
      ),
    },
    {
      name: 'accuracy_diagnostics.csv',
      content: buildCsv(
        [
          'fund_code',
          'fund_name',
          'sample_count',
          'computable_sample_count',
          'average_absolute_error_rate',
          'average_signed_error_rate',
          'overestimated_count',
          'underestimated_count',
          'diagnosis',
          'priority_score',
          'worst_trading_date',
          'worst_absolute_error_rate',
        ],
        exportData.diagnostics.map((diagnostic) => [
          diagnostic.fundCode,
          diagnostic.fundName,
          diagnostic.sampleCount,
          diagnostic.computableSampleCount,
          diagnostic.averageAbsoluteErrorRate,
          diagnostic.averageSignedErrorRate,
          diagnostic.overestimatedCount,
          diagnostic.underestimatedCount,
          diagnostic.diagnosis,
          diagnostic.priorityScore,
          diagnostic.worstTradingDate,
          diagnostic.worstAbsoluteErrorRate,
        ]),
      ),
    },
    {
      name: 'accuracy_adjustment_decisions.csv',
      content: buildCsv(
        ['fund_code', 'fund_name', 'status', 'updated_at', 'history_count'],
        exportData.adjustmentDecisions.map((decision) => [
          decision.fundCode,
          decision.fundName,
          decision.status,
          decision.updatedAt,
          decision.history.length,
        ]),
      ),
    },
    {
      name: 'accuracy_adjustment_decision_history.csv',
      content: buildCsv(
        ['fund_code', 'status', 'updated_at', 'sequence'],
        exportData.adjustmentDecisions.flatMap((decision) =>
          decision.history.map((historyItem, index) => [
            decision.fundCode,
            historyItem.status,
            historyItem.updatedAt,
            index + 1,
          ]),
        ),
      ),
    },
  ];
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

const crc32 = (input: Uint8Array): number => {
  let crc = 0xffffffff;

  for (const byte of input) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const pushUint16 = (target: number[], value: number): void => {
  target.push(value & 0xff, (value >>> 8) & 0xff);
};

const pushUint32 = (target: number[], value: number): void => {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
};

const getDosDateTime = (date: Date): { date: number; time: number } => {
  const year = Math.max(date.getUTCFullYear(), 1980);
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getUTCMonth() + 1) << 5) |
    date.getUTCDate();
  const dosTime =
    (date.getUTCHours() << 11) |
    (date.getUTCMinutes() << 5) |
    Math.floor(date.getUTCSeconds() / 2);

  return { date: dosDate, time: dosTime };
};

export function buildZipArchive(files: AccuracyCsvFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const now = getDosDateTime(new Date());
  const localFileChunks: number[] = [];
  const centralDirectoryChunks: number[] = [];
  let offset = 0;

  for (const file of files) {
    const fileNameBytes = encoder.encode(file.name);
    const fileBytes = encoder.encode(file.content);
    const fileCrc32 = crc32(fileBytes);

    pushUint32(localFileChunks, 0x04034b50);
    pushUint16(localFileChunks, 20);
    pushUint16(localFileChunks, 0);
    pushUint16(localFileChunks, 0);
    pushUint16(localFileChunks, now.time);
    pushUint16(localFileChunks, now.date);
    pushUint32(localFileChunks, fileCrc32);
    pushUint32(localFileChunks, fileBytes.length);
    pushUint32(localFileChunks, fileBytes.length);
    pushUint16(localFileChunks, fileNameBytes.length);
    pushUint16(localFileChunks, 0);
    localFileChunks.push(...fileNameBytes, ...fileBytes);

    pushUint32(centralDirectoryChunks, 0x02014b50);
    pushUint16(centralDirectoryChunks, 20);
    pushUint16(centralDirectoryChunks, 20);
    pushUint16(centralDirectoryChunks, 0);
    pushUint16(centralDirectoryChunks, 0);
    pushUint16(centralDirectoryChunks, now.time);
    pushUint16(centralDirectoryChunks, now.date);
    pushUint32(centralDirectoryChunks, fileCrc32);
    pushUint32(centralDirectoryChunks, fileBytes.length);
    pushUint32(centralDirectoryChunks, fileBytes.length);
    pushUint16(centralDirectoryChunks, fileNameBytes.length);
    pushUint16(centralDirectoryChunks, 0);
    pushUint16(centralDirectoryChunks, 0);
    pushUint16(centralDirectoryChunks, 0);
    pushUint16(centralDirectoryChunks, 0);
    pushUint32(centralDirectoryChunks, 0);
    pushUint32(centralDirectoryChunks, offset);
    centralDirectoryChunks.push(...fileNameBytes);

    offset += 30 + fileNameBytes.length + fileBytes.length;
  }

  const centralDirectoryOffset = localFileChunks.length;
  const centralDirectorySize = centralDirectoryChunks.length;
  const endOfCentralDirectory: number[] = [];
  pushUint32(endOfCentralDirectory, 0x06054b50);
  pushUint16(endOfCentralDirectory, 0);
  pushUint16(endOfCentralDirectory, 0);
  pushUint16(endOfCentralDirectory, files.length);
  pushUint16(endOfCentralDirectory, files.length);
  pushUint32(endOfCentralDirectory, centralDirectorySize);
  pushUint32(endOfCentralDirectory, centralDirectoryOffset);
  pushUint16(endOfCentralDirectory, 0);

  return Uint8Array.from([
    ...localFileChunks,
    ...centralDirectoryChunks,
    ...endOfCentralDirectory,
  ]);
}
