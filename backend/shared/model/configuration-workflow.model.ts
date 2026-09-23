import { BaseEntity } from './types';
import { ScanModeDTO } from './scan-mode.model';
import { OIBusRecord } from './engine.model';

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
 * warrants a configuration change, and either creates/updates south items from it or forwards the raw
 * eligible records to OIAnalytics — run once by hand or recurringly on a scan mode.
 *
 * Exactly one of `itemFieldMapping`/`pushToOIAnalytics` applies — a workflow is either local
 * (`itemFieldMapping` set, `pushToOIAnalytics` false) or remote (`itemFieldMapping` null,
 * `pushToOIAnalytics` true), enforced at the service layer. Remote additionally requires OIBus to be
 * registered with OIAnalytics.
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
   * What to (re-)discover — connector-specific (e.g. `{ rootNodeId: "ns=1;s=Root" }` for OPC-UA,
   * `{ query: "SELECT ..." }` for SQL).
   */
  discoveryScope: Record<string, unknown>;

  /**
   * Local mode only: discovered-record field(s) — possibly composite — that uniquely identify a record
   * across re-runs. Always empty for a remote workflow (`pushToOIAnalytics` true), which never diffs
   * against a previous run.
   * @example ["nodeId"]
   */
  identityKeyFields: Array<string>;

  /** Conditions a discovered record must all satisfy to be eligible for action — empty means every record is eligible. */
  eligibilityFilter: Array<RecordFilterCondition>;

  /**
   * Local mode: discovered record → item name/settings, as a key → expression bag. Null when this
   * workflow is remote (`pushToOIAnalytics` true) instead.
   * @example { "name": "{{name}}", "settings.nodeId": "{{nodeId}}" }
   */
  itemFieldMapping: Record<string, string> | null;

  /**
   * Remote mode: forward every run's raw eligible records to OIAnalytics as-is (no mapping, no local
   * item, no per-record diffing) instead of creating/updating items locally. Requires OIBus to be
   * registered with OIAnalytics.
   */
  pushToOIAnalytics: boolean;

  /** Null means manual-only — the workflow only ever runs when explicitly triggered. */
  scanMode: ScanModeDTO | null;

  enabled: boolean;
}

export interface ConfigurationWorkflowCommandDTO {
  name: string;
  discoveryScope: Record<string, unknown>;

  /**
   * Local mode: at least one field is required. Remote mode (`pushToOIAnalytics` true): ignored, and
   * stored empty — send `[]`.
   * @example ["nodeId"]
   */
  identityKeyFields: Array<string>;
  eligibilityFilter: Array<RecordFilterCondition>;
  itemFieldMapping: Record<string, string> | null;
  pushToOIAnalytics: boolean;

  /**
   * The ID of the scan mode to use for this workflow, or null for manual-only.
   * @example null
   */
  scanModeId: string | null;

  enabled: boolean;
}

export const WORKFLOW_PREVIEW_ENTRY_STATUSES = ['new', 'changed', 'unchanged', 'reactivated', 'missing'] as const;
/**
 * How a preview classifies one discovered/tracked entry against the workflow's previous run - the same
 * classification a real run's Decide step uses, before Act would touch anything.
 * @example "new"
 */
export type WorkflowPreviewEntryStatus = (typeof WORKFLOW_PREVIEW_ENTRY_STATUSES)[number];

/**
 * One entry of a workflow preview - a discovered record classified against what the previous run last
 * saw for the same identity key, without writing anything.
 */
export interface WorkflowPreviewEntryDTO {
  /** The identity key computed from the workflow's `identityKeyFields`. */
  key: string;
  status: WorkflowPreviewEntryStatus;
  /** The freshly discovered record - null for `missing` entries, which weren't found this time. */
  record: OIBusRecord | null;
  /** The previous run's snapshot for this key - null for a brand new (`new`) entry. */
  previousMetadata: Record<string, unknown> | null;
}

/**
 * A dry run of a Configuration Workflow: identical discovery as a real run, but nothing is written - no
 * items, no point metadata, no `workflow_runs` record, no OIAnalytics push. Discovery itself is a real
 * round-trip to the data source, so a preview costs what a run costs minus the writes.
 */
export interface WorkflowPreviewResultDTO {
  discoveredCount: number;
  eligibleCount: number;
  /** Local (item-creating) workflow only - the per-entry new/changed/unchanged/missing classification
   *  against the previous run. Empty for a remote workflow. */
  entries: Array<WorkflowPreviewEntryDTO>;
  /** Remote (push-to-OIAnalytics) workflow only - the raw eligible records that would be sent, exactly
   *  as discovered, with no mapping or diffing applied. Empty for a local workflow. */
  records: Array<OIBusRecord>;
}
