# Estimate Accuracy Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a measurable estimate-accuracy baseline for SuperFinance, persist quote-vs-final-nav evidence locally, and surface a confidence view in product UI.

**Architecture:** Keep the first iteration entirely inside the existing Next.js frontend app. Capture quote snapshots when `useFundQuotes` refreshes, reconcile unresolved snapshots against historical nav through the existing `/api/funds/nav` path, then compute rolling summaries with pure domain helpers so both the detail page and an internal accuracy dashboard can reuse the same logic.

**Tech Stack:** Next.js App Router, TypeScript, React Hooks, localStorage, Vitest, Playwright

---

## File Map

### New files
- `lib/funds/estimate-accuracy.ts` — pure domain helpers for snapshot creation, reconciliation, aggregation, and confidence grading
- `lib/storage/estimate-accuracy-storage.ts` — localStorage read/write helpers for estimate accuracy samples
- `components/fund/estimate-confidence-panel.tsx` — reusable detail-page panel for confidence / sample count / average error
- `components/accuracy/accuracy-dashboard.tsx` — internal dashboard UI for per-fund and aggregate accuracy
- `app/accuracy/page.tsx` — internal route to inspect rolling estimate accuracy
- `tests/lib/funds/estimate-accuracy.test.ts` — unit tests for aggregation and confidence logic
- `tests/lib/storage/estimate-accuracy-storage.test.ts` — local storage roundtrip / compatibility tests
- `tests/lib/hooks/use-fund-quotes.test.tsx` — hook tests for snapshot capture + reconciliation side effects
- `tests/components/fund/estimate-confidence-panel.test.tsx` — component tests for confidence display
- `tests/components/accuracy/accuracy-dashboard.test.tsx` — dashboard rendering tests
- `tests/e2e/estimate-accuracy-dashboard.spec.ts` — focused browser regression for the dashboard and confidence panel

### Modified files
- `lib/funds/types.ts` — add estimate accuracy domain types
- `lib/hooks/use-fund-quotes.ts` — record snapshots and reconcile older unresolved samples
- `components/fund/fund-detail-card.tsx` — render estimate confidence panel below the quote summary
- `app/page.tsx` — optional small link into `/accuracy` from the main header
- `PROJECT_STATUS.md` — sync milestone after implementation
- `NEXT_STEPS.md` — sync next actions after implementation
- `docs/project/superfinance/docs/index.md` — add dashboard / accuracy docs entry if the feature ships

---

### Task 1: Add estimate accuracy domain types and pure calculators

**Files:**
- Create: `tests/lib/funds/estimate-accuracy.test.ts`
- Create: `lib/funds/estimate-accuracy.ts`
- Modify: `lib/funds/types.ts`
- Test: `tests/lib/funds/estimate-accuracy.test.ts`

- [ ] **Step 1: Write the failing domain tests**

```ts
import { describe, expect, it } from 'vitest';

import {
  buildEstimateSnapshot,
  gradeEstimateConfidence,
  reconcileEstimateSnapshot,
  summarizeEstimateAccuracy,
} from '@/lib/funds/estimate-accuracy';

describe('estimate accuracy domain', () => {
  it('builds a deduplicated snapshot key from code and quote timestamp', () => {
    expect(
      buildEstimateSnapshot({
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        quoteUpdatedAt: '2026-04-13 14:30',
      }),
    ).toEqual(
      expect.objectContaining({
        id: '000001::2026-04-13 14:30',
        fundCode: '000001',
        estimatedNav: 1.23,
        finalNav: null,
      }),
    );
  });

  it('reconciles an unresolved snapshot once final nav becomes available', () => {
    const snapshot = buildEstimateSnapshot({
      code: '000001',
      name: '基金A',
      estimatedNav: 1.23,
      quoteUpdatedAt: '2026-04-13 14:30',
    });

    expect(reconcileEstimateSnapshot(snapshot, 1.20)).toEqual(
      expect.objectContaining({
        finalNav: 1.20,
        absoluteErrorRate: expect.closeTo(0.025, 6),
      }),
    );
  });

  it('summarizes rolling accuracy and returns a medium confidence grade', () => {
    const summary = summarizeEstimateAccuracy([
      { id: 'a', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-10 14:30', tradingDate: '2026-04-10', estimatedNav: 1.00, finalNav: 1.00, absoluteErrorRate: 0, resolvedAt: '2026-04-10T15:30:00.000Z', createdAt: '2026-04-10T14:30:00.000Z', updatedAt: '2026-04-10T15:30:00.000Z' },
      { id: 'b', fundCode: '000001', fundName: '基金A', quoteUpdatedAt: '2026-04-11 14:30', tradingDate: '2026-04-11', estimatedNav: 1.03, finalNav: 1.00, absoluteErrorRate: 0.03, resolvedAt: '2026-04-11T15:30:00.000Z', createdAt: '2026-04-11T14:30:00.000Z', updatedAt: '2026-04-11T15:30:00.000Z' },
    ]);

    expect(summary.averageAbsoluteErrorRate).toBeCloseTo(0.015, 6);
    expect(gradeEstimateConfidence(summary)).toBe('medium');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/lib/funds/estimate-accuracy.test.ts`
