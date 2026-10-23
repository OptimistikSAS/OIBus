import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import testData from '../tests/utils/test-data';
import { extractJsonTimeValues, JsonTimeValuesOptions } from './json-time-values';

describe('extractJsonTimeValues', () => {
  const options: JsonTimeValuesOptions = {
    rowIteratorPath: '$.rows[*]',
    pointId: '$.rows[*].id',
    value: '$.rows[*].val',
    timestamp: '$.rows[*].ts',
    datetimeSettings: { inputType: 'unix-epoch-ms' }
  };

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should map each row to a time value', () => {
    const content = {
      rows: [
        { id: 'p1', val: 1, ts: 1700000000000 },
        { id: 2, val: 'on', ts: 1700000001000 }
      ]
    };

    assert.deepStrictEqual(extractJsonTimeValues(content, options), [
      { pointId: 'p1', timestamp: '2023-11-14T22:13:20.000Z', data: { value: 1 } },
      { pointId: '2', timestamp: '2023-11-14T22:13:21.000Z', data: { value: 'on' } }
    ]);
  });

  it('should skip rows without point ID or value, and stamp rows without timestamp with the current time', () => {
    const content = { rows: [{ val: 1 }, { id: 'p2', val: null }, { id: 'p3', val: 3 }] };

    assert.deepStrictEqual(extractJsonTimeValues(content, options), [
      { pointId: 'p3', timestamp: testData.constants.dates.FAKE_NOW, data: { value: 3 } }
    ]);
  });

  it('should parse ISO timestamps without datetime settings', () => {
    const content = {
      rows: [
        { id: 'p1', val: 1, ts: '2024-01-01T01:00:00+01:00' },
        { id: 'p2', val: 2, ts: 'invalid' }
      ]
    };

    assert.deepStrictEqual(extractJsonTimeValues(content, { ...options, datetimeSettings: null }), [
      { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 1 } },
      { pointId: 'p2', timestamp: testData.constants.dates.FAKE_NOW, data: { value: 2 } }
    ]);
  });
});
