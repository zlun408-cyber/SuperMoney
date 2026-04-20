# Intraday Phase A Trust Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clear intraday data status, coverage, and confidence signals to the homepage watchlist and fund detail views so users can quickly judge whether a minute chart is ready and trustworthy.

**Architecture:** Keep the existing local intraday storage and chart rendering flow intact. Add a pure derivation layer that converts quote + intraday points + optional accuracy summary into a small trust-signal view model; `useFundQuotes` exposes the derived data, and the watchlist/detail UI renders it through compact badges and metadata rows.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, localStorage, Vitest + Testing Library, Playwright.

---

## Scope Guardrails

- Reuse current intraday capture/storage; do not redesign storage format in this phase.
- Keep confidence derivation rule-based; no ML/weighted heuristic tuning beyond a small fixed ruleset.
- Do not add analytics, assistant entry points, or new pages.
- Keep the homepage list compact: short labels only, no long explanations in-row.

## File Map

### Create
- `lib/funds/intraday-status.ts` — pure derivation for status, coverage, freshness, and confidence.
- `components/fund/intraday-status-badge.tsx` — reusable compact badge/label renderer for data status and confidence.
- `tests/lib/funds/intraday-status.test.ts`
- `tests/components/fund/intraday-status-badge.test.tsx`

### Modify
- `lib/funds/types.ts` — add intraday status/coverage/confidence view-model types.
- `lib/hooks/use-fund-quotes.ts` — expose derived intraday trust signals alongside quotes.
- `components/watchlist/watchlist-table.tsx` — render compact state row near the embedded sparkline.
- `components/fund/fund-intraday-chart.tsx` — render detail metadata row for status, coverage, confidence, latest update.
- `components/fund/fund-detail-card.tsx` — pass detail-level trust data into the chart.
- `components/fund/fund-detail-content.tsx` — compute and pass current fund trust signals.
- `app/page.tsx` — pass watchlist trust signals into the table.
- `tests/components/watchlist/watchlist-table.test.tsx`
- `tests/components/fund/fund-intraday-chart.test.tsx`
- `tests/components/fund/fund-detail-content.test.tsx`
- `tests/app/home-page.test.tsx`
- `tests/lib/hooks/use-fund-quotes.test.tsx`
- `tests/e2e/intraday-watchlist-dashboard.spec.ts`

---

### Task 1: Intraday trust-signal domain model

**Files:**
- Create: `lib/funds/intraday-status.ts`
- Modify: `lib/funds/types.ts`
- Test: `tests/lib/funds/intraday-status.test.ts`

- [ ] Write failing tests for:
  - `ready / generating / stale / empty / unsupported`
  - coverage text and ratio
  - confidence `high / medium / low / unknown`
  - latest update formatting passthrough
- [ ] Run `npm test -- tests/lib/funds/intraday-status.test.ts` and confirm failure.
- [ ] Add minimal shared types to `lib/funds/types.ts`.
- [ ] Implement pure derivation helpers in `lib/funds/intraday-status.ts`.
- [ ] Re-run `npm test -- tests/lib/funds/intraday-status.test.ts`.

### Task 2: Hook and page-level data wiring

**Files:**
- Modify: `lib/hooks/use-fund-quotes.ts`
- Modify: `app/page.tsx`
- Modify: `components/fund/fund-detail-content.tsx`
- Test: `tests/lib/hooks/use-fund-quotes.test.tsx`
- Test: `tests/app/home-page.test.tsx`
- Test: `tests/components/fund/fund-detail-content.test.tsx`

- [ ] Write failing tests showing homepage/detail receive derived trust data without breaking existing quote flow.
- [ ] Run the focused test files and confirm failure.
- [ ] Add the smallest possible derived object wiring.
- [ ] Re-run focused tests until green.

### Task 3: Reusable badge component

**Files:**
- Create: `components/fund/intraday-status-badge.tsx`
- Test: `tests/components/fund/intraday-status-badge.test.tsx`

- [ ] Write failing badge tests for tone/label rendering.
- [ ] Run `npm test -- tests/components/fund/intraday-status-badge.test.tsx` and confirm failure.
- [ ] Implement the minimal reusable badge component.
- [ ] Re-run the badge test file until green.

### Task 4: Homepage list trust signals

**Files:**
- Modify: `components/watchlist/watchlist-table.tsx`
- Test: `tests/components/watchlist/watchlist-table.test.tsx`

- [ ] Write failing tests for compact row labels near each sparkline:
  - latest update
  - status label
  - confidence label
  - coverage text when available
- [ ] Run `npm test -- tests/components/watchlist/watchlist-table.test.tsx` and confirm failure.
- [ ] Implement the smallest list UI changes.
- [ ] Re-run the same test file until green.

### Task 5: Detail chart trust signals

**Files:**
- Modify: `components/fund/fund-intraday-chart.tsx`
- Modify: `components/fund/fund-detail-card.tsx`
- Test: `tests/components/fund/fund-intraday-chart.test.tsx`

- [ ] Write failing tests for the detail metadata row:
  - latest update
  - status
  - confidence
  - coverage
  - empty state text alignment with status
- [ ] Run `npm test -- tests/components/fund/fund-intraday-chart.test.tsx` and confirm failure.
- [ ] Implement the minimal chart/header updates.
- [ ] Re-run the same test file until green.

### Task 6: E2E + regression closeout

**Files:**
- Modify: `tests/e2e/intraday-watchlist-dashboard.spec.ts`

- [ ] Add at least one homepage assertion for trust signals.
- [ ] Add at least one detail-page assertion for trust signals.
- [ ] Run `npm exec -- playwright test tests/e2e/intraday-watchlist-dashboard.spec.ts`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.

