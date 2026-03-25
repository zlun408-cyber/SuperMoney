import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchFundQuotes, type FetchFundQuotes } from '@/lib/funds/data-source';
import type { FundCode, FundQuote } from '@/lib/funds/types';

export function useFundQuotes(
  codes: FundCode[],
  fetcher: FetchFundQuotes = fetchFundQuotes,
  refreshInterval = 60_000,
) {
  const [quotes, setQuotes] = useState<FundQuote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const previousQuotesRef = useRef<FundQuote[]>([]);
  const codesRef = useRef(codes);
  const codesKey = codes.join(',');

  codesRef.current = codes;

  const loadQuotes = useCallback(async () => {
    if (codesRef.current.length === 0) {
      setQuotes([]);
      setError(null);
      setIsRefreshing(false);
      setLastUpdatedAt(null);
      previousQuotesRef.current = [];
      return;
    }

    setIsRefreshing(true);

    try {
      const nextQuotes = await fetcher(codesRef.current);
      previousQuotesRef.current = nextQuotes;
      setQuotes(nextQuotes);
      setError(null);
      setLastUpdatedAt(nextQuotes[0]?.updatedAt ?? null);
    } catch (caughtError) {
      const previousQuotes = Array.isArray(previousQuotesRef.current) ? previousQuotesRef.current : [];
      setQuotes(previousQuotes);
      setError(caughtError instanceof Error ? caughtError.message : 'unknown error');
      setLastUpdatedAt(previousQuotes[0]?.updatedAt ?? null);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void loadQuotes();

    if (codes.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadQuotes();
    }, refreshInterval);

    return () => {
      window.clearInterval(timer);
    };
  }, [codesKey, loadQuotes, refreshInterval, codes.length]);

  return {
    quotes,
    error,
    isRefreshing,
    lastUpdatedAt,
    refresh: loadQuotes,
  };
}
