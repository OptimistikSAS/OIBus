import { Component, OnInit, inject } from '@angular/core';

import { firstValueFrom, switchMap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { IpFilterService } from '../../services/ip-filter.service';
import { IPFilterDTO } from '../../../../../backend/shared/model/ip-filter.model';
import { EditIpFilterModalComponent } from './edit-ip-filter-modal/edit-ip-filter-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { DatetimePipe } from '../../shared/datetime.pipe';

type IpFilterSortField = 'address' | 'createdAt' | 'updatedAt' | null;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-ip-filter-list',
  imports: [
    TranslateDirective,
    BoxComponent,
    BoxTitleDirective,
    OibHelpComponent,
    NgbTooltip,
    TranslateModule,
    PaginationComponent,
    DatetimePipe
  ],
  templateUrl: './ip-filter-list.component.html',
  styleUrl: './ip-filter-list.component.scss'
})
export class IpFilterListComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private ipFilterService = inject(IpFilterService);

  allIpFilters: Array<IPFilterDTO> = [];
  private filteredIpFilters: Array<IPFilterDTO> = [];
  displayedIpFilters: Page<IPFilterDTO> = emptyPage();
  sortField: IpFilterSortField = null;
  sortDirection: SortDirection = 'asc';

  ngOnInit() {
    this.ipFilterService.list().subscribe(ipFilterList => {
      this.allIpFilters = ipFilterList;
      this.updateList(0);
    });
  }

  /**
   * Open a modal to edit an IP filter
   */
  editIpFilter(ipFilter: IPFilterDTO) {
    const modalRef = this.modalService.open(EditIpFilterModalComponent, {
      beforeDismiss: () => {
        const component: EditIpFilterModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditIpFilterModalComponent = modalRef.componentInstance;
    component.prepareForEdition(ipFilter);
    this.refreshAfterEditIpFilterModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create an IP filter
   */
  addIpFilter() {
    const modalRef = this.modalService.open(EditIpFilterModalComponent, {
      beforeDismiss: () => {
        const component: EditIpFilterModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditIpFilterModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditIpFilterModalClosed(modalRef, 'created');
  }

  private refreshAfterEditIpFilterModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe((ipFilter: IPFilterDTO) => {
      this.ipFilterService.list().subscribe(ipFilters => {
        this.allIpFilters = ipFilters;
        this.updateList(0);
      });
      this.notificationService.success(`engine.ip-filter.${mode}`, {
        address: ipFilter.address
      });
    });
  }

  /**
   * Delete an IP Filter by its ID
   */
  deleteIpFilter(ipFilter: IPFilterDTO) {
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
          this.allIpFilters = ipFilters;
          this.updateList(0);
        });
        this.notificationService.success('engine.ip-filter.deleted', {
          address: ipFilter.address
        });
      });
  }

  toggleSort(field: IpFilterSortField) {
    if (!field) return;
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.updateList(0);
  }

  getSortIcon(field: IpFilterSortField): string {
    if (this.sortField !== field) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc';
  }

  changePage(pageNumber: number) {
    this.displayedIpFilters = createPageFromArray(this.filteredIpFilters, PAGE_SIZE, pageNumber);
  }

  private updateList(pageNumber: number) {
    this.filteredIpFilters = [...this.allIpFilters];
    this.sortList();
    this.changePage(pageNumber);
  }

  private sortList() {
    if (!this.sortField) return;
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    this.filteredIpFilters = [...this.filteredIpFilters].sort((a, b) => {
      if (this.sortField === 'address') {
        return a.address.localeCompare(b.address) * direction;
      }
      const aVal = this.sortField === 'createdAt' ? (a.createdAt ?? '') : (a.updatedAt ?? '');
      const bVal = this.sortField === 'createdAt' ? (b.createdAt ?? '') : (b.updatedAt ?? '');
      return aVal.localeCompare(bVal) * direction;
    });
  }
}
