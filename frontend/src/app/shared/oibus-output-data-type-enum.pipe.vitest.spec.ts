import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OibusOutputDataTypeEnumPipe } from './oibus-output-data-type-enum.pipe';

describe('OibusOutputDataTypeEnumPipe', () => {
  test('should translate OIBus Output data type', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OibusOutputDataTypeEnumPipe());
    expect(pipe.transform('any')).toBe('Any');
    expect(pipe.transform('mqtt')).toBe('MQTT');
    expect(pipe.transform('modbus')).toBe('Modbus');
    expect(pipe.transform('oianalytics')).toBe('OIAnalytics optimized time values');
    expect(pipe.transform('opcua')).toBe('OPCUA');
    expect(pipe.transform('time-values')).toBe('OIBus time values');
  });
});
