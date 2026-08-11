/**
 * Tests for backend/shared/model/south-connector.model.ts.
 * That file lives outside `src/` (the `src/**\/*.spec.ts` test glob does not reach it),
 * so its runtime exports are exercised from a co-located spec here instead.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OIBUS_SOUTH_CATEGORIES, OIBUS_SOUTH_TYPES, SOUTH_SINGLE_ITEMS } from '../../shared/model/south-connector.model';

describe('shared south-connector model constants', () => {
  it('OIBUS_SOUTH_CATEGORIES contains the expected categories', () => {
    assert.deepEqual(OIBUS_SOUTH_CATEGORIES, ['file', 'iot', 'database', 'api']);
  });

  it('OIBUS_SOUTH_TYPES contains the expected types', () => {
    assert.ok(OIBUS_SOUTH_TYPES.includes('opcua'));
    assert.ok(OIBUS_SOUTH_TYPES.includes('folder-scanner'));
    assert.equal(OIBUS_SOUTH_TYPES.length, 20);
  });

  it('SOUTH_SINGLE_ITEMS only references known south types', () => {
    for (const type of SOUTH_SINGLE_ITEMS) {
      assert.ok(OIBUS_SOUTH_TYPES.includes(type));
    }
  });
});
