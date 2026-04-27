import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccuracyDashboard } from '@/components/accuracy/accuracy-dashboard';
import type { EstimateAccuracySnapshot, EstimateAdjustmentDecisionItem } from '@/lib/funds/types';

const mockUseAuthSession = vi.fn();

vi.mock('@/lib/auth/auth-context', () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

describe('AccuracyDashboard import integration', () => {
  let snapshotsState: EstimateAccuracySnapshot[];
  let decisionsState: Record<string, EstimateAdjustmentDecisionItem>;
  let accuracyStore: {
    loadSnapshots: () => EstimateAccuracySnapshot[];
    loadAdjustmentDecisions: () => Record<string, EstimateAdjustmentDecisionItem>;
    saveAdjustmentDecisions: ReturnType<typeof vi.fn>;
    dryRunImport: ReturnType<typeof vi.fn>;
    applyImport: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    snapshotsState = [];
    decisionsState = {};
    accuracyStore = {
      loadSnapshots: () => snapshotsState,
      loadAdjustmentDecisions: () => decisionsState,
      saveAdjustmentDecisions: vi.fn(),
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
          snapshots: { total: 1, new: 1, upgraded: 0, duplicate: 0, conflict: 0, applied: 1 },
          decisions: { total: 1, new: 1, upgraded: 0, duplicate: 0, conflict: 0, applied: 1 },
          fundCount: 1,
          dateRange: {
            startTradingDate: '2026-04-13',
            endTradingDate: '2026-04-13',
          },
        },
      })),
      applyImport: vi.fn(() => {
        snapshotsState = [
          {
            id: '000001::2026-04-13 14:30',
            fundCode: '000001',
            fundName: '基金A',
            quoteUpdatedAt: '2026-04-13 14:30',
            tradingDate: '2026-04-13',
            estimatedNav: 1.02,
            finalNav: 1,
            absoluteErrorRate: 0.02,
            resolvedAt: '2026-04-13T15:30:00.000Z',
            createdAt: '2026-04-13 14:30',
            updatedAt: '2026-04-13T15:30:00.000Z',
          },
        ];
        decisionsState = {
          '000001': {
            status: 'validated',
            updatedAt: '2026-04-14T09:00:00.000Z',
            history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
          },
        };

        return {
          strategy: 'appendOnly',
          importData: {
            schemaVersion: 'accuracy-export/v1',
            source: { app: 'SuperFinance', mode: 'local' },
            snapshots: snapshotsState,
            decisions: decisionsState,
          },
          summary: {
            strategy: 'appendOnly',
            snapshots: { total: 1, new: 1, upgraded: 0, duplicate: 0, conflict: 0, applied: 1 },
            decisions: { total: 1, new: 1, upgraded: 0, duplicate: 0, conflict: 0, applied: 1 },
            fundCount: 1,
            dateRange: {
              startTradingDate: '2026-04-13',
              endTradingDate: '2026-04-13',
            },
          },
          nextSnapshots: snapshotsState,
          nextDecisions: decisionsState,
        };
      }),
    };

    mockUseAuthSession.mockReturnValue({
      isAuthenticated: false,
      userId: null,
      accuracyStore,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the import dialog and refreshes dashboard data after a successful append-only import', async () => {
    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getByText('暂无估值准确度样本')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('accuracy-import-json-trigger'));

    expect(screen.getByTestId('accuracy-import-dialog')).toBeTruthy();

    const file = new File([
      JSON.stringify({ schemaVersion: 'accuracy-export/v1', source: { app: 'SuperFinance', mode: 'local' } }),
    ], 'accuracy.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(JSON.stringify({ schemaVersion: 'accuracy-export/v1', source: { app: 'SuperFinance', mode: 'local' } })),
    });

    fireEvent.change(screen.getByTestId('accuracy-import-file-input'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('accuracy-import-summary')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('accuracy-import-confirm'));

    await waitFor(() => {
      expect(accuracyStore.applyImport).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('accuracy-import-success-toast')).toBeTruthy();
      expect(screen.getAllByTestId('accuracy-fund-row')).toHaveLength(1);
    });

    expect(screen.getByText('导入成功：新增 1 条样本，1 条决策。系统已自动合并数据。')).toBeTruthy();
    const fundRow = screen.getAllByTestId('accuracy-fund-row')[0];
    expect(within(fundRow).getByText('000001')).toBeTruthy();
    expect(within(fundRow).getByText('基金A')).toBeTruthy();
    expect(screen.queryByTestId('accuracy-import-dialog')).toBeNull();
  });
});
