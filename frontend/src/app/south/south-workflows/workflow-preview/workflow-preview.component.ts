import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import csv from 'papaparse';

import { WorkflowPreviewEntryDTO, WorkflowPreviewResultDTO } from '@oibus/shared/api/configuration-workflow.model';
import { WorkflowRunDetailDTO } from '@oibus/shared/api/workflow-run.model';
import { createPageFromArray } from '@oibus/shared/common/types';

import { DownloadService } from '../../../services/download.service';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { flattenPlainObject } from '../../../shared/utils/csv.utils';

/**
 * A live dry-run preview and a historical run's full discovered payload share the same discoveredCount/eligibleCount/
 * entries/records shape, differing only in what happened to the data: a preview's classification is hypothetical
 * ("what the next run would do"), a run's is what actually happened - and only a run additionally reports what it
 * actually did (created/updated/disabled/pushed), since a preview never acts on anything. `context` picks which
 * empty-state wording applies, and whether that extra counts breakdown is shown at all.
 */
export type WorkflowPreviewContext = 'preview' | 'run-payload';

/** In-memory page size for the entries/records tables - the whole list arrives in one HTTP call (there's no
 *  server-side pagination to defer to), so a large discovered list is paginated only for display. */
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

/**
 * What a Configuration Workflow run would do, or did: the entries of a local workflow classified against the previous
 * run (new, changed, missing...), or the raw records a remote one pushes - paginated, exportable as CSV. Shown in the
 * Review step of the workflow wizard, and for the payload of a past run.
 */
@Component({
  selector: 'oib-workflow-preview',
  templateUrl: './workflow-preview.component.html',
  styleUrl: './workflow-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe, PaginationComponent]
})
export class WorkflowPreviewComponent {
  private downloadService = inject(DownloadService);

  readonly result = input.required<WorkflowPreviewResultDTO | WorkflowRunDetailDTO>();
  readonly context = input<WorkflowPreviewContext>('preview');
  /** Names the exported CSV file */
  readonly workflowName = input('');

  private readonly entryRows = computed<Array<PreviewEntryRow>>(() =>
    this.result().entries.map(entry => ({
      entry,
      values: flattenPlainObject(entry.record ?? entry.previousMetadata ?? {}),
      previousValues: entry.status === 'changed' && entry.previousMetadata ? flattenPlainObject(entry.previousMetadata) : null
    }))
  );
  private readonly recordRows = computed(() => this.result().records.map(record => flattenPlainObject(record)));
  /** Union of every row's flattened keys, in first-seen order - rows can have different shapes (e.g. different node
   *  types carry different metadata fields), so every row lines up under one header. Shared by the table and the CSV
   *  export, so both always show the same columns. */
  readonly columns = computed(() =>
    collectColumns(this.entryRows().length > 0 ? this.entryRows().map(row => row.values) : this.recordRows())
  );

  // Back to the first page whenever the result changes (a refreshed preview)
  private readonly entriesPage = linkedSignal({ source: this.result, computation: () => 0 });
  private readonly recordsPage = linkedSignal({ source: this.result, computation: () => 0 });
  // Null when the corresponding list is empty - the template's @if/@else if chain on these (rather than on
  // result.entries/records directly) is what picks which table (or the empty state) to show.
  readonly paginatedEntries = computed(() =>
    this.entryRows().length > 0 ? createPageFromArray(this.entryRows(), PAGE_SIZE, this.entriesPage()) : null
  );
  readonly paginatedRecords = computed(() =>
    this.recordRows().length > 0 ? createPageFromArray(this.recordRows(), PAGE_SIZE, this.recordsPage()) : null
  );

  /** The full created/updated/disabled/pushed breakdown behind a run's summary - only available (and only ever shown)
   *  for a historical run's payload, never for a live preview. */
  readonly runCounts = computed(() => (this.context() === 'run-payload' ? (this.result() as WorkflowRunDetailDTO) : null));

  /** True once there is at least one entry or raw record worth exporting - disables the export button rather than let
   *  it produce an empty file. */
  readonly hasExportableRows = computed(() => this.result().entries.length > 0 || this.result().records.length > 0);

  changeEntriesPage(pageNumber: number): void {
    this.entriesPage.set(pageNumber);
  }

  changeRecordsPage(pageNumber: number): void {
    this.recordsPage.set(pageNumber);
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

  /**
   * Exports the whole list as a flattened CSV, one row per entry (local/diffed workflow) or raw record
   * (remote/push-to-OIAnalytics workflow) - never both, since only one is ever non-empty. Each row's nested payload
   * fields are flattened into their own underscore-joined columns via flattenPlainObject, since this discovered data
   * has no OIBusAttribute form schema of its own to flatten against the way south item CSV export does.
   */
  exportCsv(): void {
    const entryRows = this.entryRows();
    const isEntries = entryRows.length > 0;
    const rows: Array<Record<string, string>> = isEntries
      ? entryRows.map(row => ({ key: row.entry.key, status: row.entry.status, ...row.values }))
      : this.recordRows();
    const columns = isEntries
      ? ['key', 'status', ...this.columns().filter(column => column !== 'key' && column !== 'status')]
      : this.columns();

    const content = csv.unparse(rows, { columns, delimiter: ',' });
    const blob = new Blob([content], { type: 'text/csv' });
    const namePrefix = this.context() === 'run-payload' ? 'run-payload' : 'preview';
    const workflowSlug = this.workflowName().replace(/[^a-zA-Z0-9-_]+/g, '_');
    const filename = `${namePrefix}_${workflowSlug}_${DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv`;
    this.downloadService.downloadFile({ blob, name: filename });
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
