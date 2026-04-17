import type {
  EstimateAdjustmentDecisionItem,
  EstimateAdjustmentDecisionStatus,
} from '@/lib/funds/types';

export const ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY =
  'super-finance-adjustment-fund-decisions';
export const ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT =
  'super-finance-adjustment-fund-decisions-updated';

const ABSOLUTE_TIME_FORMAT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const VALID_DECISION_STATUSES: EstimateAdjustmentDecisionStatus[] = [
  'verification',
  'watch',
  'dismissed',
  'validated',
  'failed',
];

const isDecisionStatus = (value: unknown): value is EstimateAdjustmentDecisionStatus =>
  typeof value === 'string' && VALID_DECISION_STATUSES.includes(value as EstimateAdjustmentDecisionStatus);

const isAbsoluteTime = (value: unknown): value is string =>
  typeof value === 'string' && ABSOLUTE_TIME_FORMAT.test(value) && !Number.isNaN(Date.parse(value));

export const normalizeEstimateAdjustmentDecisionItem = (
  value: unknown,
): EstimateAdjustmentDecisionItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;
  if (!isDecisionStatus(item.status) || !isAbsoluteTime(item.updatedAt)) {
    return null;
  }

  const history = Array.isArray(item.history)
    ? item.history
        .map((historyItem) => {
          if (!historyItem || typeof historyItem !== 'object') {
            return null;
          }

          const normalizedHistoryItem = historyItem as Record<string, unknown>;
          if (
            !isDecisionStatus(normalizedHistoryItem.status) ||
            !isAbsoluteTime(normalizedHistoryItem.updatedAt)
          ) {
            return null;
          }

          return {
            status: normalizedHistoryItem.status,
            updatedAt: normalizedHistoryItem.updatedAt,
          };
        })
        .filter(
          (
            historyItem,
          ): historyItem is EstimateAdjustmentDecisionItem['history'][number] => historyItem !== null,
        )
    : [];

  return {
    status: item.status,
    updatedAt: item.updatedAt,
    history:
      history.length > 0
        ? history
        : [
            {
              status: item.status,
              updatedAt: item.updatedAt,
            },
          ],
  };
};

export const loadEstimateAdjustmentDecisions = (): Record<string, EstimateAdjustmentDecisionItem> => {
  if (typeof window === 'undefined') {
    return {};
  }

  let rawValue: string | null = null;
  try {
    rawValue = window.localStorage.getItem(ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY);
  } catch {
    return {};
  }

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed as Record<string, unknown>).reduce<
      Record<string, EstimateAdjustmentDecisionItem>
    >((accumulator, [fundCode, item]) => {
      const normalized = normalizeEstimateAdjustmentDecisionItem(item);
      if (normalized) {
        accumulator[fundCode] = normalized;
      }
      return accumulator;
    }, {});
  } catch {
    return {};
  }
};

export function saveEstimateAdjustmentDecisions(
  decisions: Record<string, EstimateAdjustmentDecisionItem>,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
      JSON.stringify(decisions),
    );
    window.dispatchEvent(new CustomEvent(ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT));
  } catch {
    // Ignore localStorage write failures (quota/privacy modes)
  }
}
