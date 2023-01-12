import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';

@Component({
  selector: 'oib-select',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf],
  templateUrl: './oib-select.component.html',
  styleUrls: ['./oib-select.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibSelectComponent), multi: true }]
})
export class OibSelectComponent implements ControlValueAccessor {
  @Input() options: Array<string> = [];
  @Input() label = '';
  @Input() key = '';
  selectInputCtrl = this.fb.control(null as string | null);
  disabled = false;
  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.selectInputCtrl.valueChanges.subscribe(newValue => {
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
      this.selectInputCtrl.disable();
    } else {
      this.selectInputCtrl.enable();
    }
  }

  writeValue(value: string): void {
    this.selectInputCtrl.setValue(value);
  }
}
