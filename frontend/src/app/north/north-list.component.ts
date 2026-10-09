import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';

import { NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';
import { OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';

import { NorthConnectorService } from '../services/north-connector.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { ModalService } from '../shared/modal.service';
import { NotificationService } from '../shared/notification.service';
import { OIBusNorthTypeEnumPipe } from '../shared/oibus-north-type-enum.pipe';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ObservableState } from '../shared/save-button/save-button.component';
import { emptyPage } from '../shared/utils/page.utils';
import { ChooseNorthConnectorTypeModalComponent } from './choose-north-connector-type-modal/choose-north-connector-type-modal.component';

type NorthSortField = 'name' | 'type' | 'createdAt' | 'updatedAt' | null;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 15;

@Component({
  selector: 'oib-north-list',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    RouterLink,
    LoadingSpinnerComponent,
    PaginationComponent,
    AsyncPipe,
    OIBusNorthTypeEnumPipe,
    NgbTooltip,
    TranslatePipe,
    AuditInfoComponent
  ],
  templateUrl: './north-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './north-list.component.scss'
})
export class NorthListComponent {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private northConnectorService = inject(NorthConnectorService);

  readonly allNorths = signal<Array<NorthConnectorLightDTO> | null>(null);
  filteredNorths: Array<NorthConnectorLightDTO> = [];
  readonly displayedNorths = signal<Page<NorthConnectorLightDTO>>(emptyPage());
  states = new Map<string, ObservableState>();
  readonly sortField = signal<NorthSortField>('name');
  readonly sortDirection = signal<SortDirection>('asc');

  // Active filters for the clickable status/type legends. Empty array means "no filter" (show all).
  readonly activeEnabledStates = signal<Array<boolean>>([]);
  readonly activeTypes = signal<Array<OIBusNorthType>>([]);

  searchForm = inject(NonNullableFormBuilder).group({
    name: [null as string | null]
  });

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell enabled from disabled even when green and grey look the same).
  // Avoids fa-play/fa-pause/fa-toggle-* shapes, which could be mistaken for the row's own action control.
  readonly LEGEND: Array<{ label: string; enabled: boolean; class: string }> = [
    { label: 'north.disabled', enabled: false, class: 'fa-solid fa-minus-circle status-grey' },
    { label: 'north.enabled', enabled: true, class: 'fa-solid fa-check-circle status-green' }
  ];

  constructor() {
    this.northConnectorService.list().subscribe(norths => {
      this.states.clear();
      norths.forEach(north => {
        this.states.set(north.id, new ObservableState());
      });
      this.allNorths.set(norths);
      this.updateList(0);
    });

    this.searchForm.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      if (this.allNorths()) {
        this.updateList(0);
      }
    });
  }

  /** Distinct North connector types among the currently loaded connectors, used to build the filter chips. */
  readonly types = computed(() => {
    const types = new Set((this.allNorths() ?? []).map(north => north.type));
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
      .pipe(
        switchMap(() => {
          return this.northConnectorService.delete(north.id);
        })
      )
      .subscribe(() => {
        this.northConnectorService
          .list()
          .pipe(tap(() => this.allNorths.set(null)))
          .subscribe(norths => {
            this.states.clear();
            norths.forEach(north => {
              this.states.set(north.id, new ObservableState());
            });
            this.allNorths.set(norths);
            this.updateList(0);
          });
        this.notificationService.success('north.deleted', {
          name: north.name
        });
      });
  }

  /**
   * Open a modal to create a North connector
   */
  createNorth() {
    const modalRef = this.modalService.open(ChooseNorthConnectorTypeModalComponent, { size: 'xl', backdrop: 'static' });
    modalRef.result.subscribe();
  }

  /**
   * Open a modal to view the audit history of a North connector
   */
  showAudit(north: NorthConnectorLightDTO) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('north_connector', north.id);
  }

  toggleSort(field: NorthSortField) {
    if (!field) return;

    if (this.sortField() === field) {
      this.sortDirection.update(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }

    this.updateList(0);
  }

  getSortIcon(field: NorthSortField): string {
    if (this.sortField() !== field) {
      return 'fa-sort';
    }
    return this.sortDirection() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.displayedNorths.set(this.createPage(pageNumber));
  }

  private createPage(pageNumber: number): Page<NorthConnectorLightDTO> {
    return createPageFromArray(this.filteredNorths, PAGE_SIZE, pageNumber);
  }

  private updateList(pageNumber: number) {
    this.filteredNorths = this.filter(this.allNorths() ?? []);
    this.sortNorths();
    this.changePage(pageNumber);
  }

  filter(norths: Array<NorthConnectorLightDTO>): Array<NorthConnectorLightDTO> {
    const formValue = this.searchForm.value;
    let filteredItems = norths;

    if (formValue.name) {
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(formValue.name!.toLowerCase()));
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
    this.activeEnabledStates.update(activeEnabledStates =>
      activeEnabledStates.includes(enabled) ? activeEnabledStates.filter(e => e !== enabled) : [...activeEnabledStates, enabled]
    );
    this.updateList(0);
  }

  clearEnabledStates() {
    this.activeEnabledStates.set([]);
    this.updateList(0);
  }

  /** Toggles a North type in/out of the active filter and re-applies filtering. */
  toggleType(type: OIBusNorthType) {
    this.activeTypes.update(activeTypes => (activeTypes.includes(type) ? activeTypes.filter(t => t !== type) : [...activeTypes, type]));
    this.updateList(0);
  }

  clearTypes() {
    this.activeTypes.set([]);
    this.updateList(0);
  }

  private sortNorths() {
    const field = this.sortField();
    if (!field) return;

    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    this.filteredNorths = [...this.filteredNorths].sort((a, b) => {
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
        .subscribe(norths => {
          this.allNorths.set(norths);
          this.updateList(this.displayedNorths().number);
        });
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
        .subscribe(norths => {
          this.allNorths.set(norths);
          this.updateList(this.displayedNorths().number);
        });
    }
  }
}
