import { useEffect, useState } from 'react';

import type { PositionInput } from '@/lib/funds/types';
import { loadWatchlist, saveWatchlist, type WatchlistFund } from '@/lib/storage/watchlist-storage';

interface AddFundInput {
  code: string;
  name: string;
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistFund[]>([]);

  useEffect(() => {
    setWatchlist(loadWatchlist());
  }, []);

  const updateWatchlist = (updater: (current: WatchlistFund[]) => WatchlistFund[]) => {
    setWatchlist((current) => {
      const nextWatchlist = updater(current);
      saveWatchlist(nextWatchlist);
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

  return {
    watchlist,
    addFund,
    removeFund,
    updatePosition,
  };
}
