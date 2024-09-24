/**
 * Utility to test an enum pipe
 */
import { BaseEnumPipe } from './base-enum-pipe';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';

export function testEnumPipe<T extends string>(factory: () => BaseEnumPipe<T>, expectedTranslations: Partial<Record<T, string>>) {
  TestBed.configureTestingModule({
    providers: [provideI18nTesting()]
  });

  const pipe = TestBed.runInInjectionContext(() => factory());
  Object.entries(expectedTranslations).forEach(entry => {
    expect(pipe.transform(entry[0] as T)).toBe(entry[1]);
  });
}
