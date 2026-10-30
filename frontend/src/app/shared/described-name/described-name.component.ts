import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

/**
 * The name of an entity in a list (an item, a synchronisation...), with a hover tooltip giving its full name in bold, then its
 * description when it has one.
 */
@Component({
  selector: 'oib-described-name',
  templateUrl: './described-name.component.html',
  imports: [NgbTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DescribedNameComponent {
  readonly name = input.required<string>();
  /** Null, undefined or blank when the entity has no description */
  readonly description = input<string | null | undefined>(null);
}
