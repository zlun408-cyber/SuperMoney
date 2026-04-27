import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccuracyImportDialog } from '@/components/accuracy/accuracy-import-dialog';
import type { AccuracyStore } from '@/lib/accuracy/accuracy-store';
import { AccuracyImportValidationError } from '@/lib/accuracy/import';

function buildAccuracyStore(overrides: Partial<AccuracyStore> = {}): AccuracyStore {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    loadSnapshots: vi.fn(() => []),
    saveSnapshots: vi.fn(),
    upsertSnapshots: vi.fn(() => []),
    loadAdjustmentDecisions: vi.fn(() => ({})),
    saveAdjustmentDecisions: vi.fn(),
    dryRunImport: vi.fn(),
    applyImport: vi.fn(),
    ...overrides,
  };
}

describe('AccuracyImportDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows validation issues when dry-run import fails contract validation', async () => {
    const accuracyStore = buildAccuracyStore({
      dryRunImport: vi.fn(() => {
        throw new AccuracyImportValidationError([
          {
            path: 'snapshots[0].tradingDate',
            message: 'tradingDate must match the trading date derived from quoteUpdatedAt',
          },
        ]);
      }),
    });

    render(
      <AccuracyImportDialog
        open
        onClose={vi.fn()}
        accuracyStore={accuracyStore}
        onImportSuccess={vi.fn()}
      />,
    );

    const fileInput = screen.getByTestId('accuracy-import-file-input') as HTMLInputElement;
    const file = new File([
      JSON.stringify({ schemaVersion: 'accuracy-export/v1', source: { app: 'SuperFinance', mode: 'local' } }),
    ], 'accuracy.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(JSON.stringify({ schemaVersion: 'accuracy-export/v1', source: { app: 'SuperFinance', mode: 'local' } })),
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('accuracy-import-error')).toBeTruthy();
    });

    expect(screen.getByText('tradingDate must match the trading date derived from quoteUpdatedAt')).toBeTruthy();
    expect(screen.getByText('snapshots[0].tradingDate: tradingDate must match the trading date derived from quoteUpdatedAt')).toBeTruthy();
    expect(accuracyStore.applyImport).not.toHaveBeenCalled();
  });

  it('renders dry-run summary and confirms append-only import', async () => {
    const onClose = vi.fn();
    const onImportSuccess = vi.fn();
    const accuracyStore = buildAccuracyStore({
      dryRunImport: vi.fn(() => ({
        strategy: 'appendOnly',
        importData: {
          schemaVersion: 'accuracy-export/v1',
          source: { app: 'SuperFinance', mode: 'local' },
          snapshots: [],
          decisions: {},
        },
        summary: {
          strategy: 'appendOnly',
          snapshots: { total: 3, new: 1, upgraded: 1, duplicate: 1, conflict: 0, applied: 2 },
          decisions: { total: 2, new: 1, upgraded: 0, duplicate: 1, conflict: 0, applied: 1 },
          fundCount: 2,
          dateRange: {
            startTradingDate: '2026-04-10',
            endTradingDate: '2026-04-12',
          },
        },
      })),
      applyImport: vi.fn(() => ({
        strategy: 'appendOnly',
        importData: {
          schemaVersion: 'accuracy-export/v1',
          source: { app: 'SuperFinance', mode: 'local' },
          snapshots: [],
          decisions: {},
        },
        summary: {
          strategy: 'appendOnly',
          snapshots: { total: 3, new: 1, upgraded: 1, duplicate: 1, conflict: 0, applied: 2 },
          decisions: { total: 2, new: 1, upgraded: 0, duplicate: 1, conflict: 0, applied: 1 },
          fundCount: 2,
          dateRange: {
            startTradingDate: '2026-04-10',
            endTradingDate: '2026-04-12',
          },
        },
        nextSnapshots: [],
        nextDecisions: {},
      })),
    });

    render(
      <AccuracyImportDialog
        open
        onClose={onClose}
        accuracyStore={accuracyStore}
        onImportSuccess={onImportSuccess}
      />,
    );

    const fileInput = screen.getByTestId('accuracy-import-file-input') as HTMLInputElement;
    const file = new File([
      JSON.stringify({ schemaVersion: 'accuracy-export/v1', source: { app: 'SuperFinance', mode: 'local' } }),
    ], 'accuracy.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(JSON.stringify({ schemaVersion: 'accuracy-export/v1', source: { app: 'SuperFinance', mode: 'local' } })),
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('accuracy-import-summary')).toBeTruthy();
    });

    expect(screen.getByText('只追加/补全')).toBeTruthy();
    expect(screen.getByText('2026-04-10 至 2026-04-12')).toBeTruthy();

    fireEvent.click(screen.getByTestId('accuracy-import-confirm'));

    await waitFor(() => {
      expect(accuracyStore.applyImport).toHaveBeenCalledTimes(1);
    });

    expect(onImportSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshots: expect.objectContaining({ new: 1, upgraded: 1 }),
        decisions: expect.objectContaining({ new: 1 }),
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
