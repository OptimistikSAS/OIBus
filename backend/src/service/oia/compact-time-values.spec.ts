import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toCompactTimeValues } from './compact-time-values';

describe('toCompactTimeValues', () => {
  it('should convert time values into three parallel arrays', () => {
    assert.deepStrictEqual(
      toCompactTimeValues([
        { pointId: 'ref1', timestamp: '2020-01-01T00:00:00.000Z', data: { value: 1.5 } },
        { pointId: 'ref2', timestamp: '2020-01-01T00:01:00.000Z', data: { value: 0 } },
        { pointId: 'ref3', timestamp: '2020-01-01T00:02:00.000Z', data: { value: undefined } },
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
      toCompactTimeValues([{ pointId: 'ref1', timestamp: '2020-01-01T00:00:00.000Z', data: { value: 'a' } }], timestamp => `${timestamp}!`),
      { timestamps: ['2020-01-01T00:00:00.000Z!'], values: ['a'], references: ['ref1'] }
    );
  });

  it('should format references with the given function', () => {
    assert.deepStrictEqual(
      toCompactTimeValues([{ pointId: 'ref1', timestamp: '2020-01-01T00:00:00.000Z', data: { value: 'a' } }], undefined, reference =>
        reference.toUpperCase()
      ),
      { timestamps: ['2020-01-01T00:00:00.000Z'], values: ['a'], references: ['REF1'] }
    );
  });

  it('should convert an empty array', () => {
    assert.deepStrictEqual(toCompactTimeValues([]), { timestamps: [], values: [], references: [] });
  });
});
