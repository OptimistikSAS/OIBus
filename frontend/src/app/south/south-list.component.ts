import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { finalize, switchMap } from 'rxjs';

import { SouthConnectorListDTO } from '@oibus/shared/api/south-connector.model';
import { createPageFromArray } from '@oibus/shared/common/types';
import { OIBUS_SOUTH_TYPES, OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';

import { SouthConnectorService } from '../services/south-connector.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { FilterSummaryComponent } from '../shared/filter-summary/filter-summary.component';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { ModalService } from '../shared/modal.service';
import { NotificationService } from '../shared/notification.service';
import { OIBusSouthTypeEnumPipe } from '../shared/oibus-south-type-enum.pipe';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ResizableColumnsDirective } from '../shared/resizable-columns.directive';
import { booleanListParam, listParam, nextSort, pageParam, paramValue, sortParam, textParam, toggled, UrlState } from '../shared/url-state';

const SORT_FIELDS = ['name', 'type', 'createdAt', 'updatedAt'] as const;
type SouthSortField = (typeof SORT_FIELDS)[number];
const PAGE_SIZE = 15;

/** The search, the filters, the sort and the page of the list, kept in the URL */
const PARAMS = {
  name: textParam('name'),
  status: booleanListParam('status'),
  type: listParam('type', OIBUS_SOUTH_TYPES),
  sort: sortParam('sort', SORT_FIELDS, { field: 'name', direction: 'asc' }),
  page: pageParam('page')
};
/** The changes of the URL that go back to the first page, when the search, the filters or the sort change */
const FIRST_PAGE = paramValue(PARAMS.page, 0);

@Component({
  selector: 'oib-south-list',
  imports: [
    ResizableColumnsDirective,
    TranslateDirective,
    RouterLink,
    LoadingSpinnerComponent,
    ReactiveFormsModule,
    PaginationComponent,
    OIBusSouthTypeEnumPipe,
    NgbTooltip,
    TranslatePipe,
    AuditInfoComponent,
    FilterSummaryComponent
  ],
  templateUrl: './south-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './south-list.component.scss',
  providers: [UrlState]
})
export class SouthListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly urlState = inject(UrlState);

  readonly searchForm = inject(NonNullableFormBuilder).group({
    name: ''
  });

  private readonly southsResource = rxResource({ stream: () => this.southConnectorService.list() });
  /** All the South connectors, null while they are loaded for the first time (or if loading failed). */
  readonly allSouths = computed(() => (this.southsResource.hasValue() ? this.southsResource.value() : null));
  /** IDs of the connectors being started or stopped. */
  readonly pendingToggles = signal<ReadonlySet<string>>(new Set());
  private readonly sort = this.urlState.get(PARAMS.sort);

  // Active filters for the clickable status/type legends. Empty array means "no filter" (show all).
  readonly activeEnabledStates = this.urlState.get(PARAMS.status);
  readonly activeTypes = this.urlState.get(PARAMS.type);
  private readonly searchedName = this.urlState.get(PARAMS.name);
  /** True when the search or a filter hides connectors, once they are loaded */
  readonly filtered = computed(
    () => !!this.allSouths() && (!!this.searchedName() || this.activeEnabledStates().length > 0 || this.activeTypes().length > 0)
  );

  readonly filteredSouths = computed(() => this.sortSouths(this.filter(this.allSouths() ?? [])));
  /** The displayed page, the last one when the page of the URL is beyond (e.g. connectors deleted since the link was shared) */
  readonly displayedSouths = computed(() => {
    const souths = this.filteredSouths();
    const lastPage = Math.max(0, Math.ceil(souths.length / PAGE_SIZE) - 1);
    return createPageFromArray(souths, PAGE_SIZE, Math.min(this.urlState.value(PARAMS.page), lastPage));
  });

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell enabled from disabled even when green and grey look the same).
  // Avoids fa-play/fa-pause/fa-toggle-* shapes, which could be mistaken for the row's own action control.
  constructor() {
    this.urlState.syncControl(PARAMS.name, this.searchForm.controls.name, { debounce: 200, otherChanges: () => FIRST_PAGE });
  }

  readonly LEGEND: Array<{ label: string; enabled: boolean; class: string }> = [
    { label: 'south.disabled', enabled: false, class: 'fa-solid fa-minus-circle status-grey' },
    { label: 'south.enabled', enabled: true, class: 'fa-solid fa-check-circle status-green' }
  ];

  /** Distinct South connector types among the currently loaded connectors, used to build the filter chips. */
  readonly types = computed(() => {
    // the types filtered on are shown too, so that they can be unselected even if no connector has them (e.g. from a link)
    const types = new Set([...(this.allSouths() ?? []).map(south => south.type), ...this.activeTypes()]);
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  });

  /**
   * Delete a South connector by its ID
   */
  deleteSouth(south: SouthConnectorListDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.confirm-deletion',
        interpolateParams: { name: south.name }
      })
      .pipe(switchMap(() => this.southConnectorService.delete(south.id)))
      .subscribe(() => {
        this.southsResource.reload();
        this.notificationService.success('south.deleted', {
          name: south.name
        });
      });
  }

  /**
   * Open a modal to view the audit history of a South connector
   */
  showAudit(south: SouthConnectorListDTO) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('south_connector', south.id);
  }

  toggleSort(field: SouthSortField) {
    this.urlState.patch({ ...paramValue(PARAMS.sort, nextSort(this.sort(), field)), ...FIRST_PAGE });
  }

  getSortIcon(field: SouthSortField): string {
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

  private filter(souths: Array<SouthConnectorListDTO>): Array<SouthConnectorListDTO> {
    const name = this.searchedName();
    let filteredItems = souths;

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

  /** Toggles a South type in/out of the active filter and re-applies filtering. */
  toggleType(type: OIBusSouthType) {
    this.urlState.patch({ ...paramValue(PARAMS.type, toggled(this.activeTypes(), type)), ...FIRST_PAGE });
  }

  clearTypes() {
    this.urlState.patch({ ...paramValue(PARAMS.type, []), ...FIRST_PAGE });
  }

  private sortSouths(souths: Array<SouthConnectorListDTO>): Array<SouthConnectorListDTO> {
    const { field, direction: sortDirection } = this.sort();
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...souths].sort((a, b) => {
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

  toggleConnector(south: SouthConnectorListDTO) {
    const start = !south.enabled;
    this.pendingToggles.update(ids => new Set(ids).add(south.id));
    (start ? this.southConnectorService.start(south.id) : this.southConnectorService.stop(south.id))
      .pipe(
        finalize(() =>
          this.pendingToggles.update(ids => {
            const remaining = new Set(ids);
            remaining.delete(south.id);
            return remaining;
          })
        )
      )
      .subscribe(() => {
        this.notificationService.success(start ? 'south.started' : 'south.stopped', { name: south.name });
        this.southsResource.reload();
      });
  }
}
