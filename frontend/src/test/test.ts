import { expect } from 'vitest';
import { BrowserPage, Locator, locators } from 'vitest/browser';
import { LocalDate } from '../../../backend/shared/model/types';

expect.extend({
  toHaveDisplayedDate(received: Element, expected: string) {
    const inputs = received.querySelectorAll<HTMLInputElement>('input');
    const date = inputs[0];
    const hours = inputs[1];
    const minutes = inputs[2];
    const seconds = inputs.length > 3 ? inputs[3] : null;
    const dateValue = date?.value;
    const hourValue = hours?.value;
    const minuteValue = minutes?.value;
    let value: string | null = null;
    if (dateValue && hourValue && minuteValue) {
      value = `${dateValue} ${hourValue}:${minuteValue}`;
      if (seconds) {
        value += `:${seconds.value}`;
      }
    }
    const { isNot } = this;
    return {
      pass: value === expected,
      message: () => `Date displayed ${value} is${isNot ? ' not' : ''} the expected date ${expected}`
    };
  }
});

locators.extend({
  getByCss(selector: string) {
    return selector;
  },

  async fillWithDate(this: BrowserPage | Locator, date: LocalDate, hour = '00', minute = '00', second = '00') {
    const inputs = this.getByCss('input');
    const dateInput = inputs.nth(0);
    const hoursInput = inputs.nth(1);
    const minutesInput = inputs.nth(2);
    const inputElements = inputs.elements();
    const secondsInput = inputElements.length > 3 ? inputs.nth(3) : null;

    await dateInput.fill(date);
    await hoursInput.fill(hour);
    hoursInput.element().dispatchEvent(new Event('change', { bubbles: true }));
    await minutesInput.fill(minute);
    minutesInput.element().dispatchEvent(new Event('change', { bubbles: true }));

    if (secondsInput != null) {
      await secondsInput.fill(second);
      secondsInput.element().dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
});

declare module 'vitest/browser' {
  interface LocatorSelectors {
    getByCss(selector: string): Locator;

    /**
     * Fill the date and time inputs in an oib-datetimepicker.
     * await page.getByCss('#start').fillWithDate('2024-12-25', '10', '30', '00');
     */
    fillWithDate(this: BrowserPage | Locator, date: LocalDate, hour?: string, minute?: string, second?: string): Promise<void>;
  }
}

interface CustomMatchers<R = unknown> {
  /**
   * Check the date displayed by an oib-datetimepicker.
   * expect(page.getByCss('#start')).toHaveDisplayedDate('2024-12-25 10:30:00');
   */
  toHaveDisplayedDate: (date: string) => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
