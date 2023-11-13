import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { switchMap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { IpFilterService } from '../../services/ip-filter.service';
import { IpFilterDTO } from '../../../../../shared/model/ip-filter.model';
import { EditIpFilterModalComponent } from '../edit-ip-filter-modal/edit-ip-filter-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';

@Component({
  selector: 'oib-ip-filter-list',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule, BoxComponent, BoxTitleDirective],
  templateUrl: './ip-filter-list.component.html',
  styleUrl: './ip-filter-list.component.scss'
})
export class IpFilterListComponent implements OnInit {
  ipFilters: Array<IpFilterDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private ipFilterService: IpFilterService
  ) {}

  ngOnInit() {
    this.ipFilterService.list().subscribe(ipFilterList => {
      this.ipFilters = ipFilterList;
    });
  }

  /**
   * Open a modal to edit an IP filter
   */
  editIpFilter(ipFilter: IpFilterDTO) {
    const modalRef = this.modalService.open(EditIpFilterModalComponent);
    const component: EditIpFilterModalComponent = modalRef.componentInstance;
    component.prepareForEdition(ipFilter);
    this.refreshAfterEditIpFilterModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create an IP filter
   */
  addIpFilter() {
    const modalRef = this.modalService.open(EditIpFilterModalComponent);
    const component: EditIpFilterModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditIpFilterModalClosed(modalRef, 'created');
  }

  /**
   * Refresh the IP filter list when the IP filter is edited
   */
  private refreshAfterEditIpFilterModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe((ipFilter: IpFilterDTO) => {
      this.ipFilterService.list().subscribe(ipFilters => {
        this.ipFilters = ipFilters;
      });
      this.notificationService.success(`engine.ip-filter.${mode}`, {
        address: ipFilter.address
      });
    });
  }

  /**
   * Delete an IP Filter by its ID
   */
  deleteIpFilter(ipFilter: IpFilterDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'engine.ip-filter.confirm-deletion',
        interpolateParams: { address: ipFilter.address }
      })
      .pipe(
        switchMap(() => {
          return this.ipFilterService.delete(ipFilter.id);
        })
      )
      .subscribe(() => {
        this.ipFilterService.list().subscribe(ipFilters => {
          this.ipFilters = ipFilters;
        });
        this.notificationService.success('engine.ip-filter.deleted', {
          address: ipFilter.address
        });
      });
  }
}
