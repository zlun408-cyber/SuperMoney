import type { SupabaseClient } from '@supabase/supabase-js';

import type { FundTransaction } from '@/lib/funds/types';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

export interface CloudFundRecord {
  id: string;
  userId: string;
  code: string;
  name: string;
  createdAt: string;
}

export interface CloudFundInput {
  code: string;
  name: string;
}

export interface CloudTransactionRecord {
  id: string;
  userId: string;
  fundId: string;
  type: FundTransaction['type'];
  tradeDate: string;
  amount?: number;
  shares?: number;
  nav?: number;
  fee?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudTransactionInput {
  id: string;
  userId: string;
  fundId: string;
  type: FundTransaction['type'];
  tradeDate: string;
  amount?: number;
  shares?: number;
  nav?: number;
  fee?: number;
  note?: string;
}

export interface CloudWatchlistClient {
  listFunds(userId: string): Promise<CloudFundRecord[]>;
  listTransactions(userId: string): Promise<CloudTransactionRecord[]>;
  replaceFunds(userId: string, funds: CloudFundInput[]): Promise<CloudFundRecord[]>;
  replaceTransactions(userId: string, transactions: CloudTransactionInput[]): Promise<void>;
}

export function createSupabaseCloudWatchlistClient(client: SupabaseClient): CloudWatchlistClient {
  const pendingFundsByUser = new Map<string, CloudFundInput[]>();

  return {
    async listFunds(userId) {
      const { data, error } = await client
        .from('watchlist_funds')
        .select('id, user_id, code, name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []).map((fund) => ({
        id: fund.id,
        userId: fund.user_id,
        code: fund.code,
        name: fund.name,
        createdAt: fund.created_at,
      }));
    },
    async listTransactions(userId) {
      const { data, error } = await client
        .from('fund_transactions')
        .select('id, user_id, fund_id, type, trade_date, amount, shares, nav, fee, note, created_at, updated_at')
        .eq('user_id', userId)
        .order('trade_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []).map((transaction) => ({
        id: transaction.id,
        userId: transaction.user_id,
        fundId: transaction.fund_id,
        type: transaction.type,
        tradeDate: transaction.trade_date,
        amount: transaction.amount ?? undefined,
        shares: transaction.shares ?? undefined,
        nav: transaction.nav ?? undefined,
        fee: transaction.fee ?? undefined,
        note: transaction.note ?? undefined,
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at,
      }));
    },
    async replaceFunds(userId, funds) {
      pendingFundsByUser.set(userId, funds);

      if (funds.length === 0) {
        return [];
      }

      const { data, error } = await client
        .from('watchlist_funds')
        .upsert(
          funds.map((fund) => ({
            user_id: userId,
            code: fund.code,
            name: fund.name,
          })),
          {
            onConflict: 'user_id,code',
          },
        )
        .select('id, user_id, code, name, created_at');

      if (error) {
        throw error;
      }

      return (data ?? []).map((fund) => ({
        id: fund.id,
        userId: fund.user_id,
        code: fund.code,
        name: fund.name,
        createdAt: fund.created_at,
      }));
    },
    async replaceTransactions(userId, transactions) {
      const pendingFunds = pendingFundsByUser.get(userId) ?? [];

      const deleteTransactionsResult = await client.from('fund_transactions').delete().eq('user_id', userId);

      if (deleteTransactionsResult.error) {
        throw deleteTransactionsResult.error;
      }

      if (pendingFunds.length === 0) {
        const deleteFundsResult = await client.from('watchlist_funds').delete().eq('user_id', userId);

        if (deleteFundsResult.error) {
          throw deleteFundsResult.error;
        }

        return;
      }

      const staleFundDeleteResult = await client
        .from('watchlist_funds')
        .delete()
        .eq('user_id', userId)
        .not('code', 'in', `(${pendingFunds.map((fund) => `"${fund.code}"`).join(',')})`);

      if (staleFundDeleteResult.error) {
        throw staleFundDeleteResult.error;
      }

      if (transactions.length === 0) {
        return;
      }

      const insertResult = await client.from('fund_transactions').insert(
        transactions.map((transaction) => ({
          id: transaction.id,
          user_id: transaction.userId,
          fund_id: transaction.fundId,
          type: transaction.type,
          trade_date: transaction.tradeDate,
          amount: transaction.amount ?? null,
          shares: transaction.shares ?? null,
          nav: transaction.nav ?? null,
          fee: transaction.fee ?? null,
          note: transaction.note ?? null,
        })),
      );

      if (insertResult.error) {
        throw insertResult.error;
      }
    },
  };
}

