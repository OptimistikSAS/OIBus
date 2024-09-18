import { AfterContentInit, Component, ContentChildren, EventEmitter, forwardRef, Input, Output, QueryList } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgbDropdown, NgbDropdownButtonItem, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { FormControlValidationDirective } from '../form-control-validation.directive';
import { NgTemplateOutlet } from '@angular/common';
import { BoxTitleDirective } from '../box/box.component';
import { RichSelectOptionComponent } from './rich-select-option.component';

/**
 * A form control component allowing to do rich single selections.
 *
 * Simple usage:
 *
 * ```
 * <oib-rich-select formControlName="users" placeholder="Choose a user">
 *   @for (user of users; track user.id) {
 *    <oib-rich-select-option [value]="user.id" [label]="user.name">
 *   }
 *   </oib-rich-select-option>
 * </oib-rich-select>
 * ```
 *
 * Advanced usage:
 *
 * ```
 * <oib-rich-select formControlName="users" placeholder="Choose a user">
 *   @for (user of users; track user.id) {
 *    <oib-rich-select-option [value]="user.id" [label]="user.name">
 *      <div>
 *        <span>User is {{ user.name }}</span>
 *        <button>delete</button>
 *      </div>
 *    </<oib-rich-select-option>
 *   }
 *   </oib-rich-select-option>
 * </oib-rich-select>
 * ```
 *
 * An `isSmall` input allows to create the small Bootstrap version (`custom-select-sm`).
 * This input is optional and `false` by default.
 */
@Component({
  selector: 'oib-rich-select',
  templateUrl: './rich-select.component.html',
  styleUrl: './rich-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichSelectComponent),
      multi: true
    }
  ],
  imports: [
    NgbDropdown,
    FormControlValidationDirective,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownButtonItem,
    NgbDropdownItem,
    NgTemplateOutlet,
    BoxTitleDirective
  ],
  standalone: true
})
export class RichSelectComponent implements ControlValueAccessor, AfterContentInit {
  disabled = false;
  @ContentChildren(RichSelectOptionComponent) options: QueryList<RichSelectOptionComponent> | null = null;

  @Input() placeholder = '';

  /**
   * If true, then the `custom-select-sm` class is added,
   * allowing to have a "small" select.
   */
  @Input() isSmall = false;

  @Input() compareWith: ((o1: any, o2: any) => boolean) | null = null;

  @Output()
  readonly selectionChange = new EventEmitter<any>();

  selectedLabel = '';

  @Input() defaultSelected: any;

  private selectedValue: any = undefined;
  private onChange: (selectedValue: any) => void = () => {};
  private onTouched = () => {};

  constructor() {}

  ngAfterContentInit() {
    this.writeValue(this.defaultSelected);
    this.options!.changes.subscribe(() => this.writeValue(this.defaultSelected));
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

  writeValue(selectedValue: any): void {
    if (selectedValue) {
      this.selectedValue = selectedValue;
    }
    this.updateSelectedLabel();
    this.selectionChange.emit(this.selectedValue);
  }

  private propagateChanges() {
    this.onChange(this.selectedValue);
    this.updateSelectedLabel();
  }

  private updateSelectedLabel() {
    if (!this.options) {
      this.selectedLabel = '';
    } else {
      // get the label of the selected option
      const result = this.options.find(option => this.isSelected(option));
      this.selectedLabel = result?.label ?? '';
    }
  }

  touched() {
    this.onTouched();
  }

  select(option: RichSelectOptionComponent, event: MouseEvent) {
    const hasCustomContent = !!(event.currentTarget as HTMLElement).querySelector('.rich-content-wrapper')?.children.length;

    if (!option.selectable) {
      return;
    }

    // When an option has custom content
    // do not select it if it's a button from the content or the wrapper button itself
    if (
      hasCustomContent &&
      (event.target as HTMLElement).tagName === 'BUTTON' &&
      !(event.target as HTMLElement).classList.contains('dropdown-item')
    ) {
      return;
    }

    this.selectedValue = option.value;
    this.propagateChanges();
    this.selectionChange.emit(this.selectedValue);
  }

  isSelected(option: RichSelectOptionComponent) {
    return this.actualCompareWith(option.value, this.selectedValue);
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
