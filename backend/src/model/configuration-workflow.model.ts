import { BaseEntity } from './types';
import { ScanMode } from './scan-mode.model';
import { RecordFilterCondition } from '../../shared/model/configuration-workflow.model';

// Re-exported so existing backend-internal consumers don't need to know this type actually lives in
// the shared model — it's a plain data shape with no reason to differ between the two layers, unlike
// most entities here (which typically resolve shared DTO ids into full backend objects).
export { RecordFilterCondition, RecordFilterOperator, RECORD_FILTER_OPERATORS } from '../../shared/model/configuration-workflow.model';

/**
 * A Configuration Workflow discovers a data source, decides which of what it found actually warrants
 * a configuration change, and maps that into south item settings and/or remote point metadata — run
 * once by hand or recurringly via `scanMode`. Every run follows the same four steps:
 *
 *  1. Trigger — manual ("run now") or a `scanMode` tick.
 *  2. Retrieve — connector-specific (`discoveryScope`), but always normalized to a flat
 *     `Array<OIBusRecord>`: for OPC-UA/Folder Scanner, a recursive walk of `explore()` down to the
 *     leaves, one record per leaf; for SQL-like connectors, the rows returned by a dedicated metadata
 *     query — distinct from the item's own operational query, and producing nothing OIBus itself ever
 *     reads, only metadata about points (e.g. `tag_name, unit, min, max, description`).
 *  3. Decide — `eligibilityFilter` narrows the retrieved records to the ones that matter (e.g. "only
 *     Variables", redundant for SQL if the query already selects precisely, essential for tree-shaped
 *     sources that can't). Each surviving record is then classified new/changed/unchanged/missing by
 *     comparing its `identityKeyFields`-derived key against the previous run's snapshot
 *     (`item_point_metadata.discoveredMetadata`, added in a later migration) — only new/changed/missing
 *     records proceed to step 4.
 *  4. Act — `itemFieldMapping`, when set, creates/updates/orphans a south item per record. Independently,
 *     `remoteFieldMapping`, when set, produces point metadata for a remote push. At least one of the two
 *     must be set (enforced where workflows are created/updated, not here) — a workflow can be
 *     item-only, remote-metadata-only (e.g. the dedicated-SQL-query case, enriching an already-existing
 *     item without ever touching it), or both, run in that order.
 *
 * Deliberately NOT scoped by a south item group: `targetItemId`, when set, means the workflow manages
 * exactly one pre-existing item's point metadata (e.g. a SQL query item, or a single node someone
 * already created by hand). When null, the workflow is self-scoping — it owns whatever items its own
 * discovery creates, tracked via `south_items.created_by_workflow_id`, not group membership.
 */
export interface ConfigurationWorkflowEntity extends BaseEntity {
  /** Unique per south connector — how a person picks this workflow out of a list. */
  name: string;
  southId: string;
  targetItemId: string | null;

  /**
   * What to (re-)discover — connector-specific and required to be meaningful (e.g. an OPC-UA root node
   * id, a folder subtree, or — for SQL — the dedicated metadata query itself, e.g. `{ query: "..." }`).
   */
  discoveryScope: Record<string, unknown>;

  /**
   * Discovered-record field(s) — possibly composite — that uniquely identify a record across re-runs
   * (e.g. `["nodeId"]`, `["tagName"]`).
   */
  identityKeyFields: Array<string>;

  /**
   * Conditions a discovered record must all satisfy (AND-ed) to be eligible for action at all — empty
   * means every retrieved record is eligible. Evaluated before identity matching, so an ineligible
   * record is treated as though it was never retrieved.
   */
  eligibilityFilter: Array<RecordFilterCondition>;

  /** Discovered record → item name/settings, as a key → expression bag. Null = this workflow never creates/updates items. */
  itemFieldMapping: Record<string, string> | null;

  /**
   * Discovered record + item fields → remote (OIAnalytics) point metadata, as a key → expression bag.
   * Null = no remote push is configured for this workflow.
   */
  remoteFieldMapping: Record<string, string> | null;

  /** Null means manual-only — the workflow only ever runs when explicitly triggered. */
  scanMode: ScanMode | null;

  enabled: boolean;
}

export interface ConfigurationWorkflowCommand {
  name: string;
  southId: string;
  targetItemId: string | null;
  discoveryScope: Record<string, unknown>;
  identityKeyFields: Array<string>;
  eligibilityFilter: Array<RecordFilterCondition>;
  itemFieldMapping: Record<string, string> | null;
  remoteFieldMapping: Record<string, string> | null;
  scanMode: ScanMode | null;
  enabled: boolean;
}
