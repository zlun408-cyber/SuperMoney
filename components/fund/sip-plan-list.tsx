'use client';

import type { SipPlan } from '@/lib/funds/types';

interface SipPlanListProps {
  plans: SipPlan[];
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

export function SipPlanList({ plans }: SipPlanListProps) {
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
          {plans.map((plan) => (
            <li key={plan.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                  </div>
                </div>
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                  {formatStatusLabel(plan.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
