import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IntradayAnalyticsDebugPanel } from '@/components/accuracy/intraday-analytics-debug-panel';

const mockLoadIntradayAnalyticsEvents = vi.fn();
const mockClearIntradayAnalyticsEvents = vi.fn();
const mockWriteText = vi.fn();
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
const mockAnchorClick = vi.fn();

vi.mock('@/lib/storage/intraday-analytics-storage', () => ({
  INTRADAY_ANALYTICS_STORAGE_KEY: 'super-finance-intraday-analytics',
  INTRADAY_ANALYTICS_UPDATED_EVENT: 'super-finance-intraday-analytics-updated',
  loadIntradayAnalyticsEvents: () => mockLoadIntradayAnalyticsEvents(),
  clearIntradayAnalyticsEvents: () => mockClearIntradayAnalyticsEvents(),
}));

describe('IntradayAnalyticsDebugPanel', () => {
  beforeEach(() => {
    mockLoadIntradayAnalyticsEvents.mockReturnValue([]);
    mockClearIntradayAnalyticsEvents.mockReset();
    mockWriteText.mockReset();
    mockCreateObjectURL.mockReset();
    mockRevokeObjectURL.mockReset();
    mockAnchorClick.mockReset();

    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mockWriteText,
      },
    });
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      value: mockCreateObjectURL.mockReturnValue('blob:intraday-analytics'),
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      value: mockRevokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mockAnchorClick);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads local analytics events and renders summary, top funds, and recent activity', async () => {
    mockLoadIntradayAnalyticsEvents.mockReturnValue([
      {
        id: 'e-1',
        eventName: 'watchlist_row_viewed',
        page: 'home',
        occurredAt: '2026-04-20T10:30:00.000Z',
        fundCode: '000001',
        tradingDate: '2026-04-20',
        intradayStatus: 'ready',
        confidenceLevel: 'high',
        coverageRatio: 0.8,
        meta: null,
      },
      {
        id: 'e-2',
        eventName: 'watchlist_fund_clicked',
        page: 'home',
        occurredAt: '2026-04-20T10:31:00.000Z',
        fundCode: '000001',
        tradingDate: '2026-04-20',
        intradayStatus: 'ready',
        confidenceLevel: 'high',
        coverageRatio: 0.8,
        meta: null,
      },
      {
        id: 'e-3',
        eventName: 'watchlist_manual_refresh_clicked',
        page: 'home',
        occurredAt: '2026-04-20T10:32:00.000Z',
        fundCode: null,
        tradingDate: null,
        intradayStatus: null,
        confidenceLevel: null,
        coverageRatio: null,
        meta: null,
      },
      {
        id: 'e-4',
        eventName: 'fund_detail_viewed',
        page: 'fund_detail',
        occurredAt: '2026-04-20T10:33:00.000Z',
        fundCode: '000001',
        tradingDate: '2026-04-20',
        intradayStatus: 'generating',
        confidenceLevel: 'low',
        coverageRatio: 0.02,
        meta: null,
      },
      {
        id: 'e-5',
        eventName: 'fund_intraday_state_seen',
        page: 'fund_detail',
        occurredAt: '2026-04-20T10:34:00.000Z',
        fundCode: '000002',
        tradingDate: '2026-04-20',
        intradayStatus: 'generating',
        confidenceLevel: 'low',
        coverageRatio: 0.01,
        meta: null,
      },
    ]);

    render(<IntradayAnalyticsDebugPanel />);

    await waitFor(() => {
      expect(screen.getByText('分时行为调试')).toBeTruthy();
      expect(screen.getByTestId('intraday-analytics-summary-total').textContent).toContain('5');
    });

    expect(screen.getByTestId('intraday-analytics-summary-refresh').textContent).toContain('1');
    expect(screen.getByTestId('intraday-analytics-summary-detail').textContent).toContain('1');
    expect(screen.getByTestId('intraday-analytics-summary-top-fund').textContent).toContain('000001');

    const topFundRows = screen.getAllByTestId('intraday-analytics-top-fund-row');
    expect(topFundRows).toHaveLength(2);
    expect(within(topFundRows[0]).getByText('000001')).toBeTruthy();
    expect(topFundRows[0].textContent).toContain('000001');
    expect(topFundRows[0].textContent).toContain('111');

    const statusRows = screen.getAllByTestId('intraday-analytics-status-row');
    expect(statusRows).toHaveLength(2);
    expect(within(statusRows[0]).getByText('generating')).toBeTruthy();
    expect(within(statusRows[0]).getByText('2')).toBeTruthy();

    const eventRows = screen.getAllByTestId('intraday-analytics-event-row');
    expect(eventRows).toHaveLength(5);
    expect(within(eventRows[0]).getByText('fund_intraday_state_seen')).toBeTruthy();
    expect(within(eventRows[0]).getByText('000002')).toBeTruthy();
    expect(within(eventRows[4]).getByText('watchlist_row_viewed')).toBeTruthy();
  });

  it('refreshes from same-tab updates and lets the user clear local analytics history', async () => {
    let events = [
      {
        id: 'e-1',
        eventName: 'watchlist_manual_refresh_clicked',
        page: 'home',
        occurredAt: '2026-04-20T10:32:00.000Z',
        fundCode: null,
        tradingDate: null,
        intradayStatus: null,
        confidenceLevel: null,
        coverageRatio: null,
        meta: null,
      },
    ];

    mockLoadIntradayAnalyticsEvents.mockImplementation(() => events);
    mockClearIntradayAnalyticsEvents.mockImplementation(() => {
      events = [];
      window.dispatchEvent(new CustomEvent('super-finance-intraday-analytics-updated'));
    });

    render(<IntradayAnalyticsDebugPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('intraday-analytics-summary-total').textContent).toContain('1');
    });

    events = [
      ...events,
      {
        id: 'e-2',
        eventName: 'fund_detail_viewed',
        page: 'fund_detail',
        occurredAt: '2026-04-20T10:33:00.000Z',
        fundCode: '000001',
        tradingDate: '2026-04-20',
        intradayStatus: 'generating',
        confidenceLevel: 'low',
        coverageRatio: 0.02,
        meta: null,
      },
    ];

    window.dispatchEvent(new CustomEvent('super-finance-intraday-analytics-updated'));

    await waitFor(() => {
      expect(screen.getByTestId('intraday-analytics-summary-total').textContent).toContain('2');
    });

    fireEvent.click(screen.getByRole('button', { name: '清空分时行为记录' }));

    expect(mockClearIntradayAnalyticsEvents).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('暂无分时行为埋点记录')).toBeTruthy();
    });
  });

  it('exports local intraday analytics as a json file', async () => {
    mockLoadIntradayAnalyticsEvents.mockReturnValue([
      {
        id: 'e-1',
        eventName: 'watchlist_manual_refresh_clicked',
        page: 'home',
        occurredAt: '2026-04-20T10:32:00.000Z',
        fundCode: null,
        tradingDate: null,
        intradayStatus: null,
        confidenceLevel: null,
        coverageRatio: null,
        meta: null,
      },
    ]);

    render(<IntradayAnalyticsDebugPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('intraday-analytics-summary-total').textContent).toContain('1');
    });

    fireEvent.click(screen.getByRole('button', { name: '导出分时行为 JSON' }));

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(mockAnchorClick).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:intraday-analytics');
  });

  it('copies local intraday analytics json to clipboard', async () => {
    mockWriteText.mockResolvedValue(undefined);
    mockLoadIntradayAnalyticsEvents.mockReturnValue([
      {
        id: 'e-1',
        eventName: 'fund_detail_viewed',
        page: 'fund_detail',
        occurredAt: '2026-04-20T10:33:00.000Z',
        fundCode: '000001',
        tradingDate: '2026-04-20',
        intradayStatus: 'generating',
        confidenceLevel: 'low',
        coverageRatio: 0.02,
        meta: null,
      },
    ]);

    render(<IntradayAnalyticsDebugPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('intraday-analytics-summary-total').textContent).toContain('1');
    });

    fireEvent.click(screen.getByRole('button', { name: '复制分时行为 JSON' }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });

    expect(mockWriteText.mock.calls[0]?.[0]).toContain('"eventName": "fund_detail_viewed"');
    expect(mockWriteText.mock.calls[0]?.[0]).toContain('"totalEvents": 1');
  });
});
