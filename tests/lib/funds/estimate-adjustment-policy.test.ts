import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstimateAccuracySnapshot, FundQuote } from '@/lib/funds/types';
import {
  ESTIMATE_ADJUSTMENT_FAILED_COOLDOWN_DAYS,
  ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
  applyEstimateAdjustmentPolicyToQuote,
  loadEstimateAdjustmentDecisions,
} from '@/lib/funds/estimate-adjustment-policy';

const snapshots: EstimateAccuracySnapshot[] = [
  {
    id: 'a-1',
    fundCode: '000001',
    fundName: '偏高基金',
    quoteUpdatedAt: '2026-04-10 14:30',
    tradingDate: '2026-04-10',
    estimatedNav: 1.04,
    finalNav: 1,
    absoluteErrorRate: 0.04,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    createdAt: '2026-04-10T14:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  },
  {
    id: 'a-2',
    fundCode: '000001',
    fundName: '偏高基金',
    quoteUpdatedAt: '2026-04-11 15:10',
    tradingDate: '2026-04-11',
    estimatedNav: 1.02,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-11T16:00:00.000Z',
    createdAt: '2026-04-11T15:10:00.000Z',
    updatedAt: '2026-04-11T16:00:00.000Z',
  },
  {
    id: 'b-1',
    fundCode: '000002',
    fundName: '轻微偏高',
    quoteUpdatedAt: '2026-04-10 10:30',
    tradingDate: '2026-04-10',
    estimatedNav: 1.01,
    finalNav: 1,
    absoluteErrorRate: 0.01,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    createdAt: '2026-04-10T10:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  },
  {
    id: 'c-1',
    fundCode: '000003',
    fundName: '收盘后回落',
    quoteUpdatedAt: '2026-04-10 15:05',
    tradingDate: '2026-04-10',
    estimatedNav: 0.98,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-10T16:00:00.000Z',
    createdAt: '2026-04-10T15:05:00.000Z',
    updatedAt: '2026-04-10T16:00:00.000Z',
  },
];

const liveQuote: FundQuote = {
  code: '000001',
  name: '偏高基金',
  estimatedNav: 1.05,
  changeRate: 0.88,
  updatedAt: '2026-04-14 15:10',
};

describe('estimate adjustment policy', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('applies the validated policy as an adjusted estimated nav for the live quote', () => {
    const adjustedQuote = applyEstimateAdjustmentPolicyToQuote(
      liveQuote,
      snapshots,
      {
        '000001': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      },
    );

    expect(adjustedQuote.adjustmentApplied).toBe(true);
    expect(adjustedQuote.adjustedEstimatedNav).toBeCloseTo(1.0344827586, 6);
    expect(adjustedQuote.adjustmentPolicy).toMatchObject({
      mode: 'active',
      decisionStatus: 'validated',
      scenarioKey: 'diagnosis-aware',
      scenarioLabel: '诊断 + 尾盘联动修正',
      diagnosis: '持续偏高',
      cooldownActive: false,
    });
    expect(adjustedQuote.adjustmentPolicy?.recommendedImprovementRate).toBeGreaterThan(0.8);
  });

  it('keeps watch decisions in observe-only mode without changing the live quote', () => {
    const adjustedQuote = applyEstimateAdjustmentPolicyToQuote(
      liveQuote,
      snapshots,
      {
        '000001': {
          status: 'watch',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'watch', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      },
    );

    expect(adjustedQuote.adjustmentApplied).toBe(false);
    expect(adjustedQuote.adjustedEstimatedNav).toBeNull();
    expect(adjustedQuote.adjustmentPolicy).toMatchObject({
      mode: 'observe',
      decisionStatus: 'watch',
      scenarioKey: 'diagnosis-aware',
      cooldownActive: false,
    });
  });

  it('blocks failed decisions and marks them as cooldown instead of applying a correction', () => {
    const adjustedQuote = applyEstimateAdjustmentPolicyToQuote(
      liveQuote,
      snapshots,
      {
        '000001': {
          status: 'failed',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'failed', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      },
      Date.parse('2026-04-16T09:00:00.000Z'),
    );

    expect(adjustedQuote.adjustmentApplied).toBe(false);
    expect(adjustedQuote.adjustedEstimatedNav).toBeNull();
    expect(adjustedQuote.adjustmentPolicy).toMatchObject({
      mode: 'blocked',
      decisionStatus: 'failed',
      cooldownActive: true,
      scenarioKey: 'diagnosis-aware',
    });
    expect(adjustedQuote.adjustmentPolicy?.cooldownEndsAt).toBe('2026-04-19T09:00:00.000Z');
    expect(ESTIMATE_ADJUSTMENT_FAILED_COOLDOWN_DAYS).toBe(5);
  });

  it('keeps failed decisions inactive after the cooldown window expires', () => {
    const adjustedQuote = applyEstimateAdjustmentPolicyToQuote(
      liveQuote,
      snapshots,
      {
        '000001': {
          status: 'failed',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'failed', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      },
      Date.parse('2026-04-20T09:00:00.000Z'),
    );

    expect(adjustedQuote.adjustmentApplied).toBe(false);
    expect(adjustedQuote.adjustedEstimatedNav).toBeNull();
    expect(adjustedQuote.adjustmentPolicy).toMatchObject({
      mode: 'inactive',
      decisionStatus: 'failed',
      cooldownActive: false,
      scenarioKey: 'diagnosis-aware',
      cooldownEndsAt: '2026-04-19T09:00:00.000Z',
    });
  });

  it('normalizes legacy decision storage items that only contain status and updatedAt', () => {
    window.localStorage.setItem(
      ESTIMATE_ADJUSTMENT_DECISIONS_STORAGE_KEY,
      JSON.stringify({
        '000001': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
        },
      }),
    );

    expect(loadEstimateAdjustmentDecisions()).toEqual({
      '000001': {
        status: 'validated',
        updatedAt: '2026-04-14T09:00:00.000Z',
        history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
      },
    });
  });
});
