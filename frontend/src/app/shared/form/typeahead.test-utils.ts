import { TYPEAHEAD_DEBOUNCE_TIME } from './typeahead';
import { vi } from 'vitest';
import { Locator, page } from 'vitest/browser';

/**
 * A custom locator helper used to test a typeahead.
 * It takes care of advancing the debounce timer, making the test easier to write.
 *
 * You can create it directly from the selector of a typeahead input,
 * or from an existing input locator.
 */
export class TestTypeahead {
  constructor(private readonly input: Locator) {
    if (!(input.element() instanceof HTMLInputElement)) {
      throw new Error('A test typeahead must wrap an input, but the provided element is not one');
    }
  }

  /**
   * Fills the input with the given text,
   * then advances fake timers for the necessary debounce time.
   * It returns the TypeaheadTester,
   * allowing to chain another method like `tester.myInput.fillWith('test').selectLabel('test')`.
   */
  async fillWith(text: string) {
    await this.input.fill(text);
    await vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_TIME);
    return this;
  }

  /**
   * Dispatches a 'Press Enter' event on the input, then advances fake timers for the necessary debounce time.
   */
  async pressEnter() {
    const pressEnterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true
    });
    this.input.element().dispatchEvent(pressEnterEvent);
    await vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_TIME);
  }

  /**
   * Closes the selections by pressing escape
   */
  async closeSelection() {
    const escape = {
      key: 'Escape',
      code: 'Escape',
      which: 27,
      keyCode: 27,
      bubbles: true
    };
    const escapeDownEvent = new KeyboardEvent('keydown', escape);
    const escapeUpEvent = new KeyboardEvent('keyup', escape);
    this.input.element().dispatchEvent(escapeDownEvent);
    this.input.element().dispatchEvent(escapeUpEvent);
    await vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_TIME);
  }

  /**
   * Returns the typeahead suggestions.
   */
  get suggestions(): Locator {
    return page.getByRole('option');
  }

  /**
   * Returns the typeahead suggestion labels,
   * making it easy to assert what are the suggestions displayed.
   */
  get suggestionLabels(): Array<string> {
    return this.suggestionElements.map(suggestion => suggestion.textContent!);
  }

  /**
   * Selects the suggestion with the given index,
   * or throws if it cannot be found.
   * Triggers the tick and change detection.
   */
  async selectIndex(index: number) {
    const suggestions = this.suggestionElements;
    if (index >= suggestions.length) {
      throw new Error(`Trying to select suggestion with index ${index} but there are only ${suggestions.length} suggestions`);
    }
    await this.suggestions.nth(index).click();
    await vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_TIME);
  }

  /**
   * Selects the suggestion with the given label,
   * or throws if it cannot be find.
   * Triggers the tick and change detection.
   */
  async selectLabel(label: string) {
    const index = this.suggestionElements.findIndex(availableSuggestion => availableSuggestion.textContent === label);
    if (index === -1) {
      throw new Error(
        `Trying to select suggestion with label ${label} but the only suggestions available are: ${this.suggestionLabels.join(', ')}`
      );
    }
    await this.suggestions.nth(index).click();
    await vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_TIME);
  }

  private get suggestionElements() {
    return this.suggestions.elements();
  }
}
