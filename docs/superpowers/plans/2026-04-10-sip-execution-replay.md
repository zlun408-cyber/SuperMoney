# SIP Execution Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add execution record persistence and replay semantics for SIP plans, including skipped behavior after deleting generated transactions.

**Architecture:** Extend the SIP domain to treat execution records as the source of truth for replay, then wire the same model into local storage and Supabase sync. Keep transaction generation minimal and deterministic so replay can be tested with pure unit tests before persistence integration.

**Tech Stack:** TypeScript, Vitest, localStorage, Supabase SQL, Supabase JS client

---

### Task 1: Add failing SIP replay domain tests

**Files:**
- Create: `tests/lib/funds/sip-plans.test.ts`
- Modify: `lib/funds/sip-plans.ts`
- Test: `tests/lib/funds/sip-plans.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('creates a generated execution record when a due plan resolves nav', () => {
  const result = materializeSipPlans({
    plans: [plan],
    transactions: [],
    executionRecords: [],
    now: '2026-04-10T10:00:00.000Z',
    resolveConfirmedNav: () => 1.25,
  });

  expect(result.createdTransactions).toHaveLength(1);
  expect(result.updatedExecutionRecords).toEqual([
    expect.objectContaining({
      planId: 'plan-1',
      executionDate: '2026-04-10',
      status: 'generated',
      transactionId: 'plan-1-2026-04-10',
    }),
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/funds/sip-plans.test.ts`
Expected: FAIL because `executionRecords` and `updatedExecutionRecords` do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add execution record support to `MaterializeSipPlansInput/Result` and create the smallest logic necessary to produce `generated` records for due plans.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/funds/sip-plans.test.ts`
Expected: PASS

---

### Task 2: Add failing replay and skipped tests

**Files:**
- Modify: `tests/lib/funds/sip-plans.test.ts`
- Modify: `lib/funds/sip-plans.ts`
- Test: `tests/lib/funds/sip-plans.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('replays a pending execution when nav becomes available later', () => {
  // first run keeps pending
  // second run generates transaction and marks generated
});

it('does not regenerate a skipped execution', () => {
  // skipped record remains skipped and creates no transaction
});

it('does not duplicate a generated execution', () => {
  // generated record creates no second transaction
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/lib/funds/sip-plans.test.ts`
Expected: FAIL because replay state transitions are incomplete.

- [ ] **Step 3: Write minimal implementation**

Implement helpers that:
- ensure missing due executions become `pending`
- transition `pending -> generated` only after successful transaction creation
- preserve `pending` when nav resolution returns `null`
- leave `generated` and `skipped` unchanged during replay

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/lib/funds/sip-plans.test.ts`
Expected: PASS

---

### Task 3: Add failing local storage compatibility tests

**Files:**
- Create: `tests/lib/storage/watchlist-storage.test.ts`
- Modify: `lib/storage/watchlist-storage.ts`
- Test: `tests/lib/storage/watchlist-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('loads old watchlist payloads with empty sipExecutionRecords', () => {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([{ code: '000001', name: 'A' }]));
  expect(loadWatchlist()[0]?.sipExecutionRecords).toEqual([]);
});

it('persists sipExecutionRecords with the rest of the watchlist payload', () => {
  saveWatchlist([{ code: '000001', name: 'A', sipExecutionRecords: [record] }]);
  expect(JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY)!)[0].sipExecutionRecords).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/lib/storage/watchlist-storage.test.ts`
Expected: FAIL if persistence shape or compatibility behavior is missing.

- [ ] **Step 3: Write minimal implementation**

Keep `sipExecutionRecords` normalized to `[]` for old payloads and ensure save/load roundtrips the field unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/storage/watchlist-storage.test.ts`
Expected: PASS

---

### Task 4: Add failing cloud sync mapping tests

**Files:**
- Create: `tests/lib/sync/cloud-watchlist.test.ts`
- Modify: `lib/sync/cloud-watchlist.ts`
- Test: `tests/lib/sync/cloud-watchlist.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('maps fund_sip_executions rows into watchlist funds on load', async () => {
  // mocked client returns one execution record row
  // expect loadCloudWatchlist to attach sipExecutionRecords to the matching fund
});

it('writes sipExecutionRecords through replaceSipExecutions on save', async () => {
  // expect saveCloudWatchlist to call replaceSipExecutions with mapped rows
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/lib/sync/cloud-watchlist.test.ts`
Expected: FAIL because execution sync APIs and mapping do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add cloud execution row types plus `listSipExecutions` / `replaceSipExecutions`, then thread them through `loadCloudWatchlist` and `saveCloudWatchlist`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/sync/cloud-watchlist.test.ts`
Expected: PASS

---

### Task 5: Add failing skipped-after-delete domain test

**Files:**
- Modify: `tests/lib/funds/sip-plans.test.ts`
- Modify: `lib/funds/sip-plans.ts`
- Test: `tests/lib/funds/sip-plans.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('marks a generated execution as skipped after its auto transaction is deleted', () => {
  const updated = markSipExecutionSkippedAfterDeletion({
    executionRecords: [generatedRecord],
    transaction: generatedTransaction,
    skippedAt: '2026-04-10T12:00:00.000Z',
  });

  expect(updated[0]).toEqual(expect.objectContaining({
    status: 'skipped',
    transactionId: undefined,
    skipReason: 'deleted_generated_transaction',
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/funds/sip-plans.test.ts`
Expected: FAIL because deletion helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a focused helper in `lib/funds/sip-plans.ts` (or a small adjacent domain helper file if needed) that converts matching generated records to skipped.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/funds/sip-plans.test.ts`
Expected: PASS

---

### Task 6: Add Supabase migration and final verification

**Files:**
- Modify: `supabase/stage3-auth-sync.sql`
- Modify: `docs/ledger/sip-execution-replay-20260409200801-kr33/BE-LEDGER.md`
- Modify: `docs/ledger/sip-execution-replay-20260409200801-kr33/BE-DELIVERY.md`
- Modify: `docs/tasks/sip-execution-replay-20260409200801-kr33/in-progress/2026-04-09-BE-r3s4t5u6-wip.md`

- [ ] **Step 1: Add failing SQL-related sync expectation test if needed**

If `tests/lib/sync/cloud-watchlist.test.ts` does not already assert the new table name, add:

```ts
expect(replaceCalls.executionsTable).toBe('fund_sip_executions');
```

- [ ] **Step 2: Update Supabase schema**

Add `fund_sip_executions` with:
- `status text check (status in ('pending', 'generated', 'skipped'))`
- `skip_reason text`
- `unique (user_id, plan_id, execution_date)`
- indexes on `(user_id, fund_id)` and `(user_id, status)`
- updated_at trigger and RLS policies mirroring other user-owned tables

- [ ] **Step 3: Run the targeted test suite**

Run: `npm run test -- tests/lib/funds/sip-plans.test.ts tests/lib/storage/watchlist-storage.test.ts tests/lib/sync/cloud-watchlist.test.ts`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Update task and BE ledgers, then submit**

Mark delivery items complete, update BE ledger evidence paths, move task to `completed/2026-04-09-BE-r3s4t5u6-done.md`, and set task status to `DONE`.
