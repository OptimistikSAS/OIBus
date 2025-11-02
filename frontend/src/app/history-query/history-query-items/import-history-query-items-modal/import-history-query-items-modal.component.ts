import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { ObservableState } from '../../../shared/save-button/save-button.component';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../../backend/shared/model/types';
import { emptyPage } from '../../../shared/test-utils';
import { HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '../../../../../../backend/shared/model/history-query.model';
import { OIBusAttribute, OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { isDisplayableAttribute } from '../../../shared/form/dynamic-form.builder';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-import-history-query-items-modal',
  templateUrl: './import-history-query-items-modal.component.html',
  styleUrl: './import-history-query-items-modal.component.scss',
  imports: [TranslateDirective, PaginationComponent, TranslatePipe, NgbTooltip]
})
export class ImportHistoryQueryItemsModalComponent {
  private modal = inject(NgbActiveModal);
  private translateService = inject(TranslateService);

  state = new ObservableState();
  existingItemList: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO> = [];
  newItemList: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO> = [];
  errorList: Array<{
    item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO;
    error: string;
  }> = [];
  displaySettings: Array<OIBusAttribute> = [];
  displayedItemsNew: Page<HistoryQueryItemDTO | HistoryQueryItemCommandDTO> = emptyPage();
  displayedItemsError: Page<{
    item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO;
    error: string;
  }> = emptyPage();

  prepare(
    manifest: SouthConnectorManifest,
    existingItemList: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>,
    newItemList: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>,
    errorList: Array<{
      item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO;
      error: string;
    }>
  ) {
    this.existingItemList = existingItemList;
    this.newItemList = newItemList;
    this.errorList = errorList;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      element => element.key === 'settings'
    )! as OIBusObjectAttribute;
    this.displaySettings = itemSettingsManifest.attributes.filter(setting => isDisplayableAttribute(setting));
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
    const foundFormControl = this.displaySettings.find(formControl => formControl.key === field);
    if (foundFormControl && element[field] && foundFormControl.type === 'string-select') {
      return this.translateService.instant(foundFormControl.translationKey + '.' + element[field]);
    }
    return element[field];
  }

  changePageNew(pageNumber: number) {
    this.displayedItemsNew = this.createPageNew(pageNumber);
  }

  changePageError(pageNumber: number) {
    this.displayedItemsError = this.createPageError(pageNumber);
  }

  private createPageNew(pageNumber: number): Page<HistoryQueryItemDTO | HistoryQueryItemCommandDTO> {
    return createPageFromArray(this.newItemList, PAGE_SIZE, pageNumber);
  }

  private createPageError(pageNumber: number): Page<{
    item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO;
    error: string;
  }> {
    return createPageFromArray(this.errorList, PAGE_SIZE, pageNumber);
  }
}
