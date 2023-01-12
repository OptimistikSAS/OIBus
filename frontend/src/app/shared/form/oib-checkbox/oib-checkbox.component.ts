import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'oib-checkbox',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf],
  templateUrl: './oib-checkbox.component.html',
  styleUrls: ['./oib-checkbox.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibCheckboxComponent), multi: true }]
})
export class OibCheckboxComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  checkboxCtrl = new FormControl(null as boolean | null);
  disabled = false;
  onChange: (value: boolean) => void = () => {};
  onTouched = () => {};

  constructor() {
    this.checkboxCtrl.valueChanges.subscribe(newValue => {
      this.onChange(newValue!);
    });
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.disabled) {
      this.checkboxCtrl.disable();
    } else {
      this.checkboxCtrl.enable();
    }
  }

  writeValue(value: boolean): void {
    this.checkboxCtrl.setValue(value);
  }
}
