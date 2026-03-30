'use client';

import { useEffect, useState } from 'react';

import type { FundTransaction, PositionInput, SipPlan } from '@/lib/funds/types';
import { materializeSipPlans } from '@/lib/funds/sip-plans';
import {
  loadCloudWatchlist,
  saveCloudWatchlist,
  type CloudWatchlistClient,
} from '@/lib/sync/cloud-watchlist';
import { loadWatchlist, saveWatchlist, type WatchlistFund } from '@/lib/storage/watchlist-storage';

interface AddFundInput {
  code: string;
  name: string;
}

interface UseWatchlistOptions {
  userId?: string | null;
  cloudClient?: CloudWatchlistClient | null;
  onSyncConflict?: ((actions: { useCloud: () => void; useLocal: () => void }) => void) | null;
  getNow?: () => string;
  resolveSipPlanNav?: ((args: { code: string; plan: SipPlan }) => number | null) | null;
}

export function useWatchlist(options: UseWatchlistOptions = {}) {
  const {
    userId = null,
    cloudClient = null,
    onSyncConflict = null,
    getNow = () => new Date().toISOString(),
    resolveSipPlanNav = null,
  } = options;
  const [watchlist, setWatchlist] = useState<WatchlistFund[]>([]);
  const isAuthenticated = Boolean(userId && cloudClient);

  const materializeFundSipPlans = (fund: WatchlistFund): WatchlistFund => {
    if (!resolveSipPlanNav || (fund.sipPlans ?? []).length === 0) {
      return fund;
    }

    const result = materializeSipPlans({
      plans: fund.sipPlans ?? [],
      transactions: fund.transactions ?? [],
      now: getNow(),
      resolveConfirmedNav: (plan) =>
        resolveSipPlanNav({
          code: fund.code,
          plan,
        }),
    });

    const hasCreatedTransactions = result.createdTransactions.length > 0;
    const hasUpdatedPlans = result.updatedPlans.some((plan, index) => plan !== (fund.sipPlans ?? [])[index]);

    if (!hasCreatedTransactions && !hasUpdatedPlans) {
      return fund;
    }

    return {
      ...fund,
      sipPlans: result.updatedPlans,
      transactions: [...(fund.transactions ?? []), ...result.createdTransactions],
    };
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialWatchlist() {
      if (isAuthenticated && userId && cloudClient) {
        const cloudWatchlist = await loadCloudWatchlist(cloudClient, userId);
        const localWatchlist = loadWatchlist();
        const hasLocalData = localWatchlist.length > 0;
        const hasCloudData = cloudWatchlist.length > 0;

        if (hasLocalData && hasCloudData && onSyncConflict) {
          onSyncConflict({
            useCloud: () => {
              if (!cancelled) {
                setWatchlist(cloudWatchlist);
              }
            },
            useLocal: () => {
              if (!cancelled) {
                setWatchlist(localWatchlist);
              }

              void saveCloudWatchlist(cloudClient, userId, localWatchlist);
            },
          });

          return;
        }

        if (hasLocalData && !hasCloudData) {
          if (!cancelled) {
            setWatchlist(localWatchlist);
          }

          void saveCloudWatchlist(cloudClient, userId, localWatchlist);
          return;
        }

        if (!cancelled) {
          setWatchlist(cloudWatchlist);
        }

        return;
      }

      if (!cancelled) {
        setWatchlist(loadWatchlist());
      }
    }

    void loadInitialWatchlist();

    return () => {
      cancelled = true;
    };
  }, [cloudClient, isAuthenticated, onSyncConflict, userId]);

  const updateWatchlist = (updater: (current: WatchlistFund[]) => WatchlistFund[]) => {
    setWatchlist((current) => {
      const nextWatchlist = updater(current).map(materializeFundSipPlans);

      if (isAuthenticated && userId && cloudClient) {
        void saveCloudWatchlist(cloudClient, userId, nextWatchlist);
      } else {
        saveWatchlist(nextWatchlist);
      }

      return nextWatchlist;
    });
  };

  const addFund = (fund: AddFundInput) => {
    updateWatchlist((current) => {
      if (current.some((item) => item.code === fund.code)) {
        return current;
      }

      return [...current, fund];
    });
  };

  const removeFund = (code: string) => {
    updateWatchlist((current) => current.filter((item) => item.code !== code));
  };

  const updatePosition = (code: string, position: PositionInput) => {
    updateWatchlist((current) =>
      current.map((item) =>
        item.code === code
          ? {
              ...item,
              position,
            }
          : item,
      ),
    );
  };

  const addTransaction = (code: string, transaction: FundTransaction) => {
    updateWatchlist((current) =>
      current.map((item) =>
        item.code === code
          ? {
              ...item,
              transactions: [...(item.transactions ?? []), transaction],
            }
          : item,
      ),
    );
  };

  const updateTransaction = (code: string, transactionId: string, transaction: FundTransaction) => {
    updateWatchlist((current) =>
      current.map((item) =>
        item.code === code
          ? {
              ...item,
              transactions: (item.transactions ?? []).map((currentTransaction) =>
                currentTransaction.id === transactionId ? transaction : currentTransaction,
              ),
            }
          : item,
      ),
    );
  };

  const removeTransaction = (code: string, transactionId: string) => {
    updateWatchlist((current) =>
      current.map((item) =>
        item.code === code
          ? {
              ...item,
              transactions: (item.transactions ?? []).filter(
                (currentTransaction) => currentTransaction.id !== transactionId,
              ),
            }
          : item,
      ),
    );
  };

  const addSipPlan = (code: string, plan: SipPlan) => {
    updateWatchlist((current) =>
      current.map((item) =>
        item.code === code
          ? {
              ...item,
              sipPlans: [...(item.sipPlans ?? []), plan],
            }
          : item,
      ),
    );
  };

  return {
    watchlist,
    isAuthenticated,
    addFund,
    removeFund,
    updatePosition,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addSipPlan,
  };
}
