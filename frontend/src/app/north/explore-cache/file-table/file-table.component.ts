import { Component, Input, OnInit } from '@angular/core';
import { SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { NorthCacheFiles } from '../../../../../../shared/model/north-connector.model';
import { RouterLink } from '@angular/router';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { createPageFromArray, Instant, Page } from '../../../../../../shared/model/types';
import { emptyPage } from '../../../shared/test-utils';

const PAGE_SIZE = 15;
const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

export type FileTableData = {
  filename: string;
  modificationDate: Instant;
  size: number;
};

@Component({
  selector: 'oib-file-table',
  templateUrl: './file-table.component.html',
  styleUrl: './file-table.component.scss',
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    NgForOf,
    DatetimePipe,
    NgIf,
    PaginationComponent,
    FileSizePipe,
    RouterLink,
    BoxComponent,
    BoxTitleDirective
  ],
  standalone: true
})
export class FileTableComponent implements OnInit {
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
    this.clearCheckBoxes();
    this.changePage(0);
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
      this.currentColumnSort !== key && (this.columnSortStates[key as keyof typeof this.columnSortStates] = 0);
    });

    this.sortTable();
  }

  refreshTable(newFiles: FileTableData[]) {
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
}
