import { describe, it, expect } from 'vitest';
import { resolveEffectiveDate } from '@/lib/hooks/use-auto-nav';

describe('resolveEffectiveDate', () => {
  it('should return same date for before_1500 period', () => {
    const result = resolveEffectiveDate('2026-04-08', 'before_1500');
    expect(result).toBe('2026-04-08');
  });

  it('should return next day for after_1500 period', () => {
    const result = resolveEffectiveDate('2026-04-08', 'after_1500');
    expect(result).toBe('2026-04-09');
  });

  it('should handle month boundary correctly', () => {
    const result = resolveEffectiveDate('2026-04-30', 'after_1500');
    expect(result).toBe('2026-05-01');
  });

  it('should handle year boundary correctly', () => {
    const result = resolveEffectiveDate('2026-12-31', 'after_1500');
    expect(result).toBe('2027-01-01');
  });

  it('should handle leap year February correctly', () => {
    const result = resolveEffectiveDate('2024-02-28', 'after_1500');
    expect(result).toBe('2024-02-29');
  });

  it('should handle non-leap year February correctly', () => {
    const result = resolveEffectiveDate('2023-02-28', 'after_1500');
    expect(result).toBe('2023-03-01');
  });
});