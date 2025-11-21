import Papa from 'papaparse';
import {
  convertCsvDelimiter,
  exportArrayElements,
  validateArrayElementsImport,
  getElementName,
  findArrayAttributeInAttributes
} from './csv.utils';

import { OIBusArrayAttribute } from '../../../../../backend/shared/model/form.model';

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
    it('should convert CSV characters to their delimiter counterpart', () => {
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
    let unparseSpy: jasmine.Spy;

    beforeEach(() => {
      unparseSpy = spyOn(Papa, 'unparse').and.returnValue('csv-content');
    });

    it('should flatten elements and return a Blob', () => {
      const arrayItems = [
        { name: 'test1', value: 100 },
        { name: 'test2', value: 200 }
      ];
      const delimiter = ',';

      const result = exportArrayElements(mockArrayAttribute as unknown as OIBusArrayAttribute, arrayItems, delimiter);

      expect(result instanceof Blob).toBeTrue();
      expect(result.type).toBe('text/csv');

      // Verify unparse was called with flattened data
      expect(unparseSpy).toHaveBeenCalled();
      const [data, config] = unparseSpy.calls.mostRecent().args;
      expect(config).toEqual({ columns: jasmine.arrayContaining(['name', 'value']), delimiter });
      expect(data).toEqual([
        { name: 'test1', value: 100 },
        { name: 'test2', value: 200 }
      ]);
    });

    it('should flatten nested objects', () => {
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

      const [data, config] = unparseSpy.calls.mostRecent().args;
      expect(config.delimiter).toBe(';');
      // The key should be joined with underscore
      expect(data[0]['nested_prop']).toBe('val');
    });

    it('should stringify arrays and objects within special fields', () => {
      const arrayAttributeWithComplex = {
        ...mockArrayAttribute,
        rootAttribute: {
          ...mockArrayAttribute.rootAttribute,
          attributes: [
            { type: 'array' as const, key: 'list' },
            { type: 'object' as const, key: 'obj_field' }
            // Note: 'obj_field' here mimics a case where recursion stops or it's handled by default
          ]
        }
      };

      // To trigger the recursion stop for 'object' type in your code:
      // It recurses if (value && typeof value === 'object' && !Array.isArray(value)).
      // If we pass an array to an 'object' type field, it hits the else block: flattened[fullKey] = value.

      // Let's test the explicit 'array' type case which does JSON.stringify
      const arrayItems = [{ list: [1, 2], obj_field: { a: 1 } }];

      // We need to ensure the attribute definition matches so the switch case hits 'array'
      // and for 'object' it hits recursion.

      exportArrayElements(arrayAttributeWithComplex as unknown as OIBusArrayAttribute, arrayItems, ',');

      const [data] = unparseSpy.calls.mostRecent().args;
      expect(data[0]['list']).toBe('[1,2]');
    });

    it('should handle recursion for nested objects', () => {
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

      const [data] = unparseSpy.calls.mostRecent().args;
      expect(data[0]['level1_level2']).toBe('final');
    });
  });

  describe('validateArrayElementsImport', () => {
    let parseSpy: jasmine.Spy;

    beforeEach(() => {
      parseSpy = spyOn(Papa, 'parse').and.returnValue({
        data: [],
        meta: { delimiter: ',' }
      } as any);
    });

    const createMockFile = (content: string) => new File([content], 'test.csv', { type: 'text/csv' });

    it('should validate and import CSV content', async () => {
      const csvContent = 'name,value\ntest1,100';
      const file = createMockFile(csvContent);
      parseSpy.and.returnValue({
        data: [{ name: 'test1', value: '100' }],
        meta: { delimiter: ',' }
      } as any);

      const result = await validateArrayElementsImport(file, ',', mockArrayAttribute as unknown as OIBusArrayAttribute);

      expect(result.elements.length).toBe(1);
      expect(result.elements[0]).toEqual({ name: 'test1', value: 100 }); // Number conversion
      expect(result.errors.length).toBe(0);
    });

    it('should detect duplicate names in CSV', async () => {
      const file = createMockFile('');
      parseSpy.and.returnValue({
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

    it('should detect names existing in current list', async () => {
      const file = createMockFile('');
      parseSpy.and.returnValue({
        data: [{ name: 'existing' }],
        meta: { delimiter: ',' }
      } as any);

      const existing = [{ name: 'existing' }];
      const result = await validateArrayElementsImport(file, ',', mockArrayAttribute as unknown as OIBusArrayAttribute, existing);

      expect(result.elements.length).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('Element name "existing" already exists');
    });

    it('should throw validation error if delimiter mismatches', async () => {
      const file = createMockFile('');
      parseSpy.and.returnValue({
        data: [],
        meta: { delimiter: ';' } // File detected as semi-colon
      } as any);

      await expectAsync(validateArrayElementsImport(file, ',', mockArrayAttribute as unknown as OIBusArrayAttribute)).toBeRejectedWithError(
        /does not correspond to the file delimiter/
      );
    });

    it('should handle unflattening of nested objects', async () => {
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
      parseSpy.and.returnValue({
        data: [{ parent_child: 'nested-value' }],
        meta: { delimiter: ',' }
      } as any);

      const result = await validateArrayElementsImport(file, ',', attribute as unknown as OIBusArrayAttribute);

      expect(result.elements[0]).toEqual({ parent: { child: 'nested-value' } });
    });

    it('should parse arrays from JSON strings', async () => {
      const attribute = {
        ...mockArrayAttribute,
        rootAttribute: {
          type: 'object',
          attributes: [{ type: 'array', key: 'list' }]
        }
      };

      const file = createMockFile('');
      parseSpy.and.returnValue({
        data: [{ list: '[1,2,3]' }],
        meta: { delimiter: ',' }
      } as any);

      const result = await validateArrayElementsImport(file, ',', attribute as unknown as OIBusArrayAttribute);

      expect(result.elements[0]).toEqual({ list: [1, 2, 3] });
    });

    it('should report errors for invalid types (e.g. bad number)', async () => {
      const file = createMockFile('');
      parseSpy.and.returnValue({
        data: [{ value: 'not-a-number' }],
        meta: { delimiter: ',' }
      } as any);

      const result = await validateArrayElementsImport(file, ',', mockArrayAttribute as unknown as OIBusArrayAttribute);

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('Invalid number value');
    });
  });

  describe('getElementName', () => {
    it('should return name if present', () => {
      expect(getElementName({ name: 'myName' })).toBe('myName');
    });

    it('should prioritize name over id', () => {
      expect(getElementName({ name: 'myName', id: 'myId' })).toBe('myName');
    });

    it('should return id if name missing', () => {
      expect(getElementName({ id: 'myId' })).toBe('myId');
    });

    it('should return key if name/id missing', () => {
      expect(getElementName({ key: 'myKey' })).toBe('myKey');
    });

    it('should return title if name/id/key missing', () => {
      expect(getElementName({ title: 'myTitle' })).toBe('myTitle');
    });

    it('should return fieldName if others missing', () => {
      expect(getElementName({ fieldName: 'myField' })).toBe('myField');
    });

    it('should fallback to first non-empty string value', () => {
      expect(getElementName({ other: 'fallback' })).toBe('fallback');
    });

    it('should return empty string if no suitable string found', () => {
      expect(getElementName({ val: 123 })).toBe('');
      expect(getElementName({})).toBe('');
    });
  });

  describe('findArrayAttributeInAttributes', () => {
    it('should find attribute at root level', () => {
      const attributes = [
        { type: 'string', key: 'other' },
        { type: 'array', key: 'target' }
      ];
      const result = findArrayAttributeInAttributes('target', attributes as any);
      expect(result).not.toBeNull();
      expect(result?.key).toBe('target');
    });

    it('should find attribute in nested object', () => {
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

    it('should throw if key found but type is not array', () => {
      const attributes = [{ type: 'string', key: 'target' }];
      expect(() => findArrayAttributeInAttributes('target', attributes as any)).toThrowError('Field "target" is not an array');
    });

    it('should return null if not found', () => {
      const attributes = [{ type: 'string', key: 'other' }];
      expect(findArrayAttributeInAttributes('missing', attributes as any)).toBeNull();
    });
  });
});
