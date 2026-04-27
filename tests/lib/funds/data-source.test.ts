import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractHistoryNavPayload,
  fetchFundEstimateScript,
  fetchFundQuotesFromSource,
} from '@/lib/funds/data-source';

describe('fund data source', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('aborts hung estimate fetches with an explicit timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener(
            'abort',
            () => {
              reject(signal.reason);
            },
            { once: true },
          );
        }),
      ),
    );

    const request = fetchFundEstimateScript('161725', { timeoutMs: 1_000 });
    void request.catch(() => {});

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(request).rejects.toThrow('Fund estimate request timed out: 161725');
  });

  it('maps successful upstream estimate payloads into quotes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: vi
          .fn()
          .mockResolvedValue(
            'jsonpgz({"fundcode":"161725","name":"招商中证白酒指数","jzrq":"2026-04-24","dwjz":"1.0000","gsz":"1.0500","gszzl":"5.00","gztime":"2026-04-24 14:30"});',
          ),
      }),
    );

    await expect(fetchFundQuotesFromSource(['161725'])).resolves.toEqual([
      {
        code: '161725',
        name: '招商中证白酒指数',
        estimatedNav: 1.05,
        changeRate: 5,
        updatedAt: '2026-04-24 14:30',
      },
    ]);
  });

  it('extracts historical nav from Eastmoney table cells with multiple classes', () => {
    const payload = extractHistoryNavPayload(
      `var apidata={ content:"<table><tbody><tr><td>2026-04-24</td><td class='tor bold'>2.5468</td><td class='tor bold'>2.5468</td></tr></tbody></table>",records:1};`,
      '2026-04-24',
    );

    expect(payload).toMatchObject({
      date: '2026-04-24',
      dwjz: '2.5468',
    });
  });
});
