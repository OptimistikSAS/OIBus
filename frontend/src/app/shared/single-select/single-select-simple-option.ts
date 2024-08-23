import { Component } from '@angular/core';
import { BaseSingleSelectOptionComponent } from './single-select-base-option';

/**
 * An option of a single-select
 */
@Component({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'oib-simple-single-select-option',
  providers: [{ provide: BaseSingleSelectOptionComponent, useExisting: SimpleSingleSelectOptionComponent }],
  template: '',
  standalone: true
})
export class SimpleSingleSelectOptionComponent extends BaseSingleSelectOptionComponent {}
