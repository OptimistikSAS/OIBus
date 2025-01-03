import { Component, output, input, computed, signal, linkedSignal } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthCacheFiles } from '../../../../../../backend/shared/model/north-connector.model';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { createPageFromArray, Instant } from '../../../../../../backend/shared/model/types';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

const PAGE_SIZE = 15;

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

export interface FileTableData {
  filename: string;
  modificationDate: Instant;
  size: number;
}

export interface ItemActionEvent {
  type: 'remove' | 'retry' | 'view' | 'archive';
  file: FileTableData;
}

@Component({
  selector: 'oib-file-table',
  templateUrl: './file-table.component.html',
  styleUrl: './file-table.component.scss',
  imports: [...formDirectives, TranslateDirective, DatetimePipe, FileSizePipe, NgbTooltipModule]
})
export class FileTableComponent {
  readonly itemAction = output<ItemActionEvent>();
  readonly actions = input<Array<ItemActionEvent['type']>>([]);
  readonly selectedFiles = output<Array<FileTableData>>();
  // remove possible duplicates
  readonly uniqueActions = computed(() => [...new Set(this.actions())]);
  actionButtonData: Record<ItemActionEvent['type'], { icon: string; text: string }> = {
    remove: { icon: 'fa-trash', text: 'north.cache-settings.remove-file' },
    retry: { icon: 'fa-refresh', text: 'north.cache-settings.retry-file' },
    view: { icon: 'fa-search', text: 'north.cache-settings.view-file' },
    archive: { icon: 'fa-archive', text: 'north.cache-settings.archive-file' }
  };
  readonly pageNumber = input(0);
  readonly files = input<Array<FileTableData>>([]);
  readonly sortedFiles = computed(() => this.sortTable());
  readonly pages = computed(() => createPageFromArray(this.sortedFiles(), PAGE_SIZE, this.pageNumber()));
  protected readonly checkboxByFiles = linkedSignal({
    source: () => this.files(),
    computation: () => new Map<string, boolean>()
  });

  readonly currentColumnSort = signal<keyof FileTableData>('modificationDate');
  readonly currentColumnOrder = signal<ColumnSortState>(ColumnSortState.DESCENDING);
  readonly mainFilesCheckboxState = linkedSignal({
    source: () => this.files(),
    computation: () => 'UNCHECKED' as 'CHECKED' | 'UNCHECKED' | 'INDETERMINATE'
  });

  /**
   * Called when the user check or uncheck the main checkbox
   */
  onFileMainCheckBoxClick(isChecked: boolean) {
    this.files().forEach(errorFile => {
      this.checkboxByFiles().set(errorFile.filename, isChecked);
    });
    if (isChecked) {
      this.mainFilesCheckboxState.set('CHECKED');
    } else {
      this.mainFilesCheckboxState.set('UNCHECKED');
    }
    this.selectedFiles.emit(this.files().filter(file => this.checkboxByFiles().get(file.filename)));
  }

  onFileCheckboxClick(isChecked: boolean, errorFile: NorthCacheFiles) {
    this.checkboxByFiles().set(errorFile.filename, isChecked);
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
    this.selectedFiles.emit(this.files().filter(file => this.checkboxByFiles().get(file.filename)));
  }

  toggleColumnSort(columnName: keyof FileTableData) {
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
        case 'modificationDate':
          fileTableData.sort((a, b) => {
            const aDate = new Date(a.modificationDate);
            const bDate = new Date(b.modificationDate);
            return ascending ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
          });
          break;
        case 'filename':
          fileTableData.sort((a, b) => (ascending ? a.filename.localeCompare(b.filename) : b.filename.localeCompare(a.filename)));
          break;
        case 'size':
          fileTableData.sort((a, b) => (ascending ? a.size - b.size : b.size - a.size));
          break;
      }
    }
    return fileTableData;
  }

  onItemActionClick(action: ItemActionEvent['type'], file: FileTableData) {
    this.itemAction.emit({ type: action, file });
  }
}
