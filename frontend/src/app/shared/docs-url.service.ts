import { Service, inject } from '@angular/core';
import { Language } from '../../../../backend/shared/model/types';
import { WindowService } from './window.service';

/**
 * Base path under which the embedded documentation is served by the backend (see
 * backend/src/web-server/web-server.ts). It's a relative path so it works whether OIBus is
 * served directly or behind a reverse proxy.
 */
const DOCUMENTATION_BASE_PATH = '/documentation';

/**
 * Docusaurus doesn't prefix the default locale in its generated URLs. Today only 'en' is
 * bundled (i18n.locales is still just ['en']); other locales (fr, zh, ...) are a separate,
 * follow-up issue. This mapping is where a real locale prefix gets added once it exists, without
 * touching the rest of the resolution logic.
 */
const LOCALE_SEGMENTS: Partial<Record<Language, string>> = {
  en: ''
};
const DEFAULT_LOCALE_SEGMENT = '';

/**
 * Resolves in-app help links to the locally embedded documentation, instead of the public
 * documentation site.
 */
@Service()
export class DocsUrlService {
  private windowService = inject(WindowService);

  /**
   * Builds a URL to the embedded documentation for the given fragment (e.g.
   * 'guide/north-connectors/opcua'), using the current UI language to resolve the locale segment.
   */
  resolve(fragment: string): string {
    const localeSegment = LOCALE_SEGMENTS[this.windowService.languageToUse()] ?? DEFAULT_LOCALE_SEGMENT;
    const trimmedFragment = fragment.replace(/^\/+/, '');

    return [DOCUMENTATION_BASE_PATH, localeSegment, trimmedFragment].filter(part => part.length > 0).join('/');
  }
}
