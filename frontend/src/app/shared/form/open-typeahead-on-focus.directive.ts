/* eslint-disable @angular-eslint/directive-selector */

import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { debounceTime, filter, Subject } from 'rxjs';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { NgControl } from '@angular/forms';
import { TYPEAHEAD_DEBOUNCE_TIME } from './typeahead';

/**
 * Directive which automatically triggers a search when an ngbTypeahead is focused,
 * if there is no current value for the field and the typeahead is not already opened.
 * A short debounce is applied to avoid triggering a search
 * if the field is not focused anymore shortly after (quick tab navigation).
 *
 * This is inspired by https://ng-bootstrap.github.io/#/components/typeahead/examples#focus
 * but wrapped in a directive instead of having to add the same code on every typeahead.
 */
@Directive({
  selector: '[ngbTypeahead]'
})
export class OpenTypeaheadOnFocusDirective {
  private focused$ = new Subject<boolean>();

  constructor() {
    const ngControl = inject(NgControl);
    const element = inject<ElementRef<HTMLInputElement>>(ElementRef);
    const ngbTypeahead = inject(NgbTypeahead);

    this.focused$
      .pipe(
        debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
        // only trigger the search if
        // - there is no value selected
        // - the last is event is a focus (and not a blur)
        // - the popup is not already opened
        filter(focused => !ngControl.value && focused && !ngbTypeahead.isPopupOpen())
      )
      .subscribe(() => element.nativeElement.dispatchEvent(new Event('input')));
  }

  @HostListener('focus')
  onFocus() {
    this.focused$.next(true);
  }

  @HostListener('blur')
  onBlur() {
    this.focused$.next(false);
  }
}
