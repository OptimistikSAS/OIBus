import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';

@Component({
  selector: 'oib-text',
  standalone: true,
  imports: [...formDirectives, NgIf],
  templateUrl: './oib-text.component.html',
  styleUrls: ['./oib-text.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibTextComponent), multi: true }]
})
export class OibTextComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  textInputCtrl = this.fb.control(null as string | null);
  disabled = false;
  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.textInputCtrl.valueChanges.subscribe(newValue => {
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
      this.textInputCtrl.disable();
    } else {
      this.textInputCtrl.enable();
    }
  }

  writeValue(value: string): void {
    this.textInputCtrl.setValue(value);
  }
}
