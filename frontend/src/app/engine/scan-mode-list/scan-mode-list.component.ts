import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom, switchMap, tap } from 'rxjs';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';

import { ScanModeService } from '../../services/scan-mode.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../../shared/audit-info/audit-info.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DocsUrlService } from '../../shared/docs-url.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { isScanModeWindowExpired, ScanModeSchedulePipe } from '../../shared/scan-mode-schedule.pipe';
import { emptyPage } from '../../shared/utils/page.utils';
import { EditScanModeModalComponent } from './edit-scan-mode-modal/edit-scan-mode-modal.component';

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
    TranslatePipe,
    PaginationComponent,
    AuditInfoComponent,
    ScanModeSchedulePipe
  ],
  templateUrl: './scan-mode-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './scan-mode-list.component.scss'
})
export class ScanModeListComponent {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private scanModeService = inject(ScanModeService);
  private docsUrlService = inject(DocsUrlService);

  readonly helpUrl = this.docsUrlService.resolve('guide/engine/scan-modes');

  readonly allScanModes = signal<Array<ScanModeDTO>>([]);
  private filteredScanModes: Array<ScanModeDTO> = [];
  readonly displayedScanModes = signal<Page<ScanModeDTO>>(emptyPage());
  readonly sortField = signal<ScanModeSortField>(null);
  readonly sortDirection = signal<SortDirection>('asc');

  constructor() {
    this.scanModeService.list().subscribe(scanModes => {
      this.allScanModes.set(this.excludeSubscriptionScanModes(scanModes));
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

  /**
   * Open a modal to view the audit history of a scan mode
   */
  showAudit(scanMode: ScanModeDTO) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('scan_mode', scanMode.id);
  }

  isWindowExpired(scanMode: ScanModeDTO): boolean {
    return isScanModeWindowExpired(scanMode);
  }

  excludeSubscriptionScanModes(scanModes: Array<ScanModeDTO>): Array<ScanModeDTO> {
    return scanModes.filter(scanMode => scanMode.id !== 'subscription');
  }

  toggleSort(field: ScanModeSortField) {
    if (!field) return;
    if (this.sortField() === field) {
      this.sortDirection.update(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.updateList(0);
  }

  getSortIcon(field: ScanModeSortField): string {
    if (this.sortField() !== field) return 'fa-sort';
    return this.sortDirection() === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc';
  }

  changePage(pageNumber: number) {
    this.displayedScanModes.set(createPageFromArray(this.filteredScanModes, PAGE_SIZE, pageNumber));
  }

  private updateList(pageNumber: number) {
    this.filteredScanModes = [...this.allScanModes()];
    this.sortList();
    this.changePage(pageNumber);
  }

  private sortList() {
    const field = this.sortField();
    if (!field) return;
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    this.filteredScanModes = [...this.filteredScanModes].sort((a, b) => {
      if (field === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }
      const aVal = field === 'createdAt' ? (a.createdAt ?? '') : (a.updatedAt ?? '');
      const bVal = field === 'createdAt' ? (b.createdAt ?? '') : (b.updatedAt ?? '');
      return aVal.localeCompare(bVal) * direction;
    });
  }
}
