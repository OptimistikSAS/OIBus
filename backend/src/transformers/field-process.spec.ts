import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ILogger } from '../model/logger.model';
import { createMock } from '../tests/utils/test-utils';
import { applyFieldProcess, createStringFieldProcess } from './field-process';

describe('applyFieldProcess', () => {
  // ─── No-op cases ────────────────────────────────────────────────────────────

  it('should return value unchanged when expression is null', () => {
    assert.strictEqual(applyFieldProcess('hello', null), 'hello');
  });

  it('should return value unchanged when expression is undefined', () => {
    assert.strictEqual(applyFieldProcess(42, undefined), 42);
  });

  it('should return value unchanged when expression is an empty string', () => {
    assert.strictEqual(applyFieldProcess('hello', ''), 'hello');
  });

  it('should return value unchanged when expression is whitespace only', () => {
    assert.strictEqual(applyFieldProcess('hello', '   '), 'hello');
  });

  // ─── Standard String operations ──────────────────────────────────────────────

  it('should apply value.toUpperCase()', () => {
    assert.strictEqual(applyFieldProcess('hello world', 'value.toUpperCase()'), 'HELLO WORLD');
  });

  it('should apply value.trim()', () => {
    assert.strictEqual(applyFieldProcess('  spaces  ', 'value.trim()'), 'spaces');
  });

  it('should apply value.replace()', () => {
    assert.strictEqual(applyFieldProcess('3.14', 'value.replace(".", ",")'), '3,14');
  });

  it('should apply String() constructor from the whitelist', () => {
    assert.strictEqual(applyFieldProcess(123, 'String(value)'), '123');
  });

  it('should apply chained String methods', () => {
    assert.strictEqual(applyFieldProcess('  hello  ', 'value.trim().toUpperCase()'), 'HELLO');
  });

  // ─── Standard Math / Number operations ──────────────────────────────────────

  it('should apply Math.round()', () => {
    assert.strictEqual(applyFieldProcess(3.14159, 'Math.round(value * 100) / 100'), 3.14);
  });

  it('should apply Math.abs()', () => {
    assert.strictEqual(applyFieldProcess(-5, 'Math.abs(value)'), 5);
  });

  it('should apply Number() from the whitelist', () => {
    assert.strictEqual(applyFieldProcess('42', 'Number(value)'), 42);
  });

  it('should apply parseInt from the whitelist', () => {
    assert.strictEqual(applyFieldProcess('42.9', 'parseInt(value, 10)'), 42);
  });

  it('should apply parseFloat from the whitelist', () => {
    const result = applyFieldProcess('3.14', 'parseFloat(value)') as number;
    assert.ok(Math.abs(result - 3.14) < 0.001);
  });

  // ─── JSON / structured data ──────────────────────────────────────────────────

  it('should apply JSON.parse()', () => {
    assert.strictEqual(applyFieldProcess('{"x":1}', 'JSON.parse(value).x'), 1);
  });

  it('should apply JSON.stringify()', () => {
    assert.strictEqual(applyFieldProcess({ a: 1 }, 'JSON.stringify(value)'), '{"a":1}');
  });

  // ─── Security: Node.js globals are NOT accessible ───────────────────────────

  it('should throw when the expression references "require"', () => {
    assert.throws(() => applyFieldProcess('x', 'require("fs")'), /Field process evaluation failed/);
  });

  it('should throw when the expression references "process"', () => {
    assert.throws(() => applyFieldProcess('x', 'process.env.HOME'), /Field process evaluation failed/);
  });

  it('should throw when the expression references "global"', () => {
    assert.throws(() => applyFieldProcess('x', 'global.process'), /Field process evaluation failed/);
  });

  it('should throw when the expression references "Buffer"', () => {
    assert.throws(() => applyFieldProcess('x', 'Buffer.from("hi")'), /Field process evaluation failed/);
  });

  it('should throw when the expression references "Function"', () => {
    assert.throws(() => applyFieldProcess('x', 'Function("return process")()'), /Field process evaluation failed/);
  });

  it('should not allow eval to reach Node.js globals (eval is sandboxed to the vm context)', () => {
    assert.strictEqual(applyFieldProcess(0, 'eval("1 + 1")'), 2);
    assert.throws(() => applyFieldProcess('x', 'eval("require(\'fs\')")'), /Field process evaluation failed/);
  });

  // ─── Error propagation ───────────────────────────────────────────────────────

  it('should skip the value when the expression calls a non-existent method', () => {
    assert.strictEqual(applyFieldProcess('hello', 'value.nonExistentMethod()'), null);
  });

  it('should throw a descriptive error when the expression calls a non-existent function', () => {
    assert.throws(() => applyFieldProcess('hello', 'nonExistentFunction(value)'), /Field process evaluation failed for expression/);
  });

  it('should return a null or undefined value without processing it', () => {
    assert.strictEqual(applyFieldProcess(null, 'value.toUpperCase()'), null);
    assert.strictEqual(applyFieldProcess(undefined, 'value.toUpperCase()'), undefined);
  });

  it('should skip the value with a single warning when a string method is called on a number', () => {
    const logger = createMock<ILogger>();
    assert.strictEqual(applyFieldProcess(12, 'value.toUpperCase()', logger), null);
    assert.strictEqual(applyFieldProcess(13, 'value.toUpperCase()', logger), null);
    assert.strictEqual(logger.warn.mock.calls.length, 1);
    assert.match(logger.warn.mock.calls[0].arguments[0] as string, /method "toUpperCase" is not available on a value of type number/);
  });

  it('should skip the value when a number method is called on a string', () => {
    assert.strictEqual(applyFieldProcess('12', 'value.toFixed(2)'), null);
  });

  it('should apply a number method on a number', () => {
    assert.strictEqual(applyFieldProcess(3.14159, 'value.toFixed(2)'), '3.14');
  });

  it('should throw a descriptive error when the expression has a syntax error', () => {
    assert.throws(() => applyFieldProcess('hello', '((('), /Field process evaluation failed/);
  });

  it('should throw a descriptive error when the expression times out', () => {
    assert.throws(() => applyFieldProcess(0, 'while(true){}'), /Field process evaluation failed/);
  });

  // ─── Script caching ──────────────────────────────────────────────────────────

  it('should produce the same result when called multiple times with the same expression', () => {
    assert.strictEqual(applyFieldProcess('a', 'value.toUpperCase()'), 'A');
    assert.strictEqual(applyFieldProcess('b', 'value.toUpperCase()'), 'B');
    assert.strictEqual(applyFieldProcess('c', 'value.toUpperCase()'), 'C');
  });
});

describe('createStringFieldProcess', () => {
  it('should return values unchanged without expression', () => {
    assert.strictEqual(createStringFieldProcess(null)('ref'), 'ref');
    assert.strictEqual(createStringFieldProcess(undefined)('ref'), 'ref');
    assert.strictEqual(createStringFieldProcess('  ')('ref'), 'ref');
  });

  it('should apply the expression and convert the result into a string', () => {
    const process = createStringFieldProcess("value.replace('plant/', '').length");
    assert.strictEqual(process('plant/temp'), '4');
  });

  it('should memoize results per value', () => {
    const process = createStringFieldProcess('value + Math.random()');
    const first = process('ref1');
    assert.strictEqual(process('ref1'), first);
    assert.notStrictEqual(process('ref2'), first);
  });

  it('should throw when the expression fails', () => {
    assert.throws(() => createStringFieldProcess('boom(value)')('ref'), /Field process evaluation failed/);
  });

  it('should keep the reference as is, with a warning, when the expression cannot process it', () => {
    const logger = createMock<ILogger>();
    assert.strictEqual(createStringFieldProcess('value.toFixed(2)', logger)('ref'), 'ref');
    assert.strictEqual(logger.warn.mock.calls.length, 1);
  });
});
