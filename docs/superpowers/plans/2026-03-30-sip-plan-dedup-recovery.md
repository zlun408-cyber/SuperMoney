# SIP 定投去重与补生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SIP auto-materialization idempotent per plan period and able to catch up recent missed periods without generating duplicates.

**Architecture:** Keep the current `materializeSipPlans` interface and data model, but refactor the implementation from single-shot execution into per-plan iterative replay from `nextExecutionAt` up to `now`. Use the existing business dedupe key (`source = sip_plan`, `sourcePlanId`, `placedDate`) to decide whether to create a buy record or only advance the plan, and stop replay immediately when a due period lacks a confirmed NAV.

**Tech Stack:** TypeScript, React hook state, Vitest

---

## Planned file changes

### Modify
- `lib/funds/sip-plans.ts` — replace single-period materialization with iterative catch-up replay while preserving current helper rules for `effectiveDate`, frequency stepping, and ended-state transitions
- `tests/lib/funds/sip-plans.test.ts` — cover dedupe, catch-up replay, missing-NAV stop behavior, and end-date progression
- `PROJECT_STATUS.md` — record this mainline step when finished
- `WORKLOG.md` — append today’s work summary
- `NEXT_STEPS.md` — move the next unfinished mainline item forward
- `SESSION_RESUME.md` — refresh session handoff notes

### Reuse
- `lib/hooks/use-watchlist.ts` — keep current call site and returned shape unchanged
- `lib/funds/types.ts` — keep current `SipPlan` and transaction types unchanged

## Task 1: Lock in expected replay behavior with tests

**Files:**
- Test: `tests/lib/funds/sip-plans.test.ts`

- [ ] **Step 1: Write a failing test for duplicate prevention when the current period auto-buy already exists**

```ts
it('advances the plan without creating a duplicate when the current SIP period already exists', () => {
  const result = materializeSipPlans({
    plans: [activeMonthlyPlan()],
    transactions: [existingSipBuy('plan-1', '2026-03-10')],
    now: '2026-03-10T10:00:00.000Z',
    resolveConfirmedNav: () => 1.2345,
  });

  expect(result.createdTransactions).toEqual([]);
  expect(result.updatedPlans[0]?.lastExecutedAt).toBe('2026-03-10T10:00:00.000Z');
  expect(result.updatedPlans[0]?.nextExecutionAt).toBe('2026-04-10T10:00:00.000Z');
});
```

- [ ] **Step 2: Write a failing test for replaying multiple missed periods and generating only the missing ones**

```ts
it('replays due periods up to now and only creates missing SIP buys', () => {
  const result = materializeSipPlans({
    plans: [activeWeeklyPlan()],
    transactions: [existingSipBuy('plan-1', '2026-03-03')],
    now: '2026-03-20T10:00:00.000Z',
    resolveConfirmedNav: () => 1.2,
  });

  expect(result.createdTransactions.map((tx) => tx.placedDate)).toEqual(['2026-03-10', '2026-03-17']);
  expect(result.updatedPlans[0]?.nextExecutionAt).toBe('2026-03-24T10:00:00.000Z');
});
```

- [ ] **Step 3: Write a failing test for missing NAV halting replay without advancing the blocked period**

```ts
it('stops replay when a due period has no confirmed NAV', () => {
  const result = materializeSipPlans({
    plans: [activeDailyPlan()],
    transactions: [],
    now: '2026-03-12T10:00:00.000Z',
    resolveConfirmedNav: () => null,
  });

  expect(result.createdTransactions).toEqual([]);
  expect(result.updatedPlans[0]?.lastExecutedAt).toBeUndefined();
  expect(result.updatedPlans[0]?.nextExecutionAt).toBe('2026-03-10T10:00:00.000Z');
});
```

- [ ] **Step 4: Write a failing test for ending the plan after the last due replayed period**

```ts
it('marks the plan ended after replay consumes the final due period before endDate', () => {
  const result = materializeSipPlans({
    plans: [activeMonthlyPlan({ endDate: '2026-03-31' })],
    transactions: [],
    now: '2026-03-31T10:00:00.000Z',
    resolveConfirmedNav: () => 1.1,
  });

  expect(result.createdTransactions).toHaveLength(1);
  expect(result.updatedPlans[0]?.status).toBe('ended');
  expect(result.updatedPlans[0]?.nextExecutionAt).toBeUndefined();
});
```

- [ ] **Step 5: Run the focused test file and confirm the new expectations fail under the current implementation**

