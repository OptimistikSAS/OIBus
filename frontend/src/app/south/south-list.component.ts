import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';

import { SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';
import { createPageFromArray } from '@oibus/shared/common/types';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';

import { SouthConnectorService } from '../services/south-connector.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { ModalService } from '../shared/modal.service';
import { NotificationService } from '../shared/notification.service';
import { OIBusSouthTypeEnumPipe } from '../shared/oibus-south-type-enum.pipe';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ChooseSouthConnectorTypeModalComponent } from './choose-south-connector-type-modal/choose-south-connector-type-modal.component';

type SouthSortField = 'name' | 'type' | 'createdAt' | 'updatedAt' | null;
type SortDirection = 'asc' | 'desc';
const PAGE_SIZE = 15;

@Component({
  selector: 'oib-south-list',
  imports: [
    TranslateDirective,
    RouterLink,
    LoadingSpinnerComponent,
    ReactiveFormsModule,
    PaginationComponent,
    OIBusSouthTypeEnumPipe,
    NgbTooltip,
    TranslatePipe,
    AuditInfoComponent
  ],
  templateUrl: './south-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './south-list.component.scss'
})
export class SouthListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly southConnectorService = inject(SouthConnectorService);

  readonly searchForm = inject(NonNullableFormBuilder).group({
    name: [null as string | null]
  });

  private readonly southsResource = rxResource({ stream: () => this.southConnectorService.list() });
  /** All the South connectors, null while they are loaded for the first time (or if loading failed). */
  readonly allSouths = computed(() => (this.southsResource.hasValue() ? this.southsResource.value() : null));
  /** IDs of the connectors being started or stopped. */
  readonly pendingToggles = signal<ReadonlySet<string>>(new Set());
  readonly sortField = signal<SouthSortField>('name');
  readonly sortDirection = signal<SortDirection>('asc');

  // Active filters for the clickable status/type legends. Empty array means "no filter" (show all).
  readonly activeEnabledStates = signal<Array<boolean>>([]);
  readonly activeTypes = signal<Array<OIBusSouthType>>([]);
  private readonly searchedName = toSignal(this.searchForm.controls.name.valueChanges.pipe(debounceTime(200), distinctUntilChanged()), {
    initialValue: null
  });

  private readonly filteredSouths = computed(() => this.sortSouths(this.filter(this.allSouths() ?? [])));
  /** The displayed page, back to the first one whenever the filters or the sort change. */
  private readonly pageNumber = linkedSignal({
    source: () => [this.searchedName(), this.activeEnabledStates(), this.activeTypes(), this.sortField(), this.sortDirection()],
    computation: () => 0
  });
  readonly displayedSouths = computed(() => createPageFromArray(this.filteredSouths(), PAGE_SIZE, this.pageNumber()));

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell enabled from disabled even when green and grey look the same).
  // Avoids fa-play/fa-pause/fa-toggle-* shapes, which could be mistaken for the row's own action control.
  readonly LEGEND: Array<{ label: string; enabled: boolean; class: string }> = [
    { label: 'south.disabled', enabled: false, class: 'fa-solid fa-minus-circle status-grey' },
    { label: 'south.enabled', enabled: true, class: 'fa-solid fa-check-circle status-green' }
  ];

  /** Distinct South connector types among the currently loaded connectors, used to build the filter chips. */
  readonly types = computed(() => {
    const types = new Set((this.allSouths() ?? []).map(south => south.type));
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  });

  /**
   * Delete a South connector by its ID
   */
  deleteSouth(south: SouthConnectorLightDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.confirm-deletion',
        interpolateParams: { name: south.name }
      })
      .pipe(switchMap(() => this.southConnectorService.delete(south.id)))
      .subscribe(() => {
        this.pageNumber.set(0);
        this.southsResource.reload();
        this.notificationService.success('south.deleted', {
          name: south.name
        });
      });
  }

  /**
   * Open a modal to create a South connector
   */
  createSouth() {
    const modalRef = this.modalService.open(ChooseSouthConnectorTypeModalComponent, { size: 'xl', backdrop: 'static' });
    modalRef.result.subscribe();
  }

  /**
   * Open a modal to view the audit history of a South connector
   */
  showAudit(south: SouthConnectorLightDTO) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('south_connector', south.id);
  }

  toggleSort(field: SouthSortField) {
    if (!field) return;

    if (this.sortField() === field) {
      this.sortDirection.update(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: SouthSortField): string {
    if (this.sortField() !== field) {
      return 'fa-sort';
    }
    return this.sortDirection() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.pageNumber.set(pageNumber);
  }

  private filter(souths: Array<SouthConnectorLightDTO>): Array<SouthConnectorLightDTO> {
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
    this.activeEnabledStates.update(states => (states.includes(enabled) ? states.filter(e => e !== enabled) : [...states, enabled]));
  }

  clearEnabledStates() {
    this.activeEnabledStates.set([]);
  }

  /** Toggles a South type in/out of the active filter and re-applies filtering. */
  toggleType(type: OIBusSouthType) {
    this.activeTypes.update(types => (types.includes(type) ? types.filter(t => t !== type) : [...types, type]));
  }

  clearTypes() {
    this.activeTypes.set([]);
  }

  private sortSouths(souths: Array<SouthConnectorLightDTO>): Array<SouthConnectorLightDTO> {
    const field = this.sortField();
    if (!field) return souths;

    const direction = this.sortDirection() === 'asc' ? 1 : -1;
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

  toggleConnector(south: SouthConnectorLightDTO) {
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
