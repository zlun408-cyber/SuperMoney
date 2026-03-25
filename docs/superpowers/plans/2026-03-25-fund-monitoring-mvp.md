# Fund Monitoring MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable version of the fund real-time valuation monitoring website with a watchlist, fund detail page, minute-level refresh, local persistence, and basic position profit/loss estimation.

**Architecture:** Use a Next.js App Router frontend as the whole first-stage product. Split the code into a watchlist UI layer, a fund data service layer, a local storage persistence layer, and small calculation helpers so future login and data-source changes stay isolated. Prefer client-side local persistence for user data and a thin server route or service wrapper for market data access.

**Tech Stack:** Next.js, TypeScript, React, Tailwind CSS, Vitest, Testing Library, Playwright

---

## Planned file structure

### Create
- `package.json` — project dependencies and scripts
- `next.config.ts` — Next.js config
- `tsconfig.json` — TypeScript config
- `postcss.config.js` — Tailwind/PostCSS config
- `tailwind.config.ts` — Tailwind config
- `app/layout.tsx` — app shell
- `app/page.tsx` — watchlist homepage
- `app/fund/[code]/page.tsx` — fund detail page
- `app/globals.css` — global styles
- `app/api/funds/quote/route.ts` — data fetch wrapper for a single or multiple fund quotes
- `components/watchlist/watchlist-table.tsx` — main table UI
- `components/watchlist/add-fund-dialog.tsx` — add fund dialog
- `components/watchlist/edit-position-dialog.tsx` — edit position dialog
- `components/fund/fund-detail-card.tsx` — detail summary card
- `components/shared/status-banner.tsx` — refresh/error banner
- `lib/funds/types.ts` — shared types
- `lib/funds/data-source.ts` — external quote fetcher abstraction
- `lib/funds/search.ts` — fund search helper
- `lib/storage/watchlist-storage.ts` — local storage read/write helpers
- `lib/calculations/profit-loss.ts` — valuation and P/L calculations
- `lib/hooks/use-fund-quotes.ts` — minute-level refresh hook
- `lib/hooks/use-watchlist.ts` — watchlist state hook
- `tests/lib/calculations/profit-loss.test.ts` — unit tests for calculations
- `tests/lib/storage/watchlist-storage.test.ts` — unit tests for storage
- `tests/lib/hooks/use-watchlist.test.tsx` — hook tests
- `tests/app/watchlist-page.test.tsx` — homepage render tests
- `tests/app/fund-detail-page.test.tsx` — detail page tests
- `tests/e2e/watchlist.spec.ts` — end-to-end happy path

### Modify later as project grows
- `PROJECT_STATUS.md`
- `WORKLOG.md`
- `NEXT_STEPS.md`

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.js`
- Create: `tailwind.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Create a new Next.js + TypeScript app structure**

Add scripts for `dev`, `build`, `test`, and `test:e2e`.

- [ ] **Step 2: Install and configure Tailwind CSS**

Run: `npm install`
Expected: dependencies install without errors

- [ ] **Step 3: Add a minimal app shell and homepage placeholder**

Create a simple page title such as “基金实时估值监控”.

- [ ] **Step 4: Start the dev server to verify the scaffold works**

Run: `npm run dev`
Expected: local Next.js app starts successfully

- [ ] **Step 5: Commit scaffold changes**

```bash
git add .
git commit -m "chore: scaffold fund monitoring app"
```

## Task 2: Define core data types and calculation helpers

**Files:**
- Create: `lib/funds/types.ts`
- Create: `lib/calculations/profit-loss.ts`
- Test: `tests/lib/calculations/profit-loss.test.ts`

- [ ] **Step 1: Write failing tests for position valuation and profit/loss calculation**

```ts
import { describe, expect, it } from 'vitest';
import { calculatePositionSummary } from '@/lib/calculations/profit-loss';

describe('calculatePositionSummary', () => {
  it('calculates current value and profit from average cost input', () => {
    const result = calculatePositionSummary({
      amount: 1000,
      cost: 900,
      estimatedNav: 1.05,
      shares: 1000,
    });

    expect(result.currentValue).toBe(1050);
    expect(result.profit).toBe(150);
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npx vitest tests/lib/calculations/profit-loss.test.ts`
Expected: FAIL because helper does not exist yet

