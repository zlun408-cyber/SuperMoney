import { describe, expect, it, vi } from 'vitest';

import type { EstimateAccuracySnapshot, EstimateAdjustmentDecisionItem } from '@/lib/funds/types';
import {
  createSupabaseCloudAccuracyClient,
  loadCloudAccuracy,
  saveCloudAccuracy,
  type CloudAccuracyClient,
} from '@/lib/sync/cloud-accuracy';

describe('cloud-accuracy helpers', () => {
  it('saves snapshots and decisions using normalized cloud fields', async () => {
    const upsertSnapshots = vi.fn().mockResolvedValue(undefined);
    const upsertAdjustmentDecisions = vi.fn().mockResolvedValue(undefined);
    const client: CloudAccuracyClient = {
      listSnapshots: vi.fn(),
      upsertSnapshots,
      listAdjustmentDecisions: vi.fn(),
      upsertAdjustmentDecisions,
    };

    const snapshots: EstimateAccuracySnapshot[] = [
      {
        id: '000001::2026-04-13 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-13 14:30',
        tradingDate: '2026-04-13',
        estimatedNav: 1.23,
        finalNav: 1.2,
        absoluteErrorRate: 0.025,
        resolvedAt: '2026-04-13T15:30:00.000Z',
        createdAt: '2026-04-13 14:30',
        updatedAt: '2026-04-13T15:30:00.000Z',
      },
    ];
    const decisions: Record<string, EstimateAdjustmentDecisionItem> = {
      '000001': {
        status: 'validated',
        updatedAt: '2026-04-14T09:00:00.000Z',
        history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
      },
    };

    await saveCloudAccuracy(client, 'user-1', { snapshots, decisions, fundNamesByCode: { '000001': '基金A' } });

    expect(upsertSnapshots).toHaveBeenCalledWith('user-1', [
      {
        snapshotKey: '000001::2026-04-13 14:30',
        fundCode: '000001',
        fundName: '基金A',
        quoteUpdatedAt: '2026-04-13T06:30:00.000Z',
        quoteUpdatedAtRaw: '2026-04-13 14:30',
        quoteTimeSemantics: 'china_local',
        tradingDate: '2026-04-13',
        estimatedNav: 1.23,
        finalNav: 1.2,
        absoluteErrorRate: 0.025,
        resolvedAt: '2026-04-13T15:30:00.000Z',
        clientCreatedAt: '2026-04-13T06:30:00.000Z',
        clientUpdatedAt: '2026-04-13T15:30:00.000Z',
      },
    ]);
    expect(upsertAdjustmentDecisions).toHaveBeenCalledWith('user-1', [
      {
        fundCode: '000001',
        fundName: '基金A',
        status: 'validated',
        decisionUpdatedAt: '2026-04-14T09:00:00.000Z',
        history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
      },
    ]);
  });

  it('loads cloud snapshots and decisions back into app shape', async () => {
    const client: CloudAccuracyClient = {
      listSnapshots: vi.fn().mockResolvedValue([
        {
          id: 'row-1',
          userId: 'user-1',
          snapshotKey: '000001::2026-04-13 14:30',
          fundCode: '000001',
          fundName: '基金A',
          quoteUpdatedAt: '2026-04-13T06:30:00.000Z',
          quoteUpdatedAtRaw: '2026-04-13 14:30',
          quoteTimeSemantics: 'china_local',
          tradingDate: '2026-04-13',
          estimatedNav: 1.23,
          finalNav: 1.2,
          absoluteErrorRate: 0.025,
          resolvedAt: '2026-04-13T15:30:00.000Z',
          clientCreatedAt: '2026-04-13T06:30:00.000Z',
          clientUpdatedAt: '2026-04-13T15:30:00.000Z',
          createdAt: '2026-04-13T06:31:00.000Z',
          updatedAt: '2026-04-13T15:31:00.000Z',
        },
      ]),
      upsertSnapshots: vi.fn(),
      listAdjustmentDecisions: vi.fn().mockResolvedValue([
        {
          id: 'decision-1',
          userId: 'user-1',
          fundCode: '000001',
          fundName: '基金A',
          status: 'validated',
          decisionUpdatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
          createdAt: '2026-04-14T09:00:00.000Z',
          updatedAt: '2026-04-14T09:00:00.000Z',
        },
      ]),
      upsertAdjustmentDecisions: vi.fn(),
    };

    await expect(loadCloudAccuracy(client, 'user-1')).resolves.toEqual({
      snapshots: [
        {
          id: '000001::2026-04-13 14:30',
          fundCode: '000001',
          fundName: '基金A',
          quoteUpdatedAt: '2026-04-13 14:30',
          tradingDate: '2026-04-13',
          estimatedNav: 1.23,
          finalNav: 1.2,
          absoluteErrorRate: 0.025,
          resolvedAt: '2026-04-13T15:30:00.000Z',
          createdAt: '2026-04-13T06:30:00.000Z',
          updatedAt: '2026-04-13T15:30:00.000Z',
        },
      ],
      decisions: {
        '000001': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      },
    });
  });
});

