import { Component } from '@angular/core';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { SouthConnectorItemDTO, SouthConnectorItemManifest } from '../../../../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';

import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { groupFormControlsByRow } from '../../shared/form-utils';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { FormComponent } from '../../shared/form/form.component';
import { PipeProviderService } from '../../shared/form/pipe-provider.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../shared/model/types';
import { emptyPage } from '../../shared/test-utils';

const PAGE_SIZE = 7;

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
  state = new ObservableState();
  southItemSchema: SouthConnectorItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];
  existingItemList: Array<SouthConnectorItemDTO> = [];
  newItemList: Array<SouthConnectorItemDTO> = [];
  errorList: Array<{ item: SouthConnectorItemDTO; message: string }> = [];
  scanModes: Array<ScanModeDTO> = [];
  displaySettings: Array<OibFormControl> = [];
  displayedItemsNew: Page<SouthConnectorItemDTO> = emptyPage();
  displayedItemsError: Page<{ item: SouthConnectorItemDTO; message: string }> = emptyPage();

  constructor(
    private modal: NgbActiveModal,
    private pipeProviderService: PipeProviderService
  ) {}

  prepare(
    southItemSchema: SouthConnectorItemManifest,
    existingItemList: Array<SouthConnectorItemDTO>,
    newItemList: Array<SouthConnectorItemDTO>,
    errorList: Array<{ item: SouthConnectorItemDTO; message: string }>,
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

  private createPageNew(pageNumber: number): Page<SouthConnectorItemDTO> {
    return createPageFromArray(this.newItemList, PAGE_SIZE, pageNumber);
  }

  private createPageError(pageNumber: number): Page<{ item: SouthConnectorItemDTO; message: string }>{
    return createPageFromArray(this.errorList, PAGE_SIZE, pageNumber);
  }

  toggleItemNew() {
    this.changePageNew(this.displayedItemsNew.number);
  }

  toggleItemError() {
    this.changePageNew(this.displayedItemsError.number);
  }
}
