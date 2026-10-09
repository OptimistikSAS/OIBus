import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, test } from 'vitest';

import { OIBusAttribute, OIBusAttributeType, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { FormUtils } from './form-utils';

/** Builds a displayable attribute of the given type, displayed in view mode unless specified */
const attr = (type: Exclude<OIBusAttributeType, 'object' | 'array'>, key: string, displayInViewMode = true): OIBusAttribute => {
  const base = { key, translationKey: `test.${key}`, validators: [], displayProperties: { row: 0, columns: 4, displayInViewMode } };
  switch (type) {
    case 'string':
    case 'code':
    case 'timezone':
      return type === 'code' ? { ...base, type, contentType: 'json', defaultValue: null } : { ...base, type, defaultValue: null };
    case 'string-select':
      return { ...base, type, selectableValues: [], defaultValue: null };
    case 'number':
      return { ...base, type, unit: null, defaultValue: null };
    case 'boolean':
      return { ...base, type, defaultValue: false };
    case 'scan-mode':
      return { ...base, type, acceptableType: 'POLL' };
    case 'secret':
    case 'instant':
    case 'certificate':
      return { ...base, type };
    default:
      throw new Error(`Unsupported type ${type}`);
  }
};

const objectAttr = (key: string, attributes: Array<OIBusAttribute>): OIBusObjectAttribute => ({
  type: 'object',
  key,
  translationKey: `test.${key}`,
  validators: [],
  attributes,
  enablingConditions: [],
  displayProperties: { visible: true, wrapInBox: false }
});

describe('FormUtils', () => {
  describe('buildColumn', () => {
    test('should build a column per attribute displayed in view mode, flattening the objects', () => {
      const attributes: Array<OIBusAttribute> = [
        attr('string', 'name'),
        attr('number', 'port'),
        attr('string', 'hidden', false),
        attr('code', 'query'),
        attr('secret', 'password'),
        objectAttr('nested', [attr('boolean', 'enabled'), objectAttr('deep', [attr('timezone', 'timezone')])]),
        {
          type: 'array',
          key: 'array',
          translationKey: 'test.array',
          validators: [],
          paginate: false,
          numberOfElementPerPage: 20,
          rootAttribute: objectAttr('item', [attr('string', 'itemName')])
        }
      ];

      expect(FormUtils.buildColumn(attributes, ['prefix'])).toEqual([
        { path: ['prefix', 'name'], type: 'string', translationKey: 'test.name' },
        { path: ['prefix', 'port'], type: 'number', translationKey: 'test.port' },
        { path: ['prefix', 'password'], type: 'secret', translationKey: 'test.password' },
        { path: ['prefix', 'nested', 'enabled'], type: 'boolean', translationKey: 'test.enabled' },
        { path: ['prefix', 'nested', 'deep', 'timezone'], type: 'timezone', translationKey: 'test.timezone' }
      ]);
    });

    test('should build no column without attribute', () => {
      expect(FormUtils.buildColumn([], [])).toEqual([]);
    });
  });

  describe('formatValue', () => {
    let translateService: TranslateService;
    const element = {
      name: 'my name',
      port: 8080,
      enabled: true,
      disabled: false,
      type: 'iso-string',
      scanModeId: 'scanModeId2',
      unknownScanModeId: 'unknown',
      settings: { nested: { value: 'nested value' } }
    };
    const selectTranslationKey = 'configuration.oibus.manifest.south.items.mssql.tracking-instant.date-time-input.type';

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
      translateService = TestBed.inject(TranslateService);
    });

    test.each([
      { label: 'a string', path: ['name'], type: 'string', translationKey: '', expected: 'my name' },
      { label: 'a code', path: ['name'], type: 'code', translationKey: '', expected: 'my name' },
      { label: 'a timezone', path: ['name'], type: 'timezone', translationKey: '', expected: 'my name' },
      { label: 'an instant', path: ['name'], type: 'instant', translationKey: '', expected: 'my name' },
      { label: 'a number', path: ['port'], type: 'number', translationKey: '', expected: 8080 },
      { label: 'a nested value', path: ['settings', 'nested', 'value'], type: 'string', translationKey: '', expected: 'nested value' },
      { label: 'a true boolean', path: ['enabled'], type: 'boolean', translationKey: '', expected: 'Yes' },
      { label: 'a false boolean', path: ['disabled'], type: 'boolean', translationKey: '', expected: 'No' },
      { label: 'a string-select', path: ['type'], type: 'string-select', translationKey: selectTranslationKey, expected: 'ISO String' },
      { label: 'a scan mode by its name', path: ['scanModeId'], type: 'scan-mode', translationKey: '', expected: 'scanMode2' },
      { label: 'an unknown scan mode', path: ['unknownScanModeId'], type: 'scan-mode', translationKey: '', expected: undefined },
      { label: 'an object', path: ['settings'], type: 'object', translationKey: '', expected: '' },
      { label: 'an array', path: ['settings'], type: 'array', translationKey: '', expected: '' },
      { label: 'a missing value', path: ['missing'], type: 'string', translationKey: '', expected: '' },
      { label: 'a missing nested value', path: ['missing', 'value'], type: 'string', translationKey: '', expected: '' }
    ] satisfies Array<{ label: string; path: Array<string>; type: OIBusAttributeType; translationKey: string; expected: unknown }>)(
      'should format $label',
      ({ path, type, translationKey, expected }) => {
        expect(FormUtils.formatValue(element, path, type, translationKey, translateService, testData.scanMode.list)).toBe(expected);
      }
    );
  });

  describe('getValueByPath', () => {
    test.each([
      { label: 'a top-level value', obj: { a: 1 }, path: ['a'], expected: 1 },
      { label: 'a nested value', obj: { a: { b: { c: 'deep' } } }, path: ['a', 'b', 'c'], expected: 'deep' },
      { label: 'the object itself for an empty path', obj: { a: 1 }, path: [], expected: { a: 1 } },
      { label: 'undefined for a missing value', obj: { a: 1 }, path: ['b', 'c'], expected: undefined },
      { label: 'null for a null object', obj: null, path: ['a'], expected: null }
    ])('should return $label', ({ obj, path, expected }) => {
      expect(FormUtils.getValueByPath(obj, path)).toEqual(expected);
    });
  });
});
