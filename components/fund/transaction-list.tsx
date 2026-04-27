'use client';

import React, { useMemo, useState } from 'react';

import { calculateTransactionLedgerSnapshots, sortTransactionsByDate } from '@/lib/funds/transactions';
import type { FundTransaction } from '@/lib/funds/types';

interface TransactionListProps {
  transactions: FundTransaction[];
  onEditTransaction?: (transaction: FundTransaction) => void;
  onDeleteTransaction?: (transaction: FundTransaction) => void;
}

function formatNumber(value: number, digits = 2) {
  return value.toFixed(digits);
}

function getTypeLabel(type: FundTransaction['type']) {
  switch (type) {
    case 'buy':
      return '买入';
    case 'sell':
      return '卖出';
    case 'cash_dividend':
      return '现金分红';
    case 'reinvest_dividend':
      return '红利再投资';
  }
}

function getValueText(transaction: FundTransaction) {
  if (transaction.type === 'sell') {
    return `份额 ${transaction.shares}`;
  }

  return `金额 ${transaction.amount}`;
}

function getDateText(transaction: FundTransaction) {
  return 'effectiveDate' in transaction ? transaction.effectiveDate : transaction.tradeDate;
}

function getPlacedDateText(transaction: FundTransaction) {
  return 'placedDate' in transaction ? transaction.placedDate : transaction.tradeDate;
}

function getPlacedPeriodLabel(transaction: FundTransaction) {
  if (!('placedPeriod' in transaction)) {
    return null;
  }

  return transaction.placedPeriod === 'after_1500' ? '15点后' : '15点前';
}

function getSourceLabel(transaction: FundTransaction) {
  if (!('source' in transaction)) {
    return null;
  }

  return transaction.source === 'sip_plan' ? '定投计划' : '手动录入';
}

function getTypeClassName(type: FundTransaction['type']) {
  switch (type) {
    case 'buy':
      return 'bg-emerald-50 text-emerald-700';
    case 'sell':
      return 'bg-amber-50 text-amber-700';
    case 'cash_dividend':
    case 'reinvest_dividend':
      return 'bg-sky-50 text-sky-700';
  }
}

function getExtraDetails(transaction: FundTransaction) {
  const details: string[] = [];

  if ('nav' in transaction) {
    details.push(`净值 ${formatNumber(transaction.nav, 4)}`);
  }

  if (typeof transaction.fee === 'number' && transaction.fee > 0) {
    details.push(`手续费 ${formatNumber(transaction.fee)}`);
  }

  return details;
}

function getActionLabel(action: '编辑' | '删除', transaction: FundTransaction) {
  return `${action} ${getPlacedDateText(transaction)} ${getTypeLabel(transaction.type)}记录`;
}

function getSortLabel(sortOrder: 'desc' | 'asc') {
  return sortOrder === 'desc' ? '最新在前' : '最早在前';
}

function getFilterLabel(filterType: 'all' | 'buy' | 'sell' | 'dividend') {
  switch (filterType) {
    case 'all':
      return '全部';
    case 'buy':
      return '买入';
    case 'sell':
      return '卖出';
    case 'dividend':
      return '只看分红';
  }
}

function getImpactHint(
  transaction: FundTransaction,
  snapshot: {
    currentShares: number;
    realizedProfit: number;
    totalDividends: number;
  },
  previousSnapshot?: {
    currentShares: number;
    realizedProfit: number;
    totalDividends: number;
  },
) {
  const previousRealizedProfit = previousSnapshot?.realizedProfit ?? 0;

  switch (transaction.type) {
    case 'buy':
      return `买入后持仓 ${formatNumber(snapshot.currentShares)} 份`;
    case 'sell':
      return `卖出后剩余 ${formatNumber(snapshot.currentShares)} 份 · 本次已实现收益 ${formatNumber(
        snapshot.realizedProfit - previousRealizedProfit,
      )}`;
    case 'cash_dividend':
      return `分红入账 ${formatNumber(transaction.amount)} 元 · 累计分红 ${formatNumber(snapshot.totalDividends)}`;
    case 'reinvest_dividend':
      return `红利再投后持仓 ${formatNumber(snapshot.currentShares)} 份 · 累计分红 ${formatNumber(snapshot.totalDividends)}`;
  }
}

function getImpactHintClassName(type: FundTransaction['type']) {
  switch (type) {
    case 'buy':
      return 'bg-emerald-50 text-emerald-700';
    case 'sell':
      return 'bg-amber-50 text-amber-700';
    case 'cash_dividend':
    case 'reinvest_dividend':
      return 'bg-sky-50 text-sky-700';
  }
}

