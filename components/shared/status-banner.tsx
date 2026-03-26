import React from 'react';

interface StatusBannerProps {
  error: string | null;
  isRefreshing: boolean;
  lastUpdatedAt: string | null;
}

export function StatusBanner({ error, isRefreshing, lastUpdatedAt }: StatusBannerProps) {
  if (!error && !isRefreshing && !lastUpdatedAt) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
      {error ? <p>{error}</p> : null}
      {!error && isRefreshing ? <p>正在刷新最新估值…</p> : null}
      {lastUpdatedAt ? <p>最近更新时间：{new Date(lastUpdatedAt).toLocaleString('zh-CN')}</p> : null}
    </div>
  );
}
