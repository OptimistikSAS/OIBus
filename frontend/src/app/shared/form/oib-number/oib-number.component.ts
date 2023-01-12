import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';

@Component({
  selector: 'oib-number',
  standalone: true,
  imports: [...formDirectives, NgIf],
  templateUrl: './oib-number.component.html',
  styleUrls: ['./oib-number.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibNumberComponent), multi: true }]
})
export class OibNumberComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  numberInputCtrl = this.fb.control(null as number | null);
  disabled = false;
  onChange: (value: number) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.numberInputCtrl.valueChanges.subscribe(newValue => {
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
      this.numberInputCtrl.disable();
    } else {
      this.numberInputCtrl.enable();
    }
  }

  writeValue(value: number): void {
    this.numberInputCtrl.setValue(value);
  }
}
