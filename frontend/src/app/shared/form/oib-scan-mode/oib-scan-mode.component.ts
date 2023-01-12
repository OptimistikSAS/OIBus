import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';
import { ScanModeDTO } from '../../../model/scan-mode.model';

@Component({
  selector: 'oib-scan-mode',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf],
  templateUrl: './oib-scan-mode.component.html',
  styleUrls: ['./oib-scan-mode.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibScanModeComponent), multi: true }]
})
export class OibScanModeComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  @Input() scanModes: Array<ScanModeDTO> = [];
  scanModeInputCtrl = this.fb.control(null as ScanModeDTO | null);
  disabled = false;
  onChange: (value: ScanModeDTO) => void = () => {};
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

  writeValue(value: ScanModeDTO): void {
    this.scanModeInputCtrl.setValue(value);
  }
}
