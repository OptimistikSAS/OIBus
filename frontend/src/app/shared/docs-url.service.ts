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
 * Docusaurus doesn't prefix the default locale in its generated URLs. 'fr' docs are now bundled
 * (documentation/docusaurus.config.js's i18n.locales includes 'fr', with translated content under
 * documentation/i18n/fr/), so French UI users get French docs. Chinese docs translation is
 * tracked as a separate, follow-up issue - any UI language without a bundled docs locale here
 * falls back to the default (no prefix) segment below until its docs are bundled the same way
 * 'fr' just was.
 */
const LOCALE_SEGMENTS: Partial<Record<Language, string>> = {
  en: '',
  fr: 'fr'
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
   * An empty fragment resolves to the documentation site's root (its homepage), not the docs
   * section - used for the navbar's general "open the docs" link.
   *
   * Docusaurus's docs plugin is configured with routeBasePath: '/docs' (see
   * documentation/docusaurus.config.js), and its i18n URL structure is
   * '/<locale>/docs/<fragment>' (locale segment omitted for the default locale) - so a non-empty
   * fragment needs the 'docs' segment inserted between the locale segment and the fragment.
   */
  resolve(fragment: string): string {
    const localeSegment = LOCALE_SEGMENTS[this.windowService.languageToUse()] ?? DEFAULT_LOCALE_SEGMENT;
    const trimmedFragment = fragment.replace(/^\/+/, '');
    const docsSegment = trimmedFragment.length > 0 ? 'docs' : '';

    return [DOCUMENTATION_BASE_PATH, localeSegment, docsSegment, trimmedFragment].filter(part => part.length > 0).join('/');
  }
}
