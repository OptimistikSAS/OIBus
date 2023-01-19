import { AfterContentInit, Component, ContentChildren, EventEmitter, forwardRef, Input, Output, QueryList } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MultiSelectOptionDirective } from './multi-select-option.directive';
import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { NgForOf, NgIf } from '@angular/common';

/**
 * A form control component allowing to do multiple selections.
 *
 * Usage:
 *
 * ```
 * <oib-multi-select formControlName="users" placeholder="Choose a user">
 *   <oib-multi-select-option *ngFor="let user of users" [value]="user.id" [label]="user.name">
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
  styleUrls: ['./multi-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true
    }
  ],
  imports: [NgbDropdown, NgIf, NgForOf, NgbDropdownToggle, NgbDropdownMenu, NgbDropdownItem],
  standalone: true
})
export class MultiSelectComponent implements ControlValueAccessor, AfterContentInit {
  disabled = false;
  @ContentChildren(MultiSelectOptionDirective) options: QueryList<MultiSelectOptionDirective> | null = null;

  @Input() placeholder = '';

  /**
   * If true, then the `custom-select-sm` class is added,
   * allowing to have a "small" select.
   */
  @Input() isSmall = false;

  @Input() compareWith: ((o1: any, o2: any) => boolean) | null = null;

  @Output()
  readonly selectionChange = new EventEmitter<Array<any>>();

  selectedLabels = '';

  private selectedValues: Array<any> = [];
  private onChange: (selectedValues: Array<any>) => void = () => {};
  private onTouched = () => {};

  constructor() {}

  ngAfterContentInit() {
    this.updateSelectedLabels();
    this.options!.changes.subscribe(() => this.updateSelectedLabels());
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  writeValue(selectedValues: Array<any>): void {
    this.selectedValues.splice(0, this.selectedValues.length);
    if (selectedValues) {
      selectedValues.forEach(value => {
        this.selectedValues.push(value);
      });
    }
    this.updateSelectedLabels();
  }

  private propagateChanges() {
    this.onChange([...this.selectedValues]);
    this.updateSelectedLabels();
  }

  private updateSelectedLabels() {
    if (!this.options) {
      this.selectedLabels = this.selectedValues.join(', ');
    } else {
      // get the labels of the selected options
      const result = this.options.filter(option => this.isSelected(option)).map(option => option.label);
      // in case an option is not present in the list, then too bad: it's not displayed. This should really be avoided
      this.selectedLabels = result.join(', ');
    }
  }

  touched() {
    this.onTouched();
  }

  toggle(option: MultiSelectOptionDirective) {
    const index = this.selectedValues.findIndex(selectedValue => this.actualCompareWith(option.value, selectedValue));
    if (index >= 0) {
      this.selectedValues.splice(index, 1);
    } else {
      this.selectedValues.push(option.value);
    }
    this.propagateChanges();
    this.selectionChange.emit(this.selectedValues);
  }

  isSelected(option: MultiSelectOptionDirective) {
    return this.selectedValues.some(value => this.actualCompareWith(option.value, value));
  }

  openChanged(opened: boolean, button: HTMLButtonElement) {
    if (!opened) {
      button.focus();
    }
  }

  private get actualCompareWith(): (o1: any, o2: any) => boolean {
    return this.compareWith || ((o1: any, o2: any) => o1 === o2);
  }
}
