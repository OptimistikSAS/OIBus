import { importProvidersFrom, inject, LOCALE_ID, provideEnvironmentInitializer } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams, provideTranslateService, TranslateService } from '@ngx-translate/core';
import EN_TRANSLATIONS from './en.json';

/**
 * Custom missing translation handler that throws an error when a translation is missing.
 */
export class CustomMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams) {
    throw new Error(`Missing translation for key ${params.key}`);
  }
}

/**
 * Returns the necessary providers for i18n from ngx-translate to use in a test.
 * Uses the EN locale and a custom missing translation handler that throws an error.
 */
export const provideI18nTesting = () => {
  return [
    provideTranslateService({
      useDefaultLang: false,
      missingTranslationHandler: { provide: MissingTranslationHandler, useClass: CustomMissingTranslationHandler }
    }),
    { provide: LOCALE_ID, useValue: 'en' },
    // provideEnvironmentInitializer allows us to run code when the app starts
    provideEnvironmentInitializer(() => {
      const translateService = inject(TranslateService);
      // use the EN translations for testing
      translateService.setTranslation('en', EN_TRANSLATIONS);
      translateService.use('en');
    })
  ];
};
