import { TestButton, TestElement } from 'ngx-speculoos';

/**
 * A utility class for tests of component having multiselect components.
 * It allows interacting with a multiselect relatively easily.
 */
export class MultiSelectTester {
  constructor(private testElement: TestElement<any>) {}

  private get triggerButton(): TestButton {
    return this.testElement.button('[ngbDropdownToggle]')!;
  }

  // Implementation note: we can't use regular TestElement methods, because the dropdown is appended to the body,
  // and not inside the test element.
  private doWithDropdownItems(callback: (item: HTMLButtonElement, index: number) => void) {
    this.triggerButton.click();
    const dropdown: HTMLElement = document.querySelector('.dropdown-menu.show')!;
    const items = dropdown.querySelectorAll('.dropdown-item');
    items.forEach((item, index) => {
      callback(item as HTMLButtonElement, index);
    });
    this.triggerButton.click();
  }

  /**
   * Returns the set of selected indices, by opening the dropdown, seeing which items are selected and closing the
   * dropdown (as a user would do)
   */
  getSelectedIndices(): Set<number> {
    const result = new Set<number>();
    this.doWithDropdownItems((item, index) => {
      if (item.classList.contains('selected')) {
        result.add(index);
      }
    });
    return result;
  }

  /**
   * Returns the set of selected option texts, by opening the dropdown, seeing which items are selected and closing the
   * dropdown (as a user would do)
   */
  getSelectedTexts(): Set<string> {
    const result = new Set<string>();
    this.doWithDropdownItems(item => {
      if (item.classList.contains('selected')) {
        result.add(item.querySelector('.flex-grow-1')!.textContent!);
      }
    });
    return result;
  }

  /**
   * Sets the selection to the given indices by opening the dropdown, toggling the options that need to be toggled,
   * and closing the dropdown (as a user would do)
   */
  selectIndices(indices: Set<number>) {
    this.doWithDropdownItems((item, index) => {
      if ((item.classList.contains('selected') && !indices.has(index)) || (!item.classList.contains('selected') && indices.has(index))) {
        (item as HTMLButtonElement).click();
      }
    });
  }

  /**
   * Sets the selection to the given indices by opening the dropdown, toggling the options that need to be toggled,
   * and closing the dropdown (as a user would do)
   */
  selectTexts(texts: Set<string>) {
    this.doWithDropdownItems(item => {
      const text = item.querySelector('.flex-grow-1')!.textContent!;
      if ((item.classList.contains('selected') && !texts.has(text)) || (!item.classList.contains('selected') && texts.has(text))) {
        (item as HTMLButtonElement).click();
      }
    });
  }

  /**
   * Gets the text displayed in the multiselect button (which is used to open it)
   */
  get displayedSelection(): string {
    return this.triggerButton.textContent!;
  }

  /**
   * Gets the labels of the selectable options by opening and closing the dropdown (as a user would do)
   */
  get selectableTexts(): Array<string> {
    const result: Array<string> = [];
    this.doWithDropdownItems(item => {
      const text = item.querySelector('.flex-grow-1')!.textContent!;
      result.push(text);
    });

    return result;
  }
}
