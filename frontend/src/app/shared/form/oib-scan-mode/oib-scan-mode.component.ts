import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';
import { ScanModeDTO } from '../../../../../../shared/model/scan-mode.model';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'oib-scan-mode',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf, TranslateModule],
  templateUrl: './oib-scan-mode.component.html',
  styleUrl: './oib-scan-mode.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibScanModeComponent), multi: true }]
})
export class OibScanModeComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  @Input() scanModes: Array<ScanModeDTO> = [];
  @Input() acceptSubscription = false;
  @Input() subscriptionOnly = false;
  scanModeInputCtrl = this.fb.control(null as string | null);
  disabled = false;
  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
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
