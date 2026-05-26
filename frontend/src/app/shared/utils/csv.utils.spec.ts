import Papa from 'papaparse';
import {
  convertCsvDelimiter,
  exportArrayElements,
  validateArrayElementsImport,
  getElementName,
  findArrayAttributeInAttributes
} from './csv.utils';

import { OIBusArrayAttribute } from '../../../../../backend/shared/model/form.model';
import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('csv.utils', () => {
  const mockArrayAttribute = {
    type: 'array' as const,
    key: 'items',
    translationKey: 'test.items',
    validators: [],
    rootAttribute: {
      type: 'object' as const,
      key: 'item',
      translationKey: 'test.item',
      validators: [],
      attributes: [
        {
          type: 'string' as const,
          key: 'name',
          translationKey: 'test.name',
          validators: [],
          defaultValue: null,
          displayProperties: { row: 0, columns: 12, displayInViewMode: true }
        },
        {
          type: 'number' as const,
          key: 'value',
          translationKey: 'test.value',
          validators: [],
          defaultValue: null,
          displayProperties: { row: 0, columns: 12, displayInViewMode: true },
          unit: ''
        }
      ],
      enablingConditions: [],
      displayProperties: { visible: true, wrapInBox: false }
    },
    paginate: false,
    numberOfElementPerPage: 25
  };

  describe('convertCsvDelimiter', () => {
    test('should convert CSV characters to their delimiter counterpart', () => {
      expect(convertCsvDelimiter('DOT')).toBe('.');
      expect(convertCsvDelimiter('SEMI_COLON')).toBe(';');
      expect(convertCsvDelimiter('COLON')).toBe(':');
      expect(convertCsvDelimiter('COMMA')).toBe(',');
      expect(convertCsvDelimiter('NON_BREAKING_SPACE')).toBe(' ');
      expect(convertCsvDelimiter('SLASH')).toBe('/');
      expect(convertCsvDelimiter('TAB')).toBe('  ');
      expect(convertCsvDelimiter('PIPE')).toBe('|');
    });
  });

  describe('exportArrayElements', () => {
    let unparseSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      unparseSpy = vi.spyOn(Papa, 'unparse').mockReturnValue('csv-content');
    });

    test('should flatten elements and return a Blob', () => {
      const arrayItems = [
        { name: 'test1', value: 100 },
        { name: 'test2', value: 200 }
      ];
      const delimiter = ',';

      const result = exportArrayElements(mockArrayAttribute as unknown as OIBusArrayAttribute, arrayItems, delimiter);

      expect(result instanceof Blob).toBe(true);
      expect(result.type).toBe('text/csv');

      expect(unparseSpy).toHaveBeenCalled();
      const lastCall = unparseSpy.mock.calls[unparseSpy.mock.calls.length - 1];
      const [data, config] = lastCall;
      expect(config).toEqual({ columns: expect.arrayContaining(['name', 'value']), delimiter });
      expect(data).toEqual([
        { name: 'test1', value: 100 },
        { name: 'test2', value: 200 }
      ]);
    });

    test('should flatten nested objects', () => {
      const arrayAttributeWithNested = {
        ...mockArrayAttribute,
        rootAttribute: {
          ...mockArrayAttribute.rootAttribute,
          attributes: [
            {
              type: 'object' as const,
              key: 'nested',
              attributes: [{ type: 'string' as const, key: 'prop' }]
            }
          ]
        }
      };

      const arrayItems = [{ nested: { prop: 'val' } }];
      const delimiter = ';';

      exportArrayElements(arrayAttributeWithNested as unknown as OIBusArrayAttribute, arrayItems, delimiter);

      const lastCall = unparseSpy.mock.calls[unparseSpy.mock.calls.length - 1];
      const [data, config] = lastCall;
      expect(config.delimiter).toBe(';');
      expect(data[0]['nested']).toBe(JSON.stringify({ prop: 'val' }));
    });

    test('should stringify arrays and objects within special fields', () => {
      const arrayAttributeWithComplex = {
        ...mockArrayAttribute,
        rootAttribute: {
          ...mockArrayAttribute.rootAttribute,
          attributes: [
            { type: 'array' as const, key: 'list' },
            { type: 'object' as const, key: 'obj_field' }
          ]
        }
      };

      const arrayItems = [{ list: [1, 2], obj_field: { a: 1 } }];

      exportArrayElements(arrayAttributeWithComplex as unknown as OIBusArrayAttribute, arrayItems, ',');

      const lastCall = unparseSpy.mock.calls[unparseSpy.mock.calls.length - 1];
      const [data] = lastCall;
      expect(data[0]['list']).toBe('[1,2]');
    });

    test('should handle recursion for nested objects', () => {
      const attribute = {
        ...mockArrayAttribute,
        rootAttribute: {
          type: 'object',
          attributes: [
            {
              type: 'object',
              key: 'level1',
              attributes: [{ type: 'string', key: 'level2' }]
            }
          ]
        }
      };

      const items = [{ level1: { level2: 'final' } }];
      exportArrayElements(attribute as unknown as OIBusArrayAttribute, items, ',');

      const lastCall = unparseSpy.mock.calls[unparseSpy.mock.calls.length - 1];
      const [data] = lastCall;
      expect(data[0]['level1']).toBe(JSON.stringify({ level2: 'final' }));
    });
  });

  describe('validateArrayElementsImport', () => {
    let parseSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      parseSpy = vi.spyOn(Papa, 'parse').mockReturnValue({
        data: [],
        meta: { delimiter: ',' }
      } as any);
    });

    const createMockFile = (content: string) => new File([content], 'test.csv', { type: 'text/csv' });

    test('should validate and import CSV content', async () => {
      const csvContent = 'name,value\ntest1,100';
      const file = createMockFile(csvContent);
      parseSpy.mockReturnValue({
        data: [{ name: 'test1', value: '100' }],
        meta: { delimiter: ',' }
      } as any);

      const result = await validateArrayElementsImport(file, ',', mockArrayAttribute as unknown as OIBusArrayAttribute);

      expect(result.elements.length).toBe(1);
      expect(result.elements[0]).toEqual({ name: 'test1', value: 100 });
      expect(result.errors.length).toBe(0);
    });

    test('should detect duplicate names in CSV', async () => {
      const file = createMockFile('');
      parseSpy.mockReturnValue({
        data: [
          { name: 'dup', value: '1' },
          { name: 'dup', value: '2' }
        ],
        meta: { delimiter: ',' }
      } as any);

      const result = await validateArrayElementsImport(file, ',', mockArrayAttribute as unknown as OIBusArrayAttribute);

      expect(result.elements.length).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('Duplicate element name "dup"');
    });

    test('should detect names existing in current list', async () => {
      const file = createMockFile('');
      parseSpy.mockReturnValue({
        data: [{ name: 'existing' }],
        meta: { delimiter: ',' }
      } as any);

      const existing = [{ name: 'existing' }];
      const result = await validateArrayElementsImport(file, ',', mockArrayAttribute as unknown as OIBusArrayAttribute, existing);

      expect(result.elements.length).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('Element name "existing" already exists');
    });

    test('should throw validation error if delimiter mismatches', async () => {
      const file = createMockFile('');
      parseSpy.mockReturnValue({
        data: [],
        meta: { delimiter: ';' }
      } as any);

      await expect(validateArrayElementsImport(file, ',', mockArrayAttribute as unknown as OIBusArrayAttribute)).rejects.toThrow(
        /does not correspond to the file delimiter/
      );
    });

    test('should handle unflattening of nested objects', async () => {
      const attribute = {
        ...mockArrayAttribute,
        rootAttribute: {
          type: 'object',
          attributes: [
            {
              type: 'object',
              key: 'parent',
              attributes: [{ type: 'string', key: 'child' }]
            }
          ]
        }
      };

      const file = createMockFile('');
      parseSpy.mockReturnValue({
        data: [{ parent: JSON.stringify({ child: 'nested-value' }) }],
        meta: { delimiter: ',' }
      } as any);

      const result = await validateArrayElementsImport(file, ',', attribute as unknown as OIBusArrayAttribute);

      expect(result.elements[0]).toEqual({ parent: { child: 'nested-value' } });
    });

    test('should parse arrays from JSON strings', async () => {
      const attribute = {
        ...mockArrayAttribute,
        rootAttribute: {
          type: 'object',
          attributes: [{ type: 'array', key: 'list' }]
        }
      };

      const file = createMockFile('');
      parseSpy.mockReturnValue({
        data: [{ list: '[1,2,3]' }],
        meta: { delimiter: ',' }
      } as any);

      const result = await validateArrayElementsImport(file, ',', attribute as unknown as OIBusArrayAttribute);

      expect(result.elements[0]).toEqual({ list: [1, 2, 3] });
    });

    test('should report errors for invalid types (e.g. bad number)', async () => {
      const file = createMockFile('');
      parseSpy.mockReturnValue({
        data: [{ value: 'not-a-number' }],
        meta: { delimiter: ',' }
      } as any);

      const result = await validateArrayElementsImport(file, ',', mockArrayAttribute as unknown as OIBusArrayAttribute);

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('Invalid number value');
    });
  });

  describe('getElementName', () => {
    test('should return name if present', () => {
      expect(getElementName({ name: 'myName' })).toBe('myName');
    });

    test('should prioritize name over id', () => {
      expect(getElementName({ name: 'myName', id: 'myId' })).toBe('myName');
    });

    test('should return id if name missing', () => {
      expect(getElementName({ id: 'myId' })).toBe('myId');
    });

    test('should return key if name/id missing', () => {
      expect(getElementName({ key: 'myKey' })).toBe('myKey');
    });

    test('should return title if name/id/key missing', () => {
      expect(getElementName({ title: 'myTitle' })).toBe('myTitle');
    });

    test('should return fieldName if others missing', () => {
      expect(getElementName({ fieldName: 'myField' })).toBe('myField');
    });

    test('should fallback to first non-empty string value', () => {
      expect(getElementName({ other: 'fallback' })).toBe('fallback');
    });

    test('should return empty string if no suitable string found', () => {
      expect(getElementName({ val: 123 })).toBe('');
      expect(getElementName({})).toBe('');
    });
  });

  describe('findArrayAttributeInAttributes', () => {
    test('should find attribute at root level', () => {
      const attributes = [
        { type: 'string', key: 'other' },
        { type: 'array', key: 'target' }
      ];
      const result = findArrayAttributeInAttributes('target', attributes as any);
      expect(result).not.toBeNull();
      expect(result?.key).toBe('target');
    });

    test('should find attribute in nested object', () => {
      const attributes = [
        {
          type: 'object',
          key: 'wrapper',
          attributes: [{ type: 'array', key: 'target' }]
        }
      ];
      const result = findArrayAttributeInAttributes('target', attributes as any);
      expect(result).not.toBeNull();
      expect(result?.key).toBe('target');
    });

    test('should throw if key found but type is not array', () => {
      const attributes = [{ type: 'string', key: 'target' }];
      expect(() => findArrayAttributeInAttributes('target', attributes as any)).toThrow('Field "target" is not an array');
    });

    test('should return null if not found', () => {
      const attributes = [{ type: 'string', key: 'other' }];
      expect(findArrayAttributeInAttributes('missing', attributes as any)).toBeNull();
    });
  });
});
