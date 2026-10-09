import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';

import { SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';

import { SouthConnectorService } from '../services/south-connector.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../shared/audit-info/audit-info.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { FormControlValidationDirective } from '../shared/form/form-control-validation.directive';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { ModalService } from '../shared/modal.service';
import { NotificationService } from '../shared/notification.service';
import { OIBusSouthTypeEnumPipe } from '../shared/oibus-south-type-enum.pipe';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ObservableState } from '../shared/save-button/save-button.component';
import { emptyPage } from '../shared/utils/page.utils';
import { ChooseSouthConnectorTypeModalComponent } from './choose-south-connector-type-modal/choose-south-connector-type-modal.component';

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

  readonly allSouths = signal<Array<SouthConnectorLightDTO> | null>(null);
  filteredSouths: Array<SouthConnectorLightDTO> = [];
  readonly displayedSouths = signal<Page<SouthConnectorLightDTO>>(emptyPage());
  states = new Map<string, ObservableState>();
  readonly sortField = signal<SouthSortField>('name');
  readonly sortDirection = signal<SortDirection>('asc');

  // Active filters for the clickable status/type legends. Empty array means "no filter" (show all).
  readonly activeEnabledStates = signal<Array<boolean>>([]);
  readonly activeTypes = signal<Array<OIBusSouthType>>([]);

  searchForm = inject(NonNullableFormBuilder).group({
    name: [null as string | null]
  });

  // Each status pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell enabled from disabled even when green and grey look the same).
  // Avoids fa-play/fa-pause/fa-toggle-* shapes, which could be mistaken for the row's own action control.
  readonly LEGEND: Array<{ label: string; enabled: boolean; class: string }> = [
    { label: 'south.disabled', enabled: false, class: 'fa-solid fa-minus-circle status-grey' },
    { label: 'south.enabled', enabled: true, class: 'fa-solid fa-check-circle status-green' }
  ];

  constructor() {
    this.southConnectorService.list().subscribe(souths => {
      this.states.clear();
      souths.forEach(south => {
        this.states.set(south.id, new ObservableState());
      });
      this.allSouths.set(souths);
      this.updateList(0);
    });

    this.searchForm.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      if (this.allSouths()) {
        this.updateList(0);
      }
    });
  }

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
      .pipe(
        switchMap(() => {
          return this.southConnectorService.delete(south.id);
        })
      )
      .subscribe(() => {
        this.southConnectorService
          .list()
          .pipe(tap(() => this.allSouths.set(null)))
          .subscribe(southList => {
            this.states.clear();
            southList.forEach(south => {
              this.states.set(south.id, new ObservableState());
            });
            this.allSouths.set(southList);
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

    this.updateList(0);
  }

  getSortIcon(field: SouthSortField): string {
    if (this.sortField() !== field) {
      return 'fa-sort';
    }
    return this.sortDirection() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.displayedSouths.set(this.createPage(pageNumber));
  }

  private createPage(pageNumber: number): Page<SouthConnectorLightDTO> {
    return createPageFromArray(this.filteredSouths, PAGE_SIZE, pageNumber);
  }

  private updateList(pageNumber: number) {
    this.filteredSouths = this.filter(this.allSouths() ?? []);
    this.sortSouths();
    this.changePage(pageNumber);
  }

  filter(souths: Array<SouthConnectorLightDTO>): Array<SouthConnectorLightDTO> {
    const formValue = this.searchForm.value;
    let filteredItems = souths;

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
    this.activeEnabledStates.update(states => (states.includes(enabled) ? states.filter(e => e !== enabled) : [...states, enabled]));
    this.updateList(0);
  }

  clearEnabledStates() {
    this.activeEnabledStates.set([]);
    this.updateList(0);
  }

  /** Toggles a South type in/out of the active filter and re-applies filtering. */
  toggleType(type: OIBusSouthType) {
    this.activeTypes.update(types => (types.includes(type) ? types.filter(t => t !== type) : [...types, type]));
    this.updateList(0);
  }

  clearTypes() {
    this.activeTypes.set([]);
    this.updateList(0);
  }

  private sortSouths() {
    const field = this.sortField();
    if (!field) return;

    const direction = this.sortDirection() === 'asc' ? 1 : -1;
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
          this.allSouths.set(souths);
          this.updateList(this.displayedSouths().number);
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
          this.allSouths.set(souths);
          this.updateList(this.displayedSouths().number);
        });
    }
  }
}
