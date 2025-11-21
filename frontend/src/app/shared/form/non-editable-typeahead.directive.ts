/* eslint-disable @angular-eslint/directive-selector */

import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';

/**
 * Directive which automatically clears the input on blur when an ngbTypeahead is applied to the input
 * if its editable input is false and the value in the model is falsy (indicating that the entered value is not
 * a valid value).
 */
@Directive({
  selector: '[ngbTypeahead]'
})
export class NonEditableTypeaheadDirective {
  private ngControl = inject(NgControl);
  private elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private typeahead = inject(NgbTypeahead);

  @HostListener('blur')
  onBlur() {
    if (!this.ngControl.value && !this.typeahead.editable) {
      this.elementRef.nativeElement.value = '';
    }
  }
}
