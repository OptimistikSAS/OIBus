import { inject, Service } from '@angular/core';

import { firstValueFrom, Observable, tap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';

import { CertificateService } from '../../services/certificate.service';
import { OptionCreator } from '../../shared/form/select-or-create/select-or-create.component';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { ImportCertificateModalComponent } from './import-certificate-modal/import-certificate-modal.component';

/**
 * Imports a certificate OIBus trusts (a certification authority, or the certificate of a server) from a select of trusted
 * certificates, through the import modal
 */
@Service()
export class TrustedCertificateCreator implements OptionCreator<CertificateDTO> {
  private readonly modalService = inject(ModalService);
  private readonly notificationService = inject(NotificationService);
  private readonly certificateService = inject(CertificateService);

  readonly createLabel = 'engine.certificate.import-trusted';
  readonly created = this.certificateService.created;

  create(): Observable<CertificateDTO> {
    const modalRef = this.modalService.open(ImportCertificateModalComponent, {
      size: 'lg',
      beforeDismiss: () => {
        const component: ImportCertificateModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    modalRef.componentInstance.prepareForTrusted();
    return modalRef.result.pipe(
      tap((certificate: CertificateDTO) => this.notificationService.success('engine.certificate.imported', { name: certificate.name }))
    );
  }
}
