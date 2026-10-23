import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { Settings } from 'luxon';

import { toCompactTimeValues, truncateInstant } from './compact-time-values';

describe('toCompactTimeValues', () => {
  it('should convert time values into three parallel arrays', () => {
    assert.deepStrictEqual(
      toCompactTimeValues([
        { pointId: 'ref1', timestamp: '2020-01-01T00:00:00.000Z', value: 1.5 },
        { pointId: 'ref2', timestamp: '2020-01-01T00:01:00.000Z', value: 0 },
        { pointId: 'ref3', timestamp: '2020-01-01T00:02:00.000Z', value: undefined },
        { pointId: 'ref4', timestamp: '2020-01-01T00:03:00.000Z' } as unknown as Parameters<typeof toCompactTimeValues>[0][number]
      ]),
      {
        timestamps: ['2020-01-01T00:00:00.000Z', '2020-01-01T00:01:00.000Z', '2020-01-01T00:02:00.000Z', '2020-01-01T00:03:00.000Z'],
        values: [1.5, 0, null, null],
        references: ['ref1', 'ref2', 'ref3', 'ref4']
      }
    );
  });

  it('should format timestamps with the given function', () => {
    assert.deepStrictEqual(
      toCompactTimeValues([{ pointId: 'ref1', timestamp: '2020-01-01T00:00:00.000Z', value: 'a' }], timestamp => `${timestamp}!`),
      { timestamps: ['2020-01-01T00:00:00.000Z!'], values: ['a'], references: ['ref1'] }
    );
  });

  it('should format references with the given function', () => {
    assert.deepStrictEqual(
      toCompactTimeValues([{ pointId: 'ref1', timestamp: '2020-01-01T00:00:00.000Z', value: 'a' }], undefined, reference =>
        reference.toUpperCase()
      ),
      { timestamps: ['2020-01-01T00:00:00.000Z'], values: ['a'], references: ['REF1'] }
    );
  });

  it('should convert an empty array', () => {
    assert.deepStrictEqual(toCompactTimeValues([]), { timestamps: [], values: [], references: [] });
  });
});

describe('truncateInstant', () => {
  const defaultZone = Settings.defaultZone;

  afterEach(() => {
    Settings.defaultZone = defaultZone;
  });

  it('should truncate an instant with each precision', () => {
    assert.strictEqual(truncateInstant('2024-01-01T10:12:13.456Z', 'ms'), '2024-01-01T10:12:13.456Z');
    assert.strictEqual(truncateInstant('2024-01-01T10:12:13.456Z', 's'), '2024-01-01T10:12:13.000Z');
    assert.strictEqual(truncateInstant('2024-01-01T10:12:13.456Z', 'min'), '2024-01-01T10:12:00.000Z');
    assert.strictEqual(truncateInstant('2024-01-01T10:12:13.456Z', 'hr'), '2024-01-01T10:00:00.000Z');
  });

  it('should truncate in UTC whatever the time zone of the server', () => {
    // UTC+05:30: truncating in the local time zone would give 09:30Z
    Settings.defaultZone = 'Asia/Kolkata';

    assert.strictEqual(truncateInstant('2024-01-01T10:12:13.456Z', 'hr'), '2024-01-01T10:00:00.000Z');
    assert.strictEqual(truncateInstant('2024-01-01T10:12:13.456+05:30', 'hr'), '2024-01-01T04:00:00.000Z');
  });
});
