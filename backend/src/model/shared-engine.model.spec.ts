/**
 * Tests for backend/shared/model/engine.model.ts.
 * That file lives outside `src/` (the `src/**\/*.spec.ts` test glob does not reach it),
 * so its runtime exports are exercised from a co-located spec here instead.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OIBUS_DATA_TYPES, AUTH_TOKEN_DURATIONS, REGISTRATION_STATUS } from '../../shared/model/engine.model';

describe('shared engine model constants', () => {
  it('OIBUS_DATA_TYPES contains the expected data types', () => {
    assert.deepEqual(OIBUS_DATA_TYPES, ['any', 'time-values', 'setpoint', 'record-list']);
  });

  it('AUTH_TOKEN_DURATIONS contains the expected durations', () => {
    assert.deepEqual(AUTH_TOKEN_DURATIONS, ['1h', '6h', '1d', '3d', '7d', '14d', '30d']);
  });

  it('REGISTRATION_STATUS contains the expected statuses', () => {
    assert.deepEqual(REGISTRATION_STATUS, ['NOT_REGISTERED', 'PENDING', 'REGISTERED']);
  });
});
