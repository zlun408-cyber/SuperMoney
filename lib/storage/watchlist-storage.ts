import type { FundTransaction, PositionInput } from '@/lib/funds/types';

export const WATCHLIST_STORAGE_KEY = 'super-finance-watchlist';

export interface WatchlistFund {
  code: string;
  name: string;
  position?: PositionInput;
  transactions?: FundTransaction[];
}

export function loadWatchlist(): WatchlistFund[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawValue = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(watchlist: WatchlistFund[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
}
