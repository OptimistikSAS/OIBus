import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): string[];
}
@Component({
  selector: 'oib-timezone',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf],
  templateUrl: './oib-timezone.component.html',
  styleUrls: ['./oib-timezone.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibTimezoneComponent), multi: true }]
})
export class OibTimezoneComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  timezones = Intl.supportedValuesOf('timeZone');
  timezoneInputCtrl = this.fb.control(null as string | null);
  disabled = false;
  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.timezoneInputCtrl.valueChanges.subscribe(newValue => {
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
      this.timezoneInputCtrl.disable();
    } else {
      this.timezoneInputCtrl.enable();
    }
  }

  writeValue(value: string): void {
    this.timezoneInputCtrl.setValue(value);
  }
}
