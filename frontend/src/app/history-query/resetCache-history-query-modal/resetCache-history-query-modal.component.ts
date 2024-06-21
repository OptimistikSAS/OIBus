import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-resetCache-history-query-modal',
  templateUrl: './resetCache-history-query-modal.component.html',
  styleUrl: './resetCache-history-query-modal.component.scss',
  imports: [],
  standalone: true
})
export class resetCacheHistoryQueryModalComponent {

  constructor(
    private modal: NgbActiveModal,
  ){}

  resetCache(isCacheRestart: boolean){
    this.modal.close(isCacheRestart);
  }
}
