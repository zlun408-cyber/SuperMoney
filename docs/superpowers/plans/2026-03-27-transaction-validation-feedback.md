# Transaction Validation Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clear field-level and business-level validation feedback to the fund transaction form without changing the current add/edit workflow.

**Architecture:** Keep validation centered on the existing detail-page form flow. Let `AddTransactionDialog` handle field completeness and numeric validation, while `FundDetailContent` provides the business rule for sell availability based on the current transaction list. Preserve submit-time validation only, so the UI stays simple and stable.

**Tech Stack:** Next.js, TypeScript, React, Vitest, Testing Library

---

## Planned file changes

### Modify
- `components/fund/add-transaction-dialog.tsx` — add field errors, form-level error, and submit-time validation flow
- `components/fund/fund-detail-content.tsx` — provide sell-availability validation to the dialog
- `tests/components/fund/add-transaction-dialog.test.tsx` — cover field-level validation messages
- `tests/app/fund-detail-page.test.tsx` — cover sell-overflow business error on the detail page
- `PROJECT_STATUS.md` — sync progress after completion
- `WORKLOG.md` — append work log after completion
- `NEXT_STEPS.md` — update next step after completion
- `SESSION_RESUME.md` — refresh resume note after completion

## Task 1: Add field-level validation feedback in the dialog

**Files:**
- Modify: `components/fund/add-transaction-dialog.tsx`
- Test: `tests/components/fund/add-transaction-dialog.test.tsx`

- [ ] **Step 1: Write failing component tests for submit-time field errors**
- [ ] **Step 2: Run `npx vitest run tests/components/fund/add-transaction-dialog.test.tsx` and confirm failure**
- [ ] **Step 3: Implement minimal field error state and rendering**
- [ ] **Step 4: Re-run `npx vitest run tests/components/fund/add-transaction-dialog.test.tsx` and confirm pass**

## Task 2: Add sell-availability business validation on the detail page

**Files:**
- Modify: `components/fund/fund-detail-content.tsx`
- Modify: `components/fund/add-transaction-dialog.tsx`
- Test: `tests/app/fund-detail-page.test.tsx`

- [ ] **Step 1: Write failing detail-page tests for sell-overflow feedback**
- [ ] **Step 2: Run `npx vitest run tests/app/fund-detail-page.test.tsx` and confirm failure**
- [ ] **Step 3: Implement minimal sell-availability validation hook-up**
- [ ] **Step 4: Re-run `npx vitest run tests/app/fund-detail-page.test.tsx` and confirm pass**

## Task 3: Run focused regression tests

**Files:**
- Reuse existing files only

- [ ] **Step 1: Run `npx vitest run tests/components/fund/add-transaction-dialog.test.tsx tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx tests/lib/funds/transactions.test.ts`**
- [ ] **Step 2: If needed, make the smallest necessary fix**
- [ ] **Step 3: Re-run the same command and confirm pass**

## Task 4: Final verification and docs sync

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `WORKLOG.md`
- Modify: `NEXT_STEPS.md`
- Modify: `SESSION_RESUME.md`

- [ ] **Step 1: Run `npm run test`**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Update progress files**
- [ ] **Step 4: Commit the enhancement**
