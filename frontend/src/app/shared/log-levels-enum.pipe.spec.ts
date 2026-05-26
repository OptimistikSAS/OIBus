import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { LogLevelsEnumPipe } from './log-levels-enum.pipe';

describe('LogLevelsEnumPipe', () => {
  test('should translate log levels', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new LogLevelsEnumPipe());
    expect(pipe.transform('silent')).toBe('Silent');
    expect(pipe.transform('error')).toBe('Error');
    expect(pipe.transform('warn')).toBe('Warning');
    expect(pipe.transform('info')).toBe('Info');
    expect(pipe.transform('debug')).toBe('Debug');
    expect(pipe.transform('trace')).toBe('Trace');
  });
});
