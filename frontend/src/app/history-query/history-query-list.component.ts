import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { HistoryQueryLightDTO } from '@oibus/shared/api/history-query.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';
import { OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { HistoryQueryStatus } from '@oibus/shared/domain/history-query.model';

import { HistoryQueryService } from '../services/history-query.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { DatetimePipe } from '../shared/datetime.pipe';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../shared/form/form-validation-directives';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { ModalService } from '../shared/modal.service';
import { NotificationService } from '../shared/notification.service';
import { OIBusNorthTypeEnumPipe } from '../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../shared/oibus-south-type-enum.pipe';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ObservableState } from '../shared/save-button/save-button.component';
import { CreateHistoryQueryModalComponent } from './create-history-query-modal/create-history-query-modal.component';

type HistorySortField = 'name' | 'interval' | 'southType' | 'northType' | 'createdAt' | 'updatedAt' | null;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 15;

@Component({
  selector: 'oib-history-query-list',
  imports: [
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
    OIBusNorthTypeEnumPipe
  ],
  templateUrl: './history-query-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './history-query-list.component.scss'
})
export class HistoryQueryListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly historyQueryService = inject(HistoryQueryService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly historyQueries = rxResource({ stream: () => this.historyQueryService.list() });
  /** The loaded history queries, null while loading */
  readonly allHistoryQueries = computed(() => (this.historyQueries.hasValue() ? this.historyQueries.value() : null));
  private readonly states = new Map<string, ObservableState>();
  readonly sortField = signal<HistorySortField>('updatedAt');
  readonly sortDirection = signal<SortDirection>('desc');

  // Active filters for the clickable status/south type/north type legends. Empty array means "no filter" (show all).
  readonly activeStatuses = signal<Array<HistoryQueryStatus>>([]);
  readonly activeSouthTypes = signal<Array<OIBusSouthType>>([]);
  readonly activeNorthTypes = signal<Array<OIBusNorthType>>([]);

  readonly searchForm = this.fb.group({
    name: [null as string | null]
  });
  private readonly searchedName = toSignal(this.searchForm.controls.name.valueChanges.pipe(debounceTime(200), distinctUntilChanged()), {
    initialValue: null
  });

  readonly filteredHistoryQueries = computed(() => this.sort(this.filter(this.allHistoryQueries() ?? [])));
  /** Back to the first page when the filters or the sort change */
  private readonly pageNumber = linkedSignal({
    source: () => [
      this.searchedName(),
      this.activeStatuses(),
      this.activeSouthTypes(),
      this.activeNorthTypes(),
      this.sortField(),
      this.sortDirection()
    ],
    computation: () => 0
  });
  readonly displayedHistoryQueries = computed<Page<HistoryQueryLightDTO>>(() =>
    createPageFromArray(this.filteredHistoryQueries(), PAGE_SIZE, this.pageNumber())
  );

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell ERRORED from RUNNING even when red and green look the same).
  readonly LEGEND: Array<{ label: string; status: HistoryQueryStatus; class: string }> = [
    { label: 'enums.status.PENDING', status: 'PENDING', class: 'fa-solid fa-hourglass-half status-grey' },
    { label: 'enums.status.RUNNING', status: 'RUNNING', class: 'fa-solid fa-spinner fa-spin status-green' },
    { label: 'enums.status.PAUSED', status: 'PAUSED', class: 'fa-solid fa-pause-circle status-yellow' },
    { label: 'enums.status.FINISHED', status: 'FINISHED', class: 'fa-solid fa-check-circle status-blue' },
    { label: 'enums.status.ERRORED', status: 'ERRORED', class: 'fa-solid fa-times-circle status-red' }
  ];

  /** Distinct South connector types among the currently loaded history queries, used to build the filter chips. */
  readonly southTypes = computed<Array<OIBusSouthType>>(() => this.distinctTypes(query => query.southType));

  /** Distinct North connector types among the currently loaded history queries, used to build the filter chips. */
  readonly northTypes = computed<Array<OIBusNorthType>>(() => this.distinctTypes(query => query.northType));

  private distinctTypes<T extends string>(getType: (query: HistoryQueryLightDTO) => T): Array<T> {
    const types = new Set((this.allHistoryQueries() ?? []).map(getType));
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
        this.pageNumber.set(0);
        this.historyQueries.reload();
        this.notificationService.success('history-query.deleted', {
          name: historyQuery.name
        });
      });
  }

  createHistoryQuery() {
    const modalRef = this.modalService.open(CreateHistoryQueryModalComponent, { backdrop: 'static' });
    modalRef.result.subscribe(queryParams => {
      this.router.navigate(['/history-queries', 'create'], { queryParams });
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
    if (!field) return;

    if (this.sortField() === field) {
      this.sortDirection.update(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: HistorySortField): string {
    if (this.sortField() !== field) {
      return 'fa-sort';
    }
    return this.sortDirection() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.pageNumber.set(pageNumber);
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
    const field = this.sortField();
    if (!field) return historyQueries;

    const direction = this.sortDirection() === 'asc' ? 1 : -1;
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
    this.activeStatuses.update(statuses => (statuses.includes(status) ? statuses.filter(s => s !== status) : [...statuses, status]));
  }

  clearStatuses() {
    this.activeStatuses.set([]);
  }

  /** Toggles a South type in/out of the active filter and re-applies filtering. */
  toggleSouthType(type: OIBusSouthType) {
    this.activeSouthTypes.update(types => (types.includes(type) ? types.filter(t => t !== type) : [...types, type]));
  }

  clearSouthTypes() {
    this.activeSouthTypes.set([]);
  }

  /** Toggles a North type in/out of the active filter and re-applies filtering. */
  toggleNorthType(type: OIBusNorthType) {
    this.activeNorthTypes.update(types => (types.includes(type) ? types.filter(t => t !== type) : [...types, type]));
  }

  clearNorthTypes() {
    this.activeNorthTypes.set([]);
  }
}
