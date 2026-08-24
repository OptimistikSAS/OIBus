import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ModalService } from '../shared/modal.service';
import { NorthConnectorLightDTO, OIBusNorthType } from '../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../services/north-connector.service';
import { ChooseNorthConnectorTypeModalComponent } from './choose-north-connector-type-modal/choose-north-connector-type-modal.component';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { createPageFromArray, Page } from '../../../../backend/shared/model/types';
import { emptyPage } from '../shared/test-utils';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ObservableState } from '../shared/save-button/save-button.component';
import { OIBusNorthTypeEnumPipe } from '../shared/oibus-north-type-enum.pipe';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';

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

  allNorths: Array<NorthConnectorLightDTO> | null = null;
  filteredNorths: Array<NorthConnectorLightDTO> = [];
  displayedNorths: Page<NorthConnectorLightDTO> = emptyPage();
  states = new Map<string, ObservableState>();
  sortField: NorthSortField = 'name';
  sortDirection: SortDirection = 'asc';

  // Active filters for the clickable status/type legends. Empty array means "no filter" (show all).
  activeEnabledStates: Array<boolean> = [];
  activeTypes: Array<OIBusNorthType> = [];

  searchForm = inject(NonNullableFormBuilder).group({
    name: [null as string | null]
  });

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell enabled from disabled even when green and grey look the same).
  // Avoids fa-play/fa-pause/fa-toggle-* shapes, which could be mistaken for the row's own action control.
  readonly LEGEND: Array<{ label: string; enabled: boolean; class: string }> = [
    { label: 'north.disabled', enabled: false, class: 'fa fa-minus-circle status-grey' },
    { label: 'north.enabled', enabled: true, class: 'fa fa-check-circle status-green' }
  ];

  constructor() {
    this.northConnectorService.list().subscribe(norths => {
      this.allNorths = norths;
      this.states.clear();
      this.allNorths.forEach(north => {
        this.states.set(north.id, new ObservableState());
      });
      this.updateList(0);
    });

    this.searchForm.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      if (this.allNorths) {
        this.updateList(0);
      }
    });
  }

  /** Distinct North connector types among the currently loaded connectors, used to build the filter chips. */
  get types(): Array<OIBusNorthType> {
    const types = new Set((this.allNorths ?? []).map(north => north.type));
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }

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
          .pipe(tap(() => (this.allNorths = null)))
          .subscribe(norths => {
            this.allNorths = norths;
            this.states.clear();
            this.allNorths.forEach(north => {
              this.states.set(north.id, new ObservableState());
            });
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
    const modalRef = this.modalService.open(AuditHistoryModalComponent);
    modalRef.componentInstance.prepare('north_connector', north.id);
  }

  toggleSort(field: NorthSortField) {
    if (!field) return;

    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.updateList(0);
  }

  getSortIcon(field: NorthSortField): string {
    if (this.sortField !== field) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc';
  }

  changePage(pageNumber: number) {
    this.displayedNorths = this.createPage(pageNumber);
  }

  private createPage(pageNumber: number): Page<NorthConnectorLightDTO> {
    return createPageFromArray(this.filteredNorths, PAGE_SIZE, pageNumber);
  }

  private updateList(pageNumber: number) {
    this.filteredNorths = this.filter(this.allNorths ?? []);
    this.sortNorths();
    this.changePage(pageNumber);
  }

  filter(norths: Array<NorthConnectorLightDTO>): Array<NorthConnectorLightDTO> {
    const formValue = this.searchForm.value;
    let filteredItems = norths;

    if (formValue.name) {
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(formValue.name!.toLowerCase()));
    }
    if (this.activeEnabledStates.length > 0) {
      filteredItems = filteredItems.filter(item => this.activeEnabledStates.includes(item.enabled));
    }
    if (this.activeTypes.length > 0) {
      filteredItems = filteredItems.filter(item => this.activeTypes.includes(item.type));
    }

    return filteredItems;
  }

  /** Toggles an enabled/disabled state in/out of the active status filter and re-applies filtering. */
  toggleEnabledState(enabled: boolean) {
    this.activeEnabledStates = this.activeEnabledStates.includes(enabled)
      ? this.activeEnabledStates.filter(e => e !== enabled)
      : [...this.activeEnabledStates, enabled];
    this.updateList(0);
  }

  clearEnabledStates() {
    this.activeEnabledStates = [];
    this.updateList(0);
  }

  /** Toggles a North type in/out of the active filter and re-applies filtering. */
  toggleType(type: OIBusNorthType) {
    this.activeTypes = this.activeTypes.includes(type) ? this.activeTypes.filter(t => t !== type) : [...this.activeTypes, type];
    this.updateList(0);
  }

  clearTypes() {
    this.activeTypes = [];
    this.updateList(0);
  }

  private sortNorths() {
    if (!this.sortField) return;

    const direction = this.sortDirection === 'asc' ? 1 : -1;
    const field = this.sortField;
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
          this.allNorths = norths;
          this.updateList(this.displayedNorths.number);
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
          this.allNorths = norths;
          this.updateList(this.displayedNorths.number);
        });
    }
  }
}
