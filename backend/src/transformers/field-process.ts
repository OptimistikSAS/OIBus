import vm from 'node:vm';

import type { ILogger } from '../model/logger.model';

/**
 * Whitelisted standard globals accessible inside a field-process expression.
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
 * Compiled vm.Script cache — avoids re-parsing the same expression for every row
 * when a dataset has many records.
 */
const scriptCache = new Map<string, vm.Script>();

/**
 * Evaluates an optional field-process expression against a field value inside a
 * restricted vm.Context that contains only standard JavaScript built-ins.
 *
 * Security properties:
 *  - `require`, `process`, `global`, `Buffer` → ReferenceError (not in context)
 *  - `Function`, `eval` → ReferenceError (not in context)
 *  - Execution is time-bounded (500 ms) to prevent runaway expressions.
 *
 * `value` is bound to the field value inside the expression.
 *
 * @example
 *   applyFieldProcess('hello', 'value.toUpperCase()')           // → 'HELLO'
 *   applyFieldProcess(3.14159, 'Math.round(value * 100) / 100') // → 3.14
 *   applyFieldProcess('2024-01-01', null)                        // → '2024-01-01' (no-op)
 */
export function applyFieldProcess(value: unknown, expression: string | null | undefined, logger?: ILogger): unknown {
  if (!expression?.trim()) return value;
  // A missing value has nothing to process: it is kept as is rather than failing on `null.toUpperCase()`
  if (value === null || value === undefined) return value;
  // A value the expression cannot process is skipped (null), with a warning
  const incompatibility = findIncompatibleMethod(value, expression);
  if (incompatibility) {
    warnOnce(logger, incompatibility);
    return null;
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
    throw new Error(`Field process evaluation failed for expression "${expression}": ${(e as Error).message}`);
  }
}

/**
 * Find a method called on `value` in the expression (`value.toUpperCase()`, `value.toFixed(2)`, …) that does not exist on
 * the type of the value (string, number, …), to skip the value with an explicit warning instead of failing on
 * "value.toFixed is not a function". Returns the warning message, or null when the expression is compatible.
 */
function findIncompatibleMethod(value: unknown, expression: string): string | null {
  const type = Array.isArray(value) ? 'array' : typeof value;
  for (const match of expression.matchAll(/\bvalue\s*\??\.\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    const method = match[1];
    if (typeof (value as Record<string, unknown>)[method] !== 'function') {
      return `Field process "${expression}" skipped: method "${method}" is not available on a value of type ${type}`;
    }
  }
  return null;
}

/** The warnings already logged by each logger, an expression being applied to many values of a batch */
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

/**
 * Build a function applying `expression` to string values (e.g. point IDs / references) and returning a string.
 * The same references repeat many times in a batch of records, so results are memoized per value to avoid
 * evaluating the expression in a new vm context for each element. Without expression, values are returned as is.
 */
export function createStringFieldProcess(expression: string | null | undefined, logger?: ILogger): (value: string) => string {
  if (!expression?.trim()) return value => value;
  const results = new Map<string, string>();
  return value => {
    let result = results.get(value);
    if (result === undefined) {
      // A reference the expression cannot process is kept as is
      const processed = applyFieldProcess(value, expression, logger);
      result = processed === null ? value : String(processed);
      results.set(value, result);
    }
    return result;
  };
}