Expected: FAIL because the new types and helpers do not exist yet.

- [ ] **Step 3: Write the minimal domain implementation**

Add the following types to `lib/funds/types.ts`:

```ts
export interface EstimateAccuracySnapshot {
  id: string;
  fundCode: string;
  fundName: string;
  quoteUpdatedAt: string;
  tradingDate: string;
  estimatedNav: number;
  finalNav: number | null;
  absoluteErrorRate: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EstimateConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface EstimateAccuracySummary {
  fundCode: string;
  sampleCount: number;
  resolvedSampleCount: number;
  averageAbsoluteErrorRate: number | null;
  latestQuoteUpdatedAt: string | null;
  latestResolvedAt: string | null;
}
```

Implement `lib/funds/estimate-accuracy.ts` with pure helpers:
- `deriveTradingDateFromQuoteUpdatedAt(quoteUpdatedAt: string): string`
- `buildEstimateSnapshot(...)`
- `mergeEstimateSnapshots(existing, incoming)` — de-dupe by `id`
- `reconcileEstimateSnapshot(snapshot, finalNav)`
- `summarizeEstimateAccuracy(snapshots)`
- `gradeEstimateConfidence(summary)` using simple thresholds:
  - `high`: at least 5 resolved samples and avg abs error `<= 0.003`
  - `medium`: at least 3 resolved samples and avg abs error `<= 0.01`
  - `low`: resolved samples > 0 but above `0.01`
  - `unknown`: no resolved samples

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/lib/funds/estimate-accuracy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/funds/types.ts lib/funds/estimate-accuracy.ts tests/lib/funds/estimate-accuracy.test.ts
git commit -m "feat: add estimate accuracy domain baseline"
```

### Task 2: Persist estimate snapshots in local storage

**Files:**
- Create: `tests/lib/storage/estimate-accuracy-storage.test.ts`
- Create: `lib/storage/estimate-accuracy-storage.ts`
- Test: `tests/lib/storage/estimate-accuracy-storage.test.ts`

- [ ] **Step 1: Write the failing storage tests**

```ts
import { describe, expect, it } from 'vitest';

import {
  ESTIMATE_ACCURACY_STORAGE_KEY,
  loadEstimateAccuracySnapshots,
  saveEstimateAccuracySnapshots,
} from '@/lib/storage/estimate-accuracy-storage';

