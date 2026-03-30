import type {
  FundTransaction,
  LegacyFundTransaction,
  NormalizedFundTransaction,
  PositionInput,
  SipPlan,
} from '@/lib/funds/types';

export const WATCHLIST_STORAGE_KEY = 'super-finance-watchlist';

export interface WatchlistFund {
  code: string;
  name: string;
  position?: PositionInput;
  transactions?: FundTransaction[];
  sipPlans?: SipPlan[];
}

function isLegacyTransaction(transaction: FundTransaction): transaction is LegacyFundTransaction {
  return 'tradeDate' in transaction;
}

function normalizeTransaction(transaction: FundTransaction): NormalizedFundTransaction {
  if (!isLegacyTransaction(transaction)) {
    return transaction;
  }

  const base = {
    id: transaction.id,
    type: transaction.type,
    note: transaction.note,
    fee: transaction.fee,
    placedDate: transaction.tradeDate,
    placedPeriod: 'before_1500' as const,
    effectiveDate: transaction.tradeDate,
    source: 'manual' as const,
  };

  switch (transaction.type) {
    case 'buy':
      return {
        ...base,
        type: 'buy',
        amount: transaction.amount,
        confirmedNav: transaction.nav,
      };
    case 'sell':
      return {
        ...base,
        type: 'sell',
        shares: transaction.shares,
        confirmedNav: transaction.nav,
      };
    case 'cash_dividend':
      return {
        ...base,
        type: 'cash_dividend',
        amount: transaction.amount,
      };
    case 'reinvest_dividend':
      return {
        ...base,
        type: 'reinvest_dividend',
        amount: transaction.amount,
        confirmedNav: transaction.nav,
      };
  }
}

function normalizeWatchlistFund(fund: WatchlistFund): WatchlistFund {
  return {
    ...fund,
    transactions: (fund.transactions ?? []).map(normalizeTransaction),
    sipPlans: fund.sipPlans ?? [],
  };
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
    return Array.isArray(parsed) ? parsed.map((item) => normalizeWatchlistFund(item)) : [];
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
