import { Directive, Input } from '@angular/core';

/**
 * An option of a multi-select
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'oib-multi-select-option',
  standalone: true
})
export class MultiSelectOptionDirective {
  @Input()
  value: any;

  @Input()
  label = '';
}
