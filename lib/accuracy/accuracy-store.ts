import type {
  EstimateAccuracySnapshot,
  EstimateAdjustmentDecisionItem,
} from '@/lib/funds/types';
import {
  applyAccuracyImport,
  dryRunAccuracyImport,
  mergeEstimateAdjustmentDecisions,
  type AccuracyImportApplyResult,
  type AccuracyImportDryRunResult,
} from '@/lib/accuracy/import';
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
  dryRunImport(payload: unknown): AccuracyImportDryRunResult;
  applyImport(payload: unknown): AccuracyImportApplyResult;
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
    dryRunImport(payload) {
      return dryRunAccuracyImport({
        payload,
        currentSnapshots: loadSnapshotsImpl(),
        currentDecisions: loadDecisionsImpl(),
      });
    },
    applyImport(payload) {
      const result = applyAccuracyImport({
        payload,
        currentSnapshots: loadSnapshotsImpl(),
        currentDecisions: loadDecisionsImpl(),
      });
      saveSnapshotsImpl(result.nextSnapshots);
      saveDecisionsImpl(result.nextDecisions);
      return result;
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
    }).catch(() => {
      // Preserve local state when cloud retention is temporarily unavailable.
    });
  };

  return {
    async initialize() {
      const localSnapshots = localStore.loadSnapshots();
      const localDecisions = localStore.loadAdjustmentDecisions();

      try {
        const cloudData = await loadCloudAccuracyImpl(options.cloudClient, options.userId);
        const mergedSnapshots = upsertEstimateAccuracySnapshots(localSnapshots, cloudData.snapshots);
        const mergedDecisions = mergeEstimateAdjustmentDecisions(localDecisions, cloudData.decisions);

        localStore.saveSnapshots(mergedSnapshots);
        localStore.saveAdjustmentDecisions(mergedDecisions);

        try {
          await saveCloudAccuracyImpl(options.cloudClient, options.userId, {
            snapshots: mergedSnapshots,
            decisions: mergedDecisions,
          });
        } catch {
          // Keep merged local state even if cloud persistence fails.
        }
      } catch {
        localStore.saveSnapshots(localSnapshots);
        localStore.saveAdjustmentDecisions(localDecisions);
      }
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
    dryRunImport(payload) {
      return localStore.dryRunImport(payload);
    },
    applyImport(payload) {
      const result = localStore.applyImport(payload);
      mirrorToCloud();
      return result;
    },
  };
}