describe('estimate accuracy storage', () => {
  it('returns an empty array for missing or malformed payloads', () => {
    localStorage.removeItem(ESTIMATE_ACCURACY_STORAGE_KEY);
    expect(loadEstimateAccuracySnapshots()).toEqual([]);

    localStorage.setItem(ESTIMATE_ACCURACY_STORAGE_KEY, '{bad json');
    expect(loadEstimateAccuracySnapshots()).toEqual([]);
  });

  it('round-trips snapshots without losing resolved fields', () => {
    saveEstimateAccuracySnapshots([
      {
        id: '000001::2026-04-13 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-13 14:30',
        tradingDate: '2026-04-13',
        estimatedNav: 1.23,
        finalNav: 1.20,
        absoluteErrorRate: 0.025,
        resolvedAt: '2026-04-13T15:30:00.000Z',
        createdAt: '2026-04-13T14:30:00.000Z',
        updatedAt: '2026-04-13T15:30:00.000Z',
      },
    ]);

    expect(loadEstimateAccuracySnapshots()[0]).toEqual(
      expect.objectContaining({ finalNav: 1.20, absoluteErrorRate: 0.025 }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/lib/storage/estimate-accuracy-storage.test.ts`
Expected: FAIL because the storage module does not exist yet.

- [ ] **Step 3: Write the minimal storage implementation**

Create `lib/storage/estimate-accuracy-storage.ts` with:
- `ESTIMATE_ACCURACY_STORAGE_KEY = 'super-finance-estimate-accuracy'`
- `loadEstimateAccuracySnapshots()`
- `saveEstimateAccuracySnapshots()`
- `upsertEstimateAccuracySnapshots(existing, incoming)` helper re-exporting `mergeEstimateSnapshots` from the domain file

Keep it browser-safe like the existing `watchlist-storage` helpers.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/lib/storage/estimate-accuracy-storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/storage/estimate-accuracy-storage.ts tests/lib/storage/estimate-accuracy-storage.test.ts
git commit -m "feat: persist estimate accuracy snapshots locally"
```

### Task 3: Capture quote snapshots and reconcile them against final nav

**Files:**
- Create: `tests/lib/hooks/use-fund-quotes.test.tsx`
- Modify: `lib/hooks/use-fund-quotes.ts`
- Modify: `lib/funds/estimate-accuracy.ts`
- Modify: `lib/storage/estimate-accuracy-storage.ts`
- Test: `tests/lib/hooks/use-fund-quotes.test.tsx`

- [ ] **Step 1: Write the failing hook tests**

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFundQuotes } from '@/lib/hooks/use-fund-quotes';

describe('useFundQuotes estimate accuracy side effects', () => {
  it('stores a new snapshot for each returned quote update', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      { code: '000001', name: '基金A', estimatedNav: 1.23, changeRate: 0.8, updatedAt: '2026-04-13 14:30' },
    ]);
    const loadSnapshots = vi.fn().mockReturnValue([]);
    const saveSnapshots = vi.fn();
    const resolveFinalNav = vi.fn().mockResolvedValue(null);

    renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(saveSnapshots).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: '000001::2026-04-13 14:30', estimatedNav: 1.23 }),
        ]),
      );
    });
  });

  it('reconciles older unresolved snapshots when final nav becomes available', async () => {
    const loadSnapshots = vi.fn().mockReturnValue([
      {
        id: '000001::2026-04-12 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-12 14:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.20,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T14:30:00.000Z',
      },
    ]);
    const saveSnapshots = vi.fn();
    const resolveFinalNav = vi.fn().mockResolvedValue(1.18);

    renderHook(() =>
      useFundQuotes([], vi.fn().mockResolvedValue([]), 60_000, {
        loadSnapshots,
        saveSnapshots,
        resolveFinalNav,
      }),
    );

    await waitFor(() => {
      expect(saveSnapshots).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ finalNav: 1.18 }),
        ]),
      );
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/lib/hooks/use-fund-quotes.test.tsx`
Expected: FAIL because the hook has no accuracy side effects and no injectable helpers yet.

- [ ] **Step 3: Write the minimal hook implementation**

Extend `useFundQuotes` with a backwards-compatible fourth argument:

```ts
interface UseFundQuotesAccuracyOptions {
  loadSnapshots?: () => EstimateAccuracySnapshot[];
  saveSnapshots?: (snapshots: EstimateAccuracySnapshot[]) => void;
  resolveFinalNav?: (fundCode: string, tradingDate: string) => Promise<number | null>;
}
```

Implementation rules:
- Default to real storage helpers and `getNavWithCache`-backed resolver
- After each successful quote fetch, convert returned quotes into snapshots and upsert them into storage
- On initial load and after each successful refresh, attempt reconciliation for unresolved snapshots older than the current trading date
- Do not refetch final nav for snapshots already resolved
- Keep the quote API behavior unchanged for existing callers

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/lib/hooks/use-fund-quotes.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the adjacent quote tests**

Run: `npm run test -- tests/lib/hooks/use-fund-quotes.test.tsx tests/lib/funds/nav-cache.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/hooks/use-fund-quotes.ts lib/funds/estimate-accuracy.ts lib/storage/estimate-accuracy-storage.ts tests/lib/hooks/use-fund-quotes.test.tsx
git commit -m "feat: capture and reconcile estimate accuracy samples"
```

### Task 4: Surface estimate confidence on the fund detail page

**Files:**
- Create: `tests/components/fund/estimate-confidence-panel.test.tsx`
- Create: `components/fund/estimate-confidence-panel.tsx`
- Modify: `components/fund/fund-detail-card.tsx`
- Test: `tests/components/fund/estimate-confidence-panel.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EstimateConfidencePanel } from '@/components/fund/estimate-confidence-panel';

