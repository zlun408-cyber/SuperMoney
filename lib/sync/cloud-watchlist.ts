import type { SupabaseClient } from '@supabase/supabase-js';

import type { FundTransaction, SipExecutionRecord, SipPlan } from '@/lib/funds/types';
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

export interface CloudSipPlanRecord {
  id: string;
  userId: string;
  fundId: string;
  name?: string;
  amount: number;
  frequency: SipPlan['frequency'];
  startDate: string;
  endDate?: string;
  executionTime: string;
  executionPeriod: SipPlan['executionPeriod'];
  status: SipPlan['status'];
  lastExecutedAt?: string;
  nextExecutionAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudSipPlanInput {
  id: string;
  userId: string;
  fundId: string;
  name?: string;
  amount: number;
  frequency: SipPlan['frequency'];
  startDate: string;
  endDate?: string;
  executionTime: string;
  executionPeriod: SipPlan['executionPeriod'];
  status: SipPlan['status'];
  lastExecutedAt?: string;
  nextExecutionAt?: string;
}

export interface CloudSipExecutionRecord {
  id: string;
  userId: string;
  fundId: string;
  planId: string;
  executionDate: string;
  status: SipExecutionRecord['status'];
  transactionId?: string;
  generatedAt?: string;
  skippedAt?: string;
  skipReason?: SipExecutionRecord['skipReason'];
  createdAt: string;
  updatedAt: string;
}

export interface CloudSipExecutionInput {
  id: string;
  userId: string;
  fundId: string;
  planId: string;
  executionDate: string;
  status: SipExecutionRecord['status'];
  transactionId?: string;
  generatedAt?: string;
  skippedAt?: string;
  skipReason?: SipExecutionRecord['skipReason'];
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
  listSipPlans(userId: string): Promise<CloudSipPlanRecord[]>;
  listSipExecutions(userId: string): Promise<CloudSipExecutionRecord[]>;
  replaceFunds(userId: string, funds: CloudFundInput[]): Promise<CloudFundRecord[]>;
  replaceTransactions(userId: string, transactions: CloudTransactionInput[]): Promise<void>;
  replaceSipPlans(userId: string, sipPlans: CloudSipPlanInput[]): Promise<void>;
  replaceSipExecutions(userId: string, executions: CloudSipExecutionInput[]): Promise<void>;
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
    async listSipPlans(userId) {
      const { data, error } = await client
        .from('fund_sip_plans')
        .select(
          'id, user_id, fund_id, name, amount, frequency, start_date, end_date, execution_time, execution_period, status, last_executed_at, next_execution_at, created_at, updated_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        if (isMissingSipPlansTableError(error)) {
          return [];
        }

        throw error;
      }

      return (data ?? []).map((plan) => ({
        id: plan.id,
        userId: plan.user_id,
        fundId: plan.fund_id,
        name: plan.name ?? undefined,
        amount: plan.amount,
        frequency: plan.frequency,
        startDate: plan.start_date,
        endDate: plan.end_date ?? undefined,
        executionTime: plan.execution_time,
        executionPeriod: plan.execution_period,
        status: plan.status,
        lastExecutedAt: plan.last_executed_at ?? undefined,
        nextExecutionAt: plan.next_execution_at ?? undefined,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      }));
    },
    async listSipExecutions(userId) {
      const { data, error } = await client
        .from('fund_sip_executions')
        .select(
          'id, user_id, fund_id, plan_id, execution_date, status, transaction_id, generated_at, skipped_at, skip_reason, created_at, updated_at',
        )
        .eq('user_id', userId)
        .order('execution_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        if (isMissingSipExecutionsTableError(error)) {
          return [];
        }

        throw error;
      }

