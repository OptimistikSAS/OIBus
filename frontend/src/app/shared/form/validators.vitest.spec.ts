import { FormControl } from '@angular/forms';
import {
  uniqueFieldNamesValidator,
  singleTrueValidator,
  validateCsvHeaders,
  doMqttTopicsOverlap,
  mqttTopicOverlapValidator,
  validateCsvMqttTopics
} from './validators';
import { describe, expect, test } from 'vitest';

describe('Custom Validators', () => {
  describe('uniqueFieldNamesValidator', () => {
    test('should return null for empty array', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([]);

      expect(validator(control)).toBeNull();
    });

    test('should return null for null value', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl(null);

      expect(validator(control)).toBeNull();
    });

    test('should return null for non-array value', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl('not an array');

      expect(validator(control)).toBeNull();
    });

    test('should return null when all field names are unique', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([
        { fieldName: 'field1', type: 'string' },
        { fieldName: 'field2', type: 'string' },
        { fieldName: 'field3', type: 'string' }
      ]);

      expect(validator(control)).toBeNull();
    });

    test('should return error when field names are duplicated', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([
        { fieldName: 'field1', type: 'string' },
        { fieldName: 'field2', type: 'string' },
        { fieldName: 'field1', type: 'string' }
      ]);

      expect(validator(control)).toEqual({ duplicateFieldNames: true });
    });

    test('should ignore empty/falsy field names', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([
        { fieldName: 'field1', type: 'string' },
        { fieldName: '', type: 'string' },
        { fieldName: null, type: 'string' },
        { fieldName: 'field2', type: 'string' }
      ]);

      expect(validator(control)).toBeNull();
    });

    test('should work with different field keys', () => {
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
    test('should return null for empty array', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([]);

      expect(validator(control)).toBeNull();
    });

    test('should return null for null value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl(null);

      expect(validator(control)).toBeNull();
    });

    test('should return null for non-array value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl('not an array');

      expect(validator(control)).toBeNull();
    });

    test('should return null when no items have true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: false },
        { fieldName: 'field2', useAsReference: false },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(validator(control)).toBeNull();
    });

    test('should return null when exactly one item has true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: false },
        { fieldName: 'field2', useAsReference: true },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(validator(control)).toBeNull();
    });

    test('should return error when multiple items have true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: true },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(validator(control)).toEqual({ onlyOneReference: true });
    });

    test('should return error when all items have true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: true },
        { fieldName: 'field3', useAsReference: true }
      ]);

      expect(validator(control)).toEqual({ onlyOneReference: true });
    });

    test('should work with different field keys', () => {
      const validator = singleTrueValidator('isActive');
      const control = new FormControl([
        { name: 'item1', isActive: true },
        { name: 'item2', isActive: true },
        { name: 'item3', isActive: false }
      ]);

      expect(validator(control)).toEqual({ onlyOneReference: true });
    });

    test('should handle mixed boolean values correctly', () => {
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
    test('should work together when both validators are applied', () => {
      const uniqueValidator = uniqueFieldNamesValidator('fieldName');
      const singleTrueValidator_ = singleTrueValidator('useAsReference');

      const validControl = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: false },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(uniqueValidator(validControl)).toBeNull();
      expect(singleTrueValidator_(validControl)).toBeNull();

      const duplicateNamesControl = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field1', useAsReference: false }
      ]);

      expect(uniqueValidator(duplicateNamesControl)).toEqual({ duplicateFieldNames: true });
      expect(singleTrueValidator_(duplicateNamesControl)).toBeNull();

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
      test('should return null', async () => {
        const file = createMockFile('header1,header2\nvalue1,value2');
        const result = await validateCsvHeaders(file, ',', []);
        expect(result).toBeNull();
      });
    });

    describe('when file is empty', () => {
      test('should return validation error with missing headers', async () => {
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
      test('should return validation error with missing headers', async () => {
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
      test('should return validation error with missing headers', async () => {
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
      test('should return null', async () => {
        const file = createMockFile('header1,header2\nvalue1,value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toBeNull();
      });
    });

    describe('when headers match with different order', () => {
      test('should return null', async () => {
        const file = createMockFile('header2,header1\nvalue2,value1');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toBeNull();
      });
    });

    describe('when headers have extra whitespace', () => {
      test('should trim headers and validate correctly', async () => {
        const file = createMockFile(' header1 , header2 \nvalue1,value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toBeNull();
      });
    });

    describe('when file has missing headers', () => {
      test('should return validation error with missing headers', async () => {
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
      test('should return validation error with extra headers', async () => {
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
      test('should return validation error with both missing and extra headers', async () => {
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
      test('should handle semicolon delimiter', async () => {
        const file = createMockFile('header1;header2\nvalue1;value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, ';', expectedHeaders);

        expect(result).toBeNull();
      });

      test('should handle pipe delimiter', async () => {
        const file = createMockFile('header1|header2\nvalue1|value2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, '|', expectedHeaders);

        expect(result).toBeNull();
      });

      test('should handle tab delimiter', async () => {
        const file = createMockFile('header1\theader2\nvalue1\tvalue2');
        const expectedHeaders = ['header1', 'header2'];
        const result = await validateCsvHeaders(file, '\t', expectedHeaders);

        expect(result).toBeNull();
      });
    });

    describe('when file reading fails', () => {
      test('should return validation error with missing headers', async () => {
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
      test('should handle single header file', async () => {
        const file = createMockFile('header1\nvalue1');
        const expectedHeaders = ['header1'];
        const result = await validateCsvHeaders(file, ',', expectedHeaders);

        expect(result).toBeNull();
      });

      test('should handle empty header names', async () => {
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

      test('should handle case-sensitive header comparison', async () => {
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

  describe('MQTT Topic Validation', () => {
    describe('doMqttTopicsOverlap', () => {
      test('should return true for identical topics', () => {
        expect(doMqttTopicsOverlap('/oibus/counter', '/oibus/counter')).toBe(true);
      });

      test('should return true for overlapping wildcard patterns', () => {
        expect(doMqttTopicsOverlap('/oibus/counter', '/oibus/#')).toBe(true);
        expect(doMqttTopicsOverlap('/oibus/#', '/oibus/counter')).toBe(true);
        expect(doMqttTopicsOverlap('/oibus/counter', '/oibus/+')).toBe(true);
        expect(doMqttTopicsOverlap('/oibus/+', '/oibus/counter')).toBe(true);
      });

      test('should return false for non-overlapping topics', () => {
        expect(doMqttTopicsOverlap('/oibus/counter', '/other/topic')).toBe(false);
        expect(doMqttTopicsOverlap('/oibus/counter', '/oibus/other')).toBe(false);
      });

      test('should handle edge cases', () => {
        expect(doMqttTopicsOverlap('', '')).toBe(true);
        expect(doMqttTopicsOverlap('topic', 'topic')).toBe(true);
        expect(doMqttTopicsOverlap('topic', '#')).toBe(true);
      });
    });

    describe('mqttTopicOverlapValidator', () => {
      test('should return null when no conflicts exist', () => {
        const existingTopics = ['/oibus/counter', '/other/topic'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl('/different/topic');

        expect(validator(control)).toBeNull();
      });

      test('should return error when conflict exists', () => {
        const existingTopics = ['/oibus/counter', '/oibus/#'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl('/oibus/temperature');

        const result = validator(control);
        expect(result).toEqual({
          mqttTopicOverlap: {
            conflictingTopics: '/oibus/#'
          }
        });
      });

      test('should return error for multiple conflicts', () => {
        const existingTopics = ['/oibus/+', '/oibus/#'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl('/oibus/counter');

        const result = validator(control);
        expect(result).toEqual({
          mqttTopicOverlap: {
            conflictingTopics: '/oibus/+, /oibus/#'
          }
        });
      });

      test('should return null for empty current topic', () => {
        const existingTopics = ['/oibus/counter'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl('');

        expect(validator(control)).toBeNull();
      });

      test('should return null for null current topic', () => {
        const existingTopics = ['/oibus/counter'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl(null);

        expect(validator(control)).toBeNull();
      });

      test('should return null for whitespace-only topic', () => {
        const existingTopics = ['/oibus/counter'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl('   ');

        expect(validator(control)).toBeNull();
      });

      test('should handle non-string current topic', () => {
        const existingTopics = ['/oibus/counter'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl(123);

        expect(validator(control)).toBeNull();
      });

      test('should handle empty existing topics array', () => {
        const validator = mqttTopicOverlapValidator([]);
        const control = new FormControl('/oibus/counter');

        expect(validator(control)).toBeNull();
      });

      test('should handle wildcard patterns correctly', () => {
        const existingTopics = ['/oibus/+'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl('/oibus/counter');

        const result = validator(control);
        expect(result).toEqual({
          mqttTopicOverlap: {
            conflictingTopics: '/oibus/+'
          }
        });
      });

      test('should handle multi-level wildcard patterns', () => {
        const existingTopics = ['/oibus/#'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl('/oibus/counter/value');

        const result = validator(control);
        expect(result).toEqual({
          mqttTopicOverlap: {
            conflictingTopics: '/oibus/#'
          }
        });
      });

      test('should not conflict with non-overlapping wildcards', () => {
        const existingTopics = ['/other/+'];
        const validator = mqttTopicOverlapValidator(existingTopics);
        const control = new FormControl('/oibus/counter');

        expect(validator(control)).toBeNull();
      });
    });
  });

  describe('validateCsvMqttTopics', () => {
    const createMockFile = (content: string): File => {
      const blob = new Blob([content], { type: 'text/csv' });
      return new File([blob], 'test.csv', { type: 'text/csv' });
    };

    test('should return null when no existing MQTT topics', async () => {
      const file = createMockFile('name,settings_topic\ntest,/oibus/counter');
      const result = await validateCsvMqttTopics(file, ',', []);
      expect(result).toBeNull();
    });

    test('should return null when no settings_topic column', async () => {
      const file = createMockFile('name,enabled\ntest,true');
      const result = await validateCsvMqttTopics(file, ',', ['/existing/topic']);
      expect(result).toBeNull();
    });

    test('should detect conflicts with existing topics', async () => {
      const file = createMockFile('name,settings_topic\ntest,/oibus/counter');
      const result = await validateCsvMqttTopics(file, ',', ['/oibus/#']);

      expect(result).toBeTruthy();
      expect(result?.topicErrors[0].conflictingTopics).toContain('/oibus/counter');
    });

    test('should detect conflicts within CSV file', async () => {
      const file = createMockFile('name,settings_topic\ntest1,/oibus/#\ntest2,/oibus/counter');
      const result = await validateCsvMqttTopics(file, ',', []);

      expect(result).toBeTruthy();
      expect(result?.topicErrors[0].conflictingTopics).toContain('/oibus/#');
      expect(result?.topicErrors[0].conflictingTopics).toContain('/oibus/counter');
    });

    test('should handle empty CSV file', async () => {
      const file = createMockFile('');
      const result = await validateCsvMqttTopics(file, ',', ['/existing/topic']);
      expect(result).toBeNull();
    });

    test('should handle file reading error', async () => {
      const mockFile = {
        text: () => Promise.reject(new Error('File read error'))
      } as unknown as File;

      const result = await validateCsvMqttTopics(mockFile, ',', ['/existing/topic']);
      expect(result).toBeNull();
    });
  });
});
