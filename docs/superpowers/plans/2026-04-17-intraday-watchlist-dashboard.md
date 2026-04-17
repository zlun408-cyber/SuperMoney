# Intraday Watchlist Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the original P1 dashboard MVP: embedded intraday minute trend visuals in the watchlist table plus an expanded today chart on the fund detail page.

**Architecture:** Add a local intraday quote history layer that samples successful `useFundQuotes` results into per-fund, per-minute points. UI reads those points through focused helpers and renders lightweight SVG charts; no new page, no new external data source, no cloud sync in this MVP.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, localStorage, Vitest + Testing Library, Playwright.

---

## Implementation Notes

- Follow TDD: write each failing test first, run it, implement the minimum code, rerun it.
- Do **not** parallelize full Vitest and Playwright runs; existing fake-timer tests can produce misleading timeouts when commands run concurrently.
- Existing working tree is dirty from prior phases. Treat `git commit` steps as optional checkpoints only after the current owner confirms the dirty tree can be committed together.
- Keep intraday storage local-only for this MVP.
- Keep all intraday side effects non-blocking: a storage failure must not alter quote loading behavior.

---

## File Map

### Create
- `lib/storage/estimate-intraday-storage.ts` — localStorage persistence, normalization, upsert, prune, and same-tab update event.
- `lib/funds/estimate-intraday.ts` — pure helpers for building points, filtering today, summaries, trend labels, SVG path normalization.
- `components/watchlist/fund-trend-badge.tsx` — compact trend label near fund name.
- `components/watchlist/fund-intraday-sparkline.tsx` — table sparkline SVG.
- `components/fund/fund-intraday-chart.tsx` — detail page expanded intraday chart.
- `tests/lib/storage/estimate-intraday-storage.test.ts`
- `tests/lib/funds/estimate-intraday.test.ts`
- `tests/components/watchlist/fund-trend-badge.test.tsx`
- `tests/components/watchlist/fund-intraday-sparkline.test.tsx`
- `tests/components/fund/fund-intraday-chart.test.tsx`
- `tests/e2e/intraday-watchlist-dashboard.spec.ts`

### Modify
- `lib/funds/types.ts` — add `EstimateIntradayPoint` and trend/summary types if needed.
- `lib/hooks/use-fund-quotes.ts` — sample successful quotes into intraday storage.
- `components/watchlist/watchlist-table.tsx` — add trend badge beside fund name and a “分钟走势” column.
- `app/page.tsx` — load intraday points, subscribe to intraday update events, pass points into `WatchlistTable`.
- `components/fund/fund-detail-content.tsx` — load current fund intraday points, subscribe to updates, pass into `FundDetailCard`.
- `components/fund/fund-detail-card.tsx` — render `FundIntradayChart` near the estimate summary.
- `tests/lib/hooks/use-fund-quotes.test.tsx` — cover intraday sampling side effects.
- `tests/components/watchlist/watchlist-table.test.tsx` — cover embedded trend and sparkline column.
- `tests/app/home-page.test.tsx` — cover page-level intraday loading and props.
- `tests/components/fund/fund-detail-content.test.tsx` — cover detail page intraday loading and update subscription.

---

## Task 1: Intraday Domain Types and Pure Helpers

**Files:**
- Modify: `lib/funds/types.ts`
- Create: `lib/funds/estimate-intraday.ts`
- Test: `tests/lib/funds/estimate-intraday.test.ts`

- [ ] **Step 1: Write failing helper tests**

Add `tests/lib/funds/estimate-intraday.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  buildEstimateIntradayPoint,
  buildIntradaySummary,
  classifyIntradayTrend,
  filterIntradayPointsForTradingDate,
  normalizeIntradayChartPoints,
} from '@/lib/funds/estimate-intraday';
import type { EstimateIntradayPoint, FundQuote } from '@/lib/funds/types';

const quote = (overrides: Partial<FundQuote> = {}): FundQuote => ({
  code: '000001',
  name: '测试基金',
  estimatedNav: 1.2345,
  changeRate: 0.82,
  updatedAt: '2026-04-17 10:31',
  ...overrides,
});

const point = (overrides: Partial<EstimateIntradayPoint> = {}): EstimateIntradayPoint => ({
  fundCode: '000001',
  fundName: '测试基金',
  tradingDate: '2026-04-17',
  minuteKey: '2026-04-17 10:30',
  estimatedNav: 1,
  changeRate: 0,
  updatedAt: '2026-04-17 10:30',
  capturedAt: '2026-04-17T02:30:00.000Z',
  ...overrides,
});

describe('estimate intraday helpers', () => {
  it('builds a minute-level intraday point from a quote', () => {
    expect(
      buildEstimateIntradayPoint(quote(), '2026-04-17T02:31:45.000Z'),
    ).toEqual({
      fundCode: '000001',
      fundName: '测试基金',
      tradingDate: '2026-04-17',
      minuteKey: '2026-04-17 10:31',
      estimatedNav: 1.2345,
      changeRate: 0.82,
      updatedAt: '2026-04-17 10:31',
      capturedAt: '2026-04-17T02:31:45.000Z',
    });
  });

  it('filters malformed or non-matching trading dates', () => {
    expect(
      filterIntradayPointsForTradingDate([
        point({ minuteKey: '2026-04-17 10:30' }),
        point({ tradingDate: '2026-04-16', minuteKey: '2026-04-16 14:30' }),
      ], '2026-04-17'),
    ).toEqual([point({ minuteKey: '2026-04-17 10:30' })]);
  });

  it('classifies up, down, flat and volatile trends', () => {
    expect(classifyIntradayTrend([point({ estimatedNav: 1 }), point({ estimatedNav: 1.01 })])).toBe('up');
    expect(classifyIntradayTrend([point({ estimatedNav: 1.01 }), point({ estimatedNav: 1 })])).toBe('down');
    expect(classifyIntradayTrend([point({ estimatedNav: 1 }), point({ estimatedNav: 1.0001 })])).toBe('flat');
    expect(
      classifyIntradayTrend([
        point({ estimatedNav: 1 }),
        point({ minuteKey: '2026-04-17 10:31', estimatedNav: 1.02 }),
        point({ minuteKey: '2026-04-17 10:32', estimatedNav: 1.001 }),
      ]),
    ).toBe('volatile');
  });

  it('builds summary values for the detail chart', () => {
    expect(
      buildIntradaySummary([
        point({ minuteKey: '2026-04-17 10:30', estimatedNav: 1, changeRate: 0.1 }),
        point({ minuteKey: '2026-04-17 10:31', estimatedNav: 1.02, changeRate: 1.1 }),
        point({ minuteKey: '2026-04-17 10:32', estimatedNav: 0.99, changeRate: -0.5 }),
      ]),
    ).toMatchObject({
      pointCount: 3,
      firstEstimatedNav: 1,
      latestEstimatedNav: 0.99,
      highEstimatedNav: 1.02,
      lowEstimatedNav: 0.99,
      changeFromFirst: -0.01,
      changeRateFromFirst: -1,
      latestChangeRate: -0.5,
      latestUpdatedAt: '2026-04-17 10:32',
      trend: 'volatile',
    });
  });

  it('normalizes chart points into an SVG viewport', () => {
    expect(
      normalizeIntradayChartPoints([
        point({ minuteKey: '2026-04-17 10:30', estimatedNav: 1 }),
        point({ minuteKey: '2026-04-17 10:31', estimatedNav: 2 }),
      ], 100, 40),
    ).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run helper tests and confirm failure**

Run:

```bash
npm test -- tests/lib/funds/estimate-intraday.test.ts
```

Expected: FAIL because `lib/funds/estimate-intraday.ts` and types do not exist.

- [ ] **Step 3: Add types**

Modify `lib/funds/types.ts` near the other estimate types:

```ts
export interface EstimateIntradayPoint {
  fundCode: string;
  fundName: string;
  tradingDate: string;
  minuteKey: string;
  estimatedNav: number;
  changeRate: number;
  updatedAt: string;
  capturedAt: string;
}

