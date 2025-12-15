import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ModalService } from '../shared/modal.service';
import { NorthConnectorLightDTO } from '../../../../backend/shared/model/north-connector.model';
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
import { LegendComponent } from '../shared/legend/legend.component';
import { OIBusNorthTypeEnumPipe } from '../shared/oibus-north-type-enum.pipe';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

type NorthSortField = 'name' | 'type' | null;
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
    LegendComponent,
    OIBusNorthTypeEnumPipe,
    NgbTooltip,
    TranslateModule
  ],
  templateUrl: './north-list.component.html',
  styleUrl: './north-list.component.scss'
})
export class NorthListComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private northConnectorService = inject(NorthConnectorService);

  allNorths: Array<NorthConnectorLightDTO> | null = null;
  private filteredNorths: Array<NorthConnectorLightDTO> = [];
  displayedNorths: Page<NorthConnectorLightDTO> = emptyPage();
  states = new Map<string, ObservableState>();
  sortField: NorthSortField = null;
  sortDirection: SortDirection = 'asc';

  searchForm = inject(NonNullableFormBuilder).group({
    name: [null as string | null]
  });

  readonly LEGEND = [
    { label: 'north.disabled', class: 'grey-dot' },
    { label: 'north.enabled', class: 'green-dot' }
  ];

  ngOnInit() {
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

    return filteredItems;
  }

  private sortNorths() {
    if (!this.sortField) return;

    const direction = this.sortDirection === 'asc' ? 1 : -1;
    this.filteredNorths = [...this.filteredNorths].sort((a, b) => {
      const aValue = this.sortField === 'name' ? a.name : a.type;
      const bValue = this.sortField === 'name' ? b.name : b.type;
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
