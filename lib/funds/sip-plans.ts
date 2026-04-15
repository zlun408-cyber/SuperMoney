import type {
  BuyTransaction,
  FundTransaction,
  SipExecutionRecord,
  SipPlan,
  SipPlanStatus,
} from '@/lib/funds/types';

interface MaterializeSipPlansInput {
  fundId: string;
  plans: SipPlan[];
  transactions: FundTransaction[];
  executionRecords: SipExecutionRecord[];
  now: string;
  resolveConfirmedNav: (plan: SipPlan) => number | null;
}

interface MaterializeSipPlansResult {
  updatedPlans: SipPlan[];
  createdTransactions: BuyTransaction[];
  updatedExecutionRecords: SipExecutionRecord[];
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
  return transactions.find(
    (transaction) =>
      'sourcePlanId' in transaction &&
      transaction.source === 'sip_plan' &&
      transaction.sourcePlanId === planId &&
      transaction.placedDate === placedDate,
  );
}

function buildSipExecutionRecord(params: {
  fundId: string;
  planId: string;
  executionDate: string;
  now: string;
}): SipExecutionRecord {
  return {
    id: `${params.planId}-${params.executionDate}`,
    planId: params.planId,
    fundId: params.fundId,
    executionDate: params.executionDate,
    status: 'pending',
    createdAt: params.now,
    updatedAt: params.now,
  };
}

function findExecutionRecordIndex(
  executionRecords: SipExecutionRecord[],
  planId: string,
  executionDate: string,
) {
  return executionRecords.findIndex(
    (record) => record.planId === planId && record.executionDate === executionDate,
  );
}

function markExecutionRecordGenerated(
  executionRecord: SipExecutionRecord,
  transactionId: string,
  generatedAt: string,
): SipExecutionRecord {
  return {
    ...executionRecord,
    status: 'generated',
    transactionId,
    generatedAt,
    skippedAt: undefined,
    skipReason: undefined,
    updatedAt: generatedAt,
  };
}

export function markSipExecutionSkippedAfterDeletion({
  executionRecords,
  transaction,
  skippedAt,
}: {
  executionRecords: SipExecutionRecord[];
  transaction: FundTransaction;
  skippedAt: string;
}): SipExecutionRecord[] {
  if (!('sourcePlanId' in transaction) || transaction.source !== 'sip_plan') {
    return executionRecords;
  }

  return executionRecords.map((executionRecord) => {
    const matchesRecord =
      executionRecord.planId === transaction.sourcePlanId &&
      executionRecord.executionDate === transaction.placedDate &&
      executionRecord.status === 'generated';

    if (!matchesRecord) {
      return executionRecord;
    }

    return {
      ...executionRecord,
      status: 'skipped' as const,
      transactionId: undefined,
      skippedAt,
      skipReason: 'deleted_generated_transaction' as const,
      updatedAt: skippedAt,
    };
  });
}

export function materializeSipPlans({
  fundId,
  plans,
  transactions,
  executionRecords,
  now,
  resolveConfirmedNav,
}: MaterializeSipPlansInput): MaterializeSipPlansResult {
  const createdTransactions: BuyTransaction[] = [];
  const allTransactions = [...transactions];
  const updatedExecutionRecords = [...executionRecords];
  const nowTimestamp = new Date(now).getTime();

  const updatedPlans = plans.map((plan) => {
    if (plan.status === 'ended' || !plan.nextExecutionAt) {
      return plan;
    }

    if (new Date(plan.nextExecutionAt).getTime() > nowTimestamp) {
      return plan;
    }

    let cursor: string | undefined = plan.nextExecutionAt;
    let status: SipPlanStatus = plan.status;
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

      const executionRecordIndex = findExecutionRecordIndex(updatedExecutionRecords, plan.id, placedDate);
      const executionRecord =
        executionRecordIndex >= 0
          ? updatedExecutionRecords[executionRecordIndex]
          : buildSipExecutionRecord({
              fundId,
              planId: plan.id,
              executionDate: placedDate,
              now,
            });

      if (executionRecordIndex < 0) {
        updatedExecutionRecords.push(executionRecord);
      }

      if (executionRecord.status === 'pending') {
        const existingGeneratedTransaction = hasGeneratedTransactionForExecution(allTransactions, plan.id, placedDate);

        if (existingGeneratedTransaction) {
          const nextRecord = markExecutionRecordGenerated(executionRecord, existingGeneratedTransaction.id, now);

          if (executionRecordIndex >= 0) {
            updatedExecutionRecords[executionRecordIndex] = nextRecord;
          } else {
            updatedExecutionRecords[updatedExecutionRecords.length - 1] = nextRecord;
          }
        } else {
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

          const nextRecord = markExecutionRecordGenerated(executionRecord, createdTransaction.id, now);

          if (executionRecordIndex >= 0) {
            updatedExecutionRecords[executionRecordIndex] = nextRecord;
          } else {
            updatedExecutionRecords[updatedExecutionRecords.length - 1] = nextRecord;
          }
        }
      }

      const latestExecutionRecord =
        updatedExecutionRecords[
          executionRecordIndex >= 0 ? executionRecordIndex : updatedExecutionRecords.length - 1
        ];

      if (latestExecutionRecord.status === 'pending') {
        break;
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
    updatedExecutionRecords,
  };
}