export type EstimateIntradayTrend = 'unknown' | 'up' | 'down' | 'flat' | 'volatile';

export interface EstimateIntradaySummary {
  pointCount: number;
  firstEstimatedNav: number | null;
  latestEstimatedNav: number | null;
  highEstimatedNav: number | null;
  lowEstimatedNav: number | null;
  changeFromFirst: number | null;
  changeRateFromFirst: number | null;
  latestChangeRate: number | null;
  latestUpdatedAt: string | null;
  trend: EstimateIntradayTrend;
}
```

- [ ] **Step 4: Implement pure helpers**

Create `lib/funds/estimate-intraday.ts` with:

```ts
import type {
  EstimateIntradayPoint,
  EstimateIntradaySummary,
  EstimateIntradayTrend,
  FundQuote,
} from '@/lib/funds/types';

const MINUTE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
const FLAT_THRESHOLD_RATE = 0.001;
const VOLATILE_AMPLITUDE_RATE = 0.01;

const round = (value: number, digits = 6): number => Number(value.toFixed(digits));

export function deriveIntradayTradingDate(updatedAt: string): string {
  return updatedAt.slice(0, 10);
}

export function deriveIntradayMinuteKey(updatedAt: string): string {
  const normalized = updatedAt.replace('T', ' ');
  return normalized.slice(0, 16);
}

export function buildEstimateIntradayPoint(
  quote: FundQuote,
  capturedAt: string,
): EstimateIntradayPoint | null {
  if (
    !quote.code ||
    !quote.name ||
    typeof quote.estimatedNav !== 'number' ||
    typeof quote.changeRate !== 'number' ||
    !MINUTE_KEY_PATTERN.test(quote.updatedAt)
  ) {
    return null;
  }

  return {
    fundCode: quote.code,
    fundName: quote.name,
    tradingDate: deriveIntradayTradingDate(quote.updatedAt),
    minuteKey: deriveIntradayMinuteKey(quote.updatedAt),
    estimatedNav: quote.estimatedNav,
    changeRate: quote.changeRate,
    updatedAt: quote.updatedAt,
    capturedAt,
  };
}

export function isEstimateIntradayPoint(value: unknown): value is EstimateIntradayPoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.fundCode === 'string' &&
    typeof item.fundName === 'string' &&
    typeof item.tradingDate === 'string' &&
    typeof item.minuteKey === 'string' &&
    typeof item.estimatedNav === 'number' &&
    Number.isFinite(item.estimatedNav) &&
    typeof item.changeRate === 'number' &&
    Number.isFinite(item.changeRate) &&
    typeof item.updatedAt === 'string' &&
    typeof item.capturedAt === 'string'
  );
}

export function sortIntradayPoints(points: EstimateIntradayPoint[]): EstimateIntradayPoint[] {
  return [...points].sort((left, right) => left.minuteKey.localeCompare(right.minuteKey));
}

export function filterIntradayPointsForTradingDate(
  points: EstimateIntradayPoint[],
  tradingDate: string,
): EstimateIntradayPoint[] {
  return sortIntradayPoints(points.filter((point) => point.tradingDate === tradingDate));
}

export function classifyIntradayTrend(points: EstimateIntradayPoint[]): EstimateIntradayTrend {
  if (points.length < 2) {
    return 'unknown';
  }

  const sorted = sortIntradayPoints(points);
  const first = sorted[0].estimatedNav;
  const latest = sorted.at(-1)?.estimatedNav ?? first;
  const high = Math.max(...sorted.map((point) => point.estimatedNav));
  const low = Math.min(...sorted.map((point) => point.estimatedNav));
  const base = Math.abs(first) > 0 ? Math.abs(first) : 1;
  const directionRate = (latest - first) / base;
  const amplitudeRate = (high - low) / base;

  if (Math.abs(directionRate) <= FLAT_THRESHOLD_RATE) {
    return amplitudeRate >= VOLATILE_AMPLITUDE_RATE ? 'volatile' : 'flat';
  }

  if (amplitudeRate >= VOLATILE_AMPLITUDE_RATE && Math.abs(directionRate) < amplitudeRate * 0.35) {
    return 'volatile';
  }

  return directionRate > 0 ? 'up' : 'down';
}

export function buildIntradaySummary(points: EstimateIntradayPoint[]): EstimateIntradaySummary {
  const sorted = sortIntradayPoints(points);

  if (sorted.length === 0) {
    return {
      pointCount: 0,
      firstEstimatedNav: null,
      latestEstimatedNav: null,
      highEstimatedNav: null,
      lowEstimatedNav: null,
      changeFromFirst: null,
      changeRateFromFirst: null,
      latestChangeRate: null,
      latestUpdatedAt: null,
      trend: 'unknown',
    };
  }

  const first = sorted[0];
  const latest = sorted.at(-1) ?? first;
  const values = sorted.map((point) => point.estimatedNav);
  const changeFromFirst = latest.estimatedNav - first.estimatedNav;

  return {
    pointCount: sorted.length,
    firstEstimatedNav: first.estimatedNav,
    latestEstimatedNav: latest.estimatedNav,
    highEstimatedNav: Math.max(...values),
    lowEstimatedNav: Math.min(...values),
    changeFromFirst: round(changeFromFirst),
    changeRateFromFirst:
      first.estimatedNav === 0 ? null : round((changeFromFirst / first.estimatedNav) * 100, 4),
    latestChangeRate: latest.changeRate,
    latestUpdatedAt: latest.updatedAt,
    trend: classifyIntradayTrend(sorted),
  };
}

