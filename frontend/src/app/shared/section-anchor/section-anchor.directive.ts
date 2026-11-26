import { afterNextRender, DestroyRef, Directive, ElementRef, inject, Injector, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

/**
 * A section of a page that a link can show: the page is scrolled to the section when the fragment of its URL is the
 * name of the section (e.g. `/south/id#logs`), once the section is displayed. See SectionLinkComponent for the link.
 */
@Directive({
  selector: '[oibSectionAnchor]'
})
export class SectionAnchorDirective {
  /** The name of the section, as the fragment of the URL */
  readonly oibSectionAnchor = input.required<string>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const injector = inject(Injector);
    inject(ActivatedRoute)
      .fragment.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(fragment => {
        if (fragment && fragment === this.oibSectionAnchor()) {
          // once the section and what comes before it are rendered, so that it does not move after the scroll
          afterNextRender(() => element.scrollIntoView({ block: 'start' }), { injector });
        }
      });
  }
}
