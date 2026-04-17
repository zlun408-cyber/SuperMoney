import type {
  EstimateAccuracySnapshot,
  EstimateAdjustmentDecisionItem,
} from '@/lib/funds/types';
import {
  loadEstimateAccuracySnapshots,
  saveEstimateAccuracySnapshots,
  upsertEstimateAccuracySnapshots,
} from '@/lib/storage/estimate-accuracy-storage';
import {
  loadEstimateAdjustmentDecisions,
  saveEstimateAdjustmentDecisions,
} from '@/lib/storage/estimate-adjustment-storage';
import type { CloudAccuracyClient } from '@/lib/sync/cloud-accuracy';
import {
  loadCloudAccuracy as defaultLoadCloudAccuracy,
  saveCloudAccuracy as defaultSaveCloudAccuracy,
} from '@/lib/sync/cloud-accuracy';

export interface AccuracyStore {
  initialize(): Promise<void>;
  loadSnapshots(): EstimateAccuracySnapshot[];
  saveSnapshots(snapshots: EstimateAccuracySnapshot[]): void;
  upsertSnapshots(
    incoming: EstimateAccuracySnapshot | EstimateAccuracySnapshot[],
  ): EstimateAccuracySnapshot[];
  loadAdjustmentDecisions(): Record<string, EstimateAdjustmentDecisionItem>;
  saveAdjustmentDecisions(decisions: Record<string, EstimateAdjustmentDecisionItem>): void;
}

interface LocalAccuracyStoreOptions {
  loadSnapshots?: () => EstimateAccuracySnapshot[];
  saveSnapshots?: (snapshots: EstimateAccuracySnapshot[]) => void;
  loadAdjustmentDecisions?: () => Record<string, EstimateAdjustmentDecisionItem>;
  saveAdjustmentDecisions?: (decisions: Record<string, EstimateAdjustmentDecisionItem>) => void;
}

interface AuthenticatedAccuracyStoreOptions extends LocalAccuracyStoreOptions {
  userId: string;
  cloudClient: CloudAccuracyClient;
  loadCloudAccuracy?: typeof defaultLoadCloudAccuracy;
  saveCloudAccuracy?: typeof defaultSaveCloudAccuracy;
}

const mergeAdjustmentDecisionHistories = (
  left: EstimateAdjustmentDecisionItem['history'],
  right: EstimateAdjustmentDecisionItem['history'],
): EstimateAdjustmentDecisionItem['history'] => {
  const byKey = new Map<string, EstimateAdjustmentDecisionItem['history'][number]>();

  for (const item of [...left, ...right]) {
    byKey.set(`${item.status}::${item.updatedAt}`, item);
  }

  return Array.from(byKey.values()).sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
};

export const mergeEstimateAdjustmentDecisions = (
  local: Record<string, EstimateAdjustmentDecisionItem>,
  cloud: Record<string, EstimateAdjustmentDecisionItem>,
): Record<string, EstimateAdjustmentDecisionItem> => {
  const fundCodes = new Set([...Object.keys(local), ...Object.keys(cloud)]);

  return Array.from(fundCodes).reduce<Record<string, EstimateAdjustmentDecisionItem>>(
    (accumulator, fundCode) => {
      const localDecision = local[fundCode];
      const cloudDecision = cloud[fundCode];

      if (!localDecision) {
        if (cloudDecision) {
          accumulator[fundCode] = cloudDecision;
        }
        return accumulator;
      }

      if (!cloudDecision) {
        accumulator[fundCode] = localDecision;
        return accumulator;
      }

      const mergedHistory = mergeAdjustmentDecisionHistories(
        localDecision.history,
        cloudDecision.history,
      );
      const localUpdatedAt = Date.parse(localDecision.updatedAt);
      const cloudUpdatedAt = Date.parse(cloudDecision.updatedAt);
      const current = cloudUpdatedAt >= localUpdatedAt ? cloudDecision : localDecision;

      accumulator[fundCode] = {
        status: current.status,
        updatedAt: current.updatedAt,
        history: mergedHistory,
      };

      return accumulator;
    },
    {},
  );
};

export function createLocalAccuracyStore(options: LocalAccuracyStoreOptions = {}): AccuracyStore {
  const loadSnapshotsImpl = options.loadSnapshots ?? loadEstimateAccuracySnapshots;
  const saveSnapshotsImpl = options.saveSnapshots ?? saveEstimateAccuracySnapshots;
  const loadDecisionsImpl = options.loadAdjustmentDecisions ?? loadEstimateAdjustmentDecisions;
  const saveDecisionsImpl = options.saveAdjustmentDecisions ?? saveEstimateAdjustmentDecisions;

  return {
    async initialize() {
      // no-op
    },
    loadSnapshots() {
      return loadSnapshotsImpl();
    },
    saveSnapshots(snapshots) {
      saveSnapshotsImpl(snapshots);
    },
    upsertSnapshots(incoming) {
      const nextSnapshots = upsertEstimateAccuracySnapshots(loadSnapshotsImpl(), incoming);
      saveSnapshotsImpl(nextSnapshots);
      return nextSnapshots;
    },
    loadAdjustmentDecisions() {
      return loadDecisionsImpl();
    },
    saveAdjustmentDecisions(decisions) {
      saveDecisionsImpl(decisions);
    },
  };
}

export function createAuthenticatedAccuracyStore(
  options: AuthenticatedAccuracyStoreOptions,
): AccuracyStore {
  const localStore = createLocalAccuracyStore(options);
  const loadCloudAccuracyImpl = options.loadCloudAccuracy ?? defaultLoadCloudAccuracy;
  const saveCloudAccuracyImpl = options.saveCloudAccuracy ?? defaultSaveCloudAccuracy;

  const mirrorToCloud = () => {
    void saveCloudAccuracyImpl(options.cloudClient, options.userId, {
      snapshots: localStore.loadSnapshots(),
      decisions: localStore.loadAdjustmentDecisions(),
    });
  };

  return {
    async initialize() {
      const localSnapshots = localStore.loadSnapshots();
      const localDecisions = localStore.loadAdjustmentDecisions();
      const cloudData = await loadCloudAccuracyImpl(options.cloudClient, options.userId);
      const mergedSnapshots = upsertEstimateAccuracySnapshots(localSnapshots, cloudData.snapshots);
      const mergedDecisions = mergeEstimateAdjustmentDecisions(localDecisions, cloudData.decisions);

      localStore.saveSnapshots(mergedSnapshots);
      localStore.saveAdjustmentDecisions(mergedDecisions);

      await saveCloudAccuracyImpl(options.cloudClient, options.userId, {
        snapshots: mergedSnapshots,
        decisions: mergedDecisions,
      });
    },
    loadSnapshots() {
      return localStore.loadSnapshots();
    },
    saveSnapshots(snapshots) {
      localStore.saveSnapshots(snapshots);
      mirrorToCloud();
    },
    upsertSnapshots(incoming) {
      const nextSnapshots = localStore.upsertSnapshots(incoming);
      mirrorToCloud();
      return nextSnapshots;
    },
    loadAdjustmentDecisions() {
      return localStore.loadAdjustmentDecisions();
    },
    saveAdjustmentDecisions(decisions) {
      localStore.saveAdjustmentDecisions(decisions);
      mirrorToCloud();
    },
  };
}
