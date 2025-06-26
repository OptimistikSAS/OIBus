import { FormControl } from '@angular/forms';
import { uniqueFieldNamesValidator, singleTrueValidator, validateCsvHeaders } from './validators';

describe('Custom Validators', () => {
  describe('uniqueFieldNamesValidator', () => {
    it('should return null for empty array', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([]);

      expect(validator(control)).toBeNull();
    });

    it('should return null for null value', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl(null);

      expect(validator(control)).toBeNull();
    });

    it('should return null for non-array value', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl('not an array');

      expect(validator(control)).toBeNull();
    });

    it('should return null when all field names are unique', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([
        { fieldName: 'field1', type: 'string' },
        { fieldName: 'field2', type: 'string' },
        { fieldName: 'field3', type: 'string' }
      ]);

      expect(validator(control)).toBeNull();
    });

    it('should return error when field names are duplicated', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([
        { fieldName: 'field1', type: 'string' },
        { fieldName: 'field2', type: 'string' },
        { fieldName: 'field1', type: 'string' }
      ]);

      expect(validator(control)).toEqual({ duplicateFieldNames: true });
    });

    it('should ignore empty/falsy field names', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([
        { fieldName: 'field1', type: 'string' },
        { fieldName: '', type: 'string' },
        { fieldName: null, type: 'string' },
        { fieldName: 'field2', type: 'string' }
      ]);

      expect(validator(control)).toBeNull();
    });

    it('should work with different field keys', () => {
      const validator = uniqueFieldNamesValidator('customKey');
      const control = new FormControl([
        { customKey: 'value1', other: 'data' },
        { customKey: 'value2', other: 'data' },
        { customKey: 'value1', other: 'data' }
      ]);

      expect(validator(control)).toEqual({ duplicateFieldNames: true });
    });
  });

  describe('singleTrueValidator', () => {
    it('should return null for empty array', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([]);

      expect(validator(control)).toBeNull();
    });

    it('should return null for null value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl(null);

      expect(validator(control)).toBeNull();
    });

    it('should return null for non-array value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl('not an array');

      expect(validator(control)).toBeNull();
    });

    it('should return null when no items have true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: false },
        { fieldName: 'field2', useAsReference: false },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(validator(control)).toBeNull();
    });

    it('should return null when exactly one item has true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: false },
        { fieldName: 'field2', useAsReference: true },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(validator(control)).toBeNull();
    });

    it('should return error when multiple items have true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: true },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(validator(control)).toEqual({ onlyOneReference: true });
    });

    it('should return error when all items have true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: true },
        { fieldName: 'field3', useAsReference: true }
      ]);

      expect(validator(control)).toEqual({ onlyOneReference: true });
    });

    it('should work with different field keys', () => {
      const validator = singleTrueValidator('isActive');
      const control = new FormControl([
        { name: 'item1', isActive: true },
        { name: 'item2', isActive: true },
        { name: 'item3', isActive: false }
      ]);

      expect(validator(control)).toEqual({ onlyOneReference: true });
    });

    it('should handle mixed boolean values correctly', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: 'true' },
        { fieldName: 'field2', useAsReference: 1 },
        { fieldName: 'field3', useAsReference: true },
        { fieldName: 'field4', useAsReference: false }
      ]);

      expect(validator(control)).toBeNull();
    });
  });

  describe('Integration tests', () => {
    it('should work together when both validators are applied', () => {
      const uniqueValidator = uniqueFieldNamesValidator('fieldName');
      const singleTrueValidator_ = singleTrueValidator('useAsReference');

      // Valid case: unique names and single true
      const validControl = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: false },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(uniqueValidator(validControl)).toBeNull();
      expect(singleTrueValidator_(validControl)).toBeNull();

      // Invalid case: duplicate names
      const duplicateNamesControl = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field1', useAsReference: false }
      ]);

      expect(uniqueValidator(duplicateNamesControl)).toEqual({ duplicateFieldNames: true });
      expect(singleTrueValidator_(duplicateNamesControl)).toBeNull();

      // Invalid case: multiple true values
      const multipleTrueControl = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: true }
      ]);

      expect(uniqueValidator(multipleTrueControl)).toBeNull();
      expect(singleTrueValidator_(multipleTrueControl)).toEqual({ onlyOneReference: true });
    });
  });

  describe('validateCsvHeaders', () => {
    const createMockFile = (content: string): File => {
      const blob = new Blob([content], { type: 'text/csv' });
      return new File([blob], 'test.csv', { type: 'text/csv' });
    };

    describe('when expectedHeaders is empty', () => {
      it('should return null', async () => {
        const file = createMockFile('header1,header2\nvalue1,value2');
        const result = await validateCsvHeaders(file, ',', []);
        expect(result).toBeNull();
      });
    });

    describe('when file is empty', () => {
      it('should return validation error with missing headers', async () => {
        const file = createMockFile('');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toEqual({
          expectedHeaders,
          actualHeaders: [],
          missingHeaders: expectedHeaders,
          extraHeaders: []
        });
      });
    });

    describe('when file has only empty lines', () => {
      it('should return validation error with missing headers', async () => {
        const file = createMockFile('\n\n\n');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toEqual({
          expectedHeaders,
          actualHeaders: [],
          missingHeaders: expectedHeaders,
          extraHeaders: []
        });
      });
    });

    describe('when first line is empty', () => {
      it('should return validation error with missing headers', async () => {
        const file = createMockFile('   \nvalue1,value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toEqual({
          expectedHeaders,
          actualHeaders: [],
          missingHeaders: expectedHeaders,
          extraHeaders: []
        });
      });
    });

    describe('when headers match exactly', () => {
      it('should return null', async () => {
        const file = createMockFile('header1,header2\nvalue1,value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toBeNull();
      });
    });

    describe('when headers match with different order', () => {
      it('should return null', async () => {
        const file = createMockFile('header2,header1\nvalue2,value1');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toBeNull();
      });
    });

    describe('when headers have extra whitespace', () => {
      it('should trim headers and validate correctly', async () => {
        const file = createMockFile(' header1 , header2 \nvalue1,value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toBeNull();
      });
    });

    describe('when file has missing headers', () => {
      it('should return validation error with missing headers', async () => {
        const file = createMockFile('header1\nvalue1');
        const expectedHeaders = ['header1', 'header2', 'header3'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toEqual({
          expectedHeaders,
          actualHeaders: ['header1'],
          missingHeaders: ['header2', 'header3'],
          extraHeaders: []
        });
      });
    });

    describe('when file has extra headers', () => {
      it('should return validation error with extra headers', async () => {
        const file = createMockFile('header1,header2,header3\nvalue1,value2,value3');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toEqual({
          expectedHeaders,
          actualHeaders: ['header1', 'header2', 'header3'],
          missingHeaders: [],
          extraHeaders: ['header3']
        });
      });
    });

    describe('when file has both missing and extra headers', () => {
      it('should return validation error with both missing and extra headers', async () => {
        const file = createMockFile('header1,header3\nvalue1,value3');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toEqual({
          expectedHeaders,
          actualHeaders: ['header1', 'header3'],
          missingHeaders: ['header2'],
          extraHeaders: ['header3']
        });
      });
    });

    describe('when using different delimiters', () => {
      it('should handle semicolon delimiter', async () => {
        const file = createMockFile('header1;header2\nvalue1;value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ';', expectedHeaders);

        expect(result).toBeNull();
      });

      it('should handle pipe delimiter', async () => {
        const file = createMockFile('header1|header2\nvalue1|value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, '|', expectedHeaders);

        expect(result).toBeNull();
      });

      it('should handle tab delimiter', async () => {
        const file = createMockFile('header1\theader2\nvalue1\tvalue2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, '\t', expectedHeaders);

        expect(result).toBeNull();
      });
    });

    describe('when file reading fails', () => {
      it('should return validation error with missing headers', async () => {
        const mockFile = {
          text: () => Promise.reject(new Error('File read error'))
        } as unknown as File;

        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(mockFile, ',', expectedHeaders);

        expect(result).toEqual({
          expectedHeaders,
          actualHeaders: [],
          missingHeaders: expectedHeaders,
          extraHeaders: []
        });
      });
    });

    describe('edge cases', () => {
      it('should handle single header file', async () => {
        const file = createMockFile('header1\nvalue1');
        const expectedHeaders = ['header1'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toBeNull();
      });

      it('should handle empty header names', async () => {
        const file = createMockFile('header1,,header3\nvalue1,,value3');
        const expectedHeaders = ['header1', 'header3'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toEqual({
          expectedHeaders,
          actualHeaders: ['header1', '', 'header3'],
          missingHeaders: [],
          extraHeaders: ['']
        });
      });

      it('should handle case-sensitive header comparison', async () => {
        const file = createMockFile('Header1,HEADER2\nvalue1,value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toEqual({
          expectedHeaders,
          actualHeaders: ['Header1', 'HEADER2'],
          missingHeaders: ['header1', 'header2'],
          extraHeaders: ['Header1', 'HEADER2']
        });
      });
    });
  });
});
