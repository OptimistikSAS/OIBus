import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DocsUrlService } from './docs-url.service';
import { WindowService } from './window.service';

describe('DocsUrlService', () => {
  let windowService: WindowService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    windowService = TestBed.inject(WindowService);
  });

  test('should resolve a fragment for the default language with no locale segment', () => {
    vi.spyOn(windowService, 'languageToUse').mockReturnValue('en');
    const service: DocsUrlService = TestBed.inject(DocsUrlService);
    expect(service.resolve('guide/x')).toBe('/documentation/docs/guide/x');
  });

  test('should not introduce a double slash when the fragment has a leading slash', () => {
    vi.spyOn(windowService, 'languageToUse').mockReturnValue('en');
    const service: DocsUrlService = TestBed.inject(DocsUrlService);
    expect(service.resolve('/guide/x')).toBe('/documentation/docs/guide/x');
    expect(service.resolve('guide/x')).toBe('/documentation/docs/guide/x');
  });

  test('should fall back to no locale prefix for a language with no bundled locale yet', () => {
    vi.spyOn(windowService, 'languageToUse').mockReturnValue('fr');
    const service: DocsUrlService = TestBed.inject(DocsUrlService);
    expect(service.resolve('guide/x')).toBe('/documentation/docs/guide/x');
  });

  test('should resolve an empty fragment to the documentation site root, not the docs section', () => {
    vi.spyOn(windowService, 'languageToUse').mockReturnValue('en');
    const service: DocsUrlService = TestBed.inject(DocsUrlService);
    expect(service.resolve('')).toBe('/documentation');
  });
});
