import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';

import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { groupFormControlsByRow } from '../../shared/form-utils';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { FormComponent } from '../../shared/form/form.component';
import { PipeProviderService } from '../../shared/form/pipe-provider.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { SouthItemSettings } from '../../../../../backend/shared/model/south-settings.model';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-import-south-items-modal',
  templateUrl: './import-south-items-modal.component.html',
  styleUrl: './import-south-items-modal.component.scss',
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    OibCodeBlockComponent,
    OibScanModeComponent,
    NgbTypeahead,
    FormComponent,
    PaginationComponent
  ],
  standalone: true
})
export class ImportSouthItemsModalComponent {
  private modal = inject(NgbActiveModal);
  private pipeProviderService = inject(PipeProviderService);

  state = new ObservableState();
  southItemSchema: SouthConnectorItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];
  existingItemList: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>> = [];
  newItemList: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>> = [];
  errorList: Array<{ item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>; error: string }> =
    [];
  scanModes: Array<ScanModeDTO> = [];
  displaySettings: Array<OibFormControl> = [];
  displayedItemsNew: Page<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>> = emptyPage();
  displayedItemsError: Page<{
    item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>;
    error: string;
  }> = emptyPage();

  prepare(
    southItemSchema: SouthConnectorItemManifest,
    existingItemList: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>>,
    newItemList: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>>,
    errorList: Array<{ item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>; error: string }>,
    scanModes: Array<ScanModeDTO>
  ) {
    this.existingItemList = existingItemList;
    this.newItemList = newItemList;
    this.errorList = errorList;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.displaySettings = southItemSchema.settings.filter(setting => setting.displayInViewMode);

    this.southItemSchema = southItemSchema;
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

  getFieldValue(element: any, field: string, pipeIdentifier: string | undefined): string {
    const value = element[field];
    if (value && pipeIdentifier && this.pipeProviderService.validIdentifier(pipeIdentifier)) {
      return this.pipeProviderService.getPipeForString(pipeIdentifier).transform(value);
    }
    return value;
  }

  changePageNew(pageNumber: number) {
    this.displayedItemsNew = this.createPageNew(pageNumber);
  }

  changePageError(pageNumber: number) {
    this.displayedItemsError = this.createPageError(pageNumber);
  }

  private createPageNew(
    pageNumber: number
  ): Page<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>> {
    return createPageFromArray(this.newItemList, PAGE_SIZE, pageNumber);
  }

  private createPageError(
    pageNumber: number
  ): Page<{ item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>; error: string }> {
    return createPageFromArray(this.errorList, PAGE_SIZE, pageNumber);
  }

  toggleItemNew() {
    this.changePageNew(this.displayedItemsNew.number);
  }

  toggleItemError() {
    this.changePageNew(this.displayedItemsError.number);
  }
}
