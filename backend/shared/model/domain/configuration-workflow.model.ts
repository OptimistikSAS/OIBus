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

export const WORKFLOW_PREVIEW_ENTRY_STATUSES = ['new', 'changed', 'unchanged', 'reactivated', 'missing'] as const;
/**
 * How a preview classifies one discovered/tracked entry against the workflow's previous run - the same
 * classification a real run's Decide step uses, before Act would touch anything.
 * @example "new"
 */
export type WorkflowPreviewEntryStatus = (typeof WORKFLOW_PREVIEW_ENTRY_STATUSES)[number];
