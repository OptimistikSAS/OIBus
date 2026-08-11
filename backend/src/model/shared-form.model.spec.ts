/**
 * Tests for backend/shared/model/form.model.ts.
 * That file lives outside `src/` (the `src/**\/*.spec.ts` test glob does not reach it),
 * so its runtime exports are exercised from a co-located spec here instead.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OIBUS_ATTRIBUTE_TYPES,
  OIBUS_ATTRIBUTE_VALIDATOR_TYPES,
  OIBUS_PLATFORMS,
  isEnabledOnPlatform,
  OIBusAttribute
} from '../../shared/model/form.model';

const baseDisplayProperties = { row: 0, columns: 1, displayInViewMode: false };

function buildAttribute(validators: Array<{ type: string; arguments?: Array<string> }>): OIBusAttribute {
  return {
    type: 'string',
    key: 'someKey',
    translationKey: 'some.translation.key',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: validators as any,
    displayProperties: baseDisplayProperties,
    defaultValue: null
  };
}

describe('shared form model constants', () => {
  it('OIBUS_ATTRIBUTE_TYPES contains the expected attribute types', () => {
    assert.ok(OIBUS_ATTRIBUTE_TYPES.includes('string'));
    assert.ok(OIBUS_ATTRIBUTE_TYPES.includes('object'));
    assert.equal(OIBUS_ATTRIBUTE_TYPES.length, 13);
  });

  it('OIBUS_ATTRIBUTE_VALIDATOR_TYPES contains the expected validator types', () => {
    assert.ok(OIBUS_ATTRIBUTE_VALIDATOR_TYPES.includes('PLATFORM'));
    assert.equal(OIBUS_ATTRIBUTE_VALIDATOR_TYPES.length, 10);
  });

  it('OIBUS_PLATFORMS contains the expected platforms', () => {
    assert.deepEqual(OIBUS_PLATFORMS, ['windows', 'linux', 'macos']);
  });
});

describe('isEnabledOnPlatform', () => {
  it('returns true when the attribute has no validators at all', () => {
    const attribute = buildAttribute([]);
    assert.equal(isEnabledOnPlatform(attribute, 'linux'), true);
  });

  it('returns true when the attribute has validators but none of type PLATFORM', () => {
    const attribute = buildAttribute([{ type: 'REQUIRED', arguments: [] }]);
    assert.equal(isEnabledOnPlatform(attribute, 'linux'), true);
  });

  it('returns true when the PLATFORM validator includes the given platform', () => {
    const attribute = buildAttribute([{ type: 'PLATFORM', arguments: ['linux', 'windows'] }]);
    assert.equal(isEnabledOnPlatform(attribute, 'linux'), true);
  });

  it('returns false when the PLATFORM validator does not include the given platform', () => {
    const attribute = buildAttribute([{ type: 'PLATFORM', arguments: ['windows'] }]);
    assert.equal(isEnabledOnPlatform(attribute, 'linux'), false);
  });
});
