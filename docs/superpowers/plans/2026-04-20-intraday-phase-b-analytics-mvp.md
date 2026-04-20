# Intraday Phase B Analytics MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local analytics MVP that captures key homepage and detail-page intraday interactions so we can validate whether users rely on embedded sparklines, detail views, refreshes, and which intraday states occur most often.

**Architecture:** Introduce a small client-only analytics layer separate from watchlist, accuracy, and intraday storage. UI emits normalized events through a tiny `trackEvent` API into localStorage; a pure aggregation module converts raw events into summary metrics for a lightweight analytics view or debug surface later. This phase stops at schema, storage, tracking hooks, and summary derivation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, localStorage, custom browser events, Vitest + Testing Library.

---

## Scope Guardrails

- Local-only analytics; do not add Supabase sync or third-party analytics SDKs.
- No user identity graph, no session replay, no cookie banner work.
- No production dashboard page in this phase unless needed to inspect summaries locally; prefer a dev-only or accuracy-adjacent summary component.
- Track only high-signal events tied to current P1/P1.5 intraday flows.
- Use dedupe/throttle rules to avoid repeated noisy events during rerenders and scroll.

## Event Schema

### Shared fields

Each event record must contain:

- `id: string`
- `eventName: IntradayAnalyticsEventName`
- `page: 'home' | 'fund_detail'`
- `occurredAt: string`
- `fundCode?: string`
- `tradingDate?: string | null`
- `intradayStatus?: 'ready' | 'generating' | 'stale' | 'empty' | 'unsupported' | null`
- `confidenceLevel?: 'high' | 'medium' | 'low' | 'unknown' | null`
- `coverageRatio?: number | null`
- `meta?: Record<string, string | number | boolean | null>`

### Event names

- `watchlist_row_viewed`
- `watchlist_intraday_visible`
- `watchlist_fund_clicked`
- `watchlist_manual_refresh_clicked`
- `watchlist_intraday_state_seen`
- `fund_detail_viewed`
- `fund_intraday_chart_viewed`
- `fund_intraday_state_seen`

### Dedupe / throttling rules

- `watchlist_row_viewed`: once per fund per page load
- `watchlist_intraday_visible`: once per fund per page load
- `watchlist_intraday_state_seen`: once per `(fundCode, intradayStatus, tradingDate)` per page load
- `fund_detail_viewed`: once per fund per page load
- `fund_intraday_chart_viewed`: once per fund per page load
- `fund_intraday_state_seen`: once per `(fundCode, intradayStatus, tradingDate)` per page load
- `watchlist_manual_refresh_clicked`: every click
- `watchlist_fund_clicked`: every click

## File Map

### Create
- `lib/analytics/intraday-analytics.ts` — event types, event factory, summary derivation helpers.
- `lib/storage/intraday-analytics-storage.ts` — localStorage persistence, bounded retention, same-tab update event.
- `lib/hooks/use-intraday-analytics.ts` — small tracking helpers and per-page dedupe registry.
- `tests/lib/analytics/intraday-analytics.test.ts`
- `tests/lib/storage/intraday-analytics-storage.test.ts`
- `tests/lib/hooks/use-intraday-analytics.test.tsx`

### Modify
- `app/page.tsx` — emit homepage events.
- `components/watchlist/watchlist-table.tsx` — emit per-row visibility/click/state-seen events.
- `components/fund/fund-detail-content.tsx` — emit detail page and chart/state events.
- `tests/app/home-page.test.tsx`
- `tests/components/watchlist/watchlist-table.test.tsx`
- `tests/components/fund/fund-detail-content.test.tsx`

---

## Task 1: Event model and aggregation helpers

**Files:**
- Create: `lib/analytics/intraday-analytics.ts`
- Test: `tests/lib/analytics/intraday-analytics.test.ts`

- [ ] **Step 1: Write failing tests for the event schema**

Cover:
- event creation fills required fields
- invalid optional fields normalize to `null`
- summary aggregation counts events by name
- summary aggregation derives:
  - top viewed funds
  - detail click-through counts
  - intraday status distribution
  - manual refresh count

- [ ] **Step 2: Run the focused test**

Run:

```bash
npm test -- tests/lib/analytics/intraday-analytics.test.ts
```

Expected: fail because the module does not exist.

- [ ] **Step 3: Implement minimal event and summary types**

Include:
- `IntradayAnalyticsEventName`
- `IntradayAnalyticsPage`
- `IntradayAnalyticsEvent`
- `IntradayAnalyticsSummary`

- [ ] **Step 4: Implement minimal pure helpers**

Add:
- `createIntradayAnalyticsEvent`
- `summarizeIntradayAnalyticsEvents`

- [ ] **Step 5: Re-run the focused test**

Run:

```bash
npm test -- tests/lib/analytics/intraday-analytics.test.ts
```

Expected: pass.

## Task 2: Local storage adapter

