import { inject, Service } from '@angular/core';

import { Observable } from 'rxjs';

import { UnsavedChangesConfirmationModalComponent } from './form/unsaved-changes-confirmation-modal.component';
import { ModalService } from './modal.service';
@Service()
export class UnsavedChangesConfirmationService {
  private modalService = inject(ModalService);

  confirmUnsavedChanges(): Observable<boolean> {
    const modalRef = this.modalService.open(UnsavedChangesConfirmationModalComponent, {
      backdrop: 'static'
    });

    return modalRef.result;
  }
}
