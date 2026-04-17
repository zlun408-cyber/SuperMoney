# SIP Dedupe And Transaction Nav Form Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make new transaction records save without manual NAV entry when auto NAV succeeds, keep edit mode opt-in for NAV refresh, and tighten SIP dedupe around execution records plus historical auto-generated transactions.

**Architecture:** Keep the existing transaction form and SIP materialization flow, but split the NAV source semantics more clearly: new records can use auto NAV as the primary value while edit mode preserves the saved NAV until a user explicitly refreshes it. In the SIP domain, keep execution records as the source of truth and add a compatibility branch that repairs missing execution records from existing auto-generated transactions without creating duplicates.

**Tech Stack:** React, TypeScript, Next.js, Vitest, Playwright

---

### Task 1: Add failing transaction form tests

**Files:**
- Create: `tests/components/fund/add-transaction-dialog.test.tsx`
- Modify: `components/fund/add-transaction-dialog.tsx`
- Test: `tests/components/fund/add-transaction-dialog.test.tsx`

- [ ] Write failing tests for:
  - new record saves with auto NAV and no manual NAV typing
  - new record still requires fallback manual NAV after auto NAV failure
  - edit mode keeps existing NAV and only refreshes when user clicks an explicit action
- [ ] Run `npm run test -- tests/components/fund/add-transaction-dialog.test.tsx` and confirm RED
- [ ] Implement the minimal form changes
- [ ] Re-run the same test file and confirm GREEN

### Task 2: Add failing SIP dedupe regression tests

**Files:**
- Modify: `tests/lib/funds/sip-plans.test.ts`
- Modify: `lib/funds/sip-plans.ts`
- Test: `tests/lib/funds/sip-plans.test.ts`

- [ ] Write failing tests for:
  - missing execution record + existing auto-generated transaction repairs to `generated` without creating a duplicate transaction
  - multiple materialize calls remain idempotent
  - skipped execution remains skipped during replay
- [ ] Run `npm run test -- tests/lib/funds/sip-plans.test.ts` and confirm RED
- [ ] Implement the minimal SIP dedupe update
- [ ] Re-run the same test file and confirm GREEN

### Task 3: Add focused browser regression coverage

**Files:**
- Modify: `tests/e2e/nav-fallback-manual.spec.ts`
- Test: `tests/e2e/nav-fallback-manual.spec.ts`

- [ ] Extend browser coverage so one path verifies auto NAV success with no manual entry and another keeps the failure fallback path
- [ ] Run `npm run test:e2e -- tests/e2e/nav-fallback-manual.spec.ts` after implementation

### Task 4: Sync progress docs and full verification

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `WORKLOG.md`
- Modify: `NEXT_STEPS.md`

- [ ] Update status docs to reflect the narrowed redesign completion and any remaining follow-ups
- [ ] Run targeted unit tests, targeted E2E, and `npm run test`
- [ ] Record verification evidence before reporting completion
