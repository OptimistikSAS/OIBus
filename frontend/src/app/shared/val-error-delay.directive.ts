import { Directive, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';

/**
 * Directive which targets the val-errors elements, and which uses a mutation observer to detect the new errors appearing inside the
 * element. These errors have a `display: none` css style by default (see the styles.scss file).
 * When they appear, the directive sets back the display to `block` but after a small delay, in order for clicks to not miss their target
 * due to an error shifting the location of the button due to the error appearing just before the click, because of the previous blur
 * event.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'val-errors'
})
export class ValErrorDelayDirective implements OnDestroy {
  observer: MutationObserver | null = null;

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef);
    const zone = inject(NgZone);

    zone.runOutsideAngular(() => {
      const callback = (mutationsList: Array<MutationRecord>) => {
        for (const mutation of mutationsList) {
          if (mutation.type == 'childList') {
            const errors = Array.from(element.nativeElement.getElementsByTagName('div'));
            for (const error of errors) {
              setTimeout(() => (error.style.display = 'block'), 150);
            }
          }
        }
      };
      this.observer = new MutationObserver(callback);
      this.observer.observe(element.nativeElement, {
        childList: true
      });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
