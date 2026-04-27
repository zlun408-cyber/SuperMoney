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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">定投管理计划</h3>
          <p className="mt-1 text-sm text-slate-400 font-medium uppercase tracking-wider">
            管理定期投资策略与自动生成记录
          </p>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 text-center mt-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-200">
             <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">暂无定投计划</h3>
          <p className="mt-1 text-sm text-slate-500">点击“配置定投计划”按钮开启智能跟投。</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-6">
          {plans.map((plan) => {
            const planExecutionRecords = executionRecords
              .filter((record) => record.planId === plan.id)
              .sort((left, right) => right.executionDate.localeCompare(left.executionDate));
            const latestExecution = planExecutionRecords[0];
            const isExpanded = expandedPlanIds[plan.id] ?? false;

            return (
            <li key={plan.id} className="group rounded-2xl border border-slate-200 bg-slate-50/30 p-5 ring-1 ring-slate-100 transition hover:bg-slate-50 hover:ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-slate-900">{plan.name ?? formatFrequency(plan)}</p>
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-tighter">
                      {formatStatusLabel(plan.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">定投金额</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">¥ {plan.amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">执行频率</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{formatFrequency(plan)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">执行时段</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{formatPeriodLabel(plan.executionPeriod)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                       <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                       </svg>
                       开始: {plan.startDate}
                    </span>
                    {plan.endDate && (
                      <span className="flex items-center gap-1">
                         <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                         结束: {plan.endDate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  {latestExecution && (
                    <div className="text-right">
                       <span
                        className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-tighter ring-1 ring-inset ${getExecutionStatusClassName(
                          latestExecution.status,
                        )} ring-current/20`}
                      >
                        {getExecutionStatusLabel(latestExecution.status)}
                      </span>
                    </div>
                  )}

                  {planExecutionRecords.length > 0 && (
                    <button
                      className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
                      onClick={() =>
                        setExpandedPlanIds((current) => ({
                          ...current,
                          [plan.id]: !isExpanded,
                        }))
                      }
                      type="button"
                    >
                      {isExpanded ? (
                        <>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                          收起记录
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          历史执行
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {latestExecution && latestExecution.status === 'skipped' && (
                <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/50 p-3 flex items-center gap-3">
                   <svg className="h-4 w-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                   </svg>
                   <p className="text-xs font-bold text-rose-700">本次已跳过，系统不会自动补回生成</p>
                </div>
              )}

              {isExpanded && (
                <div className="mt-6 space-y-4 pt-6 border-t border-slate-200 border-dashed">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">执行流水线</h4>
                  <ul className="space-y-2">
                    {planExecutionRecords.map((record) => (
                      <li key={record.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-slate-900">{record.executionDate}</span>
                          {record.transactionId && (
                            <span className="text-[10px] font-medium text-slate-400">ID: {record.transactionId.slice(0, 8)}</span>
                          )}
                          {getExecutionReason(record) && (
                             <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{getExecutionReason(record)}</span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ring-1 ring-inset ${getExecutionStatusClassName(
                            record.status,
                          )} ring-current/20`}
                        >
                          {record.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );})}
        </ul>
      )}
    </section>
  );
}
