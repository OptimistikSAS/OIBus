import { Component, inject, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  templateUrl: './confirmation-modal.component.html',
  styleUrl: './confirmation-modal.component.scss'
})
export class ConfirmationModalComponent {
  readonly activeModal = inject(NgbActiveModal);
  readonly message = signal('');
  readonly title = signal('');
  readonly yes = signal('');
  readonly no = signal('');

  initialize(title: string, message: string, yes: string, no: string) {
    this.title.set(title);
    this.message.set(message);
    this.yes.set(yes);
    this.no.set(no);
  }
}
