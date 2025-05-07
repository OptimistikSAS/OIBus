import { Component, computed, forwardRef, inject, input } from '@angular/core';
import { formDirectives } from '../../form-directives';

import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'oib-transformer',
  imports: [...formDirectives, TranslatePipe],
  templateUrl: './oib-transformer.component.html',
  styleUrl: './oib-transformer.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibTransformerComponent), multi: true }]
})
export class OibTransformerComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly key = input('');
  readonly transformers = input.required<Array<TransformerDTO>>();
  readonly supportedOutputTypes = input<Array<string>>([]);

  transformerInputCtrl = inject(NonNullableFormBuilder).control(null as string | null);
  disabled = false;
  onChange: (value: string) => void = () => {};
  onTouched = () => {};

  readonly selectableTransformer = computed(() =>
    this.transformers().filter(
      element =>
        (element.type === 'standard' && element.functionName === 'ignore') ||
        !this.supportedOutputTypes().length ||
        this.supportedOutputTypes().includes(element.outputType)
    )
  );

  constructor() {
    this.transformerInputCtrl.valueChanges.subscribe(newValue => {
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
      this.transformerInputCtrl.disable();
    } else {
      this.transformerInputCtrl.enable();
    }
  }

  writeValue(value: string): void {
    this.transformerInputCtrl.setValue(value);
  }
}
