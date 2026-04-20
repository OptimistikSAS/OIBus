import { Locator, locators } from 'vitest/browser';

locators.extend({
  getByCss(selector: string) {
    return selector;
  }
});

declare module 'vitest/browser' {
  interface LocatorSelectors {
    getByCss(selector: string): Locator;
  }
}
