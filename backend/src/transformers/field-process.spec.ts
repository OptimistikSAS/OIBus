import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FieldOperation } from '../../shared/model/connector/field-process.model';

import type { ILogger } from '../model/logger.model';
import { createMock } from '../tests/utils/test-utils';
import { applyFieldOperations, createFieldProcess, createStringFieldProcess, evaluateExpression } from './field-process';

describe('evaluateExpression', () => {
  it('should return the value unchanged when the expression is empty', () => {
    assert.strictEqual(evaluateExpression('hello', '   '), 'hello');
  });

  // ─── Standard String operations ──────────────────────────────────────────────

  it('should apply value.toUpperCase()', () => {
    assert.strictEqual(evaluateExpression('hello world', 'value.toUpperCase()'), 'HELLO WORLD');
  });

  it('should apply value.trim()', () => {
    assert.strictEqual(evaluateExpression('  spaces  ', 'value.trim()'), 'spaces');
  });

  it('should apply value.replace()', () => {
    assert.strictEqual(evaluateExpression('3.14', 'value.replace(".", ",")'), '3,14');
  });

  it('should apply String() constructor from the whitelist', () => {
    assert.strictEqual(evaluateExpression(123, 'String(value)'), '123');
  });

  it('should apply chained String methods', () => {
    assert.strictEqual(evaluateExpression('  hello  ', 'value.trim().toUpperCase()'), 'HELLO');
  });

  // ─── Standard Math / Number operations ──────────────────────────────────────

  it('should apply Math.round()', () => {
    assert.strictEqual(evaluateExpression(3.14159, 'Math.round(value * 100) / 100'), 3.14);
  });

  it('should apply Math.abs()', () => {
    assert.strictEqual(evaluateExpression(-5, 'Math.abs(value)'), 5);
  });

  it('should apply Number() from the whitelist', () => {
    assert.strictEqual(evaluateExpression('42', 'Number(value)'), 42);
  });

  it('should apply parseInt from the whitelist', () => {
    assert.strictEqual(evaluateExpression('42.9', 'parseInt(value, 10)'), 42);
  });

  it('should apply parseFloat from the whitelist', () => {
    const result = evaluateExpression('3.14', 'parseFloat(value)') as number;
    assert.ok(Math.abs(result - 3.14) < 0.001);
  });

  // ─── JSON / structured data ──────────────────────────────────────────────────

  it('should apply JSON.parse()', () => {
    assert.strictEqual(evaluateExpression('{"x":1}', 'JSON.parse(value).x'), 1);
  });

  it('should apply JSON.stringify()', () => {
    assert.strictEqual(evaluateExpression({ a: 1 }, 'JSON.stringify(value)'), '{"a":1}');
  });

  // ─── Security: Node.js globals are NOT accessible ───────────────────────────

  it('should throw when the expression references "require"', () => {
    assert.throws(() => evaluateExpression('x', 'require("fs")'), /failed/);
  });

  it('should throw when the expression references "process"', () => {
    assert.throws(() => evaluateExpression('x', 'process.env.HOME'), /failed/);
  });

  it('should throw when the expression references "global"', () => {
    assert.throws(() => evaluateExpression('x', 'global.process'), /failed/);
  });

  it('should throw when the expression references "Buffer"', () => {
    assert.throws(() => evaluateExpression('x', 'Buffer.from("hi")'), /failed/);
  });

  it('should throw when the expression references "Function"', () => {
    assert.throws(() => evaluateExpression('x', 'Function("return process")()'), /failed/);
  });

  it('should not allow eval to reach Node.js globals (eval is sandboxed to the vm context)', () => {
    assert.strictEqual(evaluateExpression(0, 'eval("1 + 1")'), 2);
    assert.throws(() => evaluateExpression('x', 'eval("require(\'fs\')")'), /failed/);
  });

  // ─── Error propagation ───────────────────────────────────────────────────────

  it('should tell when the expression calls a method the value does not have', () => {
    assert.throws(() => evaluateExpression('hello', 'value.nonExistentMethod()'), /method "nonExistentMethod"/);
    assert.throws(
      () => evaluateExpression(12, 'value.toUpperCase()'),
      /method "toUpperCase" of expression "value.toUpperCase\(\)" is not available on a value of type number/
    );
    assert.throws(() => evaluateExpression('12', 'value.toFixed(2)'), /method "toFixed"/);
  });

  it('should throw a descriptive error when the expression calls a non-existent function', () => {
    assert.throws(() => evaluateExpression('hello', 'nonExistentFunction(value)'), /Expression "nonExistentFunction\(value\)" failed/);
  });

  it('should apply a number method on a number', () => {
    assert.strictEqual(evaluateExpression(3.14159, 'value.toFixed(2)'), '3.14');
  });

  it('should throw a descriptive error when the expression has a syntax error', () => {
    assert.throws(() => evaluateExpression('hello', '((('), /failed/);
  });

  it('should throw a descriptive error when the expression times out', () => {
    assert.throws(() => evaluateExpression(0, 'while(true){}'), /failed/);
  });

  // ─── Script caching ──────────────────────────────────────────────────────────

  it('should produce the same result when called multiple times with the same expression', () => {
    assert.strictEqual(evaluateExpression('a', 'value.toUpperCase()'), 'A');
    assert.strictEqual(evaluateExpression('b', 'value.toUpperCase()'), 'B');
    assert.strictEqual(evaluateExpression('c', 'value.toUpperCase()'), 'C');
  });
});

