# Transaction Record Edit/Delete UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add edit and delete actions for fund transaction records on the detail page, while reusing the existing transaction form and keeping derived summaries auto-updated.

**Architecture:** Extend the current detail-page transaction area instead of creating a new page. Reuse `AddTransactionDialog` as a shared add/edit form, let `TransactionList` expose edit/delete actions, and keep `FundDetailContent` as the place that wires page state to `useWatchlist()` CRUD methods. Preserve the current runtime-derived summary approach so edited or deleted records automatically recalculate homepage and detail summaries.

**Tech Stack:** Next.js, TypeScript, React, localStorage, Vitest, Testing Library

---

## Planned file changes

### Modify
- `components/fund/add-transaction-dialog.tsx` — support add/edit dual mode, default values, and submit labels
- `components/fund/transaction-list.tsx` — add edit/delete buttons and callbacks
- `components/fund/fund-detail-content.tsx` — manage editing state and connect update/remove actions
- `tests/components/fund/add-transaction-dialog.test.tsx` — cover edit-mode form behavior
- `tests/app/fund-detail-page.test.tsx` — cover edit/delete flows on detail page
- `PROJECT_STATUS.md` — record this enhancement when done
- `WORKLOG.md` — append execution notes when done
- `NEXT_STEPS.md` — update next action when done
- `SESSION_RESUME.md` — update recovery status when done

## Task 1: Add edit-mode support to the transaction form

**Files:**
- Modify: `components/fund/add-transaction-dialog.tsx`
- Test: `tests/components/fund/add-transaction-dialog.test.tsx`

- [ ] **Step 1: Write the failing component test for edit-mode prefill and save label**

Add a test that renders the dialog in edit mode with an existing transaction and checks:
- the dialog title shows `编辑交易记录`
- the save button shows `保存修改`
- existing date / amount / nav values are prefilled
- clicking save returns an updated transaction with the same `id`

- [ ] **Step 2: Run the focused component test and confirm failure**

Run: `npx vitest run tests/components/fund/add-transaction-dialog.test.tsx`
Expected: FAIL because the current dialog only supports add mode.

- [ ] **Step 3: Implement the minimal edit-mode support**

In `components/fund/add-transaction-dialog.tsx`:
- add optional props for `editingTransaction`, `onUpdateTransaction`, and `onCancelEdit`
- derive form initial values from the editing record when present
- keep the existing add flow unchanged when there is no editing record
- preserve the original record `id` during edit saves
- switch title/button text between add mode and edit mode
- make cancel leave edit mode cleanly

- [ ] **Step 4: Re-run the focused component test**

Run: `npx vitest run tests/components/fund/add-transaction-dialog.test.tsx`
Expected: PASS

## Task 2: Add edit/delete actions to the transaction list and detail page

**Files:**
- Modify: `components/fund/transaction-list.tsx`
- Modify: `components/fund/fund-detail-content.tsx`
- Test: `tests/app/fund-detail-page.test.tsx`

- [ ] **Step 1: Write failing page tests for edit and delete flows**

Add tests that verify:
- clicking `编辑` opens the form in edit mode and saving updates the rendered record
- clicking `删除` and confirming removes the record from the list
- deleting the last record shows the empty-state message

- [ ] **Step 2: Run the focused detail-page test and confirm failure**

Run: `npx vitest run tests/app/fund-detail-page.test.tsx`
Expected: FAIL because the list has no action buttons yet.

- [ ] **Step 3: Implement the minimal edit/delete wiring**

In `components/fund/transaction-list.tsx`:
- add `onEditTransaction` and `onDeleteTransaction` callbacks
- render `编辑` and `删除` buttons for each row

In `components/fund/fund-detail-content.tsx`:
- read `updateTransaction` and `removeTransaction` from `useWatchlist()`
- add local state for the current editing transaction
- pass edit-mode props into `AddTransactionDialog`
- on delete, call `window.confirm('确认删除这条交易记录吗？删除后会自动重算持仓和收益。')`
- if confirmed, remove the record and clear edit state when needed

- [ ] **Step 4: Re-run the focused detail-page test**

Run: `npx vitest run tests/app/fund-detail-page.test.tsx`
Expected: PASS

## Task 3: Run regression checks for derived summaries and storage behavior

**Files:**
- Reuse existing files only

- [ ] **Step 1: Run related regression tests**

Run: `npx vitest run tests/components/fund/add-transaction-dialog.test.tsx tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx tests/lib/hooks/use-watchlist.test.tsx tests/lib/storage/watchlist-storage.test.ts tests/lib/funds/transactions.test.ts`
Expected: PASS

- [ ] **Step 2: If any test fails, make the smallest necessary fix**

Only touch files directly related to the failing behavior.

- [ ] **Step 3: Re-run the same regression test command**

Run: `npx vitest run tests/components/fund/add-transaction-dialog.test.tsx tests/app/fund-detail-page.test.tsx tests/app/watchlist-page.test.tsx tests/lib/hooks/use-watchlist.test.tsx tests/lib/storage/watchlist-storage.test.ts tests/lib/funds/transactions.test.ts`
Expected: PASS

## Task 4: Final verification and docs sync

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `WORKLOG.md`
- Modify: `NEXT_STEPS.md`
- Modify: `SESSION_RESUME.md`

- [ ] **Step 1: Run full verification**

Run: `npm run test`
Expected: PASS

- [ ] **Step 2: Update progress files**

Record that transaction record edit/delete UI has been added and note the next recommended step.

- [ ] **Step 3: Re-run build verification if this enhancement changes render behavior materially**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit the enhancement**

```bash
git add components/fund/add-transaction-dialog.tsx components/fund/transaction-list.tsx components/fund/fund-detail-content.tsx tests/components/fund/add-transaction-dialog.test.tsx tests/app/fund-detail-page.test.tsx PROJECT_STATUS.md WORKLOG.md NEXT_STEPS.md SESSION_RESUME.md
git commit -m "feat: support editing and deleting fund transactions"
```
