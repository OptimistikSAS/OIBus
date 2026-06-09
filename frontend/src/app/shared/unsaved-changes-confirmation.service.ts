import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ModalService } from './modal.service';
import { UnsavedChangesConfirmationModalComponent } from './form/unsaved-changes-confirmation-modal.component';
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
