import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import csv from 'papaparse';
import { DateTime } from 'luxon';
import { WorkflowPreviewEntryDTO, WorkflowPreviewResultDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { WorkflowRunDetailDTO } from '../../../../../../backend/shared/model/workflow-run.model';
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

// Mirrors the backend's IDENTITY_KEY_FIELD_SEPARATOR (configuration-workflow.utils.ts).
const IDENTITY_KEY_FIELD_SEPARATOR = String.fromCharCode(1);

/** One local-workflow entry, with its payload (the fresh record, or the previous snapshot for a
 *  `missing` entry) already flattened into the table's columns. */
export interface PreviewEntryRow {
  entry: WorkflowPreviewEntryDTO;
  values: Record<string, string>;
  /** The previous run's snapshot, flattened - only for a `changed` entry, to highlight what changed. */
  previousValues: Record<string, string> | null;
}

@Component({
  selector: 'oib-preview-workflow-modal',
  templateUrl: './preview-workflow-modal.component.html',
  styleUrl: './preview-workflow-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, TranslatePipe, LoadingSpinnerComponent, PaginationComponent]
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
  paginatedEntries: ArrayPage<PreviewEntryRow> | null = null;
  paginatedRecords: ArrayPage<Record<string, string>> | null = null;
  /** Union of every row's flattened keys, in first-seen order - rows can have different shapes (e.g.
   *  different node types carry different metadata fields), so every row lines up under one header.
   *  Shared by the table and the CSV export, so both always show the same columns. */
  columns: Array<string> = [];
  private entryRows: Array<PreviewEntryRow> = [];
  private recordRows: Array<Record<string, string>> = [];

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
    this.entryRows = result.entries.map(entry => ({
      entry,
      values: flattenPlainObject(entry.record ?? entry.previousMetadata ?? {}),
      previousValues: entry.status === 'changed' && entry.previousMetadata ? flattenPlainObject(entry.previousMetadata) : null
    }));
    this.recordRows = result.records.map(record => flattenPlainObject(record));
    this.columns = collectColumns(this.entryRows.length > 0 ? this.entryRows.map(row => row.values) : this.recordRows);
    this.paginatedEntries = this.entryRows.length > 0 ? new ArrayPage(this.entryRows, PAGE_SIZE) : null;
    this.paginatedRecords = this.recordRows.length > 0 ? new ArrayPage(this.recordRows, PAGE_SIZE) : null;
    this.loading.set(false);
  }

  /** The identity key as shown in the table - its segments are joined by an invisible control character
   *  (see the backend's computeIdentityKey), replaced here by a readable separator. */
  displayKey(key: string): string {
    return key.split(IDENTITY_KEY_FIELD_SEPARATOR).join(', ');
  }

  /** True when a `changed` entry's cell differs from the previous run's value for that same column. */
  isChangedCell(row: PreviewEntryRow, column: string): boolean {
    return !!row.previousValues && (row.previousValues[column] ?? '') !== (row.values[column] ?? '');
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
    const isEntries = this.entryRows.length > 0;
    const rows: Array<Record<string, string>> = isEntries
      ? this.entryRows.map(row => ({ key: row.entry.key, status: row.entry.status, ...row.values }))
      : this.recordRows;
    const columns = isEntries ? ['key', 'status', ...this.columns.filter(column => column !== 'key' && column !== 'status')] : this.columns;

    const content = csv.unparse(rows, { columns, delimiter: ',' });
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

function collectColumns(rows: Array<Record<string, string>>): Array<string> {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      columns.add(column);
    }
  }
  return Array.from(columns);
}
