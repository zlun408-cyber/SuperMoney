'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AccuracyStore } from '@/lib/accuracy/accuracy-store';
import { fetchFundQuotes, type FetchFundQuotes } from '@/lib/funds/data-source';
import { buildEstimateIntradayPoint } from '@/lib/funds/estimate-intraday';
import {
  applyEstimateAdjustmentPolicyToQuotes,
} from '@/lib/funds/estimate-adjustment-policy';
import { buildEstimateAdjustmentValidationSummary } from '@/lib/funds/estimate-adjustment-validation';
import {
  buildEstimateSnapshot,
  deriveTradingDateFromQuoteUpdatedAt,
  getCurrentChinaMarketTradingDate,
  isSupportedQuoteUpdatedAt,
  isTradingDateBefore,
  reconcileEstimateSnapshot,
} from '@/lib/funds/estimate-accuracy';
import { getNavWithCache } from '@/lib/funds/nav-cache';
import type {
  EstimateAccuracySnapshot,
  EstimateAdjustmentDecisionItem,
  FundCode,
  FundQuote,
} from '@/lib/funds/types';
import {
  loadEstimateAccuracySnapshots,
  saveEstimateAccuracySnapshots,
  upsertEstimateAccuracySnapshots,
} from '@/lib/storage/estimate-accuracy-storage';
import {
  ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
  ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT,
  loadEstimateAdjustmentDecisions,
} from '@/lib/storage/estimate-adjustment-storage';
import { saveEstimateIntradayQuotePoints } from '@/lib/storage/estimate-intraday-storage';

interface UseFundQuotesAccuracyOptions {
  accuracyStore?: Pick<
    AccuracyStore,
    'loadSnapshots' | 'saveSnapshots' | 'loadAdjustmentDecisions'
  >;
  loadSnapshots?: () => EstimateAccuracySnapshot[];
  saveSnapshots?: (snapshots: EstimateAccuracySnapshot[]) => void;
  resolveFinalNav?: (fundCode: string, tradingDate: string) => Promise<number | null>;
  loadAdjustmentDecisions?: () => Record<string, EstimateAdjustmentDecisionItem>;
}

const defaultResolveFinalNav = async (
  fundCode: string,
  tradingDate: string,
): Promise<number | null> => {
  const nav = await getNavWithCache(fundCode, tradingDate);
  return nav?.nav ?? null;
};

const pickCurrentTradingDate = (quotes: FundQuote[], now: number): string => {
  const fallback = getCurrentChinaMarketTradingDate(now);

  return quotes.reduce((latest, quote) => {
    const tradingDate = deriveTradingDateFromQuoteUpdatedAt(quote.updatedAt);
    return isTradingDateBefore(latest, tradingDate) ? tradingDate : latest;
  }, fallback);
};

const isUnresolvedSnapshot = (snapshot: EstimateAccuracySnapshot): boolean =>
  snapshot.finalNav === null && snapshot.resolvedAt === null;

const reconcileOlderUnresolvedSnapshots = async (
  snapshots: EstimateAccuracySnapshot[],
  currentTradingDate: string,
  resolveFinalNav: (fundCode: string, tradingDate: string) => Promise<number | null>,
  now: string,
): Promise<{ snapshots: EstimateAccuracySnapshot[]; changed: boolean }> => {
  const nextSnapshots = [...snapshots];
  let changed = false;

  for (let index = 0; index < nextSnapshots.length; index += 1) {
    const snapshot = nextSnapshots[index];
    if (!isUnresolvedSnapshot(snapshot)) {
      continue;
    }

    if (!isTradingDateBefore(snapshot.tradingDate, currentTradingDate)) {
      continue;
    }

    const finalNav = await resolveFinalNav(snapshot.fundCode, snapshot.tradingDate);
    if (finalNav === null) {
      continue;
    }

    nextSnapshots[index] = reconcileEstimateSnapshot(snapshot, finalNav, now);
    changed = true;
  }

  return { snapshots: nextSnapshots, changed };
};

