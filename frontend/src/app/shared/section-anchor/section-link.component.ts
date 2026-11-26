import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * A link to a section of the page (see SectionAnchorDirective), next to its title: the URL it leads to, with the search
 * and the filters of the page, can be shared to show the section.
 */
@Component({
  selector: 'oib-section-link',
  template: `<a
    class="section-link text-secondary ms-2"
    [routerLink]="[]"
    [fragment]="fragment()"
    queryParamsHandling="preserve"
    [replaceUrl]="true"
    [ngbTooltip]="'common.section-link' | translate"
    [attr.aria-label]="'common.section-link' | translate"
    ><span class="fa-solid fa-link fa-xs" aria-hidden="true"></span
  ></a>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgbTooltip, TranslatePipe]
})
export class SectionLinkComponent {
  /** The name of the section, as given to SectionAnchorDirective */
  readonly fragment = input.required<string>();
}
