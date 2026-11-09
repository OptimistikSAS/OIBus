import { FieldOperation, RecordFieldValue } from '../connector/field-process.model';

export const RECORD_FILTER_OPERATORS = [
  'equals',
  'notEquals',
  'contains',
  'startsWith',
  'endsWith',
  'matches',
  'exists',
  'greaterThan',
  'lessThan'
] as const;
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
 * How a Configuration Workflow processes one field of every discovered record, before its eligibility filter: the
 * operations apply in order, each on the result of the previous one.
 */
export interface RecordFieldProcess {
  /**
   * A key of the discovered record to process.
   * @example "path"
   */
  field: string;

  operations: Array<FieldOperation>;
}

/**
 * A field a Configuration Workflow adds to every discovered record, after the processing of the discovered fields: a
 * constant, or a combination of other fields of the record.
 */
export interface RecordAddedField {
  /**
   * The key of the field added to the record - an added field replaces a discovered field of the same key.
   * @example "reference"
   */
  field: string;

  /**
   * A constant, or a template combining fields of the record as `{{field}}`: the discovered fields as processed, and
   * the fields added before. A template that is a single `{{field}}` keeps the type of its value (a number stays a
   * number), and a missing field gives an empty value.
   * @example "{{plant}}.{{name}}"
   */
  value: string;
}

/** Values of a discovered record's field, e.g. the first ones discovered. */
export type RecordFieldValues = Array<RecordFieldValue>;

export const WORKFLOW_PREVIEW_ENTRY_STATUSES = ['new', 'changed', 'unchanged', 'reactivated', 'missing'] as const;
/**
 * How a preview classifies one discovered/tracked entry against the workflow's previous run - the same
 * classification a real run's Decide step uses, before Act would touch anything.
 * @example "new"
 */
export type WorkflowPreviewEntryStatus = (typeof WORKFLOW_PREVIEW_ENTRY_STATUSES)[number];
