'use client';

import React, { useEffect, useState } from 'react';

import { useAutoNav } from '@/lib/hooks/use-auto-nav';
import type { FundTradePeriod, FundTransaction, FundTransactionType } from '@/lib/funds/types';

type AddTransactionDialogProps =
  | {
      fundCode: string;
      onAddTransaction: (transaction: FundTransaction) => void;
      editingTransaction?: null;
      onUpdateTransaction?: never;
      onCancelEdit?: () => void;
      validateBusinessRules?: (transaction: FundTransaction) => string | null;
    }
  | {
      fundCode: string;
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
  fee?: string;
};

type TransactionFormInput = {
  id?: string;
  type: FundTransactionType;
  tradeDate: string;
  period: FundTradePeriod;
  amount: string;
  nav: string;
  fee: string;
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
  setPeriod: (value: FundTradePeriod) => void;
  setAmount: (value: string) => void;
  setNav: (value: string) => void;
  setFee: (value: string) => void;
  setNavHint?: (value: string | null) => void;
  resetAutoNav?: () => void;
}) {
  setters.setType('buy');
  setters.setTradeDate('');
  setters.setPeriod('before_1500');
  setters.setAmount('');
  setters.setNav('');
  setters.setFee('');
  setters.setNavHint?.(null);
  setters.resetAutoNav?.();
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function applyTransactionToForm(
  transaction: FundTransaction,
  setters: {
    setType: (value: FundTransactionType) => void;
    setTradeDate: (value: string) => void;
    setPeriod: (value: FundTradePeriod) => void;
    setAmount: (value: string) => void;
    setNav: (value: string) => void;
    setFee: (value: string) => void;
  }
) {
  const values = getFormValues(transaction);

  setters.setType(values.type);
  setters.setTradeDate(values.tradeDate);
  setters.setPeriod(values.period);
  setters.setAmount(values.amount);
  setters.setNav(values.nav);
  setters.setFee(values.fee);
}

function resolveTransaction(
  input: TransactionFormInput,
  options?: {
    resolvedNav?: number | null;
    allowManualNav?: boolean;
    navErrorMessage?: string;
  }
): { errors: FieldErrors; transaction: FundTransaction | null } {
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
    const nav =
      options?.resolvedNav ??
      (options?.allowManualNav === false ? Number.NaN : Number(input.nav));

    if (!Number.isFinite(nav) || nav <= 0) {
      errors.nav = options?.navErrorMessage ?? '请输入大于 0 的净值';
    }
  }

  if (input.fee) {
    const fee = Number(input.fee);

    if (!Number.isFinite(fee) || fee < 0) {
      errors.fee = '请输入大于等于 0 的手续费';
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      transaction: null,
    };
  }

  const id = input.id ?? `tx-${Date.now()}`;
  const effectiveDate = input.period === 'after_1500' ? addDays(input.tradeDate, 1) : input.tradeDate;
  const fee = input.fee ? Number(input.fee) : undefined;
  const base = {
    id,
    note: undefined,
    fee,
    placedDate: input.tradeDate,
    placedPeriod: input.period,
    effectiveDate,
    source: 'manual' as const,
  };

  if (input.type === 'cash_dividend') {
    return {
      errors,
      transaction: {
        ...base,
        type: 'cash_dividend',
        amount,
      },
    };
  }

  const nav = options?.resolvedNav ?? Number(input.nav);

  if (input.type === 'buy') {
    return {
      errors,
      transaction: {
        ...base,
        type: 'buy',
        amount,
        confirmedNav: nav,
      },
    };
  }

  if (input.type === 'reinvest_dividend') {
    return {
      errors,
      transaction: {
        ...base,
        type: 'reinvest_dividend',
        amount,
        confirmedNav: nav,
      },
    };
  }

  return {
    errors,
    transaction: {
      ...base,
      type: 'sell',
      shares: amount,
      confirmedNav: nav,
    },
  };
}

function getFormValues(transaction: FundTransaction) {
  const tradeDate = 'placedDate' in transaction ? transaction.placedDate : transaction.tradeDate;
  const period = 'placedPeriod' in transaction ? transaction.placedPeriod : 'before_1500';
  const nav = 'confirmedNav' in transaction ? String(transaction.confirmedNav) : 'nav' in transaction ? String(transaction.nav) : '';

  return {
    type: transaction.type,
    tradeDate,
    period,
    amount: String(transaction.type === 'sell' ? transaction.shares : transaction.amount),
    nav,
    fee: typeof transaction.fee === 'number' ? String(transaction.fee) : '',
  };
}

