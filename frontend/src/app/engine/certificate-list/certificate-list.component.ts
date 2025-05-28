import { Component, inject } from '@angular/core';
import { startWith, Subject, switchMap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateDirective } from '@ngx-translate/core';
import { CertificateService } from '../../services/certificate.service';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { EditCertificateModalComponent } from './edit-certificate-modal/edit-certificate-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { ClipboardCopyDirective } from '../../shared/clipboard-copy-directive';
import { DownloadService } from '../../services/download.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'oib-certificate-list',
  imports: [TranslateDirective, BoxComponent, BoxTitleDirective, DatetimePipe, ClipboardCopyDirective, OibHelpComponent],
  templateUrl: './certificate-list.component.html',
  styleUrl: './certificate-list.component.scss'
})
export class CertificateListComponent {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private certificateService = inject(CertificateService);
  private downloadService = inject(DownloadService);

  private refreshTrigger = new Subject<void>();
  readonly certificates = toSignal(
    this.refreshTrigger.pipe(
      startWith(undefined),
      switchMap(() => this.certificateService.list())
    )
  );

  /**
   * Open a modal to edit a certificate
   */
  editCertificate(certificate: CertificateDTO) {
    const modalRef = this.modalService.open(EditCertificateModalComponent, { size: 'lg' });
    const component: EditCertificateModalComponent = modalRef.componentInstance;
    component.prepareForEdition(certificate);
    this.refreshAfterEditCertificateModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create a certificate
   */
  addCertificate() {
    const modalRef = this.modalService.open(EditCertificateModalComponent, { size: 'lg' });
    const component: EditCertificateModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditCertificateModalClosed(modalRef, 'created');
  }

  private refreshAfterEditCertificateModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe((certificate: CertificateDTO) => {
      this.refreshTrigger.next();
      this.notificationService.success(`engine.certificate.${mode}`, {
        name: certificate.name
      });
    });
  }

  deleteCertificate(certificate: CertificateDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'engine.certificate.confirm-deletion',
        interpolateParams: { name: certificate.name }
      })
      .pipe(switchMap(() => this.certificateService.delete(certificate.id)))
      .subscribe(() => {
        this.refreshTrigger.next();
        this.notificationService.success('engine.certificate.deleted', {
          name: certificate.name
        });
      });
  }

  downloadCertificate(certificate: CertificateDTO) {
    this.downloadService.downloadFile({ blob: new Blob([certificate.certificate]), name: certificate.name + '.pem' });
  }
}
