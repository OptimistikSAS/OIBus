import { Directive, input } from '@angular/core';

/**
 * An option of a multi-select
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'oib-multi-select-option'
})
export class MultiSelectOptionDirective<T> {
  readonly value = input.required<T>();

  readonly label = input.required<string>();
}
