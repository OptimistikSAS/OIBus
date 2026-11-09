import { DateTimeType, Timezone } from '../common/types';

export const FIELD_OPERATION_TYPES = [
  'convert',
  'uppercase',
  'lowercase',
  'trim',
  'substring',
  'add-to-string',
  'replace',
  'number-operation',
  'round',
  'datetime'
] as const;
/**
 * What one operation of a field process does to the value of a discovered record's field.
 * @example "uppercase"
 */
export type FieldOperationType = (typeof FIELD_OPERATION_TYPES)[number];

export const FIELD_CONVERT_TYPES = ['string', 'number', 'boolean', 'json'] as const;
/**
 * What a `convert` operation converts a value to: a text, a number, a boolean, or the object or array a JSON text holds.
 * @example "number"
 */
export type FieldConvertType = (typeof FIELD_CONVERT_TYPES)[number];

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

/** Converts the value to another type - e.g. the text of a CSV file to a number. */
export interface FieldConvertOperation {
  type: 'convert';
  to: FieldConvertType;
}

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

export const FIELD_DATETIME_PRECISIONS = ['s', 'min', 'hr', 'day'] as const;
/**
 * The unit a `datetime` operation rounds a date time down to: the smaller units are set to 0. Left out, the date time is
 * unchanged.
 * @example "min"
 */
export type FieldDatetimePrecision = (typeof FIELD_DATETIME_PRECISIONS)[number];

/**
 * Converts a date time from a type to another - the timezone and format only apply to the `string` type - possibly
 * rounded down to a precision (in UTC, or in the output timezone for a `string`).
 */
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
  precision?: FieldDatetimePrecision;
}

export type FieldOperation =
  | FieldConvertOperation
  | FieldCaseOperation
  | FieldSubstringOperation
  | FieldAddToStringOperation
  | FieldReplaceOperation
  | FieldNumberOperation
  | FieldRoundOperation
  | FieldDatetimeOperation;

/** The value of a field of a record (a discovered record, a row of a transformed content...). */
export type RecordFieldValue = string | number | boolean | null;
