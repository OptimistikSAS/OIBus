import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'oib-unsaved-changes-confirmation-modal',
  templateUrl: './unsaved-changes-confirmation-modal.component.html',
  imports: [TranslatePipe]
})
export class UnsavedChangesConfirmationModalComponent {
  private activeModal = inject(NgbActiveModal);

  leaveWithoutSaving() {
    this.activeModal.close(true);
  }

  continueEditing() {
    this.activeModal.close(false);
  }
}
