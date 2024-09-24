import { Component, inject, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-confirmation-modal',
  templateUrl: './confirmation-modal.component.html',
  styleUrl: './confirmation-modal.component.scss',
  standalone: true
})
export class ConfirmationModalComponent {
  activeModal = inject(NgbActiveModal);

  @Input() message = '';
  @Input() title = '';
  @Input() yes = '';
  @Input() no = '';
}
