import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyFieldProcess } from './field-process';

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

  it('should throw a descriptive error when the expression calls a non-existent method', () => {
    assert.throws(
      () => applyFieldProcess('hello', 'value.nonExistentMethod()'),
      /Field process evaluation failed for expression "value\.nonExistentMethod\(\)"/
    );
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
