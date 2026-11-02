import { DateTimeType, Timezone } from '../common/types';

export const FIELD_OPERATION_TYPES = [
  'uppercase',
  'lowercase',
  'trim',
  'substring',
  'add-to-string',
  'replace',
  'number-operation',
  'round',
  'datetime',
  'expression'
] as const;
/**
 * What one operation of a field process does to the value of a discovered record's field.
 * @example "uppercase"
 */
export type FieldOperationType = (typeof FIELD_OPERATION_TYPES)[number];

export const FIELD_NUMBER_OPERATORS = ['add', 'subtract', 'multiply', 'divide'] as const;
/**
 * The arithmetic a `number-operation` applies to a numeric value, with its operand.
 * @example "multiply"
 */
export type FieldNumberOperator = (typeof FIELD_NUMBER_OPERATORS)[number];

/** The date time types a `datetime` operation reads and writes - the ones a field of a record can hold. */
export const FIELD_DATETIME_TYPES = ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'] as const satisfies ReadonlyArray<DateTimeType>;
/**
 * @example "iso-string"
 */
export type FieldDatetimeType = (typeof FIELD_DATETIME_TYPES)[number];

/** Changes the case of the value, or removes its leading and trailing spaces. */
export interface FieldCaseOperation {
  type: 'uppercase' | 'lowercase' | 'trim';
}

/** Keeps the characters of the value from `start` to `end` (excluded) - a negative index counts from the end. */
export interface FieldSubstringOperation {
  type: 'substring';
  /** @example 0 */
  start: number;
  /** Null keeps the characters up to the end of the value. */
  end: number | null;
}

/** Adds text before and after the value. */
export interface FieldAddToStringOperation {
  type: 'add-to-string';
  /** @example "plant1." */
  prefix: string;
  /** @example "" */
  suffix: string;
}

/** Replaces every occurrence of a text of the value. */
export interface FieldReplaceOperation {
  type: 'replace';
  /** @example "/" */
  search: string;
  /** @example "." */
  replacement: string;
}

/** Applies an arithmetic operation to a numeric value. */
export interface FieldNumberOperation {
  type: 'number-operation';
  operator: FieldNumberOperator;
  /** @example 1000 */
  operand: number;
}

/** Rounds a numeric value to a number of decimals. */
export interface FieldRoundOperation {
  type: 'round';
  /** @example 2 */
  decimals: number;
}

/** Converts a date time from a type to another - the timezone and format only apply to the `string` type. */
export interface FieldDatetimeOperation {
  type: 'datetime';
  inputType: FieldDatetimeType;
  inputTimezone?: Timezone;
  inputFormat?: string;
  inputLocale?: string;
  outputType: FieldDatetimeType;
  outputTimezone?: Timezone;
  outputFormat?: string;
  outputLocale?: string;
}

/** Any other processing, as a JavaScript expression on `value`. */
export interface FieldExpressionOperation {
  type: 'expression';
  /** @example "value.split('.').pop()" */
  expression: string;
}

export type FieldOperation =
  | FieldCaseOperation
  | FieldSubstringOperation
  | FieldAddToStringOperation
  | FieldReplaceOperation
  | FieldNumberOperation
  | FieldRoundOperation
  | FieldDatetimeOperation
  | FieldExpressionOperation;

/** The value of a field of a record (a discovered record, a row of a transformed content...). */
export type RecordFieldValue = string | number | boolean | null;
