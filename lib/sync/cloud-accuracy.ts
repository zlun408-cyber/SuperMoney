import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  EstimateAccuracySnapshot,
  EstimateAdjustmentDecisionItem,
} from '@/lib/funds/types';
import { normalizeEstimateAdjustmentDecisionItem } from '@/lib/storage/estimate-adjustment-storage';

export type CloudEstimateAccuracyTimeSemantics = 'china_local' | 'absolute';

export interface CloudEstimateAccuracySnapshotRecord {
  id: string;
  userId: string;
  snapshotKey: string;
  fundCode: string;
  fundName: string;
  quoteUpdatedAt: string;
  quoteUpdatedAtRaw: string;
  quoteTimeSemantics: CloudEstimateAccuracyTimeSemantics;
  tradingDate: string;
  estimatedNav: number;
  finalNav?: number;
  absoluteErrorRate?: number;
  resolvedAt?: string;
  clientCreatedAt: string;
  clientUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudEstimateAccuracySnapshotInput {
  snapshotKey: string;
  fundCode: string;
  fundName: string;
  quoteUpdatedAt: string;
  quoteUpdatedAtRaw: string;
  quoteTimeSemantics: CloudEstimateAccuracyTimeSemantics;
  tradingDate: string;
  estimatedNav: number;
  finalNav?: number;
  absoluteErrorRate?: number;
  resolvedAt?: string;
  clientCreatedAt: string;
  clientUpdatedAt: string;
}

export interface CloudEstimateAdjustmentDecisionRecord {
  id: string;
  userId: string;
  fundCode: string;
  fundName?: string;
  status: EstimateAdjustmentDecisionItem['status'];
  decisionUpdatedAt: string;
  history: EstimateAdjustmentDecisionItem['history'];
  createdAt: string;
  updatedAt: string;
}

export interface CloudEstimateAdjustmentDecisionInput {
  fundCode: string;
  fundName?: string;
  status: EstimateAdjustmentDecisionItem['status'];
  decisionUpdatedAt: string;
  history: EstimateAdjustmentDecisionItem['history'];
}

export interface CloudAccuracyData {
  snapshots: EstimateAccuracySnapshot[];
  decisions: Record<string, EstimateAdjustmentDecisionItem>;
}

export interface SaveCloudAccuracyInput extends CloudAccuracyData {
  fundNamesByCode?: Record<string, string>;
}

export interface CloudAccuracyClient {
  listSnapshots(userId: string): Promise<CloudEstimateAccuracySnapshotRecord[]>;
  upsertSnapshots(userId: string, snapshots: CloudEstimateAccuracySnapshotInput[]): Promise<void>;
  listAdjustmentDecisions(userId: string): Promise<CloudEstimateAdjustmentDecisionRecord[]>;
  upsertAdjustmentDecisions(
    userId: string,
    decisions: CloudEstimateAdjustmentDecisionInput[],
  ): Promise<void>;
}

const LOCAL_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const CHINA_MARKET_TIMEZONE_OFFSET_HOURS = 8;

const parseKnownTimestamp = (value: string): { iso: string; semantics: CloudEstimateAccuracyTimeSemantics } => {
  const localMatch = value.match(LOCAL_TIME_FORMAT);
  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    const timestamp = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - CHINA_MARKET_TIMEZONE_OFFSET_HOURS,
      Number(minute),
      0,
      0,
    );

    return {
      iso: new Date(timestamp).toISOString(),
      semantics: 'china_local',
    };
  }

  return {
    iso: new Date(value).toISOString(),
    semantics: 'absolute',
  };
};

const normalizeOptionalTimestamp = (value: string | null | undefined): string | undefined =>
  value ? new Date(value).toISOString() : undefined;

