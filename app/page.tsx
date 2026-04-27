'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';

import { useAuthSession } from '@/lib/auth/auth-context';
import { SyncConflictDialog } from '@/components/auth/sync-conflict-dialog';
import { StatusBanner } from '@/components/shared/status-banner';
import { AddFundDialog } from '@/components/watchlist/add-fund-dialog';
import { EditPositionDialog } from '@/components/watchlist/edit-position-dialog';
import { WatchlistTable } from '@/components/watchlist/watchlist-table';
import { gradeEstimateConfidence, summarizeEstimateAccuracy } from '@/lib/funds/estimate-accuracy';
import { buildIntradayTrustSignal, resolveIntradaySignalTradingDate } from '@/lib/funds/intraday-status';
import { useIntradayAnalytics } from '@/lib/hooks/use-intraday-analytics';
import { useFundQuotes } from '@/lib/hooks/use-fund-quotes';
import { useWatchlist } from '@/lib/hooks/use-watchlist';
import {
  ESTIMATE_INTRADAY_STORAGE_KEY,
  ESTIMATE_INTRADAY_UPDATED_EVENT,
  loadEstimateIntradayPoints,
  type EstimateIntradayPointMap,
} from '@/lib/storage/estimate-intraday-storage';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

export default function HomePage() {
  const { userId, isAuthenticated, cloudClient, accuracyStore } = useAuthSession();
  const { track } = useIntradayAnalytics();
  const [editingFund, setEditingFund] = useState<WatchlistFund | null>(null);
  const [intradayPointsByCode, setIntradayPointsByCode] = useState<EstimateIntradayPointMap>(() =>
    loadEstimateIntradayPoints(),
  );
  const [syncConflictActions, setSyncConflictActions] = useState<{
    useCloud: () => void;
    useLocal: () => void;
  } | null>(null);
  const { watchlist, addFund, removeFund, updatePosition } = useWatchlist({
    userId,
    cloudClient,
    onSyncConflict: setSyncConflictActions,
  });
  const { quotes, error, isRefreshing, lastUpdatedAt, refresh } = useFundQuotes(
    watchlist.map((fund) => fund.code),
    undefined,
    undefined,
    { accuracyStore },
  );

  const quotesByCode = useMemo(
    () => Object.fromEntries(quotes.map((quote) => [quote.code, quote])),
    [quotes],
  );
  const estimateConfidenceByCode = useMemo(() => {
    const snapshots =
      typeof accuracyStore.loadSnapshots === 'function' ? accuracyStore.loadSnapshots() : [];

    return Object.fromEntries(
      watchlist.map((fund) => {
        const fundSnapshots = snapshots.filter((snapshot) => snapshot.fundCode === fund.code);

        if (fundSnapshots.length === 0) {
          return [fund.code, 'unknown'] as const;
        }

        return [fund.code, gradeEstimateConfidence(summarizeEstimateAccuracy(fundSnapshots))] as const;
      }),
    );
  }, [accuracyStore, watchlist]);
  const intradayTrustSignalsByCode = useMemo(
    () =>
      Object.fromEntries(
        watchlist.map((fund) => {
          const quote = quotesByCode[fund.code];
          const points = intradayPointsByCode[fund.code] ?? [];
          const currentTradingDate = resolveIntradaySignalTradingDate({
            quoteUpdatedAt: quote?.updatedAt ?? null,
            points,
          });

          return [
            fund.code,
            buildIntradayTrustSignal({
              points,
              quoteUpdatedAt: quote?.updatedAt ?? null,
              currentTradingDate,
              historicalConfidenceLevel: estimateConfidenceByCode[fund.code],
            }),
          ] as const;
        }),
      ),
    [estimateConfidenceByCode, intradayPointsByCode, quotesByCode, watchlist],
  );

  useEffect(() => {
    const refreshIntradayPoints = () => {
      setIntradayPointsByCode(loadEstimateIntradayPoints());
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ESTIMATE_INTRADAY_STORAGE_KEY) {
        return;
      }

      refreshIntradayPoints();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, refreshIntradayPoints);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, refreshIntradayPoints);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              SuperFinance
            </span>
            <Link
              className="text-xs font-medium text-slate-400 transition hover:text-emerald-600 hover:underline"
              href="/accuracy"
            >
              准确度看板 &rarr;
            </Link>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            基金估值监控
          </h1>
          <p className="max-w-xl text-lg text-slate-500">
            分钟级追踪自选基金估值、持仓收益与交易表现，由本地交易记录驱动。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AddFundDialog onAddFund={addFund} existingCodes={watchlist.map((fund) => fund.code)} />
          <button
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
            onClick={() => {
              track({
                eventName: 'watchlist_manual_refresh_clicked',
                page: 'home',
              });
              void refresh();
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? '正在刷新' : '手动刷新'}
          </button>
        </div>
      </header>

      {!isAuthenticated ? (
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900">启用多端同步</h3>
            <p className="mt-0.5 text-sm text-emerald-700/80">登录后可实时同步自选基金和交易记录，确保资产数据多端一致。</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-900">数据安全保护中</h3>
            <p className="mt-0.5 text-sm text-blue-700/80">已切换至交易记录驱动模式。手工持仓编辑已停用，以确保账本可追溯性。</p>
          </div>
        </div>
      )}

      <SyncConflictDialog
        open={syncConflictActions !== null}
        onChooseCloud={() => {
          syncConflictActions?.useCloud();
          setSyncConflictActions(null);
        }}
        onChooseLocal={() => {
          syncConflictActions?.useLocal();
          setSyncConflictActions(null);
        }}
      />

      <StatusBanner error={error ? '本次刷新失败，当前显示的是上次数据' : null} isRefreshing={isRefreshing} lastUpdatedAt={lastUpdatedAt} />

      <WatchlistTable
        disablePositionEditing={isAuthenticated}
        funds={watchlist}
        intradayPointsByCode={intradayPointsByCode}
        intradayTrustSignalsByCode={intradayTrustSignalsByCode}
        quotesByCode={quotesByCode}
        onEditPosition={setEditingFund}
        onRemoveFund={removeFund}
      />

      <EditPositionDialog fund={editingFund} onClose={() => setEditingFund(null)} onSave={updatePosition} />
    </main>
  );
}
