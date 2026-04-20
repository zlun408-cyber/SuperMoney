import type { EstimateAccuracySnapshot, EstimateAdjustmentDecisionItem } from '@/lib/funds/types';

import {
  buildAccuracyCsvExportFiles,
  buildAccuracyJsonExport,
  buildZipArchive,
  type AccuracyExportSource,
  type BuildAccuracyExportInput,
} from '@/lib/accuracy/export';

interface DownloadAccuracyExportInput
  extends Pick<
    BuildAccuracyExportInput,
    'fundCodes' | 'startTradingDate' | 'endTradingDate'
  > {
    snapshots: EstimateAccuracySnapshot[];
    decisions: Record<string, EstimateAdjustmentDecisionItem>;
    source: AccuracyExportSource;
  }

const buildExportTimestamp = (now: Date = new Date()): string =>
  now.toISOString().replaceAll(':', '').replaceAll('-', '').replace('.000', '');

const toBlobSafeArrayBuffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer;

const triggerBrowserDownload = (blob: Blob, filename: string): void => {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(objectUrl);
};

export function downloadAccuracyJsonExport(input: DownloadAccuracyExportInput): void {
  const exportedAt = new Date().toISOString();
  const jsonExport = buildAccuracyJsonExport({
    snapshots: input.snapshots,
    decisions: input.decisions,
    source: input.source,
    exportedAt,
    fundCodes: input.fundCodes,
    startTradingDate: input.startTradingDate,
    endTradingDate: input.endTradingDate,
  });

  triggerBrowserDownload(
    new Blob([JSON.stringify(jsonExport, null, 2)], { type: 'application/json;charset=utf-8' }),
    `accuracy-export-${buildExportTimestamp(new Date(exportedAt))}.json`,
  );
}

export function downloadAccuracyCsvExportZip(input: DownloadAccuracyExportInput): void {
  const files = buildAccuracyCsvExportFiles({
    snapshots: input.snapshots,
    decisions: input.decisions,
    fundCodes: input.fundCodes,
    startTradingDate: input.startTradingDate,
    endTradingDate: input.endTradingDate,
  });
  const archive = buildZipArchive(files);

  triggerBrowserDownload(
    new Blob([toBlobSafeArrayBuffer(archive)], { type: 'application/zip' }),
    `accuracy-export-${buildExportTimestamp()}.zip`,
  );
}
