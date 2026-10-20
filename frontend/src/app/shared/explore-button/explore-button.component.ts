import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

/**
 * Where the items of a south connector come from its data source: exploring it, to add items or keep them in sync, and the
 * items synchronisations kept that way. A connector without discovery only explores its data source; the page shows this
 * button only for a connector that explores it.
 */
@Component({
  selector: 'oib-explore-button',
  templateUrl: './explore-button.component.html',
  styleUrl: './explore-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgbDropdownItem]
})
export class ExploreButtonComponent {
  /** How many items synchronisations the connector has; null when it has no discovery, hence no synchronisation */
  readonly synchronisations = input<number | null>(null);
  readonly explore = output();
  readonly manageSynchronisations = output();
}