export function TransactionList({ transactions, onEditTransaction, onDeleteTransaction }: TransactionListProps) {
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell' | 'dividend'>('all');
  const snapshots = calculateTransactionLedgerSnapshots(transactions);
  const snapshotByTransactionId = new Map(snapshots.map((snapshot) => [snapshot.transactionId, snapshot]));
  const previousSnapshotByTransactionId = new Map(
    snapshots.map((snapshot, index) => [snapshot.transactionId, index > 0 ? snapshots[index - 1] : undefined]),
  );
  const sameDaySequenceByTransactionId = useMemo(() => {
    const sequenceById = new Map<string, number>();
    const countByTradeDate = new Map<string, number>();

    for (const transaction of sortTransactionsByDate(transactions)) {
      const tradeDate = getDateText(transaction);
      const nextSequence = (countByTradeDate.get(tradeDate) ?? 0) + 1;

      countByTradeDate.set(tradeDate, nextSequence);
      sequenceById.set(transaction.id, nextSequence);
    }

    return sequenceById;
  }, [transactions]);
  const orderedTransactions = useMemo(() => {
    const sortedTransactions = sortTransactionsByDate(transactions);

    return sortOrder === 'asc' ? sortedTransactions : [...sortedTransactions].reverse();
  }, [sortOrder, transactions]);
  const visibleTransactions = useMemo(() => {
    if (filterType === 'all') {
      return orderedTransactions;
    }

    if (filterType === 'dividend') {
      return orderedTransactions.filter(
        (transaction) => transaction.type === 'cash_dividend' || transaction.type === 'reinvest_dividend',
      );
    }

    return orderedTransactions.filter((transaction) => transaction.type === filterType);
  }, [filterType, orderedTransactions]);
  const groupedTransactions = useMemo(() => {
    const groups: Array<{ tradeDate: string; transactions: FundTransaction[] }> = [];

    for (const transaction of visibleTransactions) {
      const currentGroup = groups.at(-1);
      const tradeDate = getDateText(transaction);

      if (currentGroup?.tradeDate === tradeDate) {
        currentGroup.transactions.push(transaction);
        continue;
      }

      groups.push({
        tradeDate,
        transactions: [transaction],
      });
    }

    return groups;
  }, [visibleTransactions]);
  const toolbarSummary = `${getFilterLabel(filterType)} · ${getSortLabel(sortOrder)} · 共 ${visibleTransactions.length} 条`;

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-200">
           <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <h3 className="mt-4 text-sm font-bold text-slate-900">暂无交易记录</h3>
        <p className="mt-1 text-sm text-slate-500">点击“手动添加记录”按钮开启资产记账。</p>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">交易账本明细</h3>
          <p className="mt-1 text-sm text-slate-400 font-medium uppercase tracking-wider">{toolbarSummary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              aria-pressed={sortOrder === 'desc'}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                sortOrder === 'desc' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setSortOrder('desc')}
              type="button"
            >
              最新在前
            </button>
            <button
              aria-pressed={sortOrder === 'asc'}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                sortOrder === 'asc' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setSortOrder('asc')}
              type="button"
            >
              最早在前
            </button>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
             {(['all', 'buy', 'sell', 'dividend'] as const).map((type) => (
                <button
                  key={type}
                  aria-pressed={filterType === type}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    filterType === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => setFilterType(type)}
                  type="button"
                >
                  {getFilterLabel(type)}
                </button>
             ))}
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-10">
        {visibleTransactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
            <p className="text-sm font-bold text-slate-900">未找到符合筛选条件的记录</p>
            <p className="mt-1 text-sm text-slate-500">试试切换到“全部”分类。</p>
          </div>
        ) : null}

        {groupedTransactions.map((group) => (
          <div key={group.tradeDate} className="relative">
            <div className="flex items-center gap-4 mb-4">
               <span className="shrink-0 rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white shadow-sm font-mono">
                  {group.tradeDate}
               </span>
               <div className="h-px flex-1 bg-slate-100" />
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {group.transactions.length} 笔记录
               </span>
            </div>

            <ul className="space-y-4">
              {group.transactions.map((transaction, index) => {
                const snapshot = snapshotByTransactionId.get(transaction.id);
                const previousSnapshot = previousSnapshotByTransactionId.get(transaction.id);

                return (
                  <li key={transaction.id} className="group relative flex items-start gap-4 rounded-2xl bg-slate-50/30 p-4 ring-1 ring-slate-100 transition hover:bg-slate-50 hover:ring-slate-200">
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ring-1 ring-inset ${getTypeClassName(
                            transaction.type,
                          )} ring-current/20`}
                        >
                          {getTypeLabel(transaction.type)}
                        </span>
                        {group.transactions.length > 1 && (
                          <span className="text-[10px] font-bold text-slate-400">
                            #{sameDaySequenceByTransactionId.get(transaction.id) ?? index + 1}
                          </span>
                        )}
                        {getSourceLabel(transaction) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            {getSourceLabel(transaction)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="text-base font-bold text-slate-900">{getValueText(transaction)}</p>
                        {'effectiveDate' in transaction && transaction.effectiveDate !== getPlacedDateText(transaction) && (
                          <p className="text-[10px] font-bold text-slate-400 uppercase">生效: {transaction.effectiveDate}</p>
                        )}
                      </div>

                      {getPlacedPeriodLabel(transaction) && (
                        <p className="text-[10px] font-medium text-slate-500 italic">
                          于 {getPlacedDateText(transaction)} {getPlacedPeriodLabel(transaction)} 下单
                        </p>
                      )}

                      {snapshot && (
                        <div className={`mt-1 flex items-center gap-2 rounded-lg ${getImpactHintClassName(transaction.type)} bg-current/5 px-2 py-1`}>
                          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <p className="text-[10px] font-bold tracking-tight">
                            {getImpactHint(transaction, snapshot, previousSnapshot)}
                          </p>
                        </div>
                      )}

                      {getExtraDetails(transaction).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                           {getExtraDetails(transaction).map((detail, idx) => (
                             <span key={idx} className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {detail}
                             </span>
                           ))}
                        </div>
                      )}

                      {transaction.note && (
                        <div className="flex gap-1.5 items-start mt-1">
                           <span className="mt-0.5 shrink-0 text-slate-300">
                             <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                           </span>
                           <p className="text-[10px] font-medium text-slate-500 leading-relaxed">{transaction.note}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-center opacity-0 transition group-hover:opacity-100">
                      <button
                        aria-label={getActionLabel('编辑', transaction)}
                        className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50"
                        onClick={() => onEditTransaction?.(transaction)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        aria-label={getActionLabel('删除', transaction)}
                        className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold text-rose-600 shadow-sm ring-1 ring-inset ring-rose-200 transition hover:bg-rose-50 hover:ring-rose-300"
                        onClick={() => onDeleteTransaction?.(transaction)}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
