export const ITEM_POINT_STATUSES = ['active', 'orphaned'] as const;
export type ItemPointStatus = (typeof ITEM_POINT_STATUSES)[number];

/**
 * How a local (item-creating) Configuration Workflow recognizes "the same" discovered entry across
 * runs — one row per south item it created/updated. A remote (push-to-OIAnalytics) workflow never
 * writes here at all: it has no local item to track, and forwards each run's raw eligible records
 * without diffing against anything.
 *
 * `(workflowId, discoveredEntryKey)` is unique and is the one lookup every run's diff uses.
 */
export interface ItemPointMetadataEntity {
  id: string;
  workflowId: string;
  southItemId: string;

  /** Canonical string built from the workflow's `identityKeyFields`, in stable order. */
  discoveredEntryKey: string;

  /**
   * A snapshot of the discovered record this item came from, as of the last run — compared against
   * the new retrieval to classify this entry new/changed/unchanged/missing.
   */
  discoveredMetadata: Record<string, unknown>;

  /**
   * `orphaned` when the most recent run no longer found this entry — never deleted, so an item's
   * history stays reviewable. The item itself is disabled once this happens (see the design's orphan
   * rule).
   */
  status: ItemPointStatus;
  orphanedAt: string | null;
}

/**
 * What a run writes when it discovers/re-discovers a record — everything except lifecycle state
 * (`status`/`orphanedAt`), which is managed independently through the repository's dedicated
 * `markOrphaned`/`markActive` methods.
 */
export interface ItemPointMetadataWrite {
  workflowId: string;
  southItemId: string;
  discoveredEntryKey: string;
  discoveredMetadata: Record<string, unknown>;
}
