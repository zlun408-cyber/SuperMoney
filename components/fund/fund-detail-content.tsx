'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { AddSipPlanDialog } from '@/components/fund/add-sip-plan-dialog';
import { AddTransactionDialog } from '@/components/fund/add-transaction-dialog';
import { FundDetailCard } from '@/components/fund/fund-detail-card';
import { SipPlanList } from '@/components/fund/sip-plan-list';
import { TransactionList } from '@/components/fund/transaction-list';
import { useAuthSession } from '@/lib/auth/auth-context';
import { gradeEstimateConfidence, summarizeEstimateAccuracy } from '@/lib/funds/estimate-accuracy';
import { buildIntradayTrustSignal, resolveIntradaySignalTradingDate } from '@/lib/funds/intraday-status';
import { calculateTransactionLedgerSummary } from '@/lib/funds/transactions';
import { useFundQuotes } from '@/lib/hooks/use-fund-quotes';
import type {
  EstimateAccuracySummary,
  EstimateConfidenceLevel,
  EstimateIntradayPoint,
  EstimateIntradayTrustSignal,
  FundTransaction,
} from '@/lib/funds/types';
import { useWatchlist } from '@/lib/hooks/use-watchlist';
import {
  ESTIMATE_ACCURACY_STORAGE_KEY,
  ESTIMATE_ACCURACY_UPDATED_EVENT,
  loadEstimateAccuracySnapshots,
} from '@/lib/storage/estimate-accuracy-storage';
import {
  ESTIMATE_INTRADAY_STORAGE_KEY,
  ESTIMATE_INTRADAY_UPDATED_EVENT,
  loadEstimateIntradayPoints,
} from '@/lib/storage/estimate-intraday-storage';

interface FundDetailContentProps {
  code: string;
}

