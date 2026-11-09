import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FieldDatetimePrecision, FieldOperation } from '../../shared/model/connector/field-process.model';

import type { ILogger } from '../model/logger.model';
import { createMock } from '../tests/utils/test-utils';
import { applyFieldOperations, createFieldProcess, createStringFieldProcess } from './field-process';

describe('applyFieldOperations', () => {
  const apply = (value: unknown, ...operations: Array<FieldOperation>) => applyFieldOperations(value, operations);

  it('should convert the value', () => {
    assert.strictEqual(apply(12, { type: 'convert', to: 'string' }), '12');
    assert.strictEqual(apply({ a: 1 }, { type: 'convert', to: 'string' }), '{"a":1}');
    assert.strictEqual(apply('1.5', { type: 'convert', to: 'number' }), 1.5);
    assert.strictEqual(apply('TRUE', { type: 'convert', to: 'boolean' }), true);
    assert.strictEqual(apply(0, { type: 'convert', to: 'boolean' }), false);
    assert.strictEqual(apply(false, { type: 'convert', to: 'boolean' }), false);
    assert.deepStrictEqual(apply('{"a":[1]}', { type: 'convert', to: 'json' }), { a: [1] });
    assert.strictEqual(apply(3, { type: 'convert', to: 'json' }), 3);
    // a date of a database driver is processed as its ISO string
    assert.strictEqual(apply(new Date('2024-01-01T00:00:00.000Z'), { type: 'convert', to: 'string' }), '2024-01-01T00:00:00.000Z');
  });

  it('should throw when a conversion can not apply', () => {
    assert.throws(() => apply('abc', { type: 'convert', to: 'number' }), /"abc" is not a number/);
    assert.throws(() => apply(true, { type: 'convert', to: 'number' }), /true is not a number/);
    assert.throws(() => apply([1], { type: 'convert', to: 'boolean' }), /\[1\] is not a boolean/);
    assert.throws(() => apply('{a', { type: 'convert', to: 'json' }), /"\{a" is not a JSON text/);
  });

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

  it('should round a date time down to a precision, in UTC or in the timezone it is written in', () => {
    const roundDown = (precision: FieldDatetimePrecision, outputType: 'iso-string' | 'unix-epoch-ms' = 'iso-string') =>
      apply('2024-01-01T10:42:37.512Z', { type: 'datetime', inputType: 'iso-string', outputType, precision });

    assert.strictEqual(roundDown('s'), '2024-01-01T10:42:37.000Z');
    assert.strictEqual(roundDown('min'), '2024-01-01T10:42:00.000Z');
    assert.strictEqual(roundDown('hr'), '2024-01-01T10:00:00.000Z');
    assert.strictEqual(roundDown('day'), '2024-01-01T00:00:00.000Z');
    assert.strictEqual(roundDown('min', 'unix-epoch-ms'), 1704105720000);
    // the hours of India start at half past the hours of UTC
    assert.strictEqual(
      apply('2024-01-01T10:42:37.512Z', {
        type: 'datetime',
        inputType: 'iso-string',
        outputType: 'string',
        outputFormat: 'yyyy-MM-dd HH:mm:ss',
        outputTimezone: 'Asia/Kolkata',
        precision: 'hr'
      }),
      '2024-01-01 16:00:00'
    );
  });

  it('should convert a date of a database driver as an instant, whatever the input type', () => {
    const date = new Date('2024-01-01T10:42:37.512Z');

    assert.strictEqual(
      apply(date, { type: 'datetime', inputType: 'string', inputFormat: 'yyyy', inputTimezone: 'UTC', outputType: 'unix-epoch' }),
      1704105757
    );
    assert.strictEqual(apply(date, { type: 'uppercase' }), '2024-01-01T10:42:37.512Z');
    assert.throws(() => apply(new Date('nope'), { type: 'datetime', inputType: 'iso-string', outputType: 'unix-epoch' }), /invalid date/);
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

  it('should only process an object or an array with a conversion', () => {
    assert.throws(() => apply({ a: 1 }, { type: 'uppercase' }), /\{"a":1\} is an object or an array: only a conversion can process it/);
  });

  it('should apply the operations in order, and stop on an empty value', () => {
    assert.strictEqual(apply(' a ', { type: 'trim' }, { type: 'uppercase' }, { type: 'add-to-string', prefix: '[', suffix: ']' }), '[A]');
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
    const process = createStringFieldProcess([{ type: 'number-operation', operator: 'multiply', operand: 2 }], 'reference');
    assert.strictEqual(process('21'), '42');
    // memoized per value
    assert.strictEqual(process('21'), '42');
    assert.strictEqual(process('4'), '8');
  });

  it('should keep the reference as is, with a warning, when the operations fail on it', () => {
    const logger = createMock<ILogger>();
    assert.strictEqual(createStringFieldProcess([{ type: 'round', decimals: 2 }], 'reference', logger)('ref'), 'ref');
    assert.strictEqual(logger.warn.mock.calls.length, 1);
  });
});
