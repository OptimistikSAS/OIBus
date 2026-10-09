import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom, switchMap } from 'rxjs';

import { IPFilterDTO } from '@oibus/shared/api/ip-filter.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';

import { EngineService } from '../../services/engine.service';
import { IpFilterService } from '../../services/ip-filter.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../../shared/audit-info/audit-info.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DocsUrlService } from '../../shared/docs-url.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { EditIpFilterModalComponent } from './edit-ip-filter-modal/edit-ip-filter-modal.component';

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
    TranslatePipe,
    PaginationComponent,
    AuditInfoComponent
  ],
  templateUrl: './ip-filter-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './ip-filter-list.component.scss'
})
export class IpFilterListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly modalService = inject(ModalService);
  private readonly notificationService = inject(NotificationService);
  private readonly ipFilterService = inject(IpFilterService);
  private readonly engineService = inject(EngineService);
  private readonly docsUrlService = inject(DocsUrlService);

  readonly helpUrl = this.docsUrlService.resolve('guide/engine/ip-filters');

  private readonly info = toSignal(this.engineService.getInfo());
  private readonly ipFiltersResource = rxResource({ stream: () => this.ipFilterService.list() });
  /** All the IP filters, displayed once the engine info is known too (kept while they are reloaded) */
  readonly allIpFilters = computed(() => (this.info() && this.ipFiltersResource.hasValue() ? this.ipFiltersResource.value() : []));
  readonly ignoreIpFilters = computed(() => this.info()?.ignoreIpFilters ?? false);
  readonly sortField = signal<IpFilterSortField>(null);
  readonly sortDirection = signal<SortDirection>('asc');
  /** Back to the first page when the IP filters or their order change */
  private readonly pageNumber = linkedSignal({
    source: () => ({ ipFilters: this.allIpFilters(), sortField: this.sortField(), sortDirection: this.sortDirection() }),
    computation: () => 0
  });
  readonly displayedIpFilters = computed<Page<IPFilterDTO>>(() =>
    createPageFromArray(sortIpFilters(this.allIpFilters(), this.sortField(), this.sortDirection()), PAGE_SIZE, this.pageNumber())
  );

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

  private refreshAfterEditIpFilterModalClosed(modalRef: Modal<EditIpFilterModalComponent>, mode: 'created' | 'updated') {
    modalRef.result.subscribe((ipFilter: IPFilterDTO) => {
      this.ipFiltersResource.reload();
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
        this.ipFiltersResource.reload();
        this.notificationService.success('engine.ip-filter.deleted', {
          address: ipFilter.address
        });
      });
  }

  /**
   * Open a modal to view the audit history of an IP filter
   */
  showAudit(ipFilter: IPFilterDTO) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('ip_filter', ipFilter.id);
  }

  toggleSort(field: IpFilterSortField) {
    if (!field) return;
    if (this.sortField() === field) {
      this.sortDirection.update(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: IpFilterSortField): string {
    if (this.sortField() !== field) return 'fa-sort';
    return this.sortDirection() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.pageNumber.set(pageNumber);
  }
}

function sortIpFilters(ipFilters: Array<IPFilterDTO>, field: IpFilterSortField, direction: SortDirection): Array<IPFilterDTO> {
  if (!field) {
    return ipFilters;
  }
  const factor = direction === 'asc' ? 1 : -1;
  return [...ipFilters].sort((a, b) => {
    if (field === 'address') {
      return a.address.localeCompare(b.address) * factor;
    }
    const aVal = field === 'createdAt' ? (a.createdAt ?? '') : (a.updatedAt ?? '');
    const bVal = field === 'createdAt' ? (b.createdAt ?? '') : (b.updatedAt ?? '');
    return aVal.localeCompare(bVal) * factor;
  });
}
