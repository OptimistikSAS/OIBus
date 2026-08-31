import { BaseEntity } from './types';
import { ScanModeDTO } from './scan-mode.model';

export const RECORD_FILTER_OPERATORS = ['equals', 'notEquals', 'contains', 'matches', 'exists', 'greaterThan', 'lessThan'] as const;
/**
 * How one condition of a workflow's eligibility filter compares a discovered record's field.
 * @example "equals"
 */
export type RecordFilterOperator = (typeof RECORD_FILTER_OPERATORS)[number];

/**
 * One condition of a Configuration Workflow's eligibility filter, evaluated against a single
 * discovered record. `value` is omitted for the `exists` operator, which only checks presence.
 */
export interface RecordFilterCondition {
  /**
   * A key of the discovered record to test.
   * @example "type"
   */
  field: string;

  operator: RecordFilterOperator;

  /**
   * The value to compare against — not used for `exists`.
   * @example "Variable"
   */
  value?: string;
}

/**
 * A Configuration Workflow: discovers a data source, decides which of what it found actually
 * warrants a configuration change, and maps that into south item settings and/or remote point
 * metadata — run once by hand or recurringly on a scan mode.
 */
export interface ConfigurationWorkflowDTO extends BaseEntity {
  /**
   * Unique per south connector.
   * @example "Reactor OPC-UA discovery"
   */
  name: string;

  /**
   * The south connector this workflow discovers from.
   * @example "b7f8e6d2-1c3a-4b5d-9e0f-2a3b4c5d6e7f"
   */
  southId: string;

  /**
   * Set: the workflow manages exactly one pre-existing item's point metadata (e.g. a SQL query item,
   * or a single node someone already created by hand). Null: the workflow is self-scoping and owns
   * whatever items its own discovery creates.
   * @example null
   */
  targetItemId: string | null;

  /**
   * What to (re-)discover — connector-specific (e.g. `{ rootNodeId: "ns=1;s=Root" }` for OPC-UA,
   * `{ query: "SELECT ..." }` for SQL).
   */
  discoveryScope: Record<string, unknown>;

  /**
   * Discovered-record field(s) — possibly composite — that uniquely identify a record across
   * re-runs.
   * @example ["nodeId"]
   */
  identityKeyFields: Array<string>;

  /** Conditions a discovered record must all satisfy to be eligible for action — empty means every record is eligible. */
  eligibilityFilter: Array<RecordFilterCondition>;

  /**
   * Discovered record → item name/settings, as a key → expression bag. Null: this workflow never
   * creates/updates items.
   * @example { "name": "{{name}}", "settings.nodeId": "{{nodeId}}" }
   */
  itemFieldMapping: Record<string, string> | null;

  /**
   * Discovered record + item fields → remote (OIAnalytics) point metadata, as a key → expression
   * bag. Null: no remote push is configured for this workflow.
   * @example { "unit": "{{unit}}" }
   */
  remoteFieldMapping: Record<string, string> | null;

  /** Null means manual-only — the workflow only ever runs when explicitly triggered. */
  scanMode: ScanModeDTO | null;

  enabled: boolean;
}

export interface ConfigurationWorkflowCommandDTO {
  name: string;
  targetItemId: string | null;
  discoveryScope: Record<string, unknown>;
  identityKeyFields: Array<string>;
  eligibilityFilter: Array<RecordFilterCondition>;
  itemFieldMapping: Record<string, string> | null;
  remoteFieldMapping: Record<string, string> | null;

  /**
   * The ID of the scan mode to use for this workflow, or null for manual-only.
   * @example null
   */
  scanModeId: string | null;

  enabled: boolean;
}
