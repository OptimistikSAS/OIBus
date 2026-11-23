import { inject, Service } from '@angular/core';

import { firstValueFrom, Observable, tap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';

import { CertificateService } from '../../services/certificate.service';
import { OptionCreator } from '../../shared/form/select-or-create/select-or-create.component';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { EditCertificateModalComponent } from './edit-certificate-modal/edit-certificate-modal.component';

/**
 * Creates a certificate through its modal, from the certificate list or from a select of certificates
 */
@Service()
export class CertificateCreator implements OptionCreator<CertificateDTO> {
  private readonly modalService = inject(ModalService);
  private readonly notificationService = inject(NotificationService);
  private readonly certificateService = inject(CertificateService);

  readonly createLabel = 'engine.certificate.create-new';
  readonly created = this.certificateService.created;

  create(): Observable<CertificateDTO> {
    const modalRef = this.modalService.open(EditCertificateModalComponent, {
      size: 'lg',
      beforeDismiss: () => {
        const component: EditCertificateModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    modalRef.componentInstance.prepareForCreation();
    return modalRef.result.pipe(
      tap((certificate: CertificateDTO) => this.notificationService.success('engine.certificate.created', { name: certificate.name }))
    );
  }
}
