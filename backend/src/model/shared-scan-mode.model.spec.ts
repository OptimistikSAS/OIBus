/**
 * Tests for backend/shared/model/scan-mode.model.ts.
 * That file lives outside `src/` (the `src/**\/*.spec.ts` test glob does not reach it),
 * so its runtime exports are exercised from a co-located spec here instead.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SCAN_MODE_TYPES, INTERVAL_UNITS } from '../../shared/model/scan-mode.model';

describe('shared scan-mode model constants', () => {
  it('SCAN_MODE_TYPES contains cron and interval', () => {
    assert.deepEqual(SCAN_MODE_TYPES, ['cron', 'interval']);
  });

  it('INTERVAL_UNITS contains the expected units', () => {
    assert.deepEqual(INTERVAL_UNITS, ['ms', 's', 'min', 'hour']);
  });
});
