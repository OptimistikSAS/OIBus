import { FormControl, FormGroup } from '@angular/forms';

import { describe, expect, test, vi } from 'vitest';

import {
  activationWindowValidator,
  ascendingDates,
  dateTimeRangeValidatorBuilder,
  doMqttTopicsOverlap,
  minIntervalValidator,
  mqttTopicOverlapValidator,
  singleTrueValidator,
  uniqueFieldNamesValidator,
  validateCsvHeaders,
  validateCsvMqttTopics,
  validJson,
  validRegex
} from './validators';

const csvFile = (content: string): File => new File([content], 'test.csv', { type: 'text/csv' });

const unreadableFile = (): File => {
  const file = csvFile('');
  vi.spyOn(file, 'text').mockRejectedValue(new Error('File read error'));
  return file;
};

describe('validators', () => {
  describe('minIntervalValidator', () => {
    test.each([
      { value: 5, unit: 'ms', expected: { intervalTooSmall: { min: 10 } } },
      { value: 10, unit: 'ms', expected: null },
      { value: 1, unit: 's', expected: null },
      { value: 0.001, unit: 's', expected: { intervalTooSmall: { min: 10 } } },
      { value: 1, unit: 'min', expected: null },
      { value: 1, unit: 'hour', expected: null },
      { value: '5', unit: 'ms', expected: { intervalTooSmall: { min: 10 } } },
      { value: null, unit: 'ms', expected: null },
      { value: '', unit: 'ms', expected: null },
      { value: 5, unit: null, expected: null },
      { value: 'abc', unit: 's', expected: null }
    ])('should validate $value $unit', ({ value, unit, expected }) => {
      const group = new FormGroup({ value: new FormControl<number | string | null>(value), unit: new FormControl(unit) });
      expect(minIntervalValidator(group)).toEqual(expected);
    });
  });

  describe('activationWindowValidator', () => {
    test.each([
      { label: 'an empty window', value: {}, expected: null },
      { label: 'ordered dates', value: { start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z' }, expected: null },
      { label: 'equal dates', value: { start: '2024-01-01T00:00:00Z', end: '2024-01-01T00:00:00Z' }, expected: { ascendingDates: true } },
      {
        label: 'reversed dates',
        value: { start: '2024-01-02T00:00:00Z', end: '2024-01-01T00:00:00Z' },
        expected: { ascendingDates: true }
      },
      { label: 'a start date only', value: { start: '2024-01-02T00:00:00Z' }, expected: null },
      { label: 'a time start only', value: { timeStart: '08:00' }, expected: { timeOfDayIncomplete: true } },
      { label: 'a time end only', value: { timeEnd: '18:00' }, expected: { timeOfDayIncomplete: true } },
      { label: 'equal times', value: { timeStart: '08:00', timeEnd: '08:00' }, expected: { timeOfDayEmpty: true } },
      { label: 'a time of day over midnight', value: { timeStart: '22:00', timeEnd: '06:00' }, expected: null }
    ])('should validate $label', ({ value, expected }) => {
      const group = new FormGroup({
        start: new FormControl<string | null>(null),
        end: new FormControl<string | null>(null),
        timeStart: new FormControl<string | null>(null),
        timeEnd: new FormControl<string | null>(null)
      });
      group.patchValue(value);
      expect(activationWindowValidator(group)).toEqual(expected);
    });
  });

  describe('validRegex', () => {
    test.each([
      { value: '^[a-z]+$', expected: null },
      { value: '', expected: null },
      { value: '[a-z', expected: { invalidRegex: true } },
      { value: '(unclosed', expected: { invalidRegex: true } }
    ])('should validate the regex $value', ({ value, expected }) => {
      expect(validRegex(new FormControl(value))).toEqual(expected);
    });
  });

  describe('validJson', () => {
    test.each([
      { value: '{"a": [1, 2]}', expected: null },
      { value: '42', expected: null },
      { value: '', expected: null },
      { value: null, expected: null },
      { value: '{a: 1}', expected: { invalidJson: true } },
      { value: '{"a": 1', expected: { invalidJson: true } }
    ])('should validate the JSON $value', ({ value, expected }) => {
      expect(validJson(new FormControl(value))).toEqual(expected);
    });
  });

  describe('ascendingDates', () => {
    test.each([
      { start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z', expected: null },
      { start: '2024-01-01T00:00:00Z', end: '2024-01-01T00:00:00Z', expected: null },
      { start: '2024-01-02T00:00:00Z', end: '2024-01-01T00:00:00Z', expected: { ascendingDates: true } },
      { start: null, end: '2024-01-01T00:00:00Z', expected: null },
      { start: '2024-01-02T00:00:00Z', end: null, expected: null }
    ])('should validate the range from $start to $end', ({ start, end, expected }) => {
      const group = new FormGroup({ start: new FormControl(start), end: new FormControl(end) });
      expect(ascendingDates(group)).toEqual(expected);
    });
  });

  describe('dateTimeRangeValidatorBuilder', () => {
    test.each([
      { startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T11:00:00Z', start: null, end: null },
      // dates are compared to the minute
      { startTime: '2024-01-01T10:00:50Z', endTime: '2024-01-01T10:00:10Z', start: null, end: null },
      {
        startTime: '2024-01-01T11:00:00Z',
        endTime: '2024-01-01T10:00:00Z',
        start: { badStartDateRange: true },
        end: { badEndDateRange: true }
      },
      { startTime: null, endTime: '2024-01-01T10:00:00Z', start: null, end: null },
      { startTime: '2024-01-01T10:00:00Z', endTime: null, start: null, end: null }
    ])('should validate the range from $startTime to $endTime', ({ startTime, endTime, start, end }) => {
      const group = new FormGroup({
        startTime: new FormControl(startTime, dateTimeRangeValidatorBuilder('start')),
        endTime: new FormControl(endTime, dateTimeRangeValidatorBuilder('end'))
      });
      group.controls.startTime.updateValueAndValidity();
      group.controls.endTime.updateValueAndValidity();

      expect(group.controls.startTime.errors).toEqual(start);
      expect(group.controls.endTime.errors).toEqual(end);
    });

    test('should not validate a control without parent', () => {
      expect(dateTimeRangeValidatorBuilder('start')(new FormControl('2024-01-01T10:00:00Z'))).toBeNull();
    });
  });

  describe('uniqueFieldNamesValidator', () => {
    const validator = uniqueFieldNamesValidator('fieldName');

    test.each([
      { label: 'an empty array', value: [], expected: null },
      { label: 'null', value: null, expected: null },
      { label: 'a non-array value', value: 'not an array', expected: null },
      { label: 'unique names', value: [{ fieldName: 'a' }, { fieldName: 'b' }], expected: null },
      { label: 'empty names', value: [{ fieldName: '' }, { fieldName: '' }, { fieldName: null }, {}], expected: null },
      {
        label: 'duplicated names',
        value: [{ fieldName: 'a' }, { fieldName: 'b' }, { fieldName: 'a' }],
        expected: { duplicateFieldNames: true }
      }
    ])('should validate $label', ({ value, expected }) => {
      expect(validator(new FormControl<unknown>(value))).toEqual(expected);
    });

    test('should check the given field', () => {
      const value = [
        { fieldName: 'a', name: 'x' },
        { fieldName: 'b', name: 'x' }
      ];
      expect(uniqueFieldNamesValidator('name')(new FormControl(value))).toEqual({ duplicateFieldNames: true });
      expect(validator(new FormControl(value))).toBeNull();
    });
  });

  describe('singleTrueValidator', () => {
    const validator = singleTrueValidator('useAsReference');

    test.each([
      { label: 'an empty array', value: [], expected: null },
      { label: 'null', value: null, expected: null },
      { label: 'a non-array value', value: 'not an array', expected: null },
      { label: 'no true value', value: [{ useAsReference: false }, {}], expected: null },
      { label: 'a single true value', value: [{ useAsReference: true }, { useAsReference: false }], expected: null },
      { label: 'truthy non-boolean values', value: [{ useAsReference: 'true' }, { useAsReference: 1 }], expected: null },
      { label: 'several true values', value: [{ useAsReference: true }, { useAsReference: true }], expected: { onlyOneReference: true } }
    ])('should validate $label', ({ value, expected }) => {
      expect(validator(new FormControl<unknown>(value))).toEqual(expected);
    });
  });

  describe('validateCsvHeaders', () => {
    const expectedHeaders = ['name', 'enabled'];
    const missingAll = { expectedHeaders, actualHeaders: [], missingHeaders: expectedHeaders, extraHeaders: [] };

    test('should not validate when no header is expected', async () => {
      await expect(validateCsvHeaders(csvFile('anything'), ',', [])).resolves.toBeNull();
    });

    test.each([
      { label: 'an empty file', content: '' },
      { label: 'a file with empty lines', content: '\n\n' },
      { label: 'a file with an empty first line', content: '   \nname,enabled' }
    ])('should report all the headers as missing for $label', async ({ content }) => {
      await expect(validateCsvHeaders(csvFile(content), ',', expectedHeaders)).resolves.toEqual(missingAll);
    });

    test('should report all the headers as missing when the file cannot be read', async () => {
      await expect(validateCsvHeaders(unreadableFile(), ',', expectedHeaders)).resolves.toEqual(missingAll);
    });

    test.each([
      { label: 'the exact headers', content: 'name,enabled\nitem,true', delimiter: ',' },
      { label: 'headers in another order', content: 'enabled,name', delimiter: ',' },
      { label: 'headers with whitespace', content: ' name , enabled ', delimiter: ',' },
      { label: 'optional headers', content: 'name,enabled,scanMode', delimiter: ',' },
      { label: 'a semicolon delimiter', content: 'name;enabled', delimiter: ';' },
      { label: 'a pipe delimiter', content: 'name|enabled', delimiter: '|' },
      { label: 'a tab delimiter', content: 'name\tenabled', delimiter: '\t' }
    ])('should accept $label', async ({ content, delimiter }) => {
      await expect(validateCsvHeaders(csvFile(content), delimiter, expectedHeaders, ['scanMode'])).resolves.toBeNull();
    });

    test.each([
      { label: 'missing headers', content: 'name', missingHeaders: ['enabled'], extraHeaders: [] },
      { label: 'extra headers', content: 'name,enabled,other', missingHeaders: [], extraHeaders: ['other'] },
      { label: 'missing and extra headers', content: 'name,other', missingHeaders: ['enabled'], extraHeaders: ['other'] },
      { label: 'headers of another case', content: 'Name,enabled', missingHeaders: ['name'], extraHeaders: ['Name'] },
      { label: 'empty headers', content: 'name,,enabled', missingHeaders: [], extraHeaders: [''] }
    ])('should report $label', async ({ content, missingHeaders, extraHeaders }) => {
      await expect(validateCsvHeaders(csvFile(content), ',', expectedHeaders)).resolves.toEqual({
        expectedHeaders,
        actualHeaders: content.split(',').map(header => header.trim()),
        missingHeaders,
        extraHeaders
      });
    });
  });

  describe('doMqttTopicsOverlap', () => {
    test.each([
      { topic1: '/oibus/counter', topic2: '/oibus/counter', expected: true },
      { topic1: '/oibus/counter', topic2: '/oibus/#', expected: true },
      { topic1: '/oibus/#', topic2: '/oibus/counter', expected: true },
      { topic1: '/oibus/counter', topic2: '/oibus/+', expected: true },
      { topic1: '/oibus/+', topic2: '/oibus/counter', expected: true },
      { topic1: 'oibus/a/b', topic2: 'oibus/+/#', expected: true },
      { topic1: 'topic', topic2: '#', expected: true },
      { topic1: '', topic2: '', expected: true },
      { topic1: '/oibus/counter', topic2: '/other/topic', expected: false },
      { topic1: '/oibus/counter', topic2: '/oibus/other', expected: false },
      { topic1: '/oibus/a/b', topic2: '/oibus/+', expected: false },
      { topic1: 'oibus', topic2: 'oibus/+/#', expected: false },
      { topic1: 'other/a/b', topic2: 'oibus/+/#', expected: false }
    ])('should check if $topic1 and $topic2 overlap: $expected', ({ topic1, topic2, expected }) => {
      expect(doMqttTopicsOverlap(topic1, topic2)).toBe(expected);
    });
  });

  describe('mqttTopicOverlapValidator', () => {
    const validator = mqttTopicOverlapValidator(['/oibus/counter', '/factory/#', '/plant/+/temperature']);

    test.each([
      { topic: '/other/topic', expected: null },
      { topic: '/oibus/counter', expected: { mqttTopicOverlap: { conflictingTopics: '/oibus/counter' } } },
      { topic: '/factory/line1', expected: { mqttTopicOverlap: { conflictingTopics: '/factory/#' } } },
      { topic: '/plant/a/temperature', expected: { mqttTopicOverlap: { conflictingTopics: '/plant/+/temperature' } } },
      { topic: '/plant/a/pressure', expected: null },
      { topic: '#', expected: { mqttTopicOverlap: { conflictingTopics: '/oibus/counter, /factory/#, /plant/+/temperature' } } },
      { topic: '', expected: null },
      { topic: '   ', expected: null },
      { topic: null, expected: null },
      { topic: 42, expected: null }
    ])('should validate the topic $topic', ({ topic, expected }) => {
      expect(validator(new FormControl<unknown>(topic))).toEqual(expected);
    });

    test('should accept any topic when there is no existing topic', () => {
      expect(mqttTopicOverlapValidator([])(new FormControl('/oibus/counter'))).toBeNull();
    });
  });

  describe('validateCsvMqttTopics', () => {
    test.each([
      { label: 'there is no conflict', content: 'name,settings_topic\ntest,/oibus/counter', existing: ['/other/#'] },
      { label: 'there is no settings_topic column', content: 'name,enabled\ntest,true', existing: ['#'] },
      { label: 'the file is empty', content: '', existing: ['#'] },
      { label: 'the file only has headers', content: 'name,settings_topic', existing: ['#'] },
      { label: 'the topics are empty', content: 'name,settings_topic\ntest,\ntest2', existing: ['#'] }
    ])('should not report a conflict when $label', async ({ content, existing }) => {
      await expect(validateCsvMqttTopics(csvFile(content), ',', existing)).resolves.toBeNull();
    });

    test('should report the topics conflicting with existing topics', async () => {
      const file = csvFile('name,settings_topic\ntest,/oibus/counter\ntest2,/other/topic');

      await expect(validateCsvMqttTopics(file, ',', ['/oibus/#'])).resolves.toEqual({
        topicErrors: [{ conflictingTopics: ['/oibus/counter'] }]
      });
    });

    test('should report the topics conflicting within the file', async () => {
      const file = csvFile('name;settings_topic\ntest1;/oibus/#\ntest2;/oibus/counter');

      await expect(validateCsvMqttTopics(file, ';')).resolves.toEqual({
        topicErrors: [{ conflictingTopics: ['/oibus/#', '/oibus/counter'] }]
      });
    });

    test('should not report a conflict when the file cannot be read', async () => {
      await expect(validateCsvMqttTopics(unreadableFile(), ',', ['#'])).resolves.toBeNull();
    });
  });
});
