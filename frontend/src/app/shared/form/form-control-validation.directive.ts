/* eslint-disable @angular-eslint/directive-selector */
import { Directive, inject } from '@angular/core';
import { FormControlName, NgControl, NgModel } from '@angular/forms';

import { ValdemortConfig } from 'ngx-valdemort';

/**
 * Directive which automatically adds the Bootstrap CSS class `is-invalid` to .form-control, .form-select
 * and [ngbRadioGroup] and some other controls if they are associated to an Angular form control which is invalid, and if the
 * Valdemort config says that the error message should be displayed (so that the red border
 * and the error message appear together).
 */
@Directive({
  selector: '.form-control,.form-select',
  host: {
    '[class.is-invalid]': 'isInvalid'
  }
})
export class FormControlValidationDirective {
  private readonly ngControl = inject(NgControl, { optional: true });
  private readonly config = inject(ValdemortConfig);

  get isInvalid() {
    if (!this.ngControl?.control || !this.ngControl.invalid) {
      return false;
    }
    // only the directives bound to a control of a form know their form (used to display the errors once submitted)
    const formDirective =
      this.ngControl instanceof FormControlName || this.ngControl instanceof NgModel ? this.ngControl.formDirective : null;
    return this.config.shouldDisplayErrors(this.ngControl.control, formDirective ?? undefined);
  }
}
