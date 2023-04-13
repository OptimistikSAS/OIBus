import { ComponentTester, TestButton, TestInput } from 'ngx-speculoos';
import { tick } from '@angular/core/testing';
import { TYPEAHEAD_DEBOUNCE_TIME } from './typeahead';
import { DebugElement } from '@angular/core';

/**
 * A custom TestInput used to test a typeahead.
 * It takes care of triggering the change detection and necessary ticks,
 * making the test easier to write. The test still needs to be wrapped in a `fakeAsync` function though.
 * This behaves like a TestInput, so all usual custom matchers work.
 *
 * You can create it directly from the selector of a typeahead input,
 * or from a TestInput.
 */
export class TestTypeahead extends TestInput {
  constructor(tester: ComponentTester<any>, debugElement: DebugElement) {
    super(tester, debugElement);
    if (!(debugElement.nativeElement instanceof HTMLInputElement)) {
      throw new Error('A test typeahead must wrap an input, but the provided element is not one');
    }
  }

  /**
   * Fills the input with the given text,
   * then ticks for the necessary debounce time.
   * It returns the TypeaheadTEster,
   * allowing to chain another method like `tester.myInput.fillWith('test').selectLabel('test')`.
   */
  override fillWith(text: string): TestTypeahead {
    super.fillWith(text);
    tick(TYPEAHEAD_DEBOUNCE_TIME);
    this.tester.detectChanges();
    return this;
  }

  /**
   * Dispatches a 'Press Enter' event on the input,
   * then ticks for the necessary debounce time.
   */
  pressEnter() {
    const pressEnterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true
    });
    this.dispatchEvent(pressEnterEvent);
    tick(TYPEAHEAD_DEBOUNCE_TIME);
    this.tester.detectChanges();
  }

  /**
   * Closes the selections by pressing escape
   */
  closeSelection() {
    const escape = {
      key: 'Escape',
      code: 'Escape',
      which: 27,
      keyCode: 27,
      bubbles: true
    };
    const escapeDownEvent = new KeyboardEvent('keydown', escape);
    const escapeUpEvent = new KeyboardEvent('keyup', escape);
    this.dispatchEvent(escapeDownEvent);
    this.dispatchEvent(escapeUpEvent);
  }

  /**
   * Returns the typeahead suggestions (as TestButtons)
   */
  get suggestions(): Array<TestButton> {
    return this.elements('ngb-typeahead-window.dropdown-menu button.dropdown-item') as Array<TestButton>;
  }

  /**
   * Returns the typeahead suggestion labels,
   * making it easy to assert what are the suggestions displayed.
   */
  get suggestionLabels(): Array<string> {
    return this.suggestions.map(suggestion => suggestion.textContent as string);
  }

  /**
   * Selects the suggestion with the given index,
   * or throws if it cannot be found.
   * Triggers the tick and change detection.
   */
  selectIndex(index: number) {
    const suggestions = this.suggestions;
    if (index >= suggestions.length) {
      throw new Error(`Trying to select suggestion with index ${index} but there are only ${suggestions.length} suggestions`);
    }
    suggestions[index].click();
    tick(TYPEAHEAD_DEBOUNCE_TIME);
    this.tester.detectChanges();
  }

  /**
   * Selects the suggestion with the given label,
   * or throws if it cannot be find.
   * Triggers the tick and change detection.
   */
  selectLabel(label: string) {
    const suggestion = this.suggestions.find(availableSuggestion => availableSuggestion.textContent === label);
    if (!suggestion) {
      throw new Error(
        `Trying to select suggestion with label ${label} but the only suggestions available are: ${this.suggestionLabels.join(', ')}`
      );
    }
    suggestion.click();
    tick(TYPEAHEAD_DEBOUNCE_TIME);
    this.tester.detectChanges();
  }
}
