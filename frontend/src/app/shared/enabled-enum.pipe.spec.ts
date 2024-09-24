import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { EnabledEnumPipe } from './enabled-enum.pipe';

describe('EnabledEnumPipe', () => {
  let pipe: EnabledEnumPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    pipe = TestBed.runInInjectionContext(() => new EnabledEnumPipe());
  });

  it('should translate enabled', () => {
    expect(pipe.transform(true)).toBe('active');
    expect(pipe.transform(false)).toBe('paused');
  });
});
