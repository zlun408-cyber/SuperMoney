import React from 'react';

import type { EstimateIntradaySignalTone } from '@/lib/funds/types';

const toneClasses: Record<EstimateIntradaySignalTone, string> = {
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  muted: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export function IntradayStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: EstimateIntradaySignalTone;
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}