export function AddTransactionDialog({
  fundCode,
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
  const [period, setPeriod] = useState<FundTradePeriod>('before_1500');
  const [amount, setAmount] = useState('');
  const [nav, setNav] = useState('');
  const [fee, setFee] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [navHint, setNavHint] = useState<string | null>(null);
  const [isNavRefreshRequested, setIsNavRefreshRequested] = useState(false);
  const { state: autoNavState, fetchNav, reset: resetAutoNav } = useAutoNav();

  useEffect(() => {
    if (editingTransaction) {
      applyTransactionToForm(editingTransaction, { setType, setTradeDate, setPeriod, setAmount, setNav, setFee });
      setFieldErrors({});
      setBusinessError(null);
      setNavHint(null);
      setIsNavRefreshRequested(false);
      resetAutoNav();
      setOpen(false);
      return;
    }

    resetForm({ setType, setTradeDate, setPeriod, setAmount, setNav, setFee });
    setFieldErrors({});
    setBusinessError(null);
    setNavHint(null);
    setIsNavRefreshRequested(false);
    resetAutoNav();
  }, [editingTransaction]);

  const isEditing = editingTransaction !== null;
  const isFormOpen = isEditing || open;
  const usesNav = type !== 'cash_dividend';
  const resolvedAutoNav = !isEditing && usesNav && autoNavState.error === null ? autoNavState.nav : null;
  const shouldShowManualNavInput = usesNav && isEditing;
  const createRequiresAutoNav = !isEditing && usesNav;
  const amountLabel = type === 'sell' ? '份额' : '金额';
  const title = isEditing ? '编辑交易记录' : '交易记录';
  const description = isEditing ? '修改已有交易记录。' : '添加买入、卖出、现金分红或红利再投资记录。';
  const navInputId = isEditing ? 'transaction-nav-edit' : 'transaction-nav-create';

  useEffect(() => {
    if (!usesNav || !tradeDate || isEditing) {
      resetAutoNav();
      setNavHint(null);
      return;
    }

    fetchNav(fundCode, tradeDate, period);
  }, [usesNav, tradeDate, period, isEditing, fundCode]);

  useEffect(() => {
    if (autoNavState.effectiveDate) {
      setNavHint(autoNavState.effectiveDate === tradeDate ? null : `净值日期: ${autoNavState.effectiveDate}`);
    }

    if (!isEditing || !isNavRefreshRequested) {
      return;
    }

    if (autoNavState.nav) {
      setNav(String(autoNavState.nav));
      setFieldErrors((current) => {
        if (!current.nav) {
          return current;
        }

        const { nav: _nav, ...rest } = current;
        return rest;
      });
      setIsNavRefreshRequested(false);
      return;
    }

    if (autoNavState.error) {
      setIsNavRefreshRequested(false);
    }
  }, [autoNavState.nav, autoNavState.effectiveDate, autoNavState.error, isEditing, isNavRefreshRequested, tradeDate]);

  const getCurrentFormInput = (): TransactionFormInput => ({
    id: editingTransaction?.id,
    type,
    tradeDate,
    period,
    amount,
    nav,
    fee,
  });

  const getResolvedNav = (nextInput: TransactionFormInput) => {
    if (nextInput.type === 'cash_dividend') {
      return null;
    }

    if (!isEditing && resolvedAutoNav !== null) {
      return resolvedAutoNav;
    }

    return null;
  };

  const syncFieldErrors = (nextInput: TransactionFormInput) => {
    if (Object.keys(fieldErrors).length === 0) {
      return;
    }

    setFieldErrors(
      resolveTransaction(nextInput, {
        resolvedNav: getResolvedNav(nextInput),
        allowManualNav: !createRequiresAutoNav,
        navErrorMessage: createRequiresAutoNav
          ? '未能自动获取净值，请确认交易日期和下单时段后重试'
          : undefined,
      }).errors,
    );
  };

  const handleSave = () => {
    const currentInput = getCurrentFormInput();
    const { errors, transaction } = resolveTransaction(currentInput, {
      resolvedNav: getResolvedNav(currentInput),
      allowManualNav: !createRequiresAutoNav,
      navErrorMessage: createRequiresAutoNav
        ? '未能自动获取净值，请确认交易日期和下单时段后重试'
        : undefined,
    });
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
    resetForm({ setType, setTradeDate, setPeriod, setAmount, setNav, setFee, setNavHint, resetAutoNav });
    setFieldErrors({});
    setBusinessError(null);
    setOpen(false);
  };

  const handleCancel = () => {
    if (isEditing) {
      setFieldErrors({});
      setBusinessError(null);
      setNavHint(null);
      resetAutoNav();
      onCancelEdit?.();
      return;
    }

    resetForm({ setType, setTradeDate, setPeriod, setAmount, setNav, setFee, setNavHint, resetAutoNav });
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

            resetForm({ setType, setTradeDate, setPeriod, setAmount, setNav, setFee, setNavHint, resetAutoNav });
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
                if (!isEditing) {
                  setNav('');
                }
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
                if (!isEditing) {
                  setNav('');
                }
                syncFieldErrors({
                  ...getCurrentFormInput(),
                  tradeDate: nextTradeDate,
                });
              }}
            />
            {fieldErrors.tradeDate ? <p className="text-sm text-rose-600">{fieldErrors.tradeDate}</p> : null}
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            <span>下单时段</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={period}
              onChange={(event) => {
                const nextPeriod = event.target.value as FundTradePeriod;
                setPeriod(nextPeriod);
                setBusinessError(null);
                if (!isEditing) {
                  setNav('');
                }
                syncFieldErrors({
                  ...getCurrentFormInput(),
                  period: nextPeriod,
                });
              }}
            >
              <option value="before_1500">15 点前</option>
              <option value="after_1500">15 点后</option>
            </select>
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

          <label className="grid gap-1 text-sm text-slate-700">
            <span>手续费</span>
            <input
              aria-invalid={fieldErrors.fee ? 'true' : 'false'}
              className="rounded-lg border border-slate-300 px-3 py-2"
              inputMode="decimal"
              value={fee}
              onChange={(event) => {
                const nextFee = event.target.value;
                setFee(nextFee);
                setBusinessError(null);
                syncFieldErrors({
                  ...getCurrentFormInput(),
                  fee: nextFee,
                });
              }}
            />
            {fieldErrors.fee ? <p className="text-sm text-rose-600">{fieldErrors.fee}</p> : null}
          </label>

          {usesNav ? (
            <div className="grid gap-2 text-sm text-slate-700">
              {!isEditing && !tradeDate ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                  选择交易日期后自动获取净值
                </div>
              ) : null}

              {!isEditing && tradeDate && autoNavState.loading ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  正在自动获取净值...
                </div>
              ) : null}

              {!isEditing && resolvedAutoNav !== null ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="font-medium text-emerald-900">已自动获取净值</p>
                  <p className="mt-1 text-base font-semibold text-emerald-900">{resolvedAutoNav.toFixed(4)}</p>
                  {navHint ? <p className="mt-1 text-xs text-emerald-800">{navHint}</p> : null}
                </div>
              ) : null}

              {!isEditing && autoNavState.error ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
                  <p className="font-medium text-amber-900">未能自动获取净值</p>
                  <p className="mt-1">{autoNavState.error}</p>
                  {navHint ? <p className="mt-1 text-xs text-amber-800">{navHint}</p> : null}
                  {fieldErrors.nav ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.nav}</p> : null}
                </div>
              ) : null}

              {shouldShowManualNavInput ? (
                <label className="grid gap-1 text-sm text-slate-700" htmlFor={navInputId}>
                  <span>净值</span>
                  <div className="relative">
                    <input
                      id={navInputId}
                      aria-label="净值"
                      aria-invalid={fieldErrors.nav ? 'true' : 'false'}
                      className="rounded-lg border border-slate-300 px-3 py-2 w-full"
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
                    {isEditing && autoNavState.loading ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        获取中...
                      </span>
                    ) : null}
                  </div>
                  {fieldErrors.nav ? <p className="text-sm text-rose-600">{fieldErrors.nav}</p> : null}
                  {autoNavState.error ? <p className="text-sm text-amber-600">{autoNavState.error}</p> : null}
                  {navHint ? <p className="text-xs text-slate-500">{navHint}</p> : null}
                </label>
              ) : null}

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                    onClick={() => {
                      setBusinessError(null);
                      setIsNavRefreshRequested(true);
                      fetchNav(fundCode, tradeDate, period);
                    }}
                    type="button"
                  >
                    重新获取净值
                  </button>
                  {!autoNavState.loading ? (
                    <p className="text-xs text-slate-500">编辑时不会自动覆盖已保存净值。</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {businessError ? <p className="text-sm text-rose-600">{businessError}</p> : null}

          <div className="flex gap-2">
            <button
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createRequiresAutoNav && autoNavState.loading}
              onClick={handleSave}
              type="button"
            >
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
