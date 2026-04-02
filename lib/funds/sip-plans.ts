import type { BuyTransaction, FundTransaction, SipPlan } from '@/lib/funds/types';

interface MaterializeSipPlansInput {
  plans: SipPlan[];
  transactions: FundTransaction[];
  now: string;
  resolveConfirmedNav: (plan: SipPlan) => number | null;
}

interface MaterializeSipPlansResult {
  updatedPlans: SipPlan[];
  createdTransactions: BuyTransaction[];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function toDateOnly(isoString: string) {
  return isoString.slice(0, 10);
}

function toIsoString(date: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0, 0),
  ).toISOString();
}

function getNextExecutionAt(plan: SipPlan, executionAt: string) {
  const current = new Date(executionAt);

  switch (plan.frequency) {
    case 'daily':
      return toIsoString(addDays(current, 1), plan.executionTime);
    case 'weekly':
      return toIsoString(addDays(current, 7), plan.executionTime);
    case 'monthly':
      return toIsoString(addMonths(current, 1), plan.executionTime);
  }
}

function resolveEffectiveDate(placedDate: string, executionPeriod: SipPlan['executionPeriod']) {
  if (executionPeriod === 'before_1500') {
    return placedDate;
  }

  return toDateOnly(addDays(new Date(`${placedDate}T00:00:00.000Z`), 1).toISOString());
}

function isPastPlanEnd(plan: SipPlan, nextExecutionAt: string) {
  if (!plan.endDate) {
    return false;
  }

  return nextExecutionAt > `${plan.endDate}T23:59:59.999Z`;
}

function hasGeneratedTransactionForExecution(
  transactions: FundTransaction[],
  planId: string,
  placedDate: string,
) {
  return transactions.some(
    (transaction) =>
      'sourcePlanId' in transaction &&
      transaction.source === 'sip_plan' &&
      transaction.sourcePlanId === planId &&
      transaction.placedDate === placedDate,
  );
}

export function materializeSipPlans({
  plans,
  transactions,
  now,
  resolveConfirmedNav,
}: MaterializeSipPlansInput): MaterializeSipPlansResult {
  const createdTransactions: BuyTransaction[] = [];
  const allTransactions = [...transactions];
  const nowTimestamp = new Date(now).getTime();

  const updatedPlans = plans.map((plan) => {
    if (plan.status === 'ended' || !plan.nextExecutionAt) {
      return plan;
    }

    if (new Date(plan.nextExecutionAt).getTime() > nowTimestamp) {
      return plan;
    }

    let cursor = plan.nextExecutionAt;
    let status = plan.status;
    let lastExecutedAt = plan.lastExecutedAt;
    let hasChanged = false;

    while (cursor && new Date(cursor).getTime() <= nowTimestamp) {
      const placedDate = toDateOnly(cursor);
      const upcomingExecutionAt = getNextExecutionAt(plan, cursor);
      const nextStatus = isPastPlanEnd(plan, upcomingExecutionAt) ? 'ended' : status;

      if (status === 'paused') {
        hasChanged = true;

        if (nextStatus === 'ended') {
          status = 'ended';
          cursor = undefined;
          break;
        }

        cursor = upcomingExecutionAt;
        continue;
      }

      if (!hasGeneratedTransactionForExecution(allTransactions, plan.id, placedDate)) {
        const confirmedNav = resolveConfirmedNav(plan);

        if (confirmedNav === null) {
          break;
        }

        const createdTransaction: BuyTransaction = {
          id: `${plan.id}-${placedDate}`,
          type: 'buy',
          amount: plan.amount,
          confirmedNav,
          placedDate,
          placedPeriod: plan.executionPeriod,
          effectiveDate: resolveEffectiveDate(placedDate, plan.executionPeriod),
          source: 'sip_plan',
          sourcePlanId: plan.id,
        };

        createdTransactions.push(createdTransaction);
        allTransactions.push(createdTransaction);
      }

      hasChanged = true;
      lastExecutedAt = cursor;

      if (nextStatus === 'ended') {
        status = 'ended';
        cursor = undefined;
        break;
      }

      status = 'active';
      cursor = upcomingExecutionAt;
    }

    if (!hasChanged) {
      return plan;
    }

    return {
      ...plan,
      lastExecutedAt,
      nextExecutionAt: status === 'ended' ? undefined : cursor,
      status,
    };
  });

  return {
    updatedPlans,
    createdTransactions,
  };
}
