import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { AsyncPipe } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ModalService } from '../shared/modal.service';
import { Router, RouterLink } from '@angular/router';
import { CreateHistoryQueryModalComponent } from './create-history-query-modal/create-history-query-modal.component';
import { HistoryQueryLightDTO, HistoryQueryStatus } from '../../../../backend/shared/model/history-query.model';
import { OIBusSouthType } from '../../../../backend/shared/model/south-connector.model';
import { OIBusNorthType } from '../../../../backend/shared/model/north-connector.model';
import { HistoryQueryService } from '../services/history-query.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../backend/shared/model/types';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { emptyPage } from '../shared/test-utils';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { DatetimePipe } from '../shared/datetime.pipe';
import { ObservableState } from '../shared/save-button/save-button.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../shared/form/form-validation-directives';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { OIBusSouthTypeEnumPipe } from '../shared/oibus-south-type-enum.pipe';
import { OIBusNorthTypeEnumPipe } from '../shared/oibus-north-type-enum.pipe';

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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './history-query-list.component.scss'
})
export class HistoryQueryListComponent {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private historyQueryService = inject(HistoryQueryService);
  private router = inject(Router);

  allHistoryQueries: Array<HistoryQueryLightDTO> | null = null;
  filteredHistoryQueries: Array<HistoryQueryLightDTO> = [];
  displayedHistoryQueries: Page<HistoryQueryLightDTO> = emptyPage();
  states = new Map<string, ObservableState>();
  sortField: HistorySortField = 'updatedAt';
  sortDirection: SortDirection = 'desc';

  // Active filters for the clickable status/south type/north type legends. Empty array means "no filter" (show all).
  activeStatuses: Array<HistoryQueryStatus> = [];
  activeSouthTypes: Array<OIBusSouthType> = [];
  activeNorthTypes: Array<OIBusNorthType> = [];

