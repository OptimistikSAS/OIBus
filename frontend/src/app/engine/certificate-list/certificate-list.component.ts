import { Component, OnInit, inject } from '@angular/core';

import { switchMap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { CertificateService } from '../../services/certificate.service';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { EditCertificateModalComponent } from '../edit-certificate-modal/edit-certificate-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { TruncatedStringComponent } from '../../shared/truncated-string/truncated-string.component';
import { ClipboardCopyDirective } from '../../shared/clipboard-copy-directive';
import { DownloadService } from '../../services/download.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';

@Component({
  selector: 'oib-certificate-list',
  standalone: true,
  imports: [
    TranslateModule,
    BoxComponent,
    BoxTitleDirective,
    DatetimePipe,
    TruncatedStringComponent,
    ClipboardCopyDirective,
    OibHelpComponent
  ],
  templateUrl: './certificate-list.component.html',
  styleUrl: './certificate-list.component.scss'
})
export class CertificateListComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private certificateService = inject(CertificateService);
  private downloadService = inject(DownloadService);

  certificates: Array<CertificateDTO> = [];

  ngOnInit() {
    this.certificateService.list().subscribe(certificateList => {
      this.certificates = certificateList;
    });
  }

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
      this.certificateService.list().subscribe(certificates => {
        this.certificates = certificates;
      });
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
      .pipe(
        switchMap(() => {
          return this.certificateService.delete(certificate.id);
        })
      )
      .subscribe(() => {
        this.certificateService.list().subscribe(certificates => {
          this.certificates = certificates;
        });
        this.notificationService.success('engine.certificate.deleted', {
          name: certificate.name
        });
      });
  }

  downloadCertificate(certificate: CertificateDTO) {
    this.downloadService.downloadFile({ blob: new Blob([certificate.certificate]), name: certificate.name + '.pem' });
  }
}
