import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeIdentityKey, isEligible, resolveFieldMapping } from './configuration-workflow.utils';
import { RecordFilterCondition } from '../model/configuration-workflow.model';

describe('configuration-workflow.utils', () => {
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
});
