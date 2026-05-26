import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OIBusNorthCategoryEnumPipe } from './oibus-north-category-enum.pipe';

describe('OIBusNorthCategoryEnumPipe', () => {
  test('should translate north category', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OIBusNorthCategoryEnumPipe());
    expect(pipe.transform('debug')).toBe('Debug');
    expect(pipe.transform('file')).toBe('File');
    expect(pipe.transform('api')).toBe('API');
    expect(pipe.transform('iot')).toBe('IoT');
  });
});