      return (data ?? []).map((execution) => ({
        id: execution.id,
        userId: execution.user_id,
        fundId: execution.fund_id,
        planId: execution.plan_id,
        executionDate: execution.execution_date,
        status: execution.status,
        transactionId: execution.transaction_id ?? undefined,
        generatedAt: execution.generated_at ?? undefined,
        skippedAt: execution.skipped_at ?? undefined,
        skipReason: execution.skip_reason ?? undefined,
        createdAt: execution.created_at,
        updatedAt: execution.updated_at,
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
        transactions.map((transaction) => {
          const date = 'placedDate' in transaction ? transaction.placedDate : (transaction as { tradeDate: string }).tradeDate;
          const nav = 'confirmedNav' in transaction ? transaction.confirmedNav : (transaction as { nav: number }).nav;
          return {
            id: transaction.id,
            user_id: transaction.userId,
            fund_id: transaction.fundId,
            type: transaction.type,
            trade_date: date,
            amount: 'amount' in transaction ? transaction.amount : null,
            shares: 'shares' in transaction ? transaction.shares : null,
            nav: nav ?? null,
            fee: transaction.fee ?? null,
            note: transaction.note ?? null,
          };
        }),
      );

      if (insertResult.error) {
        throw insertResult.error;
      }
    },
    async replaceSipPlans(userId, sipPlans) {
      const deleteResult = await client.from('fund_sip_plans').delete().eq('user_id', userId);

      if (deleteResult.error) {
        if (isMissingSipPlansTableError(deleteResult.error)) {
          return;
        }

        throw deleteResult.error;
      }

      if (sipPlans.length === 0) {
        return;
      }

      const insertResult = await client.from('fund_sip_plans').insert(
        sipPlans.map((plan) => ({
          id: plan.id,
          user_id: plan.userId,
          fund_id: plan.fundId,
          name: plan.name ?? null,
          amount: plan.amount,
          frequency: plan.frequency,
          start_date: plan.startDate,
          end_date: plan.endDate ?? null,
          execution_time: plan.executionTime,
          execution_period: plan.executionPeriod,
          status: plan.status,
          last_executed_at: plan.lastExecutedAt ?? null,
          next_execution_at: plan.nextExecutionAt ?? null,
        })),
      );

      if (insertResult.error) {
        if (isMissingSipPlansTableError(insertResult.error)) {
          return;
        }

        throw insertResult.error;
      }
    },
    async replaceSipExecutions(userId, executions) {
      const deleteResult = await client.from('fund_sip_executions').delete().eq('user_id', userId);

      if (deleteResult.error) {
        if (isMissingSipExecutionsTableError(deleteResult.error)) {
          return;
        }

        throw deleteResult.error;
      }

      if (executions.length === 0) {
        return;
      }

      const insertResult = await client.from('fund_sip_executions').insert(
        executions.map((execution) => ({
          id: execution.id,
          user_id: execution.userId,
          fund_id: execution.fundId,
          plan_id: execution.planId,
          execution_date: execution.executionDate,
          status: execution.status,
          transaction_id: execution.transactionId ?? null,
          generated_at: execution.generatedAt ?? null,
          skipped_at: execution.skippedAt ?? null,
          skip_reason: execution.skipReason ?? null,
        })),
      );

      if (insertResult.error) {
        if (isMissingSipExecutionsTableError(insertResult.error)) {
          return;
        }

        throw insertResult.error;
      }
    },
  };
}

function isMissingSipPlansTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error ? error.message : undefined;

  return code === 'PGRST205' && typeof message === 'string' && message.includes('fund_sip_plans');
}

function isMissingSipExecutionsTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error ? error.message : undefined;

  return code === 'PGRST205' && typeof message === 'string' && message.includes('fund_sip_executions');
}

