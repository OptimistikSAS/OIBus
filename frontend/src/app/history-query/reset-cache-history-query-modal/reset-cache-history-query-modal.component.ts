import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-reset-cache-history-query-modal',
  templateUrl: './reset-cache-history-query-modal.component.html',
  styleUrl: './reset-cache-history-query-modal.component.scss',
  imports: [],
  standalone: true
})
export class ResetCacheHistoryQueryModalComponent {
  private modal = inject(NgbActiveModal);

  submit(resetCache: boolean) {
    this.modal.close(resetCache);
  }
}
