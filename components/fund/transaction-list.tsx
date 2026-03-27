'use client';

import React from 'react';

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

export function TransactionList({ transactions, onEditTransaction, onDeleteTransaction }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
        还没有交易记录，请先添加第一笔记录。
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">交易记录</h3>
      <ul className="mt-4 divide-y divide-slate-100">
        {transactions.map((transaction) => (
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
              <p className="mt-1 text-sm text-slate-500">
                {transaction.tradeDate} · {getValueText(transaction)}
              </p>
              {getExtraDetails(transaction).length > 0 ? (
                <p className="mt-1 text-sm text-slate-500">{getExtraDetails(transaction).join(' · ')}</p>
              ) : null}
              {transaction.note ? (
                <p className="mt-1 text-sm text-slate-500">备注：{transaction.note}</p>
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
        ))}
      </ul>
    </section>
  );
}
