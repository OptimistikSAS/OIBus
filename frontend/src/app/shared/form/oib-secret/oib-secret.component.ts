import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';

@Component({
  selector: 'oib-secret',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf],
  templateUrl: './oib-secret.component.html',
  styleUrls: ['./oib-secret.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibSecretComponent), multi: true }]
})
export class OibSecretComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  secretInputCtrl = this.fb.control(null as string | null);
  disabled = false;
  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.secretInputCtrl.valueChanges.subscribe(newValue => {
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
      this.secretInputCtrl.disable();
    } else {
      this.secretInputCtrl.enable();
    }
  }

  writeValue(value: string): void {
    this.secretInputCtrl.setValue(value);
  }
}