describe('createSupabaseCloudAccuracyClient', () => {
  it('returns an empty snapshot list when the accuracy snapshot table is missing', async () => {
    const client = createSupabaseCloudAccuracyClient({
      from(table: string) {
        expect(table).toBe('fund_estimate_accuracy_snapshots');
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return Promise.resolve({
                      data: null,
                      error: {
                        code: 'PGRST205',
                        message: 'Could not find the table public.fund_estimate_accuracy_snapshots',
                      },
                    });
                  },
                };
              },
            };
          },
        };
      },
    } as never);

    await expect(client.listSnapshots('user-1')).resolves.toEqual([]);
  });

  it('upserts adjustment decisions using snake_case Supabase payloads', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const client = createSupabaseCloudAccuracyClient({
      from(table: string) {
        expect(table).toBe('fund_estimate_adjustment_decisions');
        return {
          upsert: upsertSpy,
        };
      },
    } as never);

    await client.upsertAdjustmentDecisions('user-1', [
      {
        fundCode: '000001',
        fundName: '基金A',
        status: 'validated',
        decisionUpdatedAt: '2026-04-14T09:00:00.000Z',
        history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
      },
    ]);

    expect(upsertSpy).toHaveBeenCalledWith(
      [
        {
          user_id: 'user-1',
          fund_code: '000001',
          fund_name: '基金A',
          status: 'validated',
          decision_updated_at: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      ],
      {
        onConflict: 'user_id,fund_code',
      },
    );
  });

  it('returns an empty decision list when the adjustment decisions table is missing', async () => {
    const client = createSupabaseCloudAccuracyClient({
      from(table: string) {
        expect(table).toBe('fund_estimate_adjustment_decisions');
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return Promise.resolve({
                      data: null,
                      error: {
                        code: 'PGRST205',
                        message: 'Could not find the table public.fund_estimate_adjustment_decisions',
                      },
                    });
                  },
                };
              },
            };
          },
        };
      },
    } as never);

    await expect(client.listAdjustmentDecisions('user-1')).resolves.toEqual([]);
  });

  it('treats missing cloud tables as no-op during snapshot and decision upserts', async () => {
    const client = createSupabaseCloudAccuracyClient({
      from(table: string) {
        return {
          upsert: vi.fn().mockResolvedValue({
            error: {
              code: 'PGRST205',
              message: `Could not find the table public.${table}`,
            },
          }),
        };
      },
    } as never);

    await expect(
      client.upsertSnapshots('user-1', [
        {
          snapshotKey: '000001::2026-04-13 14:30',
          fundCode: '000001',
          fundName: '基金A',
          quoteUpdatedAt: '2026-04-13T06:30:00.000Z',
          quoteUpdatedAtRaw: '2026-04-13 14:30',
          quoteTimeSemantics: 'china_local',
          tradingDate: '2026-04-13',
          estimatedNav: 1.23,
          clientCreatedAt: '2026-04-13T06:30:00.000Z',
          clientUpdatedAt: '2026-04-13T06:30:00.000Z',
        },
      ]),
    ).resolves.toBeUndefined();

    await expect(
      client.upsertAdjustmentDecisions('user-1', [
        {
          fundCode: '000001',
          fundName: '基金A',
          status: 'validated',
          decisionUpdatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      ]),
    ).resolves.toBeUndefined();
  });

});
