'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';

import { useAuthSession } from '@/lib/auth/auth-context';
import { SyncConflictDialog } from '@/components/auth/sync-conflict-dialog';
import { StatusBanner } from '@/components/shared/status-banner';
import { AddFundDialog } from '@/components/watchlist/add-fund-dialog';
import { EditPositionDialog } from '@/components/watchlist/edit-position-dialog';
import { WatchlistTable } from '@/components/watchlist/watchlist-table';
import { useFundQuotes } from '@/lib/hooks/use-fund-quotes';
import { useWatchlist } from '@/lib/hooks/use-watchlist';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

export default function HomePage() {
  const { userId, isAuthenticated, cloudClient } = useAuthSession();
  const [editingFund, setEditingFund] = useState<WatchlistFund | null>(null);
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
  );

  const quotesByCode = useMemo(
    () => Object.fromEntries(quotes.map((quote) => [quote.code, quote])),
    [quotes],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-600">SuperFinance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">基金实时估值监控</h1>
          <p className="mt-2 text-slate-600">先聚焦自选基金列表，分钟级查看估值、持仓与估算盈亏。</p>
          <p className="mt-2 text-sm text-slate-500">
            <Link className="transition hover:text-slate-700 hover:underline" href="/accuracy">
              查看估值准确度看板
            </Link>
          </p>
        </div>
        <div className="flex gap-3">
          <AddFundDialog onAddFund={addFund} existingCodes={watchlist.map((fund) => fund.code)} />
          <button className="rounded-xl border border-slate-300 bg-white px-4 py-2" onClick={() => void refresh()}>
            手动刷新
          </button>
        </div>
      </header>

      {!isAuthenticated ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          登录后可同步自选基金和交易记录，换设备也能继续使用。
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          已登录账号请使用交易记录维护持仓与收益，手工持仓编辑已停用。
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
        quotesByCode={quotesByCode}
        onEditPosition={setEditingFund}
        onRemoveFund={removeFund}
      />

      <EditPositionDialog fund={editingFund} onClose={() => setEditingFund(null)} onSave={updatePosition} />
    </main>
  );
}
