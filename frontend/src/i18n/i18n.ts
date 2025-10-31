import { inject, LOCALE_ID, provideEnvironmentInitializer } from '@angular/core';
import { provideTranslateService, provideTranslateLoader, TranslateService } from '@ngx-translate/core';
import { ModuleTranslateLoader } from './module-translate-loader';

import { DEFAULT_TZ, Language, Timezone } from '../../../backend/shared/model/types';

const languageKey = 'oibus-language';
const timezoneKey = 'oibus-timezone';

/**
 * Retrieves the language from the local storage or return 'en'.
 */
export function languageToUse(): Language {
  return (localStorage.getItem(languageKey) || 'en') as Language;
}

export function storeLanguage(language: Language) {
  localStorage.setItem(languageKey, language);
}

export function timezoneToUse(): Timezone {
  return localStorage.getItem(timezoneKey) || DEFAULT_TZ;
}

export function storeTimezone(timezone: Timezone) {
  localStorage.setItem(timezoneKey, timezone);
}

/**
 * Returns the necessary providers for i18n from ngx-translate.
 * Gets the locale to use from local storage on startup.
 */
export const provideI18n = () => {
  return [
    provideTranslateService({
      loader: provideTranslateLoader(ModuleTranslateLoader)
    }),
    { provide: LOCALE_ID, useValue: languageToUse() },
    // provideEnvironmentInitializer allows us to run code when the app starts
    provideEnvironmentInitializer(() => {
      const translateService = inject(TranslateService);
      // this language will be used as a fallback when a translation isn't found in the current language
      translateService.setFallbackLang('en');
      // the lang to use, if the lang isn't available, it will use the current loader to get them
      const locale = inject(LOCALE_ID);
      translateService.use(locale);
    })
  ];
};
