import { Component, inject, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AsyncPipe, NgClass } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ModalService } from '../shared/modal.service';
import { Router, RouterLink } from '@angular/router';
import { CreateHistoryQueryModalComponent } from './create-history-query-modal/create-history-query-modal.component';
import { HistoryQueryLightDTO, HistoryQueryStatus } from '../../../../backend/shared/model/history-query.model';
import { HistoryQueryService } from '../services/history-query.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../backend/shared/model/types';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { emptyPage } from '../shared/test-utils';
import { FormControlValidationDirective } from '../shared/form-control-validation.directive';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { EnabledEnumPipe } from '../shared/enabled-enum.pipe';
import { DatetimePipe } from '../shared/datetime.pipe';
import { ObservableState } from '../shared/save-button/save-button.component';
import { LegendComponent } from '../shared/legend/legend.component';

const PAGE_SIZE = 15;

@Component({
  selector: 'oib-history-query-list',
  imports: [
    NgClass,
    TranslateModule,
    RouterLink,
    PaginationComponent,
    FormControlValidationDirective,
    FormsModule,
    ReactiveFormsModule,
    LoadingSpinnerComponent,
    EnabledEnumPipe,
    DatetimePipe,
    AsyncPipe,
    LegendComponent
  ],
  templateUrl: './history-query-list.component.html',
  styleUrl: './history-query-list.component.scss'
})
export class HistoryQueryListComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);
  private historyQueryService = inject(HistoryQueryService);
  private router = inject(Router);

  allHistoryQueries: Array<HistoryQueryLightDTO> | null = null;
  filteredHistoryQueries: Array<HistoryQueryLightDTO> = [];
  displayedHistoryQueries: Page<HistoryQueryLightDTO> = emptyPage();
  states = new Map<string, ObservableState>();

  searchForm = inject(NonNullableFormBuilder).group({
    name: [null as string | null]
  });

  readonly LEGEND = [
    { label: 'enums.status.PENDING', class: 'grey-dot' },
    { label: 'enums.status.RUNNING', class: 'green-dot' },
    { label: 'enums.status.PAUSED', class: 'yellow-dot' },
    { label: 'enums.status.FINISHED', class: 'blue-dot' },
    { label: 'enums.status.ABORTED', class: 'red-dot' }
  ];

  ngOnInit() {
    this.historyQueryService.list().subscribe(queries => {
      this.allHistoryQueries = queries;
      this.states.clear();
      this.allHistoryQueries.forEach(historyQuery => {
        this.states.set(historyQuery.id, new ObservableState());
      });
      this.filteredHistoryQueries = this.filter(queries);
      this.changePage(0);
    });

    this.searchForm.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe(() => {
      if (this.allHistoryQueries) {
        this.filteredHistoryQueries = this.filter(this.allHistoryQueries);
        this.changePage(0);
      }
    });
  }

  delete(historyQuery: HistoryQueryLightDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'history-query.confirm-deletion',
        interpolateParams: { name: historyQuery.name }
      })
      .pipe(
        switchMap(() => {
          return this.historyQueryService.deleteHistoryQuery(historyQuery.id);
        })
      )
      .subscribe(() => {
        this.historyQueryService
          .list()
          .pipe(tap(() => (this.allHistoryQueries = null)))
          .subscribe(queries => {
            this.allHistoryQueries = queries;
            this.states.clear();
            this.allHistoryQueries.forEach(historyQuery => {
              this.states.set(historyQuery.id, new ObservableState());
            });
            this.filteredHistoryQueries = this.filter(queries);
            this.changePage(0);
          });
        this.notificationService.success('history-query.deleted', {
          name: historyQuery.name
        });
      });
  }

  createHistoryQuery() {
    const modalRef = this.modalService.open(CreateHistoryQueryModalComponent);
    modalRef.result.subscribe(queryParams => {
      this.router.navigate(['/history-queries', 'create'], { queryParams });
    });
  }

  changePage(pageNumber: number) {
    this.displayedHistoryQueries = this.createPage(pageNumber);
  }

  private createPage(pageNumber: number): Page<HistoryQueryLightDTO> {
    return createPageFromArray(this.filteredHistoryQueries, PAGE_SIZE, pageNumber);
  }

  filter(souths: Array<HistoryQueryLightDTO>): Array<HistoryQueryLightDTO> {
    const formValue = this.searchForm.value;
    let filteredItems = souths;

    if (formValue.name) {
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(formValue.name!.toLowerCase()));
    }

    return filteredItems;
  }

  toggleHistoryQuery(query: HistoryQueryLightDTO, newStatus: HistoryQueryStatus) {
    if (newStatus === 'RUNNING') {
      this.historyQueryService
        .startHistoryQuery(query.id)
        .pipe(
          this.states.get(query.id)!.pendingUntilFinalization(),
          switchMap(() => {
            return this.historyQueryService.list();
          })
        )
        .subscribe(queries => {
          this.allHistoryQueries = queries;
          this.filteredHistoryQueries = this.filter(queries);

          this.changePage(this.displayedHistoryQueries.number);
          this.notificationService.success('history-query.started', { name: query.name });
        });
    } else {
      this.historyQueryService
        .pauseHistoryQuery(query.id)
        .pipe(
          this.states.get(query.id)!.pendingUntilFinalization(),
          switchMap(() => {
            return this.historyQueryService.list();
          })
        )
        .subscribe(queries => {
          this.allHistoryQueries = queries;
          this.filteredHistoryQueries = this.filter(queries);
          this.changePage(this.displayedHistoryQueries.number);
          this.notificationService.success('history-query.paused', { name: query.name });
        });
    }
  }

  getStatusClass(status: HistoryQueryStatus) {
    const foundElement = this.LEGEND.find(element => element.label === `enums.status.${status}`);
    if (foundElement) {
      return foundElement.class;
    }
    return 'red-dot';
  }
}
