import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { CsvCharacterEnumPipe } from './csv-character-enum.pipe';

describe('CsvCharacterEnumPipe', () => {
  test('should translate csv character', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new CsvCharacterEnumPipe());
    expect(pipe.transform('TAB')).toBe('Tab');
    expect(pipe.transform('NON_BREAKING_SPACE')).toBe('Space');
    expect(pipe.transform('COMMA')).toBe('Comma ,');
    expect(pipe.transform('COLON')).toBe('Colon :');
    expect(pipe.transform('SEMI_COLON')).toBe('Semi colon ;');
    expect(pipe.transform('SLASH')).toBe('Slash /');
    expect(pipe.transform('DOT')).toBe('Dot .');
    expect(pipe.transform('PIPE')).toBe('Pipe |');
  });
});
