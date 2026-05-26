import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OIBusTransformerLanguageEnumPipe } from './oibus-transformer-language-enum.pipe';

describe('OIBusTransformerLanguageEnumPipe', () => {
  test('should translate transformer language', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OIBusTransformerLanguageEnumPipe());
    expect(pipe.transform('javascript')).toBe('JavaScript');
    expect(pipe.transform('typescript')).toBe('TypeScript');
  });
});
