import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ObservableState } from '../../shared/save-button/save-button.component';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { SouthConnectorItemManifest } from '../../../../../backend/shared/model/south-connector.model';
import { groupFormControlsByRow } from '../../shared/form-utils';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { HistoryQuerySouthItemCommandDTO, HistoryQuerySouthItemDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthItemSettings } from '../../../../../backend/shared/model/south-settings.model';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-import-history-query-items-modal',
  templateUrl: './import-history-query-items-modal.component.html',
  styleUrl: './import-history-query-items-modal.component.scss',
  imports: [TranslateDirective, PaginationComponent, TranslatePipe]
})
export class ImportHistoryQueryItemsModalComponent {
  private modal = inject(NgbActiveModal);

  state = new ObservableState();
  southItemSchema: SouthConnectorItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];
  existingItemList: Array<HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>> = [];
  newItemList: Array<HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>> = [];
  errorList: Array<{
    item: HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>;
    error: string;
  }> = [];
  displaySettings: Array<OibFormControl> = [];
  displayedItemsNew: Page<HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>> = emptyPage();
  displayedItemsError: Page<{
    item: HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>;
    error: string;
  }> = emptyPage();

  prepare(
    southItemSchema: SouthConnectorItemManifest,
    existingItemList: Array<HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>>,
    newItemList: Array<HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>>,
    errorList: Array<{
      item: HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>;
      error: string;
    }>
  ) {
    this.existingItemList = existingItemList;
    this.newItemList = newItemList;
    this.errorList = errorList;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.displaySettings = southItemSchema.settings.filter(setting => setting.displayInViewMode);

    this.southItemSchema = southItemSchema;
    this.changePageNew(0);
    this.changePageError(0);
  }

  cancel() {
    this.modal.dismiss();
  }

  submit() {
    this.modal.close(this.newItemList);
  }

  getFieldValue(element: any, field: string): string {
    return element[field];
  }

  changePageNew(pageNumber: number) {
    this.displayedItemsNew = this.createPageNew(pageNumber);
  }

  changePageError(pageNumber: number) {
    this.displayedItemsError = this.createPageError(pageNumber);
  }

  private createPageNew(
    pageNumber: number
  ): Page<HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>> {
    return createPageFromArray(this.newItemList, PAGE_SIZE, pageNumber);
  }

  private createPageError(pageNumber: number): Page<{
    item: HistoryQuerySouthItemDTO<SouthItemSettings> | HistoryQuerySouthItemCommandDTO<SouthItemSettings>;
    error: string;
  }> {
    return createPageFromArray(this.errorList, PAGE_SIZE, pageNumber);
  }

  toggleItemNew() {
    this.changePageNew(this.displayedItemsNew.number);
  }

  toggleItemError() {
    this.changePageNew(this.displayedItemsError.number);
  }
}