export function normalizeIntradayChartPoints(
  points: EstimateIntradayPoint[],
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  const sorted = sortIntradayPoints(points);

  if (sorted.length === 0) {
    return [];
  }

  if (sorted.length === 1) {
    return [{ x: width / 2, y: height / 2 }];
  }

  const values = sorted.map((point) => point.estimatedNav);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  return sorted.map((point, index) => ({
    x: round((index / (sorted.length - 1)) * width, 3),
    y: range === 0 ? height / 2 : round(height - ((point.estimatedNav - min) / range) * height, 3),
  }));
}

export function buildSvgPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}
```

- [ ] **Step 5: Run helper tests and confirm pass**

Run:

```bash
npm test -- tests/lib/funds/estimate-intraday.test.ts
```

Expected: PASS.

---

## Task 2: Intraday Storage Layer

**Files:**
- Create: `lib/storage/estimate-intraday-storage.ts`
- Test: `tests/lib/storage/estimate-intraday-storage.test.ts`

- [ ] **Step 1: Write failing storage tests**

Add `tests/lib/storage/estimate-intraday-storage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstimateIntradayPoint } from '@/lib/funds/types';
import {
  ESTIMATE_INTRADAY_STORAGE_KEY,
  ESTIMATE_INTRADAY_UPDATED_EVENT,
  loadEstimateIntradayPoints,
  saveEstimateIntradayPoints,
  upsertEstimateIntradayPoints,
} from '@/lib/storage/estimate-intraday-storage';

const point = (overrides: Partial<EstimateIntradayPoint> = {}): EstimateIntradayPoint => ({
  fundCode: '000001',
  fundName: '测试基金',
  tradingDate: '2026-04-17',
  minuteKey: '2026-04-17 10:30',
  estimatedNav: 1,
  changeRate: 0,
  updatedAt: '2026-04-17 10:30',
  capturedAt: '2026-04-17T02:30:00.000Z',
  ...overrides,
});

describe('estimate intraday storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads an empty collection when localStorage is empty or malformed', () => {
    expect(loadEstimateIntradayPoints()).toEqual({});

    window.localStorage.setItem(ESTIMATE_INTRADAY_STORAGE_KEY, '{bad json');
    expect(loadEstimateIntradayPoints()).toEqual({});
  });

  it('saves valid points and broadcasts a same-tab update event', () => {
    const listener = vi.fn();
    window.addEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, listener);

    saveEstimateIntradayPoints({ '000001': [point()] });

    expect(JSON.parse(window.localStorage.getItem(ESTIMATE_INTRADAY_STORAGE_KEY) ?? '{}')).toEqual({
      '000001': [point()],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('filters malformed points when loading', () => {
    window.localStorage.setItem(
      ESTIMATE_INTRADAY_STORAGE_KEY,
      JSON.stringify({
        '000001': [point(), { fundCode: '000001', estimatedNav: 'bad' }],
      }),
    );

    expect(loadEstimateIntradayPoints()).toEqual({ '000001': [point()] });
  });

  it('upserts by fundCode and minuteKey while keeping latest same-minute value', () => {
    const result = upsertEstimateIntradayPoints(
      { '000001': [point({ estimatedNav: 1 })] },
      [point({ estimatedNav: 1.01, changeRate: 0.2, capturedAt: '2026-04-17T02:30:20.000Z' })],
      '2026-04-17',
    );

    expect(result['000001']).toEqual([
      point({ estimatedNav: 1.01, changeRate: 0.2, capturedAt: '2026-04-17T02:30:20.000Z' }),
    ]);
  });

  it('prunes non-current trading dates and caps per-fund points', () => {
    const points = Array.from({ length: 305 }, (_, index) =>
      point({ minuteKey: `2026-04-17 10:${String(index).padStart(2, '0')}`, estimatedNav: 1 + index / 1000 }),
    );

    const result = upsertEstimateIntradayPoints(
      {
        '000001': [point({ tradingDate: '2026-04-16', minuteKey: '2026-04-16 14:30' })],
      },
      points,
      '2026-04-17',
      300,
    );

    expect(result['000001']).toHaveLength(300);
    expect(result['000001'].every((item) => item.tradingDate === '2026-04-17')).toBe(true);
  });
});
```

- [ ] **Step 2: Run storage tests and confirm failure**

Run:

```bash
npm test -- tests/lib/storage/estimate-intraday-storage.test.ts
```

Expected: FAIL because storage module does not exist.

- [ ] **Step 3: Implement storage module**

Create `lib/storage/estimate-intraday-storage.ts`:

```ts
import { isEstimateIntradayPoint, sortIntradayPoints } from '@/lib/funds/estimate-intraday';
import type { EstimateIntradayPoint } from '@/lib/funds/types';

export const ESTIMATE_INTRADAY_STORAGE_KEY = 'super-finance-estimate-intraday';
export const ESTIMATE_INTRADAY_UPDATED_EVENT = 'super-finance-estimate-intraday-updated';
export const DEFAULT_INTRADAY_POINTS_LIMIT = 300;

export type EstimateIntradayPointMap = Record<string, EstimateIntradayPoint[]>;

const dispatchUpdatedEvent = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(ESTIMATE_INTRADAY_UPDATED_EVENT));
};

const normalizePointMap = (value: unknown): EstimateIntradayPointMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<EstimateIntradayPointMap>(
    (result, [fundCode, maybePoints]) => {
      if (!Array.isArray(maybePoints)) {
        return result;
      }

      const points = maybePoints.filter(isEstimateIntradayPoint);
      if (points.length > 0) {
        result[fundCode] = sortIntradayPoints(points);
      }
      return result;
    },
    {},
  );
};

export function loadEstimateIntradayPoints(): EstimateIntradayPointMap {
  if (typeof window === 'undefined') {
    return {};
  }

  const rawValue = window.localStorage.getItem(ESTIMATE_INTRADAY_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    return normalizePointMap(JSON.parse(rawValue));
  } catch {
    return {};
  }
}

