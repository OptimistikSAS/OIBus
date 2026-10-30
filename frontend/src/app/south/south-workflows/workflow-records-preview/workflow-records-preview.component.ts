import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { OIBusRecord } from '@oibus/shared/common/content.model';
import { createPageFromArray } from '@oibus/shared/common/types';

import { PaginationComponent } from '../../../shared/pagination/pagination.component';

/** How many records give their fields to the columns: the records of a source all have the same ones. */
const FIELD_SAMPLE_SIZE = 100;

/**
 * The records a workflow discovers, with the values of their fields, one page at a time and searchable - in memory, over the
 * values of every field. The columns are the fields of the records: when `processable`, each has a button to set up how
 * the field is processed.
 */
@Component({
  selector: 'oib-workflow-records-preview',
  templateUrl: './workflow-records-preview.component.html',
  styleUrl: './workflow-records-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe, PaginationComponent]
})
export class WorkflowRecordsPreviewComponent {
  readonly records = input.required<ReadonlyArray<OIBusRecord>>();
  readonly pageSize = input(10);
  /** Whether the columns have a button to set up the processing of their field */
  readonly processable = input(false);
  /** The fields that are processed, whose button is highlighted */
  readonly processedFields = input<ReadonlyArray<string>>([]);
  /** The field whose processing is to set up */
  readonly processField = output<string>();

  readonly search = signal('');
  readonly fields = computed(() =>
    Array.from(
      new Set(
        this.records()
          .slice(0, FIELD_SAMPLE_SIZE)
          .flatMap(record => Object.keys(record))
      )
    )
  );
  /** The records with the searched text in a value of one of their fields - all of them when nothing is searched */
  readonly matching = computed(() => {
    const text = this.search().trim().toLowerCase();
    if (!text) {
      return this.records();
    }
    return this.records().filter(record =>
      Object.values(record).some(value => value !== null && value !== undefined && String(value).toLowerCase().includes(text))
    );
  });
  /** The page shown: the first one again whenever the records, or what is searched, change */
  private readonly pageNumber = linkedSignal<ReadonlyArray<OIBusRecord>, number>({ source: this.matching, computation: () => 0 });
  readonly page = computed(() => createPageFromArray(Array.from(this.matching()), this.pageSize(), this.pageNumber()));

  onSearch(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
  }

  changePage(pageNumber: number) {
    this.pageNumber.set(pageNumber);
  }
}
