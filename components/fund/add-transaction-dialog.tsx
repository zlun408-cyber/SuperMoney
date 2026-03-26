'use client';

import React, { useEffect, useState } from 'react';

import type { FundTransaction, FundTransactionType } from '@/lib/funds/types';

type AddTransactionDialogProps =
  | {
      onAddTransaction: (transaction: FundTransaction) => void;
      editingTransaction?: null;
      onUpdateTransaction?: never;
      onCancelEdit?: () => void;
    }
  | {
      onAddTransaction: (transaction: FundTransaction) => void;
      editingTransaction: FundTransaction;
      onUpdateTransaction: (transaction: FundTransaction) => void;
      onCancelEdit?: () => void;
    };

function invariantEditingProps(
  editingTransaction: FundTransaction | null | undefined,
  onUpdateTransaction: ((transaction: FundTransaction) => void) | undefined
) {
  if (editingTransaction && !onUpdateTransaction) {
    throw new Error('AddTransactionDialog requires onUpdateTransaction when editingTransaction is provided.');
  }
}

function resetForm(setters: {
  setType: (value: FundTransactionType) => void;
  setTradeDate: (value: string) => void;
  setAmount: (value: string) => void;
  setNav: (value: string) => void;
}) {
  setters.setType('buy');
  setters.setTradeDate('');
  setters.setAmount('');
  setters.setNav('');
}

function applyTransactionToForm(
  transaction: FundTransaction,
  setters: {
    setType: (value: FundTransactionType) => void;
    setTradeDate: (value: string) => void;
    setAmount: (value: string) => void;
    setNav: (value: string) => void;
  }
) {
  const values = getFormValues(transaction);

  setters.setType(values.type);
  setters.setTradeDate(values.tradeDate);
  setters.setAmount(values.amount);
  setters.setNav(values.nav);
}

function buildTransaction(input: {
  id?: string;
  type: FundTransactionType;
  tradeDate: string;
  amount: string;
  nav: string;
}): FundTransaction | null {
  const id = input.id ?? `tx-${Date.now()}`;

  if (!input.tradeDate) {
    return null;
  }

  if (input.type === 'cash_dividend') {
    const amount = Number(input.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    return {
      id,
      type: 'cash_dividend',
      tradeDate: input.tradeDate,
      amount,
    };
  }

  const amount = Number(input.amount);
  const nav = Number(input.nav);

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(nav) || nav <= 0) {
    return null;
  }

  if (input.type === 'buy') {
    return {
      id,
      type: 'buy',
      tradeDate: input.tradeDate,
      amount,
      nav,
    };
  }

  if (input.type === 'reinvest_dividend') {
    return {
      id,
      type: 'reinvest_dividend',
      tradeDate: input.tradeDate,
      amount,
      nav,
    };
  }

  return {
    id,
    type: 'sell',
    tradeDate: input.tradeDate,
    shares: amount,
    nav,
  };
}

function getFormValues(transaction: FundTransaction) {
  return {
    type: transaction.type,
    tradeDate: transaction.tradeDate,
    amount: String(transaction.type === 'sell' ? transaction.shares : transaction.amount),
    nav: 'nav' in transaction ? String(transaction.nav) : '',
  };
}

export function AddTransactionDialog({
  onAddTransaction,
  editingTransaction = null,
  onUpdateTransaction,
  onCancelEdit,
}: AddTransactionDialogProps) {
  invariantEditingProps(editingTransaction, onUpdateTransaction);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FundTransactionType>('buy');
  const [tradeDate, setTradeDate] = useState('');
  const [amount, setAmount] = useState('');
  const [nav, setNav] = useState('');

  useEffect(() => {
    if (editingTransaction) {
      applyTransactionToForm(editingTransaction, { setType, setTradeDate, setAmount, setNav });
      setOpen(false);
      return;
    }

    resetForm({ setType, setTradeDate, setAmount, setNav });
  }, [editingTransaction]);

  const isEditing = editingTransaction !== null;
  const isFormOpen = isEditing || open;
  const usesNav = type !== 'cash_dividend';
  const amountLabel = type === 'sell' ? '份额' : '金额';
  const title = isEditing ? '编辑交易记录' : '交易记录';
  const description = isEditing ? '修改已有交易记录。' : '添加买入、卖出、现金分红或红利再投资记录。';

  const handleSave = () => {
    const transaction = buildTransaction({
      id: editingTransaction?.id,
      type,
      tradeDate,
      amount,
      nav,
    });

    if (!transaction) {
      return;
    }

    if (isEditing) {
      onUpdateTransaction?.(transaction);
      return;
    }

    onAddTransaction(transaction);
    resetForm({ setType, setTradeDate, setAmount, setNav });
    setOpen(false);
  };

  const handleCancel = () => {
    if (isEditing) {
      onCancelEdit?.();
      return;
    }

    resetForm({ setType, setTradeDate, setAmount, setNav });
    setOpen(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <button
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
          onClick={() => {
            if (isEditing) {
              return;
            }

            resetForm({ setType, setTradeDate, setAmount, setNav });
            setOpen(true);
          }}
          type="button"
        >
          添加交易记录
        </button>
      </div>

      {isFormOpen ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="grid gap-1 text-sm text-slate-700">
            <span>记录类型</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={type}
              onChange={(event) => setType(event.target.value as FundTransactionType)}
            >
              <option value="buy">买入</option>
              <option value="sell">卖出</option>
              <option value="cash_dividend">现金分红</option>
              <option value="reinvest_dividend">红利再投资</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            <span>交易日期</span>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              type="date"
              value={tradeDate}
              onChange={(event) => setTradeDate(event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            <span>{amountLabel}</span>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          {usesNav ? (
            <label className="grid gap-1 text-sm text-slate-700">
              <span>净值</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                inputMode="decimal"
                value={nav}
                onChange={(event) => setNav(event.target.value)}
              />
            </label>
          ) : null}

          <div className="flex gap-2">
            <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" onClick={handleSave} type="button">
              {isEditing ? '保存修改' : '保存记录'}
            </button>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={handleCancel} type="button">
              取消
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
