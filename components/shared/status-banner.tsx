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
    <div className={`flex flex-col gap-2 rounded-2xl border px-5 py-3 text-sm shadow-sm transition md:flex-row md:items-center md:justify-between ${
      error ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'
    }`}>
      <div className="flex items-center gap-3">
        {isRefreshing ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="font-medium">正在获取最新估值…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>所有数据已是最新</span>
          </div>
        )}
      </div>

      {lastUpdatedAt && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>上次更新</span>
          <span className="font-mono">{new Date(lastUpdatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      )}
    </div>
  );
}
