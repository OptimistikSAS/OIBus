import { Component, Input } from '@angular/core';
import { NgbActiveModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-confirmation-modal',
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.scss'],
  imports: [NgbModalModule],
  standalone: true
})
export class ConfirmationModalComponent {
  @Input() message = '';
  @Input() title = '';
  @Input() yes = '';
  @Input() no = '';

  constructor(public activeModal: NgbActiveModal) {}
}