- [ ] **Step 3: Implement the minimal type definitions and calculation helper**

Include support for missing fields and return “not computable” states when required inputs are absent.

- [ ] **Step 4: Run the unit test again**

Run: `npx vitest tests/lib/calculations/profit-loss.test.ts`
Expected: PASS

- [ ] **Step 5: Commit calculation layer**

```bash
git add lib/funds/types.ts lib/calculations/profit-loss.ts tests/lib/calculations/profit-loss.test.ts
git commit -m "feat: add fund position calculations"
```

## Task 3: Build local watchlist persistence

**Files:**
- Create: `lib/storage/watchlist-storage.ts`
- Create: `lib/hooks/use-watchlist.ts`
- Test: `tests/lib/storage/watchlist-storage.test.ts`
- Test: `tests/lib/hooks/use-watchlist.test.tsx`

- [ ] **Step 1: Write failing tests for saving and loading the watchlist**

Cover these cases:
- save list successfully
- load list successfully
- invalid local data falls back to empty list

- [ ] **Step 2: Run storage tests to verify failure**

Run: `npx vitest tests/lib/storage/watchlist-storage.test.ts tests/lib/hooks/use-watchlist.test.tsx`
Expected: FAIL because storage helpers do not exist yet

- [ ] **Step 3: Implement storage helpers and the watchlist hook**

Requirements:
- use one stable localStorage key
- load initial data on the client
- support add, remove, and update position info

- [ ] **Step 4: Re-run the storage and hook tests**

Run: `npx vitest tests/lib/storage/watchlist-storage.test.ts tests/lib/hooks/use-watchlist.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit persistence layer**

```bash
git add lib/storage/watchlist-storage.ts lib/hooks/use-watchlist.ts tests/lib/storage/watchlist-storage.test.ts tests/lib/hooks/use-watchlist.test.tsx
git commit -m "feat: add local watchlist persistence"
```

## Task 4: Add the fund quote service abstraction

**Files:**
- Create: `lib/funds/data-source.ts`
- Create: `app/api/funds/quote/route.ts`
- Create: `lib/hooks/use-fund-quotes.ts`

- [ ] **Step 1: Define the quote service interface**

Model a function that accepts one or more fund codes and returns quote data plus update times.

- [ ] **Step 2: Add a failing test or mock-driven check for the refresh hook**

Verify:
- initial fetch on page load
- minute-level polling
- error state keeps previous data

- [ ] **Step 3: Implement the data source abstraction and refresh hook**

Requirements:
- isolate external fetch logic in one file
- preserve the previous successful data snapshot on refresh failure
- expose `isRefreshing`, `lastUpdatedAt`, and `error`

- [ ] **Step 4: Verify quote refresh behavior locally**

Run: `npx vitest tests/lib/hooks/use-fund-quotes.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit quote service layer**

```bash
git add lib/funds/data-source.ts app/api/funds/quote/route.ts lib/hooks/use-fund-quotes.ts tests/lib/hooks/use-fund-quotes.test.tsx
git commit -m "feat: add fund quote refresh service"
```

## Task 5: Build the homepage watchlist UI

**Files:**
- Create: `components/watchlist/watchlist-table.tsx`
- Create: `components/watchlist/add-fund-dialog.tsx`
- Create: `components/watchlist/edit-position-dialog.tsx`
- Create: `components/shared/status-banner.tsx`
- Modify: `app/page.tsx`
- Test: `tests/app/watchlist-page.test.tsx`
- Test: `tests/e2e/watchlist.spec.ts`

- [ ] **Step 1: Write failing tests for the homepage watchlist**

Cover these cases:
- renders saved funds from local storage
- shows quote columns
- shows “待填写” when position data is incomplete
- shows refresh failure banner while preserving rows

- [ ] **Step 2: Run homepage tests to verify failure**

