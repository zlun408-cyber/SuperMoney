import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFundQuotes } from '@/lib/hooks/use-fund-quotes';
import type { FundQuote } from '@/lib/funds/types';

const sampleQuotes: FundQuote[] = [
  {
    code: '161725',
    name: '招商中证白酒指数',
    estimatedNav: 1.05,
    changeRate: 0.52,
    updatedAt: '2026-03-25T15:30:00.000Z',
  },
];

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useFundQuotes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads quotes on first render', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue(sampleQuotes);

    const { result } = renderHook(() => useFundQuotes(['161725'], fetchQuotes, 60_000));

    await flushAsyncWork();

    expect(fetchQuotes).toHaveBeenCalledWith(['161725']);
    expect(result.current.quotes).toEqual(sampleQuotes);
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdatedAt).toBe('2026-03-25T15:30:00.000Z');
  });

  it('polls quotes on the refresh interval', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue(sampleQuotes);

    renderHook(() => useFundQuotes(['161725'], fetchQuotes, 60_000));

    await flushAsyncWork();
    expect(fetchQuotes).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(fetchQuotes).toHaveBeenCalledTimes(2);
  });

  it('keeps the previous quotes when a refresh fails', async () => {
    const fetchQuotes = vi
      .fn()
      .mockResolvedValueOnce(sampleQuotes)
      .mockRejectedValueOnce(new Error('network failed'));

    const { result } = renderHook(() => useFundQuotes(['161725'], fetchQuotes, 60_000));

    await flushAsyncWork();
    expect(result.current.quotes).toEqual(sampleQuotes);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(result.current.error).toBe('network failed');
    expect(result.current.quotes).toEqual(sampleQuotes);
    expect(result.current.lastUpdatedAt).toBe('2026-03-25T15:30:00.000Z');
  });

  it('supports manual refresh', async () => {
    const fetchQuotes = vi.fn().mockResolvedValue(sampleQuotes);

    const { result } = renderHook(() => useFundQuotes(['161725'], fetchQuotes, 60_000));

    await flushAsyncWork();
    expect(fetchQuotes).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchQuotes).toHaveBeenCalledTimes(2);
  });
});
