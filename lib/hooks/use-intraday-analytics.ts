import { useRef } from 'react';

import {
  createIntradayAnalyticsEvent,
  type CreateIntradayAnalyticsEventInput,
} from '@/lib/analytics/intraday-analytics';
import { appendIntradayAnalyticsEvent } from '@/lib/storage/intraday-analytics-storage';

export function useIntradayAnalytics() {
  const seenKeysRef = useRef(new Set<string>());

  const track = (input: CreateIntradayAnalyticsEventInput) => {
    appendIntradayAnalyticsEvent(createIntradayAnalyticsEvent(input));
  };

  const trackOnce = (dedupeKey: string, input: CreateIntradayAnalyticsEventInput) => {
    if (seenKeysRef.current.has(dedupeKey)) {
      return;
    }

    seenKeysRef.current.add(dedupeKey);
    track(input);
  };

  return {
    track,
    trackOnce,
  };
}
