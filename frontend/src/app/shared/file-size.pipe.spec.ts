import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { TranslateService } from '@ngx-translate/core';
import { FileSizePipe } from './file-size.pipe';

describe('FileSizePipe', () => {
  let pipe: FileSizePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    pipe = new FileSizePipe(TestBed.inject(TranslateService));
  });

  it('should display correct size', () => {
    expect(pipe.transform(1024 * 1024 * 1024)).toBe('1024.0 MB');
    expect(pipe.transform(1025)).toBe('1.0 kB');
    expect(pipe.transform(10)).toBe('10 B');
  });
});
