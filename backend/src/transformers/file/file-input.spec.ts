import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fileInputAttribute, readFileRows } from './file-input';

describe('File input', () => {
  it('should read the rows of a CSV file with header, typing their values', () => {
    assert.deepStrictEqual(
      readFileRows('id;value;on\na;1.5;true\nb;;false', { fileType: 'csv', delimiter: 'SEMI_COLON', hasHeader: true }, []),
      {
        rows: [
          { id: 'a', value: 1.5, on: true },
          { id: 'b', value: null, on: false }
        ],
        errors: 0
      }
    );
  });

  it('should name the columns of a CSV file without header by their index, with the default delimiter', () => {
    assert.deepStrictEqual(readFileRows('a;1\nb;2', { fileType: 'csv', hasHeader: false }, []), {
      rows: [
        { 0: 'a', 1: 1 },
        { 0: 'b', 1: 2 }
      ],
      errors: 0
    });
  });

  it('should count the parsing errors of a CSV file, and read a buffer as text', () => {
    assert.strictEqual(readFileRows(Buffer.from('a,b\n"1,2'), { fileType: 'csv', delimiter: 'COMMA' }, []).errors, 2);
  });

  it('should read the properties of the nodes of a JSON file, and its JSONPath fields', () => {
    const content = {
      site: 'plant',
      metrics: [
        { name: 'm1', value: 1, data: { unit: 'C' }, tags: ['a'] },
        { name: 'm2', value: null }
      ]
    };

    assert.deepStrictEqual(
      readFileRows(JSON.stringify(content), { fileType: 'json', rowIteratorPath: '$.metrics[*]' }, [
        'name',
        '$.metrics[*].data.unit',
        '$.site',
        null,
        undefined
      ]),
      {
        rows: [
          { name: 'm1', value: 1, data: '{"unit":"C"}', tags: '["a"]', '$.metrics[*].data.unit': 'C', '$.site': 'plant' },
          { name: 'm2', value: null, '$.metrics[*].data.unit': null, '$.site': 'plant' }
        ],
        errors: 0
      }
    );
  });

  it('should read an already parsed JSON content, with the default row iterator', () => {
    assert.deepStrictEqual(readFileRows([{ a: 1 }, 2], { fileType: 'json' }, ['$[*]']), {
      rows: [{ a: 1, '$[*]': '{"a":1}' }, { '$[*]': 2 }],
      errors: 0
    });
  });

  it('should read the nodes of a JSON text embedded in the file', () => {
    const messages = [{ topic: 't', message: JSON.stringify({ metrics: [{ name: 'm1' }, { name: 'm2' }] }) }];

    assert.deepStrictEqual(
      readFileRows(messages, { fileType: 'json', rowIteratorPath: '$[*].message.metrics[*]' }, [
        '$[*].message.metrics[*].name',
        '$[*].topic'
      ]).rows.map(row => [row['$[*].message.metrics[*].name'], row['$[*].topic']]),
      [
        ['m1', 't'],
        ['m2', 't']
      ]
    );
  });

  it('should show the CSV options for a CSV file, and the row iterator for a JSON file', () => {
    assert.deepStrictEqual(
      fileInputAttribute.enablingConditions.map(condition => [condition.targetPathFromRoot, condition.values]),
      [
        ['delimiter', ['csv']],
        ['hasHeader', ['csv']],
        ['rowIteratorPath', ['json']]
      ]
    );
  });
});
