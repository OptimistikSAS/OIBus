import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

@Component({
  selector: 'oib-reset-cache-history-query-modal',
  templateUrl: './reset-cache-history-query-modal.component.html',
  styleUrl: './reset-cache-history-query-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective]
})
export class ResetCacheHistoryQueryModalComponent {
  private readonly modal = inject(NgbActiveModal);

  submit(resetCache: boolean) {
    this.modal.close(resetCache);
  }
}
