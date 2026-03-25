import { useEffect, useRef, useState } from 'react';

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
  const codesKey = codes.join(',');

  useEffect(() => {
    if (codes.length === 0) {
      setQuotes([]);
      setError(null);
      setIsRefreshing(false);
      setLastUpdatedAt(null);
      previousQuotesRef.current = [];
      return;
    }

    let active = true;

    const loadQuotes = async () => {
      setIsRefreshing(true);

      try {
        const nextQuotes = await fetcher(codes);

        if (!active) {
          return;
        }

        previousQuotesRef.current = nextQuotes;
        setQuotes(nextQuotes);
        setError(null);
        setLastUpdatedAt(nextQuotes[0]?.updatedAt ?? null);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        const previousQuotes = previousQuotesRef.current ?? [];
        setQuotes(previousQuotes);
        setError(caughtError instanceof Error ? caughtError.message : 'unknown error');
        setLastUpdatedAt(previousQuotes[0]?.updatedAt ?? null);
      } finally {
        if (active) {
          setIsRefreshing(false);
        }
      }
    };

    void loadQuotes();
    const timer = window.setInterval(() => {
      void loadQuotes();
    }, refreshInterval);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [codesKey, fetcher, refreshInterval]);

  return {
    quotes,
    error,
    isRefreshing,
    lastUpdatedAt,
  };
}
