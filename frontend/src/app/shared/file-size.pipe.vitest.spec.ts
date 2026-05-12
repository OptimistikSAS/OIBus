import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { FileSizePipe } from './file-size.pipe';

describe('FileSizePipe', () => {
  test('should display correct size', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new FileSizePipe());
    expect(pipe.transform(1024 * 1024 * 1024)).toBe('1024.0 MB');
    expect(pipe.transform(1025)).toBe('1.0 kB');
    expect(pipe.transform(10)).toBe('10 B');
  });
});
