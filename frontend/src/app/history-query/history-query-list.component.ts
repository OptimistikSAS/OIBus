import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ModalService } from '../shared/modal.service';
import { Router, RouterLink } from '@angular/router';
import { NgForOf, NgIf } from '@angular/common';
import { CreateHistoryQueryModalComponent } from './create-history-query-modal/create-history-query-modal.component';
import { HistoryQueryDTO } from '../../../../shared/model/history-query.model';
import { HistoryQueryService } from '../services/history-query.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../shared/model/types';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { emptyPage } from '../shared/test-utils';
import { FormControlValidationDirective } from '../shared/form-control-validation.directive';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { EnabledEnumPipe } from '../shared/enabled-enum.pipe';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-history-query-list',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    NgIf,
    NgForOf,
    PaginationComponent,
    FormControlValidationDirective,
    FormsModule,
    ReactiveFormsModule,
    LoadingSpinnerComponent,
    EnabledEnumPipe
  ],
  templateUrl: './history-query-list.component.html',
  styleUrls: ['./history-query-list.component.scss']
})
export class HistoryQueryListComponent implements OnInit {
  allHistoryQueries: Array<HistoryQueryDTO> | null = null;
  filteredHistoryQueries: Array<HistoryQueryDTO> = [];
  displayedHistoryQueries: Page<HistoryQueryDTO> = emptyPage();

  searchForm = this.fb.group({
    name: [null as string | null]
  });

  constructor(
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService,
    private modalService: ModalService,
    private historyQueryService: HistoryQueryService,
    private router: Router,
    private fb: NonNullableFormBuilder
  ) {}

  ngOnInit() {
    this.historyQueryService.list().subscribe(queries => {
      this.allHistoryQueries = queries;
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

  deleteHistoryQuery(historyQuery: HistoryQueryDTO) {
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
            this.changePage(0);
          });
        this.notificationService.success('history-query.deleted', {
          name: historyQuery.name
        });
      });
  }

  createHistoryQuery() {
    const modalRef = this.modalService.open(CreateHistoryQueryModalComponent);
    modalRef.result.subscribe(historyQuery => {
      this.router.navigate(['history-queries', historyQuery.id]);
    });
  }

  changePage(pageNumber: number) {
    this.displayedHistoryQueries = this.createPage(pageNumber);
  }

  private createPage(pageNumber: number): Page<HistoryQueryDTO> {
    return createPageFromArray(this.filteredHistoryQueries, PAGE_SIZE, pageNumber);
  }

  filter(souths: Array<HistoryQueryDTO>): Array<HistoryQueryDTO> {
    const formValue = this.searchForm.value;
    let filteredItems = souths;

    if (formValue.name) {
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(formValue.name!.toLowerCase()));
    }

    return filteredItems;
  }
}
