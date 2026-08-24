import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgbActiveModal, NgbDropdownModule, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { AuditService } from '../../services/audit.service';
import { AuditEntityType, AuditLogDTO } from '../../../../../backend/shared/model/audit.model';
import { DatetimePipe } from '../datetime.pipe';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';
import { AuditDiffComponent } from '../audit-diff/audit-diff.component';
import { AuditJsonDiffComponent } from '../audit-diff/audit-json-diff.component';
import { AuditJsonSideBySideComponent } from '../audit-diff/audit-json-side-by-side.component';

export type AuditDiffMode = 'table' | 'json-diff' | 'json-side-by-side';

/**
 * Modal displaying the full audit history (create/update/delete trail) of a single entity.
 */
@Component({
  selector: 'oib-audit-history-modal',
  templateUrl: './audit-history-modal.component.html',
  styleUrl: './audit-history-modal.component.scss',
  imports: [
    TranslateDirective,
    TranslatePipe,
    DatetimePipe,
    LoadingSpinnerComponent,
    AuditDiffComponent,
    AuditJsonDiffComponent,
    AuditJsonSideBySideComponent,
    NgbTooltip,
    NgbDropdownModule
  ],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class AuditHistoryModalComponent {
  private modal = inject(NgbActiveModal);
  private auditService = inject(AuditService);

  readonly history = signal<Array<AuditLogDTO>>([]);
  readonly loading = signal(true);
  readonly expandedRowId = signal<string | null>(null);
  readonly mode = signal<AuditDiffMode>('table');

  readonly modes: Array<AuditDiffMode> = ['table', 'json-diff', 'json-side-by-side'];
  readonly modeIcons: Record<AuditDiffMode, string> = {
    table: 'fa-table',
    'json-diff': 'fa-code',
    'json-side-by-side': 'fa-columns'
  };

  prepare(entityType: AuditEntityType, entityId: string): void {
    this.auditService.getHistory(entityType, entityId).subscribe(history => {
      this.history.set(history);
      this.loading.set(false);
    });
  }

  toggleRow(id: string): void {
    this.expandedRowId.set(this.expandedRowId() === id ? null : id);
  }

  changeMode(mode: AuditDiffMode): void {
    this.mode.set(mode);
  }

  close(): void {
    this.modal.close();
  }
}
