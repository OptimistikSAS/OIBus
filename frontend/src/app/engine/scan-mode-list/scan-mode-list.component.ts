import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { switchMap, tap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { EditScanModeModalComponent } from '../edit-scan-mode-modal/edit-scan-mode-modal.component';
import { BoxTableComponent, BoxTitleDirective } from '../../shared/box-table/box-table.component';

@Component({
  selector: 'oib-scan-mode-list',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule, BoxTableComponent, BoxTitleDirective],
  templateUrl: './scan-mode-list.component.html',
  styleUrls: ['./scan-mode-list.component.scss']
})
export class ScanModeListComponent implements OnInit {
  scanModes: Array<ScanModeDTO> = [];

  constructor(
    private confirmationService: ConfirmationService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private scanModeService: ScanModeService
  ) {}

  ngOnInit() {
    this.scanModeService.list().subscribe(scanModes => {
      this.scanModes = this.excludeSubscriptionScanModes(scanModes);
    });
  }

  /**
   * Open a modal to edit a scan mode
   */
  editScanMode(scanMode: ScanModeDTO) {
    const modalRef = this.modalService.open(EditScanModeModalComponent);
    const component: EditScanModeModalComponent = modalRef.componentInstance;
    component.prepareForEdition(scanMode);
    this.refreshAfterEditScanModeModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create a scan mode
   */
  addScanMode() {
    const modalRef = this.modalService.open(EditScanModeModalComponent);
    const component: EditScanModeModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditScanModeModalClosed(modalRef, 'created');
  }

  /**
   * Refresh the scan mode list when the scan mode is edited
   */
  private refreshAfterEditScanModeModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result
      .pipe(
        tap(scanMode =>
          this.notificationService.success(`engine.scan-mode.${mode}`, {
            name: scanMode.name
          })
        ),
        switchMap(() => this.scanModeService.list())
      )
      .subscribe(scanModes => {
        this.scanModes = this.excludeSubscriptionScanModes(scanModes);
      });
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
        switchMap(() => {
          return this.scanModeService.delete(scanMode.id);
        }),
        tap(() =>
          this.notificationService.success('engine.scan-mode.deleted', {
            name: scanMode.name
          })
        ),
        switchMap(() => this.scanModeService.list())
      )
      .subscribe(scanModes => {
        this.scanModes = this.excludeSubscriptionScanModes(scanModes);
      });
  }

  excludeSubscriptionScanModes(scanModes: Array<ScanModeDTO>): Array<ScanModeDTO> {
    return scanModes.filter(scanMode => scanMode.id !== 'subscription');
  }
}
