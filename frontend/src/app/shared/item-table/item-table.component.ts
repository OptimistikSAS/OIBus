import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  TemplateRef
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { createPageFromArray } from '@oibus/shared/common/types';

import { AuditInfoComponent } from '../audit-info/audit-info.component';
import { DescribedNameComponent } from '../described-name/described-name.component';
import { FilterSummaryComponent } from '../filter-summary/filter-summary.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { ResizableColumnsDirective } from '../resizable-columns.directive';
import { paramValue, UrlState } from '../url-state';
import {
  builtInSortValue,
  filterItems,
  ItemSelection,
  ItemSort,
  itemSortIcon,
  itemTableParams,
  nextItemSort,
  NO_ITEM_SORT,
  selectItems,
  sortItems,
  TableItem,
  toggleItemSelection
} from './item-table';
import {
  ItemTableActionsDirective,
  ItemTableCellsDirective,
  ItemTableFiltersDirective,
  ItemTableHeaderContext,
  ItemTableHeadersDirective,
  ItemTableMassActionsDirective
} from './item-table-templates';

const PAGE_SIZE = 20;

/**
 * The table of the items of a south connector or of a history query: filter by name and status, sortable columns,
 * pagination, and selection with actions on the selected items.
 *
 * The page provides what is specific to it through templates (see item-table-templates.ts): additional filters,
 * columns and mass actions, and the action buttons of each item. The selection is two-way bound (`[(selection)]`), so
 * that the page can act on the selected items and clear the selection once done.
 */
@Component({
  selector: 'oib-item-table',
  templateUrl: './item-table.component.html',
  styleUrl: './item-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ResizableColumnsDirective,
    ReactiveFormsModule,
    NgTemplateOutlet,
    TranslateDirective,
    TranslatePipe,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownItem,
    AuditInfoComponent,
    DescribedNameComponent,
    PaginationComponent,
    FilterSummaryComponent
  ],
  providers: [UrlState]
})
export class ItemTableComponent<T extends TableItem> {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly urlState = inject(UrlState);

  /** All the items (the table filters, sorts and paginates them) */
  readonly items = input.required<ReadonlyArray<T>>();
  /** Prefix of the translation keys of the labels: `south.items` or `history-query.items` */
  readonly translationPrefix = input.required<string>();
  /** Whether to display the creation and update dates (persisted items only) */
  readonly showDates = input(true);
  /** Filter applied in addition to the name and status filters, for the filters added by the page */
  readonly extraFilter = input<(item: T) => boolean>(() => true);
  /** Value to compare to sort the columns added by the page (the built-in columns are sorted by the table) */
  readonly sortValue = input<(item: T, column: string) => string | number>(builtInSortValue);
  /** Maximum number of action buttons a row displays (1 to 6), to size the actions column */
  readonly actionCount = input(0);
  /**
   * Prefix of the query params keeping the search, the status filter, the sort and the page of the table in the URL of
   * the page (see itemTableParams()), so that they are kept when the page is reloaded or its link shared; null to keep
   * them in the table only
   */
  readonly urlPrefix = input<string | null>(null);
  /** Whether a filter added by the page hides items, to show how many items are displayed and to reset the filters */
  readonly extraFiltered = input(false);
  readonly selection = model<ItemSelection<T>>(new Map());

  /** Emitted when the user resets the filters, for the page to reset the filters it adds */
  readonly resetExtraFilters = output<void>();
  readonly enableSelected = output<void>();
  readonly disableSelected = output<void>();
  readonly deleteSelected = output<void>();
  /** Emits the item under the mouse, e.g. for a tooltip showing details of the hovered item */
  readonly itemHover = output<T>();

  protected readonly filtersTemplate = contentChild(ItemTableFiltersDirective, { read: TemplateRef });
  protected readonly headersTemplate = contentChild(ItemTableHeadersDirective, { read: TemplateRef });
  protected readonly cellsTemplate = contentChild(ItemTableCellsDirective, { read: TemplateRef });
  protected readonly actionsTemplate = contentChild(ItemTableActionsDirective, { read: TemplateRef });
  protected readonly massActionsTemplate = contentChild(ItemTableMassActionsDirective, { read: TemplateRef });

