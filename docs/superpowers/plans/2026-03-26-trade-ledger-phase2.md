# Trade Ledger Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the second-stage transaction-ledger system for fund positions, supporting buy/sell/dividend records, FIFO profit calculation, and auto-derived position summaries.

**Architecture:** Extend the current local-storage watchlist model with transaction records per fund. Add a pure calculation layer that converts records into FIFO-based summaries, then reuse those derived results in the homepage and detail page. Keep data entry and display centered on the detail page while the homepage remains a summary dashboard.

**Tech Stack:** Next.js, TypeScript, React, localStorage, Vitest, Testing Library, Playwright

---

## Planned file changes

### Create
- `lib/funds/transactions.ts` — transaction types, helpers, and FIFO calculation entry points
- `components/fund/transaction-list.tsx` — detail-page transaction list
- `components/fund/add-transaction-dialog.tsx` — add/edit transaction form
- `tests/lib/funds/transactions.test.ts` — FIFO and summary tests
- `tests/components/fund/add-transaction-dialog.test.tsx` — transaction form tests
- `tests/e2e/transaction-ledger.spec.ts` — main transaction flow

### Modify
- `lib/storage/watchlist-storage.ts` — save/load transaction records with watchlist funds
- `lib/hooks/use-watchlist.ts` — add transaction CRUD methods
- `lib/funds/types.ts` — add transaction types and derived summary types if shared broadly
- `components/watchlist/watchlist-table.tsx` — read derived summary values instead of manual position input
- `components/fund/fund-detail-card.tsx` — show derived summary values
- `components/fund/fund-detail-content.tsx` — load derived results and transaction UI
- `app/page.tsx` — pass derived summary data to homepage table
- `app/fund/[code]/page.tsx` — keep route boundary but render new detail content
- `tests/app/watchlist-page.test.tsx` — assert derived values display
- `tests/app/fund-detail-page.test.tsx` — assert transaction-driven detail display
- `PROJECT_STATUS.md`
- `WORKLOG.md`
- `NEXT_STEPS.md`
- `SESSION_RESUME.md`

## Task 1: Define transaction data model and FIFO calculations

**Files:**
- Create: `lib/funds/transactions.ts`
- Test: `tests/lib/funds/transactions.test.ts`
- Modify: `lib/funds/types.ts`

- [ ] **Step 1: Write failing tests for transaction records and FIFO summary calculation**
- [ ] **Step 2: Run `npx vitest run tests/lib/funds/transactions.test.ts` and confirm failure**
- [ ] **Step 3: Implement minimal transaction types and FIFO calculation helpers**
- [ ] **Step 4: Re-run `npx vitest run tests/lib/funds/transactions.test.ts` and confirm pass**
- [ ] **Step 5: Commit calculation layer**

## Task 2: Extend local storage and watchlist state for transaction CRUD

**Files:**
- Modify: `lib/storage/watchlist-storage.ts`
- Modify: `lib/hooks/use-watchlist.ts`
- Test: `tests/lib/storage/watchlist-storage.test.ts`
- Test: `tests/lib/hooks/use-watchlist.test.tsx`

- [ ] **Step 1: Write failing tests for saving and loading transaction records**
- [ ] **Step 2: Run focused storage tests and confirm failure**
- [ ] **Step 3: Implement add/edit/delete transaction methods**
- [ ] **Step 4: Re-run focused storage and hook tests**
- [ ] **Step 5: Commit state layer**

## Task 3: Build detail-page transaction UI

**Files:**
- Create: `components/fund/transaction-list.tsx`
- Create: `components/fund/add-transaction-dialog.tsx`
- Create: `tests/components/fund/add-transaction-dialog.test.tsx`
- Modify: `components/fund/fund-detail-content.tsx`
- Modify: `components/fund/fund-detail-card.tsx`
- Modify: `tests/app/fund-detail-page.test.tsx`

- [ ] **Step 1: Write failing tests for transaction entry and transaction list display**
- [ ] **Step 2: Run detail-page and component tests to confirm failure**
- [ ] **Step 3: Implement add/edit/delete transaction UI on the detail page**
- [ ] **Step 4: Re-run detail-page and component tests**
- [ ] **Step 5: Commit detail-page UI**

## Task 4: Upgrade homepage summary to use derived transaction results

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/watchlist/watchlist-table.tsx`
- Modify: `tests/app/watchlist-page.test.tsx`

- [ ] **Step 1: Write failing homepage tests for transaction-derived summary values**
- [ ] **Step 2: Run homepage tests to confirm failure**
- [ ] **Step 3: Implement derived summary display on the homepage**
- [ ] **Step 4: Re-run homepage tests**
- [ ] **Step 5: Commit homepage summary changes**

## Task 5: Add end-to-end coverage for transaction ledger flow

**Files:**
- Create: `tests/e2e/transaction-ledger.spec.ts`
- Modify: `playwright.config.ts` if needed

- [ ] **Step 1: Write failing E2E for add buy record → add sell record → open detail → verify summary**
- [ ] **Step 2: Run `npm run test:e2e` and confirm the new flow fails for the expected reason**
- [ ] **Step 3: Adjust UI details or mocks minimally to make the flow pass**
- [ ] **Step 4: Re-run `npm run test:e2e` and confirm pass**
- [ ] **Step 5: Commit E2E coverage**

## Task 6: Final verification and docs sync

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `WORKLOG.md`
- Modify: `NEXT_STEPS.md`
- Modify: `SESSION_RESUME.md`

- [ ] **Step 1: Run `npm run test`**
- [ ] **Step 2: Run `npm run test:e2e`**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Update progress docs and recovery notes**
- [ ] **Step 5: Commit final second-stage ledger baseline**
