import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccuracyDashboard } from '@/components/accuracy/accuracy-dashboard';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

const mockLoadSnapshots = vi.fn<() => EstimateAccuracySnapshot[]>();
const mockUseAuthSession = vi.fn();
const mockDownloadAccuracyJsonExport = vi.fn();
const mockDownloadAccuracyCsvExportZip = vi.fn();

vi.mock('@/lib/auth/auth-context', () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock('@/lib/accuracy/export-download', () => ({
  downloadAccuracyJsonExport: (input: unknown) => mockDownloadAccuracyJsonExport(input),
  downloadAccuracyCsvExportZip: (input: unknown) => mockDownloadAccuracyCsvExportZip(input),
}));

describe('AccuracyDashboard export actions', () => {
  beforeEach(() => {
    mockLoadSnapshots.mockReturnValue([
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
    ]);
    mockUseAuthSession.mockReturnValue({
      isAuthenticated: true,
      userId: 'user-1',
      accuracyStore: {
        loadSnapshots: () => mockLoadSnapshots(),
        loadAdjustmentDecisions: () => ({
          '000001': {
            status: 'validated',
            updatedAt: '2026-04-14T09:00:00.000Z',
            history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
          },
        }),
        saveAdjustmentDecisions: vi.fn(),
      },
    });
    mockDownloadAccuracyJsonExport.mockReset();
    mockDownloadAccuracyCsvExportZip.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('downloads JSON and CSV exports from the dashboard header', async () => {
    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('accuracy-export-json')).toBeTruthy();
      expect(screen.getByTestId('accuracy-export-csv')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('accuracy-export-json'));
    expect(mockDownloadAccuracyJsonExport).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshots: expect.arrayContaining([
          expect.objectContaining({ fundCode: '000001' }),
        ]),
        decisions: expect.objectContaining({
          '000001': expect.objectContaining({ status: 'validated' }),
        }),
        source: {
          mode: 'cloud',
          userId: 'user-1',
        },
      }),
    );

    fireEvent.click(screen.getByTestId('accuracy-export-csv'));
    expect(mockDownloadAccuracyCsvExportZip).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshots: expect.arrayContaining([
          expect.objectContaining({ fundCode: '000001' }),
        ]),
        decisions: expect.objectContaining({
          '000001': expect.objectContaining({ status: 'validated' }),
        }),
        source: {
          mode: 'cloud',
          userId: 'user-1',
        },
      }),
    );
  });

  it('passes export filters into download actions', async () => {
    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('accuracy-export-fund-codes')).toBeTruthy();
      expect(screen.getByTestId('accuracy-export-start-date')).toBeTruthy();
      expect(screen.getByTestId('accuracy-export-end-date')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('accuracy-export-fund-codes'), {
      target: { value: '000001, 000002' },
    });
    fireEvent.change(screen.getByTestId('accuracy-export-start-date'), {
      target: { value: '2026-04-12' },
    });
    fireEvent.change(screen.getByTestId('accuracy-export-end-date'), {
      target: { value: '2026-04-13' },
    });

    fireEvent.click(screen.getByTestId('accuracy-export-json'));

    expect(mockDownloadAccuracyJsonExport).toHaveBeenCalledWith(
      expect.objectContaining({
        fundCodes: ['000001', '000002'],
        startTradingDate: '2026-04-12',
        endTradingDate: '2026-04-13',
      }),
    );
  });
});
