'use client';

import React, { useEffect, useState } from 'react';

import type { FundTransaction, FundTransactionType } from '@/lib/funds/types';

type AddTransactionDialogProps =
  | {
      onAddTransaction: (transaction: FundTransaction) => void;
      editingTransaction?: null;
      onUpdateTransaction?: never;
      onCancelEdit?: () => void;
      validateBusinessRules?: (transaction: FundTransaction) => string | null;
    }
  | {
      onAddTransaction: (transaction: FundTransaction) => void;
      editingTransaction: FundTransaction;
      onUpdateTransaction: (transaction: FundTransaction) => void;
      onCancelEdit?: () => void;
      validateBusinessRules?: (transaction: FundTransaction) => string | null;
    };

type FieldErrors = {
  tradeDate?: string;
  amount?: string;
  nav?: string;
};

type TransactionFormInput = {
  id?: string;
  type: FundTransactionType;
  tradeDate: string;
  amount: string;
  nav: string;
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

function resolveTransaction(input: TransactionFormInput): { errors: FieldErrors; transaction: FundTransaction | null } {
  const errors: FieldErrors = {};
  if (!input.tradeDate) {
    errors.tradeDate = '请选择交易日期';
  }

  const amount = Number(input.amount);
  const amountErrorMessage = input.type === 'sell' ? '请输入大于 0 的份额' : '请输入大于 0 的金额';

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = amountErrorMessage;
  }

  if (input.type !== 'cash_dividend') {
    const nav = Number(input.nav);

    if (!Number.isFinite(nav) || nav <= 0) {
      errors.nav = '请输入大于 0 的净值';
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      transaction: null,
    };
  }

  const id = input.id ?? `tx-${Date.now()}`;

  if (input.type === 'cash_dividend') {
    return {
      errors,
      transaction: {
        id,
        type: 'cash_dividend',
        tradeDate: input.tradeDate,
        amount,
      },
    };
  }

  const nav = Number(input.nav);

  if (input.type === 'buy') {
    return {
      errors,
      transaction: {
        id,
        type: 'buy',
        tradeDate: input.tradeDate,
        amount,
        nav,
      },
    };
  }

  if (input.type === 'reinvest_dividend') {
    return {
      errors,
      transaction: {
        id,
        type: 'reinvest_dividend',
        tradeDate: input.tradeDate,
        amount,
        nav,
      },
    };
  }

  return {
    errors,
    transaction: {
      id,
      type: 'sell',
      tradeDate: input.tradeDate,
      shares: amount,
      nav,
    },
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
  validateBusinessRules,
}: AddTransactionDialogProps) {
  invariantEditingProps(editingTransaction, onUpdateTransaction);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FundTransactionType>('buy');
  const [tradeDate, setTradeDate] = useState('');
  const [amount, setAmount] = useState('');
  const [nav, setNav] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [businessError, setBusinessError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTransaction) {
      applyTransactionToForm(editingTransaction, { setType, setTradeDate, setAmount, setNav });
      setFieldErrors({});
      setBusinessError(null);
      setOpen(false);
      return;
    }

    resetForm({ setType, setTradeDate, setAmount, setNav });
    setFieldErrors({});
    setBusinessError(null);
  }, [editingTransaction]);

  const isEditing = editingTransaction !== null;
  const isFormOpen = isEditing || open;
  const usesNav = type !== 'cash_dividend';
  const amountLabel = type === 'sell' ? '份额' : '金额';
  const title = isEditing ? '编辑交易记录' : '交易记录';
  const description = isEditing ? '修改已有交易记录。' : '添加买入、卖出、现金分红或红利再投资记录。';

  const getCurrentFormInput = (): TransactionFormInput => ({
    id: editingTransaction?.id,
    type,
    tradeDate,
    amount,
    nav,
  });

  const syncFieldErrors = (nextInput: TransactionFormInput) => {
    if (Object.keys(fieldErrors).length === 0) {
      return;
    }

    setFieldErrors(resolveTransaction(nextInput).errors);
  };

  const handleSave = () => {
    const { errors, transaction } = resolveTransaction(getCurrentFormInput());
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setBusinessError(null);
      return;
    }

    setFieldErrors({});

    if (!transaction) {
      return;
    }

    const nextBusinessError = validateBusinessRules?.(transaction) ?? null;

    if (nextBusinessError) {
      setBusinessError(nextBusinessError);
      return;
    }

    setBusinessError(null);

    if (isEditing) {
      onUpdateTransaction?.(transaction);
      return;
    }

    onAddTransaction(transaction);
    resetForm({ setType, setTradeDate, setAmount, setNav });
    setFieldErrors({});
    setBusinessError(null);
    setOpen(false);
  };

  const handleCancel = () => {
    if (isEditing) {
      setFieldErrors({});
      setBusinessError(null);
      onCancelEdit?.();
      return;
    }

    resetForm({ setType, setTradeDate, setAmount, setNav });
    setFieldErrors({});
    setBusinessError(null);
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
            setFieldErrors({});
            setBusinessError(null);
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
              onChange={(event) => {
                const nextType = event.target.value as FundTransactionType;
                setType(nextType);
                setBusinessError(null);
                syncFieldErrors({
                  ...getCurrentFormInput(),
                  type: nextType,
                });
              }}
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
              aria-invalid={fieldErrors.tradeDate ? 'true' : 'false'}
              className="rounded-lg border border-slate-300 px-3 py-2"
              type="date"
              value={tradeDate}
              onChange={(event) => {
                const nextTradeDate = event.target.value;
                setTradeDate(nextTradeDate);
                setBusinessError(null);
                syncFieldErrors({
                  ...getCurrentFormInput(),
                  tradeDate: nextTradeDate,
                });
              }}
            />
            {fieldErrors.tradeDate ? <p className="text-sm text-rose-600">{fieldErrors.tradeDate}</p> : null}
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            <span>{amountLabel}</span>
            <input
              aria-invalid={fieldErrors.amount ? 'true' : 'false'}
              className="rounded-lg border border-slate-300 px-3 py-2"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                const nextAmount = event.target.value;
                setAmount(nextAmount);
                setBusinessError(null);
                syncFieldErrors({
                  ...getCurrentFormInput(),
                  amount: nextAmount,
                });
              }}
            />
            {fieldErrors.amount ? <p className="text-sm text-rose-600">{fieldErrors.amount}</p> : null}
          </label>

          {usesNav ? (
            <label className="grid gap-1 text-sm text-slate-700">
              <span>净值</span>
              <input
                aria-invalid={fieldErrors.nav ? 'true' : 'false'}
                className="rounded-lg border border-slate-300 px-3 py-2"
                inputMode="decimal"
                value={nav}
                onChange={(event) => {
                  const nextNav = event.target.value;
                  setNav(nextNav);
                  setBusinessError(null);
                  syncFieldErrors({
                    ...getCurrentFormInput(),
                    nav: nextNav,
                  });
                }}
              />
              {fieldErrors.nav ? <p className="text-sm text-rose-600">{fieldErrors.nav}</p> : null}
            </label>
          ) : null}

          {businessError ? <p className="text-sm text-rose-600">{businessError}</p> : null}

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