export function saveEstimateIntradayPoints(pointsByFund: EstimateIntradayPointMap): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    ESTIMATE_INTRADAY_STORAGE_KEY,
    JSON.stringify(normalizePointMap(pointsByFund)),
  );
  dispatchUpdatedEvent();
}

export function upsertEstimateIntradayPoints(
  existing: EstimateIntradayPointMap,
  incomingPoints: EstimateIntradayPoint[],
  currentTradingDate: string,
  perFundLimit = DEFAULT_INTRADAY_POINTS_LIMIT,
): EstimateIntradayPointMap {
  const next: EstimateIntradayPointMap = {};

  for (const [fundCode, points] of Object.entries(existing)) {
    const currentDatePoints = points.filter((point) => point.tradingDate === currentTradingDate);
    if (currentDatePoints.length > 0) {
      next[fundCode] = currentDatePoints;
    }
  }

  for (const point of incomingPoints.filter((item) => item.tradingDate === currentTradingDate)) {
    const points = next[point.fundCode] ?? [];
    const byMinute = new Map(points.map((item) => [item.minuteKey, item] as const));
    byMinute.set(point.minuteKey, point);
    next[point.fundCode] = sortIntradayPoints([...byMinute.values()]).slice(-perFundLimit);
  }

  return next;
}

