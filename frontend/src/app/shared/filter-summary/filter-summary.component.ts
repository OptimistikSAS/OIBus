import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';

/**
 * When a search or a filter hides elements of a list: how many are shown out of all of them, and a button to show them
 * all again. Useful when the filters come from a shared link, and are easy to miss.
 */
@Component({
  selector: 'oib-filter-summary',
  templateUrl: './filter-summary.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective],
  host: { class: 'd-flex align-items-center gap-2 text-nowrap' }
})
export class FilterSummaryComponent {
  /** How many elements match the search and the filters */
  readonly shown = input.required<number>();
  /** How many elements there are */
  readonly total = input.required<number>();
  /** True when a search or a filter is active (nothing is displayed otherwise) */
  readonly filtered = input.required<boolean>();
  readonly resetFilters = output();
}
