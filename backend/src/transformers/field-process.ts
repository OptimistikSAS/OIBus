import { DateTime, DateTimeUnit } from 'luxon';

import { Instant, Timezone } from '../../shared/model/common/types';
import {
  FieldConvertType,
  FieldDatetimeOperation,
  FieldDatetimePrecision,
  FieldNumberOperation,
  FieldOperation
} from '../../shared/model/connector/field-process.model';

import type { ILogger } from '../model/logger.model';
import { convertDateTimeToInstant, formatInstant, stringToBoolean } from '../service/utils';

/**
 * Applies the operations of a field process to a value, in order, each on the result of the previous one. A missing or
 * empty value has nothing to process and is returned as is. Throws when an
 * operation can't apply to its value (e.g. a text for a number operation): see `createFieldProcess` to skip it instead.
 *
 * @example
 *   applyFieldOperations(' Temp ', [{ type: 'trim' }, { type: 'uppercase' }])           // → 'TEMP'
 *   applyFieldOperations('1500', [{ type: 'number-operation', operator: 'divide', operand: 1000 }]) // → 1.5
 */
export function applyFieldOperations(value: unknown, operations: Array<FieldOperation>): unknown {
  let result = value;
  for (const operation of operations) {
    if (result === null || result === undefined) {
      return result;
    }
    result = applyFieldOperation(result, operation);
  }
  return result;
}

/**
 * A function applying the operations of a field process to the values of a field, for the values of a batch: a value an
 * operation fails on becomes null, with a warning logged once per logger (the same values fail batch after batch).
 * Without operations, the values are returned as is.
 */
export function createFieldProcess(
  operations: Array<FieldOperation> | null | undefined,
  label: string,
  logger?: ILogger
): (value: unknown) => unknown {
  if (!operations?.length) return value => value;
  return value => {
    try {
      return applyFieldOperations(value, operations);
    } catch (error: unknown) {
      warnOnce(logger, `Field process of ${label} skipped a value: ${(error as Error).message}`);
      return null;
    }
  };
}

/**
 * A field process of string values (e.g. point IDs / references) returning a string. The same references repeat many times
 * in a batch of records, so results are memoized per value. A reference the operations fail on (or make empty) is kept as is.
 */
export function createStringFieldProcess(
  operations: Array<FieldOperation> | null | undefined,
  label: string,
  logger?: ILogger
): (value: string) => string {
  if (!operations?.length) return value => value;
  const process = createFieldProcess(operations, label, logger);
  const results = new Map<string, string>();
  return value => {
    let result = results.get(value);
    if (result === undefined) {
      const processed = process(value);
      result = processed === null || processed === undefined ? value : String(processed);
      results.set(value, result);
    }
    return result;
  };
}

function applyFieldOperation(operand: unknown, operation: FieldOperation): unknown {
  // A database driver may return a date column as a Date object: an instant for a date time conversion, whatever its
  // input type, and its ISO string for the other operations
  if (operand instanceof Date && operation.type === 'datetime') {
    return convertFieldDatetime(operand, operation);
  }
  const value = operand instanceof Date ? operand.toISOString() : operand;
  if (operation.type === 'convert') {
    return convert(value, operation.to);
  }
  if (typeof value === 'object') {
    // Objects and arrays (of the JSON files) have no text nor number to process
    throw new Error(`${JSON.stringify(value)} is an object or an array: only a conversion can process it`);
  }
  const scalar = value as string | number | boolean;
  switch (operation.type) {
    case 'uppercase':
      return String(scalar).toUpperCase();
    case 'lowercase':
      return String(scalar).toLowerCase();
    case 'trim':
      return String(scalar).trim();
    case 'substring':
      return String(scalar).slice(operation.start, operation.end ?? undefined);
    case 'add-to-string':
      return `${operation.prefix}${scalar}${operation.suffix}`;
    case 'replace':
      return operation.search ? String(scalar).replaceAll(operation.search, operation.replacement) : String(scalar);
    case 'number-operation':
      return applyNumberOperation(toNumber(scalar), operation);
    case 'round': {
      const factor = 10 ** operation.decimals;
      return Math.round(toNumber(scalar) * factor) / factor;
    }
    case 'datetime':
      return convertFieldDatetime(scalar, operation);
  }
}

