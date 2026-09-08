import { BaseEntity } from './types';
import { ScanMode } from './scan-mode.model';
import { RecordFilterCondition } from '../../shared/model/configuration-workflow.model';

// Re-exported so existing backend-internal consumers don't need to know this type actually lives in
// the shared model — it's a plain data shape with no reason to differ between the two layers, unlike
// most entities here (which typically resolve shared DTO ids into full backend objects).
export { RecordFilterCondition, RecordFilterOperator, RECORD_FILTER_OPERATORS } from '../../shared/model/configuration-workflow.model';

/**
 * A Configuration Workflow discovers a data source, decides which of what it found actually warrants
 * a configuration change, and acts on it — run once by hand or recurringly via `scanMode`. Every run
 * follows the same steps:
 *
 *  1. Trigger — manual ("run now") or a `scanMode` tick.
 *  2. Retrieve — connector-specific (`discoveryScope`), but always normalized to a flat
 *     `Array<OIBusRecord>`: for OPC-UA/Folder Scanner, a recursive walk of `explore()` down to the
 *     leaves, one record per leaf; for SQL-like connectors, the rows returned by a dedicated metadata
 *     query — distinct from the item's own operational query, and producing nothing OIBus itself ever
 *     reads, only metadata about points (e.g. `tag_name, unit, min, max, description`).
 *  3. Decide — `eligibilityFilter` narrows the retrieved records to the ones that matter (e.g. "only
 *     Variables", redundant for SQL if the query already selects precisely, essential for tree-shaped
 *     sources that can't). For a local workflow, each surviving record is then classified
 *     new/changed/unchanged/missing by comparing its `identityKeyFields`-derived key against the
 *     previous run's snapshot (`item_point_metadata.discoveredMetadata`) — only new/changed/missing
 *     records proceed to Act. A remote workflow skips this classification entirely: every eligible
 *     record is forwarded every run, with no local tracking to diff against.
 *  4. Act — exactly one of two modes, decided by `itemFieldMapping`/`pushToOIAnalytics` (enforced where
 *     workflows are created/updated, not here): local (`itemFieldMapping` set) creates/updates/orphans
 *     a south item per record; remote (`pushToOIAnalytics` true) forwards the raw eligible records to
 *     OIAnalytics as one message, with no local item involved at all.
 *
 * Deliberately NOT scoped by a south item group — a local workflow is self-scoping, owning whatever
 * items its own discovery creates, tracked via `south_items.created_by_workflow_id`, not group
 * membership.
 */
export interface ConfigurationWorkflowEntity extends BaseEntity {
  /** Unique per south connector — how a person picks this workflow out of a list. */
  name: string;
  southId: string;

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

  /**
   * Local mode: discovered record → item name/settings, as a key → expression bag. Null when this
   * workflow is remote (`pushToOIAnalytics` true) instead.
   */
  itemFieldMapping: Record<string, string> | null;

  /**
   * Remote mode: forward every run's raw eligible records to OIAnalytics as-is instead of
   * creating/updating items locally. Requires OIBus to be registered with OIAnalytics.
   */
  pushToOIAnalytics: boolean;

  /** Null means manual-only — the workflow only ever runs when explicitly triggered. */
  scanMode: ScanMode | null;

  enabled: boolean;
}

export interface ConfigurationWorkflowCommand {
  name: string;
  southId: string;
  discoveryScope: Record<string, unknown>;
  identityKeyFields: Array<string>;
  eligibilityFilter: Array<RecordFilterCondition>;
  itemFieldMapping: Record<string, string> | null;
  pushToOIAnalytics: boolean;
  scanMode: ScanMode | null;
  enabled: boolean;
}
