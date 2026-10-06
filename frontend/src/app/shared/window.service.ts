import { Service } from '@angular/core';

import { Language, Timezone } from '@oibus/shared/common/types';

import { languageToUse, storeLanguage, storeTimezone, timezoneToUse } from '../../i18n/i18n';

/**
 * Service wrapping the window object to ease testing
 */
@Service()
export class WindowService {
  getStorageItem(key: string): string | null {
    return window.localStorage.getItem(key);
  }

  setStorageItem(key: string, value: string): void {
    return window.localStorage.setItem(key, value);
  }

  removeStorageItem(key: string) {
    return window.localStorage.removeItem(key);
  }

  getHistoryState(): Record<string, unknown> | null;
  getHistoryState<T>(key: string): T | null;
  getHistoryState(key?: string) {
    if (key) {
      return window.history.state[key] ?? null;
    } else {
      return window.history.state;
    }
  }

  reload() {
    window.location.reload();
  }

  languageToUse(): Language {
    return languageToUse();
  }

  storeLanguage(language: Language) {
    storeLanguage(language);
  }

  openInNewTab(url: string) {
    window.open(url);
  }

  redirectTo(url: string) {
    window.location.href = url;
  }

  timezoneToUse() {
    return timezoneToUse();
  }

  storeTimezone(timezone: Timezone) {
    storeTimezone(timezone);
  }
}
