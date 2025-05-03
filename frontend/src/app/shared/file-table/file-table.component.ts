import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DatetimePipe } from '../datetime.pipe';
import { FileSizePipe } from '../file-size.pipe';
import { createPageFromArray } from '../../../../../backend/shared/model/types';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { CacheMetadata } from '../../../../../backend/shared/model/engine.model';
import { PaginationComponent } from '../pagination/pagination.component';

const PAGE_SIZE = 15;

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

@Component({
  selector: 'oib-file-table',
  templateUrl: './file-table.component.html',
  styleUrl: './file-table.component.scss',
  imports: [TranslateDirective, DatetimePipe, FileSizePipe, NgbTooltipModule, TranslatePipe, PaginationComponent]
})
export class FileTableComponent {
  readonly cacheType = input.required<'cache' | 'error' | 'archive'>();
  readonly files = input<Array<{ metadataFilename: string; metadata: CacheMetadata }>>([]);

  readonly currentPage = signal(0);
  readonly sortedFiles = computed(() => this.sortTable());
  readonly pages = computed(() => createPageFromArray(this.sortedFiles(), PAGE_SIZE, this.currentPage()));
  protected readonly checkboxByFiles = linkedSignal({
    source: () => this.files(),
    computation: () => new Map<string, boolean>()
  });

  readonly currentColumnSort = signal<keyof CacheMetadata>('createdAt');
  readonly currentColumnOrder = signal<ColumnSortState>(ColumnSortState.DESCENDING);
  readonly mainFilesCheckboxState = linkedSignal({
    source: () => this.files(),
    computation: () => 'UNCHECKED' as 'CHECKED' | 'UNCHECKED' | 'INDETERMINATE'
  });

  readonly itemAction = output<{
    type: 'remove' | 'error' | 'archive' | 'retry' | 'view';
    file: { metadataFilename: string; metadata: CacheMetadata };
  }>();
  readonly selectedFiles = output<Array<{ metadataFilename: string; metadata: CacheMetadata }>>();

  /**
   * Called when the user check or uncheck the main checkbox
   */
  onFileMainCheckBoxClick(isChecked: boolean) {
    this.files().forEach(errorFile => {
      this.checkboxByFiles().set(errorFile.metadataFilename, isChecked);
    });
    if (isChecked) {
      this.mainFilesCheckboxState.set('CHECKED');
    } else {
      this.mainFilesCheckboxState.set('UNCHECKED');
    }
    this.selectedFiles.emit(this.files().filter(file => this.checkboxByFiles().get(file.metadataFilename)));
  }

  onFileCheckboxClick(isChecked: boolean, errorFile: { metadataFilename: string; metadata: CacheMetadata }) {
    this.checkboxByFiles().set(errorFile.metadataFilename, isChecked);
    let everythingIsChecked = true;
    let everythingIsUnChecked = true;
    for (const isSelected of this.checkboxByFiles().values()) {
      if (!isSelected) {
        everythingIsChecked = false;
      } else {
        everythingIsUnChecked = false;
      }
    }
    if (everythingIsChecked && !everythingIsUnChecked) {
      this.mainFilesCheckboxState.set('CHECKED');
    } else if (!everythingIsChecked && everythingIsUnChecked) {
      this.mainFilesCheckboxState.set('UNCHECKED');
    } else {
      this.mainFilesCheckboxState.set('INDETERMINATE');
    }
    this.selectedFiles.emit(this.files().filter(file => this.checkboxByFiles().get(file.metadataFilename)));
  }

  toggleColumnSort(columnName: keyof CacheMetadata) {
    if (columnName === this.currentColumnSort()) {
      this.currentColumnOrder.update(order => (order + 1) % 3);
    } else {
      this.currentColumnSort.set(columnName);
      this.currentColumnOrder.set(ColumnSortState.DESCENDING);
    }
    this.sortTable();
  }

  private sortTable() {
    const fileTableData = [...this.files()];
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

  onItemActionClick(type: 'remove' | 'error' | 'archive' | 'retry' | 'view', file: { metadataFilename: string; metadata: CacheMetadata }) {
    this.itemAction.emit({ type, file });
  }
}
