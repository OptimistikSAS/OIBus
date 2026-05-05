import { applyFieldProcess } from './field-process';

describe('applyFieldProcess', () => {
  // ─── No-op cases ────────────────────────────────────────────────────────────

  it('should return value unchanged when expression is null', () => {
    expect(applyFieldProcess('hello', null)).toBe('hello');
  });

  it('should return value unchanged when expression is undefined', () => {
    expect(applyFieldProcess(42, undefined)).toBe(42);
  });

  it('should return value unchanged when expression is an empty string', () => {
    expect(applyFieldProcess('hello', '')).toBe('hello');
  });

  it('should return value unchanged when expression is whitespace only', () => {
    expect(applyFieldProcess('hello', '   ')).toBe('hello');
  });

  // ─── Standard String operations ──────────────────────────────────────────────

  it('should apply value.toUpperCase()', () => {
    expect(applyFieldProcess('hello world', 'value.toUpperCase()')).toBe('HELLO WORLD');
  });

  it('should apply value.trim()', () => {
    expect(applyFieldProcess('  spaces  ', 'value.trim()')).toBe('spaces');
  });

  it('should apply value.replace()', () => {
    expect(applyFieldProcess('3.14', 'value.replace(".", ",")')).toBe('3,14');
  });

  it('should apply String() constructor from the whitelist', () => {
    expect(applyFieldProcess(123, 'String(value)')).toBe('123');
  });

  it('should apply chained String methods', () => {
    expect(applyFieldProcess('  hello  ', 'value.trim().toUpperCase()')).toBe('HELLO');
  });

  // ─── Standard Math / Number operations ──────────────────────────────────────

  it('should apply Math.round()', () => {
    expect(applyFieldProcess(3.14159, 'Math.round(value * 100) / 100')).toBe(3.14);
  });

  it('should apply Math.abs()', () => {
    expect(applyFieldProcess(-5, 'Math.abs(value)')).toBe(5);
  });

  it('should apply Number() from the whitelist', () => {
    expect(applyFieldProcess('42', 'Number(value)')).toBe(42);
  });

  it('should apply parseInt from the whitelist', () => {
    expect(applyFieldProcess('42.9', 'parseInt(value, 10)')).toBe(42);
  });

  it('should apply parseFloat from the whitelist', () => {
    expect(applyFieldProcess('3.14', 'parseFloat(value)')).toBeCloseTo(3.14);
  });

  // ─── JSON / structured data ──────────────────────────────────────────────────

  it('should apply JSON.parse()', () => {
    expect(applyFieldProcess('{"x":1}', 'JSON.parse(value).x')).toBe(1);
  });

  it('should apply JSON.stringify()', () => {
    expect(applyFieldProcess({ a: 1 }, 'JSON.stringify(value)')).toBe('{"a":1}');
  });

  // ─── Security: Node.js globals are NOT accessible ───────────────────────────

  it('should throw when the expression references "require"', () => {
    expect(() => applyFieldProcess('x', 'require("fs")')).toThrow('Field process evaluation failed');
  });

  it('should throw when the expression references "process"', () => {
    expect(() => applyFieldProcess('x', 'process.env.HOME')).toThrow('Field process evaluation failed');
  });

  it('should throw when the expression references "global"', () => {
    expect(() => applyFieldProcess('x', 'global.process')).toThrow('Field process evaluation failed');
  });

  it('should throw when the expression references "Buffer"', () => {
    expect(() => applyFieldProcess('x', 'Buffer.from("hi")')).toThrow('Field process evaluation failed');
  });

  it('should throw when the expression references "Function"', () => {
    expect(() => applyFieldProcess('x', 'Function("return process")()')).toThrow('Field process evaluation failed');
  });

  it('should not allow eval to reach Node.js globals (eval is sandboxed to the vm context)', () => {
    // eval itself is a language keyword bound to the vm context, not to the host.
    // Arithmetic via eval works fine because it stays inside the sandbox.
    expect(applyFieldProcess(0, 'eval("1 + 1")')).toBe(2);
    // But accessing a Node.js global through eval still throws because require is
    // not in the vm context.
    expect(() => applyFieldProcess('x', "eval(\"require('fs')\")")).toThrow('Field process evaluation failed');
  });

  // ─── Error propagation ───────────────────────────────────────────────────────

  it('should throw a descriptive error when the expression calls a non-existent method', () => {
    expect(() => applyFieldProcess('hello', 'value.nonExistentMethod()')).toThrow(
      'Field process evaluation failed for expression "value.nonExistentMethod()"'
    );
  });

  it('should throw a descriptive error when the expression has a syntax error', () => {
    expect(() => applyFieldProcess('hello', '(((')).toThrow('Field process evaluation failed');
  });

  it('should throw a descriptive error when the expression times out', () => {
    expect(() => applyFieldProcess(0, 'while(true){}')).toThrow('Field process evaluation failed');
  });

  // ─── Script caching ──────────────────────────────────────────────────────────

  it('should produce the same result when called multiple times with the same expression', () => {
    // The second call reuses the cached vm.Script; result must be identical.
    expect(applyFieldProcess('a', 'value.toUpperCase()')).toBe('A');
    expect(applyFieldProcess('b', 'value.toUpperCase()')).toBe('B');
    expect(applyFieldProcess('c', 'value.toUpperCase()')).toBe('C');
  });
});
