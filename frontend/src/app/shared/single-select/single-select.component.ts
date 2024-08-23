import { AfterContentInit, Component, ContentChildren, EventEmitter, forwardRef, Input, Output, QueryList } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgbDropdown, NgbDropdownButtonItem, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { SimpleSingleSelectOptionComponent } from './single-select-simple-option';
import { FormControlValidationDirective } from '../form-control-validation.directive';
import { BaseSingleSelectOptionComponent } from './single-select-base-option';
import { RichSingleSelectOptionComponent } from './single-select-rich-option';
import { NgTemplateOutlet } from '@angular/common';
import { BoxTitleDirective } from '../box/box.component';

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
  selector: 'oib-single-select',
  templateUrl: './single-select.component.html',
  styleUrl: './single-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SingleSelectComponent),
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
export class SingleSelectComponent implements ControlValueAccessor, AfterContentInit {
  disabled = false;
  @ContentChildren(BaseSingleSelectOptionComponent) options: QueryList<BaseSingleSelectOptionComponent> | null = null;

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

  select(option: BaseSingleSelectOptionComponent, event: MouseEvent) {
    if (this.isRichSelectOption(option) && !option.selectable) {
      if (!option.selectable) {
        return;
      }

      // If the clicked element is a button don't count as selection
      if ((event.target as HTMLElement).tagName === 'BUTTON') {
        return;
      }
    }

    this.selectedValue = option.value;
    this.propagateChanges();
    this.selectionChange.emit(this.selectedValue);
  }

  isSelected(option: BaseSingleSelectOptionComponent) {
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

  isRichSelectOption(option: BaseSingleSelectOptionComponent): option is RichSingleSelectOptionComponent {
    return option instanceof RichSingleSelectOptionComponent;
  }

  isSimpleSelectOption(option: BaseSingleSelectOptionComponent): option is SimpleSingleSelectOptionComponent {
    return option instanceof SimpleSingleSelectOptionComponent;
  }
}