const mapSnapshotToCloudInput = (
  snapshot: EstimateAccuracySnapshot,
  fundNameOverride?: string,
): CloudEstimateAccuracySnapshotInput => {
  const quoteUpdatedAt = parseKnownTimestamp(snapshot.quoteUpdatedAt);
  const createdAt = parseKnownTimestamp(snapshot.createdAt);
  const updatedAt = parseKnownTimestamp(snapshot.updatedAt);

  return {
    snapshotKey: snapshot.id,
    fundCode: snapshot.fundCode,
    fundName: fundNameOverride ?? snapshot.fundName,
    quoteUpdatedAt: quoteUpdatedAt.iso,
    quoteUpdatedAtRaw: snapshot.quoteUpdatedAt,
    quoteTimeSemantics: quoteUpdatedAt.semantics,
    tradingDate: snapshot.tradingDate,
    estimatedNav: snapshot.estimatedNav,
    finalNav: snapshot.finalNav ?? undefined,
    absoluteErrorRate: snapshot.absoluteErrorRate ?? undefined,
    resolvedAt: normalizeOptionalTimestamp(snapshot.resolvedAt),
    clientCreatedAt: createdAt.iso,
    clientUpdatedAt: updatedAt.iso,
  };
};

const mapCloudRecordToSnapshot = (
  snapshot: CloudEstimateAccuracySnapshotRecord,
): EstimateAccuracySnapshot => ({
  id: snapshot.snapshotKey,
  fundCode: snapshot.fundCode,
  fundName: snapshot.fundName,
  quoteUpdatedAt: snapshot.quoteUpdatedAtRaw,
  tradingDate: snapshot.tradingDate,
  estimatedNav: snapshot.estimatedNav,
  finalNav: snapshot.finalNav ?? null,
  absoluteErrorRate: snapshot.absoluteErrorRate ?? null,
  resolvedAt: snapshot.resolvedAt ?? null,
  createdAt: snapshot.clientCreatedAt,
  updatedAt: snapshot.clientUpdatedAt,
});

const mapDecisionToCloudInput = (
  fundCode: string,
  decision: EstimateAdjustmentDecisionItem,
  fundNameOverride?: string,
): CloudEstimateAdjustmentDecisionInput => ({
  fundCode,
  fundName: fundNameOverride,
  status: decision.status,
  decisionUpdatedAt: decision.updatedAt,
  history: decision.history,
});

function isMissingSnapshotsTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error ? error.message : undefined;

  return code === 'PGRST205' && typeof message === 'string' && message.includes('fund_estimate_accuracy_snapshots');
}

function isMissingDecisionsTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error ? error.message : undefined;

  return code === 'PGRST205' && typeof message === 'string' && message.includes('fund_estimate_adjustment_decisions');
}

