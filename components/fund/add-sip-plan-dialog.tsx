'use client';

import React, { useState } from 'react';

import type { FundTradePeriod, SipPlan } from '@/lib/funds/types';

interface AddSipPlanDialogProps {
  onAddPlan: (plan: SipPlan) => void;
}

type FieldErrors = {
  amount?: string;
  startDate?: string;
  executionTime?: string;
};

const defaultExecutionPeriod: FundTradePeriod = 'before_1500';

function getNextExecutionAt(startDate: string, executionTime: string) {
  return `${startDate}T${executionTime}:00.000Z`;
}

export function AddSipPlanDialog({ onAddPlan }: AddSipPlanDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [executionTime, setExecutionTime] = useState('14:30');
  const [executionPeriod, setExecutionPeriod] = useState<FundTradePeriod>(defaultExecutionPeriod);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const resetForm = () => {
    setAmount('');
    setStartDate('');
    setEndDate('');
    setExecutionTime('14:30');
    setExecutionPeriod(defaultExecutionPeriod);
    setFieldErrors({});
  };

  const handleSave = () => {
    const nextErrors: FieldErrors = {};
    const normalizedAmount = Number(amount);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      nextErrors.amount = '请输入大于 0 的定投金额';
    }

    if (!startDate) {
      nextErrors.startDate = '请选择开始日期';
    }

    if (!executionTime) {
      nextErrors.executionTime = '请选择执行时间';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    onAddPlan({
      id: `sip-${Date.now()}`,
      amount: normalizedAmount,
      frequency: 'monthly',
      startDate,
      ...(endDate ? { endDate } : {}),
      executionTime,
      executionPeriod,
      status: 'active',
      nextExecutionAt: getNextExecutionAt(startDate, executionTime),
    });

    resetForm();
    setOpen(false);
  };

  const handleCancel = () => {
    resetForm();
    setOpen(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">定投设置</h2>
          <p className="mt-1 text-sm text-slate-500">先记录计划规则，后续再接自动生成与执行链路。</p>
        </div>
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? '收起定投计划' : '添加定投计划'}
        </button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">定投金额</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            {fieldErrors.amount ? <p className="text-sm text-rose-600">{fieldErrors.amount}</p> : null}
          </label>

          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">开始日期</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            {fieldErrors.startDate ? <p className="text-sm text-rose-600">{fieldErrors.startDate}</p> : null}
          </label>

          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">结束日期</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">执行时间</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0"
              type="time"
              value={executionTime}
              onChange={(event) => setExecutionTime(event.target.value)}
            />
            {fieldErrors.executionTime ? (
              <p className="text-sm text-rose-600">{fieldErrors.executionTime}</p>
            ) : null}
          </label>

          <label className="space-y-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">执行时段</span>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-0"
              value={executionPeriod}
              onChange={(event) => setExecutionPeriod(event.target.value as FundTradePeriod)}
            >
              <option value="before_1500">15点前</option>
              <option value="after_1500">15点后</option>
            </select>
          </label>

          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              type="button"
              onClick={handleCancel}
            >
              取消
            </button>
            <button
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
              type="button"
              onClick={handleSave}
            >
              保存计划
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
