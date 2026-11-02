import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FIELD_OPERATIONS_SCHEMA, testFieldOperations, toRecordFieldValue } from './field-process.utils';

describe('field-process.utils', () => {
  describe('testFieldOperations', () => {
    it('should process each value, telling why an operation fails on one', () => {
      assert.deepStrictEqual(testFieldOperations([{ type: 'number-operation', operator: 'multiply', operand: 10 }], ['1.5', 'abc', null]), [
        { value: '1.5', result: 15, error: null },
        { value: 'abc', result: null, error: '"abc" is not a number' },
        { value: null, result: null, error: null }
      ]);
    });

    it('should tell why an expression fails', () => {
      assert.match(testFieldOperations([{ type: 'expression', expression: 'value.(' }], ['a'])[0].error!, /Expression "value.\(" failed/);
    });
  });

  describe('toRecordFieldValue', () => {
    it('should keep a scalar, and write an object or an array as JSON', () => {
      assert.strictEqual(toRecordFieldValue('a'), 'a');
      assert.strictEqual(toRecordFieldValue(1), 1);
      assert.strictEqual(toRecordFieldValue(false), false);
      assert.strictEqual(toRecordFieldValue(undefined), null);
      assert.strictEqual(toRecordFieldValue(['a', 'b']), '["a","b"]');
    });
  });

  describe('FIELD_OPERATIONS_SCHEMA', () => {
    const errorOf = (operations: Array<unknown>) => FIELD_OPERATIONS_SCHEMA.validate(operations).error?.message ?? null;

    it('should accept the settings of each type of operation', () => {
      assert.strictEqual(
        errorOf([
          { type: 'uppercase' },
          { type: 'substring', start: 0, end: null },
          { type: 'add-to-string', prefix: 'a', suffix: '' },
          { type: 'replace', search: '/', replacement: '.' },
          { type: 'number-operation', operator: 'multiply', operand: 2 },
          { type: 'round', decimals: 2 },
          { type: 'datetime', inputType: 'iso-string', outputType: 'string', outputFormat: 'yyyy', outputTimezone: 'UTC' },
          { type: 'expression', expression: 'value' }
        ]),
        null
      );
    });

    it('should reject an unknown operation, a missing setting or one of another type', () => {
      assert.match(errorOf([{ type: 'nope' }])!, /"\[0\].type" must be one of/);
      assert.match(errorOf([{ type: 'substring', start: 0 }])!, /"\[0\].end" is required/);
      assert.match(errorOf([{ type: 'uppercase', start: 1 }])!, /"\[0\].start" is not allowed/);
      assert.match(errorOf([{ type: 'number-operation', operator: 'pow', operand: 2 }])!, /"\[0\].operator" must be one of/);
      assert.match(errorOf([{ type: 'datetime', inputType: 'bad', outputType: 'string' }])!, /"\[0\].inputType" must be one of/);
    });
  });
});
