import { describe, expect, test } from 'vitest';

import { OIBusArrayAttribute, OIBusAttribute, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';

import {
  convertCsvDelimiter,
  exportArrayElements,
  findArrayAttributeInAttributes,
  flattenPlainObject,
  getElementName,
  validateArrayElementsImport
} from './csv.utils';

const displayProperties = { row: 0, columns: 4, displayInViewMode: true };

const stringAttr = (key: string): OIBusAttribute => ({
  type: 'string',
  key,
  translationKey: key,
  defaultValue: null,
  validators: [],
  displayProperties
});
const numberAttr = (key: string): OIBusAttribute => ({
  type: 'number',
  key,
  translationKey: key,
  defaultValue: null,
  unit: null,
  validators: [],
  displayProperties
});
const booleanAttr = (key: string): OIBusAttribute => ({
  type: 'boolean',
  key,
  translationKey: key,
  defaultValue: false,
  validators: [],
  displayProperties
});
const objectAttr = (key: string, attributes: Array<OIBusAttribute>): OIBusObjectAttribute => ({
  type: 'object',
  key,
  translationKey: key,
  validators: [],
  attributes,
  enablingConditions: [],
  displayProperties: { visible: true, wrapInBox: false }
});
const arrayAttr = (key: string, attributes: Array<OIBusAttribute>): OIBusArrayAttribute => ({
  type: 'array',
  key,
  translationKey: key,
  validators: [],
  paginate: false,
  numberOfElementPerPage: 20,
  rootAttribute: objectAttr('item', attributes)
});

const csvFile = (content: string): File => new File([content], 'test.csv', { type: 'text/csv' });

describe('csv.utils', () => {
  const arrayAttribute = arrayAttr('items', [stringAttr('name'), numberAttr('value'), booleanAttr('enabled')]);

  describe('convertCsvDelimiter', () => {
    test.each([
      { delimiter: 'DOT', expected: '.' },
      { delimiter: 'SEMI_COLON', expected: ';' },
      { delimiter: 'COLON', expected: ':' },
      { delimiter: 'COMMA', expected: ',' },
      { delimiter: 'NON_BREAKING_SPACE', expected: ' ' },
      { delimiter: 'SLASH', expected: '/' },
      { delimiter: 'TAB', expected: '\t' },
      { delimiter: 'PIPE', expected: '|' }
    ] as const)('should convert $delimiter', ({ delimiter, expected }) => {
      expect(convertCsvDelimiter(delimiter)).toBe(expected);
    });
  });

  describe('exportArrayElements', () => {
    test('should export the fields of the elements described by the attribute', async () => {
      const blob = exportArrayElements(
        arrayAttribute,
        [
          { name: 'test1', value: 100, enabled: true, unknown: 'ignored' },
          { name: 'test2', value: null }
        ],
        ';'
      );

      expect(blob.type).toBe('text/csv');
      expect(await blob.text()).toBe('name;value;enabled\r\ntest1;100;true\r\ntest2;;');
    });

    test('should stringify the objects, the arrays and the object values', async () => {
      const attribute = arrayAttr('items', [
        objectAttr('nested', [objectAttr('level1', [stringAttr('level2')])]),
        arrayAttr('list', []),
        stringAttr('json'),
        objectAttr('scalar', [])
      ]);

      const blob = exportArrayElements(
        attribute,
        [{ nested: { level1: { level2: 'final' } }, list: [1, 2], json: { a: 1 }, scalar: 'text' }],
        ','
      );

      expect(await blob.text()).toBe('nested,list,json,scalar\r\n"{""level1"":{""level2"":""final""}}","[1,2]","{""a"":1}",text');
    });
  });

  describe('validateArrayElementsImport', () => {
    test('should import the elements of the file, converting their values', async () => {
      const file = csvFile('name,value,enabled\ntest1,100,true\ntest2,,0\n\ntest3,3,TRUE');

      const result = await validateArrayElementsImport(file, ',', arrayAttribute);

      expect(result).toEqual({
        elements: [
          { name: 'test1', value: 100, enabled: true },
          { name: 'test2', enabled: false },
          { name: 'test3', value: 3, enabled: true }
        ],
        errors: []
      });
    });

    test('should report the duplicated names, the existing names and the invalid values', async () => {
      const file = csvFile('name,value\ndup,1\ndup,2\nexisting,3\nbad,not-a-number');

      const result = await validateArrayElementsImport(file, ',', arrayAttribute, [{ name: 'existing' }]);

      expect(result.elements).toEqual([{ name: 'dup', value: 1 }]);
      expect(result.errors).toEqual([
        { element: { name: 'dup', value: '2' }, error: 'Row 2: Duplicate element name "dup" found in CSV file' },
        { element: { name: 'existing', value: '3' }, error: 'Row 3: Element name "existing" already exists in the array' },
        { element: { name: 'bad', value: 'not-a-number' }, error: 'Row 4: Invalid number value "not-a-number" for "value"' }
      ]);
    });

    test('should parse the objects and arrays from JSON', async () => {
      const attribute = arrayAttr('items', [
        stringAttr('name'),
        objectAttr('parent', [stringAttr('child')]),
        arrayAttr('list', []),
        arrayAttr('empty', [])
      ]);
      const file = csvFile('name;parent;list;empty\nitem;{"child":"nested-value"};[1,2,3];\nbad;;not-an-array;\nbad2;;{"a":1};');

      const result = await validateArrayElementsImport(file, ';', attribute);

      expect(result.elements).toEqual([{ name: 'item', parent: { child: 'nested-value' }, list: [1, 2, 3], empty: [] }]);
      expect(result.errors.map(error => error.error)).toEqual([
        'Row 2: Invalid array value for "list": not-an-array',
        'Row 3: Invalid array value for "list": {"a":1}'
      ]);
    });

    test('should throw when the delimiter cannot be used for the file', async () => {
      // papaparse guesses the delimiter of the file when the given one cannot be a delimiter
      await expect(validateArrayElementsImport(csvFile('name;value\na;1'), '"', arrayAttribute)).rejects.toThrow(
        /^The entered delimiter """ does not correspond to the file delimiter/
      );
    });
  });

  describe('flattenPlainObject', () => {
    test.each([
      {
        label: 'keep scalar leaves as strings',
        value: { name: 'a', value: 42, active: true },
        prefix: '',
        expected: { name: 'a', value: '42', active: 'true' }
      },
      { label: 'underscore-join nested keys at any depth', value: { a: { b: { c: 1 } } }, prefix: '', expected: { a_b_c: '1' } },
      { label: 'stringify arrays', value: { list: [1, 2, 3] }, prefix: '', expected: { list: '[1,2,3]' } },
      { label: 'turn null and undefined into empty strings', value: { a: null, b: undefined }, prefix: '', expected: { a: '', b: '' } },
      { label: 'keep a column for an empty object', value: { a: {} }, prefix: '', expected: { a: '' } },
      { label: 'prefix the keys', value: { b: 1 }, prefix: 'a', expected: { a_b: '1' } }
    ])('should $label', ({ value, prefix, expected }) => {
      expect(flattenPlainObject(value, prefix)).toEqual(expected);
    });
  });

  describe('getElementName', () => {
    test.each([
      { label: 'the name', element: { name: 'myName', id: 'myId' }, expected: 'myName' },
      { label: 'the id', element: { id: 'myId', key: 'myKey' }, expected: 'myId' },
      { label: 'the key', element: { key: 'myKey', title: 'myTitle' }, expected: 'myKey' },
      { label: 'the title', element: { title: 'myTitle', fieldName: 'myField' }, expected: 'myTitle' },
      { label: 'the field name', element: { fieldName: 'myField', other: 'other' }, expected: 'myField' },
      { label: 'the first non-empty string', element: { name: 1, empty: ' ', other: 'fallback' }, expected: 'fallback' },
      { label: 'an empty string without string value', element: { val: 123 }, expected: '' },
      { label: 'an empty string for an empty element', element: {}, expected: '' }
    ])('should return $label', ({ element, expected }) => {
      expect(getElementName(element)).toBe(expected);
    });
  });

  describe('findArrayAttributeInAttributes', () => {
    const target = arrayAttr('target', []);

    test.each([
      { label: 'at root level', attributes: [stringAttr('other'), target] },
      { label: 'in a nested object', attributes: [objectAttr('wrapper', [objectAttr('deeper', [target])])] }
    ])('should find the array attribute $label', ({ attributes }) => {
      expect(findArrayAttributeInAttributes('target', attributes)).toBe(target);
    });

    test('should throw when the attribute is not an array', () => {
      expect(() => findArrayAttributeInAttributes('target', [stringAttr('target')])).toThrow('Field "target" is not an array');
    });

    test('should return null when the attribute is not found', () => {
      expect(findArrayAttributeInAttributes('missing', [stringAttr('other'), objectAttr('wrapper', [])])).toBeNull();
    });
  });
});
