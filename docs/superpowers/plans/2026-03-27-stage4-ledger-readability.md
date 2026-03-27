# Stage 4 Ledger Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the fund detail page so users can clearly understand position state, profit breakdown, and each transaction row without changing the existing transaction calculation rules.

**Architecture:** Keep the current FIFO ledger calculation layer unchanged, but expose more of its derived fields in the detail summary card and show richer transaction row details in the transaction list. The work stays focused on detail-page presentation and tests, so homepage, auth, sync, and storage behavior remain stable.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library

---

## Planned file changes

### Modify
- `components/fund/fund-detail-card.tsx` — expand summary card into clearer holding + profit breakdown sections
- `components/fund/transaction-list.tsx` — render richer transaction details and clearer type styling
- `tests/app/fund-detail-page.test.tsx` — cover new summary fields and richer transaction list rendering
- `PROJECT_STATUS.md`
- `WORKLOG.md`
- `NEXT_STEPS.md`
- `SESSION_RESUME.md`

### Reuse
- `lib/funds/transactions.ts` — keep current calculation output, no algorithm change
- `lib/funds/types.ts` — keep existing `TransactionLedgerSummary` structure

## Task 1: Expand detail summary card into readable ledger breakdown

**Files:**
- Modify: `components/fund/fund-detail-card.tsx`
- Test: `tests/app/fund-detail-page.test.tsx`

- [ ] **Step 1: Write failing tests for readable holding and profit breakdown fields**
- [ ] **Step 2: Run `npx vitest run tests/app/fund-detail-page.test.tsx` and confirm failure**
- [ ] **Step 3: Implement the minimal summary card changes**
- [ ] **Step 4: Re-run `npx vitest run tests/app/fund-detail-page.test.tsx` and confirm pass**

## Task 2: Enrich transaction rows so each record is easier to read

**Files:**
- Modify: `components/fund/transaction-list.tsx`
- Test: `tests/app/fund-detail-page.test.tsx`

- [ ] **Step 1: Write failing tests for richer transaction row details**
- [ ] **Step 2: Run `npx vitest run tests/app/fund-detail-page.test.tsx` and confirm failure**
- [ ] **Step 3: Implement the minimal transaction row display enhancement**
- [ ] **Step 4: Re-run `npx vitest run tests/app/fund-detail-page.test.tsx` and confirm pass**

## Task 3: Run focused regression checks for detail-page flows

**Files:**
- Reuse existing files only

- [ ] **Step 1: Run focused regression tests for fund detail, transaction dialog, and homepage summary**
- [ ] **Step 2: Make the smallest necessary fix if any test fails**
- [ ] **Step 3: Re-run the same focused regression command and confirm pass**

## Task 4: Final verification and docs sync

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `WORKLOG.md`
- Modify: `NEXT_STEPS.md`
- Modify: `SESSION_RESUME.md`

- [ ] **Step 1: Run `npm run test`**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Update progress files**
- [ ] **Step 4: Commit the stage 4 readability baseline**
