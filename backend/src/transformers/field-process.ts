import vm from 'node:vm';

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
export function applyFieldProcess(value: unknown, expression: string | null | undefined): unknown {
  if (!expression?.trim()) return value;
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
