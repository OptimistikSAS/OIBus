import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';

import { ProxyDTO } from '../../../../../../shared/model/proxy.model';

@Component({
  selector: 'oib-proxy',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf],
  templateUrl: './oib-proxy.component.html',
  styleUrls: ['./oib-proxy.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibProxyComponent), multi: true }]
})
export class OibProxyComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  @Input() proxies: Array<ProxyDTO> = [];
  proxyCtrl = this.fb.control(null as string | null);
  disabled = false;

  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.proxyCtrl.valueChanges.subscribe(newValue => {
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
      this.proxyCtrl.disable();
    } else {
      this.proxyCtrl.enable();
    }
  }

  writeValue(value: string): void {
    this.proxyCtrl.setValue(value);
  }
}