  searchForm = inject(NonNullableFormBuilder).group({
    name: [null as string | null]
  });

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell ERRORED from RUNNING even when red and green look the same).
  readonly LEGEND: Array<{ label: string; status: HistoryQueryStatus; class: string }> = [
    { label: 'enums.status.PENDING', status: 'PENDING', class: 'fa fa-hourglass-half status-grey' },
    { label: 'enums.status.RUNNING', status: 'RUNNING', class: 'fa fa-spinner fa-spin status-green' },
    { label: 'enums.status.PAUSED', status: 'PAUSED', class: 'fa fa-pause-circle status-yellow' },
    { label: 'enums.status.FINISHED', status: 'FINISHED', class: 'fa fa-check-circle status-blue' },
    { label: 'enums.status.ERRORED', status: 'ERRORED', class: 'fa fa-times-circle status-red' }
  ];

  constructor() {
    this.historyQueryService.list().subscribe(queries => {
      this.allHistoryQueries = queries;
      this.states.clear();
      this.allHistoryQueries.forEach(historyQuery => {
        this.states.set(historyQuery.id, new ObservableState());
      });
      this.updateList(0);
    });

    this.searchForm.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      if (this.allHistoryQueries) {
        this.updateList(0);
      }
    });
  }

  /** Distinct South connector types among the currently loaded history queries, used to build the filter chips. */
  get southTypes(): Array<OIBusSouthType> {
    return this.distinctTypes(query => query.southType);
  }

  /** Distinct North connector types among the currently loaded history queries, used to build the filter chips. */
  get northTypes(): Array<OIBusNorthType> {
    return this.distinctTypes(query => query.northType);
  }

  private distinctTypes<T extends string>(getType: (query: HistoryQueryLightDTO) => T): Array<T> {
    const types = new Set((this.allHistoryQueries ?? []).map(getType));
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }

  delete(historyQuery: HistoryQueryLightDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.confirm-deletion',
        interpolateParams: { name: historyQuery.name }
      })
      .pipe(
        switchMap(() => {
          return this.historyQueryService.delete(historyQuery.id);
        })
      )
      .subscribe(() => {
        this.historyQueryService
          .list()
          .pipe(tap(() => (this.allHistoryQueries = null)))
          .subscribe(queries => {
            this.allHistoryQueries = queries;
            this.states.clear();
            this.allHistoryQueries.forEach(historyQuery => {
              this.states.set(historyQuery.id, new ObservableState());
            });
            this.updateList(0);
          });
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

  toggleSort(field: HistorySortField) {
    if (!field) return;

    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.updateList(0);
  }

  getSortIcon(field: HistorySortField): string {
    if (this.sortField !== field) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc';
  }

  changePage(pageNumber: number) {
    this.displayedHistoryQueries = this.createPage(pageNumber);
  }

  private createPage(pageNumber: number): Page<HistoryQueryLightDTO> {
    return createPageFromArray(this.filteredHistoryQueries, PAGE_SIZE, pageNumber);
  }

  private updateList(pageNumber: number) {
    this.filteredHistoryQueries = this.filter(this.allHistoryQueries ?? []);
    this.sortHistoryQueries();
    this.changePage(pageNumber);
  }

  filter(historyQueries: Array<HistoryQueryLightDTO>): Array<HistoryQueryLightDTO> {
    const formValue = this.searchForm.value;
    let filteredItems = historyQueries;

    if (formValue.name) {
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(formValue.name!.toLowerCase()));
    }
    if (this.activeStatuses.length > 0) {
      filteredItems = filteredItems.filter(item => this.activeStatuses.includes(item.status));
    }
    if (this.activeSouthTypes.length > 0) {
      filteredItems = filteredItems.filter(item => this.activeSouthTypes.includes(item.southType));
    }
    if (this.activeNorthTypes.length > 0) {
      filteredItems = filteredItems.filter(item => this.activeNorthTypes.includes(item.northType));
    }

    return filteredItems;
  }

  private sortHistoryQueries() {
    if (!this.sortField) return;

    const direction = this.sortDirection === 'asc' ? 1 : -1;
    const field = this.sortField;
    this.filteredHistoryQueries = [...this.filteredHistoryQueries].sort((a, b) => {
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
    if (newStatus === 'RUNNING') {
      this.historyQueryService
        .start(query.id)
        .pipe(
          this.states.get(query.id)!.pendingUntilFinalization(),
          switchMap(() => {
            return this.historyQueryService.list();
          })
        )
        .subscribe(queries => {
          this.allHistoryQueries = queries;
          this.updateList(this.displayedHistoryQueries.number);
          this.notificationService.success('history-query.started', { name: query.name });
        });
    } else {
      this.historyQueryService
        .pause(query.id)
        .pipe(
          this.states.get(query.id)!.pendingUntilFinalization(),
          switchMap(() => {
            return this.historyQueryService.list();
          })
        )
        .subscribe(queries => {
          this.allHistoryQueries = queries;
          this.updateList(this.displayedHistoryQueries.number);
          this.notificationService.success('history-query.paused', { name: query.name });
        });
    }
  }

  getStatusClass(status: HistoryQueryStatus) {
    const foundElement = this.LEGEND.find(element => element.status === status);
    if (foundElement) {
      return foundElement.class;
    }
    return 'fa fa-times-circle status-red';
  }

  getStatusLabel(status: HistoryQueryStatus): string {
    const foundElement = this.LEGEND.find(element => element.status === status);
    return foundElement?.label ?? status;
  }

  /** Toggles a status in/out of the active status filter and re-applies filtering. */
  toggleStatus(status: HistoryQueryStatus) {
    this.activeStatuses = this.activeStatuses.includes(status)
      ? this.activeStatuses.filter(s => s !== status)
      : [...this.activeStatuses, status];
    this.updateList(0);
  }

  clearStatuses() {
    this.activeStatuses = [];
    this.updateList(0);
  }

  /** Toggles a South type in/out of the active filter and re-applies filtering. */
  toggleSouthType(type: OIBusSouthType) {
    this.activeSouthTypes = this.activeSouthTypes.includes(type)
      ? this.activeSouthTypes.filter(t => t !== type)
      : [...this.activeSouthTypes, type];
    this.updateList(0);
  }

  clearSouthTypes() {
    this.activeSouthTypes = [];
    this.updateList(0);
  }

  /** Toggles a North type in/out of the active filter and re-applies filtering. */
  toggleNorthType(type: OIBusNorthType) {
    this.activeNorthTypes = this.activeNorthTypes.includes(type)
      ? this.activeNorthTypes.filter(t => t !== type)
      : [...this.activeNorthTypes, type];
    this.updateList(0);
  }

  clearNorthTypes() {
    this.activeNorthTypes = [];
    this.updateList(0);
  }
}
