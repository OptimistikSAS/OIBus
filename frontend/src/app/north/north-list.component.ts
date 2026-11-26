import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { switchMap, tap } from 'rxjs';

import { NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';
import { OIBUS_NORTH_TYPES, OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';

import { NorthConnectorService } from '../services/north-connector.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { FilterSummaryComponent } from '../shared/filter-summary/filter-summary.component';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { ModalService } from '../shared/modal.service';
import { NotificationService } from '../shared/notification.service';
import { OIBusNorthTypeEnumPipe } from '../shared/oibus-north-type-enum.pipe';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ResizableColumnsDirective } from '../shared/resizable-columns.directive';
import { ObservableState } from '../shared/save-button/save-button.component';
import { booleanListParam, listParam, nextSort, pageParam, paramValue, sortParam, textParam, toggled, UrlState } from '../shared/url-state';

const SORT_FIELDS = ['name', 'type', 'createdAt', 'updatedAt'] as const;
type NorthSortField = (typeof SORT_FIELDS)[number];

const PAGE_SIZE = 15;

/** The search, the filters, the sort and the page of the list, kept in the URL */
const PARAMS = {
  name: textParam('name'),
  status: booleanListParam('status'),
  type: listParam('type', OIBUS_NORTH_TYPES),
  sort: sortParam('sort', SORT_FIELDS, { field: 'name', direction: 'asc' }),
  page: pageParam('page')
};
/** The changes of the URL that go back to the first page, when the search, the filters or the sort change */
const FIRST_PAGE = paramValue(PARAMS.page, 0);

@Component({
  selector: 'oib-north-list',
  imports: [
    ResizableColumnsDirective,
    ReactiveFormsModule,
    TranslateDirective,
    RouterLink,
    LoadingSpinnerComponent,
    PaginationComponent,
    AsyncPipe,
    OIBusNorthTypeEnumPipe,
    NgbTooltip,
    TranslatePipe,
    AuditInfoComponent,
    FilterSummaryComponent
  ],
  templateUrl: './north-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './north-list.component.scss',
  providers: [UrlState]
})
export class NorthListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly urlState = inject(UrlState);

  readonly allNorths = signal<Array<NorthConnectorLightDTO> | null>(null);
  // one pending state per connector, rendered through the async pipe
  readonly states = new Map<string, ObservableState>();
  private readonly sort = this.urlState.get(PARAMS.sort);

  // Active filters for the clickable status/type legends. Empty array means "no filter" (show all).
  readonly activeEnabledStates = this.urlState.get(PARAMS.status);
  readonly activeTypes = this.urlState.get(PARAMS.type);
  private readonly searchedName = this.urlState.get(PARAMS.name);
  /** True when the search or a filter hides connectors, once they are loaded */
  readonly filtered = computed(
    () => !!this.allNorths() && (!!this.searchedName() || this.activeEnabledStates().length > 0 || this.activeTypes().length > 0)
  );

  readonly searchForm = this.fb.group({
    name: ''
  });

  readonly filteredNorths = computed(() => this.sortNorths(this.filter(this.allNorths() ?? [])));
  /** The displayed page, the last one when the page of the URL is beyond (e.g. connectors deleted since the link was shared) */
  readonly displayedNorths = computed<Page<NorthConnectorLightDTO>>(() => {
    const norths = this.filteredNorths();
    const lastPage = Math.max(0, Math.ceil(norths.length / PAGE_SIZE) - 1);
    return createPageFromArray(norths, PAGE_SIZE, Math.min(this.urlState.value(PARAMS.page), lastPage));
  });

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell enabled from disabled even when green and grey look the same).
  // Avoids fa-play/fa-pause/fa-toggle-* shapes, which could be mistaken for the row's own action control.
  readonly LEGEND: Array<{ label: string; enabled: boolean; class: string }> = [
    { label: 'north.disabled', enabled: false, class: 'fa-solid fa-minus-circle status-grey' },
    { label: 'north.enabled', enabled: true, class: 'fa-solid fa-check-circle status-green' }
  ];

  constructor() {
    this.loadNorths();
    this.urlState.syncControl(PARAMS.name, this.searchForm.controls.name, { debounce: 200, otherChanges: () => FIRST_PAGE });
  }

  private loadNorths() {
    this.northConnectorService.list().subscribe(norths => this.setNorths(norths));
  }

  private setNorths(norths: Array<NorthConnectorLightDTO>) {
    norths.forEach(north => {
      if (!this.states.has(north.id)) {
        this.states.set(north.id, new ObservableState());
      }
    });
    this.allNorths.set(norths);
  }

  /** Distinct North connector types among the currently loaded connectors, used to build the filter chips. */
  readonly types = computed(() => {
    // the types filtered on are shown too, so that they can be unselected even if no connector has them (e.g. from a link)
    const types = new Set([...(this.allNorths() ?? []).map(north => north.type), ...this.activeTypes()]);
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  });

  /**
   * Delete a North connector by its ID
   */
  deleteNorth(north: NorthConnectorLightDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'north.confirm-deletion',
        interpolateParams: { name: north.name }
      })
      .pipe(switchMap(() => this.northConnectorService.delete(north.id)))
      .subscribe(() => {
        this.loadNorths();
        this.notificationService.success('north.deleted', {
          name: north.name
        });
      });
  }

  /**
   * Open a modal to view the audit history of a North connector
   */
  showAudit(north: NorthConnectorLightDTO) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('north_connector', north.id);
  }

  toggleSort(field: NorthSortField) {
    this.urlState.patch({ ...paramValue(PARAMS.sort, nextSort(this.sort(), field)), ...FIRST_PAGE });
  }

  getSortIcon(field: NorthSortField): string {
    const sort = this.sort();
    if (sort.field !== field) {
      return 'fa-sort';
    }
    return sort.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.urlState.patch(paramValue(PARAMS.page, pageNumber));
  }

  /** Shows all the connectors: no search, no filter (the sort is kept) */
  resetFilters() {
    this.urlState.patch({ ...paramValue(PARAMS.name, ''), ...paramValue(PARAMS.status, []), ...paramValue(PARAMS.type, []), ...FIRST_PAGE });
  }

  private filter(norths: Array<NorthConnectorLightDTO>): Array<NorthConnectorLightDTO> {
    const name = this.searchedName();
    let filteredItems = norths;

    if (name) {
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(name.toLowerCase()));
    }
    const activeEnabledStates = this.activeEnabledStates();
    if (activeEnabledStates.length > 0) {
      filteredItems = filteredItems.filter(item => activeEnabledStates.includes(item.enabled));
    }
    const activeTypes = this.activeTypes();
    if (activeTypes.length > 0) {
      filteredItems = filteredItems.filter(item => activeTypes.includes(item.type));
    }

    return filteredItems;
  }

  /** Toggles an enabled/disabled state in/out of the active status filter and re-applies filtering. */
  toggleEnabledState(enabled: boolean) {
    this.urlState.patch({ ...paramValue(PARAMS.status, toggled(this.activeEnabledStates(), enabled)), ...FIRST_PAGE });
  }

  clearEnabledStates() {
    this.urlState.patch({ ...paramValue(PARAMS.status, []), ...FIRST_PAGE });
  }

  /** Toggles a North type in/out of the active filter and re-applies filtering. */
  toggleType(type: OIBusNorthType) {
    this.urlState.patch({ ...paramValue(PARAMS.type, toggled(this.activeTypes(), type)), ...FIRST_PAGE });
  }

  clearTypes() {
    this.urlState.patch({ ...paramValue(PARAMS.type, []), ...FIRST_PAGE });
  }

  private sortNorths(norths: Array<NorthConnectorLightDTO>): Array<NorthConnectorLightDTO> {
    const { field, direction: sortDirection } = this.sort();
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...norths].sort((a, b) => {
      if (field === 'createdAt') {
        return (a.createdAt ?? '').localeCompare(b.createdAt ?? '') * direction;
      }
      if (field === 'updatedAt') {
        return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') * direction;
      }
      const aValue = field === 'name' ? a.name : a.type;
      const bValue = field === 'name' ? b.name : b.type;
      return aValue.localeCompare(bValue) * direction;
    });
  }

  toggleConnector(northId: string, northName: string, value: boolean) {
    if (value) {
      this.northConnectorService
        .start(northId)
        .pipe(
          this.states.get(northId)!.pendingUntilFinalization(),
          tap(() => {
            this.notificationService.success('north.started', { name: northName });
          }),
          switchMap(() => {
            return this.northConnectorService.list();
          })
        )
        .subscribe(norths => this.setNorths(norths));
    } else {
      this.northConnectorService
        .stop(northId)
        .pipe(
          this.states.get(northId)!.pendingUntilFinalization(),
          tap(() => {
            this.notificationService.success('north.stopped', { name: northName });
          }),
          switchMap(() => {
            return this.northConnectorService.list();
          })
        )
        .subscribe(norths => this.setNorths(norths));
    }
  }
}
