import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { ObservableState } from '../../../shared/save-button/save-button.component';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SouthConnectorItemDTO, SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../../backend/shared/model/types';
import { emptyPage } from '../../../shared/test-utils';
import { isDisplayableAttribute } from '../../../shared/form/dynamic-form.builder';
import { OIBusAttribute, OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-import-south-items-modal',
  templateUrl: './import-south-items-modal.component.html',
  styleUrl: './import-south-items-modal.component.scss',
  imports: [TranslateDirective, PaginationComponent, TranslatePipe, NgbTooltip]
})
export class ImportSouthItemsModalComponent {
  private modal = inject(NgbActiveModal);
  private translateService = inject(TranslateService);

  state = new ObservableState();
  existingItemList: Array<SouthConnectorItemDTO> = [];
  newItemList: Array<SouthConnectorItemDTO> = [];
  errorList: Array<{
    item: Record<string, string>;
    error: string;
  }> = [];
  scanModes: Array<ScanModeDTO> = [];
  displaySettings: Array<OIBusAttribute> = [];
  displayedItemsNew: Page<SouthConnectorItemDTO> = emptyPage();
  displayedItemsError: Page<{
    item: Record<string, string>;
    error: string;
  }> = emptyPage();

  prepare(
    manifest: SouthConnectorManifest,
    existingItemList: Array<SouthConnectorItemDTO>,
    newItemList: Array<SouthConnectorItemDTO>,
    errorList: Array<{
      item: Record<string, string>;
      error: string;
    }>,
    scanModes: Array<ScanModeDTO>
  ) {
    this.existingItemList = existingItemList;
    this.newItemList = newItemList;
    this.errorList = errorList;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      element => element.key === 'settings'
    )! as OIBusObjectAttribute;
    this.displaySettings = itemSettingsManifest.attributes.filter(setting => isDisplayableAttribute(setting));
    this.scanModes = scanModes;
    this.changePageNew(0);
    this.changePageError(0);
  }

  cancel() {
    this.modal.dismiss();
  }

  submit() {
    this.modal.close(this.newItemList);
  }

  getScanMode(scanModeId: string | null): ScanModeDTO | undefined {
    return this.scanModes.find(scanMode => scanMode.id === scanModeId);
  }

  getFieldValue(element: any, field: string): string {
    const foundFormControl = this.displaySettings.find(formControl => formControl.key === field);
    if (foundFormControl && element[field] && foundFormControl.type === 'string-select') {
      return this.translateService.instant(foundFormControl.translationKey + '.' + element[field]);
    }
    return element[field] || '';
  }

  getGroupNoneText(): string {
    return this.translateService.instant('south.items.group-none');
  }

  changePageNew(pageNumber: number) {
    this.displayedItemsNew = this.createPageNew(pageNumber);
  }

  changePageError(pageNumber: number) {
    this.displayedItemsError = this.createPageError(pageNumber);
  }

  private createPageNew(pageNumber: number): Page<SouthConnectorItemDTO> {
    return createPageFromArray(this.newItemList, PAGE_SIZE, pageNumber);
  }

  private createPageError(pageNumber: number): Page<{
    item: Record<string, string>;
    error: string;
  }> {
    return createPageFromArray(this.errorList, PAGE_SIZE, pageNumber);
  }
}
