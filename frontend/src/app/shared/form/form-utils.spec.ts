import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { FormUtils } from './form-utils';
import {
  OIBusObjectAttribute,
  OIBusStringAttribute,
  OIBusNumberAttribute,
  OIBusBooleanAttribute,
  OIBusScanModeAttribute,
  OIBusCertificateAttribute,
  OIBusTimezoneAttribute,
  OIBusInstantAttribute,
  OIBusSecretAttribute,
  OIBusCodeAttribute,
  OIBusStringSelectAttribute,
  OIBusArrayAttribute
} from '../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

describe('FormUtils', () => {
  let translateService: TranslateService;
  let mockScanModes: Array<ScanModeDTO>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
    translateService = TestBed.inject(TranslateService);

    mockScanModes = [
      { id: 'scanModeId1', name: 'Scan Mode 1', description: 'First scan mode', cron: '* * * * * *' },
      { id: 'scanModeId2', name: 'Scan Mode 2', description: 'Second scan mode', cron: '0 * * * * *' }
    ];
  });

  describe('buildColumn', () => {
    it('should build columns for simple attributes', () => {
      const attribute: OIBusObjectAttribute = {
        type: 'object',
        key: 'testObject',
        translationKey: 'test.object',
        attributes: [
          {
            type: 'string',
            key: 'name',
            translationKey: 'test.name',
            defaultValue: null,
            validators: [],
            displayProperties: {
              displayInViewMode: true,
              row: 0,
              columns: 4
            }
          } as OIBusStringAttribute,
          {
            type: 'number',
            key: 'age',
            translationKey: 'test.age',
            defaultValue: null,
            unit: null,
            validators: [],
            displayProperties: {
              displayInViewMode: true,
              row: 0,
              columns: 4
            }
          } as OIBusNumberAttribute
        ],
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      };

      const result = FormUtils.buildColumn(attribute.attributes, []);

      expect(result).toEqual([
        { path: ['name'], type: 'string', translationKey: 'test.name' },
        { path: ['age'], type: 'number', translationKey: 'test.age' }
      ]);
    });

    it('should build columns for nested object attributes', () => {
      const attribute: OIBusObjectAttribute = {
        type: 'object',
        key: 'parent',
        translationKey: 'test.parent',
        attributes: [
          {
            type: 'object',
            key: 'child',
            translationKey: 'test.child',
            attributes: [
              {
                type: 'string',
                key: 'name',
                translationKey: 'test.child.name',
                defaultValue: null,
                validators: [],
                displayProperties: {
                  displayInViewMode: true,
                  row: 0,
                  columns: 4
                }
              } as OIBusStringAttribute
            ],
            enablingConditions: [],
            validators: [],
            displayProperties: {
              visible: true,
              wrapInBox: false
            }
          }
        ],
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      };

      const result = FormUtils.buildColumn(attribute.attributes, []);

      expect(result).toEqual([{ path: ['child', 'name'], type: 'string', translationKey: 'test.child.name' }]);
    });

    it('should filter out attributes not displayed in view mode', () => {
      const attribute: OIBusObjectAttribute = {
        type: 'object',
        key: 'testObject',
        translationKey: 'test.object',
        attributes: [
          {
            type: 'string',
            key: 'visibleField',
            translationKey: 'test.visible',
            defaultValue: null,
            validators: [],
            displayProperties: {
              displayInViewMode: true,
              row: 0,
              columns: 4
            }
          } as OIBusStringAttribute,
          {
            type: 'string',
            key: 'hiddenField',
            translationKey: 'test.hidden',
            defaultValue: null,
            validators: [],
            displayProperties: {
              displayInViewMode: false,
              row: 0,
              columns: 4
            }
          } as OIBusStringAttribute
        ],
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      };

      const result = FormUtils.buildColumn(attribute.attributes, []);

      expect(result).toEqual([{ path: ['visibleField'], type: 'string', translationKey: 'test.visible' }]);
    });

    it('should handle array attributes by returning empty array', () => {
      const attribute: OIBusObjectAttribute = {
        type: 'object',
        key: 'testObject',
        translationKey: 'test.object',
        attributes: [
          {
            type: 'array',
            key: 'arrayField',
            translationKey: 'test.array',
            paginate: false,
            numberOfElementPerPage: 10,
            validators: [],
            rootAttribute: {
              type: 'object',
              key: 'item',
              translationKey: 'test.array.item',
              attributes: [],
              enablingConditions: [],
              validators: [],
              displayProperties: {
                visible: true,
                wrapInBox: false
              }
            }
          } as OIBusArrayAttribute
        ],
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      };

      const result = FormUtils.buildColumn(attribute.attributes, []);

      expect(result).toEqual([]);
    });

    it('should handle all supported attribute types', () => {
      const attribute: OIBusObjectAttribute = {
        type: 'object',
        key: 'testObject',
        translationKey: 'test.object',
        attributes: [
          {
            type: 'scan-mode',
            key: 'scanMode',
            translationKey: 'test.scan-mode',
            acceptableType: 'POLL',
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusScanModeAttribute,
          {
            type: 'certificate',
            key: 'cert',
            translationKey: 'test.cert',
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusCertificateAttribute,
          {
            type: 'timezone',
            key: 'tz',
            translationKey: 'test.tz',
            defaultValue: null,
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusTimezoneAttribute,
          {
            type: 'boolean',
            key: 'bool',
            translationKey: 'test.bool',
            defaultValue: false,
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusBooleanAttribute,
          {
            type: 'instant',
            key: 'inst',
            translationKey: 'test.inst',
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusInstantAttribute,
          {
            type: 'number',
            key: 'num',
            translationKey: 'test.num',
            defaultValue: null,
            unit: null,
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusNumberAttribute,
          {
            type: 'secret',
            key: 'sec',
            translationKey: 'test.sec',
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusSecretAttribute,
          {
            type: 'string',
            key: 'str',
            translationKey: 'test.str',
            defaultValue: null,
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusStringAttribute,
          {
            type: 'code',
            key: 'code',
            translationKey: 'test.code',
            contentType: 'json',
            defaultValue: null,
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusCodeAttribute,
          {
            type: 'string-select',
            key: 'select',
            translationKey: 'test.select',
            selectableValues: ['option1', 'option2'],
            defaultValue: null,
            validators: [],
            displayProperties: { displayInViewMode: true, row: 0, columns: 4 }
          } as OIBusStringSelectAttribute
        ],
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      };

      const result = FormUtils.buildColumn(attribute.attributes, []);

      expect(result.length).toBe(9);
      expect(result[0]).toEqual({ path: ['scanMode'], type: 'scan-mode', translationKey: 'test.scan-mode' });
      expect(result[8]).toEqual({ path: ['select'], type: 'string-select', translationKey: 'test.select' });
    });
  });

  describe('formatValue', () => {
    const testElement = {
      name: 'John Doe',
      age: 30,
      isActive: true,
      scanModeId: 'scanModeId1',
      selectValue: 'option1',
      nested: {
        value: 'nested value'
      }
    };

    it('should format string values', () => {
      const result = FormUtils.formatValue(testElement, ['name'], 'string', 'test.name', translateService, mockScanModes);
      expect(result).toBe('John Doe');
    });

    it('should format number values', () => {
      const result = FormUtils.formatValue(testElement, ['age'], 'number', 'test.age', translateService, mockScanModes);
      expect(result).toBe(30);
    });

    it('should format boolean values with translation', () => {
      const result = FormUtils.formatValue(testElement, ['isActive'], 'boolean', 'test.boolean', translateService, mockScanModes);
      expect(result).toBe('Yes');
    });

    it('should format scan-mode values by finding the name', () => {
      const result = FormUtils.formatValue(testElement, ['scanModeId'], 'scan-mode', 'test.scan-mode', translateService, mockScanModes);
      expect(result).toBe('Scan Mode 1');
    });

    it('should format string-select values with translation', () => {
      // Mock the translation service to return a specific value
      spyOn(translateService, 'instant').and.returnValue('Option 1');
      const result = FormUtils.formatValue(testElement, ['selectValue'], 'string-select', 'test.select', translateService, mockScanModes);
      expect(result).toBe('Option 1');
    });

    it('should return empty string for object and array types', () => {
      const objectResult = FormUtils.formatValue(testElement, ['nested'], 'object', 'test.object', translateService, mockScanModes);
      const arrayResult = FormUtils.formatValue(testElement, ['arrayField'], 'array', 'test.array', translateService, mockScanModes);

      expect(objectResult).toBe('');
      expect(arrayResult).toBe('');
    });

    it('should return empty string for undefined values', () => {
      const result = FormUtils.formatValue(testElement, ['nonExistentField'], 'string', 'test.string', translateService, mockScanModes);
      expect(result).toBe('');
    });

    it('should handle nested path values', () => {
      const result = FormUtils.formatValue(
        testElement,
        ['nested', 'value'],
        'string',
        'test.nested.value',
        translateService,
        mockScanModes
      );
      expect(result).toBe('nested value');
    });

    it('should handle all supported types', () => {
      const testData = {
        stringVal: 'test string',
        numberVal: 42,
        booleanVal: false,
        codeVal: 'console.log("test")',
        timezoneVal: 'Europe/Paris',
        instantVal: '2023-01-01T00:00:00Z'
      };

      expect(FormUtils.formatValue(testData, ['stringVal'], 'string', 'test.string', translateService, mockScanModes)).toBe('test string');
      expect(FormUtils.formatValue(testData, ['numberVal'], 'number', 'test.number', translateService, mockScanModes)).toBe(42);
      expect(FormUtils.formatValue(testData, ['booleanVal'], 'boolean', 'test.boolean', translateService, mockScanModes)).toBe('No');
      expect(FormUtils.formatValue(testData, ['codeVal'], 'code', 'test.code', translateService, mockScanModes)).toBe(
        'console.log("test")'
      );
      expect(FormUtils.formatValue(testData, ['timezoneVal'], 'timezone', 'test.timezone', translateService, mockScanModes)).toBe(
        'Europe/Paris'
      );
      expect(FormUtils.formatValue(testData, ['instantVal'], 'instant', 'test.instant', translateService, mockScanModes)).toBe(
        '2023-01-01T00:00:00Z'
      );
    });
  });

  describe('getValueByPath', () => {
    const testObject = {
      level1: {
        level2: {
          level3: 'deep value',
          array: [1, 2, 3]
        },
        simple: 'simple value'
      },
      direct: 'direct value'
    };

    it('should get direct property values', () => {
      const result = FormUtils.getValueByPath(testObject, ['direct']);
      expect(result).toBe('direct value');
    });

    it('should get nested property values', () => {
      const result = FormUtils.getValueByPath(testObject, ['level1', 'simple']);
      expect(result).toBe('simple value');
    });

    it('should get deeply nested property values', () => {
      const result = FormUtils.getValueByPath(testObject, ['level1', 'level2', 'level3']);
      expect(result).toBe('deep value');
    });

    it('should return undefined for non-existent paths', () => {
      const result = FormUtils.getValueByPath(testObject, ['nonExistent']);
      expect(result).toBeUndefined();
    });

    it('should return undefined for partially non-existent paths', () => {
      const result = FormUtils.getValueByPath(testObject, ['level1', 'nonExistent']);
      expect(result).toBeUndefined();
    });

    it('should handle empty path', () => {
      const result = FormUtils.getValueByPath(testObject, []);
      expect(result).toBe(testObject);
    });

    it('should handle null and undefined objects', () => {
      expect(FormUtils.getValueByPath(null, ['path'])).toBeNull();
      expect(FormUtils.getValueByPath(undefined, ['path'])).toBeUndefined();
    });

    it('should handle array access', () => {
      const result = FormUtils.getValueByPath(testObject, ['level1', 'level2', 'array', '0']);
      expect(result).toBe(1);
    });
  });

  describe('integration tests', () => {
    it('should work together for a complete column building and value formatting scenario', () => {
      const complexAttribute: OIBusObjectAttribute = {
        type: 'object',
        key: 'user',
        translationKey: 'test.user',
        attributes: [
          {
            type: 'string',
            key: 'name',
            translationKey: 'test.user.name',
            defaultValue: null,
            validators: [],
            displayProperties: {
              displayInViewMode: true,
              row: 0,
              columns: 4
            }
          } as OIBusStringAttribute,
          {
            type: 'number',
            key: 'age',
            translationKey: 'test.user.age',
            defaultValue: null,
            unit: null,
            validators: [],
            displayProperties: {
              displayInViewMode: true,
              row: 0,
              columns: 4
            }
          } as OIBusNumberAttribute,
          {
            type: 'object',
            key: 'address',
            translationKey: 'test.user.address',
            attributes: [
              {
                type: 'string',
                key: 'city',
                translationKey: 'test.user.address.city',
                defaultValue: null,
                validators: [],
                displayProperties: {
                  displayInViewMode: true,
                  row: 0,
                  columns: 4
                }
              } as OIBusStringAttribute
            ],
            enablingConditions: [],
            validators: [],
            displayProperties: {
              visible: true,
              wrapInBox: false
            }
          }
        ],
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      };

      const testData = {
        name: 'John Doe',
        age: 30,
        address: {
          city: 'Paris'
        }
      };

      // Build columns
      const columns = FormUtils.buildColumn(complexAttribute.attributes, []);

      expect(columns.length).toBe(3);
      expect(columns[0]).toEqual({ path: ['name'], type: 'string', translationKey: 'test.user.name' });
      expect(columns[1]).toEqual({ path: ['age'], type: 'number', translationKey: 'test.user.age' });
      expect(columns[2]).toEqual({ path: ['address', 'city'], type: 'string', translationKey: 'test.user.address.city' });

      // Format values using the columns
      const nameValue = FormUtils.formatValue(
        testData,
        columns[0].path,
        columns[0].type,
        columns[0].translationKey,
        translateService,
        mockScanModes
      );
      const ageValue = FormUtils.formatValue(
        testData,
        columns[1].path,
        columns[1].type,
        columns[1].translationKey,
        translateService,
        mockScanModes
      );
      const cityValue = FormUtils.formatValue(
        testData,
        columns[2].path,
        columns[2].type,
        columns[2].translationKey,
        translateService,
        mockScanModes
      );

      expect(nameValue).toBe('John Doe');
      expect(ageValue).toBe(30);
      expect(cityValue).toBe('Paris');
    });
  });
});
