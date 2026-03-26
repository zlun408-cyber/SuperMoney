import { describe, expect, it } from 'vitest';

import { calculatePositionSummary } from '@/lib/calculations/profit-loss';

describe('calculatePositionSummary', () => {
  it('calculates current value and profit from average cost input', () => {
    const result = calculatePositionSummary({
      amount: 1000,
      cost: 900,
      estimatedNav: 1.05,
      shares: 1000,
    });

    expect(result.currentValue).toBe(1050);
    expect(result.profit).toBe(150);
    expect(result.isComputable).toBe(true);
  });

  it('returns a not computable result when required fields are missing', () => {
    const result = calculatePositionSummary({
      amount: 1000,
      estimatedNav: 1.05,
    });

    expect(result.isComputable).toBe(false);
    expect(result.currentValue).toBeNull();
    expect(result.profit).toBeNull();
  });
});
