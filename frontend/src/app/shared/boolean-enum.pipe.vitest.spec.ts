import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { BooleanEnumPipe } from './boolean-enum.pipe';

describe('BooleanEnumPipe', () => {
  test('should translate booleans', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new BooleanEnumPipe());
    expect(pipe.transform(true)).toBe('Yes');
    expect(pipe.transform(false)).toBe('No');
  });
});
