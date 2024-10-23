import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';

import { NorthCacheFiles } from '../../../../../../backend/shared/model/north-connector.model';
import { RouterLink } from '@angular/router';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { createPageFromArray, Instant, Page } from '../../../../../../backend/shared/model/types';
import { emptyPage } from '../../../shared/test-utils';
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
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    DatetimePipe,
    PaginationComponent,
    FileSizePipe,
    RouterLink,
    BoxComponent,
    BoxTitleDirective,
    NgbTooltipModule
  ],
  standalone: true
})
export class FileTableComponent implements OnInit {
  @Output() itemAction = new EventEmitter<ItemActionEvent>();

  @Input() actions: Array<ItemActionEvent['type']> = [];
  actionButtonData: { [key in ItemActionEvent['type']]: { icon: string; text: string } } = {
    remove: { icon: 'fa-trash', text: 'north.cache-settings.remove-file' },
    retry: { icon: 'fa-refresh', text: 'north.cache-settings.retry-file' },
    view: { icon: 'fa-search', text: 'north.cache-settings.view-file' },
    archive: { icon: 'fa-archive', text: 'north.cache-settings.archive-file' }
  };
  @Input() files: Array<FileTableData> = [];
  pages: Page<FileTableData> = emptyPage();
  checkboxByFiles: Map<string, boolean> = new Map<string, boolean>();

  columnSortStates: { [key in keyof FileTableData]: ColumnSortState } = {
    modificationDate: ColumnSortState.DESCENDING,
    filename: ColumnSortState.INDETERMINATE,
    size: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof FileTableData | null = 'modificationDate';

  // the checkbox states for the input parameters
  mainFilesCheckboxState: 'CHECKED' | 'UNCHECKED' | 'INDETERMINATE' = 'UNCHECKED';

  ngOnInit() {
    this.actions = [...new Set(this.actions)]; // remove possible duplicates
    this.clearCheckBoxes();
    this.sortTable();
  }

  /**
   * Called when the user check or uncheck the main checkbox
   */
  onFileMainCheckBoxClick(isChecked: boolean) {
    this.files.forEach(errorFile => {
      this.checkboxByFiles.set(errorFile.filename, isChecked);
    });
    if (isChecked) {
      this.mainFilesCheckboxState = 'CHECKED';
    } else {
      this.mainFilesCheckboxState = 'UNCHECKED';
    }
  }

  onFileCheckboxClick(isChecked: boolean, errorFile: NorthCacheFiles) {
    this.checkboxByFiles.set(errorFile.filename, isChecked);
    let everythingIsChecked = true;
    let everythingIsUnChecked = true;
    for (const isSelected of this.checkboxByFiles.values()) {
      if (!isSelected) {
        everythingIsChecked = false;
      } else {
        everythingIsUnChecked = false;
      }
    }
    if (everythingIsChecked && !everythingIsUnChecked) {
      this.mainFilesCheckboxState = 'CHECKED';
    } else if (!everythingIsChecked && everythingIsUnChecked) {
      this.mainFilesCheckboxState = 'UNCHECKED';
    } else {
      this.mainFilesCheckboxState = 'INDETERMINATE';
    }
  }

  changePage(pageNumber: number) {
    this.pages = createPageFromArray(this.files, PAGE_SIZE, pageNumber);
  }

  toggleColumnSort(columnName: keyof FileTableData) {
    this.currentColumnSort = columnName;
    // Toggle state
    this.columnSortStates[this.currentColumnSort] = (this.columnSortStates[this.currentColumnSort] + 1) % 3;

    // Reset state for every other column
    Object.keys(this.columnSortStates).forEach(key => {
      if (this.currentColumnSort !== key) {
        this.columnSortStates[key as keyof typeof this.columnSortStates] = 0;
      }
    });

    this.sortTable();
  }

  refreshTable(newFiles: Array<FileTableData>) {
    this.files = newFiles;
    this.sortTable();
    this.clearCheckBoxes();
  }

  private sortTable() {
    if (this.currentColumnSort && this.columnSortStates[this.currentColumnSort] !== ColumnSortState.INDETERMINATE) {
      const ascending = this.columnSortStates[this.currentColumnSort] === ColumnSortState.ASCENDING;

      switch (this.currentColumnSort) {
        case 'modificationDate':
          this.files.sort((a, b) => {
            const aDate = new Date(a.modificationDate);
            const bDate = new Date(b.modificationDate);
            return ascending ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
          });
          break;
        case 'filename':
          this.files.sort((a, b) => (ascending ? a.filename.localeCompare(b.filename) : b.filename.localeCompare(a.filename)));
          break;
        case 'size':
          this.files.sort((a, b) => (ascending ? a.size - b.size : b.size - a.size));
          break;
      }
    }

    this.changePage(0);
  }

  private clearCheckBoxes() {
    this.checkboxByFiles.clear();
    this.files.forEach(file => {
      this.checkboxByFiles.set(file.filename, false);
    });
    this.mainFilesCheckboxState = 'UNCHECKED';
  }

  onItemActionClick(action: ItemActionEvent['type'], file: FileTableData) {
    this.itemAction.emit({ type: action, file });
  }
}
