import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
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
    OIBusNorthTypeEnumPipe
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
      this.filteredNorths = this.filter(norths);
      this.changePage(0);
    });

    this.searchForm.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      if (this.allNorths) {
        this.filteredNorths = this.filter(this.allNorths);
        this.changePage(0);
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
            this.filteredNorths = this.filter(this.allNorths);
            this.changePage(0);
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
    const modalRef = this.modalService.open(ChooseNorthConnectorTypeModalComponent, { size: 'xl' });
    modalRef.result.subscribe();
  }

  changePage(pageNumber: number) {
    this.displayedNorths = this.createPage(pageNumber);
  }

  private createPage(pageNumber: number): Page<NorthConnectorLightDTO> {
    return createPageFromArray(this.filteredNorths, PAGE_SIZE, pageNumber);
  }

  filter(norths: Array<NorthConnectorLightDTO>): Array<NorthConnectorLightDTO> {
    const formValue = this.searchForm.value;
    let filteredItems = norths;

    if (formValue.name) {
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(formValue.name!.toLowerCase()));
    }

    return filteredItems;
  }

  toggleConnector(northId: string, northName: string, value: boolean) {
    if (value) {
      this.northConnectorService
        .startNorth(northId)
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
          this.filteredNorths = this.filter(this.allNorths);
          this.displayedNorths = this.createPage(this.displayedNorths.number);
        });
    } else {
      this.northConnectorService
        .stopNorth(northId)
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
          this.filteredNorths = this.filter(this.allNorths);
          this.displayedNorths = this.createPage(this.displayedNorths.number);
        });
    }
  }
}
