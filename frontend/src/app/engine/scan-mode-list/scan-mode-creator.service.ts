import { inject, Service } from '@angular/core';

import { firstValueFrom, Observable, tap } from 'rxjs';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';

import { ScanModeService } from '../../services/scan-mode.service';
import { OptionCreator } from '../../shared/form/select-or-create/select-or-create.component';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { EditScanModeModalComponent } from './edit-scan-mode-modal/edit-scan-mode-modal.component';

/**
 * Creates a scan mode through its modal, from the scan mode list or from a select of scan modes. The created scan modes
 * are polling ones (cron or interval): a select of the subscription scan mode only must not offer to create one.
 */
@Service()
export class ScanModeCreator implements OptionCreator<ScanModeDTO> {
  private readonly modalService = inject(ModalService);
  private readonly notificationService = inject(NotificationService);
  private readonly scanModeService = inject(ScanModeService);

  readonly createLabel = 'engine.scan-mode.create-new';
  readonly created = this.scanModeService.created;

  create(): Observable<ScanModeDTO> {
    const modalRef = this.modalService.open(EditScanModeModalComponent, {
      beforeDismiss: () => {
        const component: EditScanModeModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    modalRef.componentInstance.prepareForCreation();
    return modalRef.result.pipe(
      tap((scanMode: ScanModeDTO) => this.notificationService.success('engine.scan-mode.created', { name: scanMode.name }))
    );
  }
}
