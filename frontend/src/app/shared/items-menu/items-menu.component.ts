import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { NgbDropdown, NgbDropdownButtonItem, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

/**
 * The actions on the item list as a whole that are not used every day, in a menu next to the add button: managing the groups
 * of the items, importing, exporting and deleting all of them.
 */
@Component({
  selector: 'oib-items-menu',
  templateUrl: './items-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgbDropdownItem, NgbDropdownButtonItem]
})
export class ItemsMenuComponent {
  /** How many items there are: they can't be deleted when there is none (exported, they give the header of an import file) */
  readonly itemCount = input.required<number>();
  /** How many groups the items have; null when they can't be grouped, hence no group to manage */
  readonly groupCount = input<number | null>(null);
  readonly manageGroups = output();
  readonly importItems = output();
  readonly exportItems = output();
  readonly deleteAllItems = output();
}
