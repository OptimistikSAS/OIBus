import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { AsyncPipe } from '@angular/common';
import { BoxComponent, BoxTitleDirective } from '../../box/box.component';
import { FileSizePipe } from '../../file-size.pipe';
import { DatetimePipe } from '../../datetime.pipe';
import { PaginationComponent } from '../../pagination/pagination.component';
import { CacheMetadata, CacheOperation, DataFolderType } from '../../../../../../backend/shared/model/engine.model';
import { ObservableState } from '../../save-button/save-button.component';
import { createPageFromArray } from '../../../../../../backend/shared/model/types';

const PAGE_SIZE = 15;

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

@Component({
  selector: 'oib-cache-content',
  templateUrl: './cache-content.component.html',
  styleUrl: './cache-content.component.scss',
  imports: [
    TranslateDirective,
    BoxComponent,
    BoxTitleDirective,
    FileSizePipe,
    NgbTooltipModule,
    TranslatePipe,
    DatetimePipe,
    PaginationComponent,
    AsyncPipe
  ]
})
export class CacheContentComponent {
  readonly cacheType = input.required<DataFolderType>();
  readonly cacheContentFiles = input.required<Array<{ filename: string; metadata: CacheMetadata }>>();
  readonly size = input.required<number>();
  readonly state = input.required<ObservableState>();
  readonly operation = output<CacheOperation>();

  // --- Table State ---
  readonly currentPage = signal(0);
  readonly currentColumnSort = signal<keyof CacheMetadata>('createdAt');
  readonly currentColumnOrder = signal<ColumnSortState>(ColumnSortState.DESCENDING);

  // Use a Set for selection. linkedSignal ensures it resets when the input file list changes.
  protected readonly selectedFilenames = linkedSignal({
    source: () => this.cacheContentFiles(),
    computation: () => new Set<string>()
  });

  // --- Computed Data ---
  readonly sortedFiles = computed(() => this.sortTable());
  readonly pages = computed(() => createPageFromArray(this.sortedFiles(), PAGE_SIZE, this.currentPage()));

  // This will now update correctly because selectedFilenames creates a new reference on change
  readonly selectedFileCount = computed(() => this.selectedFilenames().size);

  removeCacheContent(files: Array<string> = this.getCheckedFiles()) {
    if (files.length === 0) return;
    this.operation.emit({
      action: 'remove',
      folder: this.cacheType(),
      filenames: files
    });
  }

  moveCacheContent(destinationFolder: DataFolderType, files: Array<string> = this.getCheckedFiles()) {
    if (files.length === 0) return;
    this.operation.emit({
      action: 'move',
      source: this.cacheType(),
      destination: destinationFolder,
      filenames: files
    });
  }

  getCacheContent(filename: string) {
    this.operation.emit({
      action: 'view',
      folder: this.cacheType(),
      filename
    });
  }

  onItemAction(type: 'remove' | 'error' | 'archive' | 'retry' | 'view', file: { filename: string }) {
    switch (type) {
      case 'remove':
        this.removeCacheContent([file.filename]);
        break;
      case 'archive':
        this.moveCacheContent('archive', [file.filename]);
        break;
      case 'error':
        this.moveCacheContent('error', [file.filename]);
        break;
      case 'retry':
        this.moveCacheContent('cache', [file.filename]);
        break;
      case 'view':
        this.getCacheContent(file.filename);
    }
  }

  selectAll() {
    const allFilenames = this.cacheContentFiles().map(f => f.filename);
    // Create a new Set to ensure reactivity
    this.selectedFilenames.set(new Set(allFilenames));
  }

  unselectAll() {
    this.selectedFilenames.set(new Set());
  }

  onFileCheckboxClick(isChecked: boolean, filename: string) {
    this.selectedFilenames.update(currentSet => {
      // Vital: Create a new Set copy to trigger signal notification
      const newSet = new Set(currentSet);
      if (isChecked) {
        newSet.add(filename);
      } else {
        newSet.delete(filename);
      }
      return newSet;
    });
  }

  // --- Sorting Logic ---

  toggleColumnSort(columnName: keyof CacheMetadata) {
    if (columnName === this.currentColumnSort()) {
      this.currentColumnOrder.update(order => (order + 1) % 3);
    } else {
      this.currentColumnSort.set(columnName);
      this.currentColumnOrder.set(ColumnSortState.DESCENDING);
    }
    // Reset to page 0 on sort change to avoid confusion
    this.currentPage.set(0);
  }

  private sortTable() {
    const fileTableData = [...this.cacheContentFiles()];
    if (this.currentColumnOrder() !== ColumnSortState.INDETERMINATE) {
      const ascending = this.currentColumnOrder() === ColumnSortState.ASCENDING;
      switch (this.currentColumnSort()) {
        case 'createdAt':
          fileTableData.sort((a, b) => {
            const aDate = new Date(a.metadata.createdAt);
            const bDate = new Date(b.metadata.createdAt);
            return ascending ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
          });
          break;
        case 'contentFile':
          fileTableData.sort((a, b) =>
            ascending
              ? a.metadata.contentFile.localeCompare(b.metadata.contentFile)
              : b.metadata.contentFile.localeCompare(a.metadata.contentFile)
          );
          break;
        case 'contentSize':
          fileTableData.sort((a, b) =>
            ascending ? a.metadata.contentSize - b.metadata.contentSize : b.metadata.contentSize - a.metadata.contentSize
          );
          break;
      }
    }
    return fileTableData;
  }

  private getCheckedFiles(): Array<string> {
    return Array.from(this.selectedFilenames());
  }
}
