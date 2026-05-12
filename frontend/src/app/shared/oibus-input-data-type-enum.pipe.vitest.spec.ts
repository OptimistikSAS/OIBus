import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OibusInputDataTypeEnumPipe } from './oibus-input-data-type-enum.pipe';

describe('OIBusInputDataTypeEnumPipe', () => {
  test('should translate OIBus Input data type', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OibusInputDataTypeEnumPipe());
    expect(pipe.transform('any')).toBe('Files (for all sources)');
    expect(pipe.transform('setpoint')).toBe('Setpoints (for all sources)');
    expect(pipe.transform('time-values')).toBe('OIBus Time Values (for all sources)');
  });
});
