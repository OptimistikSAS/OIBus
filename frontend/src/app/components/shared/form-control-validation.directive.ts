/* eslint-disable @angular-eslint/directive-selector */
import { Directive, HostBinding, Optional } from '@angular/core';
import { NgControl } from '@angular/forms';
import { ValdemortConfig } from 'ngx-valdemort';

/**
 * Directive which automatically adds the Bootstrap CSS class `is-invalid` to .form-control, .form-select
 * and [ngbRadioGroup] and some other controls if they are associated to an Angular form control which is invalid, and if the
 * Valdemort config says that the error message should be displayed (so that the red border
 * and the error message appear together).
 */
@Directive({
  selector: '.form-control,.form-select',
  standalone: true
})
export class FormControlValidationDirective {
  constructor(@Optional() private ngControl: NgControl, private config: ValdemortConfig) {}

  @HostBinding('class.is-invalid') get isInvalid() {
    return (
      this.ngControl &&
      this.ngControl.invalid &&
      this.config.shouldDisplayErrors(this.ngControl.control!, (this.ngControl as any).formDirective)
    );
  }
}
