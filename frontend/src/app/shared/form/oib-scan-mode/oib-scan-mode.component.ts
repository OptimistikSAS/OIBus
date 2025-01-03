import { Component, forwardRef, inject, input } from '@angular/core';
import { formDirectives } from '../../form-directives';

import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { TranslateDirective } from '@ngx-translate/core';

@Component({
  selector: 'oib-scan-mode',
  imports: [...formDirectives, TranslateDirective],
  templateUrl: './oib-scan-mode.component.html',
  styleUrl: './oib-scan-mode.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibScanModeComponent), multi: true }]
})
export class OibScanModeComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly key = input('');
  readonly scanModes = input<Array<ScanModeDTO>>([]);
  readonly scanModeType = input<'POLL' | 'SUBSCRIPTION' | 'SUBSCRIPTION_AND_POLL'>('POLL');
  scanModeInputCtrl = inject(NonNullableFormBuilder).control(null as string | null);
  disabled = false;
  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  constructor() {
    this.scanModeInputCtrl.valueChanges.subscribe(newValue => {
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
      this.scanModeInputCtrl.disable();
    } else {
      this.scanModeInputCtrl.enable();
    }
  }

  writeValue(value: string): void {
    this.scanModeInputCtrl.setValue(value);
  }
}
