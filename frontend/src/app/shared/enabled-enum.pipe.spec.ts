import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { TranslateService } from '@ngx-translate/core';
import { EnabledEnumPipe } from './enabled-enum.pipe';

describe('EnabledEnumPipe', () => {
  let pipe: EnabledEnumPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    pipe = new EnabledEnumPipe(TestBed.inject(TranslateService));
  });

  it('should translate enabled', () => {
    expect(pipe.transform(true)).toBe('active');
    expect(pipe.transform(false)).toBe('paused');
  });
});
