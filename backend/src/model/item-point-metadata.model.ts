export const ITEM_POINT_STATUSES = ['active', 'orphaned'] as const;
export type ItemPointStatus = (typeof ITEM_POINT_STATUSES)[number];

/**
 * One schema covering all three cardinalities a Configuration Workflow's Act step can produce,
 * distinguished only by how `southItemId` repeats across rows for one `workflowId`:
 *
 *  - 1:1 (a single OPC-UA/Folder item) — one row, unique `southItemId`.
 *  - N:1 (a SQL item's dedicated metadata query fanning out into several points) — several rows
 *    sharing the same `southItemId`, one per result column.
 *  - 1:N (a self-scoping workflow's multi-item discovery) — several rows, each with its own
 *    `southItemId`, all sharing the same `workflowId`.
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
   * A snapshot of the discovered record this point came from, as of the last run — compared against
   * the new retrieval to classify this entry new/changed/unchanged/missing. Populated regardless of
   * whether the workflow pushes remote metadata at all, since it's also how a purely item-creating
   * workflow recognizes "the same" entry across runs.
   */
  discoveredMetadata: Record<string, unknown>;

  /** Mirrors OIAnalytics's own `Data`/`StoredContinuousData` shape. */
  description: string | null;
  unit: string | null;
  minAcceptableValue: number | null;
  maxAcceptableValue: number | null;
  resolution: number | null;
  resamplingMethod: string | null;

  /** Escape hatch for remote point metadata not yet modeled as its own column. */
  remoteMetadataExtra: Record<string, unknown> | null;

  /**
   * `orphaned` when the most recent run no longer found this entry — never deleted, so an item's
   * point history stays reviewable. See the design's orphan rule: an item only auto-disables once
   * *all* of its non-orphaned points have orphaned (immediate for the 1:1/1:N cases; for N:1, losing
   * one SQL column orphans just that point while the item — and its other columns — stay active).
   */
  status: ItemPointStatus;
  orphanedAt: string | null;

  /** Last time this point's metadata was successfully pushed to OIAnalytics; null if never pushed. */
  lastPushedAt: string | null;
}

/**
 * What a run writes when it discovers/re-discovers a record — everything except lifecycle state
 * (`status`/`orphanedAt`/`lastPushedAt`), which is managed independently through the repository's
 * dedicated `markOrphaned`/`markActive`/`markPushed` methods.
 */
export interface ItemPointMetadataWrite {
  workflowId: string;
  southItemId: string;
  discoveredEntryKey: string;
  discoveredMetadata: Record<string, unknown>;
  description: string | null;
  unit: string | null;
  minAcceptableValue: number | null;
  maxAcceptableValue: number | null;
  resolution: number | null;
  resamplingMethod: string | null;
  remoteMetadataExtra: Record<string, unknown> | null;
}
