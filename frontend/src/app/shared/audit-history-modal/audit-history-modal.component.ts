import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { AuditService } from '../../services/audit.service';
import { AuditEntityType, AuditLogDTO } from '../../../../../backend/shared/model/audit.model';
import { DatetimePipe } from '../datetime.pipe';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';
import { AuditDiffComponent } from '../audit-diff/audit-diff.component';

/**
 * Modal displaying the full audit history (create/update/delete trail) of a single entity.
 */
@Component({
  selector: 'oib-audit-history-modal',
  templateUrl: './audit-history-modal.component.html',
  styleUrl: './audit-history-modal.component.scss',
  imports: [TranslateDirective, DatetimePipe, LoadingSpinnerComponent, AuditDiffComponent],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class AuditHistoryModalComponent {
  private modal = inject(NgbActiveModal);
  private auditService = inject(AuditService);

  readonly history = signal<Array<AuditLogDTO>>([]);
  readonly loading = signal(true);
  readonly expandedRowId = signal<string | null>(null);

  prepare(entityType: AuditEntityType, entityId: string): void {
    this.auditService.getHistory(entityType, entityId).subscribe(history => {
      this.history.set(history);
      this.loading.set(false);
    });
  }

  toggleRow(id: string): void {
    this.expandedRowId.set(this.expandedRowId() === id ? null : id);
  }

  close(): void {
    this.modal.close();
  }
}
