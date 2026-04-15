'use client';

import { useState } from 'react';

import type { SipExecutionRecord, SipPlan } from '@/lib/funds/types';

interface SipPlanListProps {
  plans: SipPlan[];
  executionRecords?: SipExecutionRecord[];
}

function getExecutionStatusLabel(status: SipExecutionRecord['status']) {
  switch (status) {
    case 'generated':
      return '最近一次已生成';
    case 'pending':
      return '待补单 / 待生成';
    case 'skipped':
      return '本次已跳过，不会自动补回';
  }
}

function getExecutionStatusClassName(status: SipExecutionRecord['status']) {
  switch (status) {
    case 'generated':
      return 'bg-emerald-50 text-emerald-700';
    case 'pending':
      return 'bg-amber-50 text-amber-700';
    case 'skipped':
      return 'bg-rose-50 text-rose-700';
  }
}

function getExecutionReason(record: SipExecutionRecord) {
  if (record.skipReason === 'deleted_generated_transaction') {
    return '删除自动生成交易后跳过';
  }

  return null;
}

function formatFrequency(plan: SipPlan) {
  switch (plan.frequency) {
    case 'daily':
      return '每日定投';
    case 'weekly':
      return '每周定投';
    case 'monthly':
      return '每月定投';
  }
}

function formatPeriodLabel(period: SipPlan['executionPeriod']) {
  return period === 'after_1500' ? '15点后' : '15点前';
}

function formatStatusLabel(status: SipPlan['status']) {
  switch (status) {
    case 'paused':
      return '已暂停';
    case 'ended':
      return '已结束';
    case 'active':
      return '进行中';
  }
}

export function SipPlanList({ plans, executionRecords = [] }: SipPlanListProps) {
  const [expandedPlanIds, setExpandedPlanIds] = useState<Record<string, boolean>>({});

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">定投计划</h3>
        <p className="text-sm text-slate-500">独立于交易记录展示，便于后续接入自动生成。</p>
      </div>

      {plans.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          还没有定投计划
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {plans.map((plan) => {
            const planExecutionRecords = executionRecords
              .filter((record) => record.planId === plan.id)
              .sort((left, right) => right.executionDate.localeCompare(left.executionDate));
            const latestExecution = planExecutionRecords[0];
            const isExpanded = expandedPlanIds[plan.id] ?? false;

            return (
            <li key={plan.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">{plan.name ?? formatFrequency(plan)}</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <p>金额 {plan.amount.toFixed(2)}</p>
                    <p>
                      开始 {plan.startDate}
                      {plan.endDate ? ` · 结束 ${plan.endDate}` : ''}
                    </p>
                    <p>
                      执行时间 {plan.executionTime} · {formatPeriodLabel(plan.executionPeriod)}
                    </p>
                    {latestExecution ? (
                      <p className="text-sm font-medium text-slate-700">{getExecutionStatusLabel(latestExecution.status)}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                    {formatStatusLabel(plan.status)}
                  </span>
                  {latestExecution ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ${getExecutionStatusClassName(
                        latestExecution.status,
                      )}`}
                    >
                      {latestExecution.status}
                    </span>
                  ) : null}
                  {planExecutionRecords.length > 0 ? (
                    <button
                      className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
                      onClick={() =>
                        setExpandedPlanIds((current) => ({
                          ...current,
                          [plan.id]: !isExpanded,
                        }))
                      }
                      type="button"
                    >
                      {isExpanded ? '收起执行记录' : '查看执行记录'}
                    </button>
                  ) : null}
                </div>
              </div>
              {latestExecution && latestExecution.status === 'skipped' ? (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  本次已跳过，不会自动补回
                </div>
              ) : null}
              {isExpanded ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">最近执行记录</p>
                  <ul className="mt-3 space-y-2">
                    {planExecutionRecords.map((record) => (
                      <li key={record.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>{record.executionDate}</span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getExecutionStatusClassName(
                              record.status,
                            )}`}
                          >
                            {record.status}
                          </span>
                        </div>
                        {record.transactionId ? <p className="mt-1 text-slate-500">关联交易 {record.transactionId}</p> : null}
                        {getExecutionReason(record) ? <p className="mt-1 text-slate-500">{getExecutionReason(record)}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );})}
        </ul>
      )}
    </section>
  );
}
