'use client';

import React, { useState } from 'react';

import { AddSipPlanDialog } from '@/components/fund/add-sip-plan-dialog';
import { AddTransactionDialog } from '@/components/fund/add-transaction-dialog';
import { FundDetailCard } from '@/components/fund/fund-detail-card';
import { SipPlanList } from '@/components/fund/sip-plan-list';
import { TransactionList } from '@/components/fund/transaction-list';
import { useAuthSession } from '@/lib/auth/auth-context';
import { calculateTransactionLedgerSummary } from '@/lib/funds/transactions';
import { useFundQuotes } from '@/lib/hooks/use-fund-quotes';
import type { FundTransaction } from '@/lib/funds/types';
import { useWatchlist } from '@/lib/hooks/use-watchlist';

interface FundDetailContentProps {
  code: string;
}

export function FundDetailContent({ code }: FundDetailContentProps) {
  const { userId, cloudClient } = useAuthSession();
  const { quotes } = useFundQuotes([code]);
  const quote = quotes.find((item) => item.code === code);
  const { watchlist, addTransaction, updateTransaction, removeTransaction, addSipPlan } = useWatchlist({
    userId,
    cloudClient,
    resolveSipPlanNav: () => quote?.estimatedNav ?? null,
  });
  const [editingTransaction, setEditingTransaction] = useState<FundTransaction | null>(null);
  const fund = watchlist.find((item) => item.code === code);

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
      <FundDetailCard fund={fund} quote={quote} />
      <AddSipPlanDialog onAddPlan={(plan) => addSipPlan(code, plan)} />
      <SipPlanList plans={sipPlans} />
      <AddTransactionDialog
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