export function useFundQuotes(
  codes: FundCode[],
  fetcher: FetchFundQuotes = fetchFundQuotes,
  refreshInterval = 60_000,
  accuracyOptions?: UseFundQuotesAccuracyOptions,
) {
  const [quotes, setQuotes] = useState<FundQuote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const previousQuotesRef = useRef<FundQuote[]>([]);
  const codesRef = useRef(codes);
  const fetcherRef = useRef(fetcher);
  const loadSnapshotsRef = useRef(
    accuracyOptions?.accuracyStore?.loadSnapshots ??
      accuracyOptions?.loadSnapshots ??
      loadEstimateAccuracySnapshots,
  );
  const saveSnapshotsRef = useRef(
    accuracyOptions?.accuracyStore?.saveSnapshots ??
      accuracyOptions?.saveSnapshots ??
      saveEstimateAccuracySnapshots,
  );
  const resolveFinalNavRef = useRef(accuracyOptions?.resolveFinalNav ?? defaultResolveFinalNav);
  const loadAdjustmentDecisionsRef = useRef(
    accuracyOptions?.accuracyStore?.loadAdjustmentDecisions ??
      accuracyOptions?.loadAdjustmentDecisions ??
      loadEstimateAdjustmentDecisions,
  );
  const requestSeqRef = useRef(0);
  const inFlightLoadRef = useRef<Promise<void> | null>(null);
  const reloadAfterFlightRef = useRef(false);
  const codesKey = codes.join(',');

  codesRef.current = codes;
  fetcherRef.current = fetcher;
  loadSnapshotsRef.current =
    accuracyOptions?.accuracyStore?.loadSnapshots ??
    accuracyOptions?.loadSnapshots ??
    loadEstimateAccuracySnapshots;
  saveSnapshotsRef.current =
    accuracyOptions?.accuracyStore?.saveSnapshots ??
    accuracyOptions?.saveSnapshots ??
    saveEstimateAccuracySnapshots;
  resolveFinalNavRef.current = accuracyOptions?.resolveFinalNav ?? defaultResolveFinalNav;
  loadAdjustmentDecisionsRef.current =
    accuracyOptions?.accuracyStore?.loadAdjustmentDecisions ??
    accuracyOptions?.loadAdjustmentDecisions ??
    loadEstimateAdjustmentDecisions;

  const loadQuotes = useCallback(async () => {
    if (inFlightLoadRef.current) {
      reloadAfterFlightRef.current = true;
      return inFlightLoadRef.current;
    }

    let currentLoad: Promise<void>;
    currentLoad = (async () => {
    requestSeqRef.current += 1;
    const requestId = requestSeqRef.current;
    const isLatestRequest = () => isMountedRef.current && requestId === requestSeqRef.current;

    const runAccuracySideEffects = async (nextQuotes: FundQuote[]) => {
      if (!isLatestRequest()) {
        return;
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const currentTradingDate = pickCurrentTradingDate(nextQuotes, now);
      const existingSnapshots = loadSnapshotsRef.current();
      const trackableQuotes = nextQuotes.filter((quote) =>
        isSupportedQuoteUpdatedAt(quote.updatedAt),
      );
      const nextSnapshots = upsertEstimateAccuracySnapshots(
        existingSnapshots,
        trackableQuotes.map((quote) =>
          buildEstimateSnapshot(
            {
              code: quote.code,
              name: quote.name,
              estimatedNav: quote.estimatedNav,
              quoteUpdatedAt: quote.updatedAt,
            },
            nowIso,
          ),
        ),
      );
      const { snapshots: reconciledSnapshots, changed: reconciledChanged } =
        await reconcileOlderUnresolvedSnapshots(
          nextSnapshots,
          currentTradingDate,
          async (fundCode, tradingDate) => {
            if (!isLatestRequest()) {
              return null;
            }

            return resolveFinalNavRef.current(fundCode, tradingDate);
          },
          nowIso,
        );

      if (!isLatestRequest()) {
        return;
      }

      if (trackableQuotes.length > 0 || reconciledChanged) {
        const latestSnapshots = loadSnapshotsRef.current();
        const mergedSnapshots = upsertEstimateAccuracySnapshots(
          latestSnapshots,
          reconciledSnapshots,
        );
        saveSnapshotsRef.current(mergedSnapshots);
      }
    };
    const runAccuracySideEffectsSafely = async (nextQuotes: FundQuote[]) => {
      try {
        await runAccuracySideEffects(nextQuotes);
      } catch {
        // Accuracy tracking must never alter quote loading behavior.
      }
    };
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
    const attachValidationFeedbackSafely = (
      nextQuotes: FundQuote[],
      decisions: Record<string, EstimateAdjustmentDecisionItem>,
    ): FundQuote[] => {
      try {
        if (nextQuotes.length === 0 || Object.keys(decisions).length === 0) {
          return nextQuotes;
        }

        const validationSummary = buildEstimateAdjustmentValidationSummary(
          loadSnapshotsRef.current(),
          decisions,
        );
        if (validationSummary.funds.length === 0) {
          return nextQuotes;
        }

        const validationByFundCode = new Map(
          validationSummary.funds.map((item) => [item.fundCode, item] as const),
        );

        return nextQuotes.map((quote) => {
          const validationFeedback = validationByFundCode.get(quote.code);
          if (!quote.adjustmentPolicy || !validationFeedback) {
            return quote;
          }

          return {
            ...quote,
            adjustmentPolicy: {
              ...quote.adjustmentPolicy,
              validationRecommendationStatus: validationFeedback.recommendationStatus,
              validationRecommendationLabel: validationFeedback.recommendationLabel,
              validationRecommendationReason: validationFeedback.recommendationReason,
            },
          };
        });
      } catch {
        return nextQuotes;
      }
    };
    const applyPoliciesSafely = (nextQuotes: FundQuote[]): FundQuote[] => {
      try {
        const decisions = loadAdjustmentDecisionsRef.current();
        if (Object.keys(decisions).length === 0) {
          return nextQuotes;
        }

        const quotesWithPolicy = applyEstimateAdjustmentPolicyToQuotes(
          nextQuotes,
          loadSnapshotsRef.current(),
          decisions,
        );
        return attachValidationFeedbackSafely(quotesWithPolicy, decisions);
      } catch {
        return nextQuotes;
      }
    };

    if (codesRef.current.length === 0) {
      if (!isLatestRequest()) {
        return;
      }

      setQuotes((currentQuotes) => (currentQuotes.length === 0 ? currentQuotes : []));
      setError((currentError) => (currentError === null ? currentError : null));
      setIsRefreshing(false);
      setLastUpdatedAt(null);
      previousQuotesRef.current = [];
      await runAccuracySideEffectsSafely([]);
      return;
    }

    setIsRefreshing(true);
    let quotesForAccuracy: FundQuote[] = [];

    try {
      const nextQuotes = applyPoliciesSafely(await fetcherRef.current(codesRef.current));
      if (!isLatestRequest()) {
        return;
      }

      quotesForAccuracy = nextQuotes;
      previousQuotesRef.current = nextQuotes;
      setQuotes(nextQuotes);
      setError(null);
      setLastUpdatedAt(nextQuotes[0]?.updatedAt ?? null);
    } catch (caughtError) {
      if (!isLatestRequest()) {
        return;
      }

      const previousQuotes = Array.isArray(previousQuotesRef.current) ? previousQuotesRef.current : [];
      setQuotes(previousQuotes);
      setError(caughtError instanceof Error ? caughtError.message : 'unknown error');
      setLastUpdatedAt(previousQuotes[0]?.updatedAt ?? null);
    } finally {
      if (!isLatestRequest()) {
        return;
      }

      setIsRefreshing(false);
      runIntradaySideEffectsSafely(quotesForAccuracy);
      await runAccuracySideEffectsSafely(quotesForAccuracy);
    }
    })().finally(async () => {
      if (inFlightLoadRef.current === currentLoad) {
        inFlightLoadRef.current = null;
      }

      if (reloadAfterFlightRef.current && isMountedRef.current) {
        reloadAfterFlightRef.current = false;
        await loadQuotes();
      }
    });

    inFlightLoadRef.current = currentLoad;
    return currentLoad;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      reloadAfterFlightRef.current = false;
      inFlightLoadRef.current = null;
      requestSeqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const handleDecisionStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY
      ) {
        return;
      }

      void loadQuotes();
    };
    const handleDecisionUpdated = () => {
      void loadQuotes();
    };

    window.addEventListener('storage', handleDecisionStorage);
    window.addEventListener(
      ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT,
      handleDecisionUpdated,
    );

    return () => {
      window.removeEventListener('storage', handleDecisionStorage);
      window.removeEventListener(
        ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT,
        handleDecisionUpdated,
      );
    };
  }, [loadQuotes]);

  useEffect(() => {
    void loadQuotes();

    if (codes.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadQuotes();
    }, refreshInterval);

    return () => {
      window.clearInterval(timer);
    };
  }, [codesKey, loadQuotes, refreshInterval, codes.length]);

  return {
    quotes,
    error,
    isRefreshing,
    lastUpdatedAt,
    refresh: loadQuotes,
  };
}
