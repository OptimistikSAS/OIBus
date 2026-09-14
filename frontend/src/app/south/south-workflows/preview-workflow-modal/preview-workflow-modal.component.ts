import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { JsonPipe } from '@angular/common';
import csv from 'papaparse';
import { DateTime } from 'luxon';
import { WorkflowPreviewEntryDTO, WorkflowPreviewResultDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { WorkflowRunDetailDTO } from '../../../../../../backend/shared/model/workflow-run.model';
import { OIBusRecord } from '../../../../../../backend/shared/model/engine.model';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { NotificationService } from '../../../shared/notification.service';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { DownloadService } from '../../../services/download.service';
import { flattenPlainObject } from '../../../shared/utils/csv.utils';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { ArrayPage } from '../../../shared/pagination/array-page';

/**
 * Doubles as both a live dry-run preview and a historical run's full discovered payload viewer - the
 * two share the same discoveredCount/eligibleCount/entries/records shape, differing only in what
 * happened to the data: a preview's classification is hypothetical ("what the next run would do"), a
 * run's is what actually happened - and only a run additionally reports what it actually did
 * (created/updated/disabled/pushed), since a preview never acts on anything. `context` picks which
 * title/empty-state wording applies, and whether that extra counts breakdown is shown at all.
 */
export type PreviewModalContext = 'preview' | 'run-payload';

/** In-memory page size for the entries/records tables - this modal's whole list arrives in one HTTP
 *  call (there's no server-side pagination to defer to), so a large discovered list is paginated only
 *  for display, matching manifest-attributes-array.component.ts's own choice of page size. */
const PAGE_SIZE = 20;

@Component({
  selector: 'oib-preview-workflow-modal',
  templateUrl: './preview-workflow-modal.component.html',
  styleUrl: './preview-workflow-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, TranslatePipe, JsonPipe, LoadingSpinnerComponent, PaginationComponent]
})
export default class PreviewWorkflowModalComponent {
  private modal = inject(NgbActiveModal);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);
  private notificationService = inject(NotificationService);
  private downloadService = inject(DownloadService);

  workflowName = '';
  result: WorkflowPreviewResultDTO | WorkflowRunDetailDTO | null = null;
  context: PreviewModalContext = 'preview';
  // Opened up front, before the request that fills `result` resolves - see this modal's own callers
  // (onPreview/onViewPayload), which open it immediately rather than waiting on the HTTP call first.
  readonly loading = signal(true);

  // Null when the corresponding list is empty - the template's @if/@else if chain on these (rather
  // than on result.entries/records directly) is what picks which table (or the empty state) to show.
  // Built once, when `result` is set - never rebuilt afterward, since `result` itself never changes
  // again for the lifetime of one modal open (see prepareForPreview/prepareForRunPayload).
  paginatedEntries: ArrayPage<WorkflowPreviewEntryDTO> | null = null;
  paginatedRecords: ArrayPage<OIBusRecord> | null = null;

  /** A live dry-run preview: discover + classify against the previous run, nothing persisted. */
  prepareForPreview(southId: string, workflowId: string, workflowName: string): void {
    this.workflowName = workflowName;
    this.context = 'preview';
    this.configurationWorkflowService.preview(southId, workflowId).subscribe({
      next: result => {
        this.applyResult(result);
      },
      error: error => {
        this.notificationService.error('south.workflows.preview-error', { error: extractErrorMessage(error) });
        this.modal.close();
      }
    });
  }

  /** A historical run's own full discovered payload, fetched on demand. */
  prepareForRunPayload(southId: string, workflowId: string, runId: string, workflowName: string): void {
    this.workflowName = workflowName;
    this.context = 'run-payload';
    this.configurationWorkflowService.getRun(southId, workflowId, runId).subscribe({
      next: detail => {
        this.applyResult(detail);
      },
      error: error => {
        this.notificationService.error('south.workflows.run-payload-error', { error: extractErrorMessage(error) });
        this.modal.close();
      }
    });
  }

  private applyResult(result: WorkflowPreviewResultDTO | WorkflowRunDetailDTO): void {
    this.result = result;
    this.paginatedEntries = result.entries.length > 0 ? new ArrayPage(result.entries, PAGE_SIZE) : null;
    this.paginatedRecords = result.records.length > 0 ? new ArrayPage(result.records, PAGE_SIZE) : null;
    this.loading.set(false);
  }

  /** The full created/updated/disabled/pushed breakdown behind a run's summary - only available (and
   *  only ever shown) for a historical run's payload, never for a live preview. */
  get runCounts(): WorkflowRunDetailDTO | null {
    return this.context === 'run-payload' ? (this.result as WorkflowRunDetailDTO) : null;
  }

  /** True once there is at least one entry or raw record worth exporting - disables the export
   *  button rather than let it produce an empty file. */
  get hasExportableRows(): boolean {
    return !!this.result && (this.result.entries.length > 0 || this.result.records.length > 0);
  }

  /**
   * Exports the currently shown list as a flattened CSV, one row per entry (local/diffed workflow) or
   * raw record (remote/push-to-OIAnalytics workflow) - never both, since only one is ever non-empty.
   * Each row's nested payload fields are flattened into their own underscore-joined columns via
   * flattenPlainObject, since this discovered data has no OIBusAttribute form schema of its own to
   * flatten against the way south item CSV export does (see that function's own doc comment).
   */
  exportCsv(): void {
    if (!this.result) {
      return;
    }
    const rows: Array<Record<string, string>> =
      this.result.entries.length > 0
        ? this.result.entries.map(entry => ({
            key: entry.key,
            status: entry.status,
            ...flattenPlainObject(entry.record ?? entry.previousMetadata ?? {})
          }))
        : this.result.records.map(record => flattenPlainObject(record));

    // Rows can have different shapes (e.g. different node types carry different metadata fields) - the
    // column list passed to unparse() is the union across every row, matching exportArrayElements' own
    // approach, so every row lines up under the same header instead of only the first row's own keys.
    const columns = new Set<string>();
    for (const row of rows) {
      for (const column of Object.keys(row)) {
        columns.add(column);
      }
    }

    const content = csv.unparse(rows, { columns: Array.from(columns), delimiter: ',' });
    const blob = new Blob([content], { type: 'text/csv' });
    const namePrefix = this.context === 'run-payload' ? 'run-payload' : 'preview';
    const workflowSlug = this.workflowName.replace(/[^a-zA-Z0-9-_]+/g, '_');
    const filename = `${namePrefix}_${workflowSlug}_${DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv`;
    this.downloadService.downloadFile({ blob, name: filename });
  }

  close() {
    this.modal.close();
  }
}
