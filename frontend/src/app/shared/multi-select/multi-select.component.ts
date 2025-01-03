import { Component, forwardRef, output, contentChildren, computed, signal, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MultiSelectOptionDirective } from './multi-select-option.directive';

import { NgbDropdown, NgbDropdownButtonItem, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';

/**
 * A form control component allowing to do multiple selections.
 *
 * Usage:
 *
 * ```
 * <oib-multi-select formControlName="users" placeholder="Choose a user">
 *   @for (user of users; track user.id) {
 *    <oib-multi-select-option [value]="user.id" [label]="user.name">
 *   }
 *   </oib-multi-select-option>
 * </oib-multi-select>
 * ```
 *
 * An `isSmall` input allows to create the small Bootstrap version (`custom-select-sm`).
 * This input is optional and `false` by default.
 */
@Component({
  selector: 'oib-multi-select',
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true
    }
  ],
  imports: [NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgbDropdownButtonItem, NgbDropdownItem]
})
export class MultiSelectComponent<T> implements ControlValueAccessor {
  readonly disabled = signal(false);
  readonly options = contentChildren<MultiSelectOptionDirective<T>>(MultiSelectOptionDirective);

  readonly placeholder = input('');

  /**
   * If true, then the `custom-select-sm` class is added,
   * allowing to have a "small" select.
   */
  readonly isSmall = input(false);

  readonly compareWith = input<(o1: T, o2: T) => boolean>((o1: T, o2: T) => o1 === o2);

  readonly selectionChange = output<Array<T>>();

  readonly selectedLabels = computed(() => {
    const options = this.options();
    if (!options || options.length === 0) {
      return this.selectedValues().join(', ');
    } else {
      // get the labels of the selected options
      const result = options.filter(option => this.isSelected(option)).map(option => option.label());
      // in case an option is not present in the list, then too bad: it's not displayed. This should really be avoided
      return result.join(', ');
    }
  });

  private readonly selectedValues = signal<Array<T>>([]);
  private onChange: (selectedValues: Array<any>) => void = () => {};
  private onTouched = () => {};

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  writeValue(selectedValues: Array<any>): void {
    this.selectedValues.set([...(selectedValues ?? [])]);
  }

  touched() {
    this.onTouched();
  }

  toggle(option: MultiSelectOptionDirective<T>) {
    const index = this.selectedValues().findIndex(selectedValue => this.compareWith()(option.value(), selectedValue));
    if (index >= 0) {
      // the item exists, remove it
      this.selectedValues.update(values => values.filter((_, i) => i !== index));
    } else {
      // the item does not exist, add it
      this.selectedValues.update(values => [...values, option.value()]);
    }
    // propagate the change
    this.onChange([...this.selectedValues()]);
    this.selectionChange.emit([...this.selectedValues()]);
  }

  isSelected(option: MultiSelectOptionDirective<T>) {
    return this.selectedValues().some(value => this.compareWith()(option.value(), value));
  }

  openChanged(opened: boolean, button: HTMLButtonElement) {
    if (!opened) {
      button.focus();
    }
  }
}
