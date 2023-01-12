import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';

@Component({
  selector: 'oib-text-area',
  standalone: true,
  imports: [...formDirectives, NgIf],
  templateUrl: './oib-text-area.component.html',
  styleUrls: ['./oib-text-area.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibTextAreaComponent), multi: true }]
})
export class OibTextAreaComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  textAreaCtrl = this.fb.control(null as string | null);
  disabled = false;
  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.textAreaCtrl.valueChanges.subscribe(newValue => {
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
      this.textAreaCtrl.disable();
    } else {
      this.textAreaCtrl.enable();
    }
  }

  writeValue(value: string): void {
    this.textAreaCtrl.setValue(value);
  }
}
