import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'oib-code-block',
  template: '',
  styleUrl: './oib-code-block.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OibCodeBlockStubComponent),
      multi: true
    }
  ]
})
export class OibCodeBlockStubComponent implements ControlValueAccessor {
  onChange: any = () => {};
  onTouch: any = () => {};

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  input = '';

  writeValue(input: string) {
    this.input = input;
  }
}
