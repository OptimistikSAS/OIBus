import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OIBusSouthCategoryEnumPipe } from './oibus-south-category-enum.pipe';

describe('OIBusSouthCategoryEnumPipe', () => {
  test('should translate south category', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OIBusSouthCategoryEnumPipe());
    expect(pipe.transform('file')).toBe('File');
    expect(pipe.transform('iot')).toBe('IoT');
    expect(pipe.transform('database')).toBe('Database');
  });
});
