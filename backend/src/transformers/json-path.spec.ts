import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveJsonPath, resolveJsonPathRows } from './json-path';

describe('resolveJsonPath', () => {
  it('should resolve a plain path with no JSON-stringified intermediate node', () => {
    assert.strictEqual(resolveJsonPath('$[0].name', [{ name: 'point-1' }]), 'point-1');
  });

  it('should auto-parse a JSON-stringified intermediate node (e.g. an MQTT message payload)', () => {
    const content = [{ message: JSON.stringify({ metrics: [{ name: 'TAG.A' }] }) }];
    assert.strictEqual(resolveJsonPath('$[0].message.metrics[0].name', content), 'TAG.A');
  });

  it('should return undefined when the path does not resolve at all', () => {
    assert.strictEqual(resolveJsonPath('$[0].missing', [{ name: 'point-1' }]), undefined);
  });

  it('should return undefined when the top-level json is an invalid JSON string', () => {
    assert.strictEqual(resolveJsonPath('$.x', 'not valid json{'), undefined);
  });

  it('should return undefined when the top-level json is null or undefined', () => {
    assert.strictEqual(resolveJsonPath('$.x', null), undefined);
    assert.strictEqual(resolveJsonPath('$.x', undefined), undefined);
  });

  it('should skip an intermediate node that is a string but not valid JSON while scanning for a parseable node', () => {
    const content = [{ message: 'not-json-string', other: { value: 5 } }];
    assert.strictEqual(resolveJsonPath('$[0].message.foo', content), undefined);
  });
});

describe('resolveJsonPathRows', () => {
  it('should return one row per top-level array element when there is no string boundary', () => {
    const rows = resolveJsonPathRows('$[*]', [{ id: 1 }, { id: 2 }]);
    assert.deepStrictEqual(
      rows.map(r => r.indices),
      [[0], [1]]
    );
  });

  it('should resolve nested wildcards on plain (non-stringified) JSON exactly like native JSONPath', () => {
    const content = { items: [{ tags: ['a', 'b'] }, { tags: ['c'] }] };
    const rows = resolveJsonPathRows('$.items[*].tags[*]', content);
    assert.deepStrictEqual(
      rows.map(r => r.indices),
      [
        [0, 0],
        [0, 1],
        [1, 0]
      ]
    );
  });

  it('should return an empty array when the row iterator matches nothing', () => {
    assert.deepStrictEqual(resolveJsonPathRows('$[*]', []), []);
  });

  it('should split multiple metrics embedded in a single JSON-stringified MQTT message into separate rows', () => {
    const content = [
      {
        message: JSON.stringify({
          metrics: [
            { name: 'TAG.A', value: 1.1 },
            { name: 'TAG.B', value: 2.2 }
          ]
        }),
        item: { name: 'topic1' }
      },
      {
        message: JSON.stringify({ metrics: [{ name: 'TAG.C', value: 3.3 }] }),
        item: { name: 'topic2' }
      }
    ];

    const rows = resolveJsonPathRows('$[*].message.metrics[*]', content);

    assert.deepStrictEqual(
      rows.map(r => r.indices),
      [
        [0, 0],
        [0, 1],
        [1, 0]
      ]
    );
  });

  it('should return an empty array when the top-level json is an invalid JSON string', () => {
    assert.deepStrictEqual(resolveJsonPathRows('$[*]', 'not valid json{'), []);
  });

  it('should return an empty array when the top-level json is null or undefined', () => {
    assert.deepStrictEqual(resolveJsonPathRows('$[*]', null), []);
    assert.deepStrictEqual(resolveJsonPathRows('$[*]', undefined), []);
  });

  it('should auto-parse a top-level JSON-stringified array', () => {
    const rows = resolveJsonPathRows('$[*]', JSON.stringify([{ id: 1 }, { id: 2 }]));
    assert.deepStrictEqual(
      rows.map(r => r.indices),
      [[0], [1]]
    );
  });

  it('should skip prefix matches that are not strings or that fail to parse, and still collect rows from a valid one', () => {
    const content = [
      { message: 123, item: { name: 'a' } },
      { message: JSON.stringify({ metrics: [{ name: 'X' }] }), item: { name: 'b' } },
      { message: 'bad{json', item: { name: 'c' } }
    ];

    const rows = resolveJsonPathRows('$[*].message.metrics[*]', content);

    assert.deepStrictEqual(
      rows.map(r => r.indices),
      [[1, 0]]
    );
  });
});
