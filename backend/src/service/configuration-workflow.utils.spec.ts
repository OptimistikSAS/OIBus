import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConfigurationWorkflowCommandDTO } from '../../shared/model/api/configuration-workflow.model';
import { OIBusRecord } from '../../shared/model/common/content.model';
import { FieldOperation } from '../../shared/model/domain/configuration-workflow.model';

import { RecordFilterCondition } from '../model/configuration-workflow.model';
import { OIBusValidationError } from '../model/types';
import LoggerMock from '../tests/__mocks__/service/logger/logger.mock';
import {
  checkWorkflowMode,
  computeIdentityKey,
  isEligible,
  processRecords,
  resolveFieldMapping,
  resolveIdentityKeyFields,
  sampleFieldValues,
  testFieldOperations
} from './configuration-workflow.utils';

describe('configuration-workflow.utils', () => {
  const localCommand: ConfigurationWorkflowCommandDTO = {
    id: null,
    name: 'workflow',
    description: null,
    discoveryScope: {},
    identityKeyFields: ['nodeId'],
    fieldProcesses: [],
    eligibilityFilter: [],
    itemFieldMapping: { name: '{{name}}' },
    pushToOIAnalytics: false,
    scanModeId: null,
    enabled: true
  };
  const remoteCommand: ConfigurationWorkflowCommandDTO = { ...localCommand, itemFieldMapping: null, pushToOIAnalytics: true };

  describe('checkWorkflowMode', () => {
    it('should accept a local or a remote workflow', () => {
      checkWorkflowMode(localCommand);
      checkWorkflowMode({ ...remoteCommand, identityKeyFields: [] });
    });

    it('should reject a workflow that is both, neither, or local without identity key fields', () => {
      assert.throws(
        () => checkWorkflowMode({ ...localCommand, pushToOIAnalytics: true }),
        new OIBusValidationError('A configuration workflow cannot both create/update items and push to OIAnalytics')
      );
      assert.throws(
        () => checkWorkflowMode({ ...localCommand, itemFieldMapping: null }),
        new OIBusValidationError('A configuration workflow must either create/update items or push to OIAnalytics')
      );
      assert.throws(
        () => checkWorkflowMode({ ...localCommand, identityKeyFields: [] }),
        new OIBusValidationError('A configuration workflow creating/updating items requires at least one identity key field')
      );
    });
  });

  describe('resolveIdentityKeyFields', () => {
    it('should keep the identity key fields of a local workflow and discard those of a remote one', () => {
      assert.deepStrictEqual(resolveIdentityKeyFields(localCommand), ['nodeId']);
      assert.deepStrictEqual(resolveIdentityKeyFields(remoteCommand), []);
    });
  });

  describe('isEligible', () => {
    it('should be eligible when there are no conditions', () => {
      assert.strictEqual(isEligible({ type: 'Variable' }, []), true);
    });

    it('should AND multiple conditions — all must pass', () => {
      const conditions: Array<RecordFilterCondition> = [
        { field: 'type', operator: 'equals', value: 'Variable' },
        { field: 'unit', operator: 'exists' }
      ];
      assert.strictEqual(isEligible({ type: 'Variable', unit: '°C' }, conditions), true);
      assert.strictEqual(isEligible({ type: 'Variable' }, conditions), false);
      assert.strictEqual(isEligible({ type: 'Object', unit: '°C' }, conditions), false);
    });

    describe('equals / notEquals', () => {
      it('should match equals against the stringified field value', () => {
        assert.strictEqual(isEligible({ type: 'Variable' }, [{ field: 'type', operator: 'equals', value: 'Variable' }]), true);
        assert.strictEqual(isEligible({ type: 'Object' }, [{ field: 'type', operator: 'equals', value: 'Variable' }]), false);
        assert.strictEqual(isEligible({ count: 3 }, [{ field: 'count', operator: 'equals', value: '3' }]), true);
      });

      it('should treat a missing field as not equal, never equal', () => {
        assert.strictEqual(isEligible({}, [{ field: 'type', operator: 'equals', value: 'Variable' }]), false);
        assert.strictEqual(isEligible({}, [{ field: 'type', operator: 'notEquals', value: 'Variable' }]), true);
      });
    });

    describe('contains', () => {
      it('should match a substring', () => {
        assert.strictEqual(isEligible({ name: 'Reactor Temperature' }, [{ field: 'name', operator: 'contains', value: 'Temp' }]), true);
        assert.strictEqual(isEligible({ name: 'Reactor Pressure' }, [{ field: 'name', operator: 'contains', value: 'Temp' }]), false);
      });
    });

    describe('matches', () => {
      it('should match a regular expression', () => {
        assert.strictEqual(isEligible({ nodeId: 'ns=1;s=Temp01' }, [{ field: 'nodeId', operator: 'matches', value: '^ns=1;' }]), true);
        assert.strictEqual(isEligible({ nodeId: 'ns=2;s=Temp01' }, [{ field: 'nodeId', operator: 'matches', value: '^ns=1;' }]), false);
      });

      it('should treat an invalid regex as not matching, without throwing', () => {
        assert.strictEqual(isEligible({ nodeId: 'anything' }, [{ field: 'nodeId', operator: 'matches', value: '(unterminated' }]), false);
      });
    });

    describe('exists', () => {
      it('should require the field to be present and non-null', () => {
        assert.strictEqual(isEligible({ unit: '°C' }, [{ field: 'unit', operator: 'exists' }]), true);
        assert.strictEqual(isEligible({ unit: null }, [{ field: 'unit', operator: 'exists' }]), false);
        assert.strictEqual(isEligible({}, [{ field: 'unit', operator: 'exists' }]), false);
      });
    });

    describe('greaterThan / lessThan', () => {
      it('should compare numerically', () => {
        assert.strictEqual(isEligible({ min: -20 }, [{ field: 'min', operator: 'greaterThan', value: '-50' }]), true);
        assert.strictEqual(isEligible({ min: -20 }, [{ field: 'min', operator: 'lessThan', value: '-50' }]), false);
      });

      it('should never match when either side is not numeric', () => {
        assert.strictEqual(isEligible({ min: 'not-a-number' }, [{ field: 'min', operator: 'greaterThan', value: '0' }]), false);
        assert.strictEqual(isEligible({ min: 5 }, [{ field: 'min', operator: 'greaterThan', value: 'not-a-number' }]), false);
      });
    });
  });

  describe('computeIdentityKey', () => {
    it('should build a stable key from one field', () => {
      assert.strictEqual(computeIdentityKey({ nodeId: 'ns=1;s=Temperature' }, ['nodeId']), 'nodeId=ns=1;s=Temperature');
    });

    it('should build a stable key from multiple fields, in the declared order', () => {
      const key = computeIdentityKey({ nodeId: 'ns=1;s=Temperature', parentPath: 'Reactor/Sensors' }, ['nodeId', 'parentPath']);
      assert.strictEqual(
        key,
        computeIdentityKey({ parentPath: 'Reactor/Sensors', nodeId: 'ns=1;s=Temperature' }, ['nodeId', 'parentPath'])
      );
    });

    it('should produce different keys for different field orders', () => {
      const record = { a: 'x', b: 'y' };
      assert.notStrictEqual(computeIdentityKey(record, ['a', 'b']), computeIdentityKey(record, ['b', 'a']));
    });

    it('should default a missing field to an empty value rather than "undefined"', () => {
      assert.strictEqual(computeIdentityKey({}, ['nodeId']), 'nodeId=');
    });

    it('should not collide when field values happen to contain "="', () => {
      const keyOne = computeIdentityKey({ a: 'b=c' }, ['a']);
      const keyTwo = computeIdentityKey({ a: '', b: 'c' }, ['a', 'b']);
      assert.notStrictEqual(keyOne, keyTwo);
    });

    it('should return an empty string when no identity key fields are declared', () => {
      assert.strictEqual(computeIdentityKey({ nodeId: 'ns=1;s=Temperature' }, []), '');
    });
  });

  describe('resolveFieldMapping', () => {
    it('should resolve an exact placeholder to the raw value, preserving its type', () => {
      const resolved = resolveFieldMapping(
        { nodeId: 'ns=1;s=Temp', min: 0, max: 100.5, active: true },
        {
          'settings.nodeId': '{{nodeId}}',
          'settings.min': '{{min}}',
          'settings.max': '{{max}}',
          'settings.active': '{{active}}'
        }
      );
      assert.strictEqual(resolved['settings.nodeId'], 'ns=1;s=Temp');
      assert.strictEqual(resolved['settings.min'], 0);
      assert.strictEqual(resolved['settings.max'], 100.5);
      assert.strictEqual(resolved['settings.active'], true);
    });

    it('should stringify placeholders embedded in surrounding text', () => {
      const resolved = resolveFieldMapping({ name: 'Temperature', unit: '°C' }, { description: 'Reads {{name}} in {{unit}}' });
      assert.strictEqual(resolved.description, 'Reads Temperature in °C');
    });

    it('should resolve a missing field to null when the template is an exact placeholder', () => {
      const resolved = resolveFieldMapping({}, { unit: '{{unit}}' });
      assert.strictEqual(resolved.unit, null);
    });

    it('should resolve a missing field to an empty string when interpolated', () => {
      const resolved = resolveFieldMapping({}, { description: 'unit: {{unit}}' });
      assert.strictEqual(resolved.description, 'unit: ');
    });

    it('should resolve a one-level nested path (e.g. item.name)', () => {
      const resolved = resolveFieldMapping({ unit: '°C', item: { name: 'Reactor Temperature' } }, { description: '{{item.name}}' });
      assert.strictEqual(resolved.description, 'Reactor Temperature');
    });

    it('should resolve a nested path to undefined-turned-null/empty when the parent is missing or not an object', () => {
      assert.strictEqual(resolveFieldMapping({}, { description: '{{item.name}}' }).description, null);
      assert.strictEqual(resolveFieldMapping({ item: 'not an object' }, { description: '{{item.name}}' }).description, null);
    });

    it('should resolve every key of the mapping independently', () => {
      const resolved = resolveFieldMapping({ name: 'Temperature', unit: '°C' }, { 'settings.nodeId': '{{name}}', unit: '{{unit}}' });
      assert.deepStrictEqual(resolved, { 'settings.nodeId': 'Temperature', unit: '°C' });
    });

    it('should return an empty object for an empty mapping', () => {
      assert.deepStrictEqual(resolveFieldMapping({ name: 'Temperature' }, {}), {});
    });
  });
  describe('processRecords', () => {
    it('should apply the operations of each field in order, leaving the other fields, missing and empty values as they are', () => {
      const records: Array<OIBusRecord> = [
        { name: ' Temperature ', unit: '°C', description: null },
        { unit: 'bar', description: 'Pressure' }
      ];

      const processed = processRecords(records, [
        {
          field: 'name',
          operations: [{ type: 'trim' }, { type: 'lowercase' }, { type: 'add-to-string', prefix: 'reactor.', suffix: '_pv' }]
        },
        { field: 'description', operations: [{ type: 'uppercase' }] }
      ]);

      assert.deepStrictEqual(processed, [
        { name: 'reactor.temperature_pv', unit: '°C', description: null },
        { unit: 'bar', description: 'PRESSURE' }
      ]);
      // The discovered records are left untouched
      assert.strictEqual(records[0].name, ' Temperature ');
    });

    it('should return the records as they are without any operation', () => {
      const records = [{ name: 'Temperature' }];
      assert.strictEqual(processRecords(records, []), records);
      assert.strictEqual(processRecords(records, [{ field: 'name', operations: [] }]), records);
    });

    it('should set a value an operation fails on to null, warning once per field', () => {
      const logger = new LoggerMock();

      const processed = processRecords(
        [{ value: 'abc' }, { value: '2' }, { value: 'def' }],
        [{ field: 'value', operations: [{ type: 'number-operation', operator: 'multiply', operand: 2 }] }],
        logger
      );

      assert.deepStrictEqual(processed, [{ value: null }, { value: 4 }, { value: null }]);
      assert.strictEqual(logger.warn.mock.calls.length, 1);
      assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
        'Field process of "value" failed: "abc" is not a number - the field is set to null (later failures of this field are not logged)'
      ]);
    });
  });

  describe('testFieldOperations', () => {
    const test = (operations: Array<FieldOperation>, value: string | number | boolean) => testFieldOperations(operations, [value])[0];

    it('should change the case and trim', () => {
      assert.strictEqual(test([{ type: 'uppercase' }], 'Temperature').result, 'TEMPERATURE');
      assert.strictEqual(test([{ type: 'lowercase' }], 'Temperature').result, 'temperature');
      assert.strictEqual(test([{ type: 'trim' }], '  Temperature ').result, 'Temperature');
      assert.strictEqual(test([{ type: 'uppercase' }], 12).result, '12');
    });

    it('should keep a part of the value, counting from the end with a negative index', () => {
      assert.strictEqual(test([{ type: 'substring', start: 0, end: 4 }], 'Temperature').result, 'Temp');
      assert.strictEqual(test([{ type: 'substring', start: 6, end: null }], 'Plant/Reactor').result, 'Reactor');
      assert.strictEqual(test([{ type: 'substring', start: -3, end: null }], 'Temperature').result, 'ure');
    });

    it('should add text around the value and replace text in it', () => {
      assert.strictEqual(test([{ type: 'add-to-string', prefix: 'a.', suffix: '.b' }], 12).result, 'a.12.b');
      assert.strictEqual(test([{ type: 'replace', search: '/', replacement: '.' }], 'Plant/Reactor/T1').result, 'Plant.Reactor.T1');
      assert.strictEqual(test([{ type: 'replace', search: '', replacement: '.' }], 'T1').result, 'T1');
    });

    it('should compute on numbers, and numeric texts', () => {
      assert.strictEqual(test([{ type: 'number-operation', operator: 'add', operand: 2 }], 1).result, 3);
      assert.strictEqual(test([{ type: 'number-operation', operator: 'subtract', operand: 2 }], '1').result, -1);
      assert.strictEqual(test([{ type: 'number-operation', operator: 'multiply', operand: 2 }], '1.5').result, 3);
      assert.strictEqual(test([{ type: 'number-operation', operator: 'divide', operand: 4 }], 1).result, 0.25);
      assert.strictEqual(test([{ type: 'round', decimals: 2 }], 3.14159).result, 3.14);
      assert.strictEqual(test([{ type: 'round', decimals: 0 }], '2.5').result, 3);
    });

    it('should tell why a number operation fails', () => {
      assert.deepStrictEqual(test([{ type: 'number-operation', operator: 'divide', operand: 0 }], 1), {
        value: 1,
        result: null,
        error: 'division by zero'
      });
      assert.strictEqual(test([{ type: 'round', decimals: 1 }], '').error, '"" is not a number');
      assert.strictEqual(test([{ type: 'round', decimals: 1 }], true).error, '"true" is not a number');
    });

    it('should convert date times', () => {
      assert.strictEqual(
        test([{ type: 'datetime', inputType: 'unix-epoch-ms', outputType: 'iso-string' }], 1704067200000).result,
        '2024-01-01T00:00:00.000Z'
      );
      assert.strictEqual(
        test([{ type: 'datetime', inputType: 'iso-string', outputType: 'unix-epoch' }], '2024-01-01T00:00:00.000Z').result,
        1704067200
      );
      assert.strictEqual(
        test(
          [
            {
              type: 'datetime',
              inputType: 'string',
              inputFormat: 'dd/MM/yyyy HH:mm',
              inputTimezone: 'Europe/Paris',
              outputType: 'string',
              outputFormat: 'yyyy-MM-dd HH:mm',
              outputTimezone: 'UTC'
            }
          ],
          '01/01/2024 01:00'
        ).result,
        '2024-01-01 00:00'
      );
    });

    it('should tell why a date time conversion fails', () => {
      assert.strictEqual(
        test([{ type: 'datetime', inputType: 'iso-string', outputType: 'unix-epoch' }], 'not a date').error,
        '"not a date" is not a valid date time of type "iso-string"'
      );
      assert.strictEqual(
        test([{ type: 'datetime', inputType: 'string', outputType: 'unix-epoch' }], '01/01/2024').error,
        'the input format and timezone are required to read a date time string'
      );
      assert.strictEqual(
        test([{ type: 'datetime', inputType: 'iso-string', outputType: 'string', outputFormat: 'yyyy' }], '2024-01-01T00:00:00Z').error,
        'the output format and timezone are required to write a date time string'
      );
      assert.strictEqual(
        test([{ type: 'datetime', inputType: 'iso-string', outputType: 'unix-epoch' }], false).error,
        '"false" is not a date time'
      );
    });

    it('should evaluate an expression, an object it returns as JSON', () => {
      assert.strictEqual(test([{ type: 'expression', expression: "value.split('/').pop()" }], 'Plant/Reactor/T1').result, 'T1');
      assert.strictEqual(test([{ type: 'expression', expression: "value.split('/')" }], 'a/b').result, '["a","b"]');
      assert.strictEqual(test([{ type: 'expression', expression: 'undefined' }], 'a').result, null);
      assert.match(test([{ type: 'expression', expression: 'value.(' }], 'a').error!, /Field process evaluation failed/);
    });

    it('should stop processing a value an expression makes null', () => {
      assert.strictEqual(test([{ type: 'expression', expression: 'null' }, { type: 'uppercase' }], 'a').result, null);
    });

    it('should keep an empty value empty', () => {
      assert.deepStrictEqual(testFieldOperations([{ type: 'uppercase' }], [null]), [{ value: null, result: null, error: null }]);
    });
  });

  describe('sampleFieldValues', () => {
    it('should keep the first five non-empty values of each field', () => {
      const records = Array.from({ length: 7 }, (_, index) => ({ name: `T${index}`, unit: index < 6 ? null : 'bar' }));

      assert.deepStrictEqual(sampleFieldValues(records), { name: ['T0', 'T1', 'T2', 'T3', 'T4'], unit: ['bar'] });
      assert.deepStrictEqual(sampleFieldValues([]), {});
    });
  });
});
