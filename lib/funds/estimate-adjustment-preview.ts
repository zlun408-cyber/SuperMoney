import type { FundQuote, EstimateAdjustmentPolicy } from '@/lib/funds/types';

export function isEstimateAdjustmentPreviewLocked(
  policy: EstimateAdjustmentPolicy | null | undefined,
): boolean {
  return (
    policy?.validationRecommendationStatus === 'review' ||
    policy?.validationRecommendationStatus === 'downgrade'
  );
}

export function canPreviewAdjustedEstimate(
  quote: Pick<FundQuote, 'adjustedEstimatedNav' | 'adjustmentPolicy'> | null | undefined,
): boolean {
  return (
    quote?.adjustmentPolicy?.mode === 'active' &&
    typeof quote.adjustedEstimatedNav === 'number' &&
    !isEstimateAdjustmentPreviewLocked(quote.adjustmentPolicy)
  );
}