export async function loadCloudWatchlist(
  client: CloudWatchlistClient,
  userId: string,
): Promise<WatchlistFund[]> {
  const [funds, transactions] = await Promise.all([client.listFunds(userId), client.listTransactions(userId)]);

  const transactionsByFundId = new Map<string, FundTransaction[]>();

  for (const transaction of transactions) {
    const mappedTransaction = mapCloudTransactionToFundTransaction(transaction);

    if (!mappedTransaction) {
      continue;
    }

    const fundTransactions = transactionsByFundId.get(transaction.fundId) ?? [];
    fundTransactions.push(mappedTransaction);
    transactionsByFundId.set(transaction.fundId, fundTransactions);
  }

  return funds.map((fund) => ({
    code: fund.code,
    name: fund.name,
    transactions: (transactionsByFundId.get(fund.id) ?? []).sort(compareTransactions),
  }));
}

export async function saveCloudWatchlist(
  client: CloudWatchlistClient,
  userId: string,
  watchlist: WatchlistFund[],
): Promise<void> {
  const savedFunds = await client.replaceFunds(
    userId,
    watchlist.map((fund) => ({
      code: fund.code,
      name: fund.name,
    })),
  );

  const fundIdByCode = new Map(savedFunds.map((fund) => [fund.code, fund.id]));
  const transactionRows: CloudTransactionInput[] = [];

  for (const fund of watchlist) {
    const fundId = fundIdByCode.get(fund.code);

    if (!fundId) {
      continue;
    }

    for (const transaction of fund.transactions ?? []) {
      transactionRows.push({
        id: transaction.id,
        userId,
        fundId,
        type: transaction.type,
        tradeDate: transaction.tradeDate,
        ...('amount' in transaction ? { amount: transaction.amount } : {}),
        ...('shares' in transaction ? { shares: transaction.shares } : {}),
        ...('nav' in transaction ? { nav: transaction.nav } : {}),
        ...(transaction.fee !== undefined ? { fee: transaction.fee } : {}),
        ...(transaction.note ? { note: transaction.note } : {}),
      });
    }
  }

  await client.replaceTransactions(userId, transactionRows);
}

function mapCloudTransactionToFundTransaction(transaction: CloudTransactionRecord): FundTransaction | null {
  const baseFields = {
    id: transaction.id,
    tradeDate: transaction.tradeDate,
    ...(transaction.fee !== undefined ? { fee: transaction.fee } : {}),
    ...(transaction.note ? { note: transaction.note } : {}),
  };

  switch (transaction.type) {
    case 'buy':
      if (transaction.amount === undefined || transaction.nav === undefined) {
        return null;
      }

      return {
        ...baseFields,
        type: 'buy',
        amount: transaction.amount,
        nav: transaction.nav,
      };
    case 'sell':
      if (transaction.shares === undefined || transaction.nav === undefined) {
        return null;
      }

      return {
        ...baseFields,
        type: 'sell',
        shares: transaction.shares,
        nav: transaction.nav,
      };
    case 'cash_dividend':
      if (transaction.amount === undefined) {
        return null;
      }

      return {
        ...baseFields,
        type: 'cash_dividend',
        amount: transaction.amount,
      };
    case 'reinvest_dividend':
      if (transaction.amount === undefined || transaction.nav === undefined) {
        return null;
      }

      return {
        ...baseFields,
        type: 'reinvest_dividend',
        amount: transaction.amount,
        nav: transaction.nav,
      };
    default:
      return null;
  }
}

function compareTransactions(left: FundTransaction, right: FundTransaction): number {
  const dateCompare = left.tradeDate.localeCompare(right.tradeDate);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return left.id.localeCompare(right.id);
}
