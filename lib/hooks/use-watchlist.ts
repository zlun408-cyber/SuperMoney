'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { FundTransaction, PositionInput, SipPlan } from '@/lib/funds/types';
import { markSipExecutionSkippedAfterDeletion, materializeSipPlans } from '@/lib/funds/sip-plans';
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
  sipPlanMaterializeKey?: string | number | null;
}

export function useWatchlist(options: UseWatchlistOptions = {}) {
  const {
    userId = null,
    cloudClient = null,
    onSyncConflict = null,
    getNow = () => new Date().toISOString(),
    resolveSipPlanNav = null,
    sipPlanMaterializeKey = null,
  } = options;
  const [watchlist, setWatchlist] = useState<WatchlistFund[]>([]);
  const [isReady, setIsReady] = useState(false);
  const isAuthenticated = Boolean(userId && cloudClient);
  const getNowRef = useRef(getNow);
  const resolveSipPlanNavRef = useRef(resolveSipPlanNav);

  getNowRef.current = getNow;
  resolveSipPlanNavRef.current = resolveSipPlanNav;

  const persistWatchlist = useCallback(
    (nextWatchlist: WatchlistFund[]) => {
      if (isAuthenticated && userId && cloudClient) {
        void saveCloudWatchlist(cloudClient, userId, nextWatchlist);
      } else {
        saveWatchlist(nextWatchlist);
      }
    },
    [cloudClient, isAuthenticated, userId],
  );

  const materializeFundSipPlans = useCallback((fund: WatchlistFund): WatchlistFund => {
    const resolveCurrentSipPlanNav = resolveSipPlanNavRef.current;

    if (!resolveCurrentSipPlanNav || (fund.sipPlans ?? []).length === 0) {
      return fund;
    }

    const result = materializeSipPlans({
      fundId: fund.code,
      plans: fund.sipPlans ?? [],
      transactions: fund.transactions ?? [],
      executionRecords: fund.sipExecutionRecords ?? [],
      now: getNowRef.current(),
      resolveConfirmedNav: (plan) =>
        resolveCurrentSipPlanNav({
          code: fund.code,
          plan,
        }),
    });

    const hasCreatedTransactions = result.createdTransactions.length > 0;
    const hasUpdatedPlans = result.updatedPlans.some((plan, index) => plan !== (fund.sipPlans ?? [])[index]);
    const hasUpdatedExecutionRecords = result.updatedExecutionRecords.some(
      (record, index) => record !== (fund.sipExecutionRecords ?? [])[index],
    );

    if (!hasCreatedTransactions && !hasUpdatedPlans && !hasUpdatedExecutionRecords) {
      return fund;
    }

    return {
      ...fund,
      sipPlans: result.updatedPlans,
      transactions: [...(fund.transactions ?? []), ...result.createdTransactions],
      sipExecutionRecords: result.updatedExecutionRecords,
    };
  }, []);

  const materializeWatchlist = useCallback(
    (sourceWatchlist: WatchlistFund[]) => {
      const nextWatchlist = sourceWatchlist.map(materializeFundSipPlans);
      const hasChanges = nextWatchlist.some((fund, index) => fund !== sourceWatchlist[index]);

      return {
        nextWatchlist,
        hasChanges,
      };
    },
    [materializeFundSipPlans],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialWatchlist() {
      const applyLoadedWatchlist = (
        sourceWatchlist: WatchlistFund[],
        persistMode: 'cloud' | 'local' | null,
      ) => {
        const { nextWatchlist, hasChanges } = materializeWatchlist(sourceWatchlist);

        if (!cancelled) {
          setWatchlist(nextWatchlist);
          setIsReady(true);
        }

        if (!hasChanges || persistMode === null) {
          return;
        }

        if (persistMode === 'cloud' && userId && cloudClient) {
          void saveCloudWatchlist(cloudClient, userId, nextWatchlist);
          return;
        }

        if (persistMode === 'local') {
          saveWatchlist(nextWatchlist);
        }
      };

      try {
        if (isAuthenticated && userId && cloudClient) {
          const cloudWatchlist = await loadCloudWatchlist(cloudClient, userId);
          const localWatchlist = loadWatchlist();
          const hasLocalData = localWatchlist.length > 0;
          const hasCloudData = cloudWatchlist.length > 0;

          if (hasLocalData && hasCloudData && onSyncConflict) {
            onSyncConflict({
              useCloud: () => {
                applyLoadedWatchlist(cloudWatchlist, 'cloud');
              },
              useLocal: () => {
                applyLoadedWatchlist(localWatchlist, 'cloud');
              },
            });

            return;
          }

          if (hasLocalData && !hasCloudData) {
            applyLoadedWatchlist(localWatchlist, 'cloud');
            return;
          }

          applyLoadedWatchlist(cloudWatchlist, 'cloud');

          return;
        }

        applyLoadedWatchlist(loadWatchlist(), 'local');
      } catch {
        if (!cancelled) {
          setWatchlist([]);
          setIsReady(true);
        }
      }
    }

    void loadInitialWatchlist();

    return () => {
      cancelled = true;
    };
  }, [cloudClient, isAuthenticated, materializeWatchlist, onSyncConflict, userId]);

  useEffect(() => {
    if (!resolveSipPlanNavRef.current || watchlist.length === 0) {
      return;
    }

    const nextWatchlist = watchlist.map(materializeFundSipPlans);
    const hasChanges = nextWatchlist.some((fund, index) => fund !== watchlist[index]);

    if (!hasChanges) {
      return;
    }

    persistWatchlist(nextWatchlist);
    setWatchlist(nextWatchlist);
  }, [materializeFundSipPlans, persistWatchlist, sipPlanMaterializeKey, watchlist]);

  const updateWatchlist = (updater: (current: WatchlistFund[]) => WatchlistFund[]) => {
    setWatchlist((current) => {
      const nextWatchlist = updater(current).map(materializeFundSipPlans);

      persistWatchlist(nextWatchlist);

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
          ? (() => {
              const transactionToDelete = (item.transactions ?? []).find(
                (currentTransaction) => currentTransaction.id === transactionId,
              );

              return {
                ...item,
                transactions: (item.transactions ?? []).filter(
                  (currentTransaction) => currentTransaction.id !== transactionId,
                ),
                sipExecutionRecords: transactionToDelete
                  ? markSipExecutionSkippedAfterDeletion({
                      executionRecords: item.sipExecutionRecords ?? [],
                      transaction: transactionToDelete,
                      skippedAt: getNowRef.current(),
                    })
                  : item.sipExecutionRecords ?? [],
              };
            })()
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
    isReady,
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
