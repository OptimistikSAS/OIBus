import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { switchMap } from 'rxjs';

import { HistoryQueryLightDTO } from '@oibus/shared/api/history-query.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';
import { OIBUS_NORTH_TYPES, OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';
import { OIBUS_SOUTH_TYPES, OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { HISTORY_QUERY_STATUS, HistoryQueryStatus } from '@oibus/shared/domain/history-query.model';

import { HistoryQueryService } from '../services/history-query.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { DatetimePipe } from '../shared/datetime.pipe';
import { FilterSummaryComponent } from '../shared/filter-summary/filter-summary.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../shared/form/form-validation-directives';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { ModalService } from '../shared/modal.service';
import { NotificationService } from '../shared/notification.service';
import { OIBusNorthTypeEnumPipe } from '../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../shared/oibus-south-type-enum.pipe';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ResizableColumnsDirective } from '../shared/resizable-columns.directive';
import { ObservableState } from '../shared/save-button/save-button.component';
import { listParam, nextSort, pageParam, paramValue, sortParam, textParam, toggled, UrlState } from '../shared/url-state';
import { HISTORY_QUERY_STATUS_ICONS } from './history-query-status';

const SORT_FIELDS = ['name', 'interval', 'southType', 'northType', 'createdAt', 'updatedAt'] as const;
type HistorySortField = (typeof SORT_FIELDS)[number];

const PAGE_SIZE = 15;

/** The search, the filters, the sort and the page of the list, kept in the URL */
const PARAMS = {
  name: textParam('name'),
  status: listParam('status', HISTORY_QUERY_STATUS),
  southType: listParam('southType', OIBUS_SOUTH_TYPES),
  northType: listParam('northType', OIBUS_NORTH_TYPES),
  sort: sortParam('sort', SORT_FIELDS, { field: 'updatedAt', direction: 'desc' }),
  page: pageParam('page')
};
/** The changes of the URL that go back to the first page, when the search, the filters or the sort change */
const FIRST_PAGE = paramValue(PARAMS.page, 0);

@Component({
  selector: 'oib-history-query-list',
  imports: [
    ResizableColumnsDirective,
    TranslateDirective,
    RouterLink,
    PaginationComponent,
    FormsModule,
    ReactiveFormsModule,
    LoadingSpinnerComponent,
    DatetimePipe,
    AsyncPipe,
    NgbTooltip,
    TranslatePipe,
    OI_FORM_VALIDATION_DIRECTIVES,
    AuditInfoComponent,
    OIBusSouthTypeEnumPipe,
    OIBusNorthTypeEnumPipe,
    FilterSummaryComponent
  ],
  templateUrl: './history-query-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './history-query-list.component.scss',
  providers: [UrlState]
})
export class HistoryQueryListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly historyQueryService = inject(HistoryQueryService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly urlState = inject(UrlState);

  private readonly historyQueries = rxResource({ stream: () => this.historyQueryService.list() });
  /** The loaded history queries, null while loading */
  readonly allHistoryQueries = computed(() => (this.historyQueries.hasValue() ? this.historyQueries.value() : null));
  private readonly states = new Map<string, ObservableState>();
  private readonly currentSort = this.urlState.get(PARAMS.sort);

  // Active filters for the clickable status/south type/north type legends. Empty array means "no filter" (show all).
  readonly activeStatuses = this.urlState.get(PARAMS.status);
  readonly activeSouthTypes = this.urlState.get(PARAMS.southType);
  readonly activeNorthTypes = this.urlState.get(PARAMS.northType);

  readonly searchForm = this.fb.group({
    name: ''
  });
  private readonly searchedName = this.urlState.get(PARAMS.name);
  /** True when the search or a filter hides history queries */
  readonly filtered = computed(
    () => !!this.searchedName() || this.activeStatuses().length > 0 || this.activeSouthTypes().length > 0 || this.activeNorthTypes().length > 0
  );

  readonly filteredHistoryQueries = computed(() => this.sort(this.filter(this.allHistoryQueries() ?? [])));
  /** The displayed page, the last one when the page of the URL is beyond (e.g. history queries deleted since the link was shared) */
  readonly displayedHistoryQueries = computed<Page<HistoryQueryLightDTO>>(() => {
    const historyQueries = this.filteredHistoryQueries();
    const lastPage = Math.max(0, Math.ceil(historyQueries.length / PAGE_SIZE) - 1);
    return createPageFromArray(historyQueries, PAGE_SIZE, Math.min(this.urlState.value(PARAMS.page), lastPage));
  });

  constructor() {
    this.urlState.syncControl(PARAMS.name, this.searchForm.controls.name, { debounce: 200, otherChanges: () => FIRST_PAGE });
  }

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell ERRORED from RUNNING even when red and green look the same).
  readonly LEGEND: Array<{ label: string; status: HistoryQueryStatus; class: string }> = [
    { label: 'enums.status.PENDING', status: 'PENDING', class: HISTORY_QUERY_STATUS_ICONS.PENDING },
    { label: 'enums.status.RUNNING', status: 'RUNNING', class: HISTORY_QUERY_STATUS_ICONS.RUNNING },
    { label: 'enums.status.PAUSED', status: 'PAUSED', class: HISTORY_QUERY_STATUS_ICONS.PAUSED },
    { label: 'enums.status.FINISHED', status: 'FINISHED', class: HISTORY_QUERY_STATUS_ICONS.FINISHED },
    { label: 'enums.status.ERRORED', status: 'ERRORED', class: HISTORY_QUERY_STATUS_ICONS.ERRORED }
  ];

  /** Distinct South connector types among the currently loaded history queries, used to build the filter chips. */
  readonly southTypes = computed<Array<OIBusSouthType>>(() => this.distinctTypes(query => query.southType, this.activeSouthTypes()));

  /** Distinct North connector types among the currently loaded history queries, used to build the filter chips. */
  readonly northTypes = computed<Array<OIBusNorthType>>(() => this.distinctTypes(query => query.northType, this.activeNorthTypes()));

  /**
   * The types the history queries have, and the types filtered on: they can be unselected even if no history query has
   * them (e.g. from a link)
   */
  private distinctTypes<T extends string>(getType: (query: HistoryQueryLightDTO) => T, activeTypes: Array<T>): Array<T> {
    const types = new Set([...(this.allHistoryQueries() ?? []).map(getType), ...activeTypes]);
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }

  /** The start/pause state of a history query, which disables its buttons while the request is pending */
  state(historyQueryId: string): ObservableState {
    let state = this.states.get(historyQueryId);
    if (!state) {
      state = new ObservableState();
      this.states.set(historyQueryId, state);
    }
    return state;
  }

  delete(historyQuery: HistoryQueryLightDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.confirm-deletion',
        interpolateParams: { name: historyQuery.name }
      })
      .pipe(switchMap(() => this.historyQueryService.delete(historyQuery.id)))
      .subscribe(() => {
        this.historyQueries.reload();
        this.notificationService.success('history-query.deleted', {
          name: historyQuery.name
        });
      });
  }

  /**
   * Open a modal to view the audit history of a history query
   */
  showAudit(historyQuery: HistoryQueryLightDTO) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('history_query', historyQuery.id);
  }

  toggleSort(field: HistorySortField) {
    this.urlState.patch({ ...paramValue(PARAMS.sort, nextSort(this.currentSort(), field)), ...FIRST_PAGE });
  }

  getSortIcon(field: HistorySortField): string {
    const sort = this.currentSort();
    if (sort.field !== field) {
      return 'fa-sort';
    }
    return sort.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.urlState.patch(paramValue(PARAMS.page, pageNumber));
  }

  /** Shows all the history queries: no search, no filter (the sort is kept) */
  resetFilters() {
    this.urlState.patch({
      ...paramValue(PARAMS.name, ''),
      ...paramValue(PARAMS.status, []),
      ...paramValue(PARAMS.southType, []),
      ...paramValue(PARAMS.northType, []),
      ...FIRST_PAGE
    });
  }

  private filter(historyQueries: Array<HistoryQueryLightDTO>): Array<HistoryQueryLightDTO> {
    const name = this.searchedName();
    const activeStatuses = this.activeStatuses();
    const activeSouthTypes = this.activeSouthTypes();
    const activeNorthTypes = this.activeNorthTypes();
    let filteredItems = historyQueries;

    if (name) {
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(name.toLowerCase()));
    }
    if (activeStatuses.length > 0) {
      filteredItems = filteredItems.filter(item => activeStatuses.includes(item.status));
    }
    if (activeSouthTypes.length > 0) {
      filteredItems = filteredItems.filter(item => activeSouthTypes.includes(item.southType));
    }
    if (activeNorthTypes.length > 0) {
      filteredItems = filteredItems.filter(item => activeNorthTypes.includes(item.northType));
    }

    return filteredItems;
  }

  private sort(historyQueries: Array<HistoryQueryLightDTO>): Array<HistoryQueryLightDTO> {
    const { field, direction: sortDirection } = this.currentSort();
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...historyQueries].sort((a, b) => {
      if (field === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }
      if (field === 'createdAt') {
        return (a.createdAt ?? '').localeCompare(b.createdAt ?? '') * direction;
      }
      if (field === 'updatedAt') {
        return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') * direction;
      }
      if (field === 'southType') {
        return a.southType.localeCompare(b.southType) * direction;
      }
      if (field === 'northType') {
        return a.northType.localeCompare(b.northType) * direction;
      }
      const aStart = a.startTime ?? '';
      const bStart = b.startTime ?? '';
      return aStart.localeCompare(bStart) * direction;
    });
  }

  toggleHistoryQuery(query: HistoryQueryLightDTO, newStatus: HistoryQueryStatus) {
    const toggle = newStatus === 'RUNNING' ? this.historyQueryService.start(query.id) : this.historyQueryService.pause(query.id);
    toggle
      .pipe(
        this.state(query.id).pendingUntilFinalization(),
        switchMap(() => this.historyQueryService.list())
      )
      .subscribe(queries => {
        this.historyQueries.set(queries);
        this.notificationService.success(newStatus === 'RUNNING' ? 'history-query.started' : 'history-query.paused', { name: query.name });
      });
  }

  getStatusClass(status: HistoryQueryStatus) {
    const foundElement = this.LEGEND.find(element => element.status === status);
    if (foundElement) {
      return foundElement.class;
    }
    return 'fa-solid fa-times-circle status-red';
  }

  getStatusLabel(status: HistoryQueryStatus): string {
    const foundElement = this.LEGEND.find(element => element.status === status);
    return foundElement?.label ?? status;
  }

  /** Toggles a status in/out of the active status filter and re-applies filtering. */
  toggleStatus(status: HistoryQueryStatus) {
    this.urlState.patch({ ...paramValue(PARAMS.status, toggled(this.activeStatuses(), status)), ...FIRST_PAGE });
  }

  clearStatuses() {
    this.urlState.patch({ ...paramValue(PARAMS.status, []), ...FIRST_PAGE });
  }

  /** Toggles a South type in/out of the active filter and re-applies filtering. */
  toggleSouthType(type: OIBusSouthType) {
    this.urlState.patch({ ...paramValue(PARAMS.southType, toggled(this.activeSouthTypes(), type)), ...FIRST_PAGE });
  }

  clearSouthTypes() {
    this.urlState.patch({ ...paramValue(PARAMS.southType, []), ...FIRST_PAGE });
  }

  /** Toggles a North type in/out of the active filter and re-applies filtering. */
  toggleNorthType(type: OIBusNorthType) {
    this.urlState.patch({ ...paramValue(PARAMS.northType, toggled(this.activeNorthTypes(), type)), ...FIRST_PAGE });
  }

  clearNorthTypes() {
    this.urlState.patch({ ...paramValue(PARAMS.northType, []), ...FIRST_PAGE });
  }
}