describe('applyFieldOperations', () => {
  const apply = (value: unknown, ...operations: Array<FieldOperation>) => applyFieldOperations(value, operations);

  it('should change the case and trim', () => {
    assert.strictEqual(apply('Temperature', { type: 'uppercase' }), 'TEMPERATURE');
    assert.strictEqual(apply('Temperature', { type: 'lowercase' }), 'temperature');
    assert.strictEqual(apply('  Temperature ', { type: 'trim' }), 'Temperature');
    assert.strictEqual(apply(12, { type: 'uppercase' }), '12');
  });

  it('should keep a part of the value, counting from the end with a negative index', () => {
    assert.strictEqual(apply('Temperature', { type: 'substring', start: 0, end: 4 }), 'Temp');
    assert.strictEqual(apply('Plant/Reactor', { type: 'substring', start: 6, end: null }), 'Reactor');
    assert.strictEqual(apply('Temperature', { type: 'substring', start: -3, end: null }), 'ure');
  });

  it('should add text around the value and replace text in it', () => {
    assert.strictEqual(apply(12, { type: 'add-to-string', prefix: 'a.', suffix: '.b' }), 'a.12.b');
    assert.strictEqual(apply('Plant/Reactor/T1', { type: 'replace', search: '/', replacement: '.' }), 'Plant.Reactor.T1');
    assert.strictEqual(apply('T1', { type: 'replace', search: '', replacement: '.' }), 'T1');
  });

  it('should compute on numbers, and numeric texts', () => {
    assert.strictEqual(apply(1, { type: 'number-operation', operator: 'add', operand: 2 }), 3);
    assert.strictEqual(apply('1', { type: 'number-operation', operator: 'subtract', operand: 2 }), -1);
    assert.strictEqual(apply('1.5', { type: 'number-operation', operator: 'multiply', operand: 2 }), 3);
    assert.strictEqual(apply(1, { type: 'number-operation', operator: 'divide', operand: 4 }), 0.25);
    assert.strictEqual(apply(3.14159, { type: 'round', decimals: 2 }), 3.14);
    assert.strictEqual(apply('2.5', { type: 'round', decimals: 0 }), 3);
  });

  it('should throw when a number operation can not apply', () => {
    assert.throws(() => apply(1, { type: 'number-operation', operator: 'divide', operand: 0 }), /division by zero/);
    assert.throws(() => apply('', { type: 'round', decimals: 1 }), /"" is not a number/);
    assert.throws(() => apply(true, { type: 'round', decimals: 1 }), /"true" is not a number/);
  });

  it('should convert date times', () => {
    assert.strictEqual(
      apply(1704067200000, { type: 'datetime', inputType: 'unix-epoch-ms', outputType: 'iso-string' }),
      '2024-01-01T00:00:00.000Z'
    );
    assert.strictEqual(
      apply('2024-01-01T00:00:00.000Z', { type: 'datetime', inputType: 'iso-string', outputType: 'unix-epoch' }),
      1704067200
    );
    assert.strictEqual(
      apply('01/01/2024 01:00', {
        type: 'datetime',
        inputType: 'string',
        inputFormat: 'dd/MM/yyyy HH:mm',
        inputTimezone: 'Europe/Paris',
        outputType: 'string',
        outputFormat: 'yyyy-MM-dd HH:mm',
        outputTimezone: 'UTC'
      }),
      '2024-01-01 00:00'
    );
  });

  it('should throw when a date time conversion can not apply', () => {
    assert.throws(
      () => apply('not a date', { type: 'datetime', inputType: 'iso-string', outputType: 'unix-epoch' }),
      /"not a date" is not a valid date time of type "iso-string"/
    );
    assert.throws(
      () => apply('01/01/2024', { type: 'datetime', inputType: 'string', outputType: 'unix-epoch' }),
      /the input format and timezone are required to read a date time string/
    );
    assert.throws(
      () => apply('2024-01-01T00:00:00Z', { type: 'datetime', inputType: 'iso-string', outputType: 'string', outputFormat: 'yyyy' }),
      /the output format and timezone are required to write a date time string/
    );
    assert.throws(
      () => apply(false, { type: 'datetime', inputType: 'iso-string', outputType: 'unix-epoch' }),
      /"false" is not a date time/
    );
  });

  it('should evaluate an expression, on any value', () => {
    assert.strictEqual(apply('Plant/Reactor/T1', { type: 'expression', expression: "value.split('/').pop()" }), 'T1');
    // built in the sandbox, with its own Object prototype
    assert.strictEqual(JSON.stringify(apply({ a: 1 }, { type: 'expression', expression: '({ ...value, b: 2 })' })), '{"a":1,"b":2}');
    assert.strictEqual(apply('a', { type: 'expression', expression: 'undefined' }), null);
  });

  it('should only process an object or an array with an expression', () => {
    assert.throws(() => apply({ a: 1 }, { type: 'uppercase' }), /\{"a":1\} is an object or an array: only an expression can process it/);
  });

  it('should apply the operations in order, and stop on an empty value', () => {
    assert.strictEqual(apply(' a ', { type: 'trim' }, { type: 'uppercase' }, { type: 'add-to-string', prefix: '[', suffix: ']' }), '[A]');
    assert.strictEqual(apply('a', { type: 'expression', expression: 'null' }, { type: 'uppercase' }), null);
    assert.strictEqual(apply(null, { type: 'uppercase' }), null);
    assert.strictEqual(apply(undefined, { type: 'uppercase' }), undefined);
  });
});

