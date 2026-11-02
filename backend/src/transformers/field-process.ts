import vm from 'node:vm';

import { FieldDatetimeOperation, FieldNumberOperation, FieldOperation } from '../../shared/model/connector/field-process.model';

import type { ILogger } from '../model/logger.model';
import { convertDateTimeToInstant, formatInstant } from '../service/utils';

/**
 * Whitelisted standard globals accessible inside the expression of an `expression` operation.
 *
 * Node.js-specific APIs (require, process, global, Buffer, __dirname, __filename,
 * setTimeout, setInterval, fetch, …) are intentionally omitted so the expression
 * cannot reach the host environment.
 *
 * `Function` and `eval` are also excluded to prevent dynamic code generation
 * inside an expression.
 */
const SANDBOX_GLOBALS: Record<string, unknown> = Object.freeze({
  // Numeric helpers
  Math,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  Infinity,
  NaN,
  // Type constructors / coercions
  String,
  Number,
  Boolean,
  BigInt,
  Symbol,
  // Collection types
  Array,
  Object,
  Map,
  Set,
  WeakMap,
  WeakSet,
  // Structured data
  JSON,
  // Date / time
  Date,
  // Regular expressions
  RegExp,
  // URI helpers
  encodeURIComponent,
  decodeURIComponent,
  encodeURI,
  decodeURI,
  // Error constructors (useful for instanceof checks in expressions)
  Error,
  TypeError,
  RangeError,
  SyntaxError,
  ReferenceError,
  // Explicit undefined so expressions can test/return it
  undefined: undefined
});

/**
 * Applies the operations of a field process to a value, in order, each on the result of the previous one. A missing or
 * empty value has nothing to process and is returned as is, as is the null an expression may return. Throws when an
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

function applyFieldOperation(value: unknown, operation: FieldOperation): unknown {
  if (operation.type === 'expression') {
    return evaluateExpression(value, operation.expression) ?? null;
  }
  if (typeof value === 'object') {
    // Objects and arrays (of the JSON files) have no text nor number to process
    throw new Error(`${JSON.stringify(value)} is an object or an array: only an expression can process it`);
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

function convertFieldDatetime(value: string | number | boolean, operation: FieldDatetimeOperation): string | number {
  if (typeof value === 'boolean') {
    throw new Error(`"${value}" is not a date time`);
  }
  if (operation.inputType === 'string' && (!operation.inputFormat || !operation.inputTimezone)) {
    throw new Error('the input format and timezone are required to read a date time string');
  }
  if (operation.outputType === 'string' && (!operation.outputFormat || !operation.outputTimezone)) {
    throw new Error('the output format and timezone are required to write a date time string');
  }
  const instant = convertDateTimeToInstant(operation.inputType === 'string' ? String(value) : value, {
    type: operation.inputType,
    timezone: operation.inputTimezone,
    format: operation.inputFormat,
    locale: operation.inputLocale
  });
  // An unparsable ISO string or formatted string converts to no instant at all
  if (!instant) {
    throw new Error(`"${value}" is not a valid date time of type "${operation.inputType}"`);
  }
  return formatInstant(instant, {
    type: operation.outputType,
    timezone: operation.outputTimezone,
    format: operation.outputFormat,
    locale: operation.outputLocale
  });
}

/**
 * Compiled vm.Script cache — avoids re-parsing the same expression for every row
 * when a dataset has many records.
 */
const scriptCache = new Map<string, vm.Script>();

/**
 * Evaluates the expression of an `expression` operation against a value inside a restricted vm.Context that contains
 * only standard JavaScript built-ins.
 *
 * Security properties:
 *  - `require`, `process`, `global`, `Buffer` → ReferenceError (not in context)
 *  - `Function`, `eval` → ReferenceError (not in context)
 *  - Execution is time-bounded (500 ms) to prevent runaway expressions.
 *
 * `value` is bound to the field value inside the expression. Throws when the expression calls a method the value does
 * not have (`value.toFixed(2)` on a text...), or fails.
 *
 * @example
 *   evaluateExpression('hello', 'value.toUpperCase()')           // → 'HELLO'
 *   evaluateExpression(3.14159, 'Math.round(value * 100) / 100') // → 3.14
 */
export function evaluateExpression(value: unknown, expression: string): unknown {
  if (!expression.trim()) return value;
  const incompatibility = findIncompatibleMethod(value, expression);
  if (incompatibility) {
    throw new Error(incompatibility);
  }
  try {
    let script = scriptCache.get(expression);
    if (!script) {
      script = new vm.Script(`(${expression})`);
      scriptCache.set(expression, script);
    }
    const context = vm.createContext({ ...SANDBOX_GLOBALS, value });
    return script.runInContext(context, { timeout: 500 });
  } catch (e) {
    throw new Error(`Expression "${expression}" failed: ${(e as Error).message}`);
  }
}

/**
 * Find a method called on `value` in the expression (`value.toUpperCase()`, `value.toFixed(2)`, …) that does not exist on
 * the type of the value (string, number, …), to tell why the value can't be processed instead of failing on
 * "value.toFixed is not a function". Returns the message, or null when the expression is compatible.
 */
function findIncompatibleMethod(value: unknown, expression: string): string | null {
  const type = Array.isArray(value) ? 'array' : typeof value;
  for (const match of expression.matchAll(/\bvalue\s*\??\.\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    const method = match[1];
    if (typeof (value as Record<string, unknown>)[method] !== 'function') {
      return `method "${method}" of expression "${expression}" is not available on a value of type ${type}`;
    }
  }
  return null;
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
