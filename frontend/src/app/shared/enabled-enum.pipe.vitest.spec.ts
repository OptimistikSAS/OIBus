import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { EnabledEnumPipe } from './enabled-enum.pipe';

describe('EnabledEnumPipe', () => {
  test('should translate enabled', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new EnabledEnumPipe());
    expect(pipe.transform(true)).toBe('active');
    expect(pipe.transform(false)).toBe('paused');
  });
});
