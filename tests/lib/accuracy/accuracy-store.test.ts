import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstimateAccuracySnapshot, EstimateAdjustmentDecisionItem } from '@/lib/funds/types';
import type { CloudAccuracyClient } from '@/lib/sync/cloud-accuracy';
import {
  createAuthenticatedAccuracyStore,
  createLocalAccuracyStore,
} from '@/lib/accuracy/accuracy-store';

describe('accuracy store', () => {
  const snapshotA: EstimateAccuracySnapshot = {
    id: '000001::2026-04-10 14:30',
    fundCode: '000001',
    fundName: '基金A',
    quoteUpdatedAt: '2026-04-10 14:30',
    tradingDate: '2026-04-10',
    estimatedNav: 1.02,
    finalNav: null,
    absoluteErrorRate: null,
    resolvedAt: null,
    createdAt: '2026-04-10 14:30',
    updatedAt: '2026-04-10 14:30',
  };
  const snapshotAResolved: EstimateAccuracySnapshot = {
    ...snapshotA,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  };
  const localDecisions: Record<string, EstimateAdjustmentDecisionItem> = {
    '000001': {
      status: 'watch',
      updatedAt: '2026-04-14T08:00:00.000Z',
      history: [{ status: 'watch', updatedAt: '2026-04-14T08:00:00.000Z' }],
    },
  };
  const cloudDecisions: Record<string, EstimateAdjustmentDecisionItem> = {
    '000001': {
      status: 'validated',
      updatedAt: '2026-04-14T09:00:00.000Z',
      history: [
        { status: 'watch', updatedAt: '2026-04-14T08:00:00.000Z' },
        { status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' },
      ],
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses local storage functions directly in local mode', () => {
    const loadSnapshots = vi.fn(() => [snapshotA]);
    const saveSnapshots = vi.fn();
    const loadDecisions = vi.fn(() => localDecisions);
    const saveDecisions = vi.fn();

    const store = createLocalAccuracyStore({
      loadSnapshots,
      saveSnapshots,
      loadAdjustmentDecisions: loadDecisions,
      saveAdjustmentDecisions: saveDecisions,
    });

    expect(store.loadSnapshots()).toEqual([snapshotA]);
    expect(store.loadAdjustmentDecisions()).toEqual(localDecisions);

    store.saveSnapshots([snapshotAResolved]);
    store.saveAdjustmentDecisions(cloudDecisions);

    expect(saveSnapshots).toHaveBeenCalledWith([snapshotAResolved]);
    expect(saveDecisions).toHaveBeenCalledWith(cloudDecisions);
  });

  it('merges local and cloud data during authenticated initialization and persists the merged result to both sides', async () => {
    let localSnapshots = [snapshotA];
    let localDecisionState = localDecisions;
    const saveLocalSnapshots = vi.fn((snapshots: EstimateAccuracySnapshot[]) => {
      localSnapshots = snapshots;
    });
    const saveLocalDecisions = vi.fn((decisions: Record<string, EstimateAdjustmentDecisionItem>) => {
      localDecisionState = decisions;
    });
    const loadCloudAccuracy = vi.fn().mockResolvedValue({
      snapshots: [snapshotAResolved],
      decisions: cloudDecisions,
    });
    const saveCloudAccuracy = vi.fn().mockResolvedValue(undefined);

    const store = createAuthenticatedAccuracyStore({
      userId: 'user-1',
      cloudClient: {} as CloudAccuracyClient,
      loadSnapshots: () => localSnapshots,
      saveSnapshots: saveLocalSnapshots,
      loadAdjustmentDecisions: () => localDecisionState,
      saveAdjustmentDecisions: saveLocalDecisions,
      loadCloudAccuracy,
      saveCloudAccuracy,
    });

    await store.initialize();

    expect(store.loadSnapshots()).toEqual([snapshotAResolved]);
    expect(store.loadAdjustmentDecisions()).toEqual(cloudDecisions);
    expect(saveLocalSnapshots).toHaveBeenCalledWith([snapshotAResolved]);
    expect(saveLocalDecisions).toHaveBeenCalledWith(cloudDecisions);
    expect(saveCloudAccuracy).toHaveBeenCalledWith(
      {} as CloudAccuracyClient,
      'user-1',
      expect.objectContaining({
        snapshots: [snapshotAResolved],
        decisions: cloudDecisions,
      }),
    );
  });

  it('writes locally and mirrors the latest state to cloud in authenticated mode', async () => {
    let localSnapshots = [snapshotA];
    const saveLocalSnapshots = vi.fn((snapshots: EstimateAccuracySnapshot[]) => {
      localSnapshots = snapshots;
    });
    const saveCloudAccuracy = vi.fn().mockResolvedValue(undefined);

    const store = createAuthenticatedAccuracyStore({
      userId: 'user-1',
      cloudClient: {} as CloudAccuracyClient,
      loadSnapshots: () => localSnapshots,
      saveSnapshots: saveLocalSnapshots,
      loadAdjustmentDecisions: () => ({}),
      saveAdjustmentDecisions: vi.fn(),
      loadCloudAccuracy: vi.fn().mockResolvedValue({ snapshots: [], decisions: {} }),
      saveCloudAccuracy,
    });

    store.saveSnapshots([snapshotAResolved]);

    expect(saveLocalSnapshots).toHaveBeenCalledWith([snapshotAResolved]);
    await vi.waitFor(() => {
      expect(saveCloudAccuracy).toHaveBeenCalledWith(
        {} as CloudAccuracyClient,
        'user-1',
        expect.objectContaining({
          snapshots: [snapshotAResolved],
          decisions: {},
        }),
      );
    });
  });
});
