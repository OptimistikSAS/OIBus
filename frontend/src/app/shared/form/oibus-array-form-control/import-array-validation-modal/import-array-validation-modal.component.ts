import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { PaginationComponent } from '../../../pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../../../backend/shared/model/types';
import { emptyPage } from '../../../test-utils';
import { OIBusArrayAttribute } from '../../../../../../../backend/shared/model/form.model';
const PAGE_SIZE = 20;

@Component({
  selector: 'oib-import-array-validation-modal',
  templateUrl: './import-array-validation-modal.component.html',
  styleUrl: './import-array-validation-modal.component.scss',
  imports: [TranslateDirective, PaginationComponent, NgbTooltip]
})
export class ImportArrayValidationModalComponent {
  private modal = inject(NgbActiveModal);

  newItemList: Array<Record<string, unknown>> = [];
  errorList: Array<{
    item: Record<string, string>;
    error: string;
  }> = [];
  arrayAttribute!: OIBusArrayAttribute;
  columns: Array<string> = [];
  displayedItemsNew: Page<Record<string, unknown>> = emptyPage();
  displayedItemsError: Page<{
    item: Record<string, string>;
    error: string;
  }> = emptyPage();

  prepare(
    arrayAttribute: OIBusArrayAttribute,
    newItemList: Array<Record<string, unknown>>,
    errorList: Array<{
      item: Record<string, string>;
      error: string;
    }>
  ) {
    this.arrayAttribute = arrayAttribute;
    this.newItemList = newItemList;
    this.errorList = errorList;
    this.columns = this.extractColumns(newItemList);
    this.changePageNew(0);
    this.changePageError(0);
  }

  cancel() {
    this.modal.dismiss();
  }

  submit() {
    this.modal.close(this.newItemList);
  }

  changePageNew(pageNumber: number) {
    this.displayedItemsNew = this.createPageNew(pageNumber);
  }

  changePageError(pageNumber: number) {
    this.displayedItemsError = this.createPageError(pageNumber);
  }

  getItemDisplayName(item: Record<string, unknown>): string {
    const nameKeys = ['name', 'id', 'key', 'title', 'fieldName'];
    for (const key of nameKeys) {
      if (item[key] && typeof item[key] === 'string') {
        return item[key] as string;
      }
    }
    for (const [, value] of Object.entries(item)) {
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
    return '';
  }

  getErrorItemDisplayName(item: Record<string, string>): string {
    const nameKeys = ['name', 'id', 'key', 'title', 'fieldName'];
    for (const key of nameKeys) {
      if (item[key] && typeof item[key] === 'string') {
        return item[key];
      }
    }
    for (const [, value] of Object.entries(item)) {
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
    return '';
  }

  getFieldValue(item: Record<string, unknown>, column: string): string {
    const value = this.getValueByPath(item, column);
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  getValueByPath(obj: any, path: string) {
    if (obj && path in obj) {
      return obj[path];
    }
    const keys = path.split('_');
    return keys.reduce((acc, key) => acc && acc[key], obj);
  }

  private extractColumns(items: Array<Record<string, unknown>>): Array<string> {
    const columnSet = new Set<string>();
    items.forEach(item => {
      Object.keys(item).forEach(key => {
        columnSet.add(key);
      });
    });
    return Array.from(columnSet).sort();
  }

  private createPageNew(pageNumber: number): Page<Record<string, unknown>> {
    return createPageFromArray(this.newItemList, PAGE_SIZE, pageNumber);
  }

  private createPageError(pageNumber: number): Page<{
    item: Record<string, string>;
    error: string;
  }> {
    return createPageFromArray(this.errorList, PAGE_SIZE, pageNumber);
  }
}
