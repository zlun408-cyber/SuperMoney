# Stage 3 Auth And Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account login and cloud sync so watchlist funds and transaction records can survive browser changes and device changes.

**Architecture:** Keep the current watchlist and transaction calculation model, but introduce a persistence split: unauthenticated users still work locally, authenticated users sync against Supabase. Model cloud data with two tables, `watchlist_funds` and `fund_transactions`, and keep derived summaries calculated at runtime in the frontend. Handle first-login data conflicts explicitly instead of auto-merging.

**Tech Stack:** Next.js, TypeScript, Supabase, localStorage, React, Vitest, Testing Library

---

## Planned file changes

### Create
- `lib/supabase/client.ts` — browser Supabase client
- `lib/supabase/server.ts` — server-side Supabase helper if route/server usage becomes necessary
- `lib/auth/types.ts` — auth/session-related types if shared
- `lib/sync/cloud-watchlist.ts` — cloud read/write helpers for funds and transactions
- `components/auth/auth-button.tsx` — login/logout entry point
- `components/auth/auth-dialog.tsx` — register/login dialog
- `components/auth/sync-conflict-dialog.tsx` — first-login local/cloud conflict chooser
- `tests/lib/sync/cloud-watchlist.test.ts` — cloud sync unit tests
- `tests/components/auth/auth-dialog.test.tsx` — auth dialog tests
- `tests/components/auth/sync-conflict-dialog.test.tsx` — conflict chooser tests

### Modify
- `app/layout.tsx` — mount auth entry point
- `app/page.tsx` — show login sync hint if needed
- `lib/hooks/use-watchlist.ts` — bridge local and cloud persistence paths
- `lib/storage/watchlist-storage.ts` — keep local fallback, possibly expose import/export helpers for sync bootstrap
- `lib/funds/types.ts` — add cloud-facing identifiers if needed
- `tests/app/watchlist-page.test.tsx` — auth/sync-related homepage assertions
- `PROJECT_STATUS.md`
- `WORKLOG.md`
- `NEXT_STEPS.md`
- `SESSION_RESUME.md`

## Task 1: Add Supabase base wiring and cloud data helpers

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/sync/cloud-watchlist.ts`
- Test: `tests/lib/sync/cloud-watchlist.test.ts`

- [ ] **Step 1: Write failing tests for loading and saving cloud watchlist data**
- [ ] **Step 2: Run `npx vitest run tests/lib/sync/cloud-watchlist.test.ts` and confirm failure**
- [ ] **Step 3: Implement minimal cloud read/write helpers for `watchlist_funds` and `fund_transactions`**
- [ ] **Step 4: Re-run `npx vitest run tests/lib/sync/cloud-watchlist.test.ts` and confirm pass**

## Task 2: Add login/logout UI

**Files:**
- Create: `components/auth/auth-button.tsx`
- Create: `components/auth/auth-dialog.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/components/auth/auth-dialog.test.tsx`

- [ ] **Step 1: Write failing tests for register/login dialog flow**
- [ ] **Step 2: Run `npx vitest run tests/components/auth/auth-dialog.test.tsx` and confirm failure**
- [ ] **Step 3: Implement minimal auth button and auth dialog**
- [ ] **Step 4: Re-run `npx vitest run tests/components/auth/auth-dialog.test.tsx` and confirm pass**

## Task 3: Connect authenticated watchlist sync

**Files:**
- Modify: `lib/hooks/use-watchlist.ts`
- Modify: `app/page.tsx`
- Modify: `tests/app/watchlist-page.test.tsx`

- [ ] **Step 1: Write failing tests for logged-in watchlist load/save behavior**
- [ ] **Step 2: Run `npx vitest run tests/app/watchlist-page.test.tsx tests/lib/hooks/use-watchlist.test.tsx` and confirm failure**
- [ ] **Step 3: Implement minimal logged-in sync path while preserving local fallback for logged-out users**
- [ ] **Step 4: Re-run the same tests and confirm pass**

## Task 4: Add first-login conflict resolution flow

**Files:**
- Create: `components/auth/sync-conflict-dialog.tsx`
- Modify: `lib/hooks/use-watchlist.ts`
- Test: `tests/components/auth/sync-conflict-dialog.test.tsx`

- [ ] **Step 1: Write failing tests for local/cloud conflict choice flow**
- [ ] **Step 2: Run `npx vitest run tests/components/auth/sync-conflict-dialog.test.tsx` and confirm failure**
- [ ] **Step 3: Implement minimal conflict chooser and choice handling**
- [ ] **Step 4: Re-run `npx vitest run tests/components/auth/sync-conflict-dialog.test.tsx` and confirm pass**

## Task 5: Run focused regression tests

**Files:**
- Reuse existing files only

- [ ] **Step 1: Run focused regression tests covering auth, sync, homepage, and transaction flows**
- [ ] **Step 2: Make the smallest necessary fix if any test fails**
- [ ] **Step 3: Re-run the same focused regression command and confirm pass**

## Task 6: Final verification and docs sync

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `WORKLOG.md`
- Modify: `NEXT_STEPS.md`
- Modify: `SESSION_RESUME.md`

- [ ] **Step 1: Run `npm run test`**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Run browser verification or E2E if auth mocking is ready**
- [ ] **Step 4: Update progress files**
- [ ] **Step 5: Commit the stage 3 baseline**
