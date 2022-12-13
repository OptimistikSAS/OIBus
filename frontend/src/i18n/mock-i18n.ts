import { ENVIRONMENT_INITIALIZER, importProvidersFrom, inject, LOCALE_ID } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams, TranslateModule, TranslateService } from '@ngx-translate/core';
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
export const provideTestingI18n = () => {
  return [
    importProvidersFrom(
      TranslateModule.forRoot({
        useDefaultLang: false,
        missingTranslationHandler: { provide: MissingTranslationHandler, useClass: CustomMissingTranslationHandler }
      })
    ),
    { provide: LOCALE_ID, useValue: 'en' },
    // ENVIRONMENT_INITIALIZER is a special token that allows us to run code when the app starts
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translateService = inject(TranslateService);
        // use the EN translations for testing
        translateService.setTranslation('en', EN_TRANSLATIONS);
        translateService.use('en');
      }
    }
  ];
};
