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
  return transaction.tradeDate;
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
  return `${action} ${transaction.tradeDate} ${getTypeLabel(transaction.type)}记录`;
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
      const nextSequence = (countByTradeDate.get(transaction.tradeDate) ?? 0) + 1;

      countByTradeDate.set(transaction.tradeDate, nextSequence);
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

      if (currentGroup?.tradeDate === transaction.tradeDate) {
        currentGroup.transactions.push(transaction);
        continue;
      }

      groups.push({
        tradeDate: transaction.tradeDate,
        transactions: [transaction],
      });
    }

    return groups;
  }, [visibleTransactions]);
  const toolbarSummary = `当前显示：${getFilterLabel(filterType)} · ${getSortLabel(sortOrder)} · 共 ${visibleTransactions.length} 条`;

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
        还没有交易记录，请先添加第一笔记录。
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-semibold text-slate-900">交易记录</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-1">
            <button
              aria-pressed={sortOrder === 'desc'}
              className={`rounded-md px-3 py-1.5 text-sm ${
                sortOrder === 'desc' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
              onClick={() => setSortOrder('desc')}
              type="button"
            >
              最新在前
            </button>
            <button
              aria-pressed={sortOrder === 'asc'}
              className={`rounded-md px-3 py-1.5 text-sm ${
                sortOrder === 'asc' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
              onClick={() => setSortOrder('asc')}
              type="button"
            >
              最早在前
            </button>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 p-1">
            <button
              aria-pressed={filterType === 'all'}
              className={`rounded-md px-3 py-1.5 text-sm ${
                filterType === 'all' ? 'bg-slate-100 text-slate-900' : 'text-slate-600'
              }`}
              onClick={() => setFilterType('all')}
              type="button"
            >
              全部
            </button>
            <button
              aria-pressed={filterType === 'buy'}
              className={`rounded-md px-3 py-1.5 text-sm ${
                filterType === 'buy' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'
              }`}
              onClick={() => setFilterType('buy')}
              type="button"
            >
              买入
            </button>
            <button
              aria-pressed={filterType === 'sell'}
              className={`rounded-md px-3 py-1.5 text-sm ${
                filterType === 'sell' ? 'bg-amber-50 text-amber-700' : 'text-slate-600'
              }`}
              onClick={() => setFilterType('sell')}
              type="button"
            >
              卖出
            </button>
            <button
              aria-pressed={filterType === 'dividend'}
              className={`rounded-md px-3 py-1.5 text-sm ${
                filterType === 'dividend' ? 'bg-sky-50 text-sky-700' : 'text-slate-600'
              }`}
              onClick={() => setFilterType('dividend')}
              type="button"
            >
              只看分红
            </button>
          </div>
        </div>
      </div>
      <p className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-500">{toolbarSummary}</p>
      <div className="mt-4 space-y-4">
        {visibleTransactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            <p className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-sm text-amber-700">
              当前筛选：{getFilterLabel(filterType)}
            </p>
            <p>当前筛选下还没有交易记录，试试切回“全部”查看完整账本。</p>
            <button
              className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              onClick={() => setFilterType('all')}
              type="button"
            >
              切回全部
            </button>
          </div>
        ) : null}
        {groupedTransactions.map((group) => (
          <div key={group.tradeDate}>
            <p className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-500">
              {group.tradeDate} · {group.transactions.length} 笔
            </p>
            <ul className="mt-2 divide-y divide-slate-100">
              {group.transactions.map((transaction, index) => {
                const snapshot = snapshotByTransactionId.get(transaction.id);
                const previousSnapshot = previousSnapshotByTransactionId.get(transaction.id);

                return (
                  <li key={transaction.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ${getTypeClassName(
                            transaction.type,
                          )}`}
                        >
                          {getTypeLabel(transaction.type)}
                        </span>
                      </p>
                      {group.transactions.length > 1 ? (
                        <p className="mt-1 text-xs font-medium text-slate-400">
                          当日第 {sameDaySequenceByTransactionId.get(transaction.id) ?? index + 1} 笔
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm text-slate-500">{getDateText(transaction)}</p>
                        <span className="text-slate-300">·</span>
                        <p className="text-sm font-semibold text-slate-900">{getValueText(transaction)}</p>
                      </div>
                      {snapshot ? (
                        <p
                          className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-sm ${getImpactHintClassName(
                            transaction.type,
                          )}`}
                        >
                          {getImpactHint(transaction, snapshot, previousSnapshot)}
                        </p>
                      ) : null}
                      {getExtraDetails(transaction).length > 0 ? (
                        <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-500">
                          {getExtraDetails(transaction).join(' · ')}
                        </p>
                      ) : null}
                      {transaction.note ? (
                        <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-500">
                          备注：{transaction.note}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        aria-label={getActionLabel('编辑', transaction)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                        onClick={() => onEditTransaction?.(transaction)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        aria-label={getActionLabel('删除', transaction)}
                        className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600"
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
