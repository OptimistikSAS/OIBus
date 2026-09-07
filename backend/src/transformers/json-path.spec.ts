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

  it('should resolve a "length" field inside a JSON-stringified node instead of the raw string length', () => {
    // Before parsing, "message" is still a plain string, and native JSONPath traversal can
    // resolve ".length" against it directly (returning the string's character count) instead
    // of falling back to parsing the embedded JSON and reading its actual "length" field.
    const content = [{ message: JSON.stringify({ length: 0.04146180441257728 }) }];
    assert.strictEqual(resolveJsonPath('$[0].message.length', content), 0.04146180441257728);
  });

  it('should resolve an object field (e.g. an empty object) inside a JSON-stringified node', () => {
    const content = [{ message: JSON.stringify({ rejectCauses: {} }) }];
    assert.deepStrictEqual(resolveJsonPath('$[0].message.rejectCauses', content), {});
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