it('shows confidence, sample count, and average error copy', () => {
  render(
    <EstimateConfidencePanel
      summary={{ fundCode: '000001', sampleCount: 7, resolvedSampleCount: 5, averageAbsoluteErrorRate: 0.0042, latestQuoteUpdatedAt: '2026-04-13 14:30', latestResolvedAt: '2026-04-13T15:30:00.000Z' }}
      confidenceLevel="medium"
    />,
  );

  expect(screen.getByText('估值可信度')).toBeInTheDocument();
  expect(screen.getByText('中')).toBeInTheDocument();
  expect(screen.getByText(/近 5 个已收敛样本/)).toBeInTheDocument();
  expect(screen.getByText(/平均误差 0.42%/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/components/fund/estimate-confidence-panel.test.tsx`
Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Write the minimal UI implementation**

Create `components/fund/estimate-confidence-panel.tsx`:
- Accept `summary` and `confidenceLevel`
- Render 3 core values only:
  - confidence label
  - resolved sample count
  - average absolute error percentage
- Include honest fallback copy for `unknown`

Modify `components/fund/fund-detail-card.tsx`:
- Add optional props `estimateAccuracySummary?` and `estimateConfidenceLevel?`
- Render the panel below the summary cards when summary exists
- Keep existing callers working by making the new props optional

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/components/fund/estimate-confidence-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/fund/estimate-confidence-panel.tsx components/fund/fund-detail-card.tsx tests/components/fund/estimate-confidence-panel.test.tsx
git commit -m "feat: show estimate confidence on fund detail"
```

### Task 5: Add an internal estimate accuracy dashboard route

**Files:**
- Create: `tests/components/accuracy/accuracy-dashboard.test.tsx`
- Create: `components/accuracy/accuracy-dashboard.tsx`
- Create: `app/accuracy/page.tsx`
- Modify: `app/page.tsx`
- Test: `tests/components/accuracy/accuracy-dashboard.test.tsx`

- [ ] **Step 1: Write the failing dashboard test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AccuracyDashboard } from '@/components/accuracy/accuracy-dashboard';

it('renders aggregate and per-fund accuracy sections', () => {
  render(
    <AccuracyDashboard
      summaries={[
        { fundCode: '000001', sampleCount: 10, resolvedSampleCount: 8, averageAbsoluteErrorRate: 0.0035, latestQuoteUpdatedAt: '2026-04-13 14:30', latestResolvedAt: '2026-04-13T15:30:00.000Z' },
      ]}
    />,
  );

  expect(screen.getByText('估值准确性面板')).toBeInTheDocument();
  expect(screen.getByText('已收敛样本')).toBeInTheDocument();
  expect(screen.getByText('000001')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/components/accuracy/accuracy-dashboard.test.tsx`
Expected: FAIL because the component and route do not exist yet.

- [ ] **Step 3: Write the minimal dashboard implementation**

Create `components/accuracy/accuracy-dashboard.tsx` as a client component that:
- loads snapshots from `estimate-accuracy-storage`
- derives summaries grouped by `fundCode`
- shows:
  - total sample count
  - resolved sample count
  - average error across all resolved samples
  - per-fund rows sorted by highest error first

Create `app/accuracy/page.tsx` as a thin route wrapper.

Modify `app/page.tsx` to add a low-prominence text link to `/accuracy` in the header so the page is reachable without typing the URL.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/components/accuracy/accuracy-dashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/accuracy/page.tsx app/page.tsx components/accuracy/accuracy-dashboard.tsx tests/components/accuracy/accuracy-dashboard.test.tsx
git commit -m "feat: add estimate accuracy dashboard"
```

### Task 6: Add end-to-end verification and sync docs

**Files:**
- Create: `tests/e2e/estimate-accuracy-dashboard.spec.ts`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_STEPS.md`
- Modify: `docs/project/superfinance/docs/index.md`
- Test: `tests/e2e/estimate-accuracy-dashboard.spec.ts`

- [ ] **Step 1: Write the failing E2E**

```ts
import { expect, test } from '@playwright/test';

test('shows confidence metrics after seeded estimate samples exist', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'super-finance-estimate-accuracy',
      JSON.stringify([
        {
          id: '000001::2026-04-10 14:30',
          fundCode: '000001',
          fundName: '基金A',
          quoteUpdatedAt: '2026-04-10 14:30',
          tradingDate: '2026-04-10',
          estimatedNav: 1.02,
          finalNav: 1.00,
          absoluteErrorRate: 0.02,
          resolvedAt: '2026-04-10T15:30:00.000Z',
          createdAt: '2026-04-10T14:30:00.000Z',
          updatedAt: '2026-04-10T15:30:00.000Z',
        },
      ]),
    );
  });

  await page.goto('/accuracy');
  await expect(page.getByText('估值准确性面板')).toBeVisible();
  await expect(page.getByText('000001')).toBeVisible();
  await expect(page.getByText(/2.00%|0.02/)).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm exec -- playwright test tests/e2e/estimate-accuracy-dashboard.spec.ts`
Expected: FAIL because the dashboard route does not exist yet.

- [ ] **Step 3: Implement only the missing wiring and docs updates**

Update docs / status files:
- `PROJECT_STATUS.md` — mark “估值准确性基线与可信度展示” as in progress / completed depending on final state
- `NEXT_STEPS.md` — replace the item with the next accuracy-iteration tasks
- `docs/project/superfinance/docs/index.md` — add `app/accuracy/page.tsx` or the new runbook entry if the feature ships

- [ ] **Step 4: Run the focused verification suite**

Run:
```bash
npm run test -- \
  tests/lib/funds/estimate-accuracy.test.ts \
  tests/lib/storage/estimate-accuracy-storage.test.ts \
  tests/lib/hooks/use-fund-quotes.test.tsx \
  tests/components/fund/estimate-confidence-panel.test.tsx \
  tests/components/accuracy/accuracy-dashboard.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run the browser regression**

Run:
```bash
npm exec -- playwright test \
  tests/e2e/estimate-accuracy-dashboard.spec.ts \
  tests/e2e/nav-fallback-manual.spec.ts \
  tests/e2e/sip-execution-cloud.spec.ts
```

Expected: PASS

- [ ] **Step 6: Run the final full verification**

Run:
```bash
npm run test
npm run build
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/estimate-accuracy-dashboard.spec.ts PROJECT_STATUS.md NEXT_STEPS.md docs/project/superfinance/docs/index.md
git commit -m "feat: add estimate accuracy baseline and confidence views"
```

---

## Notes For Execution
- Keep this iteration local-only; do **not** add Supabase schema for estimate snapshots yet.
- Do **not** attempt minute-level charts in this plan. The goal is confidence baseline, not visual analytics breadth.
- Be honest in the UI: if a fund has too few resolved samples, show `unknown` instead of inventing a confidence score.
- Prefer deriving all summaries from stored snapshots; avoid introducing a second aggregate persistence layer in v1.
