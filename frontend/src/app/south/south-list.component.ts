import { Component, inject, OnInit } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { SouthConnectorLightDTO } from '../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../services/south-connector.service';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ModalService } from '../shared/modal.service';
import { ChooseSouthConnectorTypeModalComponent } from './choose-south-connector-type-modal/choose-south-connector-type-modal.component';
import { FormControlValidationDirective } from '../shared/form-control-validation.directive';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { createPageFromArray, Page } from '../../../../backend/shared/model/types';
import { emptyPage } from '../shared/test-utils';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ObservableState } from '../shared/save-button/save-button.component';
import { LegendComponent } from '../shared/legend/legend.component';

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
    LegendComponent
  ],
  templateUrl: './south-list.component.html',
  styleUrl: './south-list.component.scss'
})
export class SouthListComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private southConnectorService = inject(SouthConnectorService);

  allSouths: Array<SouthConnectorLightDTO> | null = null;
  private filteredSouths: Array<SouthConnectorLightDTO> = [];
  displayedSouths: Page<SouthConnectorLightDTO> = emptyPage();
  states = new Map<string, ObservableState>();

  searchForm = inject(NonNullableFormBuilder).group({
    name: [null as string | null]
  });

  readonly LEGEND = [
    { label: 'south.disabled', class: 'grey-dot' },
    { label: 'south.enabled', class: 'green-dot' }
  ];

  ngOnInit() {
    this.southConnectorService.list().subscribe(souths => {
      this.allSouths = souths;
      this.states.clear();
      this.allSouths.forEach(south => {
        this.states.set(south.id, new ObservableState());
      });
      this.filteredSouths = this.filter(souths);
      this.changePage(0);
    });

    this.searchForm.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      if (this.allSouths) {
        this.filteredSouths = this.filter(this.allSouths);
        this.changePage(0);
      }
    });
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
            this.filteredSouths = this.filter(this.allSouths);
            this.changePage(0);
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
    const modalRef = this.modalService.open(ChooseSouthConnectorTypeModalComponent, { size: 'xl' });
    modalRef.result.subscribe();
  }

  changePage(pageNumber: number) {
    this.displayedSouths = this.createPage(pageNumber);
  }

  private createPage(pageNumber: number): Page<SouthConnectorLightDTO> {
    return createPageFromArray(this.filteredSouths, PAGE_SIZE, pageNumber);
  }

  filter(souths: Array<SouthConnectorLightDTO>): Array<SouthConnectorLightDTO> {
    const formValue = this.searchForm.value;
    let filteredItems = souths;

    if (formValue.name) {
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(formValue.name!.toLowerCase()));
    }

    return filteredItems;
  }

  toggleConnector(southId: string, northName: string, value: boolean) {
    if (value) {
      this.southConnectorService
        .startSouth(southId)
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
          this.filteredSouths = this.filter(this.allSouths);
          this.displayedSouths = this.createPage(this.displayedSouths.number);
        });
    } else {
      this.southConnectorService
        .stopSouth(southId)
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
          this.filteredSouths = this.filter(this.allSouths);
          this.displayedSouths = this.createPage(this.displayedSouths.number);
        });
    }
  }
}
