import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { OIBusSouthType, SouthConnectorLightDTO } from '../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../services/south-connector.service';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ModalService } from '../shared/modal.service';
import { ChooseSouthConnectorTypeModalComponent } from './choose-south-connector-type-modal/choose-south-connector-type-modal.component';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { createPageFromArray, Page } from '../../../../backend/shared/model/types';
import { emptyPage } from '../shared/test-utils';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ObservableState } from '../shared/save-button/save-button.component';
import { OIBusSouthTypeEnumPipe } from '../shared/oibus-south-type-enum.pipe';
import { FormControlValidationDirective } from '../shared/form/form-control-validation.directive';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';

type SouthSortField = 'name' | 'type' | 'createdAt' | 'updatedAt' | null;
type SortDirection = 'asc' | 'desc';
const PAGE_SIZE = 15;

@Component({
  selector: 'oib-south-list',
  imports: [
    TranslateDirective,
    RouterLink,
    FormControlValidationDirective,
    FormsModule,
    LoadingSpinnerComponent,
    ReactiveFormsModule,
    PaginationComponent,
    AsyncPipe,
    OIBusSouthTypeEnumPipe,
    NgbTooltip,
    TranslatePipe,
    AuditInfoComponent
  ],
  templateUrl: './south-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './south-list.component.scss'
})
export class SouthListComponent {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private southConnectorService = inject(SouthConnectorService);

  allSouths: Array<SouthConnectorLightDTO> | null = null;
  filteredSouths: Array<SouthConnectorLightDTO> = [];
  displayedSouths: Page<SouthConnectorLightDTO> = emptyPage();
  states = new Map<string, ObservableState>();
  sortField: SouthSortField = 'name';
  sortDirection: SortDirection = 'asc';

  // Active filters for the clickable status/type legends. Empty array means "no filter" (show all).
  activeEnabledStates: Array<boolean> = [];
  activeTypes: Array<OIBusSouthType> = [];

  searchForm = inject(NonNullableFormBuilder).group({
    name: [null as string | null]
  });

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell enabled from disabled even when green and grey look the same).
  // Avoids fa-play/fa-pause/fa-toggle-* shapes, which could be mistaken for the row's own action control.
  readonly LEGEND: Array<{ label: string; enabled: boolean; class: string }> = [
    { label: 'south.disabled', enabled: false, class: 'fa fa-minus-circle status-grey' },
    { label: 'south.enabled', enabled: true, class: 'fa fa-check-circle status-green' }
  ];

  constructor() {
    this.southConnectorService.list().subscribe(souths => {
      this.allSouths = souths;
      this.states.clear();
      this.allSouths.forEach(south => {
        this.states.set(south.id, new ObservableState());
      });
      this.updateList(0);
    });

    this.searchForm.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      if (this.allSouths) {
        this.updateList(0);
      }
    });
  }

  /** Distinct South connector types among the currently loaded connectors, used to build the filter chips. */
  get types(): Array<OIBusSouthType> {
    const types = new Set((this.allSouths ?? []).map(south => south.type));
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Delete a South connector by its ID
   */
  deleteSouth(south: SouthConnectorLightDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.confirm-deletion',
        interpolateParams: { name: south.name }
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.delete(south.id);
        })
      )
      .subscribe(() => {
        this.southConnectorService
          .list()
          .pipe(tap(() => (this.allSouths = null)))
          .subscribe(southList => {
            this.allSouths = southList;
            this.states.clear();
            this.allSouths.forEach(south => {
              this.states.set(south.id, new ObservableState());
            });
            this.updateList(0);
          });
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
    const modalRef = this.modalService.open(AuditHistoryModalComponent);
    modalRef.componentInstance.prepare('south_connector', south.id);
  }

  toggleSort(field: SouthSortField) {
    if (!field) return;

    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.updateList(0);
  }

  getSortIcon(field: SouthSortField): string {
    if (this.sortField !== field) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc';
  }

  changePage(pageNumber: number) {
    this.displayedSouths = this.createPage(pageNumber);
  }

  private createPage(pageNumber: number): Page<SouthConnectorLightDTO> {
    return createPageFromArray(this.filteredSouths, PAGE_SIZE, pageNumber);
  }

  private updateList(pageNumber: number) {
    this.filteredSouths = this.filter(this.allSouths ?? []);
    this.sortSouths();
    this.changePage(pageNumber);
  }

  filter(souths: Array<SouthConnectorLightDTO>): Array<SouthConnectorLightDTO> {
    const formValue = this.searchForm.value;
    let filteredItems = souths;

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

  /** Toggles a South type in/out of the active filter and re-applies filtering. */
  toggleType(type: OIBusSouthType) {
    this.activeTypes = this.activeTypes.includes(type) ? this.activeTypes.filter(t => t !== type) : [...this.activeTypes, type];
    this.updateList(0);
  }

  clearTypes() {
    this.activeTypes = [];
    this.updateList(0);
  }

  private sortSouths() {
    if (!this.sortField) return;

    const direction = this.sortDirection === 'asc' ? 1 : -1;
    const field = this.sortField;
    this.filteredSouths = [...this.filteredSouths].sort((a, b) => {
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

  toggleConnector(southId: string, northName: string, value: boolean) {
    if (value) {
      this.southConnectorService
        .start(southId)
        .pipe(
          this.states.get(southId)!.pendingUntilFinalization(),
          tap(() => {
            this.notificationService.success('south.started', { name: northName });
          }),
          switchMap(() => {
            return this.southConnectorService.list();
          })
        )
        .subscribe(souths => {
          this.allSouths = souths;
          this.updateList(this.displayedSouths.number);
        });
    } else {
      this.southConnectorService
        .stop(southId)
        .pipe(
          this.states.get(southId)!.pendingUntilFinalization(),
          tap(() => {
            this.notificationService.success('south.stopped', { name: northName });
          }),
          switchMap(() => {
            return this.southConnectorService.list();
          })
        )
        .subscribe(souths => {
          this.allSouths = souths;
          this.updateList(this.displayedSouths.number);
        });
    }
  }
}
