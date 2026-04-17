import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstimateAdjustmentDecisionItem } from '@/lib/funds/types';
import {
  ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
  ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT,
  loadEstimateAdjustmentDecisions,
  saveEstimateAdjustmentDecisions,
} from '@/lib/storage/estimate-adjustment-storage';

describe('estimate adjustment storage', () => {
  const validDecisions: Record<string, EstimateAdjustmentDecisionItem> = {
    '000001': {
      status: 'validated',
      updatedAt: '2026-04-14T09:00:00.000Z',
      history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
    },
  };

  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns an empty object for missing or malformed payloads', () => {
    localStorage.removeItem(ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY);
    expect(loadEstimateAdjustmentDecisions()).toEqual({});

    localStorage.setItem(ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY, '{bad json');
    expect(loadEstimateAdjustmentDecisions()).toEqual({});

    localStorage.setItem(ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY, JSON.stringify([]));
    expect(loadEstimateAdjustmentDecisions()).toEqual({});
  });

  it('normalizes legacy items that only contain status and updatedAt', () => {
    localStorage.setItem(
      ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
      JSON.stringify({
        '000001': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
        },
      }),
    );

    expect(loadEstimateAdjustmentDecisions()).toEqual(validDecisions);
  });

  it('filters malformed decision items and malformed history rows', () => {
    localStorage.setItem(
      ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
      JSON.stringify({
        ...validDecisions,
        '000002': {
          status: 'not-a-status',
          updatedAt: '2026-04-14T09:00:00.000Z',
        },
        '000003': {
          status: 'watch',
          updatedAt: 'not-an-iso',
        },
        '000004': {
          status: 'watch',
          updatedAt: '2026-04-14T10:00:00.000Z',
          history: [
            { status: 'watch', updatedAt: '2026-04-14T10:00:00.000Z' },
            { status: 'bad', updatedAt: '2026-04-14T10:10:00.000Z' },
            { status: 'failed', updatedAt: 'bad-time' },
          ],
        },
      }),
    );

    expect(loadEstimateAdjustmentDecisions()).toEqual({
      ...validDecisions,
      '000004': {
        status: 'watch',
        updatedAt: '2026-04-14T10:00:00.000Z',
        history: [{ status: 'watch', updatedAt: '2026-04-14T10:00:00.000Z' }],
      },
    });
  });

  it('persists decisions and dispatches an update event', () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    saveEstimateAdjustmentDecisions(validDecisions);

    expect(JSON.parse(localStorage.getItem(ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY) ?? '{}')).toEqual(
      validDecisions,
    );
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
    expect(dispatchEventSpy.mock.calls.at(-1)?.[0].type).toBe(ESTIMATE_ADJUSTMENT_DECISIONS_UPDATED_EVENT);
  });

  it('returns an empty object when localStorage.getItem throws', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(loadEstimateAdjustmentDecisions()).toEqual({});
    getItemSpy.mockRestore();
  });

  it('does not throw when localStorage.setItem throws', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => saveEstimateAdjustmentDecisions(validDecisions)).not.toThrow();
    setItemSpy.mockRestore();
  });
});
