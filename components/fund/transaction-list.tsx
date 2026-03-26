'use client';

import React from 'react';

import type { FundTransaction } from '@/lib/funds/types';

interface TransactionListProps {
  transactions: FundTransaction[];
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

export function TransactionList({ transactions }: TransactionListProps) {
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
              <p className="font-medium text-slate-900">{getTypeLabel(transaction.type)}</p>
              <p className="mt-1 text-sm text-slate-500">
                {transaction.tradeDate} · {getValueText(transaction)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
