import { Component, Input, OnInit } from '@angular/core';
import { SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';

import { RouterLink } from '@angular/router';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { createPageFromArray, Page } from '../../../../../../shared/model/types';
import { emptyPage } from '../../../shared/test-utils';

const PAGE_SIZE = 15;
const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

export interface ValueTableData {
  filename: string;
  valuesCount: number;
}

@Component({
  selector: 'oib-value-table',
  templateUrl: './value-table.component.html',
  styleUrl: './value-table.component.scss',
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    DatetimePipe,
    PaginationComponent,
    FileSizePipe,
    RouterLink,
    BoxComponent,
    BoxTitleDirective
  ],
  standalone: true
})
export class ValueTableComponent implements OnInit {
  @Input() files: Array<ValueTableData> = [];
  pages: Page<ValueTableData> = emptyPage();
  checkboxByFiles: Map<string, boolean> = new Map<string, boolean>();

  columnSortStates: { [key in keyof ValueTableData]: ColumnSortState } = {
    filename: ColumnSortState.ASCENDING,
    valuesCount: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof ValueTableData | null = 'filename';

  // the checkbox states for the input parameters
  mainFilesCheckboxState: 'CHECKED' | 'UNCHECKED' | 'INDETERMINATE' = 'UNCHECKED';

  ngOnInit() {
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

  onFileCheckboxClick(isChecked: boolean, errorFile: ValueTableData) {
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

  toggleColumnSort(columnName: keyof ValueTableData) {
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

  refreshTable(newFiles: Array<ValueTableData>) {
    this.files = newFiles;
    this.sortTable();
    this.clearCheckBoxes();
  }

  private sortTable() {
    if (this.currentColumnSort && this.columnSortStates[this.currentColumnSort] !== ColumnSortState.INDETERMINATE) {
      const ascending = this.columnSortStates[this.currentColumnSort] === ColumnSortState.ASCENDING;

      switch (this.currentColumnSort) {
        case 'filename':
          this.files.sort((a, b) => (ascending ? a.filename.localeCompare(b.filename) : b.filename.localeCompare(a.filename)));
          break;
        case 'valuesCount':
          this.files.sort((a, b) => (ascending ? a.valuesCount - b.valuesCount : b.valuesCount - a.valuesCount));
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
