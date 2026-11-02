import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';

import { FieldProcessSamplesService } from './field-process-samples.service';

describe('FieldProcessSamplesService', () => {
  let service: FieldProcessSamplesService;

  beforeEach(() => {
    service = TestBed.inject(FieldProcessSamplesService);
  });

  test('should have no value before a test', () => {
    expect(service.valuesOf('value')).toEqual([]);
  });

  test('should give the first five non-empty values of a field of a record list', () => {
    service.setContent({
      type: 'record-list',
      content: [{ v: '' }, { v: null }, { v: 1 }, { v: 'b' }, { other: 1 }, { v: true }, { v: 4 }, { v: 5 }, { v: 6 }]
    });

    expect(service.valuesOf('v')).toEqual([1, 'b', true, 4, 5]);
    expect(service.valuesOf('missing')).toEqual([]);
  });

  test('should read the rows of a JSON file, an object or an array as its JSON text', () => {
    service.setContent({
      type: 'file',
      content: JSON.stringify([
        { tag: 'a', data: { x: 1 } },
        { tag: 'b', data: [1, 2] }
      ])
    });
    expect(service.valuesOf('tag')).toEqual(['a', 'b']);
    expect(service.valuesOf('data')).toEqual(['{"x":1}', '[1,2]']);

    // the rows of an object are its first array
    service.setContent({ type: 'file', content: JSON.stringify({ count: 1, rows: [{ tag: 'c' }, 'not a row'] }) });
    expect(service.valuesOf('tag')).toEqual(['c']);

    service.setContent({ type: 'file', content: JSON.stringify({ tag: 'not in rows' }) });
    expect(service.valuesOf('tag')).toEqual([]);
  });

  test('should read the rows of a CSV file, with a header', () => {
    service.setContent({ type: 'file', content: 'tag;value\nT1;1.5\nT2;2\n' });

    expect(service.valuesOf('tag')).toEqual(['T1', 'T2']);
    expect(service.valuesOf('value')).toEqual([1.5, 2]);
  });

  test('should forget the rows', () => {
    service.setContent({ type: 'record-list', content: [{ v: 1 }] });
    service.setContent(null);

    expect(service.valuesOf('v')).toEqual([]);
  });
});
