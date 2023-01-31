import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { switchMap } from 'rxjs';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ModalService } from '../shared/modal.service';
import { Router, RouterLink } from '@angular/router';
import { NgForOf, NgIf } from '@angular/common';
import { CreateHistoryQueryModalComponent } from './create-history-query-modal/create-history-query-modal.component';
import { HistoryQueryDTO } from '../../../../shared/model/history-query.model';
import { HistoryQueryService } from '../services/history-query.service';

@Component({
  selector: 'oib-history-query-list',
  standalone: true,
  imports: [TranslateModule, RouterLink, NgIf, NgForOf],
  templateUrl: './history-query-list.component.html',
  styleUrls: ['./history-query-list.component.scss']
})
export class HistoryQueryListComponent implements OnInit {
  historyQueryList: Array<HistoryQueryDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService,
    private modalService: ModalService,
    private historyQueryService: HistoryQueryService,
    private router: Router
  ) {}

  ngOnInit() {
    this.historyQueryService.getHistoryQueries().subscribe(connectors => {
      this.historyQueryList = connectors;
    });
  }

  /**
   * Delete a History query by its ID
   */
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
        this.historyQueryService.getHistoryQueries().subscribe(historyQueryList => {
          this.historyQueryList = historyQueryList;
        });
        this.notificationService.success('history-query.deleted', {
          name: historyQuery.name
        });
      });
  }

  /**
   * Open a modal to create a History query
   */
  openCreationHistoryQueryModal() {
    const modalRef = this.modalService.open(CreateHistoryQueryModalComponent);
    modalRef.result.subscribe(queryParams => {
      this.router.navigate(['/history-queries', 'create'], { queryParams });
    });
  }
}