export function FundDetailContent({ code }: FundDetailContentProps) {
  const { userId, cloudClient, accuracyStore } = useAuthSession();
  const { quotes } = useFundQuotes([code], undefined, undefined, { accuracyStore });
  const quote = quotes.find((item) => item.code === code);
  const [estimateAccuracySummary, setEstimateAccuracySummary] =
    useState<EstimateAccuracySummary | null>(null);
  const [estimateConfidenceLevel, setEstimateConfidenceLevel] =
    useState<EstimateConfidenceLevel>('unknown');
  const [intradayPoints, setIntradayPoints] = useState<EstimateIntradayPoint[]>([]);
  const [intradayTrustSignal, setIntradayTrustSignal] = useState<EstimateIntradayTrustSignal | null>(null);
  const { watchlist, isReady, addTransaction, updateTransaction, removeTransaction, addSipPlan } = useWatchlist({
    userId,
    cloudClient,
    resolveSipPlanNav: () => quote?.estimatedNav ?? null,
    sipPlanMaterializeKey: quote?.updatedAt ?? null,
  });
  const [editingTransaction, setEditingTransaction] = useState<FundTransaction | null>(null);
  const fund = watchlist.find((item) => item.code === code);

  const refreshEstimateAccuracy = useCallback(() => {
    const snapshots = accuracyStore.loadSnapshots().filter((snapshot) => snapshot.fundCode === code);

    if (snapshots.length === 0) {
      setEstimateAccuracySummary({
        fundCode: code,
        sampleCount: 0,
        resolvedSampleCount: 0,
        resolvedTradingDayCount: 0,
        highErrorResolvedSampleCount: 0,
        averageAbsoluteErrorRate: null,
        latestQuoteUpdatedAt: null,
        latestResolvedAt: null,
      });
      setEstimateConfidenceLevel('unknown');
      return;
    }

    const summary = summarizeEstimateAccuracy(snapshots);
    setEstimateAccuracySummary(summary);
    setEstimateConfidenceLevel(gradeEstimateConfidence(summary));
  }, [accuracyStore, code]);

  const refreshIntradayPoints = useCallback(() => {
    setIntradayPoints(loadEstimateIntradayPoints()[code] ?? []);
  }, [code]);

  useEffect(() => {
    const currentTradingDate = resolveIntradaySignalTradingDate({
      quoteUpdatedAt: quote?.updatedAt ?? null,
      points: intradayPoints,
    });

    setIntradayTrustSignal(
      buildIntradayTrustSignal({
        points: intradayPoints,
        quoteUpdatedAt: quote?.updatedAt ?? null,
        currentTradingDate,
        historicalConfidenceLevel: estimateConfidenceLevel,
      }),
    );
  }, [estimateConfidenceLevel, intradayPoints, quote?.updatedAt]);

  useEffect(() => {
    refreshEstimateAccuracy();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ESTIMATE_ACCURACY_STORAGE_KEY) {
        return;
      }

      refreshEstimateAccuracy();
    };
    const handleEstimateAccuracyUpdated = () => {
      refreshEstimateAccuracy();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(ESTIMATE_ACCURACY_UPDATED_EVENT, handleEstimateAccuracyUpdated);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ESTIMATE_ACCURACY_UPDATED_EVENT, handleEstimateAccuracyUpdated);
    };
  }, [refreshEstimateAccuracy]);

  useEffect(() => {
    refreshIntradayPoints();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ESTIMATE_INTRADAY_STORAGE_KEY) {
        return;
      }

      refreshIntradayPoints();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, refreshIntradayPoints);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, refreshIntradayPoints);
    };
  }, [refreshIntradayPoints]);

  if (!isReady) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          正在加载基金详情…
        </div>
      </main>
    );
  }

  if (!fund) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          没有找到这只基金，请先回到首页添加。
        </div>
      </main>
    );
  }

  const transactions = fund.transactions ?? [];
  const sipPlans = fund.sipPlans ?? [];
  const executionRecords = fund.sipExecutionRecords ?? [];
  const addTransactionHandler = (transaction: FundTransaction) => addTransaction(code, transaction);
  const cancelEditHandler = () => setEditingTransaction(null);
  const validateTransactionBusinessRules = (transaction: FundTransaction) => {
    if (transaction.type !== 'sell') {
      return null;
    }

    const comparableTransactions = editingTransaction
      ? transactions.filter((currentTransaction) => currentTransaction.id !== editingTransaction.id)
      : transactions;

    try {
      calculateTransactionLedgerSummary([...comparableTransactions, transaction]);
      return null;
    } catch (error) {
      if (error instanceof Error && error.message === '卖出份额不能大于当前可用份额') {
        return error.message;
      }

      throw error;
    }
  };
  const dialogProps = editingTransaction
    ? {
        editingTransaction,
        onCancelEdit: cancelEditHandler,
        onUpdateTransaction: (transaction: FundTransaction) => {
          updateTransaction(code, transaction.id, transaction);
          setEditingTransaction(null);
        },
      }
    : {
        onCancelEdit: cancelEditHandler,
      };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <FundDetailCard
        fund={fund}
        quote={quote}
        estimateAccuracySummary={estimateAccuracySummary ?? undefined}
        estimateConfidenceLevel={estimateConfidenceLevel}
        intradayPoints={intradayPoints}
        intradayTrustSignal={intradayTrustSignal ?? undefined}
      />
      <AddSipPlanDialog onAddPlan={(plan) => addSipPlan(code, plan)} />
      <SipPlanList plans={sipPlans} executionRecords={executionRecords} />
      <AddTransactionDialog
        fundCode={code}
        onAddTransaction={addTransactionHandler}
        validateBusinessRules={validateTransactionBusinessRules}
        {...dialogProps}
      />
      <TransactionList
        transactions={transactions}
        onDeleteTransaction={(transaction) => {
          const shouldDelete = window.confirm('确认删除这条交易记录吗？删除后会自动重算持仓和收益。');

          if (!shouldDelete) {
            return;
          }

          removeTransaction(code, transaction.id);

          if (editingTransaction?.id === transaction.id) {
            setEditingTransaction(null);
          }
        }}
        onEditTransaction={(transaction) => setEditingTransaction(transaction)}
      />
    </main>
  );
}