export async function loadCloudWatchlist(
  client: CloudWatchlistClient,
  userId: string,
): Promise<WatchlistFund[]> {
  const [funds, transactions, sipPlansResult, sipExecutionsResult] = await Promise.allSettled([
    client.listFunds(userId),
    client.listTransactions(userId),
    client.listSipPlans(userId),
    client.listSipExecutions(userId),
  ]);

  if (funds.status === 'rejected') {
    throw funds.reason;
  }

  if (transactions.status === 'rejected') {
    throw transactions.reason;
  }

  if (sipPlansResult.status === 'rejected' && !isMissingSipPlansTableError(sipPlansResult.reason)) {
    throw sipPlansResult.reason;
  }

  if (
    sipExecutionsResult.status === 'rejected' &&
    !isMissingSipExecutionsTableError(sipExecutionsResult.reason)
  ) {
    throw sipExecutionsResult.reason;
  }

  const sipPlans = sipPlansResult.status === 'fulfilled' ? sipPlansResult.value : [];
  const sipExecutions = sipExecutionsResult.status === 'fulfilled' ? sipExecutionsResult.value : [];
  const settledTransactions = transactions.value;

  const transactionsByFundId = new Map<string, FundTransaction[]>();
  const sipPlansByFundId = new Map<string, SipPlan[]>();
  const sipExecutionRecordsByFundId = new Map<string, CloudSipExecutionRecord[]>();

  for (const transaction of settledTransactions) {
    const mappedTransaction = mapCloudTransactionToFundTransaction(transaction);

    if (!mappedTransaction) {
      continue;
    }

    const fundTransactions = transactionsByFundId.get(transaction.fundId) ?? [];
    fundTransactions.push(mappedTransaction);
    transactionsByFundId.set(transaction.fundId, fundTransactions);
  }

  for (const sipPlan of sipPlans) {
    const fundPlans = sipPlansByFundId.get(sipPlan.fundId) ?? [];
    fundPlans.push(mapCloudSipPlanToSipPlan(sipPlan));
    sipPlansByFundId.set(sipPlan.fundId, fundPlans);
  }

  for (const sipExecution of sipExecutions) {
    const fundExecutions = sipExecutionRecordsByFundId.get(sipExecution.fundId) ?? [];
    fundExecutions.push(sipExecution);
    sipExecutionRecordsByFundId.set(sipExecution.fundId, fundExecutions);
  }

  return funds.value.map((fund) => ({
    code: fund.code,
    name: fund.name,
    transactions: (transactionsByFundId.get(fund.id) ?? []).sort(compareTransactions),
    sipPlans: sipPlansByFundId.get(fund.id) ?? [],
    sipExecutionRecords: (sipExecutionRecordsByFundId.get(fund.id) ?? []).map((execution) =>
      mapCloudSipExecutionToSipExecution(execution, fund.code),
    ),
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
  const sipPlanRows: CloudSipPlanInput[] = [];
  const sipExecutionRows: CloudSipExecutionInput[] = [];

  for (const fund of watchlist) {
    const fundId = fundIdByCode.get(fund.code);

    if (!fundId) {
      continue;
    }

    for (const transaction of fund.transactions ?? []) {
      transactionRows.push(mapFundTransactionToCloudTransactionInput(transaction, userId, fundId));
    }

    for (const sipPlan of fund.sipPlans ?? []) {
      sipPlanRows.push({
        id: sipPlan.id,
        userId,
        fundId,
        name: sipPlan.name,
        amount: sipPlan.amount,
        frequency: sipPlan.frequency,
        startDate: sipPlan.startDate,
        endDate: sipPlan.endDate,
        executionTime: sipPlan.executionTime,
        executionPeriod: sipPlan.executionPeriod,
        status: sipPlan.status,
        lastExecutedAt: sipPlan.lastExecutedAt,
        nextExecutionAt: sipPlan.nextExecutionAt,
      });
    }

    for (const execution of fund.sipExecutionRecords ?? []) {
      sipExecutionRows.push({
        id: execution.id,
        userId,
        fundId,
        planId: execution.planId,
        executionDate: execution.executionDate,
        status: execution.status,
        transactionId: execution.transactionId,
        generatedAt: execution.generatedAt,
        skippedAt: execution.skippedAt,
        skipReason: execution.skipReason,
      });
    }
  }

  await client.replaceTransactions(userId, transactionRows);
  await client.replaceSipPlans(userId, sipPlanRows);
  await client.replaceSipExecutions(userId, sipExecutionRows);
}

function mapCloudSipPlanToSipPlan(plan: CloudSipPlanRecord): SipPlan {
  return {
    id: plan.id,
    name: plan.name,
    amount: plan.amount,
    frequency: plan.frequency,
    startDate: plan.startDate,
    endDate: plan.endDate,
    executionTime: plan.executionTime,
    executionPeriod: plan.executionPeriod,
    status: plan.status,
    lastExecutedAt: plan.lastExecutedAt,
    nextExecutionAt: plan.nextExecutionAt,
  };
}

function mapCloudTransactionToFundTransaction(transaction: CloudTransactionRecord): FundTransaction | null {
  const baseFields = {
    id: transaction.id,
    placedDate: transaction.tradeDate,
    placedPeriod: 'before_1500' as const,
    effectiveDate: transaction.tradeDate,
    source: 'manual' as const,
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
        confirmedNav: transaction.nav,
      };
    case 'sell':
      if (transaction.shares === undefined || transaction.nav === undefined) {
        return null;
      }

      return {
        ...baseFields,
        type: 'sell',
        shares: transaction.shares,
        confirmedNav: transaction.nav,
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
        confirmedNav: transaction.nav,
      };
    default:
      return null;
  }
}

function mapCloudSipExecutionToSipExecution(
  execution: CloudSipExecutionRecord,
  fundCode: string,
): SipExecutionRecord {
  return {
    id: execution.id,
    planId: execution.planId,
    fundId: fundCode,
    executionDate: execution.executionDate,
    status: execution.status,
    transactionId: execution.transactionId,
    generatedAt: execution.generatedAt,
    skippedAt: execution.skippedAt,
    skipReason: execution.skipReason,
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
  };
}

function mapFundTransactionToCloudTransactionInput(
  transaction: FundTransaction,
  userId: string,
  fundId: string,
): CloudTransactionInput {
  const tradeDate = 'placedDate' in transaction ? transaction.placedDate : transaction.tradeDate;
  const nav = 'confirmedNav' in transaction ? transaction.confirmedNav : 'nav' in transaction ? transaction.nav : undefined;

  return {
    id: transaction.id,
    userId,
    fundId,
    type: transaction.type,
    tradeDate,
    amount: 'amount' in transaction ? transaction.amount : undefined,
    shares: 'shares' in transaction ? transaction.shares : undefined,
    nav,
    fee: transaction.fee,
    note: transaction.note,
  };
}

function compareTransactions(left: FundTransaction, right: FundTransaction): number {
  const leftDate = 'placedDate' in left ? left.placedDate : (left as { tradeDate?: string }).tradeDate ?? '';
  const rightDate = 'placedDate' in right ? right.placedDate : (right as { tradeDate?: string }).tradeDate ?? '';
  const dateCompare = leftDate.localeCompare(rightDate);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return left.id.localeCompare(right.id);
}
