import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ScopeTypesEnumPipe } from './scope-types-enum.pipe';

describe('ScopeTypesEnumPipe', () => {
  test('should translate scope types', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new ScopeTypesEnumPipe());
    expect(pipe.transform('south')).toBe('South');
    expect(pipe.transform('north')).toBe('North');
    expect(pipe.transform('history-query')).toBe('History query');
    expect(pipe.transform('internal')).toBe('Internal');
  });
});
