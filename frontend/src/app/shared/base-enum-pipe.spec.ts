/**
 * Utility to test an enum pipe
 */
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { TestBed } from '@angular/core/testing';
import { MockI18nModule } from '../../i18n/mock-i18n.spec';

export function testEnumPipe<T extends string>(
  factory: (translateService: TranslateService) => BaseEnumPipe<T>,
  expectedTranslations: Partial<Record<T, string>>
) {
  TestBed.configureTestingModule({
    imports: [MockI18nModule]
  });

  const pipe = factory(TestBed.inject(TranslateService));
  Object.entries(expectedTranslations).forEach(entry => {
    expect(pipe.transform(entry[0] as T)).toBe(entry[1]);
  });
}