describe('createFieldProcess', () => {
  it('should return values unchanged without operations', () => {
    assert.strictEqual(createFieldProcess(null, 'value')('ref'), 'ref');
    assert.strictEqual(createFieldProcess([], 'value')(12), 12);
  });

  it('should make a value the operations fail on null, with a single warning per logger', () => {
    const logger = createMock<ILogger>();
    const process = createFieldProcess([{ type: 'round', decimals: 1 }], 'value "v"', logger);

    assert.strictEqual(process('1.26'), 1.3);
    assert.strictEqual(process('abc'), null);
    assert.strictEqual(createFieldProcess([{ type: 'round', decimals: 1 }], 'value "v"', logger)('abc'), null);
    assert.deepStrictEqual(
      logger.warn.mock.calls.map(call => call.arguments),
      [['Field process of value "v" skipped a value: "abc" is not a number']]
    );
  });
});

describe('createStringFieldProcess', () => {
  it('should return values unchanged without operations', () => {
    assert.strictEqual(createStringFieldProcess(null, 'reference')('ref'), 'ref');
    assert.strictEqual(createStringFieldProcess([], 'reference')('ref'), 'ref');
  });

  it('should apply the operations and convert the result into a string', () => {
    const process = createStringFieldProcess([{ type: 'expression', expression: "value.replace('plant/', '').length" }], 'reference');
    assert.strictEqual(process('plant/temp'), '4');
  });

  it('should memoize results per value', () => {
    const process = createStringFieldProcess([{ type: 'expression', expression: 'value + Math.random()' }], 'reference');
    const first = process('ref1');
    assert.strictEqual(process('ref1'), first);
    assert.notStrictEqual(process('ref2'), first);
  });

  it('should keep the reference as is, with a warning, when the operations fail on it', () => {
    const logger = createMock<ILogger>();
    assert.strictEqual(
      createStringFieldProcess([{ type: 'expression', expression: 'value.toFixed(2)' }], 'reference', logger)('ref'),
      'ref'
    );
    assert.strictEqual(createStringFieldProcess([{ type: 'expression', expression: 'null' }], 'reference', logger)('ref'), 'ref');
    assert.strictEqual(logger.warn.mock.calls.length, 1);
  });
});
