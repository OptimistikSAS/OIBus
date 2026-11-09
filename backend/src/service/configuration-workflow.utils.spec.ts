import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConfigurationWorkflowCommandDTO } from '../../shared/model/api/configuration-workflow.model';
import { OIBusRecord } from '../../shared/model/common/content.model';

import { RecordFilterCondition } from '../model/configuration-workflow.model';
import { OIBusValidationError } from '../model/types';
import LoggerMock from '../tests/__mocks__/service/logger/logger.mock';
import {
  addFields,
  checkAddedFields,
  checkWorkflowMode,
  computeIdentityKey,
  isEligible,
  prepareRecords,
  processRecords,
  resolveFieldMapping,
  resolveIdentityKeyFields,
  sampleFieldValues
} from './configuration-workflow.utils';

describe('configuration-workflow.utils', () => {
  const localCommand: ConfigurationWorkflowCommandDTO = {
    id: null,
    name: 'workflow',
    description: null,
    discoveryScope: {},
    identityKeyFields: ['nodeId'],
    fieldProcesses: [],
    addedFields: [],
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

  describe('checkAddedFields', () => {
    it('should accept fields added each with a key of its own', () => {
      checkAddedFields(localCommand);
      checkAddedFields({
        ...localCommand,
        addedFields: [
          { field: 'a', value: '1' },
          { field: 'b', value: '{{a}}' }
        ]
      });
    });

    it('should reject a field added without a key, or twice', () => {
      assert.throws(
        () => checkAddedFields({ ...localCommand, addedFields: [{ field: ' ', value: '1' }] }),
        new OIBusValidationError('A field added by a configuration workflow requires a name')
      );
      assert.throws(
        () =>
          checkAddedFields({
            ...localCommand,
            addedFields: [
              { field: 'a', value: '1' },
              { field: 'a', value: '2' }
            ]
          }),
        new OIBusValidationError('The field "a" is added twice by the configuration workflow')
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

    describe('startsWith', () => {
      it('should match the start of the value', () => {
        assert.strictEqual(isEligible({ path: 'Plant/Reactor/T1' }, [{ field: 'path', operator: 'startsWith', value: 'Plant/' }]), true);
        assert.strictEqual(isEligible({ path: 'Site/Plant/T1' }, [{ field: 'path', operator: 'startsWith', value: 'Plant/' }]), false);
        assert.strictEqual(isEligible({ id: 1234 }, [{ field: 'id', operator: 'startsWith', value: '12' }]), true);
      });
    });

    describe('endsWith', () => {
      it('should match the end of the value', () => {
        assert.strictEqual(isEligible({ name: 'Reactor.PV' }, [{ field: 'name', operator: 'endsWith', value: '.PV' }]), true);
        assert.strictEqual(isEligible({ name: 'Reactor.PV.Alarm' }, [{ field: 'name', operator: 'endsWith', value: '.PV' }]), false);
        assert.strictEqual(isEligible({}, [{ field: 'name', operator: 'endsWith', value: '.PV' }]), false);
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

  describe('addFields', () => {
    it('should add constants and combinations of the fields, in order, keeping the type of a single field', () => {
      const records: Array<OIBusRecord> = [
        { plant: 'P1', name: 'T1', max: 120 },
        { plant: 'P2', max: null }
      ];

      const added = addFields(records, [
        { field: 'site', value: 'Lyon' },
        { field: 'node-id', value: 'n{{ name }}' },
        { field: 'reference', value: '{{site}}.{{plant}}.{{name}}' },
        { field: 'id', value: '{{node-id}}' },
        { field: 'limit', value: '{{max}}' },
        { field: 'plant', value: '{{plant}}-old' }
      ]);

      assert.deepStrictEqual(added, [
        { plant: 'P1-old', name: 'T1', max: 120, site: 'Lyon', 'node-id': 'nT1', reference: 'Lyon.P1.T1', id: 'nT1', limit: 120 },
        { plant: 'P2-old', max: null, site: 'Lyon', 'node-id': 'n', reference: 'Lyon.P2.', id: 'n', limit: null }
      ]);
      // The discovered records are left untouched
      assert.deepStrictEqual(records[0], { plant: 'P1', name: 'T1', max: 120 });
      assert.strictEqual(addFields(records, []), records);
    });
  });

  describe('prepareRecords', () => {
    it('should process the discovered fields, add fields from them, then process the added fields', () => {
      const logger = new LoggerMock();

      const prepared = prepareRecords(
        [
          { name: ' t1 ', value: '12' },
          { name: 't2', value: '7' }
        ],
        {
          fieldProcesses: [
            { field: 'reference', operations: [{ type: 'uppercase' }] },
            { field: 'name', operations: [{ type: 'trim' }] }
          ],
          addedFields: [
            { field: 'reference', value: 'plant1.{{name}}' },
            { field: 'unit', value: '°C' }
          ]
        },
        logger
      );

      assert.deepStrictEqual(prepared.records, [
        { name: 't1', value: '12', reference: 'PLANT1.T1', unit: '°C' },
        { name: 't2', value: '7', reference: 'PLANT1.T2', unit: '°C' }
      ]);
      // The values of the discovered fields as discovered, and of the added fields as added
      assert.deepStrictEqual(prepared.samples, {
        name: [' t1 ', 't2'],
        value: ['12', '7'],
        reference: ['plant1.t1', 'plant1.t2'],
        unit: ['°C', '°C']
      });
      assert.strictEqual(logger.warn.mock.calls.length, 0);
    });
  });

  describe('sampleFieldValues', () => {
    it('should keep the first five non-empty values of each field', () => {
      const records = Array.from({ length: 7 }, (_, index) => ({ name: `T${index}`, unit: index < 6 ? null : 'bar' }));

      assert.deepStrictEqual(sampleFieldValues(records), { name: ['T0', 'T1', 'T2', 'T3', 'T4'], unit: ['bar'] });
      assert.deepStrictEqual(sampleFieldValues([]), {});
      assert.deepStrictEqual(sampleFieldValues(records, new Set(['unit'])), { unit: ['bar'] });
    });
  });
});
