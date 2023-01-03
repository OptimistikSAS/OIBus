import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { switchMap } from 'rxjs';
import { Modal, ModalService } from '../../components/shared/modal.service';
import { ConfirmationService } from '../../components/shared/confirmation.service';
import { NotificationService } from '../../components/shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { ScanModeDTO } from '../../model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { EditScanModeModalComponent } from '../edit-scan-mode-modal/edit-scan-mode-modal.component';

@Component({
  selector: 'oib-scan-mode-list',
  standalone: true,
  imports: [NgIf, NgForOf, TranslateModule],
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
    this.scanModeService.getScanModes().subscribe(scanModeList => {
      this.scanModes = scanModeList;
    });
  }

  /**
   * Open a modal to edit a scan mode
   */
  openEditScanModeModal(scanMode: ScanModeDTO) {
    const modalRef = this.modalService.open(EditScanModeModalComponent);
    const component: EditScanModeModalComponent = modalRef.componentInstance;
    component.prepareForEdition(scanMode);
    this.refreshAfterEditScanModeModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create a scan mode
   */
  openCreationScanModeModal() {
    const modalRef = this.modalService.open(EditScanModeModalComponent);
    const component: EditScanModeModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditScanModeModalClosed(modalRef, 'created');
  }

  /**
   * Refresh the scan mode list when the scan mode is edited
   */
  private refreshAfterEditScanModeModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe((scanMode: ScanModeDTO) => {
      this.scanModeService.getScanModes().subscribe(scanModes => {
        this.scanModes = scanModes;
      });
      this.notificationService.success(`engine.scan-mode.${mode}`, {
        name: scanMode.name
      });
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
          return this.scanModeService.deleteScanMode(scanMode.id);
        })
      )
      .subscribe(() => {
        this.scanModeService.getScanModes().subscribe(scanModes => {
          this.scanModes = scanModes;
        });
        this.notificationService.success('engine.scan-mode.deleted', {
          name: scanMode.name
        });
      });
  }
}