export function saveEstimateIntradayQuotePoints(
  incomingPoints: EstimateIntradayPoint[],
  currentTradingDate: string,
): void {
  if (incomingPoints.length === 0) {
    return;
  }

  const existing = loadEstimateIntradayPoints();
  saveEstimateIntradayPoints(
    upsertEstimateIntradayPoints(existing, incomingPoints, currentTradingDate),
  );
}
```

- [ ] **Step 4: Run storage tests and confirm pass**

Run:

```bash
npm test -- tests/lib/storage/estimate-intraday-storage.test.ts
```

Expected: PASS.

---

## Task 3: Sample Intraday Points from Quote Refreshes

**Files:**
- Modify: `lib/hooks/use-fund-quotes.ts`
- Test: `tests/lib/hooks/use-fund-quotes.test.tsx`

- [ ] **Step 1: Add failing hook tests**

Append to `tests/lib/hooks/use-fund-quotes.test.tsx`:

```ts
import * as intradayStorage from '@/lib/storage/estimate-intraday-storage';
```

If imports must stay grouped, place it with the other imports.

Add tests in `describe('useFundQuotes estimate accuracy side effects', ...)` or a new describe:

```ts
describe('useFundQuotes intraday side effects', () => {
  it('samples successful quotes into the intraday store', async () => {
    vi.useRealTimers();
    vi.spyOn(intradayStorage, 'saveEstimateIntradayQuotePoints').mockImplementation(vi.fn());
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-17 10:31',
      },
    ]);

    renderHook(() =>
      useFundQuotes(['000001'], fetcher, 60_000, {
        loadSnapshots: () => [],
        saveSnapshots: vi.fn(),
        resolveFinalNav: vi.fn().mockResolvedValue(null),
      }),
    );

    await waitFor(() => {
      expect(intradayStorage.saveEstimateIntradayQuotePoints).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            fundCode: '000001',
            fundName: '基金A',
            tradingDate: '2026-04-17',
            minuteKey: '2026-04-17 10:31',
            estimatedNav: 1.23,
            changeRate: 0.8,
          }),
        ],
        '2026-04-17',
      );
    });
  });

  it('keeps quote success semantics when intraday storage throws', async () => {
    vi.spyOn(intradayStorage, 'saveEstimateIntradayQuotePoints').mockImplementation(() => {
      throw new Error('intraday write failed');
    });
    const fetcher = vi.fn().mockResolvedValue([
      {
        code: '000001',
        name: '基金A',
        estimatedNav: 1.23,
        changeRate: 0.8,
        updatedAt: '2026-04-17 10:31',
      },
    ]);

    const { result } = renderHook(() => useFundQuotes(['000001'], fetcher, 60_000));

    await waitFor(() => {
      expect(result.current.quotes).toEqual([
        expect.objectContaining({ code: '000001', estimatedNav: 1.23 }),
      ]);
      expect(result.current.error).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run hook tests and confirm failure**

Run:

```bash
npm test -- tests/lib/hooks/use-fund-quotes.test.tsx
```

Expected: FAIL because `useFundQuotes` does not call intraday storage.

- [ ] **Step 3: Implement intraday side effect**

Modify `lib/hooks/use-fund-quotes.ts` imports:

```ts
import { buildEstimateIntradayPoint } from '@/lib/funds/estimate-intraday';
import { saveEstimateIntradayQuotePoints } from '@/lib/storage/estimate-intraday-storage';
```

Inside `loadQuotes`, near the existing accuracy side-effect helpers, add:

```ts
const runIntradaySideEffects = (nextQuotes: FundQuote[]) => {
  if (!isLatestRequest() || nextQuotes.length === 0) {
    return;
  }

  const capturedAt = new Date().toISOString();
  const points = nextQuotes
    .map((quote) => buildEstimateIntradayPoint(quote, capturedAt))
    .filter((point): point is NonNullable<typeof point> => point !== null);

  if (points.length === 0) {
    return;
  }

  saveEstimateIntradayQuotePoints(points, points[0].tradingDate);
};

const runIntradaySideEffectsSafely = (nextQuotes: FundQuote[]) => {
  try {
    runIntradaySideEffects(nextQuotes);
  } catch {
    // Intraday tracking must never alter quote loading behavior.
  }
};
```

In the `finally` block, after `setIsRefreshing(false)` and before/after `await runAccuracySideEffectsSafely(quotesForAccuracy)`, call:

```ts
runIntradaySideEffectsSafely(quotesForAccuracy);
```

Do not write intraday points in the catch path when using previous quotes after a failed refresh.

- [ ] **Step 4: Run hook tests and confirm pass**

Run:

```bash
npm test -- tests/lib/hooks/use-fund-quotes.test.tsx
```

Expected: PASS.

---

## Task 4: Watchlist Trend Badge and Sparkline Components

**Files:**
- Create: `components/watchlist/fund-trend-badge.tsx`
- Create: `components/watchlist/fund-intraday-sparkline.tsx`
- Test: `tests/components/watchlist/fund-trend-badge.test.tsx`
- Test: `tests/components/watchlist/fund-intraday-sparkline.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `tests/components/watchlist/fund-trend-badge.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FundTrendBadge } from '@/components/watchlist/fund-trend-badge';
import type { EstimateIntradaySummary } from '@/lib/funds/types';

const summary = (overrides: Partial<EstimateIntradaySummary> = {}): EstimateIntradaySummary => ({
  pointCount: 3,
  firstEstimatedNav: 1,
  latestEstimatedNav: 1.01,
  highEstimatedNav: 1.02,
  lowEstimatedNav: 1,
  changeFromFirst: 0.01,
  changeRateFromFirst: 1,
  latestChangeRate: 0.8,
  latestUpdatedAt: '2026-04-17 10:32',
  trend: 'up',
  ...overrides,
});

describe('FundTrendBadge', () => {
  it('renders up trend and today change summary', () => {
    render(<FundTrendBadge summary={summary()} />);

    expect(screen.getByText('上行')).toBeTruthy();
    expect(screen.getByText('今日 +1.00%')).toBeTruthy();
  });

  it('renders an accumulating state for fewer than two points', () => {
    render(<FundTrendBadge summary={summary({ pointCount: 1, trend: 'unknown', changeRateFromFirst: null })} />);

    expect(screen.getByText('数据积累中')).toBeTruthy();
  });
});
```

Create `tests/components/watchlist/fund-intraday-sparkline.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FundIntradaySparkline } from '@/components/watchlist/fund-intraday-sparkline';
import type { EstimateIntradayPoint } from '@/lib/funds/types';

const point = (overrides: Partial<EstimateIntradayPoint> = {}): EstimateIntradayPoint => ({
  fundCode: '000001',
  fundName: '测试基金',
  tradingDate: '2026-04-17',
  minuteKey: '2026-04-17 10:30',
  estimatedNav: 1,
  changeRate: 0,
  updatedAt: '2026-04-17 10:30',
  capturedAt: '2026-04-17T02:30:00.000Z',
  ...overrides,
});

describe('FundIntradaySparkline', () => {
  it('renders an empty state without points', () => {
    render(<FundIntradaySparkline points={[]} />);

    expect(screen.getByText('暂无走势')).toBeTruthy();
  });

  it('renders a lightweight svg when multiple points exist', () => {
    render(
      <FundIntradaySparkline
        points={[
          point({ estimatedNav: 1 }),
          point({ minuteKey: '2026-04-17 10:31', estimatedNav: 1.01 }),
        ]}
      />,
    );

    expect(screen.getByTestId('fund-intraday-sparkline')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run component tests and confirm failure**

Run:

```bash
npm test -- tests/components/watchlist/fund-trend-badge.test.tsx tests/components/watchlist/fund-intraday-sparkline.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement `FundTrendBadge`**

Create `components/watchlist/fund-trend-badge.tsx`:

```tsx
import React from 'react';

import type { EstimateIntradaySummary, EstimateIntradayTrend } from '@/lib/funds/types';

const trendLabels: Record<EstimateIntradayTrend, string> = {
  unknown: '数据积累中',
  up: '上行',
  down: '回落',
  flat: '横盘',
  volatile: '波动',
};

const trendClasses: Record<EstimateIntradayTrend, string> = {
  unknown: 'bg-slate-100 text-slate-500 ring-slate-200',
  up: 'bg-rose-50 text-rose-700 ring-rose-200',
  down: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  flat: 'bg-slate-100 text-slate-600 ring-slate-200',
  volatile: 'bg-amber-50 text-amber-700 ring-amber-200',
};

function formatTodayChange(value: number | null): string {
  if (typeof value !== 'number') {
    return '今日 --';
  }

  return `今日 ${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function FundTrendBadge({ summary }: { summary: EstimateIntradaySummary }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ring-1 ${trendClasses[summary.trend]}`}>
        {trendLabels[summary.trend]}
      </span>
      <span className="text-slate-500">{formatTodayChange(summary.changeRateFromFirst)}</span>
    </div>
  );
}
```

- [ ] **Step 4: Implement `FundIntradaySparkline`**

Create `components/watchlist/fund-intraday-sparkline.tsx`:

```tsx
import React from 'react';

import {
  buildIntradaySummary,
  buildSvgPath,
  normalizeIntradayChartPoints,
} from '@/lib/funds/estimate-intraday';
import type { EstimateIntradayPoint } from '@/lib/funds/types';

export function FundIntradaySparkline({ points }: { points: EstimateIntradayPoint[] }) {
  const summary = buildIntradaySummary(points);

  if (summary.pointCount === 0) {
    return <span className="text-xs text-slate-400">暂无走势</span>;
  }

  if (summary.pointCount === 1) {
    return <span className="text-xs text-slate-400">走势积累中</span>;
  }

  const normalized = normalizeIntradayChartPoints(points, 120, 36);
  const path = buildSvgPath(normalized);
  const strokeClass = summary.trend === 'down' ? 'stroke-emerald-500' : summary.trend === 'up' ? 'stroke-rose-500' : 'stroke-amber-500';

  return (
    <svg
      aria-label="今日分钟走势"
      className="h-10 w-32 overflow-visible"
      data-testid="fund-intraday-sparkline"
      role="img"
      viewBox="0 0 120 36"
    >
      <path d={path} className={`${strokeClass} fill-none`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
```

- [ ] **Step 5: Run component tests and confirm pass**

Run:

```bash
npm test -- tests/components/watchlist/fund-trend-badge.test.tsx tests/components/watchlist/fund-intraday-sparkline.test.tsx
```

Expected: PASS.

---

## Task 5: Embed Intraday Trends in Watchlist Table and Home Page

**Files:**
- Modify: `components/watchlist/watchlist-table.tsx`
- Modify: `app/page.tsx`
- Test: `tests/components/watchlist/watchlist-table.test.tsx`
- Test: `tests/app/home-page.test.tsx`

- [ ] **Step 1: Add failing `WatchlistTable` tests**

In `tests/components/watchlist/watchlist-table.test.tsx`, import the point type if needed and add:

```ts
const intradayPoint = (overrides = {}) => ({
  fundCode: '000001',
  fundName: '测试基金',
  tradingDate: '2026-04-17',
  minuteKey: '2026-04-17 10:30',
  estimatedNav: 1,
  changeRate: 0,
  updatedAt: '2026-04-17 10:30',
  capturedAt: '2026-04-17T02:30:00.000Z',
  ...overrides,
});

it('renders intraday trend beside fund name and a sparkline column', () => {
  render(
    <WatchlistTable
      funds={[baseFund]}
      quotesByCode={{ '000001': baseQuote }}
      intradayPointsByCode={{
        '000001': [
          intradayPoint({ estimatedNav: 1 }),
          intradayPoint({ minuteKey: '2026-04-17 10:31', estimatedNav: 1.01 }),
        ],
      }}
      onEditPosition={vi.fn()}
      onRemoveFund={vi.fn()}
    />,
  );

  const row = screen.getByRole('row', { name: /测试基金/ });
  expect(within(row).getByText('上行')).toBeTruthy();
  expect(within(row).getByText('今日 +1.00%')).toBeTruthy();
  expect(within(row).getByTestId('fund-intraday-sparkline')).toBeTruthy();
});
```

- [ ] **Step 2: Run watchlist table tests and confirm failure**

Run:

```bash
npm test -- tests/components/watchlist/watchlist-table.test.tsx
```

Expected: FAIL because `intradayPointsByCode` prop and rendering do not exist.

- [ ] **Step 3: Update `WatchlistTable` props and rendering**

Modify `components/watchlist/watchlist-table.tsx`:

```ts
import { FundIntradaySparkline } from '@/components/watchlist/fund-intraday-sparkline';
import { FundTrendBadge } from '@/components/watchlist/fund-trend-badge';
import { buildIntradaySummary } from '@/lib/funds/estimate-intraday';
import type { EstimateIntradayPoint, FundQuote } from '@/lib/funds/types';
```

Add prop:

```ts
intradayPointsByCode?: Record<string, EstimateIntradayPoint[]>;
```

Default it in function signature:

```ts
intradayPointsByCode = {},
```

Add table header after `涨跌幅` or before `持仓`:

```tsx
<th className="px-4 py-3 font-medium">分钟走势</th>
```

Inside row:

```ts
const intradayPoints = intradayPointsByCode[fund.code] ?? [];
const intradaySummary = buildIntradaySummary(intradayPoints);
```

In fund cell under link:

```tsx
<FundTrendBadge summary={intradaySummary} />
```

Add new cell:

```tsx
<td className="px-4 py-3 text-slate-600">
  <FundIntradaySparkline points={intradayPoints} />
</td>
```

- [ ] **Step 4: Run watchlist table tests and confirm pass**

Run:

```bash
npm test -- tests/components/watchlist/watchlist-table.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Add failing HomePage tests for intraday load and subscription**

In `tests/app/home-page.test.tsx`, mock storage:

```ts
const mockLoadEstimateIntradayPoints = vi.fn();

vi.mock('@/lib/storage/estimate-intraday-storage', () => ({
  ESTIMATE_INTRADAY_STORAGE_KEY: 'super-finance-estimate-intraday',
  ESTIMATE_INTRADAY_UPDATED_EVENT: 'super-finance-estimate-intraday-updated',
  loadEstimateIntradayPoints: () => mockLoadEstimateIntradayPoints(),
}));
```

Add default in `beforeEach`:

```ts
mockLoadEstimateIntradayPoints.mockReturnValue({});
```

Add test:

```ts
it('renders intraday trends from local intraday storage', () => {
  mockUseFundQuotes.mockReturnValue({
    quotes: [
      { code: '000001', name: '测试基金', estimatedNav: 1.05, changeRate: 0.88, updatedAt: '2026-04-17 10:31' },
    ],
    error: null,
    isRefreshing: false,
    lastUpdatedAt: '2026-04-17 10:31',
    refresh: vi.fn(),
  });
  mockLoadEstimateIntradayPoints.mockReturnValue({
    '000001': [
      {
        fundCode: '000001',
        fundName: '测试基金',
        tradingDate: '2026-04-17',
        minuteKey: '2026-04-17 10:30',
        estimatedNav: 1,
        changeRate: 0,
        updatedAt: '2026-04-17 10:30',
        capturedAt: '2026-04-17T02:30:00.000Z',
      },
      {
        fundCode: '000001',
        fundName: '测试基金',
        tradingDate: '2026-04-17',
        minuteKey: '2026-04-17 10:31',
        estimatedNav: 1.01,
        changeRate: 0.8,
        updatedAt: '2026-04-17 10:31',
        capturedAt: '2026-04-17T02:31:00.000Z',
      },
    ],
  });

  render(<HomePage />);

  expect(screen.getByText('上行')).toBeTruthy();
  expect(screen.getByTestId('fund-intraday-sparkline')).toBeTruthy();
});
```

- [ ] **Step 6: Run HomePage tests and confirm failure**

Run:

```bash
npm test -- tests/app/home-page.test.tsx
```

Expected: FAIL because HomePage does not load/pass intraday points.

- [ ] **Step 7: Implement HomePage storage load/subscription**

Modify `app/page.tsx` imports:

```ts
import {
  ESTIMATE_INTRADAY_STORAGE_KEY,
  ESTIMATE_INTRADAY_UPDATED_EVENT,
  loadEstimateIntradayPoints,
  type EstimateIntradayPointMap,
} from '@/lib/storage/estimate-intraday-storage';
```

Add state and refresh callback:

```tsx
const [intradayPointsByCode, setIntradayPointsByCode] = useState<EstimateIntradayPointMap>(() =>
  loadEstimateIntradayPoints(),
);
```

Add effect:

```tsx
React.useEffect(() => {
  const refreshIntradayPoints = () => setIntradayPointsByCode(loadEstimateIntradayPoints());
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== ESTIMATE_INTRADAY_STORAGE_KEY) {
      return;
    }
    refreshIntradayPoints();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, refreshIntradayPoints);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, refreshIntradayPoints);
  };
}, []);
```

Pass prop:

```tsx
<WatchlistTable
  ...
  intradayPointsByCode={intradayPointsByCode}
/>
```

- [ ] **Step 8: Run HomePage tests and confirm pass**

Run:

```bash
npm test -- tests/app/home-page.test.tsx
```

Expected: PASS.

---

## Task 6: Detail Page Intraday Chart

**Files:**
- Create: `components/fund/fund-intraday-chart.tsx`
- Modify: `components/fund/fund-detail-card.tsx`
- Modify: `components/fund/fund-detail-content.tsx`
- Test: `tests/components/fund/fund-intraday-chart.test.tsx`
- Test: `tests/components/fund/fund-detail-content.test.tsx`

- [ ] **Step 1: Write failing chart component tests**

Create `tests/components/fund/fund-intraday-chart.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FundIntradayChart } from '@/components/fund/fund-intraday-chart';
import type { EstimateIntradayPoint } from '@/lib/funds/types';

const point = (overrides: Partial<EstimateIntradayPoint> = {}): EstimateIntradayPoint => ({
  fundCode: '000001',
  fundName: '测试基金',
  tradingDate: '2026-04-17',
  minuteKey: '2026-04-17 10:30',
  estimatedNav: 1,
  changeRate: 0,
  updatedAt: '2026-04-17 10:30',
  capturedAt: '2026-04-17T02:30:00.000Z',
  ...overrides,
});

describe('FundIntradayChart', () => {
  it('renders an empty state without points', () => {
    render(<FundIntradayChart points={[]} />);

    expect(screen.getByText('今日走势')).toBeTruthy();
    expect(screen.getByText(/今日分钟走势尚未积累/)).toBeTruthy();
  });

  it('renders summary metrics and svg for multiple points', () => {
    render(
      <FundIntradayChart
        points={[
          point({ estimatedNav: 1, changeRate: 0 }),
          point({ minuteKey: '2026-04-17 10:31', estimatedNav: 1.02, changeRate: 1.1 }),
          point({ minuteKey: '2026-04-17 10:32', estimatedNav: 1.01, changeRate: 0.8 }),
        ]}
      />,
    );

    expect(screen.getByTestId('fund-intraday-chart')).toBeTruthy();
    expect(screen.getByText('当前估值')).toBeTruthy();
    expect(screen.getByText('1.0100')).toBeTruthy();
    expect(screen.getByText('今日最高')).toBeTruthy();
    expect(screen.getByText('1.0200')).toBeTruthy();
    expect(screen.getByText('今日最低')).toBeTruthy();
    expect(screen.getByText('1.0000')).toBeTruthy();
    expect(screen.getByText('开盘至今')).toBeTruthy();
    expect(screen.getByText('+1.00%')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run chart tests and confirm failure**

Run:

```bash
npm test -- tests/components/fund/fund-intraday-chart.test.tsx
```

Expected: FAIL because chart component does not exist.

- [ ] **Step 3: Implement chart component**

Create `components/fund/fund-intraday-chart.tsx`:

```tsx
import React from 'react';

import {
  buildIntradaySummary,
  buildSvgPath,
  normalizeIntradayChartPoints,
} from '@/lib/funds/estimate-intraday';
import type { EstimateIntradayPoint } from '@/lib/funds/types';

function formatNav(value: number | null): string {
  return typeof value === 'number' ? value.toFixed(4) : '--';
}

function formatPercent(value: number | null): string {
  if (typeof value !== 'number') {
    return '--';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function FundIntradayChart({ points }: { points: EstimateIntradayPoint[] }) {
  const summary = buildIntradaySummary(points);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">今日走势</p>
          <p className="mt-1 text-sm text-slate-500">
            最近更新：{summary.latestUpdatedAt ?? '暂无'}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {summary.pointCount} 个分钟点
        </span>
      </div>

      {summary.pointCount < 2 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          今日分钟走势尚未积累，保持页面打开并等待盘中刷新后会逐步生成。
        </div>
      ) : (
        <svg
          aria-label="今日分钟走势"
          className="mt-4 h-40 w-full overflow-visible"
          data-testid="fund-intraday-chart"
          role="img"
          viewBox="0 0 640 160"
        >
          <path
            d={buildSvgPath(normalizeIntradayChartPoints(points, 640, 160))}
            className="fill-none stroke-emerald-500"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </svg>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="当前估值" value={formatNav(summary.latestEstimatedNav)} />
        <Metric label="今日最高" value={formatNav(summary.highEstimatedNav)} />
        <Metric label="今日最低" value={formatNav(summary.lowEstimatedNav)} />
        <Metric label="开盘至今" value={formatPercent(summary.changeRateFromFirst)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run chart tests and confirm pass**

Run:

```bash
npm test -- tests/components/fund/fund-intraday-chart.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Add failing detail integration tests**

In `tests/components/fund/fund-detail-content.test.tsx`, mock intraday storage similarly:

```ts
const mockLoadEstimateIntradayPoints = vi.fn();

vi.mock('@/lib/storage/estimate-intraday-storage', () => ({
  ESTIMATE_INTRADAY_STORAGE_KEY: 'super-finance-estimate-intraday',
  ESTIMATE_INTRADAY_UPDATED_EVENT: 'super-finance-estimate-intraday-updated',
  loadEstimateIntradayPoints: () => mockLoadEstimateIntradayPoints(),
}));
```

Set default in `beforeEach`:

```ts
mockLoadEstimateIntradayPoints.mockReturnValue({});
```

Add test:

```ts
it('renders the detail intraday chart from local intraday storage', async () => {
  mockLoadEstimateIntradayPoints.mockReturnValue({
    '000001': [
      {
        fundCode: '000001',
        fundName: '测试基金',
        tradingDate: '2026-04-17',
        minuteKey: '2026-04-17 10:30',
        estimatedNav: 1,
        changeRate: 0,
        updatedAt: '2026-04-17 10:30',
        capturedAt: '2026-04-17T02:30:00.000Z',
      },
      {
        fundCode: '000001',
        fundName: '测试基金',
        tradingDate: '2026-04-17',
        minuteKey: '2026-04-17 10:31',
        estimatedNav: 1.01,
        changeRate: 0.8,
        updatedAt: '2026-04-17 10:31',
        capturedAt: '2026-04-17T02:31:00.000Z',
      },
    ],
  });

  render(<FundDetailContent code="000001" />);

  await waitFor(() => {
    expect(screen.getByText('今日走势')).toBeTruthy();
    expect(screen.getByTestId('fund-intraday-chart')).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run detail integration tests and confirm failure**

Run:

```bash
npm test -- tests/components/fund/fund-detail-content.test.tsx
```

Expected: FAIL because detail content/card do not read/render intraday points.

- [ ] **Step 7: Wire intraday points into detail components**

Modify `components/fund/fund-detail-card.tsx`:

```ts
import { FundIntradayChart } from '@/components/fund/fund-intraday-chart';
import type { EstimateIntradayPoint, ... } from '@/lib/funds/types';
```

Add prop:

```ts
intradayPoints?: EstimateIntradayPoint[];
```

Default in function signature:

```ts
intradayPoints = [],
```

Render after the summary group and before accuracy/confidence panels:

```tsx
<FundIntradayChart points={intradayPoints} />
```

Modify `components/fund/fund-detail-content.tsx` imports:

```ts
import {
  ESTIMATE_INTRADAY_STORAGE_KEY,
  ESTIMATE_INTRADAY_UPDATED_EVENT,
  loadEstimateIntradayPoints,
} from '@/lib/storage/estimate-intraday-storage';
import type { EstimateIntradayPoint, ... } from '@/lib/funds/types';
```

Add state:

```tsx
const [intradayPoints, setIntradayPoints] = useState<EstimateIntradayPoint[]>([]);
```

Add refresh callback:

```tsx
const refreshIntradayPoints = useCallback(() => {
  setIntradayPoints(loadEstimateIntradayPoints()[code] ?? []);
}, [code]);
```

Add effect similar to accuracy subscription:

```tsx
useEffect(() => {
  refreshIntradayPoints();

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== ESTIMATE_INTRADAY_STORAGE_KEY) {
      return;
    }
    refreshIntradayPoints();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, refreshIntradayPoints);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(ESTIMATE_INTRADAY_UPDATED_EVENT, refreshIntradayPoints);
  };
}, [refreshIntradayPoints]);
```

Pass prop:

```tsx
<FundDetailCard
  ...
  intradayPoints={intradayPoints}
/>
```

- [ ] **Step 8: Run detail tests and confirm pass**

Run:

```bash
npm test -- tests/components/fund/fund-detail-content.test.tsx tests/components/fund/fund-intraday-chart.test.tsx
```

Expected: PASS.

---

## Task 7: E2E Coverage for Embedded Intraday Dashboard

**Files:**
- Create: `tests/e2e/intraday-watchlist-dashboard.spec.ts`

- [ ] **Step 1: Write failing E2E test**

Create `tests/e2e/intraday-watchlist-dashboard.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const watchlist = [
  {
    code: '000001',
    name: '测试基金',
    position: { cost: 1000, shares: 500 },
    transactions: [],
    sipPlans: [],
    sipExecutionRecords: [],
  },
];

const intraday = {
  '000001': [
    {
      fundCode: '000001',
      fundName: '测试基金',
      tradingDate: '2026-04-17',
      minuteKey: '2026-04-17 10:30',
      estimatedNav: 1,
      changeRate: 0,
      updatedAt: '2026-04-17 10:30',
      capturedAt: '2026-04-17T02:30:00.000Z',
    },
    {
      fundCode: '000001',
      fundName: '测试基金',
      tradingDate: '2026-04-17',
      minuteKey: '2026-04-17 10:31',
      estimatedNav: 1.01,
      changeRate: 0.8,
      updatedAt: '2026-04-17 10:31',
      capturedAt: '2026-04-17T02:31:00.000Z',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ watchlistValue, intradayValue }) => {
    window.localStorage.setItem('super-finance-watchlist', JSON.stringify(watchlistValue));
    window.localStorage.setItem('super-finance-estimate-intraday', JSON.stringify(intradayValue));
  }, { watchlistValue: watchlist, intradayValue: intraday });
});

test('renders embedded intraday trend in watchlist and expanded chart on detail page', async ({ page }) => {
  await page.route('**/js/000001.js*', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'jsonpgz({"fundcode":"000001","name":"测试基金","gsz":"1.0100","gszzl":"0.80","gztime":"2026-04-17 10:31"});',
    });
  });

  await page.goto('/');

  const row = page.getByRole('row').filter({ hasText: '测试基金' });
  await expect(row).toContainText('上行');
  await expect(row.getByTestId('fund-intraday-sparkline')).toBeVisible();

  await row.getByRole('link', { name: '测试基金' }).click();

  await expect(page.getByText('今日走势')).toBeVisible();
  await expect(page.getByTestId('fund-intraday-chart')).toBeVisible();

  await page.reload();

  await expect(page.getByText('今日走势')).toBeVisible();
  await expect(page.getByTestId('fund-intraday-chart')).toBeVisible();
});
```

- [ ] **Step 2: Run E2E and confirm failure or adjust selectors**

Run:

```bash
npm exec -- playwright test tests/e2e/intraday-watchlist-dashboard.spec.ts
```

Expected initially: may FAIL until all UI wiring and test selectors are correct.

- [ ] **Step 3: Fix E2E friction only**

If E2E fails due selector ambiguity, prefer adding stable test IDs in UI:
- `data-testid="fund-intraday-sparkline"` already planned
- `data-testid="fund-intraday-chart"` already planned

Do not change product behavior just to satisfy the test.

- [ ] **Step 4: Rerun E2E and confirm pass**

Run:

```bash
npm exec -- playwright test tests/e2e/intraday-watchlist-dashboard.spec.ts
```

Expected: PASS.

---

## Task 8: Final Verification and Status Docs

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_STEPS.md`
- Optionally modify: `WORKLOG.md`

- [ ] **Step 1: Run targeted unit tests**

Run:

```bash
npm test -- \
  tests/lib/funds/estimate-intraday.test.ts \
  tests/lib/storage/estimate-intraday-storage.test.ts \
  tests/lib/hooks/use-fund-quotes.test.tsx \
  tests/components/watchlist/fund-trend-badge.test.tsx \
  tests/components/watchlist/fund-intraday-sparkline.test.tsx \
  tests/components/watchlist/watchlist-table.test.tsx \
  tests/components/fund/fund-intraday-chart.test.tsx \
  tests/components/fund/fund-detail-content.test.tsx \
  tests/app/home-page.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full unit suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run focused E2E**

Run:

```bash
npm exec -- playwright test tests/e2e/intraday-watchlist-dashboard.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run existing critical E2E if time allows**

Run:

```bash
npm exec -- playwright test tests/e2e/estimate-accuracy-dashboard.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Update status docs**

Update `PROJECT_STATUS.md`:
- Current mainline should move from accuracy scope switching to original P1 intraday dashboard.
- Add completed items after implementation:
  - intraday quote storage
  - homepage embedded trend badge and sparkline
  - detail page today chart
  - E2E coverage

Update `NEXT_STEPS.md`:
- Add checked items for intraday dashboard work.
- Move future items to P2/backlog:
  - full external minute-history source
  - cloud sync for intraday history
  - multi-day chart
  - assistant integration

Optionally append to `WORKLOG.md`:
- Date: 2026-04-17
- Summary: switched from accuracy subline to original P1 dashboard and implemented embedded minute charts.
- Verification commands and results.

- [ ] **Step 7: Final verification after docs**

Run at least:

```bash
npm test
npm run build
```

Expected: PASS.

Run E2E separately:

```bash
npm exec -- playwright test tests/e2e/intraday-watchlist-dashboard.spec.ts
```

Expected: PASS.

---

## Acceptance Criteria

- Home watchlist rows show a trend badge near each fund name.
- Home watchlist rows include a dedicated “分钟走势” sparkline column.
- Detail page shows a “今日走势” card with expanded chart and metrics.
- Intraday points persist in `localStorage` under `super-finance-estimate-intraday`.
- Same fund + same minute refresh overwrites the latest minute point rather than duplicating rows.
- Refresh failures keep existing intraday chart data.
- Unit tests, focused E2E, and build pass from fresh standalone commands.