**Files:**
- Create: `lib/storage/intraday-analytics-storage.ts`
- Test: `tests/lib/storage/intraday-analytics-storage.test.ts`

- [ ] **Step 1: Write failing storage tests**

Cover:
- append one event
- append multiple events
- load all events
- bounded retention, e.g. keep latest 500
- same-tab update event dispatch
- corrupt JSON fallback to `[]`

- [ ] **Step 2: Run the focused test**

Run:

```bash
npm test -- tests/lib/storage/intraday-analytics-storage.test.ts
```

Expected: fail because storage adapter does not exist.

- [ ] **Step 3: Implement minimal storage API**

Add:
- `INTRADAY_ANALYTICS_STORAGE_KEY`
- `INTRADAY_ANALYTICS_UPDATED_EVENT`
- `loadIntradayAnalyticsEvents()`
- `appendIntradayAnalyticsEvent()`
- `clearIntradayAnalyticsEvents()`

- [ ] **Step 4: Re-run the focused test**

Run:

```bash
npm test -- tests/lib/storage/intraday-analytics-storage.test.ts
```

Expected: pass.

## Task 3: Tracking hook with per-page dedupe

**Files:**
- Create: `lib/hooks/use-intraday-analytics.ts`
- Test: `tests/lib/hooks/use-intraday-analytics.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Cover:
- `track()` writes events
- `trackOnce()` dedupes within the mounted page lifetime
- dedupe key includes explicit key, not just event name
- unmount/remount resets page-local dedupe memory

- [ ] **Step 2: Run the focused test**

Run:

```bash
npm test -- tests/lib/hooks/use-intraday-analytics.test.tsx
```

Expected: fail because the hook does not exist.

- [ ] **Step 3: Implement the smallest hook API**

Add:
- `track(eventInput)`
- `trackOnce(dedupeKey, eventInput)`

- [ ] **Step 4: Re-run the focused test**

Run:

```bash
npm test -- tests/lib/hooks/use-intraday-analytics.test.tsx
```

Expected: pass.

## Task 4: Homepage instrumentation

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/watchlist/watchlist-table.tsx`
- Test: `tests/app/home-page.test.tsx`
- Test: `tests/components/watchlist/watchlist-table.test.tsx`

- [ ] **Step 1: Write failing homepage instrumentation tests**

Cover:
- page render emits `watchlist_row_viewed`
- state badge render emits `watchlist_intraday_state_seen`
- clicking fund name emits `watchlist_fund_clicked`
- clicking manual refresh emits `watchlist_manual_refresh_clicked`

- [ ] **Step 2: Run the focused tests**

Run:

```bash
npm test -- tests/app/home-page.test.tsx tests/components/watchlist/watchlist-table.test.tsx
```

Expected: fail due to missing tracking calls.

- [ ] **Step 3: Implement the smallest homepage tracking path**

Notes:
- Track on stable `useEffect`, not during render.
- For fund click, attach to existing link/button flow without changing navigation semantics.
- `watchlist_intraday_visible` can be treated the same as sparkline visible on first row render if we do not add IntersectionObserver in this phase.

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
npm test -- tests/app/home-page.test.tsx tests/components/watchlist/watchlist-table.test.tsx
```

Expected: pass.

## Task 5: Detail-page instrumentation

**Files:**
- Modify: `components/fund/fund-detail-content.tsx`
- Test: `tests/components/fund/fund-detail-content.test.tsx`

- [ ] **Step 1: Write failing detail instrumentation tests**

Cover:
- detail render emits `fund_detail_viewed`
- chart render emits `fund_intraday_chart_viewed`
- trust signal render emits `fund_intraday_state_seen`

- [ ] **Step 2: Run the focused test**

Run:

```bash
npm test -- tests/components/fund/fund-detail-content.test.tsx
```

Expected: fail due to missing tracking calls.

- [ ] **Step 3: Implement the minimal detail-page tracking path**

- [ ] **Step 4: Re-run the focused test**

Run:

```bash
npm test -- tests/components/fund/fund-detail-content.test.tsx
```

Expected: pass.

## Task 6: Regression closeout

**Files:**
- No new product files; verification only.

- [ ] **Step 1: Run analytics-focused tests**

```bash
npm test -- tests/lib/analytics/intraday-analytics.test.ts tests/lib/storage/intraday-analytics-storage.test.ts tests/lib/hooks/use-intraday-analytics.test.tsx tests/app/home-page.test.tsx tests/components/watchlist/watchlist-table.test.tsx tests/components/fund/fund-detail-content.test.tsx
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

- [ ] **Step 3: Run production build**

```bash
npm run build
```

---

## TDD Execution Order

1. Event schema and summary derivation
2. Storage adapter
3. Tracking hook with dedupe
4. Homepage events
5. Detail-page events
6. Full regression and build

## Recommended First Commit Breakdown

- `feat: add intraday analytics event schema`
- `feat: add local intraday analytics storage`
- `feat: instrument home and detail intraday analytics`