function convert(value: unknown, to: FieldConvertType): unknown {
  switch (to) {
    case 'string':
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    case 'number':
      if (typeof value === 'object' || typeof value === 'boolean') {
        throw new Error(`${JSON.stringify(value)} is not a number`);
      }
      return toNumber(value as string | number);
    case 'boolean':
      if (typeof value === 'object') {
        throw new Error(`${JSON.stringify(value)} is not a boolean`);
      }
      return typeof value === 'boolean' ? value : stringToBoolean(String(value));
    case 'json':
      if (typeof value !== 'string') {
        return value;
      }
      try {
        return JSON.parse(value);
      } catch {
        throw new Error(`"${value}" is not a JSON text`);
      }
  }
}

function applyNumberOperation(value: number, operation: FieldNumberOperation): number {
  switch (operation.operator) {
    case 'add':
      return value + operation.operand;
    case 'subtract':
      return value - operation.operand;
    case 'multiply':
      return value * operation.operand;
    case 'divide':
      if (operation.operand === 0) {
        throw new Error('division by zero');
      }
      return value / operation.operand;
  }
}

/** A number, or a text holding one - anything else can't go through a number operation. */
function toNumber(value: string | number | boolean): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (Number.isNaN(number)) {
    throw new Error(`"${value}" is not a number`);
  }
  return number;
}

function convertFieldDatetime(value: string | number | boolean | Date, operation: FieldDatetimeOperation): string | number {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('invalid date');
    }
    return formatOperationInstant(value.toISOString(), operation);
  }
  if (typeof value === 'boolean') {
    throw new Error(`"${value}" is not a date time`);
  }
  if (operation.inputType === 'string' && (!operation.inputFormat || !operation.inputTimezone)) {
    throw new Error('the input format and timezone are required to read a date time string');
  }
  const converted = convertDateTimeToInstant(operation.inputType === 'string' ? String(value) : value, {
    type: operation.inputType,
    timezone: operation.inputTimezone,
    format: operation.inputFormat,
    locale: operation.inputLocale
  });
  // An unparsable ISO string or formatted string converts to no instant at all
  if (!converted) {
    throw new Error(`"${value}" is not a valid date time of type "${operation.inputType}"`);
  }
  return formatOperationInstant(converted, operation);
}

/** An instant written with the output type of a date time conversion, rounded down to its precision */
function formatOperationInstant(converted: Instant, operation: FieldDatetimeOperation): string | number {
  if (operation.outputType === 'string' && (!operation.outputFormat || !operation.outputTimezone)) {
    throw new Error('the output format and timezone are required to write a date time string');
  }
  const instant = operation.precision
    ? roundDownInstant(converted, operation.precision, operation.outputType === 'string' ? operation.outputTimezone : undefined)
    : converted;
  return formatInstant(instant, {
    type: operation.outputType,
    timezone: operation.outputTimezone,
    format: operation.outputFormat,
    locale: operation.outputLocale
  });
}

const PRECISION_UNITS: Record<FieldDatetimePrecision, DateTimeUnit> = { s: 'second', min: 'minute', hr: 'hour', day: 'day' };

/**
 * An instant rounded down to a precision: in UTC, or in the timezone it is written in - hours and days start at different
 * instants in a timezone with a non-whole-hour offset.
 */
function roundDownInstant(instant: Instant, precision: FieldDatetimePrecision, timezone: Timezone | undefined): Instant {
  return DateTime.fromISO(instant, { zone: timezone ?? 'utc' })
    .startOf(PRECISION_UNITS[precision])
    .toUTC()
    .toISO()!;
}

/** The warnings already logged by each logger, a field process being applied to many values of a batch */
const loggedWarnings = new WeakMap<ILogger, Set<string>>();

function warnOnce(logger: ILogger | undefined, message: string): void {
  if (!logger) return;
  let messages = loggedWarnings.get(logger);
  if (!messages) {
    messages = new Set();
    loggedWarnings.set(logger, messages);
  }
  if (!messages.has(message)) {
    messages.add(message);
    logger.warn(message);
  }
}
