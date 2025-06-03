import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'oib-unsaved-changes-confirmation-modal',
  template: `
    <div class="modal-header">
      <h4 class="modal-title">{{ 'common.unsaved-changes' | translate }}</h4>
    </div>
    <div class="modal-body">
      <p>{{ 'common.unsaved-changes-message' | translate }}</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="continueEditing()">
        {{ 'common.continue-editing' | translate }}
      </button>
      <button type="button" class="btn btn-danger" (click)="leaveWithoutSaving()">
        {{ 'common.leave-without-saving' | translate }}
      </button>
    </div>
  `,
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