Run: `npx vitest run tests/lib/funds/sip-plans.test.ts`
Expected: FAIL on the newly added replay/dedupe assertions because current code only handles one due period per call.

- [ ] **Step 6: Commit the test-only change**

```bash
git add tests/lib/funds/sip-plans.test.ts
git commit -m "test: cover sip plan replay and dedupe"
```

## Task 2: Refactor SIP materialization to iterative replay

**Files:**
- Modify: `lib/funds/sip-plans.ts`
- Test: `tests/lib/funds/sip-plans.test.ts`

- [ ] **Step 1: Implement per-plan replay loop from `nextExecutionAt` through all due periods up to `now`**

```ts
let cursor = plan.nextExecutionAt;
let lastExecutedAt = plan.lastExecutedAt;
let status = plan.status;

while (cursor && new Date(cursor).getTime() <= nowTimestamp) {
  const placedDate = toDateOnly(cursor);
  const exists = hasGeneratedTransactionForExecution(allTransactions, plan.id, placedDate);

  if (!exists) {
    const confirmedNav = resolveConfirmedNav(plan);
    if (confirmedNav === null) {
      break;
    }

    createdTransactions.push(createSipBuy(plan, cursor, confirmedNav));
    allTransactions.push(createdTransactions[createdTransactions.length - 1]);
  }

  lastExecutedAt = cursor;
  const upcomingExecutionAt = getNextExecutionAt(plan, cursor);
  if (isPastPlanEnd(plan, upcomingExecutionAt)) {
    status = 'ended';
    cursor = undefined;
    break;
  }

  cursor = upcomingExecutionAt;
}
```

- [ ] **Step 2: Preserve existing helper behavior for `effectiveDate` and ended-state computation while ensuring newly created buys participate in same-run dedupe**

```ts
const allTransactions = [...transactions];

function appendCreatedTransaction(tx: BuyTransaction) {
  createdTransactions.push(tx);
  allTransactions.push(tx);
}
```

- [ ] **Step 3: Keep the function return shape unchanged so `useWatchlist` does not need a contract change**

```ts
return {
  updatedPlans,
  createdTransactions,
};
```

- [ ] **Step 4: Run the focused test file and confirm it passes**

Run: `npx vitest run tests/lib/funds/sip-plans.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the replay implementation**

```bash
git add lib/funds/sip-plans.ts tests/lib/funds/sip-plans.test.ts
git commit -m "feat: replay due sip plan periods safely"
```

## Task 3: Run regression coverage around SIP call sites

**Files:**
- Modify: none unless regression failures require minimal fixes
- Reuse: `lib/hooks/use-watchlist.ts`
- Test: `tests/lib/hooks/use-watchlist.test.tsx`

- [ ] **Step 1: Run hook-level regression tests that exercise watchlist materialization behavior**

Run: `npx vitest run tests/lib/hooks/use-watchlist.test.tsx`
Expected: PASS

- [ ] **Step 2: If a regression appears, add the smallest test that captures the broken contract before fixing it**

```ts
it('keeps using the same materialize result shape for watchlist updates', () => {
  expect(result.current.watchlist[0]?.sipPlans?.[0]?.nextExecutionAt).toBeDefined();
});
```

- [ ] **Step 3: Apply the minimal compatibility fix only if needed, then rerun the hook test file**

Run: `npx vitest run tests/lib/hooks/use-watchlist.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit any compatibility fix if one was needed**

```bash
git add lib/hooks/use-watchlist.ts tests/lib/hooks/use-watchlist.test.tsx
git commit -m "fix: preserve watchlist sip materialization contract"
```

## Task 4: Final verification and project log updates

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `WORKLOG.md`
- Modify: `NEXT_STEPS.md`
- Modify: `SESSION_RESUME.md`

- [ ] **Step 1: Run the targeted SIP regression suite together**

Run: `npx vitest run tests/lib/funds/sip-plans.test.ts tests/lib/hooks/use-watchlist.test.tsx`
Expected: PASS

- [ ] **Step 2: Update project tracking docs to record the completed SIP dedupe/catch-up work and point the next mainline task at transaction form NAV simplification**

```md
- 已完成：定投计划自动生成更多去重边界与最近漏期补生成
- 下一步：继续推进交易记录录入表单去手填净值
```

- [ ] **Step 3: Run the full unit suite if the focused regression passes cleanly**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: Commit the verification and doc updates**

```bash
git add PROJECT_STATUS.md WORKLOG.md NEXT_STEPS.md SESSION_RESUME.md
git commit -m "docs: record sip replay hardening progress"
```
