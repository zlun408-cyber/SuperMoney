'use client';

import React, { useEffect, useState } from 'react';

import { fetchFundSearchResults } from '@/lib/funds/search';
import type { FundSearchResult } from '@/lib/funds/types';

interface AddFundDialogProps {
  onAddFund: (fund: { code: string; name: string }) => void;
  existingCodes?: string[];
  searchFunds?: (query: string) => Promise<FundSearchResult[]>;
}

export function AddFundDialog({
  onAddFund,
  existingCodes = [],
  searchFunds = fetchFundSearchResults,
}: AddFundDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FundSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;

    async function loadResults() {
      setIsSearching(true);
      setError(null);

      try {
        const nextResults = await searchFunds(trimmedQuery);

        if (!cancelled) {
          setResults(nextResults);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setError('搜索失败，请稍后再试');
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }

    void loadResults();

    return () => {
      cancelled = true;
    };
  }, [open, query, searchFunds]);

  const handleSelectFund = (fund: FundSearchResult) => {
    if (existingCodes.includes(fund.code)) {
      return;
    }

    onAddFund({ code: fund.code, name: fund.name });
    setQuery('');
    setResults([]);
    setError(null);
    setOpen(false);
  };

  return (
    <div>
      <button className="rounded-xl bg-emerald-600 px-4 py-2 text-white" onClick={() => setOpen(true)}>
        添加基金
      </button>
      {open ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="输入基金代码或名称"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {isSearching ? <p className="text-sm text-slate-500">搜索中...</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!isSearching && !error && query.trim() && results.length === 0 ? (
            <p className="text-sm text-slate-500">没有找到这只基金，请检查代码或名称</p>
          ) : null}

          {!isSearching && results.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <ul className="divide-y divide-slate-100">
                {results.map((fund) => {
                  const isAdded = existingCodes.includes(fund.code);

                  return (
                    <li key={fund.code}>
                      <button
                        className="flex w-full items-center justify-between px-4 py-3 text-left disabled:cursor-not-allowed disabled:bg-slate-50"
                        disabled={isAdded}
                        onClick={() => handleSelectFund(fund)}
                        type="button"
                      >
                        <span>
                          <span className="block font-medium text-slate-900">{fund.name}</span>
                          <span className="block text-sm text-slate-500">
                            {fund.code} · {fund.fundType}
                          </span>
                        </span>
                        <span className="text-sm text-slate-500">{isAdded ? '已在自选中' : '添加'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-2"
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery('');
                setResults([]);
                setError(null);
                setIsSearching(false);
              }}
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
