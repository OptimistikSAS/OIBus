import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './scan-mode-list.component.scss'
})
export class ScanModeListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly modalService = inject(ModalService);
  private readonly notificationService = inject(NotificationService);
  private readonly scanModeService = inject(ScanModeService);
  private readonly docsUrlService = inject(DocsUrlService);

  readonly helpUrl = this.docsUrlService.resolve('guide/engine/scan-modes');

  /** The service emits the scan modes again after each creation, update or deletion */
  private readonly scanModes = toSignal(this.scanModeService.list(), { initialValue: [] });
  readonly allScanModes = computed(() => this.scanModes().filter(scanMode => scanMode.id !== 'subscription'));
  readonly sortField = signal<ScanModeSortField>(null);
  readonly sortDirection = signal<SortDirection>('asc');
  /** Back to the first page when the scan modes or their order change */
  private readonly pageNumber = linkedSignal({
    source: () => ({ scanModes: this.allScanModes(), sortField: this.sortField(), sortDirection: this.sortDirection() }),
    computation: () => 0
  });
  readonly displayedScanModes = computed<Page<ScanModeDTO>>(() =>
    createPageFromArray(sortScanModes(this.allScanModes(), this.sortField(), this.sortDirection()), PAGE_SIZE, this.pageNumber())
  );

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

  private refreshAfterEditScanModeModalClosed(modalRef: Modal<EditScanModeModalComponent>, mode: 'created' | 'updated') {
    modalRef.result
      .pipe(
        tap((scanMode: ScanModeDTO) =>
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

  toggleSort(field: ScanModeSortField) {
    if (!field) return;
    if (this.sortField() === field) {
      this.sortDirection.update(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: ScanModeSortField): string {
    if (this.sortField() !== field) return 'fa-sort';
    return this.sortDirection() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.pageNumber.set(pageNumber);
  }
}

function sortScanModes(scanModes: Array<ScanModeDTO>, field: ScanModeSortField, direction: SortDirection): Array<ScanModeDTO> {
  if (!field) {
    return scanModes;
  }
  const factor = direction === 'asc' ? 1 : -1;
  return [...scanModes].sort((a, b) => {
    if (field === 'name') {
      return a.name.localeCompare(b.name) * factor;
    }
    const aVal = field === 'createdAt' ? (a.createdAt ?? '') : (a.updatedAt ?? '');
    const bVal = field === 'createdAt' ? (b.createdAt ?? '') : (b.updatedAt ?? '');
    return aVal.localeCompare(bVal) * factor;
  });
}
