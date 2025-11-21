import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { PaginationComponent } from '../../../pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../../../backend/shared/model/types';
import { emptyPage } from '../../../test-utils';
import { OIBusArrayAttribute } from '../../../../../../../backend/shared/model/form.model';
import { getElementName } from '../../../utils/csv.utils';
const PAGE_SIZE = 20;

@Component({
  selector: 'oib-import-array-validation-modal',
  templateUrl: './import-array-validation-modal.component.html',
  styleUrl: './import-array-validation-modal.component.scss',
  imports: [TranslateDirective, PaginationComponent, NgbTooltip]
})
export class ImportArrayValidationModalComponent {
  private modal = inject(NgbActiveModal);

  newElementList: Array<Record<string, unknown>> = [];
  errorList: Array<{
    element: Record<string, string>;
    error: string;
  }> = [];
  arrayAttribute!: OIBusArrayAttribute;
  columns: Array<string> = [];
  displayedElementsNew: Page<Record<string, unknown>> = emptyPage();
  displayedElementsError: Page<{
    element: Record<string, string>;
    error: string;
  }> = emptyPage();

  prepare(
    arrayAttribute: OIBusArrayAttribute,
    newElementList: Array<Record<string, unknown>>,
    errorList: Array<{
      element: Record<string, string>;
      error: string;
    }>
  ) {
    this.arrayAttribute = arrayAttribute;
    this.newElementList = newElementList;
    this.errorList = errorList;
    this.columns = this.extractColumns(newElementList);
    this.changePageNew(0);
    this.changePageError(0);
  }

  cancel() {
    this.modal.dismiss();
  }

  submit() {
    this.modal.close(this.newElementList);
  }

  changePageNew(pageNumber: number) {
    this.displayedElementsNew = this.createPageNew(pageNumber);
  }

  changePageError(pageNumber: number) {
    this.displayedElementsError = this.createPageError(pageNumber);
  }

  getFieldValue(element: Record<string, unknown>, column: string): string {
    const value = this.getValueByPath(element, column);
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

  private extractColumns(elements: Array<Record<string, unknown>>): Array<string> {
    const columnSet = new Set<string>();
    elements.forEach(element => {
      Object.keys(element).forEach(key => {
        columnSet.add(key);
      });
    });
    return Array.from(columnSet).sort();
  }

  private createPageNew(pageNumber: number): Page<Record<string, unknown>> {
    return createPageFromArray(this.newElementList, PAGE_SIZE, pageNumber);
  }

  private createPageError(pageNumber: number): Page<{
    element: Record<string, string>;
    error: string;
  }> {
    return createPageFromArray(this.errorList, PAGE_SIZE, pageNumber);
  }

  protected readonly getElementName = getElementName;
}
