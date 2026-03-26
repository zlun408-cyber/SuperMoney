import type { PositionInput, PositionSummary } from '@/lib/funds/types';

function hasNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function calculatePositionSummary(input: PositionInput): PositionSummary {
  if (!hasNumber(input.cost) || !hasNumber(input.estimatedNav) || !hasNumber(input.shares)) {
    return {
      isComputable: false,
      currentValue: null,
      profit: null,
    };
  }

  const currentValue = Number((input.estimatedNav * input.shares).toFixed(2));
  const profit = Number((currentValue - input.cost).toFixed(2));

  return {
    isComputable: true,
    currentValue,
    profit,
  };
}
