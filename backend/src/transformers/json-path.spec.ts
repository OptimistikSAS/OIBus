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
});
