import { Component, OnInit, inject } from '@angular/core';

import { firstValueFrom, switchMap, tap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { EditScanModeModalComponent } from './edit-scan-mode-modal/edit-scan-mode-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { DatetimePipe } from '../../shared/datetime.pipe';

type ScanModeSortField = 'name' | 'createdAt' | 'updatedAt' | null;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-scan-mode-list',
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
  templateUrl: './scan-mode-list.component.html',
  styleUrl: './scan-mode-list.component.scss'
})
export class ScanModeListComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private scanModeService = inject(ScanModeService);

  allScanModes: Array<ScanModeDTO> = [];
  private filteredScanModes: Array<ScanModeDTO> = [];
  displayedScanModes: Page<ScanModeDTO> = emptyPage();
  sortField: ScanModeSortField = null;
  sortDirection: SortDirection = 'asc';

  ngOnInit() {
    this.scanModeService.list().subscribe(scanModes => {
      this.allScanModes = this.excludeSubscriptionScanModes(scanModes);
      this.updateList(0);
    });
  }

  /**
   * Open a modal to edit a scan mode
   */
  editScanMode(scanMode: ScanModeDTO) {
    const modalRef = this.modalService.open(EditScanModeModalComponent, {
      beforeDismiss: () => {
        const component: EditScanModeModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditScanModeModalComponent = modalRef.componentInstance;
    component.prepareForEdition(scanMode);
    this.refreshAfterEditScanModeModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create a scan mode
   */
  addScanMode() {
    const modalRef = this.modalService.open(EditScanModeModalComponent, {
      beforeDismiss: () => {
        const component: EditScanModeModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditScanModeModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditScanModeModalClosed(modalRef, 'created');
  }

  private refreshAfterEditScanModeModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result
      .pipe(
        tap(scanMode =>
          this.notificationService.success(`engine.scan-mode.${mode}`, {
            name: scanMode.name
          })
        )
      )
      .subscribe();
  }

  /**
   * Delete a scan mode by its ID
   */
  deleteScanMode(scanMode: ScanModeDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'engine.scan-mode.confirm-deletion',
        interpolateParams: { name: scanMode.name }
      })
      .pipe(
        switchMap(() => this.scanModeService.delete(scanMode.id)),
        tap(() =>
          this.notificationService.success('engine.scan-mode.deleted', {
            name: scanMode.name
          })
        )
      )
      .subscribe();
  }

  excludeSubscriptionScanModes(scanModes: Array<ScanModeDTO>): Array<ScanModeDTO> {
    return scanModes.filter(scanMode => scanMode.id !== 'subscription');
  }

  toggleSort(field: ScanModeSortField) {
    if (!field) return;
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.updateList(0);
  }

  getSortIcon(field: ScanModeSortField): string {
    if (this.sortField !== field) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc';
  }

  changePage(pageNumber: number) {
    this.displayedScanModes = createPageFromArray(this.filteredScanModes, PAGE_SIZE, pageNumber);
  }

  private updateList(pageNumber: number) {
    this.filteredScanModes = [...this.allScanModes];
    this.sortList();
    this.changePage(pageNumber);
  }

  private sortList() {
    if (!this.sortField) return;
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    this.filteredScanModes = [...this.filteredScanModes].sort((a, b) => {
      if (this.sortField === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }
      const aVal = this.sortField === 'createdAt' ? (a.createdAt ?? '') : (a.updatedAt ?? '');
      const bVal = this.sortField === 'createdAt' ? (b.createdAt ?? '') : (b.updatedAt ?? '');
      return aVal.localeCompare(bVal) * direction;
    });
  }
}
