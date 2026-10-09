import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { createPageFromArray, Page } from '@oibus/shared/common/types';
import { OIBusArrayAttribute } from '@oibus/shared/connector/form.model';

import { PaginationComponent } from '../../../pagination/pagination.component';
import { getElementName } from '../../../utils/csv.utils';
import { emptyPage } from '../../../utils/page.utils';
const PAGE_SIZE = 20;

@Component({
  selector: 'oib-import-array-validation-modal',
  templateUrl: './import-array-validation-modal.component.html',
  styleUrl: './import-array-validation-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, PaginationComponent, NgbTooltip]
})
export class ImportArrayValidationModalComponent {
  private readonly modal = inject(NgbActiveModal);

  readonly newElementList = signal<Array<Record<string, unknown>>>([]);
  readonly errorList = signal<
    Array<{
      element: Record<string, string>;
      error: string;
    }>
  >([]);
  arrayAttribute!: OIBusArrayAttribute;
  readonly columns = signal<Array<string>>([]);
  readonly displayedElementsNew = signal<Page<Record<string, unknown>>>(emptyPage());
  readonly displayedElementsError = signal<
    Page<{
      element: Record<string, string>;
      error: string;
    }>
  >(emptyPage());

  prepare(
    arrayAttribute: OIBusArrayAttribute,
    newElementList: Array<Record<string, unknown>>,
    errorList: Array<{
      element: Record<string, string>;
      error: string;
    }>
  ) {
    this.arrayAttribute = arrayAttribute;
    this.newElementList.set(newElementList);
    this.errorList.set(errorList);
    this.columns.set(this.extractColumns(newElementList));
    this.changePageNew(0);
    this.changePageError(0);
  }

  cancel() {
    this.modal.dismiss();
  }

  submit() {
    this.modal.close(this.newElementList());
  }

  changePageNew(pageNumber: number) {
    this.displayedElementsNew.set(this.createPageNew(pageNumber));
  }

  changePageError(pageNumber: number) {
    this.displayedElementsError.set(this.createPageError(pageNumber));
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

  getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    if (obj && path in obj) {
      return obj[path];
    }
    const keys = path.split('_');
    return keys.reduce<unknown>((acc, key) => (acc ? (acc as Record<string, unknown>)[key] : acc), obj);
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
    return createPageFromArray(this.newElementList(), PAGE_SIZE, pageNumber);
  }

  private createPageError(pageNumber: number): Page<{
    element: Record<string, string>;
    error: string;
  }> {
    return createPageFromArray(this.errorList(), PAGE_SIZE, pageNumber);
  }

  protected readonly getElementName = getElementName;
}