Run: `npx vitest tests/app/watchlist-page.test.tsx`
Expected: FAIL because homepage UI is not built yet

- [ ] **Step 3: Implement the homepage components**

Requirements:
- table or card list showing all required columns
- add fund button
- edit position button
- remove fund action
- manual refresh button
- refresh status banner

- [ ] **Step 4: Add end-to-end coverage for the main watchlist flow**

Test flow:
- add a fund
- save a basic position
- reload page
- confirm data still exists

- [ ] **Step 5: Run tests and commit homepage UI**

Run: `npx vitest tests/app/watchlist-page.test.tsx && npx playwright test tests/e2e/watchlist.spec.ts`
Expected: PASS

```bash
git add app/page.tsx components/watchlist components/shared tests/app/watchlist-page.test.tsx tests/e2e/watchlist.spec.ts
git commit -m "feat: build fund watchlist homepage"
```

## Task 6: Build the fund detail page

**Files:**
- Create: `components/fund/fund-detail-card.tsx`
- Create: `app/fund/[code]/page.tsx`
- Test: `tests/app/fund-detail-page.test.tsx`

- [ ] **Step 1: Write a failing test for the detail page**

Verify the page can:
- load by fund code
- show quote summary
- show position summary
- show fallback text when no position exists

- [ ] **Step 2: Run the detail page test to verify failure**

Run: `npx vitest tests/app/fund-detail-page.test.tsx`
Expected: FAIL because detail page is not built yet

- [ ] **Step 3: Implement the detail page and summary card**

Link back to the homepage and reuse shared calculation logic.

- [ ] **Step 4: Re-run detail page tests**

Run: `npx vitest tests/app/fund-detail-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the detail page**

```bash
git add app/fund/[code]/page.tsx components/fund/fund-detail-card.tsx tests/app/fund-detail-page.test.tsx
git commit -m "feat: add fund detail page"
```

## Task 7: Polish error handling and empty states

**Files:**
- Modify: `components/shared/status-banner.tsx`
- Modify: `components/watchlist/watchlist-table.tsx`
- Modify: `components/fund/fund-detail-card.tsx`
- Modify: `app/page.tsx`
- Modify: `app/fund/[code]/page.tsx`

- [ ] **Step 1: Write tests for error and empty states**

Cover these cases:
- invalid fund code search feedback
- empty watchlist guidance
- single-fund refresh failure does not break the page

- [ ] **Step 2: Run the new tests to confirm failure**

Run: `npx vitest tests/app/watchlist-page.test.tsx tests/app/fund-detail-page.test.tsx`
Expected: FAIL on new empty/error state assertions

- [ ] **Step 3: Implement the user-facing fallback messages**

Required messages:
- “没有找到这只基金，请检查代码或名称”
- “本次刷新失败，当前显示的是上次数据”
- “待填写” or “无法计算” when position data is incomplete

- [ ] **Step 4: Re-run tests**

Run: `npx vitest tests/app/watchlist-page.test.tsx tests/app/fund-detail-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit polish work**

```bash
git add app/page.tsx app/fund/[code]/page.tsx components/shared/status-banner.tsx components/watchlist/watchlist-table.tsx components/fund/fund-detail-card.tsx tests/app/watchlist-page.test.tsx tests/app/fund-detail-page.test.tsx
git commit -m "feat: polish watchlist error states"
```

## Task 8: Final verification and documentation sync

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `WORKLOG.md`
- Modify: `NEXT_STEPS.md`
- Modify: `SESSION_RESUME.md`

- [ ] **Step 1: Run the full automated test suite**

Run: `npm run test && npm run test:e2e`
Expected: PASS

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Update progress-tracking documents**

Record what was built, what remains for stage two, and how to resume.

- [ ] **Step 4: Manually verify the main user flow**

Check:
- add fund
- edit position
- refresh data
- open detail page
- reload browser and confirm persistence

- [ ] **Step 5: Commit final MVP state**

```bash
git add .
git commit -m "feat: deliver fund monitoring mvp"
```
