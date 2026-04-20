'use client';

import { useEffect, useMemo, useState } from 'react';

import { summarizeIntradayAnalyticsEvents } from '@/lib/analytics/intraday-analytics';
import {
  clearIntradayAnalyticsEvents,
  INTRADAY_ANALYTICS_STORAGE_KEY,
  INTRADAY_ANALYTICS_UPDATED_EVENT,
  loadIntradayAnalyticsEvents,
} from '@/lib/storage/intraday-analytics-storage';

const formatDateTime = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
};

const formatPercent = (value: number | null): string =>
  typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : '--';

export function IntradayAnalyticsDebugPanel() {
  const [events, setEvents] = useState(() => loadIntradayAnalyticsEvents());
  const [hasLoadedEvents, setHasLoadedEvents] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      if (cancelled) {
        return;
      }

      setEvents(loadIntradayAnalyticsEvents());
      setHasLoadedEvents(true);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== INTRADAY_ANALYTICS_STORAGE_KEY) {
        return;
      }

      refresh();
    };

    Promise.resolve().then(refresh);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(INTRADAY_ANALYTICS_UPDATED_EVENT, refresh);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(INTRADAY_ANALYTICS_UPDATED_EVENT, refresh);
    };
  }, []);

  const summary = useMemo(() => summarizeIntradayAnalyticsEvents(events), [events]);
  const topFunds = useMemo(() => summary.topFunds.slice(0, 5), [summary.topFunds]);
  const recentEvents = useMemo(
    () => [...events].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 10),
    [events],
  );
  const statusRows = useMemo(
    () =>
      Object.entries(summary.intradayStatusCounts).sort((left, right) => {
        if (right[1] !== left[1]) {
          return (right[1] ?? 0) - (left[1] ?? 0);
        }

        return left[0].localeCompare(right[0]);
      }),
    [summary.intradayStatusCounts],
  );
  const exportJsonText = useMemo(
    () =>
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          summary,
          events,
        },
        null,
        2,
      ),
    [events, summary],
  );

  const handleExportJson = () => {
    const blob = new Blob([exportJsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'intraday-analytics-debug.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(exportJsonText);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Analytics Debug</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">分时行为调试</h2>
          <p className="mt-1 text-sm text-slate-600">查看本地分时埋点汇总，确认首页 / 详情页行为是否被正确记录。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasLoadedEvents || events.length === 0}
            onClick={() => void handleCopyJson()}
            type="button"
          >
            复制分时行为 JSON
          </button>
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasLoadedEvents || events.length === 0}
            onClick={handleExportJson}
            type="button"
          >
            导出分时行为 JSON
          </button>
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasLoadedEvents || events.length === 0}
            onClick={clearIntradayAnalyticsEvents}
            type="button"
          >
            清空分时行为记录
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article
          data-testid="intraday-analytics-summary-total"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-sm text-slate-500">总事件数</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedEvents ? summary.totalEvents : '读取中'}
          </p>
        </article>
        <article
          data-testid="intraday-analytics-summary-refresh"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-sm text-slate-500">手动刷新</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedEvents ? summary.manualRefreshCount : '读取中'}
          </p>
        </article>
        <article
          data-testid="intraday-analytics-summary-detail"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-sm text-slate-500">详情访问</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedEvents ? summary.detailViewCount : '读取中'}
          </p>
        </article>
        <article
          data-testid="intraday-analytics-summary-top-fund"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-sm text-slate-500">最高活跃基金</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {hasLoadedEvents ? summary.topFunds[0]?.fundCode ?? '--' : '读取中'}
          </p>
        </article>
      </div>

      {!hasLoadedEvents ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          正在读取本地分时行为记录…
        </div>
      ) : events.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          暂无分时行为埋点记录
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">最近事件</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  data-testid="intraday-analytics-event-row"
                  className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.4fr_88px_96px_88px_72px]"
                >
                  <div>
                    <p className="font-medium text-slate-900">{event.eventName}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(event.occurredAt)}</p>
                  </div>
                  <div className="text-slate-600">{event.page}</div>
                  <div className="text-slate-600">{event.fundCode ?? '--'}</div>
                  <div className="text-slate-600">{event.intradayStatus ?? '--'}</div>
                  <div className="text-right text-slate-500">{formatPercent(event.coverageRatio)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">活跃基金</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {topFunds.map((fund) => (
                  <div
                    key={fund.fundCode}
                    data-testid="intraday-analytics-top-fund-row"
                    className="grid grid-cols-[1fr_64px_64px_64px] gap-2 px-4 py-3 text-sm"
                  >
                    <div className="font-medium text-slate-900">{fund.fundCode}</div>
                    <div className="text-right text-slate-600">{fund.rowViewCount}</div>
                    <div className="text-right text-slate-600">{fund.detailViewCount}</div>
                    <div className="text-right text-slate-600">{fund.clickCount}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">状态分布</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {statusRows.map(([status, count]) => (
                  <div
                    key={status}
                    data-testid="intraday-analytics-status-row"
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-slate-900">{status}</span>
                    <span className="text-slate-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