  readonly searchControl = this.fb.control('');
  readonly statusFilterControl = this.fb.control<'enabled' | 'disabled' | null>(null);
  /** The query params of the table, null when its state is not kept in the URL */
  private readonly params = computed(() => {
    const prefix = this.urlPrefix();
    return prefix ? itemTableParams(prefix) : null;
  });
  // The state of the table when it is not kept in the URL
  private readonly localSearchText = toSignal(this.searchControl.valueChanges, { initialValue: '' });
  private readonly localStatusFilter = toSignal(this.statusFilterControl.valueChanges, { initialValue: null });
  private readonly localSort = signal<ItemSort>(NO_ITEM_SORT);

  private readonly searchText = computed(() => {
    const params = this.params();
    return params ? this.urlState.value(params.search) : this.localSearchText();
  });
  private readonly statusFilter = computed(() => {
    const params = this.params();
    return params ? this.urlState.value(params.status) : this.localStatusFilter();
  });
  private readonly sort = computed(() => {
    const params = this.params();
    return params ? this.urlState.value(params.sort) : this.localSort();
  });
  /** True when the search, the status filter or a filter added by the page hides items */
  protected readonly filtered = computed(() => !!this.searchText() || !!this.statusFilter() || this.extraFiltered());

  /** The filtered and sorted items, from all pages */
  readonly filteredItems = computed(() => {
    const extraFilter = this.extraFilter();
    const sortValue = this.sortValue();
    const filtered = filterItems(this.items(), { name: this.searchText(), status: this.statusFilter() }).filter(extraFilter);
    return sortItems(filtered, this.sort(), (item, column) => sortValue(item, column));
  });
  /**
   * Back to the first page when the filters or the sort change; kept when items are added, edited or removed.
   * In the URL, the page goes back to the first one when the URL changes (by the table, or by the page for its filters).
   */
  private readonly localPageNumber = linkedSignal({
    source: () => [this.searchText(), this.statusFilter(), this.extraFilter(), this.sort()],
    computation: () => 0
  });
  private readonly pageNumber = computed(() => {
    const params = this.params();
    return params ? this.urlState.value(params.page) : this.localPageNumber();
  });

  constructor() {
    const firstPage = () => {
      const params = this.params();
      return params ? paramValue(params.page, 0) : {};
    };
    this.urlState.syncControl(() => this.params()?.search ?? null, this.searchControl, { debounce: 200, otherChanges: firstPage });
    this.urlState.syncControl(() => this.params()?.status ?? null, this.statusFilterControl, { otherChanges: firstPage });
  }
  protected readonly page = computed(() => {
    const items = this.filteredItems();
    const lastPage = Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1);
    return createPageFromArray(items, PAGE_SIZE, Math.min(this.pageNumber(), lastPage));
  });
  protected readonly selectedCount = computed(() => this.selection().size);

  protected readonly headerContext: ItemTableHeaderContext = {
    sortIcon: column => this.sortIcon(column),
    toggleSort: column => this.toggleSort(column)
  };

  protected label(key: string): string {
    return `${this.translationPrefix()}.${key}`;
  }

  protected sortIcon(column: string): string {
    return itemSortIcon(this.sort(), column);
  }

  protected toggleSort(column: string) {
    const params = this.params();
    if (params) {
      this.urlState.patch({ ...paramValue(params.sort, nextItemSort(this.sort(), column)), ...paramValue(params.page, 0) });
    } else {
      this.localSort.update(sort => nextItemSort(sort, column));
    }
  }

  /** For the page to show the first page again, e.g. after importing items */
  goToFirstPage() {
    this.changePage(0);
  }

  protected changePage(pageNumber: number) {
    const params = this.params();
    if (params) {
      this.urlState.patch(paramValue(params.page, pageNumber));
    } else {
      this.localPageNumber.set(pageNumber);
    }
  }

  /** Shows all the items: no search, no filter (the sort is kept) */
  protected resetFilters() {
    const params = this.params();
    if (params) {
      this.urlState.patch({ ...paramValue(params.search, ''), ...paramValue(params.status, null), ...paramValue(params.page, 0) });
    } else {
      this.searchControl.setValue('');
      this.statusFilterControl.setValue(null);
    }
    this.resetExtraFilters.emit();
  }

  protected toggleItem(item: T) {
    this.selection.update(selection => toggleItemSelection(selection, item));
  }

  protected selectAll() {
    this.selection.update(selection => selectItems(selection, this.filteredItems()));
  }

  protected unselectAll() {
    this.selection.set(new Map());
  }
}
