import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

/**
 * A form control choosing between Enabled and Disabled, both shown, the chosen one standing out: clearer than a switch
 * about what a connector or an item will be once saved.
 *
 * Its model is a boolean. The choices are radio buttons, labelled by the element given by `labelledBy`:
 *
 * ```
 * <div class="form-label" id="south-status" translate="south.status"></div>
 * <oib-enabled-selector formControlName="enabled" inputId="south-enabled" labelledBy="south-status" />
 * ```
 */
@Component({
  selector: 'oib-enabled-selector',
  templateUrl: './enabled-selector.component.html',
  styleUrl: './enabled-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EnabledSelectorComponent),
      multi: true
    }
  ]
})
export class EnabledSelectorComponent implements ControlValueAccessor {
  /** The id of the Enabled radio button (the Disabled one is suffixed with `-disabled`), and the name of both */
  readonly inputId = input.required<string>();
  /** The id of the element labelling the choice */
  readonly labelledBy = input.required<string>();

  readonly enabled = signal(false);
  readonly disabled = signal(false);

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  writeValue(value: boolean | null): void {
    this.enabled.set(!!value);
  }

  select(enabled: boolean): void {
    this.enabled.set(enabled);
    this.onChange(enabled);
    this.onTouched();
  }

  touch(): void {
    this.onTouched();
  }
}