export function createSupabaseCloudAccuracyClient(client: SupabaseClient): CloudAccuracyClient {
  return {
    async listSnapshots(userId) {
      const { data, error } = await client
        .from('fund_estimate_accuracy_snapshots')
        .select(
          'id, user_id, snapshot_key, fund_code, fund_name, quote_updated_at, quote_updated_at_raw, quote_time_semantics, trading_date, estimated_nav, final_nav, absolute_error_rate, resolved_at, client_created_at, client_updated_at, created_at, updated_at',
        )
        .eq('user_id', userId)
        .order('quote_updated_at', { ascending: true });

      if (error) {
        if (isMissingSnapshotsTableError(error)) {
          return [];
        }

        throw error;
      }

      return (data ?? []).map((snapshot) => ({
        id: snapshot.id,
        userId: snapshot.user_id,
        snapshotKey: snapshot.snapshot_key,
        fundCode: snapshot.fund_code,
        fundName: snapshot.fund_name,
        quoteUpdatedAt: snapshot.quote_updated_at,
        quoteUpdatedAtRaw: snapshot.quote_updated_at_raw,
        quoteTimeSemantics: snapshot.quote_time_semantics,
        tradingDate: snapshot.trading_date,
        estimatedNav: snapshot.estimated_nav,
        finalNav: snapshot.final_nav ?? undefined,
        absoluteErrorRate: snapshot.absolute_error_rate ?? undefined,
        resolvedAt: snapshot.resolved_at ?? undefined,
        clientCreatedAt: snapshot.client_created_at,
        clientUpdatedAt: snapshot.client_updated_at,
        createdAt: snapshot.created_at,
        updatedAt: snapshot.updated_at,
      }));
    },
    async upsertSnapshots(userId, snapshots) {
      if (snapshots.length === 0) {
        return;
      }

      const { error } = await client.from('fund_estimate_accuracy_snapshots').upsert(
        snapshots.map((snapshot) => ({
          user_id: userId,
          snapshot_key: snapshot.snapshotKey,
          fund_code: snapshot.fundCode,
          fund_name: snapshot.fundName,
          quote_updated_at: snapshot.quoteUpdatedAt,
          quote_updated_at_raw: snapshot.quoteUpdatedAtRaw,
          quote_time_semantics: snapshot.quoteTimeSemantics,
          trading_date: snapshot.tradingDate,
          estimated_nav: snapshot.estimatedNav,
          final_nav: snapshot.finalNav ?? null,
          absolute_error_rate: snapshot.absoluteErrorRate ?? null,
          resolved_at: snapshot.resolvedAt ?? null,
          client_created_at: snapshot.clientCreatedAt,
          client_updated_at: snapshot.clientUpdatedAt,
        })),
        {
          onConflict: 'user_id,snapshot_key',
        },
      );

      if (error) {
        if (isMissingSnapshotsTableError(error)) {
          return;
        }

        throw error;
      }
    },
    async listAdjustmentDecisions(userId) {
      const { data, error } = await client
        .from('fund_estimate_adjustment_decisions')
        .select(
          'id, user_id, fund_code, fund_name, status, decision_updated_at, history, created_at, updated_at',
        )
        .eq('user_id', userId)
        .order('decision_updated_at', { ascending: true });

      if (error) {
        if (isMissingDecisionsTableError(error)) {
          return [];
        }

        throw error;
      }

      return (data ?? []).flatMap((decision) => {
        const normalized = normalizeEstimateAdjustmentDecisionItem({
          status: decision.status,
          updatedAt: decision.decision_updated_at,
          history: decision.history,
        });

        if (!normalized) {
          return [];
        }

        return [
          {
            id: decision.id,
            userId: decision.user_id,
            fundCode: decision.fund_code,
            fundName: decision.fund_name ?? undefined,
            status: normalized.status,
            decisionUpdatedAt: normalized.updatedAt,
            history: normalized.history,
            createdAt: decision.created_at,
            updatedAt: decision.updated_at,
          },
        ];
      });
    },
    async upsertAdjustmentDecisions(userId, decisions) {
      if (decisions.length === 0) {
        return;
      }

      const { error } = await client.from('fund_estimate_adjustment_decisions').upsert(
        decisions.map((decision) => ({
          user_id: userId,
          fund_code: decision.fundCode,
          fund_name: decision.fundName ?? null,
          status: decision.status,
          decision_updated_at: decision.decisionUpdatedAt,
          history: decision.history,
        })),
        {
          onConflict: 'user_id,fund_code',
        },
      );

      if (error) {
        if (isMissingDecisionsTableError(error)) {
          return;
        }

        throw error;
      }
    },
  };
}

export async function loadCloudAccuracy(
  client: CloudAccuracyClient,
  userId: string,
): Promise<CloudAccuracyData> {
  const [snapshots, decisions] = await Promise.all([
    client.listSnapshots(userId),
    client.listAdjustmentDecisions(userId),
  ]);

  return {
    snapshots: snapshots.map(mapCloudRecordToSnapshot),
    decisions: Object.fromEntries(
      decisions.map((decision) => [
        decision.fundCode,
        {
          status: decision.status,
          updatedAt: decision.decisionUpdatedAt,
          history: decision.history,
        } satisfies EstimateAdjustmentDecisionItem,
      ]),
    ),
  };
}

export async function saveCloudAccuracy(
  client: CloudAccuracyClient,
  userId: string,
  input: SaveCloudAccuracyInput,
): Promise<void> {
  await client.upsertSnapshots(
    userId,
    input.snapshots.map((snapshot) =>
      mapSnapshotToCloudInput(snapshot, input.fundNamesByCode?.[snapshot.fundCode]),
    ),
  );

  await client.upsertAdjustmentDecisions(
    userId,
    Object.entries(input.decisions).map(([fundCode, decision]) =>
      mapDecisionToCloudInput(fundCode, decision, input.fundNamesByCode?.[fundCode]),
    ),
  );
}
